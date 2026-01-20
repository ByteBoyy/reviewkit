import React, { useState } from 'react';
import { Location } from '../types';

interface LocationSettingsProps {
  location: Location;
  onSave: (updated: Location) => void;
  onClose: () => void;
}

const LocationSettings: React.FC<LocationSettingsProps> = ({ location, onSave, onClose }) => {
  const [name, setName] = useState(location.name);

  const handleSave = () => {
    const updatedLoc: Location = {
      ...location,
      name,
      updatedAt: new Date().toISOString()
    };

    onSave(updatedLoc);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Location Settings</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Manage Identity for {location.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
          <section className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Business Identity</h4>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">Location Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none font-medium"
              />
            </div>
          </section>

          <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-start gap-4">
             <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm text-blue-600 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
             </div>
             <div>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Connections Moved</p>
                <p className="text-[11px] text-slate-600 font-medium leading-relaxed">Platform URLs and Google API settings are now managed directly in the <b>Connectivity</b> tab on your dashboard for a more unified management experience.</p>
             </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-6 py-3.5 bg-white text-slate-500 font-black uppercase text-[10px] tracking-widest rounded-xl border border-slate-200 hover:bg-slate-100 transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="flex-1 px-6 py-3.5 bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-xl hover:bg-black transition-all"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationSettings;