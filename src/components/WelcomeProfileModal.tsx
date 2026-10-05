import React, { useState } from 'react';
import {
  X,
  HelpCircle,
  Radio,
  User,
  CheckCircle2,
  Edit3,
  Key,
  Shield,
} from 'lucide-react';
import { UserRegistration } from '../types/mesh';
import { meshManager } from '../services/meshProtocol';
import operatorAvatarUrl from '../assets/images/operator_avatar_1791159237612.jpg';

interface WelcomeProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  myProfile: UserRegistration;
  onProfileUpdated: (updated: UserRegistration) => void;
  onOpenFullEdit: () => void;
}

export const WelcomeProfileModal: React.FC<WelcomeProfileModalProps> = ({
  isOpen,
  onClose,
  myProfile,
  onProfileUpdated,
  onOpenFullEdit,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(myProfile.name);
  const [editUsername, setEditUsername] = useState(myProfile.username);
  const [editCallsign, setEditCallsign] = useState(myProfile.callsign);
  const [showHelp, setShowHelp] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    const cleanedUsername = editUsername.trim().toLowerCase().replace(/^@/, '').replace(/\s+/g, '.');

    const updated: UserRegistration = {
      ...myProfile,
      name: editName.trim(),
      username: cleanedUsername || myProfile.username,
      callsign: editCallsign.trim().toUpperCase() || myProfile.callsign,
    };

    meshManager.saveMyProfile(updated);
    onProfileUpdated(updated);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="relative w-full max-w-md bg-white text-slate-900 rounded-t-[32px] sm:rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Controls: Close [X] and Help [?] matching Screenshot 4 */}
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-2 text-slate-700 hover:text-black rounded-full hover:bg-slate-100 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Clean Tactical Brand Icon */}
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-rose-400 flex items-center justify-center text-white shadow-xs">
            <Radio className="w-3.5 h-3.5 text-white" />
          </div>

          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 text-slate-700 hover:text-black rounded-full hover:bg-slate-100 transition-colors"
            title="Ajuda"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Help Banner if toggled */}
        {showHelp && (
          <div className="p-3.5 bg-slate-100 rounded-2xl text-xs text-slate-700 space-y-1">
            <p className="font-semibold text-slate-900">Como funciona o perfil no rádio?</p>
            <p className="text-[11px] leading-relaxed text-slate-600">
              O seu nome e indicativo identificam as suas mensagens e notas de voz na rede mesh. Ao alterar o nome aqui, todos os colegas que abrirem o aplicativo vêem a atualização instantaneamente.
            </p>
          </div>
        )}

        {/* Center Zone: Circular User Avatar */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-slate-100 shadow-xl bg-gradient-to-tr from-amber-400 to-rose-300 flex items-center justify-center">
              <img
                src={operatorAvatarUrl}
                alt={myProfile.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
              <span className="font-bold text-2xl text-slate-900 select-none">
                {myProfile.name.slice(0, 2).toUpperCase()}
              </span>
            </div>

            <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white text-[10px] font-bold">
              ✓
            </div>
          </div>

          {/* Headline matching Screenshot 4 */}
          {!isEditing ? (
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 leading-tight">
                Damos-te novamente as boas-vindas,{' '}
                <span className="text-amber-600">{myProfile.username || 'miguelworscoi'}</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {myProfile.name} · Indicativo: <span className="font-mono font-semibold">{myProfile.callsign}</span>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="w-full space-y-3 pt-1 text-left text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nome do Operador</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nome de Utilizador (@handle)</label>
                <input
                  type="text"
                  required
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 font-mono focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Indicativo de Rádio (Callsign)</label>
                <input
                  type="text"
                  value={editCallsign}
                  onChange={(e) => setEditCallsign(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 font-mono uppercase focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-black hover:bg-slate-800 text-white font-bold rounded-xl transition-colors"
                >
                  Salvar
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Action Buttons matching Screenshot 4 */}
        {!isEditing && (
          <div className="space-y-3 pt-2">
            <button
              onClick={onClose}
              className="w-full py-4 bg-black hover:bg-slate-800 text-white font-bold rounded-full text-base transition-transform active:scale-[0.98] shadow-lg shadow-black/10 flex items-center justify-center gap-2"
            >
              <span>Entrar</span>
            </button>

            <button
              onClick={() => setIsEditing(true)}
              className="w-full py-2.5 text-xs font-semibold text-slate-700 hover:text-black transition-colors flex items-center justify-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Alterar nome ou indicativo</span>
            </button>

            <div className="pt-2 text-center">
              <button
                onClick={() => {
                  onClose();
                  onOpenFullEdit();
                }}
                className="text-xs text-slate-400 hover:text-slate-800 underline underline-offset-4 transition-colors"
              >
                Configurações avançadas de rádio
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
