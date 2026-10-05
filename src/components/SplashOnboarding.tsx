import React from 'react';
import { Radio, Globe, Shield, WifiOff } from 'lucide-react';

interface SplashOnboardingProps {
  onStart: () => void;
}

export const SplashOnboarding: React.FC<SplashOnboardingProps> = ({ onStart }) => {
  return (
    <div className="fixed inset-0 z-50 bg-white text-slate-950 flex flex-col justify-between overflow-hidden">
      {/* Top Ambient Radiant Gradient matching Screenshot 1 */}
      <div
        className="w-full h-[52vh] pointer-events-none relative"
        style={{
          background: 'radial-gradient(ellipse 130% 90% at 50% -10%, #fb923c 0%, #fed7aa 45%, #ffffff 100%)',
        }}
      />

      {/* Center Brand Identity matching Screenshot 1 */}
      <div className="relative -mt-24 px-6 flex flex-col items-center text-center space-y-4 my-auto">
        <div className="flex items-center gap-3">
          {/* Custom Sleek Logo Mark */}
          <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center text-white shadow-xl shadow-black/10">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-extrabold text-4xl sm:text-5xl tracking-tight text-slate-950">
            LoRa<span className="text-amber-600">Mesh</span>
          </h1>
        </div>

        <p className="text-sm text-slate-600 max-w-xs leading-relaxed font-medium">
          Comunicação tática off-grid, áudio PTT e mensagens em malha 100% sem internet.
        </p>

        <div className="flex items-center gap-3 pt-2 text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-1">
            <WifiOff className="w-3.5 h-3.5 text-amber-600" />
            Zero Dados
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            AES-256 E2EE
          </span>
          <span>·</span>
          <span>868 MHz</span>
        </div>
      </div>

      {/* Bottom CTA Button matching Screenshot 1 */}
      <div className="p-6 sm:p-8 max-w-md w-full mx-auto space-y-4 pb-12">
        <button
          onClick={onStart}
          className="w-full py-4 bg-black hover:bg-slate-800 active:scale-[0.98] text-white font-bold rounded-full text-base transition-all shadow-xl shadow-black/15 flex items-center justify-center gap-2"
        >
          <span>Começar</span>
        </button>

        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer">
          <Globe className="w-3.5 h-3.5" />
          <span>Português (Padrão)</span>
        </div>
      </div>
    </div>
  );
};
