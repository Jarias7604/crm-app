import React from 'react';
import { X, Loader2, FolderOpen, Image, Check, Edit2, Trash2, BarChart3, Info, Target, Eye, Zap, Award, Send, Type } from 'lucide-react';
import { FORMATS, css } from './constants';

export interface SaveFlyerModalProps {
  isOpen: boolean;
  onClose: () => void;
  designName: string;
  onChangeDesignName: (name: string) => void;
  loadedFlyerId: string | null;
  savingFlyer: boolean;
  onSaveFlyer: (name: string, overwrite: boolean) => void;
}

export const SaveFlyerModal: React.FC<SaveFlyerModalProps> = ({
  isOpen,
  onClose,
  designName,
  onChangeDesignName,
  loadedFlyerId,
  savingFlyer,
  onSaveFlyer,
}) => {
  if (!isOpen) return null;

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
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 24,
          border: '1px solid #e2e8f0',
          width: '100%',
          maxWidth: 420,
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.15)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '24px 24px 16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: 0 }}>Guardar Diseño</h3>
            <p style={{ fontSize: 10, color: '#64748b', margin: '4px 0 0 0' }}>Dale un nombre descriptivo a tu publicidad</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(0,0,0,0.04)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={14} color="#0f172a" />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Nombre del diseño
            </label>
            <input
              type="text"
              value={designName}
              onChange={(e) => onChangeDesignName(e.target.value)}
              placeholder={`Ej: Flyer Oferta Verano ${new Date().toLocaleDateString()}`}
              style={{ ...css.input, height: 42 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveFlyer(designName, !!loadedFlyerId);
              }}
              autoFocus
            />
          </div>
        </div>

        <div style={{ padding: '16px 24px 24px 24px', background: '#f8fafc', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
          <button
            onClick={onClose}
            style={{ background: '#fff', border: '1px solid #d8dde6', borderRadius: 10, padding: '10px 16px', fontSize: 12, fontWeight: 800, color: '#475569', cursor: 'pointer' }}
          >
            Cancelar
          </button>
          {loadedFlyerId ? (
            <>
              <button
                onClick={() => onSaveFlyer(designName, false)}
                disabled={savingFlyer}
                style={{
                  background: '#fff',
                  border: '1px solid #ddd6fe',
                  borderRadius: 10,
                  padding: '10px 16px',
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#7c3aed',
                  cursor: savingFlyer ? 'not-allowed' : 'pointer',
                }}
              >
                Guardar como Copia
              </button>
              <button
                onClick={() => onSaveFlyer(designName, true)}
                disabled={savingFlyer}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 16px',
                  fontSize: 12,
                  fontWeight: 850,
                  color: '#fff',
                  cursor: savingFlyer ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                }}
              >
                {savingFlyer ? (
                  <>
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...
                  </>
                ) : (
                  'Actualizar Existente'
                )}
              </button>
            </>
          ) : (
            <button
              onClick={() => onSaveFlyer(designName, false)}
              disabled={savingFlyer}
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                border: 'none',
                borderRadius: 10,
                padding: '10px 20px',
                fontSize: 12,
                fontWeight: 850,
                color: '#fff',
                cursor: savingFlyer ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)',
              }}
            >
              {savingFlyer ? (
                <>
                  <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export interface FlyerGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  savedFlyers: any[];
  editingFlyerId: string | null;
  editingFlyerName: string;
  onStartRename: (flyerId: string, currentName: string) => void;
  onChangeEditingName: (name: string) => void;
  onCancelRename: () => void;
  onConfirmRename: (flyerId: string, newName: string) => void;
  onLoadFlyer: (flyer: any) => void;
  onDeleteFlyer: (flyerId: string) => void;
}

export const FlyerGalleryModal: React.FC<FlyerGalleryModalProps> = ({
  isOpen,
  onClose,
  loading,
  savedFlyers,
  editingFlyerId,
  editingFlyerName,
  onStartRename,
  onChangeEditingName,
  onCancelRename,
  onConfirmRename,
  onLoadFlyer,
  onDeleteFlyer,
}) => {
  if (!isOpen) return null;

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
        padding: 20,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 28,
          border: '1px solid #e2e8f0',
          width: '100%',
          maxWidth: 880,
          maxHeight: '85vh',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(15, 23, 42, 0.2)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FolderOpen size={20} color="#7c3aed" /> Mis Diseños Guardados
            </h3>
            <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0 0' }}>Historial de flyers y plantillas personalizadas de tu empresa</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(0,0,0,0.04)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} color="#0f172a" />
          </button>
        </div>

        <div style={{ padding: 28, overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 12 }}>
              <Loader2 size={36} color="#7c3aed" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>Cargando tus diseños...</span>
            </div>
          ) : savedFlyers.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 40px', gap: 12, textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <FolderOpen size={24} color="#7c3aed" />
              </div>
              <h4 style={{ fontSize: 15, fontWeight: 900, color: '#334155', margin: 0 }}>No tienes diseños guardados</h4>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0, maxWidth: 300 }}>Personaliza cualquier plantilla en el canvas y haz clic en "Guardar Diseño" en la barra superior.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
              {savedFlyers.map((flyer) => {
                const parsedDate = new Date(flyer.created_at).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const aspectLabel = FORMATS.find((f) => f.id === flyer.format)?.label || flyer.format;

                return (
                  <div
                    key={flyer.id}
                    style={{
                      background: '#fff',
                      borderRadius: 20,
                      border: '1px solid #e2e8f0',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        height: 180,
                        background: '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                        borderBottom: '1px solid #f1f5f9',
                      }}
                    >
                      {flyer.thumbnail_url ? (
                        <img src={flyer.thumbnail_url} alt={flyer.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#94a3b8' }}>
                          <Image size={24} />
                          <span style={{ fontSize: 9, fontWeight: 700 }}>Sin vista previa</span>
                        </div>
                      )}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 8,
                          left: 8,
                          background: 'rgba(15, 23, 42, 0.75)',
                          backdropFilter: 'blur(4px)',
                          borderRadius: 6,
                          padding: '3px 6px',
                          fontSize: 8,
                          fontWeight: 800,
                          color: '#fff',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {aspectLabel}
                      </div>
                    </div>

                    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                      <div style={{ marginBottom: 12 }}>
                        {editingFlyerId === flyer.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                            <input
                              type="text"
                              value={editingFlyerName}
                              onChange={(e) => onChangeEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') onConfirmRename(flyer.id, editingFlyerName);
                                if (e.key === 'Escape') onCancelRename();
                              }}
                              style={{
                                fontSize: 12,
                                fontWeight: 800,
                                color: '#1e293b',
                                border: '1px solid #7c3aed',
                                borderRadius: 6,
                                padding: '3px 8px',
                                width: '100%',
                                outline: 'none',
                                background: '#fff',
                                boxSizing: 'border-box',
                              }}
                              autoFocus
                            />
                            <button
                              onClick={() => onConfirmRename(flyer.id, editingFlyerName)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: '#10b981' }}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={onCancelRename}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: '#ef4444' }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
                            <h4
                              style={{ fontSize: 13, fontWeight: 900, color: '#1e293b', margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                              title={flyer.name}
                            >
                              {flyer.name}
                            </h4>
                            <button
                              onClick={() => onStartRename(flyer.id, flyer.name)}
                              title="Editar nombre"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: '#94a3b8', transition: 'color 0.15s ease' }}
                            >
                              <Edit2 size={11} />
                            </button>
                          </div>
                        )}
                        <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>Creado: {parsedDate}</div>
                        <div style={{ fontSize: 9, color: '#7c3aed', fontWeight: 700, marginTop: 4 }}>
                          Plantilla: {flyer.template_id === 'A' ? 'Glow Glassmorphic' : flyer.template_id === 'B' ? 'Editorial Showcase' : flyer.template_id}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                        <button
                          onClick={() => onLoadFlyer(flyer)}
                          style={{
                            flex: 1,
                            background: '#f5f3ff',
                            border: '1px solid #ddd6fe',
                            borderRadius: 8,
                            padding: '7px 0',
                            fontSize: 11,
                            fontWeight: 800,
                            color: '#7c3aed',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <FolderOpen size={12} />
                          Cargar y Editar
                        </button>
                        <button
                          onClick={() => onDeleteFlyer(flyer.id)}
                          style={{
                            width: 28,
                            height: 28,
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#ef4444',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 28px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ background: '#fff', border: '1px solid #d8dde6', borderRadius: 10, padding: '8px 16px', fontSize: 11, fontWeight: 800, color: '#475569', cursor: 'pointer' }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export interface AidaMethodologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AidaMethodologyModal: React.FC<AidaMethodologyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

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
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 20,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={15} color="#3b82f6" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Metodología AIDA
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} color="#64748b" />
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18, maxHeight: '80vh', overflowY: 'auto' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Info size={14} color="#6366f1" />
              Rigor y Metodología
            </div>
            <p style={{ margin: 0, fontSize: 11, color: '#475569', lineHeight: 1.6, textAlign: 'justify' }}>
              Evaluamos tu brief utilizando una fórmula matemática basada en las mejores prácticas de la industria y la psicología de conversión de la metodología AIDA. Estudios globales de publicidad digital demuestran que estructurar tus textos con estos parámetros clave (Atención, Interés, Deseo y Acción) optimiza la retención del usuario y puede incrementar la conversión en hasta un <strong>400%</strong> frente a copias sin estructura.
            </p>
          </div>

          <div style={{ height: '1px', background: '#f1f5f9' }} />

          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Target size={14} color="#6366f1" />
              Estructura del Score de Viralidad
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <Eye size={12} color="#16a34a" />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#1f2937' }}>Atención (A - 18 pts)</div>
                  <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
                    Presencia de precios, descuentos claros u ofertas específicas (ej: <em>$12.95, 30% OFF</em>) para captar la mirada del usuario.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <Zap size={12} color="#d97706" />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#1f2937' }}>Interés (I - 20 pts)</div>
                  <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
                    Palabras de urgencia y disparadores de escasez (ej: <em>hoy, oferta limitada, solo esta semana</em>) para retener la atención.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <Award size={12} color="#7c3aed" />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#1f2937' }}>Deseo (D - 15 pts)</div>
                  <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
                    Exposición estructurada de beneficios clave y propuesta de valor clara (ej: <em>incluye, ofrece, contiene</em>).
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <Send size={12} color="#059669" />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#1f2937' }}>Acción (A - 18 pts)</div>
                  <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
                    Llamada a la Acción (CTA) explícita (10 pts) junto con datos de contacto o URL claros (8 pts) para canalizar la conversión.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <Type size={12} color="#0284c7" />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#1f2937' }}>Longitud y Datos (29 pts)</div>
                  <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
                    Rango de caracteres óptimo (80-400 chars: 15 pts), inclusión de números o datos (9 pts) y formato estructurado (5 pts).
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: '#0f172a',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '8px 16px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#1e293b')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#0f172a')}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
