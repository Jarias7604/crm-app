import React from 'react';
import { FlyerTemplateA, FlyerTemplateB } from '../../components/flyers/FlyerTemplates';

export default function TestFlyer() {
  const dummyData = {
    company_name: 'Tech Solutions SA',
    prompt: 'Título: Sistema de Gestión Increíble. Subtítulo: La mejor plataforma para tu negocio con características impresionantes. Beneficios: Facturación Electrónica en segundos, Control de Clientes Avanzado, Reportes en Tiempo Real detallados, Inventario y Bodega automático. Precio: $49.99/mes. Contacto: +503 1234-5678.',
    cta: 'COMIENZA AHORA MISMO',
    primaryColor: '#0ea5e9',
    secondaryColor: '#0f172a',
    logoUrl: '',
    bgImageUrl: '', // Primero probaremos sin fondo IA para ver si el laptop se monta
  };

  const dummyDataAI = {
    ...dummyData,
    bgImageUrl: 'https://images.unsplash.com/photo-1555597673-b21d5c935865?auto=format&fit=crop&w=1080&q=80',
    prompt: 'Título: Software DTE Facturación Electrónica. Subtítulo: La solución más rápida para emitir facturas electrónicas en El Salvador. Beneficios: Facturación Electrónica en segundos, Integración con Hacienda, Control de Clientes y Leads, Soporte 24/7. Precio: $49.99/mes. Contacto: +503 7197-8911.'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', padding: '40px', background: '#e2e8f0', minHeight: '100vh' }}>
      <div>
        <h2 style={{ fontFamily: 'sans-serif', marginBottom: 20 }}>Template A (No AI Bg)</h2>
        <div style={{ transform: 'scale(0.4)', transformOrigin: 'top left', width: 1080, height: 1080 }}>
          <FlyerTemplateA data={dummyData} />
        </div>
      </div>
      <div>
        <h2 style={{ fontFamily: 'sans-serif', marginBottom: 20 }}>Template A (With AI Bg)</h2>
        <div style={{ transform: 'scale(0.4)', transformOrigin: 'top left', width: 1080, height: 1080 }}>
          <FlyerTemplateA data={dummyDataAI} />
        </div>
      </div>
      <div>
        <h2 style={{ fontFamily: 'sans-serif', marginBottom: 20 }}>Template B (No AI Bg)</h2>
        <div style={{ transform: 'scale(0.4)', transformOrigin: 'top left', width: 1080, height: 1080 }}>
          <FlyerTemplateB data={dummyData} />
        </div>
      </div>
      <div>
        <h2 style={{ fontFamily: 'sans-serif', marginBottom: 20 }}>Template B (With AI Bg)</h2>
        <div style={{ transform: 'scale(0.4)', transformOrigin: 'top left', width: 1080, height: 1080 }}>
          <FlyerTemplateB data={dummyDataAI} />
        </div>
      </div>
    </div>
  );
}
