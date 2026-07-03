import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { FlyerTemplateA, FlyerTemplateB } from '../../components/flyers/FlyerTemplates';
import { QRCodeCanvas } from 'qrcode.react';
import { MessageSquare, Phone, Globe, ExternalLink, ShieldAlert, Sparkles, Share2, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PublicFlyerView() {
  const { id } = useParams<{ id: string }>();
  const [flyer, setFlyer] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) {
      fetchFlyer();
    }
  }, [id]);

  async function fetchFlyer() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('marketing_flyers')
        .select(`
          *,
          company:companies(id, name, logo_url, website, phone)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setFlyer(data);
    } catch (err: any) {
      console.error('Error fetching flyer:', err);
      setError(err.message || 'Error al cargar el flyer');
      toast.error('No se pudo cargar el flyer publicitario');
    } finally {
      setLoading(false);
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('¡Enlace copiado al portapapeles!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          <p className="text-slate-400 text-sm font-semibold tracking-wide animate-pulse">Cargando Flyer...</p>
        </div>
      </div>
    );
  }

  if (error || !flyer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full">
          <div className="w-16 h-16 bg-red-950/50 border border-red-500/30 text-red-400 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Flyer no disponible</h1>
          <p className="text-slate-400 mt-2 text-sm leading-relaxed">El enlace puede estar roto, expirado o el flyer ha sido eliminado.</p>
          {error && <p className="mt-4 text-xs text-red-500 font-mono bg-red-950/20 py-2 px-3 rounded-lg border border-red-950">ERROR: {error}</p>}
        </div>
      </div>
    );
  }

  // Parse Settings
  const settings = flyer.settings || {};
  const isA = flyer.template_id === 'A' || flyer.template_id === 'bold-split' || !flyer.template_id;
  const logoUrl = settings.logoPreview || flyer.company?.logo_url || '';

  // WhatsApp Configuration
  const wa = settings.whatsapp || {};
  const isWaEnabled = wa.enabled;
  const defaultNum = flyer.company?.phone || '';
  const targetNumber = wa.numberSource === 'custom' ? wa.customNumber : defaultNum;
  const cleanNumber = (targetNumber || '').replace(/[^\d+]/g, '');
  const waMessage = wa.message || 'Hola, estoy interesado en tu oferta.';
  const waLink = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(waMessage)}`;

  // QR settings
  const showQr = wa.showQr && isWaEnabled;
  const qrPosition = wa.qrPosition || 'bottom-right';

  // Format templates variables mapping
  const flyerData = {
    company_name: flyer.company?.name || 'Empresa',
    headline: settings.manualTitle || flyer.name,
    subheadline: settings.manualSubtitle || '',
    prompt: flyer.name || '',
    cta: settings.cta || 'CONTACTAR AHORA',
    price: settings.manualPrice || '',
    phone: targetNumber || settings.phone || flyer.company?.phone || '',
    email: settings.email || '',
    website: settings.website || flyer.company?.website || '',
    features: settings.manualFeatures?.filter((f: string) => f.trim().length > 0) || [],
    primaryColor: settings.colors?.[0] || '#7c3aed',
    secondaryColor: settings.colors?.[1] || '#0f172a',
    logoUrl: logoUrl,
    bgImageUrl: flyer.bg_image_url || '',
    // Customize fonts
    titleFont: settings.titleFont || 'Outfit',
    subtitleFont: settings.subtitleFont || 'Inter',
    benefitsFont: settings.benefitsFont || 'Inter',
    ctaFont: settings.ctaFont || 'Outfit',
    contactFont: settings.contactFont || 'Inter',
    // Custom Scales
    titleScale: settings.titleScale || 1.0,
    subtitleScale: settings.subtitleScale || 1.0,
    benefitsScale: settings.benefitsScale || 1.0,
    ctaScale: settings.ctaScale || 1.0,
    logoSize: settings.logoSize || 120,
    // Custom Colors
    titleColor: settings.titleColor || '#1e293b',
    highlightColor: settings.highlightColor || '#7c3aed',
    subtitleColor: settings.subtitleColor || '#475569',
    benefitsColor: settings.benefitsColor || '#334155',
    ctaBgColor: settings.ctaBgColor || '#7c3aed',
    ctaTextColor: settings.ctaTextColor || '#ffffff',
    contactColor: settings.contactColor || '#475569',
    cardBgColor: settings.cardBgColor || '#ffffff',
    // Positions
    logoX: settings.logoX ?? 50,
    logoY: settings.logoY ?? 10,
    textY: settings.textY ?? 30,
    textAlign: settings.textAlign || 'center'
  };

  // QR Position Styles overlayed on top of the relative flyer container (1080x1080)
  const getQrPositionStyle = () => {
    switch (qrPosition) {
      case 'bottom-left':
        return { bottom: '24px', left: '24px' };
      case 'bottom-right':
      default:
        return { bottom: '24px', right: '24px' };
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between pb-12 overflow-x-hidden relative font-sans">
      
      {/* Background blurred glow decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none opacity-30 select-none overflow-hidden">
        {flyer.bg_image_url ? (
          <div 
            className="w-full h-full bg-cover bg-center blur-[120px] scale-125"
            style={{ backgroundImage: `url(${flyer.bg_image_url})` }}
          />
        ) : (
          <div className="w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] mx-auto mt-[-200px]" />
        )}
      </div>

      {/* Header bar */}
      <header className="w-full max-w-6xl px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain max-w-[150px]" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
              {flyer.company?.name?.charAt(0) || 'F'}
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-100 leading-none tracking-tight">{flyer.company?.name || 'Empresa'}</span>
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-1">Oferta de Marketing</span>
          </div>
        </div>

        <button 
          onClick={handleCopyLink}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 transition-all text-xs font-semibold text-slate-200"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
          <span>{copied ? '¡Copiado!' : 'Compartir'}</span>
        </button>
      </header>

      {/* Main content: Responsive Flyer Box */}
      <main className="flex-1 flex flex-col items-center justify-center w-full px-4 sm:px-6 py-4 z-10 max-w-4xl">
        <div className="w-full bg-slate-900/60 backdrop-blur-md border border-slate-800/50 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col items-center">
          
          {/* Responsive Flyer Wrapper (Keeps Aspect Ratio 1:1, scales down dynamically) */}
          <div className="w-full max-w-[550px] aspect-square relative rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-white group select-none">
            
            {/* The scaled down template container (internal size is always 1080x1080) */}
            <div 
              className="absolute top-0 left-0 w-[1080px] h-[1080px] origin-top-left"
              style={{
                transform: 'scale(calc(100% / 1080))',
                width: '1080px',
                height: '1080px'
              }}
            >
              {isA ? (
                <FlyerTemplateA data={flyerData} />
              ) : (
                <FlyerTemplateB data={flyerData} />
              )}

              {/* QR Code Overlay (rendered natively inside the 1080px flyer design coordinate system) */}
              {showQr && (
                <div 
                  className="absolute p-3 bg-white rounded-xl shadow-2xl border border-slate-100 flex items-center justify-center"
                  style={{
                    width: '130px',
                    height: '130px',
                    zIndex: 40,
                    ...getQrPositionStyle()
                  }}
                >
                  <QRCodeCanvas 
                    value={waLink} 
                    size={106} 
                    level="H"
                    includeMargin={false}
                  />
                </div>
              )}
            </div>

          </div>

          {/* Business Info Block below Flyer */}
          <div className="w-full max-w-[550px] mt-6 flex flex-col gap-4 text-center sm:text-left bg-slate-950/40 border border-slate-900 p-5 rounded-2xl">
            <h3 className="text-base font-bold text-slate-200">
              Sobre esta oferta
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Esta es una promoción oficial de <strong className="text-slate-200">{flyer.company?.name || 'la empresa'}</strong>. Puedes escanear el código QR del flyer o hacer clic en el botón de WhatsApp abajo para iniciar una conversación directa.
            </p>
            <div className="flex flex-wrap gap-4 justify-center sm:justify-start text-xs font-semibold text-slate-300 pt-2 border-t border-slate-900/60">
              {targetNumber && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{targetNumber}</span>
                </div>
              )}
              {flyer.company?.website && (
                <a 
                  href={flyer.company.website.startsWith('http') ? flyer.company.website : `https://${flyer.company.website}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-indigo-400 transition-colors"
                >
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{flyer.company.website.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Floating Green WhatsApp CTA (Highly Optimized) */}
      {isWaEnabled && (
        <div className="w-full max-w-md px-6 mt-6 z-20">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-900/40 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 animate-pulse"
            style={{ animationDuration: '3s' }}
          >
            <MessageSquare className="w-5 h-5 fill-white" />
            <span>{settings.cta || 'Contactar por WhatsApp'}</span>
          </a>
        </div>
      )}
    </div>
  );
}
