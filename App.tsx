import React, { useState, useCallback, useEffect } from 'react';
import { AnalysisResult, Review, AnalysisStatus, UserAccount, Location, SubscriptionTier, LinkedAccounts, ReviewSource, TIER_LIMITS } from './types';
import ReviewInput from './components/ReviewInput';
import Dashboard from './components/Dashboard';
import Auth from './components/Auth';
import LocationManager from './components/LocationManager';
import Pricing from './components/Pricing';
import Checkout from './components/Checkout';
import LocationSettings from './components/LocationSettings';
import AdminDashboard from './components/AdminDashboard';
import CustomerPortal from './components/CustomerPortal';
import Logo from './components/Logo';
import { analyzeReviews, BusinessSearchResult } from './services/geminiService';
import { fetchRealExternalReviews } from './services/scraperService';
import { gmbService } from './services/gmbService';

const App: React.FC = () => {
  const [isAdminView, setIsAdminView] = useState(() => 
    window.location.pathname.startsWith('/admin') || window.location.hash === '#admin'
  );
  const [portalLocationId, setPortalLocationId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('portal');
  });
  
  const [user, setUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem('review_pulse_active_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [showPricing, setShowPricing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const handleLocationChange = () => {
      setIsAdminView(window.location.pathname.startsWith('/admin') || window.location.hash === '#admin');
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  useEffect(() => {
    if (user) {
      const today = new Date().toISOString().split('T')[0];
      if (!user.usage || user.usage.lastResetDate !== today) {
        setUser({
          ...user,
          usage: { chatsToday: 0, importsToday: 0, lastResetDate: today }
        });
      }
    }
  }, [user?.id]); 

  useEffect(() => {
    if (user) {
      localStorage.setItem('review_pulse_active_user', JSON.stringify(user));
      localStorage.setItem(`user_db_${user.id}`, JSON.stringify(user));
    } else {
      localStorage.removeItem('review_pulse_active_user');
    }
  }, [user]);

  if (portalLocationId) {
    return <CustomerPortal locationId={portalLocationId} />;
  }

  const handleIncrementUsage = (type: 'chats' | 'imports', count: number = 1) => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const currentUsage = user.usage || { chatsToday: 0, importsToday: 0, lastResetDate: today };
    setUser({
      ...user,
      usage: {
        ...currentUsage,
        chatsToday: type === 'chats' ? currentUsage.chatsToday + count : currentUsage.chatsToday,
        importsToday: type === 'imports' ? currentUsage.importsToday + count : currentUsage.importsToday,
      }
    });
  };

  const handleLogin = (newUser: UserAccount) => setUser(newUser);
  const handleLogout = () => {
    setUser(null);
    setActiveLocationId(null);
    setStatus(AnalysisStatus.IDLE);
    setShowPricing(false);
  };

  const handleCreateLocation = (name: string, businessData?: BusinessSearchResult) => {
    if (!user) return;
    const newLoc: Location = {
      id: crypto.randomUUID(),
      name,
      linkedAccounts: {}, 
      reviews: [],
      archivedReviews: [],
      updatedAt: new Date().toISOString()
    };
    setUser({ ...user, locations: [newLoc, ...user.locations] });
  };

  const handleUpdateLocation = (updatedLoc: Location) => {
    if (!user) return;
    setUser({
      ...user,
      locations: user.locations.map(l => l.id === updatedLoc.id ? updatedLoc : l)
    });
  };

  const handleDeleteLocation = (id: string) => {
    if (!user) return;
    setUser({ ...user, locations: user.locations.filter(l => l.id !== id) });
    if (activeLocationId === id) setActiveLocationId(null);
  };

  const handleUpdateReviewWorkflow = (reviewId: string, workflow: { tags?: string[], assignedTo?: string }) => {
    const activeLoc = user?.locations.find(l => l.id === activeLocationId);
    if (!activeLoc || !user) return;
    const updatedReviews = activeLoc.reviews.map(r => r.id === reviewId ? { ...r, ...workflow } : r);
    handleUpdateLocation({ ...activeLoc, reviews: updatedReviews, updatedAt: new Date().toISOString() });
  };

  const handleDisconnectSource = (source: ReviewSource) => {
    const activeLoc = user?.locations.find(l => l.id === activeLocationId);
    if (!activeLoc || !user) return;

    const updatedLinkedAccounts = { ...activeLoc.linkedAccounts };
    delete (updatedLinkedAccounts as any)[source];

    handleUpdateLocation({ 
      ...activeLoc, 
      linkedAccounts: updatedLinkedAccounts, 
      updatedAt: new Date().toISOString() 
    });
  };

  const mergeReviews = (existing: Review[], incoming: Review[]) => {
    const allReviewsMap = new Map<string, Review>();
    existing.forEach(r => allReviewsMap.set(r.id, r));
    incoming.forEach(r => allReviewsMap.set(r.id, r));
    return Array.from(allReviewsMap.values());
  };

  const handleAnalyze = useCallback(async (data: { reviews?: Review[], url?: string, source?: string, gmbLocation?: string }) => {
    const activeLoc = user?.locations.find(l => l.id === activeLocationId);
    if (!activeLoc || !user) return;

    const tier = user.subscription?.tier || 'free';
    const limit = TIER_LIMITS[tier].reviews;
    const currentUsage = user.usage?.importsToday || 0;

    if (currentUsage >= limit) {
      setError(`Import Limit Reached (${currentUsage}/${limit}). Upgrade for more volume.`);
      return;
    }
    
    const updatedLinkedAccounts = { ...activeLoc.linkedAccounts };
    const targetSource = (data.source || 'manual') as ReviewSource;
    const now = new Date().toISOString();

    if (data.url && data.source) {
      (updatedLinkedAccounts as any)[data.source] = { 
        ...((updatedLinkedAccounts as any)[data.source] || {}),
        url: data.url,
        lastSync: now
      };
    }
    if (data.gmbLocation) {
      updatedLinkedAccounts.gmb = { 
        locationId: data.gmbLocation, 
        title: activeLoc.name, 
        accountId: 'connected',
        lastSync: now
      };
    }

    // Initial state update to show syncing
    handleUpdateLocation({ ...activeLoc, linkedAccounts: updatedLinkedAccounts, isSyncing: true, syncStage: 'scraping' });
    
    try {
      let incomingReviews: Review[] = data.reviews || [];

      if (data.url && (data.source === 'trustpilot' || data.source === 'tripadvisor' || data.source === 'getyourguide')) {
        incomingReviews = await fetchRealExternalReviews(data.url, data.source as any, (partialReviews) => {
          // Merge during partial sync for "Live" feel
          const mergedPartials = mergeReviews(activeLoc.reviews, partialReviews);
          setUser(prev => {
            if (!prev) return null;
            return {
              ...prev,
              locations: prev.locations.map(l => 
                l.id === activeLoc.id 
                  ? { ...l, reviews: mergedPartials, linkedAccounts: updatedLinkedAccounts, isSyncing: true, syncStage: 'scraping' } 
                  : l
              )
            };
          });
        });
      } else if (data.gmbLocation) {
        incomingReviews = await gmbService.getReviews(data.gmbLocation);
      }

      if (incomingReviews.length === 0 && !data.reviews) throw new Error("No reviews found.");

      const allowedRemaining = Math.max(0, limit - currentUsage);
      const reviewsToImport = incomingReviews.slice(0, allowedRemaining);
      handleIncrementUsage('imports', reviewsToImport.length);

      const finalMergedReviews = mergeReviews(activeLoc.reviews, reviewsToImport);

      // Update count for the specific source
      if (targetSource !== 'manual') {
        const sourceData = (updatedLinkedAccounts as any)[targetSource];
        if (sourceData) {
          sourceData.importCount = finalMergedReviews.filter(r => r.source === targetSource).length;
        }
      }

      // Transition to Analyzing stage
      setUser(prev => {
        if (!prev) return null;
        return {
          ...prev,
          locations: prev.locations.map(l => 
            l.id === activeLoc.id ? { ...l, reviews: finalMergedReviews, linkedAccounts: updatedLinkedAccounts, isSyncing: true, syncStage: 'analyzing' } : l
          )
        };
      });

      const analysisResult = await analyzeReviews(finalMergedReviews);
      
      // Final result update
      setUser(prev => {
        if (!prev) return null;
        return {
          ...prev,
          locations: prev.locations.map(l => 
            l.id === activeLoc.id ? { 
              ...l, 
              lastAnalysis: analysisResult, 
              linkedAccounts: updatedLinkedAccounts, 
              isSyncing: false, 
              syncStage: 'idle', 
              updatedAt: now 
            } : l
          )
        };
      });
      setStatus(AnalysisStatus.SUCCESS);

    } catch (err: any) {
      setError(err.message || 'Sync failed.');
      setUser(prev => {
        if (!prev) return null;
        return {
          ...prev,
          locations: prev.locations.map(l => l.id === activeLocationId ? { ...l, isSyncing: false, syncStage: 'idle' } : l)
        };
      });
      setStatus(AnalysisStatus.ERROR);
    }
  }, [activeLocationId, user]);

  const handleGoBack = () => {
    setActiveLocationId(null);
    setStatus(AnalysisStatus.IDLE);
    setError(null);
    setIsSettingsOpen(false);
  };

  if (isAdminView) return <AdminDashboard />;
  const activeLocation = user?.locations.find(l => l.id === activeLocationId) || null;

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {selectedPlan && <Checkout tier={selectedPlan} onSuccess={() => { setUser({...user!, subscription: {tier: selectedPlan, status: 'active', currentPeriodEnd: new Date(Date.now() + 30*24*60*60*1000).toISOString()}}); setSelectedPlan(null); setShowPricing(false); }} onCancel={() => setSelectedPlan(null)} />}
      {isSettingsOpen && activeLocation && <LocationSettings location={activeLocation} onSave={(u) => { handleUpdateLocation(u); setIsSettingsOpen(false); }} onClose={() => setIsSettingsOpen(false)} />}

      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md border border-slate-100 p-2.5 text-brand-600"><Logo /></div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">Review Kit</h1>
              {activeLocation && <div className="flex items-center gap-2 mt-0.5"><span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">{activeLocation.name}</span><button onClick={() => setIsSettingsOpen(true)} className="text-slate-300 hover:text-slate-600 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1.03 1.75l-.44.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1.03 1.75l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.44.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.44-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.44-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg></button></div>}
            </div>
          </div>
          <div className="flex items-center gap-6">
            {user && <>
              {activeLocation && !showPricing && <button onClick={handleGoBack} className="text-[11px] font-black text-slate-500 hover:text-slate-800 uppercase tracking-widest flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>All Sites</button>}
              <div className="h-8 w-px bg-slate-100 mx-2" /><div className="flex items-center gap-4"><div className="w-9 h-9 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center font-black text-slate-500 text-sm shadow-inner">{user.name[0]}</div><button onClick={handleLogout} className="text-[10px] font-black text-slate-500 hover:text-red-500 uppercase tracking-widest px-3 py-2 rounded-xl hover:bg-red-50/50 transition-all">Log Out</button></div>
            </>}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {!user ? <Auth onLogin={handleLogin} /> : showPricing ? <Pricing onSelectPlan={setSelectedPlan} /> : !activeLocation ? (
          <LocationManager user={user} onSelect={(loc) => setActiveLocationId(loc.id)} onCreate={handleCreateLocation} onDelete={handleDeleteLocation} onUpgrade={() => setShowPricing(true)} />
        ) : (
          <div className="animate-in fade-in duration-500">
            {!activeLocation.lastAnalysis && !activeLocation.isSyncing && activeLocation.reviews.length === 0 && (
              <div className="max-w-2xl mx-auto text-center py-12">
                <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Sync <span className="text-brand-600">{activeLocation.name}</span></h2>
                <ReviewInput onAnalyze={handleAnalyze} isLoading={false} existingLinks={activeLocation.linkedAccounts} />
              </div>
            )}
            
            {(activeLocation.lastAnalysis || activeLocation.isSyncing || activeLocation.reviews.length > 0) && (
              <Dashboard location={activeLocation} userUsage={user.usage} subscriptionTier={user.subscription?.tier} onUpdateWorkflow={handleUpdateReviewWorkflow} onUpgrade={() => setShowPricing(true)} onRetry={() => setActiveLocationId(activeLocation.id)} onSyncNewSource={handleAnalyze} onDisconnectSource={(s) => { if(confirm(`Disconnect ${s.toUpperCase()}?`)) handleDisconnectSource(s); }} onChatTrigger={() => handleIncrementUsage('chats')} />
            )}

            {error && <div className="max-w-md mx-auto bg-white mt-8 p-10 rounded-3xl border border-red-100 shadow-xl text-center"><h3 className="text-xl font-black text-slate-900">Error</h3><p className="text-slate-700 mt-2 mb-8 font-bold">{error}</p><button onClick={() => setError(null)} className="bg-slate-900 text-white font-black py-3 px-8 rounded-xl uppercase tracking-widest text-xs">Dismiss</button></div>}
          </div>
        )}
      </main>
    </div>
  );
};
export default App;