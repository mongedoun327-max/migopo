import React, { useState, useEffect } from 'react';
import {
  Bluetooth,
  User,
  Phone,
  CheckCircle2,
  Radio,
  WifiOff,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { bleBridge } from '../services/bleBridge';
import {
  formatPhoneNumber,
  allocatePermanentUserNumber,
  setMyPermanentPhoneNumber,
} from '../services/phoneSystem';
import { meshManager } from '../services/meshProtocol';
import { BleDeviceStatus } from '../types/mesh';

interface WelcomeOnboardingModalProps {
  isOpen: boolean;
  onComplete: (name: string, phoneNumber: string) => void;
}

export const WelcomeOnboardingModal: React.FC<WelcomeOnboardingModalProps> = ({
  isOpen,
  onComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [bleStatus, setBleStatus] = useState<BleDeviceStatus>(bleBridge.getStatus());
  const [isConnectingBle, setIsConnectingBle] = useState(false);
  const [bleFeedback, setBleFeedback] = useState<string | null>(null);
  const [generatedPhone, setGeneratedPhone] = useState<string>('');
  const [isAllocatingNumber, setIsAllocatingNumber] = useState(false);

  useEffect(() => {
    return bleBridge.subscribe(setBleStatus);
  }, []);

  if (!isOpen) return null;

  // Step 1: Proceed to Bluetooth prompt
  const handleProceedToBluetooth = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    setStep(2);
  };

  // Step 2: Handle Bluetooth Connect
  const handleConnectBluetooth = async () => {
    setIsConnectingBle(true);
    setBleFeedback(null);
    try {
      const res = await bleBridge.connectHardwareBle();
      if (res.success) {
        setBleFeedback('Dispositivo LoRa conectado com sucesso!');
      } else {
        setBleFeedback(res.message || 'Bluetooth ativado no modo ponte local.');
      }
    } catch {
      setBleFeedback('Bluetooth configurado para comunicação na rede.');
    } finally {
      setIsConnectingBle(false);
    }
  };

  // Proceed to Step 3: Allocate number starting at 41160001
  const handleProceedToNumberGeneration = async () => {
    setStep(3);
    setIsAllocatingNumber(true);

    try {
      const selfNode = meshManager.getNodes().find((n) => n.isSelf) || meshManager.getNodes()[0];
      const allocated = await allocatePermanentUserNumber(selfNode ? selfNode.id : 'self_user');
      setGeneratedPhone(allocated);
    } catch {
      setGeneratedPhone('41160001');
    } finally {
      setIsAllocatingNumber(false);
    }
  };

  // Final confirmation
  const handleFinishOnboarding = () => {
    const cleanName = name.trim() || 'Operador';
    const finalNumber = generatedPhone || '41160001';

    // Save profile and phone permanently
    meshManager.updateMyName(cleanName);
    setMyPermanentPhoneNumber(finalNumber);

    try {
      localStorage.setItem('lora_user_onboarding_completed_v2', 'true');
    } catch {}

    onComplete(cleanName, finalNumber);
  };

  const initials = name.trim().slice(0, 2).toUpperCase() || 'OP';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 select-none animate-fadeIn">
      <div className="bg-white border border-[#EEEEEE] rounded-[24px] max-w-[368px] w-full p-6 text-center space-y-6 shadow-2xl relative animate-scaleUp">
        {/* Step Indicator Progress Bar */}
        <div className="flex items-center justify-center gap-2 pt-1">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${
              step >= 1 ? 'w-8 bg-black' : 'w-2 bg-neutral-200'
            }`}
          />
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${
              step >= 2 ? 'w-8 bg-black' : 'w-2 bg-neutral-200'
            }`}
          />
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${
              step >= 3 ? 'w-8 bg-black' : 'w-2 bg-neutral-200'
            }`}
          />
        </div>

        {/* ========================================================================= */}
        {/* PASSO 1: APENAS O NOME                                                    */}
        {/* ========================================================================= */}
        {step === 1 && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="space-y-1.5 text-center">
              <span className="text-[11px] font-bold uppercase tracking-[1px] text-[#777777]">
                PASSO 1 DE 3 · CADASTRO SIMPLES
              </span>
              <h2 className="text-[26px] font-normal tracking-[-0.8px] text-black">
                Como se chama?
              </h2>
              <p className="text-[13px] text-[#777777] leading-relaxed">
                Apenas o seu nome é necessário para iniciar a comunicação sem fios na rede.
              </p>
            </div>

            {/* Live Avatar Preview */}
            <div className="flex justify-center">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center font-semibold text-3xl text-black shadow-md transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
                }}
              >
                {initials}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleProceedToBluetooth} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 shrink-0 flex items-center justify-center">
                  <User className="w-5 h-5 text-black" />
                </div>
                <div className="flex-1 bg-white border-[1.4px] border-black rounded-[14px] px-4 h-[54px] flex items-center">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="O seu nome (ex: Ana, Miguel)"
                    className="bg-transparent border-none text-[15px] text-black placeholder:text-[#888888] focus:outline-none w-full"
                    autoFocus
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className={`w-full h-[54px] rounded-[27px] font-medium text-[15px] flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    name.trim()
                      ? 'bg-black hover:bg-neutral-800 text-white shadow-md active:scale-98'
                      : 'bg-[#EEEEEE] text-[#888888] cursor-not-allowed'
                  }`}
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PASSO 2: PEDIR PARA LIGAR BLUETOOTH                                       */}
        {/* ========================================================================= */}
        {step === 2 && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="space-y-1.5 text-center">
              <span className="text-[11px] font-bold uppercase tracking-[1px] text-[#777777]">
                PASSO 2 DE 3 · LIGAÇÃO SEM FIOS
              </span>
              <h2 className="text-[26px] font-normal tracking-[-0.8px] text-black">
                Ligar Bluetooth
              </h2>
              <p className="text-[13px] text-[#777777] leading-relaxed">
                Por favor, ative o Bluetooth para conectar o seu rádio LoRa (ESP32 / T-Beam) e comunicar sem internet.
              </p>
            </div>

            {/* Bluetooth Icon Graphic */}
            <div className="relative flex items-center justify-center py-2">
              <div className="w-32 h-32 rounded-full border border-neutral-100 flex items-center justify-center relative">
                <div
                  className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                    bleStatus.isConnected
                      ? 'bg-black text-white'
                      : 'bg-neutral-50 border border-neutral-200 text-black'
                  }`}
                >
                  <Bluetooth className={`w-10 h-10 ${isConnectingBle ? 'animate-pulse' : ''}`} />
                </div>
                {bleStatus.isConnected && (
                  <span className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-[#00B98B] border-2 border-white flex items-center justify-center text-white">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
              </div>
            </div>

            {/* Status Feedback */}
            <div className="min-h-[24px]">
              {bleStatus.isConnected ? (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{bleStatus.deviceName || 'Rádio LoRa conectado'}</span>
                </div>
              ) : bleFeedback ? (
                <p className="text-xs text-neutral-600 font-medium">{bleFeedback}</p>
              ) : (
                <p className="text-xs text-[#777777]">
                  Toque abaixo para emparelhar com a placa ou continuar.
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handleConnectBluetooth}
                disabled={isConnectingBle}
                className="w-full h-[52px] rounded-[26px] bg-black hover:bg-neutral-800 text-white font-medium text-[15px] flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer"
              >
                <Bluetooth className="w-4 h-4" />
                <span>{isConnectingBle ? 'A procurar rádio...' : 'Ligar Bluetooth'}</span>
              </button>

              <button
                type="button"
                onClick={handleProceedToNumberGeneration}
                className="w-full h-[48px] rounded-[24px] bg-[#EEEEEE] hover:bg-neutral-200 text-black font-medium text-[14px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Avançar para o Número</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PASSO 3: GERAÇÃO DO NÚMERO (SEMPRE 4116, COMEÇANDO EM 4116 0001)           */}
        {/* ========================================================================= */}
        {step === 3 && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="space-y-1.5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-black">
                <Sparkles className="w-4 h-4" />
                <span className="text-[11px] font-bold uppercase tracking-[1px] text-[#777777]">
                  PASSO 3 DE 3 · NÚMERO OFICIAL
                </span>
              </div>
              <h2 className="text-[26px] font-normal tracking-[-0.8px] text-black">
                Número Gerado!
              </h2>
              <p className="text-[13px] text-[#777777] leading-relaxed">
                O seu número de identificador permanente foi gerado pelo sistema:
              </p>
            </div>

            {/* Generated Phone Number Big Banner */}
            <div className="p-6 rounded-[22px] border-[1.5px] border-black bg-white flex flex-col items-center justify-center space-y-2 shadow-sm">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#777777]">
                NÚMERO EXCLUSIVO
              </span>
              <div className="text-[36px] font-semibold tracking-wider text-black font-mono">
                {isAllocatingNumber
                  ? '4116 ....'
                  : formatPhoneNumber(generatedPhone || '41160001')}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Atribuído a {name.trim() || 'você'}</span>
              </div>
            </div>

            {/* Sequential guarantee notice */}
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-[11px] text-[#777777] leading-relaxed text-left space-y-1">
              <p className="font-semibold text-black">
                • Regra de Numeração Sequencial:
              </p>
              <p>
                Todos os números começam obrigatoriamente por <strong>4116</strong>. O primeiro operador é o <strong>4116 0001</strong>, o seguinte o <strong>4116 0002</strong> e assim sucessivamente.
              </p>
              <p>
                Cada utilizador tem direito a apenas 1 número permanente e intransmissível.
              </p>
            </div>

            {/* Finish Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleFinishOnboarding}
                disabled={isAllocatingNumber}
                className="w-full h-[54px] rounded-[27px] bg-black hover:bg-neutral-800 active:scale-98 text-white font-medium text-[16px] flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <span>Entrar no Sistema</span>
                <Check className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
