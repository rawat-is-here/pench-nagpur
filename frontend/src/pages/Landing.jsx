import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, HelpCircle, AlertTriangle } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f4f7f4] text-[#13241b] flex flex-col justify-between font-sans antialiased selection:bg-[#d97706] selection:text-white">
      
      {/* NAVBAR */}
      <header className="max-w-6xl mx-auto w-full px-6 py-6 md:px-8 md:py-10 flex justify-between items-center border-b border-[#dbe4dc] relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#ebf2eb] border border-[#dbe4dc] flex items-center justify-center shadow-sm">
            <img src="/favicon.svg" alt="TerraStripe Logo" className="w-7 h-7 object-contain" />
          </div>
          <div>
            <div className="font-black text-base tracking-widest text-[#091a12] uppercase">TERRASTRIPE</div>
            <div className="text-[11px] text-[#4a5d52] font-black uppercase tracking-wider">Pench Conservation AI</div>
          </div>
        </div>

        <button 
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2.5 bg-[#112c20] hover:bg-[#183e2d] text-white text-xs md:text-sm font-extrabold px-4 py-2.5 md:px-6 md:py-3 rounded-xl shadow-sm transition-all hover:scale-[1.02] active:scale-95 cursor-pointer border border-[#183e2d]/30"
        >
          <span>Launch Console</span>
          <ArrowRight size={15} />
        </button>
      </header>

      {/* HERO SECTION */}
      <main className="max-w-6xl mx-auto w-full px-6 py-10 md:py-24 flex-1 flex flex-col justify-center space-y-12 md:space-y-16 relative z-10">
        <div className="space-y-6 text-center">
          <h1 className="text-3xl md:text-7xl font-black tracking-tight text-[#091a12] leading-[1.1] max-w-5xl mx-auto">
            Pench Reserve Spatial AI Console
          </h1>
          <p className="text-base md:text-2xl text-[#4a5d52] max-w-2xl mx-auto font-medium leading-relaxed">
            Automating wildlife telemetry and habitat boundary monitoring in real-time.
          </p>
        </div>

        {/* TWO SECTIONS: WHAT IS THIS & WHY IS THIS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
          
          {/* WHAT IS THIS? */}
          <div className="bg-white border border-[#dbe4dc] p-6 md:p-12 rounded-3xl shadow-sm space-y-6 hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3.5 text-[#112c20] font-black text-xl md:text-2xl border-b border-[#f4f7f4] pb-4">
                <HelpCircle size={26} className="text-[#d97706]" />
                <h2>What is this?</h2>
              </div>
              <p className="text-sm md:text-base text-[#4a5d52] leading-relaxed">
                An automated AI dashboard that processes reserve camera trap uploads, filters blank images instantly, and runs biometric stripe matching against felines.
              </p>
            </div>
            <div className="text-xs font-bold text-[#d97706] tracking-wider uppercase pt-4">MegaDetector V6 + FAISS Biometrics</div>
          </div>

          {/* WHY IS THIS? */}
          <div className="bg-white border border-[#dbe4dc] p-6 md:p-12 rounded-3xl shadow-sm space-y-6 hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3.5 text-[#112c20] font-black text-xl md:text-2xl border-b border-[#f4f7f4] pb-4">
                <AlertTriangle size={26} className="text-[#d97706]" />
                <h2>Why is this?</h2>
              </div>
              <p className="text-sm md:text-base text-[#4a5d52] leading-relaxed">
                To eliminate manual telemetry delays, drop false-triggers from vegetation, and immediately alert rangers when a tiger moves outside its home range boundaries.
              </p>
            </div>
            <div className="text-xs font-bold text-[#d97706] tracking-wider uppercase pt-4">Instant Range Shift Alerting</div>
          </div>
          
        </div>

        <div className="flex justify-center pt-6">
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-3 bg-[#112c20] hover:bg-[#183e2d] text-white text-base font-extrabold px-10 py-4.5 rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-95 cursor-pointer border border-[#183e2d]/30"
          >
            <span>Launch Command Center</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-[#dbe4dc] py-10 text-center text-xs text-[#788d81] relative z-10">
        <p>&copy; {new Date().getFullYear()} TerraStripe · Pench Reserve Forestry Department. All rights reserved.</p>
      </footer>

    </div>
  );
}
