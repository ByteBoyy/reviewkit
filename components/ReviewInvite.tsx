import React, { useState, useEffect, useMemo } from 'react';
import { Location } from '../types';
import Logo from './Logo';

const PLATFORM_META = {
  gmb: {
    name: 'Google Business',
    color: 'bg-brand-600',
    icon: 'G',
    instruction: 'Find your "Review Link" in your Google Business Profile manager.',
    placeholder: 'https://search.google.com/local/writereview?placeid=...'
  },
  trustpilot: {
    name: 'Trustpilot',
    color: 'bg-[#00b67a]',
    icon: 'T',
    instruction: 'Use your Trustpilot Business dashboard to find your unique invitation link.',
    placeholder: 'https://www.trustpilot.com/evaluate/yourbusiness.com'
  },
  tripadvisor: {
    name: 'TripAdvisor',
    color: 'bg-[#34e0a1]',
    icon: 'A',
    instruction: 'Link to your business listing "Write a Review" section.',
    placeholder: 'https://www.tripadvisor.com/UserReview-...'
  },
  getyourguide: {
    name: 'GetYourGuide',
    color: 'bg-[#ff5533]',
    icon: 'G',
    instruction: 'Link directly to your product review page.',
    placeholder: 'https://www.getyourguide.com/review/...'
  },
  manual: {
    name: 'Direct Feedback',
    color: 'bg-slate-800',
    icon: 'M',
    instruction: 'Link to your own website feedback form.',
    placeholder: 'https://yourwebsite.com/feedback'
  }
};

interface ReviewInviteProps {
  location: Location;
}

