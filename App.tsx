// import React, { useState, useCallback, useEffect } from 'react';
// import { AnalysisResult, Review, AnalysisStatus, UserAccount, Location, SubscriptionTier, ReviewSource, TIER_LIMITS } from './types';
// import ReviewInput from './components/ReviewInput';
// import Dashboard from './components/Dashboard';
// import Auth from './components/Auth';
// import LocationManager from './components/LocationManager';
// import Pricing from './components/Pricing';
// import Checkout from './components/Checkout';
// import LocationSettings from './components/LocationSettings';
// import AdminDashboard from './components/AdminDashboard';
// import CustomerPortal from './components/CustomerPortal';
// import Logo from './components/Logo';
// import { BusinessSearchResult } from './services/geminiService';
// import apiClient from './services/apiClient';

// const App: React.FC = () => {
//   const [isAdminView, setIsAdminView] = useState(() => 
//     window.location.pathname.startsWith('/admin') || window.location.hash === '#admin'
//   );
//   const [portalLocationId, setPortalLocationId] = useState<string | null>(() => {
//     const params = new URLSearchParams(window.location.search);
//     return params.get('portal');
//   });
  
//   const [user, setUser] = useState<UserAccount | null>(null);
//   const [isLoadingAuth, setIsLoadingAuth] = useState(true);
//   const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
//   const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
//   const [error, setError] = useState<string | null>(null);
//   const [showPricing, setShowPricing] = useState(false);
//   const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier | null>(null);
//   const [isSettingsOpen, setIsSettingsOpen] = useState(false);

//   // Check for existing authentication on mount
//   useEffect(() => {
//     const checkAuth = async () => {
//       const token = localStorage.getItem('auth_token');
//       if (token) {
//         try {
//           const { data: userData } = await apiClient.get('/api/auth/me');
//           const { data: locationsData } = await apiClient.get('/api/locations');
          
//           const locationsWithReviews = await Promise.all(
//             locationsData.map(async (loc: any) => {
//               try {
//                 const { data: locationDetail } = await apiClient.get(`/api/locations/${loc.id}`);
//                 return locationDetail;
//               } catch (err) {
//                 return { ...loc, reviews: [], archivedReviews: [] };
//               }
//             })
//           );
          
//           setUser({ ...userData, locations: locationsWithReviews });
//         } catch (error) {
//           console.error('Auth check failed:', error);
//           localStorage.removeItem('auth_token');
//         }
//       }
//       setIsLoadingAuth(false);
//     };
    
//     checkAuth();
//   }, []);

//   const refreshUserData = async () => {
//     try {
//       const { data: userData } = await apiClient.get('/api/auth/me');
//       setUser(prevUser => prevUser ? { ...prevUser, ...userData } : null);
//     } catch (error) {
//       console.error('Failed to refresh user data:', error);
//     }
//   };

//   const refreshLocation = async (locationId: string) => {
//     try {
//       const { data: locationData } = await apiClient.get(`/api/locations/${locationId}`);
//       setUser(prevUser => {
//         if (!prevUser) return null;
//         return {
//           ...prevUser,
//           locations: prevUser.locations.map(l => 
//             l.id === locationId ? locationData : l
//           )
//         };
//       });
//     } catch (error) {
//       console.error('Failed to refresh location:', error);
//     }
//   };

//   const handleIncrementUsage = async (type: 'chats' | 'imports', count: number = 1) => {
//     if (!user) return;
//     try {
//       await apiClient.post(`/api/usage/increment/${type}`, { count });
//       await refreshUserData();
//     } catch (error) {
//       console.error('Failed to increment usage:', error);
//     }
//   };

//   const handleLogin = (newUser: UserAccount) => setUser(newUser);

//   const handleLogout = () => {
//     localStorage.removeItem('auth_token');
//     setUser(null);
//     setActiveLocationId(null);
//     setStatus(AnalysisStatus.IDLE);
//     setShowPricing(false);
//   };

//   const handleCreateLocation = async (name: string, businessData?: BusinessSearchResult) => {
//     if (!user) return;
//     try {
//       const { data: newLocation } = await apiClient.post('/api/locations', { name });
//       const { data: fullLocation } = await apiClient.get(`/api/locations/${newLocation.id}`);
//       setUser({ ...user, locations: [fullLocation, ...user.locations] });
//     } catch (error) {
//       console.error('Failed to create location:', error);
//       setError('Failed to create location. Please try again.');
//     }
//   };

