import { useState, useEffect } from 'react';
import { X, Send, CheckCircle2, Loader2, LogOut, ExternalLink } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../auth/AuthProvider';
import toast from 'react-hot-toast';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { profile } = useAuth();
  const [telegramId, setTelegramId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isOpen || !profile) return;
    // Load current telegram_chat_id
    supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', profile.id)
      .single()
      .then(({ data }) => {
        if (data?.telegram_chat_id) setTelegramId(data.telegram_chat_id);
      });
  }, [isOpen, profile]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ telegram_chat_id: telegramId.trim() || null })
        .eq('id', profile.id);
      if (error) throw error;
      setSaved(true);
      toast.success('✅ Preferencias guardadas');
      setTimeout(() => setSaved(false), 2500);
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  if (!isOpen) return null;

  const firstName = profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] || 'Usuario';
  const initials = (profile?.full_name || profile?.email || 'U')
    .split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[300]"
        onClick={onClose}
      />

      {/* Modal - Bottom Sheet on Mobile / Dropdown on Desktop */}
      <div className="fixed inset-x-2 bottom-2.5 sm:bottom-auto sm:inset-x-auto sm:top-16 sm:right-8 z-[301] w-auto sm:w-[350px] max-w-[calc(100vw-16px)] bg-white rounded-3xl sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-4 sm:slide-in-from-top-2 duration-200 max-h-[88vh] flex flex-col">

        {/* Mobile drag handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 sm:py-4 border-b border-gray-100 bg-gradient-to-r from-[#4449AA]/5 to-transparent shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4449AA] text-white flex items-center justify-center text-sm font-black shadow-xs">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-gray-900 truncate">{profile?.full_name || firstName}</p>
              <p className="text-[11px] text-gray-400 truncate max-w-[190px]">{profile?.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-700 transition-all cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 overflow-y-auto">

          {/* Telegram Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-[#229ED9]" />
              <p className="text-xs font-black text-gray-800 uppercase tracking-wide">Notificaciones Telegram</p>
            </div>

            {/* Instructions */}
            <div className="bg-sky-50/70 border border-sky-100 rounded-2xl p-3 space-y-1.5 text-slate-700">
              <p className="text-[11px] text-[#229ED9] font-black">¿Cómo vincular tu Telegram?</p>
              <ol className="text-[11px] text-slate-600 space-y-1 list-decimal list-inside font-medium">
                <li>Abre Telegram en tu celular</li>
                <li>Busca el bot oficial <strong>@userinfobot</strong></li>
                <li>Presiona <strong>Start</strong> o envíale un mensaje</li>
                <li>Copia el número que aparece en <strong>Id:</strong></li>
              </ol>
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-[#229ED9] font-bold hover:underline mt-1"
              >
                Abrir @userinfobot en Telegram <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">
                Tu Telegram Chat ID
              </label>
              <input
                type="text"
                value={telegramId}
                onChange={e => setTelegramId(e.target.value.replace(/\D/g, ''))}
                placeholder="Ej: 847291034"
                className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#4449AA]/20 focus:border-[#4449AA] bg-white font-mono shadow-2xs"
              />
              {telegramId ? (
                <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  Las alertas de leads y cierres calientes llegarán a este Telegram
                </p>
              ) : (
                <p className="text-[10px] text-slate-400">
                  Ingresa tu Chat ID para recibir alertas instantáneas cuando un lead esté listo para cerrar.
                </p>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#4449AA] hover:bg-[#383d8f] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 cursor-pointer disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {saved ? '¡Guardado con éxito!' : 'Guardar Telegram ID'}
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer border border-red-100 bg-red-50/40"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </>
  );
}
