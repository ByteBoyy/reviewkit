
import React from 'react';
import { SubscriptionTier } from '../types';

interface PricingProps {
  onSelectPlan: (tier: SubscriptionTier) => void;
}

const Pricing: React.FC<PricingProps> = ({ onSelectPlan }) => {
  const plans = [
    {
      tier: 'basic' as SubscriptionTier,
      name: 'Starter',
      price: '29',
      features: ['Up to 3 Locations', 'Sentiment Analysis', 'Basic Reporting', 'Email Support'],
      cta: 'Get Started',
      highlight: false
    },
    {
      tier: 'pro' as SubscriptionTier,
      name: 'Professional',
      price: '79',
      features: ['Up to 10 Locations', 'AI Review Assistant', 'Custom Tagging', 'Growth Campaigns', 'Priority Support'],
      cta: 'Try Pro',
      highlight: true
    },
    {
      tier: 'enterprise' as SubscriptionTier,
      name: 'Enterprise',
      price: '249',
      features: ['Unlimited Locations', 'White-label Reports', 'API Access', 'Dedicated Account Manager'],
      cta: 'Contact Sales',
      highlight: false
    }
  ];

  return (
    <div className="py-12 px-4 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">Choose Your Growth Strategy</h2>
        <p className="text-slate-500 font-medium text-lg">Scale your review intelligence with a plan that fits your business.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <div 
            key={plan.tier}
            className={`relative bg-white rounded-3xl p-8 border-2 transition-all hover:scale-[1.02] ${
              plan.highlight 
                ? 'border-blue-600 shadow-2xl shadow-blue-100 scale-105 z-10' 
                : 'border-slate-100 shadow-xl'
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full shadow-lg">
                Most Popular
              </span>
            )}
            
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mb-8">
              <span className="text-4xl font-black text-slate-900">${plan.price}</span>
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">/ Month</span>
            </div>

            <ul className="space-y-4 mb-10">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-600">
                  <svg className="text-blue-600" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {feature}
                </li>
              ))}
            </ul>

            <button 
              onClick={() => onSelectPlan(plan.tier)}
              className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all ${
                plan.highlight 
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200' 
                  : 'bg-slate-900 text-white hover:bg-black'
              }`}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>
      
      <p className="text-center mt-12 text-slate-400 text-xs font-medium">
        All plans include a 14-day money-back guarantee. No hidden fees.
      </p>
    </div>
  );
};

export default Pricing;