//   const handleUpdateLocation = async (updatedLoc: Location) => {
//     if (!user) return;
//     try {
//       await apiClient.put(`/api/locations/${updatedLoc.id}`, {
//         name: updatedLoc.name,
//         linked_accounts: updatedLoc.linkedAccounts,
//         last_analysis: updatedLoc.lastAnalysis,
//         is_syncing: updatedLoc.isSyncing,
//         sync_stage: updatedLoc.syncStage
//       });
//       setUser({ ...user, locations: user.locations.map(l => l.id === updatedLoc.id ? updatedLoc : l) });
//     } catch (error) {
//       console.error('Failed to update location:', error);
//     }
//   };

//   const handleDeleteLocation = async (id: string) => {
//     if (!user) return;
//     try {
//       await apiClient.delete(`/api/locations/${id}`);
//       setUser({ ...user, locations: user.locations.filter(l => l.id !== id) });
//       if (activeLocationId === id) setActiveLocationId(null);
//     } catch (error) {
//       console.error('Failed to delete location:', error);
//       setError('Failed to delete location. Please try again.');
//     }
//   };

//   const handleUpdateReviewWorkflow = async (reviewId: string, workflow: { tags?: string[], assignedTo?: string }) => {
//     const activeLoc = user?.locations.find(l => l.id === activeLocationId);
//     if (!activeLoc || !user) return;
//     try {
//       await apiClient.put(`/api/reviews/${reviewId}`, workflow);
//       await refreshLocation(activeLoc.id);
//     } catch (error) {
//       console.error('Failed to update review workflow:', error);
//     }
//   };

//   const handleDisconnectSource = async (source: ReviewSource) => {
//     const activeLoc = user?.locations.find(l => l.id === activeLocationId);
//     if (!activeLoc || !user) return;
//     try {
//       await apiClient.delete(`/api/integrations/${source}/disconnect/${activeLoc.id}`);
//       const updatedLinkedAccounts = { ...activeLoc.linkedAccounts };
//       delete (updatedLinkedAccounts as any)[source];
//       setUser({
//         ...user,
//         locations: user.locations.map(l => 
//           l.id === activeLoc.id 
//             ? { ...l, linkedAccounts: updatedLinkedAccounts, updatedAt: new Date().toISOString() }
//             : l
//         )
//       });
//     } catch (error) {
//       console.error('Failed to disconnect source:', error);
//     }
//   };

//   const handleAnalyze = useCallback(async (data: { reviews?: Review[], url?: string, source?: string, gmbLocation?: string }) => {
//     const activeLoc = user?.locations.find(l => l.id === activeLocationId);
//     if (!activeLoc || !user) return;

//     const tier = user.subscription?.tier || 'free';
//     const limit = TIER_LIMITS[tier].reviews;
//     const currentUsage = user.usage?.importsToday || 0;

//     if (currentUsage >= limit) {
//       setError(`Import Limit Reached (${currentUsage}/${limit}). Upgrade for more volume.`);
//       return;
//     }

//     setUser(prevUser => {
//       if (!prevUser) return null;
//       return {
//         ...prevUser,
//         locations: prevUser.locations.map(l =>
//           l.id === activeLoc.id ? { ...l, isSyncing: true, syncStage: 'scraping' as any } : l
//         )
//       };
//     });
    
//     try {
//       if (data.reviews) {
//         for (const review of data.reviews) {
//           await apiClient.post(`/api/reviews/${activeLoc.id}/reviews`, {
//             author: review.author,
//             rating: review.rating,
//             text: review.text,
//             review_date: review.date,
//             source: 'manual'
//           });
//         }
//         await apiClient.post(`/api/reviews/${activeLoc.id}/analyze`);
//       } else {
//         const syncData = {
//           location_id: activeLoc.id,
//           source: data.source || 'gmb',
//           url: data.url,
//           gmb_location: data.gmbLocation
//         };
//         await apiClient.post(`/api/reviews/${activeLoc.id}/sync`, syncData);
//       }
      