const ReviewInvite: React.FC<ReviewInviteProps> = ({ location }) => {
  const [urls, setUrls] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(`review_pulse_urls_${location.id}`);
    return saved ? JSON.parse(saved) : {};
  });
  
  const [editingSource, setEditingSource] = useState<string | null>(null);
  const [tempUrl, setTempUrl] = useState('');
  const [copyStates, setCopyStates] = useState<Record<string, boolean>>({});
  const [isMainLinkCopied, setIsMainLinkCopied] = useState(false);
  
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem(`review_pulse_counts_${location.id}`);
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem(`review_pulse_urls_${location.id}`, JSON.stringify(urls));
  }, [urls, location.id]);

  useEffect(() => {
    localStorage.setItem(`review_pulse_counts_${location.id}`, JSON.stringify(counts));
  }, [counts, location.id]);

  const publicPortalUrl = `${window.location.origin}${window.location.pathname}?portal=${location.id}`;

  const handleCopyMainLink = () => {
    navigator.clipboard.writeText(publicPortalUrl);
    setIsMainLinkCopied(true);
    setTimeout(() => setIsMainLinkCopied(false), 2000);
  };

  const handleCopyPlatform = (source: string) => {
    const text = urls[source];
    if (!text) {
      alert("Please configure a destination URL first by clicking 'Edit'.");
      return;
    }
    
    navigator.clipboard.writeText(text);
    setCopyStates(prev => ({ ...prev, [source]: true }));
    setTimeout(() => setCopyStates(prev => ({ ...prev, [source]: false })), 2000);
  };

  const startEdit = (source: string) => {
    setTempUrl(urls[source] || '');
    setEditingSource(source);
  };

  const saveUrl = () => {
    if (editingSource) {
      setUrls(prev => ({ ...prev, [editingSource]: tempUrl }));
      setEditingSource(null);
    }
  };

  const connectedPlatforms = useMemo(() => {
    const active: string[] = [];
    if (location.linkedAccounts?.gmb) active.push('gmb');
    if (location.linkedAccounts?.trustpilot) active.push('trustpilot');
    if (location.linkedAccounts?.tripadvisor) active.push('tripadvisor');
    if (location.linkedAccounts?.getyourguide) active.push('getyourguide');
    if (active.length === 0) active.push('manual');
    return active;
  }, [location.linkedAccounts]);

  const totalEngagement = Object.values(counts).reduce((a: number, b: number) => a + b, 0);

  return (
    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200">
      <div className="p-8 border-b border-slate-100 bg-brand-50/30 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-slate-100 p-3 shadow-md text-brand-600">
            <Logo />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-[0.15em]">Growth Campaigns</h4>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Automated customer invitations</p>
          </div>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-brand-600 leading-none">{totalEngagement}</p>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Portal Clicks</p>
        </div>
      </div>

      <div className="p-8 space-y-8 bg-white max-h-[75vh] overflow-y-auto">
        {/* Main Smart Link Section */}
        <section className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center p-2 text-brand-600">
              <Logo />
            </div>
            <h5 className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-400">Smart Invitation Link</h5>
          </div>
          <p className="text-xs text-slate-300 font-medium mb-6 leading-relaxed">
            This is your **master destination**. Send this to customers and we'll show them a beautiful page with all your review options.
          </p>
          <div className="flex gap-2">
            <div className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 truncate text-[10px] font-bold text-slate-400 flex items-center">
              {publicPortalUrl}
            </div>
            <button 
              onClick={handleCopyMainLink}
              className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${isMainLinkCopied ? 'bg-green-600 text-white' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
            >
              {isMainLinkCopied ? 'Copied!' : 'Copy Portal Link'}
            </button>
          </div>
        </section>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
          <div className="relative flex justify-center text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 bg-white px-4">Individual Platform Routing</div>
        </div>

        <div className="space-y-4">
          {connectedPlatforms.map(source => {
            const meta = PLATFORM_META[source as keyof typeof PLATFORM_META];
            const isCopied = copyStates[source];
            const isEditing = editingSource === source;
            const currentUrl = urls[source];

            return (
              <div key={source} className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:border-brand-200">
                <div className="flex justify-between items-center mb-5">
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-xl ${meta.color} flex items-center justify-center text-white font-black text-sm shadow-sm`}>{meta.icon}</span>
                    <div>
                      <span className="text-xs font-black text-slate-800 uppercase tracking-widest">{meta.name}</span>
                      {currentUrl ? (
                        <span className="flex items-center gap-1 text-[9px] font-black text-green-600 uppercase tracking-widest mt-0.5">
                          <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></span>
                          Destination Active
                        </span>
                      ) : (
                        <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-0.5">Destination Missing</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {!isEditing && (
                      <button 
                        onClick={() => startEdit(source)}
                        className="p-2 text-slate-400 hover:text-brand-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-100"
                        title="Edit Destination URL"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                      </button>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{meta.instruction}</label>
                      <input 
                        autoFocus
                        type="url"
                        value={tempUrl}
                        onChange={(e) => setTempUrl(e.target.value)}
                        placeholder={meta.placeholder}
                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-600"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setEditingSource(null)}
                        className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={saveUrl}
                        className="flex-1 py-2.5 bg-brand-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-700 shadow-lg shadow-brand-100 transition-all"
                      >
                        Save Destination
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-white/50 border border-slate-100 rounded-xl p-3 truncate text-[10px] font-bold text-slate-400 italic">
                      {currentUrl || "No URL set. Click edit to configure."}
                    </div>
                    <button
                      onClick={() => handleCopyPlatform(source)}
                      disabled={!currentUrl}
                      className={`w-full py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] ${
                        !currentUrl 
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' 
                          : isCopied 
                            ? 'bg-green-600 text-white shadow-green-100' 
                            : 'bg-white text-slate-800 border border-slate-300 hover:border-brand-600 hover:text-brand-600'
                      }`}
                    >
                      {isCopied ? 'URL Copied!' : 'Copy Direct Destination'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="p-6 bg-slate-900 text-white">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-brand-400 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M9 10h.01"/><path d="M15 10h.01"/></svg>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-400 mb-1">Campaign Tip</p>
            <p className="text-[11px] font-medium leading-relaxed text-slate-300">
              Sharing the **Smart Invitation Link** allows us to track real customer engagement and gives them the choice of where to review you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewInvite;