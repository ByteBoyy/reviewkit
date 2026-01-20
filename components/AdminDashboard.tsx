
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserAccount, Location, TIER_LIMITS, SubscriptionTier } from '../types';

const ADMIN_PASSWORD = 'admin'; 

const AdminDashboard: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('rp_admin_auth') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [backupStatus, setBackupStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('rp_admin_auth', 'true');
      setLoginError(false);
    } else {
      setLoginError(true);
      setPasswordInput('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('rp_admin_auth');
    window.location.href = '/';
  };

  const allUsers = useMemo(() => {
    if (!isAuthenticated) return [];
    const users: (UserAccount & { createdAt?: string })[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('user_db_')) {
        try {
          const userData = JSON.parse(localStorage.getItem(key) || '{}');
          if (userData.id && userData.email) {
            users.push(userData);
          }
        } catch (e) {
          console.error("Failed to parse user data for admin", key);
        }
      }
    }
    return users.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [isAuthenticated, backupStatus]);

  const stats = useMemo(() => {
    const totalLocations = allUsers.reduce((acc, user) => acc + (user.locations?.length || 0), 0);
    const proUsers = allUsers.filter(u => u.subscription?.tier === 'pro' || u.subscription?.tier === 'enterprise').length;
    return {
      totalUsers: allUsers.length,
      totalLocations,
      proUsers
    };
  }, [allUsers]);

  const filteredUsers = allUsers.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportData = () => {
    const backup: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('user_db_') || key.startsWith('review_pulse_'))) {
        backup[key] = localStorage.getItem(key) || '';
      }
    }
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `review-kit-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setBackupStatus('success');
    setTimeout(() => setBackupStatus('idle'), 3000);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (confirm("This will overwrite existing local data. Continue?")) {
          Object.entries(data).forEach(([key, value]) => {
            localStorage.setItem(key, value as string);
          });
          setBackupStatus('success');
          alert("Restore complete. The page will now reload.");
          window.location.reload();
        }
      } catch (err) {
        setBackupStatus('error');
        alert("Invalid backup file format.");
      }
    };
    reader.readAsText(file);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md animate-in zoom-in-95 duration-500">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Terminal Access</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Authorization Required</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <input 
                autoFocus
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Secure Entry Token"
                className={`w-full bg-slate-900 border-2 ${loginError ? 'border-red-500' : 'border-slate-800'} rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-indigo-600 transition-all text-center tracking-[0.5em] placeholder:tracking-normal placeholder:text-slate-600`}
              />
            </div>
            {loginError && (
              <p className="text-red-500 text-[10px] font-black uppercase text-center tracking-widest animate-pulse">Access Denied: Invalid Credentials</p>
            )}
            <button 
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl uppercase tracking-[0.2em] text-xs transition-all shadow-xl shadow-indigo-600/10 active:scale-[0.98]"
            >
              Authenticate
            </button>
          </form>
          
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full mt-8 text-slate-600 hover:text-slate-400 text-[9px] font-black uppercase tracking-[0.3em] transition-colors"
          >
            Return to Main Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans animate-in fade-in duration-700">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 17V7"/><path d="M15 17V7"/><path d="M9 12h6"/></svg>
              </div>
              <h1 className="text-2xl font-black tracking-tighter text-white uppercase">Admin Command Center</h1>
            </div>
            <p className="text-slate-500 text-sm font-medium">Platform-wide oversight and user intelligence</p>
          </div>
          <div className="flex gap-4">
            <div className="flex bg-slate-900 rounded-xl border border-slate-800 p-1">
               <button 
                 onClick={exportData}
                 className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
               >
                 Export DB
               </button>
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
               >
                 Import DB
               </button>
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 onChange={importData} 
                 className="hidden" 
                 accept=".json"
               />
            </div>
            <button 
              onClick={handleLogout}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-slate-700"
            >
              Terminate Session
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Total Registered Users</p>
            <h3 className="text-4xl font-black text-white">{stats.totalUsers}</h3>
            <p className="text-indigo-400 text-[10px] font-bold mt-2 uppercase">Platform Wide</p>
          </div>
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Managed Locations</p>
            <h3 className="text-4xl font-black text-white">{stats.totalLocations}</h3>
            <p className="text-emerald-400 text-[10px] font-bold mt-2 uppercase">Active Sync Targets</p>
          </div>
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Premium Accounts</p>
            <h3 className="text-4xl font-black text-white">{stats.proUsers}</h3>
            <p className="text-amber-400 text-[10px] font-bold mt-2 uppercase">Pro / Enterprise</p>
          </div>
        </div>

        <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-sm font-black text-white uppercase tracking-widest">User Directory</h2>
            <div className="relative">
              <input 
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-10 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-600 outline-none w-64"
              />
              <svg className="absolute left-3 top-2.5 text-slate-500" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-950 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  <th className="px-8 py-5">Subscriber</th>
                  <th className="px-8 py-5">Plan</th>
                  <th className="px-8 py-5">Portfolio</th>
                  <th className="px-8 py-5">Daily Load</th>
                  <th className="px-8 py-5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredUsers.map(user => {
                  const tier = (user.subscription?.tier || 'free') as SubscriptionTier;
                  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
                  const chats = user.usage?.chatsToday || 0;
                  const imports = user.usage?.importsToday || 0;

                  return (
                    <tr key={user.id} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="text-sm font-black text-white mb-0.5">{user.name}</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{user.email}</div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest border ${
                          user.subscription?.tier === 'pro' ? 'bg-indigo-900/40 text-indigo-300 border-indigo-700' :
                          user.subscription?.tier === 'enterprise' ? 'bg-amber-900/40 text-amber-300 border-amber-700' :
                          'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {user.subscription?.tier || 'Free'}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-white">{user.locations?.length || 0}</span>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Sites</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-tighter">
                            <span className="text-slate-500">Chats</span>
                            <span className={chats >= limits.chats ? 'text-red-400' : 'text-indigo-300'}>{chats}/{limits.chats}</span>
                          </div>
                          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-tighter">
                            <span className="text-slate-500">Imports</span>
                            <span className={imports >= limits.reviews ? 'text-red-400' : 'text-emerald-300'}>{imports}/{limits.reviews}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <details className="inline-block text-left">
                          <summary className="list-none cursor-pointer text-[10px] font-black uppercase text-indigo-400 hover:text-indigo-300 transition-colors tracking-widest outline-none">
                            Expand Map
                          </summary>
                          <div className="absolute right-8 mt-4 bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-3xl z-50 w-96 animate-in zoom-in-95 duration-200">
                             <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Location Portfolio</h4>
                             <div className="space-y-4">
                                {user.locations?.length > 0 ? user.locations.map(loc => (
                                  <div key={loc.id} className="flex justify-between items-center">
                                     <div>
                                        <div className="text-xs font-black text-slate-200">{loc.name}</div>
                                        <div className="text-[9px] text-slate-500 font-bold uppercase">{loc.reviews.length} Feedbacks</div>
                                     </div>
                                     <div className="flex gap-1">
                                        {['gmb', 'trustpilot', 'tripadvisor'].map(p => {
                                          const isLink = (loc.linkedAccounts as any)[p];
                                          return (
                                            <div key={p} className={`w-1.5 h-1.5 rounded-full ${isLink ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`} />
                                          )
                                        })}
                                     </div>
                                  </div>
                                )) : (
                                  <p className="text-[10px] text-slate-500 italic font-bold text-center py-4">No locations created</p>
                                )}
                             </div>
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {filteredUsers.length === 0 && (
            <div className="py-20 text-center bg-slate-900/50">
              <p className="text-slate-600 font-black uppercase tracking-widest text-sm">No matching records found</p>
            </div>
          )}
        </div>
        
        <div className="mt-8 p-6 bg-indigo-900/20 border border-indigo-500/30 rounded-2xl flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
              </div>
              <div>
                 <h4 className="text-xs font-black text-white uppercase tracking-widest">Maintenance Protocol</h4>
                 <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Always export your database before major architectural changes or migrations.</p>
              </div>
           </div>
           {backupStatus === 'success' && (
             <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest animate-pulse">Action Successful</span>
           )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
