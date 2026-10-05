import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Key,
  Shield,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Layers,
  Cpu,
} from 'lucide-react';
import {
  encryptPacketPayload,
  decryptPacketPayload,
  generateRandomPsk,
  DEFAULT_PRIMARY_CHANNEL_KEY,
  EncryptedPayload,
} from '../services/cryptoEngine';

export const CryptoSecurityPanel: React.FC = () => {
  const [activeKey, setActiveKey] = useState(DEFAULT_PRIMARY_CHANNEL_KEY);
  const [copiedKey, setCopiedKey] = useState(false);
  const [testPlaintext, setTestPlaintext] = useState('MISSÃO TÁTICA: Ponto de encontro na Colina 402 às 16:30Z.');
  const [encryptedResult, setEncryptedResult] = useState<EncryptedPayload | null>(null);
  const [decryptedResult, setDecryptedResult] = useState<string | null>(null);
  const [tamperedCiphertext, setTamperedCiphertext] = useState('');
  const [decryptionError, setDecryptionError] = useState<string | null>(null);

  const handleGenerateNewKey = () => {
    const newKey = generateRandomPsk();
    setActiveKey(newKey);
    setEncryptedResult(null);
    setDecryptedResult(null);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(activeKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleEncrypt = async () => {
    const result = await encryptPacketPayload(testPlaintext, activeKey);
    setEncryptedResult(result);
    setTamperedCiphertext(result.ciphertextHex);
    setDecryptedResult(null);
    setDecryptionError(null);
  };

  const handleDecrypt = async () => {
    if (!encryptedResult) return;
    const res = await decryptPacketPayload(
      tamperedCiphertext,
      activeKey,
      encryptedResult.ivHex,
      encryptedResult.authTagHex
    );

    if (res.success) {
      setDecryptedResult(res.plaintext);
      setDecryptionError(null);
    } else {
      setDecryptedResult(null);
      setDecryptionError(res.error || 'Falha de integridade: Tag de autenticação inválida.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-100">
              Segurança & Criptografia Ponta-a-Ponta (E2EE)
            </h2>
            <p className="text-xs text-slate-400">
              Cifragem simétrica militar AES-256-GCM para proteger transmissões em ondas de rádio abertas (ISM 868/915 MHz)
            </p>
          </div>
        </div>
      </div>

      {/* Channel Key Manager */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-100 flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-400" />
              Chave Pré-Partilhada do Canal Operacional (AES-256 PSK)
            </h3>
            <p className="text-xs text-slate-400">
              Chave criptográfica simétrica de 256 bits partilhada entre os rádios da equipa em campo
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateNewKey}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Gerar Nova Chave</span>
            </button>

            <button
              onClick={handleCopyKey}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
            >
              {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey ? 'Copiada!' : 'Copiar PSK'}</span>
            </button>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 break-all select-all">
          {activeKey}
        </div>
        <p className="text-[11px] text-slate-400">
          Nota: Todos os nós que sintonizarem o canal devem possuir exatamente esta chave configurada no firmware para decodificar mensagens e áudios.
        </p>
      </div>

      {/* Interactive Cryptographic Dissection Tool */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Encryptor */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="font-display text-sm font-bold text-slate-100 pb-2 border-b border-slate-800 flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            1. Cifragem de Pacote no Transmissor (App do Utilizador)
          </h3>

          <div>
            <label className="block text-slate-400 text-xs mb-1">Carga Útil em Texto Claro (Plaintext)</label>
            <textarea
              rows={3}
              value={testPlaintext}
              onChange={(e) => setTestPlaintext(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:border-emerald-500 font-sans"
            />
          </div>

          <button
            onClick={handleEncrypt}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors shadow-sm"
          >
            Executar Cifragem AES-256-GCM
          </button>

          {encryptedResult && (
            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400">IV (Vetor de Inicialização 96-bit):</span>
                <div className="text-sky-400 break-all">{encryptedResult.ivHex}</div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400">Criptograma (Ciphertext Hex):</span>
                <div className="text-amber-400 break-all">{encryptedResult.ciphertextHex}</div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400">Tag de Autenticação MAC (128-bit):</span>
                <div className="text-emerald-400 break-all">{encryptedResult.authTagHex}</div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Decryptor & Tamper Tester */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="font-display text-sm font-bold text-slate-100 pb-2 border-b border-slate-800 flex items-center gap-2">
            <Unlock className="w-4 h-4 text-emerald-400" />
            2. Decifração & Teste de Integridade no Recetor
          </h3>

          <div>
            <label className="block text-slate-400 text-xs mb-1">
              Criptograma Recebido (Tente alterar 1 caractere para simular ataque de rádio):
            </label>
            <textarea
              rows={3}
              value={tamperedCiphertext}
              onChange={(e) => setTamperedCiphertext(e.target.value)}
              placeholder="Execute a cifragem à esquerda primeiro..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:border-emerald-500 font-mono"
            />
          </div>

          <button
            onClick={handleDecrypt}
            disabled={!encryptedResult}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-emerald-400 font-bold text-xs rounded-xl border border-slate-700 transition-colors"
          >
            Decifrar e Validar Tag GCM
          </button>

          {decryptedResult && (
            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-700/60 text-xs space-y-1">
              <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> MENSAGEM DECIFRADA COM SUCESSO & INTEGRIDADE CONFIRMADA
              </span>
              <p className="text-slate-100 font-sans">{decryptedResult}</p>
            </div>
          )}

          {decryptionError && (
            <div className="p-3 rounded-xl bg-red-950/30 border border-red-700/60 text-xs space-y-1">
              <span className="text-[10px] text-red-400 font-mono font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> REJEIÇÃO CRIPTOGRÁFICA
              </span>
              <p className="text-slate-300 font-sans">{decryptionError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
