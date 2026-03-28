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
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[300]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-16 right-4 md:right-8 z-[301] w-[320px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in slide-in-from-top-2 duration-150">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-[#4449AA]/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4449AA] text-white flex items-center justify-center text-sm font-black">
              {initials}
            </div>
            <div>
              <p className="text-[13px] font-bold text-gray-900">{profile?.full_name || firstName}</p>
              <p className="text-[11px] text-gray-400 truncate max-w-[160px]">{profile?.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">

          {/* Telegram Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Send className="w-3.5 h-3.5 text-blue-500" />
              <p className="text-xs font-black text-gray-700 uppercase tracking-wide">Notificaciones Telegram</p>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-1.5">
              <p className="text-[11px] text-blue-700 font-semibold">¿Cómo obtener tu ID?</p>
              <ol className="text-[11px] text-blue-600 space-y-1 list-decimal list-inside">
                <li>Abre Telegram en tu celular</li>
                <li>Busca <strong>@userinfobot</strong></li>
                <li>Presiona <strong>Start</strong> o escríbele algo</li>
                <li>Copia el número que dice <strong>Id:</strong></li>
              </ol>
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-bold hover:underline mt-1"
              >
                Abrir @userinfobot <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                Tu Telegram Chat ID
              </label>
              <input
                type="text"
                value={telegramId}
                onChange={e => setTelegramId(e.target.value.replace(/\D/g, ''))}
                placeholder="Ej: 847291034"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#4449AA]/20 focus:border-[#4449AA] bg-white font-mono"
              />
              {telegramId && (
                <p className="text-[10px] text-gray-400">
                  Las alertas del pipeline llegarán a esta cuenta de Telegram
                </p>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#4449AA] text-white rounded-xl text-sm font-bold hover:bg-[#3338a0] disabled:opacity-60 transition-all"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {saved ? '¡Guardado!' : 'Guardar preferencias'}
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </>
  );
}