//       await refreshLocation(activeLoc.id);
//       await refreshUserData();
//       setStatus(AnalysisStatus.SUCCESS);
//     } catch (err: any) {
//       console.error('Analysis error:', err);
//       setError(err.response?.data?.detail || err.message || 'Sync failed.');
//       setUser(prevUser => {
//         if (!prevUser) return null;
//         return {
//           ...prevUser,
//           locations: prevUser.locations.map(l =>
//             l.id === activeLocationId ? { ...l, isSyncing: false, syncStage: 'idle' as any } : l
//           )
//         };
//       });
//       setStatus(AnalysisStatus.ERROR);
//     }
//   }, [activeLocationId, user]);

//   const handleGoBack = () => {
//     setActiveLocationId(null);
//     setStatus(AnalysisStatus.IDLE);
//     setError(null);
//     setIsSettingsOpen(false);
//   };

//   // Conditional returns AFTER all hooks
//   if (portalLocationId) {
//     return <CustomerPortal locationId={portalLocationId} />;
//   }

//   if (isLoadingAuth) {
//     return (
//       <div className="min-h-screen bg-slate-50 flex items-center justify-center">
//         <div className="text-center">
//           <div className="w-16 h-16 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
//           <p className="text-slate-600 font-bold">Loading...</p>
//         </div>
//       </div>
//     );
//   }

//   if (isAdminView) return <AdminDashboard />;
//   const activeLocation = user?.locations.find(l => l.id === activeLocationId) || null;

//   return (
//     <div className="min-h-screen bg-slate-50 pb-12">
//       {selectedPlan && <Checkout tier={selectedPlan} onSuccess={() => { setUser({...user!, subscription: {tier: selectedPlan, status: 'active', currentPeriodEnd: new Date(Date.now() + 30*24*60*60*1000).toISOString()}}); setSelectedPlan(null); setShowPricing(false); }} onCancel={() => setSelectedPlan(null)} />}
//       {isSettingsOpen && activeLocation && <LocationSettings location={activeLocation} onSave={(u) => { handleUpdateLocation(u); setIsSettingsOpen(false); }} onClose={() => setIsSettingsOpen(false)} />}

//       <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
//         <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
//           <div className="flex items-center gap-4">
//             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md border border-slate-100 p-2.5 text-brand-600"><Logo /></div>
//             <div>
//               <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">Review Kit</h1>
//               {activeLocation && <div className="flex items-center gap-2 mt-0.5"><span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">{activeLocation.name}</span><button onClick={() => setIsSettingsOpen(true)} className="text-slate-300 hover:text-slate-600 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1.03 1.75l-.44.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1.03 1.75l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.44.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.44-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.44-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg></button></div>}
//             </div>
//           </div>
//           <div className="flex items-center gap-6">
//             {user && <>
//               {activeLocation && !showPricing && <button onClick={handleGoBack} className="text-[11px] font-black text-slate-500 hover:text-slate-800 uppercase tracking-widest flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>All Sites</button>}
//               <div className="h-8 w-px bg-slate-100 mx-2" /><div className="flex items-center gap-4"><div className="w-9 h-9 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center font-black text-slate-500 text-sm shadow-inner">{user.name[0]}</div><button onClick={handleLogout} className="text-[10px] font-black text-slate-500 hover:text-red-500 uppercase tracking-widest px-3 py-2 rounded-xl hover:bg-red-50/50 transition-all">Log Out</button></div>
//             </>}
//           </div>
//         </div>
//       </nav>

//       <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
//         {!user ? <Auth onLogin={handleLogin} /> : showPricing ? <Pricing onSelectPlan={setSelectedPlan} /> : !activeLocation ? (
//           <LocationManager user={user} onSelect={(loc) => setActiveLocationId(loc.id)} onCreate={handleCreateLocation} onDelete={handleDeleteLocation} onUpgrade={() => setShowPricing(true)} />
//         ) : (
//           <div className="animate-in fade-in duration-500">
//             {!activeLocation.lastAnalysis && !activeLocation.isSyncing && activeLocation.reviews.length === 0 && (
//               <div className="max-w-2xl mx-auto text-center py-12">
//                 <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Sync <span className="text-brand-600">{activeLocation.name}</span></h2>
//                 <ReviewInput onAnalyze={handleAnalyze} isLoading={false} existingLinks={activeLocation.linkedAccounts} />
//               </div>
//             )}
            
