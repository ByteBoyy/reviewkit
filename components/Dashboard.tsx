
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { AnalysisResult, Review, DateFilterRange, SubscriptionTier, Location, Theme, ReviewSource, UserUsage, TIER_LIMITS } from '../types';
import ReviewChat from './ReviewChat';
import ReviewInvite from './ReviewInvite';
import ReviewInput from './ReviewInput';
import Logo from './Logo';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ComposedChart, Line, Cell
} from 'recharts';

interface DashboardProps {
  location: Location;
  userUsage?: UserUsage;
  subscriptionTier?: SubscriptionTier;
  onUpdateWorkflow?: (reviewId: string, workflow: { tags?: string[], assignedTo?: string }) => void;
  onUpgrade: () => void;
  onRetry: () => void;
  onSyncNewSource: (data: any) => void;
  onDisconnectSource: (source: ReviewSource) => void;
  onChatTrigger?: () => void;
}

type TabType = 'intelligence' | 'semantic' | 'feed' | 'performance' | 'connectivity';
type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest';

const ReviewWorkflow: React.FC<{
  review: Review;
  allUsedTags: string[];
  onUpdate: (workflow: { tags?: string[], assignedTo?: string }) => void;
}> = ({ review, allUsedTags, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (!tagInput.trim()) return [];
    return allUsedTags.filter(t => 
      t.toLowerCase().includes(tagInput.toLowerCase()) && 
      !review.tags?.includes(t)
    ).slice(0, 5);
  }, [tagInput, allUsedTags, review.tags]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addTag = (tag: string) => {
    const cleanTag = tag.trim();
    if (cleanTag && !review.tags?.includes(cleanTag)) {
      onUpdate({ tags: [...(review.tags || []), cleanTag] });
    }
    setTagInput('');
    setShowSuggestions(false);
  };

  const removeTag = (tag: string) => {
    onUpdate({ tags: (review.tags || []).filter(t => t !== tag) });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {review.tags?.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 border border-brand-200 text-[10px] font-black uppercase tracking-wider group transition-all">
            {tag}
            <button onClick={() => removeTag(tag)} className="hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </span>
        ))}
        {isEditing ? (
          <div className="relative" ref={dropdownRef}>
            <input 
              autoFocus
              type="text"
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTag(tagInput);
                if (e.key === 'Escape') setIsEditing(false);
              }}
              onBlur={() => !showSuggestions && setIsEditing(false)}
              className="px-2 py-0.5 rounded-md border border-brand-300 text-[10px] font-black uppercase tracking-wider outline-none w-24 bg-white shadow-sm"
              placeholder="NEW TAG..."
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 z-50 w-32 bg-white border border-slate-200 rounded-lg shadow-xl mt-1 overflow-hidden">
                {suggestions.map(s => (
                  <button 
                    key={s} 
                    onClick={() => addTag(s)}
                    className="w-full text-left px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button 
            onClick={() => setIsEditing(true)}
            className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 border border-slate-200 text-[10px] font-black hover:bg-white hover:text-brand-600 hover:border-brand-300 transition-all"
          >
            + ADD TAG
          </button>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">ASSIGNED:</span>
        <input 
          type="text"
          value={review.assignedTo || ''}
          onChange={(e) => onUpdate({ assignedTo: e.target.value })}
          placeholder="UNASSIGNED"
          className="bg-transparent border-b border-transparent hover:border-slate-200 focus:border-brand-500 focus:outline-none text-[10px] font-black text-slate-700 uppercase tracking-widest w-full py-0.5 transition-all placeholder:text-slate-300"
        />
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ 
  location, 
  userUsage,
  subscriptionTier = 'free', 
  onUpdateWorkflow, 
  onUpgrade, 
  onRetry, 
  onSyncNewSource,
  onDisconnectSource,
  onChatTrigger
}) => {
  const { lastAnalysis: result, reviews, isSyncing, syncStage } = location;
  const [activeTab, setActiveTab] = useState<TabType>('intelligence');
  const [dateFilter, setDateFilter] = useState<DateFilterRange>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [lockedSource, setLockedSource] = useState<ReviewSource | undefined>(undefined);
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());

  const currentChatUsage = userUsage?.chatsToday || 0;
  const chatLimit = TIER_LIMITS[subscriptionTier].chats;

  const toggleExpand = (id: string) => {
    setExpandedReviews(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allUsedTags = useMemo(() => {
    const tags = new Set<string>();
    reviews.forEach(r => r.tags?.forEach(t => tags.add(t)));
    return Array.from(tags);
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    if (dateFilter === 'all') return reviews;
    const now = new Date();
    const days = dateFilter === '7d' ? 7 : 30;
    const threshold = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return reviews.filter(r => new Date(r.date) >= threshold);
  }, [reviews, dateFilter]);

  const sortedReviews = useMemo(() => {
    const sorted = [...filteredReviews];
    switch (sortOption) {
      case 'newest':
        return sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      case 'highest':
        return sorted.sort((a, b) => {
          if (b.rating !== a.rating) return b.rating - a.rating;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
      case 'lowest':
        return sorted.sort((a, b) => {
          if (a.rating !== b.rating) return a.rating - b.rating;
          return new Date(a.date).getTime() - new Date(a.date).getTime();
        });
      default:
        return sorted;
    }
  }, [filteredReviews, sortOption]);

  const workflowStats = useMemo(() => {
    const tagData: Record<string, { count: number; sum: number }> = {};
    const teamData: Record<string, { count: number; sum: number }> = {};

    filteredReviews.forEach(r => {
      r.tags?.forEach(tag => {
        if (!tagData[tag]) tagData[tag] = { count: 0, sum: 0 };
        tagData[tag].count++;
        tagData[tag].sum += r.rating;
      });
      const member = r.assignedTo?.trim() || 'Unassigned';
      if (!teamData[member]) teamData[member] = { count: 0, sum: 0 };
      teamData[member].count++;
      teamData[member].sum += r.rating;
    });

    return {
      tags: Object.entries(tagData).map(([name, d]) => ({ 
        name, 
        count: d.count, 
        avg: (d.sum / d.count).toFixed(1) 
      })).sort((a, b) => b.count - a.count),
      team: Object.entries(teamData).map(([name, d]) => ({ 
        name, 
        count: d.count, 
        avg: (d.sum / d.count).toFixed(1) 
      })).sort((a, b) => b.count - a.count)
    };
  }, [filteredReviews]);

  const avgStarRating = useMemo(() => {
    if (filteredReviews.length === 0) return 0;
    const sum = filteredReviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / filteredReviews.length).toFixed(1);
  }, [filteredReviews]);

  const trendData = useMemo(() => {
    if (filteredReviews.length === 0) return [];
    const formatKey = (date: Date) => {
      if (dateFilter === 'all') return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      return date.toISOString().split('T')[0];
    };
    const grouped: Record<string, { count: number; sum: number }> = {};
    const sorted = [...filteredReviews].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    sorted.forEach(r => {
      const d = new Date(r.date);
      const key = formatKey(d);
      if (!grouped[key]) grouped[key] = { count: 0, sum: 0 };
      grouped[key].count++;
      grouped[key].sum += r.rating;
    });
    return Object.entries(grouped).map(([date, data]) => ({
      date,
      count: data.count,
      avg: Number((data.sum / data.count).toFixed(2)),
    }));
  }, [filteredReviews, dateFilter]);

  const themeData = useMemo(() => {
    if (!result?.themes) return [];
    return [...result.themes].sort((a, b) => b.frequency - a.frequency);
  }, [result]);

  const getSourceBadge = (source: string) => {
    const base = "text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm flex items-center gap-1.5 whitespace-nowrap";
    switch (source) {
      case 'gmb': return <span className={`${base} bg-brand-600 text-white`}><span className="w-1.5 h-1.5 bg-white rounded-full"></span>Google</span>;
      case 'trustpilot': return <span className={`${base} bg-[#00b67a] text-white`}><span className="w-1.5 h-1.5 bg-white rounded-full"></span>Trustpilot</span>;
      case 'tripadvisor': return <span className={`${base} bg-[#34e0a1] text-white`}><span className="w-1.5 h-1.5 bg-white rounded-full"></span>TripAdvisor</span>;
      case 'getyourguide': return <span className={`${base} bg-[#ff5533] text-white`}><span className="w-1.5 h-1.5 bg-white rounded-full"></span>GYG</span>;
      default: return <span className={`${base} bg-slate-800 text-white`}><span className="w-1.5 h-1.5 bg-white rounded-full"></span>Direct</span>;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'positive': return 'text-green-700 bg-green-50 border-green-200';
      case 'negative': return 'text-red-700 bg-red-50 border-red-200';
      default: return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  };

  const safeSentimentScore = useMemo(() => {
    if (!result) return 0;
    let score = result.sentiment.score;
    if (score <= 5 && score > 0) return Math.round(score * 20); 
    return Math.round(score);
  }, [result]);

  const openConnectionModal = (source?: ReviewSource) => {
    setLockedSource(source);
    setShowConnectModal(true);
  };

  const formatLastSync = (dateString?: string) => {
    if (!dateString || dateString === 'Never') return 'Never Sync’d';
    try {
      const d = new Date(dateString);
      return `${d.toLocaleDateString()} @ ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return dateString;
    }
  };

  if (isSyncing && reviews.length === 0) {
    const isScraping = syncStage === 'scraping';
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="bg-white p-16 rounded-[2.5rem] border border-slate-200 shadow-2xl text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-slate-100">
            <div className="h-full bg-brand-600 animate-[sync_2.5s_infinite_linear]" style={{ width: isScraping ? '40%' : '85%' }}></div>
          </div>
          <div className="flex flex-col items-center">
             <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center border border-slate-100 p-6 mb-10 shadow-xl text-brand-600">
                <Logo className="animate-pulse" />
             </div>
             <h3 className="text-4xl font-black text-slate-900 tracking-tight mb-4">Establishing Data Link</h3>
             <p className="text-slate-500 font-medium mb-10 max-w-md mx-auto">Connecting to your review sources. Your dashboard will unlock as soon as the first review is detected.</p>
          </div>
          <div className="max-w-md mx-auto space-y-4">
             <div className="h-14 bg-slate-50 rounded-2xl border border-slate-300 flex items-center px-6 justify-between overflow-hidden relative">
                <span className="text-xs font-black text-slate-800 uppercase tracking-widest relative z-10">Initial Discovery</span>
                <span className="text-xs font-black text-brand-600 uppercase tracking-widest flex items-center gap-2 relative z-10">Searching...</span>
                <div className="absolute inset-0 bg-brand-50/50 animate-pulse"></div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-12 relative">
      {isSyncing && reviews.length > 0 && (
        <div className="mb-6 p-4 bg-brand-50 border border-brand-200 rounded-2xl flex items-center justify-between shadow-sm animate-in slide-in-from-top-2">
           <div className="flex items-center gap-4">
              <div className="w-3 h-3 bg-brand-600 rounded-full animate-ping"></div>
              <div>
                <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                  Background Intelligence Sync Active
                </p>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                  {syncStage === 'scraping' ? `Harvesting ${reviews.length} feedback records...` : 'Synthesizing report...'}
                </p>
              </div>
           </div>
           <div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-brand-600 animate-[sync_3s_infinite_linear]" style={{ width: '40%' }}></div>
           </div>
        </div>
      )}

      {showInviteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg animate-in zoom-in-95"><button onClick={() => setShowInviteModal(false)} className="absolute -top-12 right-0 text-white hover:text-slate-300 transition-colors text-xs font-black uppercase tracking-widest">Close</button><ReviewInvite location={location} /></div>
        </div>
      )}

      {showConnectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl animate-in zoom-in-95">
             <div className="bg-white rounded-3xl p-1 mb-4 flex justify-between items-center px-6 py-3 border border-slate-200">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">{lockedSource ? `Connect ${lockedSource}` : 'Add Source'}</h4>
                <button onClick={() => setShowConnectModal(false)} className="text-slate-600 focus:outline-none"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
             </div>
             <ReviewInput onAnalyze={(d) => { onSyncNewSource(d); setShowConnectModal(false); }} isLoading={false} existingLinks={location.linkedAccounts} lockedSource={lockedSource} />
          </div>
        </div>
      )}

      <div className="flex justify-between items-center border-b border-slate-200 mb-2 overflow-x-auto pt-2">
         <div className="flex gap-8 whitespace-nowrap">
            {[
              { id: 'intelligence', label: 'Intelligence' }, 
              { id: 'semantic', label: 'Semantic analysis' }, 
              { id: 'feed', label: 'Review Feed' }, 
              { id: 'performance', label: 'Performance' }, 
              { id: 'connectivity', label: 'Connectivity' }
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} className={`pb-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all border-b-2 focus:outline-none ${activeTab === tab.id ? 'text-brand-600 border-brand-600' : 'text-slate-800 border-transparent hover:text-brand-600 hover:border-slate-300'}`}>{tab.label}</button>
            ))}
         </div>
         <div className="pb-4 flex items-center gap-4 shrink-0">
            <div className="flex bg-slate-100 p-1 rounded-lg">
                {(['all', '7d', '30d'] as const).map((f) => (
                <button key={f} onClick={() => setDateFilter(f)} className={`px-4 py-1.5 text-[10px] uppercase font-black rounded-md transition-all focus:outline-none ${dateFilter === f ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{f === 'all' ? 'All' : f.toUpperCase()}</button>
                ))}
            </div>
         </div>
      </div>

      {activeTab === 'intelligence' && (
        <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Sentiment Score</p><div className="flex items-baseline gap-2"><h3 className="text-4xl font-black text-slate-800">{safeSentimentScore}%</h3></div><div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-brand-600 rounded-full" style={{ width: `${safeSentimentScore}%` }} /></div></div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Avg Rating</p><div className="flex items-center gap-2"><h3 className="text-4xl font-black text-slate-800">{avgStarRating}</h3><div className="text-amber-400 text-lg mb-1">★</div></div><p className="text-slate-800 text-[10px] mt-2 font-bold uppercase tracking-tight">Across {filteredReviews.length} Records</p></div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between"><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Engage Customers</p><button onClick={() => setShowInviteModal(true)} className="w-full bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-black py-3 rounded-lg uppercase tracking-widest shadow-md transition-all">Launch Campaign</button></div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Trend Analysis</p><div className={`font-black text-xl ${trendData[trendData.length-1]?.avg >= (trendData[0]?.avg || 0) ? 'text-brand-600' : 'text-red-600'}`}>{trendData[trendData.length-1]?.avg >= (trendData[0]?.avg || 0) ? 'STABLE' : 'DOWNWARD'}</div></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-[400px] flex flex-col"><h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Rating Trend</h4><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={trendData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} /><YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} /><YAxis yAxisId="right" orientation="right" domain={[0, 5]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} /><Tooltip /><Bar yAxisId="left" dataKey="count" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={30} /><Line yAxisId="right" type="monotone" dataKey="avg" stroke="#008060" strokeWidth={4} dot={false} /></ComposedChart></ResponsiveContainer></div></div>
                    {result && <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Executive Brief</h4><p className="text-slate-800 leading-relaxed font-semibold text-sm italic border-l-4 border-brand-500 pl-4">"{result.overview}"</p></div>}
                    {!result && isSyncing && <div className="bg-slate-50 p-12 rounded-xl border border-dashed border-slate-200 text-center"><p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] animate-pulse">Analysis Engine Initializing...</p></div>}
                </div>
                <div className="lg:col-span-4 h-[600px] relative group"><ReviewChat reviews={reviews} usage={{ current: currentChatUsage, limit: chatLimit }} onChatSent={onChatTrigger} onUpgrade={onUpgrade} /></div>
            </div>
        </div>
      )}

      {activeTab === 'semantic' && (
        <div className="space-y-6 animate-in fade-in">
          {!result && isSyncing ? (
            <div className="bg-white p-20 rounded-3xl border border-slate-200 text-center shadow-xl">
               <div className="w-20 h-20 mx-auto mb-8 bg-brand-50 rounded-full flex items-center justify-center p-5 text-brand-600"><Logo className="animate-spin duration-3000" /></div>
               <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Building Theme Matrix</h3>
               <p className="text-slate-500 font-medium">Gemini is currently processing review syntax to extract key business themes.</p>
            </div>
          ) : result ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl">
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-8 text-center">Core Themes</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {themeData.map((theme, i) => (
                                <div key={i} className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 hover:border-brand-300 transition-all group">
                                    <div className="flex justify-between items-start mb-4"><h5 className="font-black text-slate-900 text-lg">{theme.name}</h5><span className={`text-[9px] font-black px-2.5 py-1 rounded-md border uppercase tracking-widest ${getSentimentColor(theme.sentiment)}`}>{theme.sentiment}</span></div>
                                    <p className="text-sm text-slate-800 font-medium leading-relaxed mb-6">{theme.description}</p>
                                    <div className="space-y-2"><div className="flex justify-between items-center text-[10px] font-black text-slate-700 uppercase"><span>Frequency</span><span>{Math.round(theme.frequency * 100)}%</span></div><div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-brand-600 rounded-full" style={{ width: `${theme.frequency * 100}%` }} /></div></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl flex flex-col items-center justify-center"><h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Distribution</h4><ResponsiveContainer width="100%" height={300}><BarChart data={themeData} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" hide /><YAxis dataKey="name" type="category" width={80} tick={{fontSize: 10, fontWeight: 700}} /><Tooltip /><Bar dataKey="frequency" fill="#008060" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>
            </div>
          ) : (
             <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center"><p className="text-slate-400 font-black uppercase">Sync a source to view semantic analysis</p></div>
          )}
        </div>
      )}
      
      {activeTab === 'feed' && (
        <div className="animate-in fade-in">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Feedback Stream</h4>
                        <select value={sortOption} onChange={(e) => setSortOption(e.target.value as SortOption)} className="text-[10px] font-black uppercase tracking-widest text-brand-600 bg-white border border-slate-200 rounded px-3 py-1.5 outline-none">
                            <option value="newest">Newest</option>
                            <option value="highest">Highest</option>
                            <option value="lowest">Lowest</option>
                        </select>
                    </div>
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">{filteredReviews.length} Records</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white text-slate-700 text-[10px] font-black uppercase tracking-widest border-b border-slate-200">
                                <th className="px-6 py-5">Source</th>
                                <th className="px-6 py-5">Reviewer</th>
                                <th className="px-6 py-5">Rating</th>
                                <th className="px-6 py-5">Comment</th>
                                <th className="px-6 py-5">Workflow</th>
                                <th className="px-6 py-5 text-right">Link</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedReviews.map((r) => { 
                                const isExpanded = expandedReviews.has(r.id); 
                                return (
                                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-6 align-top">{getSourceBadge(r.source)}</td>
                                        <td className="px-6 py-6 align-top">
                                            <div className="text-[13px] font-black text-slate-800">{r.author}</div>
                                            <div className="text-[10px] text-slate-400 font-bold mt-1">{new Date(r.date).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-6 py-6 align-top">
                                            <div className="flex text-amber-400 gap-0.5">{[...Array(5)].map((_, i) => <span key={i} className="text-[11px]">{i < r.rating ? '★' : '☆'}</span>)}</div>
                                        </td>
                                        <td className="px-6 py-6 align-top min-w-[200px]">
                                            <p className={`text-[13px] text-slate-800 leading-relaxed font-medium ${!isExpanded && r.text.length > 150 ? 'line-clamp-3' : ''}`}>{r.text}</p>
                                            {r.text.length > 150 && (<button onClick={() => toggleExpand(r.id)} className="mt-2 text-[11px] font-black text-brand-600 uppercase tracking-widest">{isExpanded ? 'Collapse ↑' : 'Read More ↓'}</button>)}
                                        </td>
                                        <td className="px-6 py-6 align-top min-w-[180px]">
                                            <ReviewWorkflow 
                                                review={r} 
                                                allUsedTags={allUsedTags} 
                                                onUpdate={(wf) => onUpdateWorkflow?.(r.id, wf)} 
                                            />
                                        </td>
                                        <td className="px-6 py-6 align-top text-right">
                                            {r.url ? <a href={r.url} target="_blank" className="text-brand-600 font-black text-[10px] uppercase hover:underline">View</a> : <span className="text-[9px] text-slate-300 uppercase">Offline</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="space-y-8 animate-in fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8">
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-8">Tag Performance</h4>
                    {workflowStats.tags.length === 0 ? (
                        <p className="text-slate-400 text-center py-12 text-xs font-bold">No tags configured</p>
                    ) : (
                        <div className="space-y-6">
                            {workflowStats.tags.map(tag => (
                                <div key={tag.name} className="flex items-center justify-between">
                                    <span className="text-xs font-black text-slate-800 uppercase bg-slate-100 px-3 py-1.5 rounded-lg">{tag.name}</span>
                                    <div className="flex items-center gap-8">
                                        <div className="text-center">
                                            <p className="text-lg font-black">{tag.count}</p>
                                            <p className="text-[9px] font-black text-slate-400 uppercase">Vol</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-black text-brand-600">{tag.avg}★</p>
                                            <p className="text-[9px] font-black text-slate-400 uppercase">Score</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8">
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-8">Team Assignments</h4>
                    {workflowStats.team.length === 0 ? (
                        <p className="text-slate-400 text-center py-12 text-xs font-bold">No assignments yet</p>
                    ) : (
                        <div className="space-y-6">
                            {workflowStats.team.map(m => (
                                <div key={m.name} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center font-black text-white">{m.name[0]}</div>
                                        <h5 className="text-xs font-black text-slate-800 uppercase">{m.name}</h5>
                                    </div>
                                    <div className="flex gap-8">
                                        <div className="text-center">
                                            <p className="text-lg font-black">{m.count}</p>
                                            <p className="text-[9px] uppercase font-black text-slate-400">Cases</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-black text-brand-600">{m.avg}★</p>
                                            <p className="text-[9px] uppercase font-black text-slate-400">Avg</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {activeTab === 'connectivity' && (
        <div className="animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-10">
            <div className="flex justify-between items-center mb-12">
              <div>
                <h4 className="text-2xl font-black text-slate-900 tracking-tight">Connectivity Hub</h4>
                <p className="text-sm text-slate-700 font-medium">Manage your active source streams.</p>
              </div>
              <button onClick={() => openConnectionModal(undefined)} className="bg-brand-600 text-white font-black px-8 py-4 rounded-xl text-xs uppercase tracking-widest shadow-xl shadow-brand-100 hover:bg-brand-700 transition-all focus:outline-none">Add Source</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {(['gmb', 'trustpilot', 'tripadvisor', 'getyourguide'] as const).map(source => { 
                const sourceData = (location.linkedAccounts as any)[source];
                const isConnected = !!sourceData; 
                const lastSync = sourceData?.lastSync;
                const importCount = sourceData?.importCount || reviews.filter(r => r.source === source).length;
                
                return (
                  <div key={source} className="p-8 rounded-3xl bg-slate-50 border border-slate-200 flex flex-col justify-between shadow-sm hover:border-brand-300 transition-all">
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <div className={`w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 font-black text-xl text-brand-600`}>{source[0].toUpperCase()}</div>
                        <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border ${isConnected ? 'bg-brand-100 text-brand-800 border-brand-500' : 'bg-slate-200 text-slate-800 border-slate-400'}`}>
                          {isConnected ? 'Active' : 'Missing'}
                        </span>
                      </div>
                      <h5 className="font-black text-slate-900 uppercase tracking-tight text-base mb-4">{source.toUpperCase()}</h5>
                      
                      {isConnected && (
                        <div className="space-y-4 mb-6">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Imported</span>
                            <span className="text-sm font-black text-slate-900">{importCount} Feedback Records</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Source Specific Sync</span>
                            <span className="text-[11px] font-bold text-slate-600">{formatLastSync(lastSync)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-auto flex flex-col gap-2">
                      <button onClick={() => openConnectionModal(source)} className="w-full bg-white border border-slate-400 py-3 rounded-xl text-[11px] font-black uppercase text-slate-800 hover:bg-brand-600 hover:text-white transition-all shadow-sm">Manage</button>
                      {isConnected && (
                        <button onClick={() => onDisconnectSource(source)} className="w-full py-2.5 rounded-xl text-[9px] font-black uppercase text-red-600 hover:bg-red-50 transition-all tracking-widest">Disconnect</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Dashboard;
