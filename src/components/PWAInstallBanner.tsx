import React, { useState } from 'react';
import { Download, Share, PlusSquare, X, CheckCircle2, Smartphone, ShieldCheck } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallBannerProps {
  onDismiss?: () => void;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ onDismiss }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // If already running standalone or user dismissed, don't show the persistent banner
  if (isInstalled || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      {/* Sleek top banner on mobile and desktop */}
      <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-indigo-500/15 border-b border-amber-500/30 px-3 py-2 text-xs flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#FFBB7D] via-[#EFD1BE] to-[#B3BDDC] flex items-center justify-center text-slate-950 font-bold shrink-0 shadow-sm">
            <Download className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-100 truncate flex items-center gap-1.5">
              <span>Instalar LoRaMesh no Dispositivo</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded-full font-mono font-normal">
                PWA
              </span>
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              Funciona offline sem internet com acesso direto ao rádio e chamadas de voz
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 bg-white text-black hover:bg-slate-100 font-semibold text-[11px] rounded-lg transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Instalar App</span>
          </button>

          <button
            onClick={() => {
              setDismissed(true);
              if (onDismiss) onDismiss();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
            title="Fechar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Guided installation modal for iOS / manual browsers */}
      {showGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base text-white">Instalar no Dispositivo</h3>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs leading-relaxed">
                <p className="text-slate-300">
                  Para instalar no seu <strong>iPhone ou iPad</strong>:
                </p>
                <ol className="space-y-2.5 bg-slate-950/80 border border-slate-800/80 p-3.5 rounded-xl font-medium">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center text-[11px] font-bold shrink-0">
                      1
                    </span>
                    <span>
                      Toque no botão de <strong>Partilhar</strong>{' '}
                      <Share className="w-3.5 h-3.5 inline mx-1 text-sky-400" /> na barra inferior do Safari.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center text-[11px] font-bold shrink-0">
                      2
                    </span>
                    <span>
                      Role para baixo e selecione{' '}
                      <strong>"Adicionar ao ecrã principal"</strong>{' '}
                      <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-emerald-400" />.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center text-[11px] font-bold shrink-0">
                      3
                    </span>
                    <span>
                      Toque em <strong>Adicionar</strong> no canto superior direito.
                    </span>
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3 text-xs leading-relaxed">
                <p className="text-slate-300">
                  Para instalar no seu navegador:
                </p>
                <ol className="space-y-2.5 bg-slate-950/80 border border-slate-800/80 p-3.5 rounded-xl font-medium">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center text-[11px] font-bold shrink-0">
                      1
                    </span>
                    <span>
                      Abra o menu de opções do navegador (três pontinhos <strong>⋮</strong>).
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center text-[11px] font-bold shrink-0">
                      2
                    </span>
                    <span>
                      Selecione <strong>"Instalar aplicação"</strong> ou <strong>"Adicionar ao ecrã principal"</strong>.
                    </span>
                  </li>
                </ol>
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={() => setShowGuide(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
