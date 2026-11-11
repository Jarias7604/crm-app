import React, { useEffect, useState } from 'react';
import { MessageSquare, ExternalLink, Paperclip } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface Props {
    leadId: string;
    navigate: (to: string) => void;
}

interface Line {
    id: string;
    created_at: string;
    is_internal: boolean;
    sender: string;
    text: string;
    fromTeam: boolean;
}

// Shows the lead's conversation on the shared WhatsApp number (+503 7971-8911)
// inside the lead file, so the salesperson sees it next to follow-ups.
// Renders nothing when the lead never wrote to that number (or RLS hides it).
export const LeadWhatsappThread: React.FC<Props> = ({ leadId, navigate }) => {
    const [jid, setJid] = useState<string | null>(null);
    const [lines, setLines] = useState<Line[]>([]);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data: tks } = await supabase
                .from('tickets')
                .select('id, metadata')
                .eq('lead_id', leadId)
                .eq('metadata->>source', 'whatsapp_evolution')
                .order('updated_at', { ascending: false })
                .limit(10);
            if (cancelled || !tks || tks.length === 0) {
                if (!cancelled) {
                    setJid(null);
                    setLines([]);
                }
                return;
            }
            const ids = tks.map((t) => t.id);
            const { data: cm, count } = await supabase
                .from('ticket_comments')
                .select('id, body, created_at, is_internal', { count: 'exact' })
                .in('ticket_id', ids)
                .order('created_at', { ascending: false })
                .limit(8);
            if (cancelled) return;
            setJid(String((tks[0].metadata as Record<string, unknown>)?.whatsapp_jid || '') || null);
            setTotal(count || 0);
            setLines(
                (cm || [])
                    .map((c) => {
                        const raw = String(c.body || '')
                            .replace(/👨‍💻\s*Simulaci[oó]n:\s*[a-zA-Z0-9_-]+:/gi, '👨‍💻 Jimmy Arias:')
                            .replace(/Simulaci[oó]n:\s*[a-zA-Z0-9_-]+/gi, 'Jimmy Arias de Arias Defense')
                            .replace(/\bPlatform Owner\b/gi, 'Jimmy Arias de Arias Defense');
                        const m = raw.match(/^\[[^\]]+\]\s*(👤|👨‍💻)?\s*([^:\n]+):\s*([\s\S]*)$/);
                        return {
                            id: c.id,
                            created_at: c.created_at,
                            is_internal: c.is_internal,
                            sender: m ? m[2].replace(/\(Reporte Inicial\)/i, '').trim() : '',
                            text: (m ? m[3] : raw).split('\n📝')[0].trim(),
                            fromTeam: m ? m[1] === '👨‍💻' : true,
                        };
                    })
                    .reverse()
            );
        })();
        return () => {
            cancelled = true;
        };
    }, [leadId]);

    if (!jid && lines.length === 0) return null;

    return (
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-800">
                    <MessageSquare className="w-3.5 h-3.5" />
                    WhatsApp Soporte · +503 7971-8911
                    <span className="font-semibold normal-case text-emerald-700/80">({total} mensajes)</span>
                </span>
                {jid && (
                    <button
                        type="button"
                        onClick={() => navigate(`/support/chat?jid=${encodeURIComponent(jid)}`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                        Abrir chat
                        <ExternalLink className="w-3 h-3" />
                    </button>
                )}
            </div>
            <div className="space-y-1.5">
                {lines.map((l) =>
                    l.is_internal ? (
                        <p key={l.id} className="text-[10px] text-amber-800 bg-amber-50 rounded px-2 py-0.5">
                            {l.text.replace(/^🏷️\s*/, '')}
                        </p>
                    ) : (
                        <div key={l.id} className={`flex ${l.fromTeam ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-xl px-2.5 py-1.5 text-[11px] ${l.fromTeam ? 'bg-indigo-50 text-slate-800' : 'bg-white border border-slate-200 text-slate-800'}`}>
                                <span className="font-bold text-[10px] text-slate-500 block">
                                    {l.sender} · {new Date(l.created_at).toLocaleString('es-SV', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {/^\[(Imagen|Video|Documento|Nota de voz|Sticker)/i.test(l.text) && <Paperclip className="w-3 h-3 inline mr-1 text-slate-400" />}
                                {l.text}
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};
