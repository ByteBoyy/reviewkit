import React, { useState, useEffect } from 'react';
import { Review, GMBAccount, GMBLocation, LinkedAccounts, ReviewSource } from '../types';
import { gmbService } from '../services/gmbService';

const GOOGLE_CLIENT_ID = '436406884098-9015npt9keb7i3glki4fcki3e6ll4o02.apps.googleusercontent.com';

interface ReviewInputProps {
  onAnalyze: (data: { reviews?: Review[], url?: string, source?: string, gmbLocation?: string }) => void;
  isLoading: boolean;
  existingLinks?: LinkedAccounts;
  lockedSource?: ReviewSource;
}

const ReviewInput: React.FC<ReviewInputProps> = ({ onAnalyze, isLoading, existingLinks, lockedSource }) => {
  const [source, setSource] = useState<ReviewSource>(lockedSource || 'gmb');
  const [rawText, setRawText] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  
  // GMB Specific State
  const [isGMBConnected, setIsGMBConnected] = useState(false);
  const [accounts, setAccounts] = useState<GMBAccount[]>([]);
  const [locations, setLocations] = useState<GMBLocation[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [isGMBInitialLoading, setIsGMBInitialLoading] = useState(false);

  // Sync internal source if lockedSource changes
  useEffect(() => {
    if (lockedSource) {
      setSource(lockedSource);
    }
  }, [lockedSource]);

  useEffect(() => {
    if (existingLinks) {
        if (source === 'trustpilot') setExternalUrl(existingLinks.trustpilot?.url || '');
        else if (source === 'tripadvisor') setExternalUrl(existingLinks.tripadvisor?.url || '');
        else if (source === 'getyourguide') setExternalUrl(existingLinks.getyourguide?.url || '');
        else setExternalUrl('');
    }
  }, [source, existingLinks]);

  useEffect(() => {
    // Initialize Google Identity Services
    // @ts-ignore
    if (window.google) {
      try {
        // @ts-ignore
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/business.manage',
          callback: (response: any) => {
            if (response.access_token) {
              gmbService.setToken(response.access_token);
              setIsGMBConnected(true);
              loadGMBAccounts();
            }
          },
        });
        (window as any).googleClient = client;
      } catch (e) {
        console.error("Google Identity Services failed to initialize.", e);
      }
    }
  }, []);

  const loadGMBAccounts = async () => {
    setIsGMBInitialLoading(true);
    try {
      const accs = await gmbService.getAccounts();
      setAccounts(accs);
      if (accs.length > 0) {
        setSelectedAccount(accs[0].name);
      }
    } catch (err) {
      console.error("Failed to load GMB accounts", err);
    } finally {
      setIsGMBInitialLoading(false);
    }
  };

  const loadGMBLocations = async (accountName: string) => {
    setIsGMBInitialLoading(true);
    try {
      const locs = await gmbService.getLocations(accountName);
      setLocations(locs);
      if (locs.length > 0) setSelectedLocation(locs[0].name);
    } catch (err) {
      console.error("Failed to load GMB locations", err);
    } finally {
      setIsGMBInitialLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAccount) {
      loadGMBLocations(selectedAccount);
    }
  }, [selectedAccount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (source === 'manual') {
      if (!rawText.trim()) return;
      const lines = rawText.split('\n').filter(l => l.trim().length > 5);
      const reviews: Review[] = lines.map((line, idx) => ({
        id: `manual-${Date.now()}-${idx}`,
        author: 'Direct Feedback',
        rating: 5,
        date: new Date().toISOString(),
        text: line,
        source: 'manual'
      }));
      onAnalyze({ reviews });
    } else if (source === 'gmb') {
      if (!selectedLocation) return;
      onAnalyze({ source: 'gmb', gmbLocation: selectedLocation });
    } else {
      if (!externalUrl) return;
      onAnalyze({ source, url: externalUrl });
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-left relative">
      <div className="p-10">
        <form onSubmit={handleSubmit} className="space-y-8">
          {!lockedSource && (
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest ml-1">Intelligence Channel</label>
              <select 
                value={source} 
                onChange={(e) => setSource(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-4 text-sm font-black text-slate-900 outline-none focus:ring-2 focus:ring-brand-600 transition-all cursor-pointer"
              >
                <option value="gmb">Google My Business (Official Connection)</option>
                <option value="trustpilot">Trustpilot (AI Scraping)</option>
                <option value="tripadvisor">TripAdvisor (AI Scraping)</option>
                <option value="getyourguide">GetYourGuide (AI Scraping)</option>
                <option value="manual">Manual Direct Feedback</option>
              </select>
            </div>
          )}

          <div className="min-h-[140px] animate-in fade-in duration-300">
            {source === 'gmb' && (
              <div className="space-y-6">
                {!isGMBConnected ? (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => (window as any).googleClient?.requestAccessToken()}
                      className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-brand-600 hover:bg-brand-50/30 text-slate-900 font-bold py-5 rounded-2xl shadow-sm transition-all group"
                    >
                      <svg width="24" height="24" viewBox="0 0 48 48" className="group-hover:scale-110 transition-transform"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                      Connect Google Business Profile
                    </button>
                    <p className="text-[10px] text-center text-slate-500 font-bold uppercase tracking-widest px-8 leading-relaxed">
                      This will allow ReviewPulse to import your official locations and reviews directly from Google.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in slide-in-from-top-4 duration-500">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Business Account</label>
                      <select 
                        value={selectedAccount} 
                        onChange={(e) => setSelectedAccount(e.target.value)} 
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-sm font-black text-slate-900 outline-none focus:ring-2 focus:ring-brand-600 appearance-none cursor-pointer"
                        disabled={isGMBInitialLoading}
                      >
                        {accounts.length === 0 && <option>Loading accounts...</option>}
                        {accounts.map(acc => <option key={acc.name} value={acc.name}>{acc.accountName}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Select Listing</label>
                      <select 
                        value={selectedLocation} 
                        onChange={(e) => setSelectedLocation(e.target.value)} 
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-sm font-black text-slate-900 outline-none focus:ring-2 focus:ring-brand-600 appearance-none cursor-pointer"
                        disabled={isGMBInitialLoading}
                      >
                        {locations.length === 0 && <option>No listings found</option>}
                        {locations.map(loc => <option key={loc.name} value={loc.name}>{loc.title}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(source === 'trustpilot' || source === 'tripadvisor' || source === 'getyourguide') && (
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest ml-1">Platform Public URL</label>
                <input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder={`https://www.${source === 'getyourguide' ? 'getyourguide' : source}.com/...`}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-600 placeholder:text-slate-400"
                  required
                />
              </div>
            )}

            {source === 'manual' && (
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest ml-1">Paste Reviews (one per line)</label>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="The food was amazing..."
                  className="w-full h-32 p-5 bg-slate-50 border border-slate-300 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-600 resize-none"
                />
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={isLoading || (source === 'gmb' && (!isGMBConnected || locations.length === 0))}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-brand-100 transition-all flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="animate-spin h-6 w-6 border-3 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <span className="text-sm uppercase tracking-[0.1em]">Start Intelligence Sync</span>
                <svg className="group-hover:translate-x-1 transition-transform" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ReviewInput;