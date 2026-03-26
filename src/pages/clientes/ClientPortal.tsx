import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Upload, CheckCircle2, Loader2, AlertCircle,
  ShieldCheck, File, X, Lock, ChevronDown
} from 'lucide-react';
import { clientPortalService } from '../../services/clients';
import type { ClientPortalData, ClientStageDocumentType, ClientDocument } from '../../types/clients';
import toast from 'react-hot-toast';

function TermsContent({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm text-gray-500 leading-relaxed">
      {text.split('\n').map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} className="h-1" />;
        if (t.startsWith('## ')) return <h3 key={i} className="text-sm font-bold text-gray-800 mt-4 first:mt-0">{t.slice(3)}</h3>;
        if (t.startsWith('### ')) return <h4 key={i} className="text-sm font-semibold text-gray-700 mt-3">{t.slice(4)}</h4>;
        if (t.startsWith('**') && t.endsWith('**')) return <p key={i} className="font-semibold text-gray-700">{t.slice(2, -2)}</p>;
        if (t.startsWith('- ')) return <p key={i} className="pl-4">• {t.slice(2)}</p>;
        return <p key={i}>{t}</p>;
      })}
    </div>
  );
}

export default function ClientPortal() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ClientPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [localDocs, setLocalDocs] = useState<ClientDocument[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsExpanded, setTermsExpanded] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    clientPortalService.getByToken(token).then(result => {
      if (!result) setNotFound(true);
      else {
        setData(result);
        setLocalDocs((result.client.documents || []) as unknown as ClientDocument[]);
        // Auto-accept if no terms are configured
        if (!result.company.portal_terms_text) setTermsAccepted(true);
      }
    }).finally(() => setLoading(false));
  }, [token]);

  const handleUpload = async (file: File, docType: ClientStageDocumentType) => {
    if (!termsAccepted) { toast.error('Acepta los términos primero'); return; }
    if (!data || !token) return;
    setUploading(docType.id);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-portal-upload`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            portal_token: token,
            doc_type_id: docType.id,
            stage_id: data.client.etapa_actual.id,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
          }),
        }
      );
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error'); }
      const { upload_url } = await res.json();
      const put = await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!put.ok) throw new Error('Error al transferir');
      toast.success('Documento enviado correctamente');
      const fresh = await clientPortalService.getByToken(token);
      if (fresh) { setData(fresh); setLocalDocs((fresh.client.documents || []) as unknown as ClientDocument[]); }
    } catch (err: any) {
      toast.error(err.message || 'Error. Intenta de nuevo.');
    } finally { setUploading(null); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
    </div>
  );

  if (notFound || !data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-10 max-w-sm w-full text-center">
        <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-4" />
        <h1 className="text-base font-bold text-gray-900 mb-2">Enlace no válido</h1>
        <p className="text-sm text-gray-400">Este enlace expiró. Contacta a tu asesor.</p>
      </div>
    </div>
  );

  const { client, company } = data;
  const stage = client.etapa_actual;
  const docTypes: ClientStageDocumentType[] = stage.document_types || [];
  const stageDocs = localDocs.filter(d => d.stage_id === stage.id);
  const required = docTypes.filter(d => d.requerido);
  const filled = required.filter(d => stageDocs.some(doc => doc.doc_type_id === d.id));
  const pct = required.length > 0 ? Math.round((filled.length / required.length) * 100) : 100;
  const hasTerms = !!company.portal_terms_text;

  return (
    <>
      <div className="min-h-screen bg-[#f8f8f7] flex flex-col">

        {/* ── Header ─────────────────────────── */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
            {/* Company name only — logo shown in left sidebar below */}
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-bold text-gray-900 truncate">{company.nombre}</span>
              <span className="text-gray-200 hidden sm:block">·</span>
              <span className="text-xs text-gray-400 hidden sm:block">Portal de documentos</span>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${pct === 100 ? 'bg-emerald-500' : 'bg-[#4449AA]'}`}
                  style={{ width: `${pct}%` }} />
              </div>
              <span className={`text-xs font-bold ${pct === 100 ? 'text-emerald-600' : 'text-gray-600'}`}>{pct}%</span>
            </div>
          </div>
        </header>

        {/* ── Main content ───────────────────── */}
        <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
          {/*
            MOBILE  → single column (stacked)
            DESKTOP → 2 columns inside one white card
          */}

          {/* ── MOBILE LAYOUT (block, hidden on md+) ── */}
          <div className="md:hidden space-y-4">
            {/* Welcome */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
                {stage.nombre}
              </p>
              <h1 className="text-2xl font-black text-gray-900">
                Hola, {client.contacto || client.nombre} 👋
              </h1>
              {stage.descripcion && (
                <p className="text-sm text-gray-400 mt-1">{stage.descripcion}</p>
              )}
            </div>

            {/* Progress */}
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3.5">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>{filled.length} de {required.length} documentos</span>
                <span className="font-bold text-gray-900">{pct}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${pct === 100 ? 'bg-emerald-400' : 'bg-[#4449AA]'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>

            {/* Complete */}
            {pct === 100 && (
              <CompletionCard companyName={company.nombre} proximaEtapa={client.proxima_etapa} etapaFinal={stage.es_final} />
            )}

            {/* Docs section */}
            <MobileDocList
              docTypes={docTypes}
              stageDocs={stageDocs}
              uploading={uploading}
              hasTerms={hasTerms}
              termsAccepted={termsAccepted}
              handleUpload={handleUpload}
            />

            {/* T&C */}
            {hasTerms && (
              <TermsCard
                text={company.portal_terms_text!}
                accepted={termsAccepted}
                expanded={termsExpanded}
                onToggleExpand={() => setTermsExpanded(v => !v)}
                onAccept={() => setTermsAccepted(true)}
              />
            )}
          </div>

          {/* ── DESKTOP LAYOUT (hidden on mobile, shown on md+) ── */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-[260px_1fr] divide-x divide-gray-100">

              {/* LEFT — sticky sidebar */}
              <div className="p-6 space-y-6 bg-gray-50/50">
                {/* Company */}
                <div className="space-y-1">
                  {company.logo_url ? (
                  <img src={company.logo_url} alt={company.nombre}
                      className="h-8 w-auto max-w-[140px] object-contain mb-3" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center mb-3">
                      <span className="text-white font-black">{company.nombre[0]}</span>
                    </div>
                  )}
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{stage.nombre}</p>
                  <h2 className="text-xl font-black text-gray-900 leading-tight">
                    {client.contacto || client.nombre}
                  </h2>
                  {stage.descripcion && (
                    <p className="text-xs text-gray-400 leading-relaxed pt-1">{stage.descripcion}</p>
                  )}
                </div>

                {/* Progress block */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">{filled.length} de {required.length} documentos</span>
                    <span className="font-bold text-gray-800">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-900 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                  {pct === 100 && (
                    <div className="flex items-center gap-2 pt-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-600">Completo</span>
                    </div>
                  )}
                </div>

                {/* Document checklist (left side) */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Documentos</p>
                  {docTypes.map((dt, idx) => {
                    const isFilled = stageDocs.some(d => d.doc_type_id === dt.id);
                    const pastels = [
                      { bg: '#fce7f3', text: '#be185d' }, // rose
                      { bg: '#ede9fe', text: '#7c3aed' }, // violet
                      { bg: '#fef3c7', text: '#d97706' }, // amber
                      { bg: '#e0f2fe', text: '#0369a1' }, // sky
                      { bg: '#d1fae5', text: '#065f46' }, // teal
                    ];
                    const pastel = pastels[idx % pastels.length];
                    return (
                      <div key={dt.id} className="flex items-center gap-2.5">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black"
                          style={isFilled
                            ? { background: '#146EB4', color: 'white' }
                            : { background: pastel.bg, color: pastel.text }
                          }
                        >
                          {isFilled ? '✓' : idx + 1}
                        </div>
                        <span className={`text-xs truncate ${isFilled ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                          {dt.nombre}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Trust */}
                <div className="flex items-center gap-1.5 pt-2">
                  <Lock className="w-3 h-3 text-gray-300" />
                  <span className="text-[10px] text-gray-300">Conexión cifrada</span>
                </div>
              </div>

              {/* RIGHT — documents + T&C */}
              <div className="p-6 space-y-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
                  Subir documentos
                </p>

                {/* Completion card for desktop */}
                {pct === 100 && (
                  <CompletionCard companyName={company.nombre} proximaEtapa={client.proxima_etapa} etapaFinal={stage.es_final} />
                )}

                {/* Not-accepted warning */}
                {hasTerms && !termsAccepted && (
                  <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5 mb-4">
                    <ShieldCheck className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <p className="text-xs text-amber-700">Acepta los términos al final para habilitar la carga.</p>
                  </div>
                )}

                {docTypes.length === 0 && (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No hay documentos requeridos.</p>
                  </div>
                )}

                {docTypes.map((dt, idx) => {
                  const uploaded = stageDocs.filter(d => d.doc_type_id === dt.id);
                  const isFilled = uploaded.length > 0;
                  const isLoading = uploading === dt.id;
                  const isDisabled = (hasTerms && !termsAccepted) || isLoading;

                  return (
                    <div key={dt.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                      isFilled ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                      {/* Step with pastel color per index */}
                      {(() => {
                        const pastels = [
                          { bg: '#fce7f3', text: '#be185d' },
                          { bg: '#ede9fe', text: '#7c3aed' },
                          { bg: '#fef3c7', text: '#d97706' },
                          { bg: '#e0f2fe', text: '#0369a1' },
                          { bg: '#d1fae5', text: '#065f46' },
                        ];
                        const p = pastels[idx % pastels.length];
                        return (
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black"
                            style={isFilled
                              ? { background: '#146EB4', color: 'white' }
                              : { background: p.bg, color: p.text }
                            }
                          >
                            {isFilled ? '✓' : idx + 1}
                          </div>
                        );
                      })()}
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-bold ${isFilled ? 'text-gray-400' : 'text-gray-900'}`}>
                            {dt.nombre}
                          </p>
                          {dt.requerido && !isFilled && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                              REQ
                            </span>
                          )}
                        </div>
                        {dt.descripcion && <p className="text-xs text-gray-400 mt-0.5">{dt.descripcion}</p>}
                        {uploaded.map(doc => (
                          <div key={doc.id} className="flex items-center gap-1.5 mt-1.5">
                            <File className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-500 font-medium truncate">{doc.nombre}</span>
                          </div>
                        ))}
                      </div>
                      {/* Upload */}
                      <label className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 ${
                        isDisabled && !isLoading
                          ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                          : isFilled
                          ? 'border border-gray-200 text-gray-500 hover:border-gray-300 cursor-pointer'
                          : 'bg-gray-900 text-white hover:bg-gray-800 cursor-pointer shadow-sm'
                      }`}>
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {isLoading ? 'Subiendo' : isFilled ? 'Cambiar' : 'Subir'}
                        <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx"
                          disabled={isDisabled}
                          onChange={e => { const f = e.target.files?.[0]; if(f) handleUpload(f,dt); e.target.value=''; }} />
                      </label>
                    </div>
                  );
                })}

                {/* T&C desktop */}
                {hasTerms && (
                  <div className={`border rounded-xl overflow-hidden transition-all ${
                    termsAccepted ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'
                  }`}>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/80"
                      onClick={() => setTermsExpanded(v => !v)}
                    >
                      <ShieldCheck className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="flex-1 text-sm font-semibold text-gray-700">
                        {termsAccepted ? '✓ Términos aceptados' : 'Aviso de Privacidad y Términos de Uso'}
                      </span>
                      {!termsAccepted && (
                        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${termsExpanded ? 'rotate-180' : ''}`} />
                      )}
                    </button>
                    {termsExpanded && !termsAccepted && (
                      <div className="px-4 pb-3 max-h-40 overflow-y-auto border-t border-gray-100">
                        <div className="pt-3"><TermsContent text={company.portal_terms_text!} /></div>
                      </div>
                    )}
                    {!termsAccepted && (
                      <label className="flex items-center gap-3 px-4 py-3 cursor-pointer border-t border-gray-100 bg-gray-50/60 select-none">
                        <input type="checkbox" checked={termsAccepted}
                          onChange={e => setTermsAccepted(e.target.checked)}
                          className="w-4 h-4 flex-shrink-0 accent-gray-900" />
                        <span className="text-xs text-gray-600 font-medium">
                          He leído y acepto el Aviso de Privacidad y los Términos de Uso
                        </span>
                      </label>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1.5 pt-1">
                  <Lock className="w-3 h-3 text-gray-300" />
                  <span className="text-[11px] text-gray-300">Conexión cifrada · Datos protegidos</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* T&C bottom sheet modal */}
      {termsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if(e.target===e.currentTarget) setTermsModalOpen(false); }}>
          <div className="bg-white w-full max-w-xl max-h-[85vh] flex flex-col"
            style={{ borderRadius: '20px 20px 0 0', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
            <div className="flex items-center gap-3 px-5 pb-3">
              <ShieldCheck className="w-4 h-4 text-gray-500" />
              <h2 className="text-base font-bold text-gray-900 flex-1">Aviso de Privacidad</h2>
              <button onClick={() => setTermsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="h-px bg-gray-100 mx-5" />
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {company.portal_terms_text && <TermsContent text={company.portal_terms_text} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Mobile sub-components ── */
function MobileDocList({ docTypes, stageDocs, uploading, hasTerms, termsAccepted, handleUpload }: {
  docTypes: ClientStageDocumentType[];
  stageDocs: ClientDocument[];
  uploading: string | null;
  hasTerms: boolean;
  termsAccepted: boolean;
  handleUpload: (file: File, dt: ClientStageDocumentType) => void;
}) {
  // Paleta pastel por índice
  const PASTELS = [
    { bg: '#fce7f3', text: '#be185d', btnBg: '#fdf2f8', btnText: '#9d174d' }, // rose
    { bg: '#ede9fe', text: '#7c3aed', btnBg: '#f5f3ff', btnText: '#6d28d9' }, // violet
    { bg: '#fef3c7', text: '#d97706', btnBg: '#fffbeb', btnText: '#b45309' }, // amber
    { bg: '#e0f2fe', text: '#0369a1', btnBg: '#f0f9ff', btnText: '#0c4a6e' }, // sky
    { bg: '#d1fae5', text: '#065f46', btnBg: '#ecfdf5', btnText: '#064e3b' }, // teal
  ];

  return (
    <div className="space-y-3">
      {docTypes.map((dt, idx) => {
        const uploaded = stageDocs.filter(d => d.doc_type_id === dt.id);
        const isFilled = uploaded.length > 0;
        const isLoading = uploading === dt.id;
        const isDisabled = (hasTerms && !termsAccepted) || isLoading;
        const pastel = PASTELS[idx % PASTELS.length];

        return (
          <div key={dt.id} className={`border rounded-2xl overflow-hidden transition-all ${
            isFilled ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'
          }`}>
            {/* Info row */}
            <div className="flex items-start gap-3.5 px-4 pt-4 pb-3">
              {/* Circle indicator — pastel when pending, big green check when done */}
              {isFilled ? (
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-black"
                  style={{ background: pastel.bg, color: pastel.text }}
                >
                  {idx + 1}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className={`text-[15px] font-bold leading-tight ${
                    isFilled ? 'text-emerald-700' : 'text-gray-900'
                  }`}>
                    {dt.nombre}
                  </p>
                  {isFilled && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">✓ Listo</span>
                  )}
                  {dt.requerido && !isFilled && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">REQ</span>
                  )}
                </div>
                {dt.descripcion && <p className="text-xs text-gray-400 mt-0.5">{dt.descripcion}</p>}
                {uploaded.map(doc => (
                  <div key={doc.id} className="flex items-center gap-1.5 mt-1.5 bg-emerald-100/60 rounded-lg px-2 py-1">
                    <File className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    <span className="text-xs text-emerald-700 font-medium truncate">{doc.nombre}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Full-width upload button */}
            <div className="px-4 pb-4">
              <label className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold transition-all select-none cursor-pointer active:scale-[0.98] ${
                isDisabled && !isLoading
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : isFilled
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200'
                  : ''
              }`}
              style={(!isDisabled && !isFilled) ? { background: pastel.btnBg, color: pastel.btnText, border: `1.5px solid ${pastel.bg}` } : {}}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> 
                  : isFilled ? <CheckCircle2 className="w-5 h-5" />
                  : <Upload className="w-4 h-4" />}
                <span>{isLoading ? 'Subiendo...' : isFilled ? 'Cambiar archivo' : 'Subir documento'}</span>
                <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx"
                  disabled={isDisabled}
                  onChange={e => { const f = e.target.files?.[0]; if(f) handleUpload(f, dt); e.target.value = ''; }} />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TermsCard({ text, accepted, expanded, onToggleExpand, onAccept }: {
  text: string;
  accepted: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onAccept: () => void;
}) {
  return (
    <div className={`bg-white border rounded-2xl overflow-hidden transition-all ${
      accepted ? 'border-gray-200 bg-gray-50' : 'border-gray-200'
    }`}>
      <button className="w-full flex items-center gap-3 px-4 py-4 text-left" onClick={onToggleExpand}>
        <ShieldCheck className={`w-4 h-4 flex-shrink-0 ${accepted ? 'text-gray-400' : 'text-gray-600'}`} />
        <div className="flex-1">
          <p className={`text-sm font-bold ${accepted ? 'text-gray-500' : 'text-gray-800'}`}>
            {accepted ? '\u2713 Términos aceptados' : 'Aviso de Privacidad y Términos'}
          </p>
          {!accepted && <p className="text-xs text-gray-400 mt-0.5">Toca para leer y acepta abajo</p>}
        </div>
        {!accepted && (
          <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        )}
      </button>
      {expanded && !accepted && (
        <div className="px-4 pb-3 max-h-52 overflow-y-auto border-t border-gray-100">
          <div className="pt-3">
            <div className="space-y-1.5 text-sm text-gray-500 leading-relaxed">
              {text.split('\n').map((line, i) => {
                const t = line.trim();
                if (!t) return <div key={i} className="h-1" />;
                if (t.startsWith('## ')) return <h3 key={i} className="text-sm font-bold text-gray-800 mt-3 first:mt-0">{t.slice(3)}</h3>;
                if (t.startsWith('- ')) return <p key={i} className="pl-4">&bull; {t.slice(2)}</p>;
                return <p key={i}>{t}</p>;
              })}
            </div>
          </div>
        </div>
      )}
      {!accepted && (
        <label className="flex items-center gap-3 px-4 py-3.5 cursor-pointer border-t border-gray-100 bg-gray-50/70 select-none">
          <input type="checkbox" checked={accepted} onChange={e => e.target.checked && onAccept()}
            className="w-4 h-4 flex-shrink-0 accent-gray-900" />
          <span className="text-xs text-gray-600 font-medium flex-1 leading-snug">
            He leído y acepto el Aviso de Privacidad y los Términos de Uso
          </span>
        </label>
      )}
    </div>
  );
}

/* ── Completion Card ── */
function CompletionCard({
  companyName,
  proximaEtapa,
  etapaFinal,
}: {
  companyName: string;
  proximaEtapa: { nombre: string; descripcion?: string | null; icono: string; color: string; es_final: boolean } | null;
  etapaFinal: boolean;
}) {
  return (
    <div className="rounded-2xl overflow-hidden border border-emerald-200 bg-emerald-50">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-4">
        <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-200">
          <CheckCircle2 className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-black text-emerald-800">¡Documentación recibida!</p>
          <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
            El equipo de <span className="font-bold">{companyName}</span> revisará
            tu expediente y te contactará si necesitamos algo más.
          </p>
        </div>
      </div>

      {/* Next step */}
      <div className="border-t border-emerald-200 px-4 py-3 bg-white/60">
        {etapaFinal || !proximaEtapa ? (
          <div className="flex items-center gap-2">
            <span className="text-base">🎉</span>
            <p className="text-xs font-semibold text-gray-600">
              Tu proceso ha sido completado. ¡Gracias por tu confianza!
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2.5">
            <div className="flex-shrink-0 mt-0.5">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Próximo paso</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{ background: `${proximaEtapa.color}20`, color: proximaEtapa.color, border: `1px solid ${proximaEtapa.color}40` }}
                >
                  <span>{proximaEtapa.icono}</span>
                  <span>{proximaEtapa.nombre}</span>
                </span>
              </div>
              {proximaEtapa.descripcion && (
                <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{proximaEtapa.descripcion}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