//             {(activeLocation.lastAnalysis || activeLocation.isSyncing || activeLocation.reviews.length > 0) && (
//               <Dashboard location={activeLocation} userUsage={user.usage} subscriptionTier={user.subscription?.tier} onUpdateWorkflow={handleUpdateReviewWorkflow} onUpgrade={() => setShowPricing(true)} onRetry={() => setActiveLocationId(activeLocation.id)} onSyncNewSource={handleAnalyze} onDisconnectSource={(s) => { if(confirm(`Disconnect ${s.toUpperCase()}?`)) handleDisconnectSource(s); }} onChatTrigger={() => handleIncrementUsage('chats')} />
//             )}

//             {error && <div className="max-w-md mx-auto bg-white mt-8 p-10 rounded-3xl border border-red-100 shadow-xl text-center"><h3 className="text-xl font-black text-slate-900">Error</h3><p className="text-slate-700 mt-2 mb-8 font-bold">{error}</p><button onClick={() => setError(null)} className="bg-slate-900 text-white font-black py-3 px-8 rounded-xl uppercase tracking-widest text-xs">Dismiss</button></div>}
//           </div>
//         )}
//       </main>
//     </div>
//   );
// };

// export default App;
import React, { useState, useCallback, useEffect } from 'react';
import { AnalysisResult, Review, AnalysisStatus, UserAccount, Location, SubscriptionTier, ReviewSource, TIER_LIMITS } from './types';
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
import { BusinessSearchResult } from './services/geminiService';
import apiClient from './services/apiClient';

