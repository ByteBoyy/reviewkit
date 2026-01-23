import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types';
import Logo from './Logo';
import apiClient from '../services/apiClient';

interface AuthProps {
  onLogin: (user: UserAccount) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setError(null);
  }, [isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!email.trim() || !password.trim()) {
      setError("Please fill in all required fields.");
      setIsLoading(false);
      return;
    }

    try {
      if (isLogin) {
        // Login
        const { data: tokenData } = await apiClient.post('/api/auth/login', {
          email: email.toLowerCase().trim(),
          password
        });

        // Store token
        localStorage.setItem('auth_token', tokenData.access_token);

        // Fetch user profile
        const { data: userData } = await apiClient.get('/api/auth/me');
        
        // Fetch user's locations
        const { data: locationsData } = await apiClient.get('/api/locations');
        
        // Combine user data with locations
        const user: UserAccount = {
          ...userData,
          locations: locationsData || []
        };

        onLogin(user);
      } else {
        // Register
        if (password.length < 6) {
          setError("Password must be at least 6 characters long.");
          setIsLoading(false);
          return;
        }

        const { data: tokenData } = await apiClient.post('/api/auth/register', {
          email: email.toLowerCase().trim(),
          password,
          name: name || email.split('@')[0]
        });

        // Store token
        localStorage.setItem('auth_token', tokenData.access_token);

        // Fetch user profile
        const { data: userData } = await apiClient.get('/api/auth/me');
        
        const user: UserAccount = {
          ...userData,
          locations: []
        };

        onLogin(user);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      const errorMessage = err.response?.data?.detail || 
                          (isLogin ? 'Invalid email or password' : 'Registration failed');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-500 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-full -mr-16 -mt-16 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-teal-50 rounded-full -ml-16 -mb-16 blur-3xl"></div>

        <div className="text-center mb-10 relative">
          <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl border border-slate-50 p-5 transition-transform hover:scale-105 duration-300 text-brand-600">
            <Logo />
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
            {isLogin ? 'Welcome Back' : 'Get Started'}
          </h2>
          <p className="text-slate-500 font-medium mt-2 text-sm">
            {isLogin ? 'Secure access to your review intelligence.' : 'Create your pro-level analysis account today.'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-[11px] font-black uppercase tracking-widest rounded-2xl flex items-center gap-2 animate-in slide-in-from-top-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="9" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 relative">
          {!isLogin && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Company / User Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Apex Solutions"
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 font-medium text-slate-900 transition-all placeholder:text-slate-300"
                disabled={isLoading}
              />
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Business Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="growth@company.com"
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 font-medium text-slate-900 transition-all placeholder:text-slate-300"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Secret Password</label>
              {isLogin && (
                <button type="button" className="text-[9px] font-black text-brand-600 uppercase tracking-tight hover:underline">Forgot?</button>
              )}
            </div>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 font-medium text-slate-900 transition-all placeholder:text-slate-300"
                required
                disabled={isLoading}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                disabled={isLoading}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88 3.62 3.62"/><path d="M2 12s3-7 10-7a9.96 9.96 0 0 1 4.5 1.1"/><path d="M20 8s1.5 1.5 2 4c0 0-3 7-10 7a9.6 9.6 0 0 1-4.5-1.1"/><path d="M12 7v5"/><circle cx="12" cy="12" r="3"/><path d="M15.5 15.5 20 20"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-brand-100 transition-all uppercase tracking-[0.15em] text-xs mt-4 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Processing...
              </>
            ) : (
              isLogin ? 'Establish Session' : 'Create Intelligence Profile'
            )}
          </button>
        </form>

        <div className="mt-10 text-center relative border-t border-slate-100 pt-6">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            disabled={isLoading}
            className="text-[11px] font-black text-slate-500 uppercase tracking-widest hover:text-brand-600 transition-colors disabled:opacity-50"
          >
            {isLogin ? (
              <>New to the platform? <span className="text-brand-600">Register Account</span></>
            ) : (
              <>Already have access? <span className="text-brand-600">Sign In</span></>
            )}
          </button>
        </div>
      </div>
      
      <div className="mt-12 flex flex-col items-center gap-6">
        <div className="flex items-center gap-3 opacity-40 grayscale hover:grayscale-0 transition-all cursor-default">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">End-to-End Encrypted Dashboard</span>
        </div>
      </div>
    </div>
  );
};

export default Auth;