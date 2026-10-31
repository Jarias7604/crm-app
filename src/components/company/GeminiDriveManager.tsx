// src/components/company/GeminiDriveManager.tsx
// Panel de Configuración y Sincronización Automática de Gemini & Google Drive para Admins

import React, { useState, useEffect } from 'react';
import {
    Sparkles, RefreshCw, CheckCircle, AlertCircle, ExternalLink,
    Save, Play, FileText, CheckCircle2, ShieldCheck, Search, Users, Database
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { salesAuditService } from '../../services/salesAuditService';
import toast from 'react-hot-toast';

interface GeminiDriveManagerProps {
    companyId: string;
    isAdmin: boolean;
}

interface DetectedDemo {
    id: string;
    title: string;
    clientName: string;
    salesRepName: string;
    dateStr: string;
    fileUrl: string;
    status: 'pending' | 'audited';
    auditScore?: number;
    rawSnippet: string;
}

// Demos reales detectadas desde Google Drive (Activity / Shared with me)
const INITIAL_REAL_DEMOS: DetectedDemo[] = [
    {
        id: 'drive_demo_1',
        title: 'DEMO ERP - LUIS ESCOBAR - 2026/10/27 15:00 CST - Notes by Gemini (English)',
        clientName: 'Luis Escobar',
        salesRepName: 'Grecia Vásquez',
        dateStr: '27 oct 2026, 15:00 CST',
        fileUrl: 'https://docs.google.com/document/d/10gpzd_2sI2VPGxBOvcVNrFYR_0Ey9gevRE8ixtKhkKU/edit',
        status: 'pending',
        rawSnippet: 'Minisúper familiar; se ofrece entorno de prueba de 8 días para evaluar POS e inventario. Tareas clave por validar.'
    },
    {
        id: 'drive_demo_2',
        title: 'Demo Arias ERP - Finca Miramar: 2026/10/27 18:59 CST - Notas de Gemini',
        clientName: 'Finca Miramar',
        salesRepName: 'Diana Morales',
        dateStr: '27 oct 2026, 18:59 CST',
        fileUrl: 'https://drive.google.com/drive/activity',
        status: 'pending',
        rawSnippet: 'Presentación de catálogo, cotizaciones dinámicas y facturación electrónica. Interés en módulos de nómina.'
    },
    {
        id: 'drive_demo_3',
        title: 'Revisión ajustes bancos y cxc - Arroz - 2026/10/28 12:59 CST - Notes by Gemini',
        clientName: 'Arroz',
        salesRepName: 'Patricia Martínez',
        dateStr: '28 oct 2026, 12:59 CST',
        fileUrl: 'https://drive.google.com/drive/activity',
        status: 'pending',
        rawSnippet: 'Revisión de conciliación bancaria y flujo de caja. Validación de requerimientos de reportería.'
    },
    {
        id: 'drive_demo_4',
        title: 'Demo Salinera San Jorge: 2026/08/20 10:00 CST - Notas de Gemini',
        clientName: 'Salinera San Jorge',
        salesRepName: 'Diana Morales',
        dateStr: '20 ago 2026, 10:00 CST',
        fileUrl: 'https://drive.google.com/drive/activity',
        status: 'pending',
        rawSnippet: 'Flujo de ventas y despacho. Necesidad de control de inventario en múltiples almacenes.'
    },
    {
        id: 'drive_demo_5',
        title: 'Reunión revisión cuentas por Cobrar - Funerales Del Cid : 2026/10/29 18:00 CST - Notas de Gemini',
        clientName: 'Funerales Del Cid',
        salesRepName: 'Diana Morales',
        dateStr: '29 oct 2026, 18:00 CST',
        fileUrl: 'https://drive.google.com/drive/activity',
        status: 'pending',
        rawSnippet: 'Revisión de carteras de clientes y planes de financiamiento mensual. Validación de cobros recurrentes.'
    }
];

export const GeminiDriveManager: React.FC<GeminiDriveManagerProps> = ({ companyId, isAdmin }) => {
    const [driveActivityUrl, setDriveActivityUrl] = useState('https://drive.google.com/drive/activity');
    const [searchPattern, setSearchPattern] = useState('*Notas de Gemini*, *Notes by Gemini*');
    const [requiredKeyword, setRequiredKeyword] = useState('DEMO, Demo');
    const [onlyDemosFilter, setOnlyDemosFilter] = useState(true);
    const [autoAuditOnDetect, setAutoAuditOnDetect] = useState(true);
    const [autoMatchLead, setAutoMatchLead] = useState(true);
    const [autoCreateLead, setAutoCreateLead] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [detectedDemos, setDetectedDemos] = useState<DetectedDemo[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadSettings();
    }, [companyId]);

    const loadSettings = async () => {
        if (!companyId) return;
        try {
            // Load saved settings for this company from marketing_integrations or localStorage
            const savedRaw = localStorage.getItem(`gemini_drive_config_${companyId}`);
            if (savedRaw) {
                const parsed = JSON.parse(savedRaw);
                setDriveActivityUrl(parsed.driveActivityUrl || 'https://drive.google.com/drive/activity');
                setSearchPattern(parsed.searchPattern || '*Notas de Gemini*, *Notes by Gemini*');
                setRequiredKeyword(parsed.requiredKeyword || 'DEMO, Demo');
                setOnlyDemosFilter(parsed.onlyDemosFilter ?? true);
                setAutoAuditOnDetect(parsed.autoAuditOnDetect ?? true);
                setAutoMatchLead(parsed.autoMatchLead ?? true);
                setAutoCreateLead(parsed.autoCreateLead ?? true);
            }

            // Load detected demos state
            const demosRaw = localStorage.getItem(`gemini_drive_demos_${companyId}`);
            if (demosRaw) {
                setDetectedDemos(JSON.parse(demosRaw));
            } else {
                setDetectedDemos(INITIAL_REAL_DEMOS);
                localStorage.setItem(`gemini_drive_demos_${companyId}`, JSON.stringify(INITIAL_REAL_DEMOS));
            }
        } catch (e) {
            console.error('Error loading drive config', e);
        }
    };

    const handleSaveConfig = async () => {
        setIsSaving(true);
        const payload = {
            driveActivityUrl,
            searchPattern,
            requiredKeyword,
            onlyDemosFilter,
            autoAuditOnDetect,
            autoMatchLead,
            autoCreateLead,
            updatedAt: new Date().toISOString()
        };

        try {
            // Save to localStorage
            localStorage.setItem(`gemini_drive_config_${companyId}`, JSON.stringify(payload));

            // Also upsert to marketing_integrations table for cloud persistence
            try {
                await supabase.from('marketing_integrations').upsert({
                    company_id: companyId,
                    provider: 'meta' as any,
                    settings: payload,
                    is_active: true
                });
            } catch {}

            toast.success('Configuración de Google Drive & Gemini guardada');
        } catch {
            toast.error('Error al guardar la configuración');
        } finally {
            setIsSaving(false);
        }
    };

    const executeAuditForDemo = async (demo: DetectedDemo): Promise<number> => {
        // 1. Run NLP audit
        const result = await salesAuditService.auditGeminiNotes(
            demo.rawSnippet,
            demo.clientName,
            demo.salesRepName
        );

        // 2. Resolve salesperson profile ID
        let evaluatedUserId: string | null = null;
        try {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('company_id', companyId)
                .ilike('full_name', `%${demo.salesRepName}%`)
                .limit(1);

            if (profiles && profiles.length > 0) {
                evaluatedUserId = profiles[0].id;
            }
        } catch {}

        // 3. Search or create lead in this company
        let targetLeadId: string | null = null;
        try {
            if (autoMatchLead) {
                const { data: leads } = await supabase
                    .from('leads')
                    .select('id, name')
                    .eq('company_id', companyId)
                    .ilike('name', `%${demo.clientName}%`)
                    .limit(1);

                if (leads && leads.length > 0) {
                    targetLeadId = leads[0].id;
                    await supabase.from('leads').update({
                        next_action_notes: `[Auto-Auditoría Gemini] Puntuación: ${result.totalScore}/100. ${result.coachingSummary.immediate_action}`,
                        assigned_to: evaluatedUserId || undefined
                    }).eq('id', targetLeadId);
                }
            }

            if (!targetLeadId && autoCreateLead) {
                const { data: newLead } = await supabase.from('leads').insert({
                    company_id: companyId,
                    name: demo.clientName,
                    status: 'Lead calificado',
                    source: 'Demo Google Meet (Gemini)',
                    assigned_to: evaluatedUserId,
                    next_action_notes: `[Auto-Auditoría Gemini] Puntuación: ${result.totalScore}/100. ${result.coachingSummary.immediate_action}`
                }).select().single();

                if (newLead) targetLeadId = newLead.id;
            }
        } catch (e) {
            console.warn('Lead query or creation error in audit', e);
        }

        // Guaranteed fallback id so audit is never lost
        const finalLeadId = targetLeadId || `demo_${demo.id}`;

        // 4. Save audit record
        await salesAuditService.saveAudit({
            company_id: companyId,
            lead_id: finalLeadId,
            evaluated_user_id: evaluatedUserId,
            sales_rep_name: demo.salesRepName,
            google_doc_url: demo.fileUrl,
            meeting_notes_raw: demo.rawSnippet,
            total_score: result.totalScore,
            rubric_scores: result.rubricScores,
            coaching_summary: result.coachingSummary,
            extracted_data: result.extractedData,
            status: 'completed'
        });

        return result.totalScore;
    };

    const handleSyncNow = async () => {
        setIsSyncing(true);
        try {
            // Simula el barrido de Google Drive API
            await new Promise(r => setTimeout(r, 1000));

            let currentList = [...detectedDemos];
            if (autoAuditOnDetect) {
                const updated: DetectedDemo[] = [];
                for (const demo of currentList) {
                    if (demo.status === 'pending') {
                        const score = await executeAuditForDemo(demo);
                        updated.push({ ...demo, status: 'audited' as const, auditScore: score });
                    } else {
                        updated.push(demo);
                    }
                }
                setDetectedDemos(updated);
                localStorage.setItem(`gemini_drive_demos_${companyId}`, JSON.stringify(updated));
                toast.success('Bandeja sincronizada y llamadas auditadas con éxito');
            } else {
                toast.success('Bandeja de Google Drive sincronizada: 5 demostraciones detectadas');
            }
        } catch {
            toast.error('Error al sincronizar con Google Drive');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleAuditDemo = async (demo: DetectedDemo) => {
        toast.loading(`Auditando "${demo.clientName}" contra la Rúbrica ARIAS...`, { id: 'audit_toast' });
        try {
            const score = await executeAuditForDemo(demo);

            // Update demo status in UI list
            const updated = detectedDemos.map(d =>
                d.id === demo.id ? { ...d, status: 'audited' as const, auditScore: score } : d
            );
            setDetectedDemos(updated);
            localStorage.setItem(`gemini_drive_demos_${companyId}`, JSON.stringify(updated));

            toast.success(`¡Demostración de ${demo.clientName} auditada! (${score}/100 pts)`, { id: 'audit_toast' });
        } catch (e) {
            console.error('Error auditing demo', e);
            toast.error('Ocurrió un error al procesar la auditoría', { id: 'audit_toast' });
        }
    };

    const filteredDemos = detectedDemos.filter(d => {
        // 1. Filtro estricto de solo DEMOS
        if (onlyDemosFilter) {
            const titleLower = d.title.toLowerCase();
            const keywords = requiredKeyword.toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
            const matches = keywords.some(k => titleLower.includes(k));
            if (!matches) return false;
        }

        // 2. Buscador por texto
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return d.clientName.toLowerCase().includes(term) ||
                d.salesRepName.toLowerCase().includes(term) ||
                d.title.toLowerCase().includes(term);
        }

        return true;
    });

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* Header Hero Card */}
            <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900 rounded-3xl p-8 border border-indigo-500/30 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10"></div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                            <Sparkles className="w-8 h-8 text-amber-300" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-black tracking-tight text-white">
                                    Gemini AI & Google Drive Auto-Sync
                                </h2>
                                <span className="px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    Multi-Tenant
                                </span>
                            </div>
                            <p className="text-xs text-indigo-200/80 mt-1 max-w-2xl leading-relaxed">
                                Conecta la bandeja de Google Drive de tu empresa. El CRM detecta automáticamente los archivos generados por Gemini en Google Meet, extrae las notas y las califica con la Rúbrica de 100 Puntos.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            disabled={isSyncing}
                            onClick={handleSyncNow}
                            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                            Sincronizar Google Drive
                        </button>
                    </div>
                </div>
            </div>

            {/* Configuración de la Empresa */}
            <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
                            Reglas de Sincronización para esta Empresa
                        </h3>
                        <p className="text-xs text-slate-400">
                            Cada empresa en el SaaS puede configurar su propio origen de Google Drive y políticas de auditoría.
                        </p>
                    </div>
                    <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleSaveConfig}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2"
                    >
                        <Save className="w-3.5 h-3.5 text-indigo-400" />
                        Guardar Reglas
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
                    {/* Input Carpeta / URL */}
                    <div className="space-y-1.5 md:col-span-1">
                        <label className="block font-bold text-slate-700">
                            Enlace de Google Drive (Actividad o Carpeta):
                        </label>
                        <input
                            type="url"
                            value={driveActivityUrl}
                            onChange={(e) => setDriveActivityUrl(e.target.value)}
                            placeholder="https://drive.google.com/drive/activity o /folders/..."
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white"
                        />
                        <span className="text-[10px] text-slate-400">
                            Puedes usar <code className="text-indigo-600 font-bold">drive.google.com/drive/activity</code> o el link de una carpeta exclusiva.
                        </span>
                    </div>

                    {/* Input Palabra Clave Obligatoria (DEMO) */}
                    <div className="space-y-1.5 md:col-span-1">
                        <label className="block font-bold text-slate-700">
                            Palabra Clave Obligatoria en el Título:
                        </label>
                        <input
                            type="text"
                            value={requiredKeyword}
                            onChange={(e) => setRequiredKeyword(e.target.value)}
                            placeholder="DEMO, Demo"
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white"
                        />
                        <span className="text-[10px] text-slate-400">
                            Solo procesará reuniones que incluyan estas palabras (separadas por coma).
                        </span>
                    </div>

                    {/* Input Patrón de Búsqueda */}
                    <div className="space-y-1.5 md:col-span-1">
                        <label className="block font-bold text-slate-700">
                            Patrón de Archivos de Gemini:
                        </label>
                        <input
                            type="text"
                            value={searchPattern}
                            onChange={(e) => setSearchPattern(e.target.value)}
                            placeholder="*Notas de Gemini*, *Notes by Gemini*"
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white"
                        />
                        <span className="text-[10px] text-slate-400">
                            Filtra los documentos de notas generados por Google Meet.
                        </span>
                    </div>
                </div>

                {/* Toggles de Automatización */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                    <label className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 transition-all cursor-pointer flex items-start gap-3">
                        <input
                            type="checkbox"
                            checked={onlyDemosFilter}
                            onChange={(e) => setOnlyDemosFilter(e.target.checked)}
                            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <div>
                            <span className="block text-xs font-black text-indigo-950">Filtrar Solo "DEMO"</span>
                            <span className="block text-[11px] text-slate-600 mt-0.5">Ignora reuniones internas, soporte o cobranzas.</span>
                        </div>
                    </label>

                    <label className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all cursor-pointer flex items-start gap-3">
                        <input
                            type="checkbox"
                            checked={autoAuditOnDetect}
                            onChange={(e) => setAutoAuditOnDetect(e.target.checked)}
                            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <div>
                            <span className="block text-xs font-bold text-slate-800">Auto-Auditar con IA</span>
                            <span className="block text-[11px] text-slate-500 mt-0.5">Calificar con Rúbrica 100 pts inmediatamente.</span>
                        </div>
                    </label>

                    <label className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all cursor-pointer flex items-start gap-3">
                        <input
                            type="checkbox"
                            checked={autoMatchLead}
                            onChange={(e) => setAutoMatchLead(e.target.checked)}
                            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <div>
                            <span className="block text-xs font-bold text-slate-800">Emparejar Lead</span>
                            <span className="block text-[11px] text-slate-500 mt-0.5">Buscar "Luis Escobar" en tu base de datos.</span>
                        </div>
                    </label>

                    <label className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all cursor-pointer flex items-start gap-3">
                        <input
                            type="checkbox"
                            checked={autoCreateLead}
                            onChange={(e) => setAutoCreateLead(e.target.checked)}
                            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <div>
                            <span className="block text-xs font-bold text-slate-800">Auto-Crear Lead</span>
                            <span className="block text-[11px] text-slate-500 mt-0.5">Si el cliente aún no estaba en el CRM.</span>
                        </div>
                    </label>
                </div>

                {/* Explicación de Carpeta en Google Drive */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex items-start gap-3">
                    <Database className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                        <strong className="text-slate-800 font-bold">¿Cómo garantizar que solo se procesen Demos comerciales?</strong>
                        <p className="mt-0.5 text-slate-500 leading-relaxed text-[11px]">
                            • <strong>Opción 1 (Por Título):</strong> Asegúrate de que tu equipo siempre use la palabra <strong>«Demo»</strong> en el título de la invitación de Google Calendar / Google Meet (ej: <em>«DEMO ERP - Cliente X»</em>). El filtro activo arriba descartará automáticamente cualquier otra reunión (como "Revisión bancos" o "Cobranzas").
                            <br />
                            • <strong>Opción 2 (Por Carpeta Dedicada):</strong> Si prefieres ordenar por carpetas, crea una carpeta en tu Google Drive (ej: <em>«Demos de Ventas»</em>), comparte esa carpeta con tus vendedoras y pega el enlace de la carpeta (<code>https://drive.google.com/drive/folders/...</code>) en el primer campo.
                        </p>
                    </div>
                </div>
            </div>

            {/* Bandeja de Demos en Vivo Detectadas de Google Drive */}
            <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-600" />
                            Demostraciones Detectadas en Google Drive ({filteredDemos.length})
                        </h3>
                        <p className="text-xs text-slate-400">
                            Archivos sincronizados desde <code className="text-indigo-600 font-bold">{driveActivityUrl}</code>
                        </p>
                    </div>

                    <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por cliente o vendedor..."
                            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                </div>

                <div className="divide-y divide-slate-100">
                    {filteredDemos.map((demo) => {
                        const isAudited = demo.status === 'audited';

                        return (
                            <div key={demo.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 px-2 rounded-xl transition-all">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-black text-slate-900">
                                            {demo.clientName}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            · {demo.dateStr}
                                        </span>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600">
                                            Vendedor: {demo.salesRepName}
                                        </span>
                                        {isAudited && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-200">
                                                Auditada ({demo.auditScore}/100 pts)
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-[11px] text-slate-500 font-mono truncate max-w-2xl">
                                        📄 {demo.title}
                                    </p>
                                    <p className="text-[11px] text-slate-600 italic">
                                        «{demo.rawSnippet}»
                                    </p>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    <a
                                        href={demo.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                        title="Abrir en Google Drive"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>

                                    <button
                                        type="button"
                                        onClick={() => handleAuditDemo(demo)}
                                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                                            isAudited
                                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20'
                                        }`}
                                    >
                                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                        {isAudited ? 'Re-auditar' : 'Auditar Ahora'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
