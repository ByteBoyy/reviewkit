import React, { useState } from 'react';
import { SubscriptionTier } from '../types';
import Logo from './Logo';

interface CheckoutProps {
  tier: SubscriptionTier;
  onSuccess: () => void;
  onCancel: () => void;
}

const Checkout: React.FC<CheckoutProps> = ({ tier, onSuccess, onCancel }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const price = tier === 'basic' ? 29 : tier === 'pro' ? 79 : 249;

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onSuccess();
    }, 2500);
  };

  return (
    <div className="fixed inset-0 bg-white z-[200] flex flex-col md:flex-row animate-in fade-in duration-500 overflow-y-auto">
      {/* Sidebar / Order Summary */}
      <div className="md:w-[450px] bg-slate-50 p-12 flex flex-col justify-center">
        <button onClick={onCancel} className="mb-12 flex items-center gap-2 text-slate-400 hover:text-slate-900 font-bold transition-all text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back to Review Kit
        </button>

        <div className="mb-8">
           <div className="w-16 h-16 bg-white rounded-2xl mb-8 shadow-xl border border-slate-100 p-4 flex items-center justify-center text-brand-600">
              <Logo />
           </div>
           <h3 className="text-slate-500 font-black uppercase text-[10px] tracking-widest mb-1">Subscribe to</h3>
           <h2 className="text-3xl font-black text-slate-900 tracking-tight">Review Kit {tier.charAt(0).toUpperCase() + tier.slice(1)}</h2>
        </div>

        <div className="flex justify-between items-end mb-4 pt-8 border-t border-slate-200">
           <span className="text-4xl font-black text-slate-900">${price}.00</span>
           <span className="text-slate-400 font-bold text-sm uppercase mb-1">Per Month</span>
        </div>
        <p className="text-slate-400 text-xs font-medium">Billed monthly. Cancel anytime.</p>

        <div className="mt-auto pt-12">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Secure Transaction Powered by Stripe
          </div>
        </div>
      </div>

      {/* Main Payment Area */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md animate-in slide-in-from-right-8 duration-700">
          <form onSubmit={handlePay} className="space-y-8">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-8">Pay with card</h2>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                <input type="email" value="alex@example.com" disabled className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 font-medium" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Card information</label>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <input type="text" placeholder="1234 5678 1234 5678" className="w-full px-4 py-3.5 outline-none border-b border-slate-100 text-slate-900 font-medium" />
                  <div className="flex">
                    <input type="text" placeholder="MM / YY" className="w-1/2 px-4 py-3.5 outline-none border-r border-slate-100 text-slate-900 font-medium" />
                    <input type="text" placeholder="CVC" className="w-1/2 px-4 py-3.5 outline-none text-slate-900 font-medium" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cardholder name</label>
                <input type="text" placeholder="Full name on card" className="w-full px-4 py-3.5 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-[#635bff] outline-none" required />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Country or region</label>
                <select className="w-full px-4 py-3.5 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-[#635bff] outline-none">
                  <option>United States</option>
                  <option>United Kingdom</option>
                  <option>Canada</option>
                  <option>Australia</option>
                </select>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isProcessing}
              className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm shadow-xl transition-all bg-[#635bff] text-white hover:bg-[#5b51e8] flex items-center justify-center gap-3 ${isProcessing ? 'opacity-70 cursor-wait' : ''}`}
            >
              {isProcessing ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Processing...
                </>
              ) : (
                `Subscribe - $${price}.00`
              )}
            </button>

            <p className="text-center text-[10px] text-slate-400 font-medium px-4">
              By confirming your subscription, you allow Review Kit to charge you for future payments in accordance with their terms.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Checkout;