import React, { useState, useEffect, useRef } from 'react';
import { Location, UserAccount } from '../types';
import { searchBusinesses, BusinessSearchResult } from '../services/geminiService';

interface LocationManagerProps {
  user: UserAccount;
  onSelect: (location: Location) => void;
  onCreate: (name: string, businessData?: BusinessSearchResult) => void;
  onDelete: (id: string) => void;
  onUpgrade: () => void;
}

const LocationManager: React.FC<LocationManagerProps> = ({ user, onSelect, onCreate, onDelete, onUpgrade }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BusinessSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  const locations = user.locations;
  const isTrial = user.subscription?.tier === 'free';
  const limitReached = isTrial && locations.length >= 1;
  const searchTimeoutRef = useRef<number | null>(null);

  // Auto-suggestion logic: Debounced search as the user types
  useEffect(() => {
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length >= 3 && isAdding) {
      searchTimeoutRef.current = window.setTimeout(async () => {
        setIsSearching(true);
        try {
          const results = await searchBusinesses(searchQuery);
          setSearchResults(results);
        } catch (err) {
          console.error("Auto-suggest failed", err);
        } finally {
          setIsSearching(false);
        }
      }, 800); // 800ms debounce
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }

    return () => {
      if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, isAdding]);

  const handleSelectBusiness = (business: BusinessSearchResult) => {
    onCreate(business.title, business);
    setSearchQuery('');
    setSearchResults([]);
    setIsAdding(false);
  };

  const handleManualCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || limitReached) return;
    onCreate(searchQuery);
    setSearchQuery('');
    setSearchResults([]);
    setIsAdding(false);
  };

  const formatLastSync = (dateString: string, hasReviews: boolean) => {
    if (!hasReviews) return "Ready to Sync";
    const date = new Date(dateString);
    return `Last Sync: ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-10 gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Your Portfolio</h2>
          <p className="text-slate-500 font-medium">Manage reviews across all your business locations.</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => limitReached ? onUpgrade() : setIsAdding(true)}
            className={`${limitReached ? 'bg-amber-500' : 'bg-brand-600'} hover:opacity-90 text-white font-black py-3 px-6 rounded-xl shadow-lg transition-all flex items-center gap-2 text-sm uppercase tracking-widest`}
          >
            {limitReached ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Upgrade to add more
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Location
              </>
            )}
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-3xl border-2 border-brand-100 shadow-2xl mb-8 animate-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-xs font-black text-brand-600 uppercase tracking-widest">Global Business Search</h4>
            <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          
          <div className="relative">
            <input 
              autoFocus
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search business name and address..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-12 py-4 outline-none focus:ring-2 focus:ring-brand-600 font-medium text-slate-900 shadow-inner"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
            {isSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-brand-100 border-t-brand-600 rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-3 min-h-[50px]">
            {searchResults.length > 0 ? (
              <>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">AI Match Suggestions</p>
                {searchResults.map((result, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl hover:border-brand-300 hover:bg-brand-50/30 transition-all group animate-in fade-in slide-in-from-top-2 duration-300"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-brand-600 group-hover:text-white transition-colors shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                      </div>
                      <div className="max-w-[80%]">
                        <h5 className="font-black text-slate-800 tracking-tight leading-none mb-2">{result.title}</h5>
                        <div className="flex items-start gap-1.5">
                          <svg className="text-slate-400 mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/></svg>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">{result.address}</p>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleSelectBusiness(result)}
                      className="bg-white border border-slate-200 text-slate-900 font-black px-4 py-2 rounded-lg text-[10px] uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                    >
                      Select
                    </button>
                  </div>
                ))}
              </>
            ) : searchQuery.length >= 3 && !isSearching ? (
              <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
                <p className="text-sm text-slate-500 font-medium mb-3">No exact matches found for your search yet.</p>
                <button 
                  onClick={handleManualCreate}
                  className="text-brand-600 font-black uppercase text-[10px] tracking-widest hover:underline"
                >
                  Create manual entry for "{searchQuery}"
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {locations.length === 0 && !isAdding ? (
        <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-3xl py-20 text-center">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <p className="text-slate-400 font-black uppercase tracking-widest text-sm">No locations added yet</p>
          <button onClick={() => setIsAdding(true)} className="mt-4 text-brand-600 font-black uppercase text-[10px] tracking-widest">Get started by searching</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {locations.map(loc => (
            <div 
              key={loc.id} 
              className="group bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-brand-200 transition-all cursor-pointer relative overflow-hidden"
              onClick={() => onSelect(loc)}
            >
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(loc.id); }}
                className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 z-10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>

              <div className="flex items-center gap-4 mb-6 relative">
                <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none mb-1">{loc.name}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {loc.reviews.length} Reviews Collected
                  </p>
                </div>
              </div>

              {loc.isSyncing && (
                <div className="mb-4 p-2 px-3 bg-brand-50 border border-brand-100 rounded-lg flex items-center gap-2 animate-pulse">
                   <div className="w-2 h-2 bg-brand-600 rounded-full animate-ping"></div>
                   <span className="text-[9px] font-black text-brand-600 uppercase tracking-widest">Active Intelligence Sync</span>
                </div>
              )}

              <div className="space-y-3 relative">
                <div className="flex flex-wrap gap-2">
                  {loc.linkedAccounts.gmb && <span className="bg-brand-50 text-brand-700 text-[9px] font-black px-2 py-1 rounded-md border border-brand-100 uppercase tracking-tighter">Verified on Google</span>}
                  {loc.linkedAccounts.trustpilot && <span className="bg-green-50 text-green-700 text-[9px] font-black px-2 py-1 rounded-md border border-green-100 uppercase tracking-tighter">Trustpilot Active</span>}
                  {loc.linkedAccounts.tripadvisor && <span className="bg-[#34e0a1]/20 text-[#00664d] text-[9px] font-black px-2 py-1 rounded-md border border-[#34e0a1]/40 uppercase tracking-tighter">TripAdvisor Active</span>}
                  {loc.linkedAccounts.getyourguide && <span className="bg-[#ff5533]/10 text-[#ff5533] text-[9px] font-black px-2 py-1 rounded-md border border-[#ff5533]/30 uppercase tracking-tighter">GYG Active</span>}
                  
                  {!loc.linkedAccounts.gmb && 
                   !loc.linkedAccounts.trustpilot && 
                   !loc.linkedAccounts.tripadvisor && 
                   !loc.linkedAccounts.getyourguide && (
                    <span className="text-slate-300 text-[9px] font-black uppercase tracking-widest">Pending connections</span>
                  )}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-center relative">
                <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest flex items-center gap-1">
                  Open Intelligence
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                  {formatLastSync(loc.updatedAt, loc.reviews.length > 0)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {isTrial && (
        <div className="mt-16 p-8 bg-indigo-50 rounded-3xl border border-indigo-100 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 scale-150 pointer-events-none">
             <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/><path d="M2 12h20"/><path d="m5 7-3 5 3 5"/><path d="m19 7 3 5-3 5"/></svg>
          </div>
          <div className="flex gap-4 relative">
            <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16.326A7 7 0 1 1 18 16.326V18a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-900 leading-tight">Trial Intelligence Active</h4>
              <p className="text-sm text-slate-600 font-medium">Add more locations and unlock full Gemini 3 capabilities.</p>
            </div>
          </div>
          <button 
            onClick={onUpgrade}
            className="whitespace-nowrap bg-indigo-600 text-white font-black px-8 py-3.5 rounded-xl uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 relative"
          >
            Upgrade Plan
          </button>
        </div>
      )}
    </div>
  );
};

export default LocationManager;