const App: React.FC = () => {
  const [isAdminView, setIsAdminView] = useState(() => 
    window.location.pathname.startsWith('/admin') || window.location.hash === '#admin'
  );
  const [portalLocationId, setPortalLocationId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('portal');
  });
  
  const [user, setUser] = useState<UserAccount | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [showPricing, setShowPricing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Check for existing authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const { data: userData } = await apiClient.get('/api/auth/me');
          const { data: locationsData } = await apiClient.get('/api/locations');
          
          const locationsWithReviews = await Promise.all(
            locationsData.map(async (loc: any) => {
              try {
                const { data: locationDetail } = await apiClient.get(`/api/locations/${loc.id}`);
                return locationDetail;
              } catch (err) {
                return { ...loc, reviews: [], archivedReviews: [] };
              }
            })
          );
          
          setUser({ ...userData, locations: locationsWithReviews });
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('auth_token');
        }
      }
      setIsLoadingAuth(false);
    };
    
    checkAuth();
  }, []);

  const refreshUserData = async () => {
    try {
      const { data: userData } = await apiClient.get('/api/auth/me');
      setUser(prevUser => prevUser ? { ...prevUser, ...userData } : null);
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };

  const refreshLocation = async (locationId: string) => {
    try {
      const { data: locationData } = await apiClient.get(`/api/locations/${locationId}`);
      setUser(prevUser => {
        if (!prevUser) return null;
        return {
          ...prevUser,
          locations: prevUser.locations.map(l => 
            l.id === locationId ? locationData : l
          )
        };
      });
    } catch (error) {
      console.error('Failed to refresh location:', error);
    }
  };

  const handleIncrementUsage = async (type: 'chats' | 'imports', count: number = 1) => {
    if (!user) return;
    try {
      await apiClient.post(`/api/usage/increment/${type}`, { count });
      await refreshUserData();
    } catch (error) {
      console.error('Failed to increment usage:', error);
    }
  };

  const handleLogin = (newUser: UserAccount) => setUser(newUser);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setActiveLocationId(null);
    setStatus(AnalysisStatus.IDLE);
    setShowPricing(false);
  };

  const handleCreateLocation = async (name: string, businessData?: BusinessSearchResult) => {
    if (!user) return;
    try {
      const { data: newLocation } = await apiClient.post('/api/locations', { name });
      const { data: fullLocation } = await apiClient.get(`/api/locations/${newLocation.id}`);
      setUser({ ...user, locations: [fullLocation, ...user.locations] });
    } catch (error) {
      console.error('Failed to create location:', error);
      setError('Failed to create location. Please try again.');
    }
  };

  const handleUpdateLocation = async (updatedLoc: Location) => {
    if (!user) return;
    try {
      await apiClient.put(`/api/locations/${updatedLoc.id}`, {
        name: updatedLoc.name,
        linked_accounts: updatedLoc.linkedAccounts,
        last_analysis: updatedLoc.lastAnalysis,
        is_syncing: updatedLoc.isSyncing,
        sync_stage: updatedLoc.syncStage
      });
      setUser({ ...user, locations: user.locations.map(l => l.id === updatedLoc.id ? updatedLoc : l) });
    } catch (error) {
      console.error('Failed to update location:', error);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (!user) return;
    try {
      await apiClient.delete(`/api/locations/${id}`);
      setUser({ ...user, locations: user.locations.filter(l => l.id !== id) });
      if (activeLocationId === id) setActiveLocationId(null);
    } catch (error) {
      console.error('Failed to delete location:', error);
      setError('Failed to delete location. Please try again.');
    }
  };

  const handleUpdateReviewWorkflow = async (reviewId: string, workflow: { tags?: string[], assignedTo?: string }) => {
    const activeLoc = user?.locations.find(l => l.id === activeLocationId);
    if (!activeLoc || !user) return;
    try {
      await apiClient.put(`/api/reviews/${reviewId}`, workflow);
      await refreshLocation(activeLoc.id);
    } catch (error) {
      console.error('Failed to update review workflow:', error);
    }
  };

  const handleDisconnectSource = async (source: ReviewSource) => {
    const activeLoc = user?.locations.find(l => l.id === activeLocationId);
    if (!activeLoc || !user) return;
    try {
      await apiClient.delete(`/api/integrations/${source}/disconnect/${activeLoc.id}`);
      const updatedLinkedAccounts = { ...activeLoc.linkedAccounts };
      delete (updatedLinkedAccounts as any)[source];
      setUser({
        ...user,
        locations: user.locations.map(l => 
          l.id === activeLoc.id 
            ? { ...l, linkedAccounts: updatedLinkedAccounts, updatedAt: new Date().toISOString() }
            : l
        )
      });
    } catch (error) {
      console.error('Failed to disconnect source:', error);
    }
  };

  const handleAnalyze = useCallback(async (data: { reviews?: Review[], url?: string, source?: string, gmbLocation?: string }) => {
    const activeLoc = user?.locations.find(l => l.id === activeLocationId);
    if (!activeLoc || !user) return;

    // LIMIT CHECK REMOVED - No longer checking import limits on frontend
    // The backend will handle all syncing without restrictions
    
    setUser(prevUser => {
      if (!prevUser) return null;
      return {
        ...prevUser,
        locations: prevUser.locations.map(l =>
          l.id === activeLoc.id ? { ...l, isSyncing: true, syncStage: 'scraping' as any } : l
        )
      };
    });
    
    try {
      if (data.reviews) {
        for (const review of data.reviews) {
          await apiClient.post(`/api/reviews/${activeLoc.id}/reviews`, {
            author: review.author,
            rating: review.rating,
            text: review.text,
            review_date: review.date,
            source: 'manual'
          });
        }
        await apiClient.post(`/api/reviews/${activeLoc.id}/analyze`);
      } else {
        const syncData = {
          location_id: activeLoc.id,
          source: data.source || 'gmb',
          url: data.url,
          gmb_location: data.gmbLocation
        };
        await apiClient.post(`/api/reviews/${activeLoc.id}/sync`, syncData);
      }
      
      await refreshLocation(activeLoc.id);
      await refreshUserData();
      setStatus(AnalysisStatus.SUCCESS);
    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(err.response?.data?.detail || err.message || 'Sync failed.');
      setUser(prevUser => {
        if (!prevUser) return null;
        return {
          ...prevUser,
          locations: prevUser.locations.map(l =>
            l.id === activeLocationId ? { ...l, isSyncing: false, syncStage: 'idle' as any } : l
          )
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

  // Conditional returns AFTER all hooks
  if (portalLocationId) {
    return <CustomerPortal locationId={portalLocationId} />;
  }

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-bold">Loading...</p>
        </div>
      </div>
    );
  }

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