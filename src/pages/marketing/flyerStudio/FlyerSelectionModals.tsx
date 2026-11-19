import React from 'react';
import { X, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { RenderFlyer, TEMPLATE_LIST, type FlyerData } from '../FlyerTemplates';
import { FORMATS, TONES, DEFAULT_BG_IMAGE, css } from './constants';

export interface FormatSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  format: string;
  onSelectFormat: (formatId: string) => void;
}

export const FormatSelectionModal: React.FC<FormatSelectionModalProps> = ({
  isOpen,
  onClose,
  format,
  onSelectFormat,
}) => {
  if (!isOpen) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 20,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
          width: '100%',
          maxWidth: 440,
          display: 'flex',
          flexDirection: 'column',
          animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Selecciona Formato
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={16} color="#64748b" />
          </button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FORMATS.map((f) => {
            const IconComponent = f.icon;
            const active = format === f.id;
            return (
              <button
                key={f.id}
                onClick={() => {
                  onSelectFormat(f.id);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: `1.5px solid ${active ? '#7c3aed' : '#e2e8f0'}`,
                  background: active ? '#7c3aed0a' : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <IconComponent size={18} color={active ? '#7c3aed' : '#64748b'} />
                  <span style={{ fontSize: 13, fontWeight: active ? 800 : 600, color: '#0f172a' }}>{f.label}</span>
                </div>
                <span style={{ fontSize: 11, color: active ? '#7c3aed' : '#94a3b8', fontWeight: 700 }}>{f.tag}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export interface ToneSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tone: string;
  onSelectTone: (toneKey: string) => void;
}

export const ToneSelectionModal: React.FC<ToneSelectionModalProps> = ({
  isOpen,
  onClose,
  tone,
  onSelectTone,
}) => {
  if (!isOpen) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 20,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
          width: '100%',
          maxWidth: 440,
          display: 'flex',
          flexDirection: 'column',
          animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Selecciona Tono
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={16} color="#64748b" />
          </button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {TONES.map((t) => {
            const IconComponent = t.icon;
            const active = tone === t.key;
            return (
              <button
                key={t.key}
                onClick={() => {
                  onSelectTone(t.key);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: `1.5px solid ${active ? '#0070d2' : '#e2e8f0'}`,
                  background: active ? '#0070d20a' : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <IconComponent size={18} color={active ? '#0070d2' : t.color} />
                  <span style={{ fontSize: 13, fontWeight: active ? 800 : 600, color: '#0f172a' }}>{t.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export interface BrandColorPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customHex: string;
  onChangeCustomHex: (hex: string) => void;
  onApplyColor: (hex: string) => void;
}

export const BrandColorPickerModal: React.FC<BrandColorPickerModalProps> = ({
  isOpen,
  onClose,
  customHex,
  onChangeCustomHex,
  onApplyColor,
}) => {
  if (!isOpen) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 20,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
          width: '100%',
          maxWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Color Personalizado
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={16} color="#64748b" />
          </button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="color"
              value={customHex}
              onChange={(e) => onChangeCustomHex(e.target.value)}
              style={{
                width: 50,
                height: 50,
                padding: 0,
                border: '1px solid #d8dde6',
                cursor: 'pointer',
                borderRadius: 8,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <label style={{ ...css.label, marginBottom: 4 }}>Código HEX</label>
              <input
                type="text"
                placeholder="#000000"
                value={customHex}
                onChange={(e) => onChangeCustomHex(e.target.value)}
                style={{ ...css.input, textTransform: 'uppercase' }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              let validHex = customHex.trim();
              if (!validHex.startsWith('#')) {
                validHex = '#' + validHex;
              }
              if (/^#[0-9A-F]{6}$/i.test(validHex)) {
                onApplyColor(validHex);
                onClose();
              } else {
                toast.error('Código HEX inválido. Usa el formato #RRGGBB');
              }
            }}
            style={{ ...css.btn, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}
          >
            Aplicar Color de Marca
          </button>
        </div>
      </div>
    </div>
  );
};

export interface TemplateCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvasH: number;
  selectedTemplate: string;
  onSelectTemplate: (templateId: string) => void;
  bgPhotoUrl: string | null;
  previewBaseData: Omit<FlyerData, 'bgImageUrl' | 'bgType' | 'templateId'>;
}

export const TemplateCatalogModal: React.FC<TemplateCatalogModalProps> = ({
  isOpen,
  onClose,
  canvasH,
  selectedTemplate,
  onSelectTemplate,
  bgPhotoUrl,
  previewBaseData,
}) => {
  if (!isOpen) return null;

  const ratio = canvasH / 1080;
  const fitW = ratio > 1.3 ? 120 : 155;
  const fitH = Math.round(fitW * ratio);
  const sc = fitW / 1080;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 24,
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.18)',
          width: '95%',
          maxWidth: 880,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <div>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Catálogo de Plantillas
            </span>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
              Selecciona el diseño base para tu flyer (se actualiza con tus datos en tiempo real)
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color="#64748b" />
          </button>
        </div>

        <div className="flyer-studio-col" style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
              Plantillas Modernas Seleccionadas
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {TEMPLATE_LIST.map((t) => {
                const active = selectedTemplate === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => onSelectTemplate(t.id)}
                    style={{
                      textAlign: 'left',
                      padding: 0,
                      borderRadius: 16,
                      border: `2px solid ${active ? '#7c3aed' : '#f1f5f9'}`,
                      background: '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      width: '100%',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: active
                        ? '0 10px 25px -5px rgba(124, 58, 237, 0.15)'
                        : '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)',
                      transform: 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 12px 20px -5px rgba(0,0,0,0.08)';
                      if (!active) e.currentTarget.style.borderColor = '#ddd6fe';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = active
                        ? '0 10px 25px -5px rgba(124, 58, 237, 0.15)'
                        : '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)';
                      if (!active) e.currentTarget.style.borderColor = '#f1f5f9';
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: 200,
                        background: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderBottom: '1px solid #f1f5f9',
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          width: fitW,
                          height: fitH,
                          position: 'relative',
                          overflow: 'hidden',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                          borderRadius: 8,
                          background: '#fff',
                          flexShrink: 0,
                        }}
                      >
                        <div style={{ transform: `scale(${sc})`, transformOrigin: 'top left', width: 1080, height: canvasH, pointerEvents: 'none' }}>
                          <RenderFlyer
                            d={{
                              ...previewBaseData,
                              bgImageUrl: t.id === 'vibrant-gradient' ? null : bgPhotoUrl || DEFAULT_BG_IMAGE,
                              bgType: t.id === 'vibrant-gradient' ? 'gradient' : 'photo',
                              templateId: t.id,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 850, color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>{t.name}</span>
                          {active && (
                            <span
                              style={{
                                background: '#7c3aed',
                                color: '#fff',
                                fontSize: 8,
                                padding: '2px 6px',
                                borderRadius: 8,
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                              }}
                            >
                              Activa
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 9, color: '#64748b', marginTop: 4, lineHeight: 1.3 }}>{t.desc}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface FreePhotoSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  photosPool: string[];
  photoIndex: number;
  onChangePhotoIndex: React.Dispatch<React.SetStateAction<number>>;
  onApplyPhoto: (photoUrl: string) => void;
}

export const FreePhotoSelectorModal: React.FC<FreePhotoSelectorModalProps> = ({
  isOpen,
  onClose,
  photosPool,
  photoIndex,
  onChangePhotoIndex,
  onApplyPhoto,
}) => {
  if (!isOpen || photosPool.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 24,
          border: '1px solid #e2e8f0',
          width: '100%',
          maxWidth: 540,
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '20px 24px 16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Generador Gratis</span>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: '2px 0 0 0' }}>Elige una Imagen Temática</h3>
            <p style={{ fontSize: 10, color: '#64748b', margin: '4px 0 0 0' }}>Selecciona entre 15 fotos premium para usar en tu flyer</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(0,0,0,0.04)',
              border: 'none',
              borderRadius: '50%',
              width: 28,
              height: 28,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
          >
            <X size={14} color="#0f172a" />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <div
            style={{
              width: '100%',
              height: 320,
              background: '#0f172a',
              borderRadius: 16,
              position: 'relative',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img src={photosPool[photoIndex]} alt={`Preview ${photoIndex + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />

            <button
              type="button"
              onClick={() => onChangePhotoIndex((prev) => (prev === 0 ? photosPool.length - 1 : prev - 1))}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.9)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                transition: 'all 0.2s',
                zIndex: 10,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)';
                e.currentTarget.style.background = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.9)';
              }}
            >
              <ChevronLeft size={18} color="#0f172a" />
            </button>

            <button
              type="button"
              onClick={() => onChangePhotoIndex((prev) => (prev === photosPool.length - 1 ? 0 : prev + 1))}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.9)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                transition: 'all 0.2s',
                zIndex: 10,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)';
                e.currentTarget.style.background = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.9)';
              }}
            >
              <ChevronRight size={18} color="#0f172a" />
            </button>

            <div
              style={{
                position: 'absolute',
                bottom: 12,
                right: 12,
                background: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(4px)',
                color: '#ffffff',
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 10,
                fontWeight: 700,
                zIndex: 10,
              }}
            >
              Foto {photoIndex + 1} de {photosPool.length}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Todas las opciones ({photosPool.length})
            </span>
            <div className="flyer-studio-col" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0', width: '100%', scrollbarWidth: 'thin' }}>
              {photosPool.map((img, idx) => {
                const active = idx === photoIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onChangePhotoIndex(idx)}
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 10,
                      border: `2px solid ${active ? '#7c3aed' : '#e2e8f0'}`,
                      padding: 0,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                      opacity: active ? 1 : 0.65,
                      transform: active ? 'scale(1.05)' : 'none',
                      boxShadow: active ? '0 4px 10px rgba(124,58,237,0.15)' : 'none',
                    }}
                  >
                    <img src={img} alt={`Thumb ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 24px 20px 24px', background: '#f8fafc', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ background: '#fff', border: '1px solid #d8dde6', borderRadius: 10, padding: '10px 16px', fontSize: 12, fontWeight: 800, color: '#475569', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onApplyPhoto(photosPool[photoIndex])}
            style={{
              background: '#7c3aed',
              border: 'none',
              borderRadius: 10,
              padding: '10px 18px',
              fontSize: 12,
              fontWeight: 800,
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(124,58,237,0.2)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#6d28d9';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#7c3aed';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <Plus size={14} style={{ marginRight: 6 }} />
            Aplicar esta Foto
          </button>
        </div>
      </div>
    </div>
  );
};
