import React, { useState, useEffect } from 'react';
import Logo from './Logo';

const PLATFORM_META = {
  gmb: {
    name: 'Google',
    color: 'bg-brand-600',
    icon: 'G',
    label: 'Review us on Google'
  },
  trustpilot: {
    name: 'Trustpilot',
    color: 'bg-[#00b67a]',
    icon: 'T',
    label: 'Review us on Trustpilot'
  },
  tripadvisor: {
    name: 'TripAdvisor',
    color: 'bg-[#34e0a1]',
    icon: 'A',
    label: 'Review us on TripAdvisor'
  },
  getyourguide: {
    name: 'GetYourGuide',
    color: 'bg-[#ff5533]',
    icon: 'G',
    label: 'Review us on GYG'
  },
  manual: {
    name: 'Direct Feedback',
    color: 'bg-slate-800',
    icon: 'M',
    label: 'Send us Feedback'
  }
};

interface CustomerPortalProps {
  locationId: string;
}

const CustomerPortal: React.FC<CustomerPortalProps> = ({ locationId }) => {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [locationName, setLocationName] = useState('Our Business');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Attempt to load settings from local storage
    const savedUrls = localStorage.getItem(`review_pulse_urls_${locationId}`);
    const userDb = localStorage.getItem('review_pulse_active_user');
    
    if (savedUrls) {
      setUrls(JSON.parse(savedUrls));
    }

    if (userDb) {
      const userData = JSON.parse(userDb);
      const loc = userData.locations?.find((l: any) => l.id === locationId);
      if (loc) {
        setLocationName(loc.name);
      }
    }
    
    setIsLoading(false);
  }, [locationId]);

  const handlePlatformClick = (source: string) => {
    // Track the click
    const currentCounts = JSON.parse(localStorage.getItem(`review_pulse_counts_${locationId}`) || '{}');
    currentCounts[source] = (currentCounts[source] || 0) + 1;
    localStorage.setItem(`review_pulse_counts_${locationId}`, JSON.stringify(currentCounts));

    // Redirect to destination
    const dest = urls[source];
    if (dest) {
      window.location.href = dest;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-brand-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const activePlatforms = Object.keys(urls).filter(k => !!urls[k]);

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-500">
        <div className="p-12 text-center">
          <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-xl border border-slate-50 p-6 transition-all duration-500 hover:rotate-6 text-brand-600">
             <Logo />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight mb-2">How did we do?</h1>
          <p className="text-slate-500 font-medium text-sm px-4">
            Thank you for visiting <span className="text-brand-600 font-black">{locationName}</span>. Your feedback helps us improve!
          </p>
        </div>

        <div className="px-8 pb-12 space-y-4">
          {activePlatforms.length > 0 ? (
            activePlatforms.map(source => {
              const meta = PLATFORM_META[source as keyof typeof PLATFORM_META];
              return (
                <button
                  key={source}
                  onClick={() => handlePlatformClick(source)}
                  className={`w-full group relative flex items-center gap-4 p-5 ${meta.color} rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all active:scale-95 overflow-hidden`}
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform">
                     <span className="font-black text-6xl text-white">{meta.icon}</span>
                  </div>
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-xl font-black shadow-sm group-hover:rotate-12 transition-transform" style={{ color: source === 'trustpilot' ? '#00b67a' : source === 'tripadvisor' ? '#34e0a1' : source === 'getyourguide' ? '#ff5533' : '#008060' }}>
                    {meta.icon}
                  </div>
                  <div className="text-left relative z-10">
                    <p className="text-white font-black text-xs uppercase tracking-widest opacity-80 mb-0.5">{meta.name}</p>
                    <p className="text-white font-black text-base tracking-tight">{meta.label}</p>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="bg-slate-50 border border-slate-200 p-8 rounded-3xl text-center">
               <p className="text-slate-400 font-black uppercase tracking-widest text-xs mb-2">No active links</p>
               <p className="text-slate-500 font-medium text-sm leading-relaxed">Please contact {locationName} support for feedback instructions.</p>
            </div>
          )}
        </div>

        <div className="bg-slate-50 p-6 text-center border-t border-slate-100">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Powered by Review Kit</p>
        </div>
      </div>
    </div>
  );
};

export default CustomerPortal;