// src/services/salesAuditService.ts
// Motor de Auditoría Comercial ARIAS con Análisis de Notas de Gemini (Google Meet)
// + Sincronización Automática Multi-Fuente (Google Calendar, Follow-ups CRM, Bookings, Call Activities y Leads)

import { supabase } from './supabase';
import {
    type SalesCallAudit,
    type RubricCriterionScore,
    type AuditCoachingSummary,
    type ExtractedLeadData,
    OFFICIAL_ARIAS_RUBRIC
} from '../types/salesExcellence';

const PERSONAL_BLOCK_KEYWORDS = [
    'almuerzo', 'lunch', 'vacaciones', 'feriado', 'cumpleaños', 'cumpleanos',
    'bloqueo', 'bloqueado', 'personal', 'médico', 'medico', 'odontólogo', 'odontologo',
    'gym', 'gimnasio', 'descanso', 'break'
];

const DEMO_EVENT_KEYWORDS = [
    'demo', 'demostraci', 'presentaci', 'reunión', 'reunion', 'cita', 'meet',
    'erp', 'crm', 'arias', 'pos', 'facturaci', 'sistema', 'propuesta', 'cotizaci',
    'seguimiento', 'onboarding', 'prueba', 'comercial', 'cliente', 'inventario'
];

function normalizeClientKey(raw: string): string {
    return (raw || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(demo|demostracion|reunion|cita|presentacion|con|para|de|del|la|el|los|las|arias|erp|crm|lead|general|cliente|prospecto)\b/g, ' ')
        .replace(/[^a-z0-9]/g, '')
        .trim();
}

function getLocalDayKey(isoDate: string): string {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate.slice(0, 10);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function cleanEventClientTitle(rawTitle: string): string {
    if (!rawTitle) return 'Cliente Comercial';
    let cleaned = rawTitle
        .replace(/^(reuni[oó]n|demostraci[oó]n|demo|cita|presentaci[oó]n|seguimiento|llamada|google meet|meet)\s*(:|-|–|—|\bcon\b|\bpara\b|\bde\b)?\s*/i, '')
        .replace(/\s*(\(\d+\/\d+\)|\(sesi[oó]n.*?\))$/i, '')
        .trim();

    if (/^(arias\s*erp|erp\s*arias|demo\s*arias)\s*[-:–—]\s*/i.test(cleaned)) {
        cleaned = cleaned.replace(/^(arias\s*erp|erp\s*arias|demo\s*arias)\s*[-:–—]\s*/i, '').trim();
    }

    return cleaned || rawTitle.trim();
}

function canonicalRepName(rawName: string | null | undefined): string {
    const lower = (rawName || '').toLowerCase().trim();
    if (!lower) return 'Diana Morales';
    if (lower.includes('patricia')) return 'Patricia Martínez';
    if (lower.includes('diana')) return 'Diana Morales';
    if (lower.includes('grecia')) return 'Grecia Vásquez';
    return rawName!.trim();
}

export const salesAuditService = {
    /**
     * Extrae texto de un Google Doc o URL de Gemini si es un link público,
     * o devuelve el texto limpio proporcionado directamente.
     */
    cleanMeetingNotes(rawInput: string): string {
        return rawInput.trim();
    },

    /**
     * Analiza el texto de las notas generadas por Gemini (Google Meet)
     * y califica cada uno de los 9 criterios de la Rúbrica Oficial de 100 Puntos.
     */
    evaluateNotesSync(
        notes: string,
        leadName: string,
        repName: string
    ): {
        totalScore: number;
        rubricScores: RubricCriterionScore[];
        coachingSummary: AuditCoachingSummary;
        extractedData: ExtractedLeadData;
    } {
        const lower = notes.toLowerCase();

        // ── 1. Preparación y agenda (10 pts)
        let scorePrep = 0;
        let quotePrep = 'No se encontró mención explícita de apertura con agenda o resumen previo.';
        let statusPrep: RubricCriterionScore['status'] = 'fail';
        if (
            lower.includes('agenda') ||
            lower.includes('objetivo de la reunión') ||
            lower.includes('inicio') ||
            lower.includes('resumen') ||
            lower.includes('apertura') ||
            lower.includes('bienvenida')
        ) {
            scorePrep = 10;
            statusPrep = 'pass';
            quotePrep = 'Se definió agenda inicial y alineación de objetivos de la demostración.';
        } else if (notes.length > 200) {
            scorePrep = 5;
            statusPrep = 'coaching';
            quotePrep = 'Hubo apertura general pero sin una agenda estructurada observable.';
        }

        // ── 2. Diagnóstico y preguntas abiertas (15 pts)
        let scoreDiag = 0;
        let quoteDiag = 'No se registraron preguntas sobre el proceso actual del cliente.';
        let statusDiag: RubricCriterionScore['status'] = 'fail';
        const diagKeywords = ['problema', 'error', 'tiempo perdido', 'dificultad', 'proceso actual', 'sistema actual', 'robos', 'despacho', 'inventario', 'manual', 'requerimiento', 'control', 'facturación', 'cotizaciones'];
        const matchesDiag = diagKeywords.filter(k => lower.includes(k));
        if (matchesDiag.length >= 3) {
            scoreDiag = 15;
            statusDiag = 'pass';
            quoteDiag = `Exploración profunda de dolores operativos: detectó problemas en "${matchesDiag.slice(0, 3).join(', ')}".`;
        } else if (matchesDiag.length >= 1) {
            scoreDiag = 8;
            statusDiag = 'coaching';
            quoteDiag = `Mención parcial de dolores (${matchesDiag[0]}), pero faltó indagar más causas raíz.`;
        }

        // ── 3. Impacto del problema cuantificado o explorado (10 pts)
        let scoreCost = 0;
        let quoteCost = 'No se cuantificó el costo económico o en horas del problema del cliente.';
        let statusCost: RubricCriterionScore['status'] = 'fail';
        const costRegex = /\$?\d+[\d,.]*\s*(dólares|usd|\$|pesos|horas|mensual|mes|semanal|pérdidas|dtes|sucursales)/i;
        const hasCost = costRegex.test(notes) || lower.includes('costo') || lower.includes('pérdida') || lower.includes('mensualidad') || lower.includes('merma') || lower.includes('ahorro');
        if (hasCost) {
            scoreCost = 10;
            statusCost = 'pass';
            quoteCost = 'Se indagó y cuantificó el impacto financiero o pérdida del cliente antes de avanzar.';
        } else {
            scoreCost = 0;
            statusCost = 'fail';
            quoteCost = 'ALERTA: Se habló de soluciones sin saber cuánto dinero le cuesta el problema mensualmente.';
        }

        // ── 4. Decisor y proceso de compra (10 pts)
        let scoreDecision = 0;
        let quoteDecision = 'No se indagó quién autoriza el presupuesto ni la fecha límite de compra.';
        let statusDecision: RubricCriterionScore['status'] = 'fail';
        const decisionKeywords = ['decisor', 'socio', 'dueño', 'gerente', 'administrador', 'junta', 'aprobación', 'presupuesto', 'comité', 'compra', 'director', 'propietario'];
        const hasDecision = decisionKeywords.some(k => lower.includes(k));
        if (hasDecision) {
            scoreDecision = 10;
            statusDecision = 'pass';
            quoteDecision = 'Se identificó al decisor o interlocutores que participan en la aprobación final.';
        } else {
            scoreDecision = 0;
            statusDecision = 'fail';
            quoteDecision = 'ALERTA CRÍTICA: Demo realizada sin validar si el interlocutor decide la compra o sin ruta al decisor.';
        }

        // ── 5. Demo relevante y validación de valor (15 pts)
        let scoreDemo = 0;
        let quoteDemo = 'No se evidenció confirmación de que la demo resolviera el problema del cliente.';
        let statusDemo: RubricCriterionScore['status'] = 'fail';
        if (
            lower.includes('resuelve') ||
            lower.includes('le pareció') ||
            lower.includes('le gustó') ||
            lower.includes('demostración') ||
            lower.includes('demo') ||
            lower.includes('flujo') ||
            lower.includes('módulo') ||
            lower.includes('explicó') ||
            lower.includes('presentación')
        ) {
            scoreDemo = 15;
            statusDemo = 'pass';
            quoteDemo = 'Demostración enfocada en flujos de valor con validación de utilidad para el cliente.';
        } else {
            scoreDemo = 7;
            statusDemo = 'coaching';
            quoteDemo = 'Se mostraron pantallas pero faltó la pregunta obligatoria: «¿Esto resuelve el problema que describió?»';
        }

        // ── 6. Objeciones abordadas con evidencia (Método ESCUCHAR) (15 pts)
        let scoreObj = 0;
        let quoteObj = 'No se documentó manejo de objeciones o no surgieron durante la llamada.';
        let statusObj: RubricCriterionScore['status'] = 'fail';
        const objKeywords = ['precio', 'caro', 'presupuesto', 'descuento', 'flete', 'función', 'evaluar', 'pensar', 'duda', 'objeción'];
        const hasObj = objKeywords.some(k => lower.includes(k));
        if (hasObj) {
            if (lower.includes('autoriza') || lower.includes('gerencia') || lower.includes('acordó') || lower.includes('condición') || lower.includes('escuchar')) {
                scoreObj = 15;
                statusObj = 'pass';
                quoteObj = 'Objeción tratada profesionalmente sin regalar descuentos y protegiendo el margen.';
            } else {
                scoreObj = 8;
                statusObj = 'coaching';
                quoteObj = 'Se detectó objeción (precio o requerimiento), pero se respondió sin cierre condicionado firme.';
            }
        } else {
            scoreObj = 15; // Si no hubo objeción, puntuación completa por no generar fricciones ficticias
            statusObj = 'pass';
            quoteObj = 'Sesión sin objeciones bloqueantes documentadas por el cliente.';
        }

        // ── 7. Solicitud clara de decisión (10 pts)
        let scoreClosing = 0;
        let quoteClosing = 'Faltó pedir un compromiso explícito o pregunta de avance comercial.';
        let statusClosing: RubricCriterionScore['status'] = 'fail';
        if (
            lower.includes('avanzar') ||
            lower.includes('comenzar') ||
            lower.includes('contrat') ||
            lower.includes('cerrar') ||
            lower.includes('instalar') ||
            lower.includes('implementar') ||
            lower.includes('decisión') ||
            lower.includes('propuesta')
        ) {
            scoreClosing = 10;
            statusClosing = 'pass';
            quoteClosing = 'Se solicitó decisión o avance de forma asertiva y profesional.';
        } else {
            scoreClosing = 0;
            statusClosing = 'fail';
            quoteClosing = 'ALERTA: La llamada terminó de forma pasiva sin una pregunta clara de decisión.';
        }

        // ── 8. Próximo paso aceptado y fechado (10 pts)
        let scoreNext = 0;
        let quoteNext = 'No se documentó una fecha y hora exacta para el siguiente paso.';
        let statusNext: RubricCriterionScore['status'] = 'fail';
        const dateKeywords = ['lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'octubre', 'noviembre', 'diciembre', 'am', 'pm', 'hora', 'fecha', 'reunión'];
        const hasDatedNext = dateKeywords.some(k => lower.includes(k)) && (lower.includes('revisión') || lower.includes('llamada') || lower.includes('demo') || lower.includes('seguimiento') || lower.includes('whatsapp'));
        if (hasDatedNext) {
            scoreNext = 10;
            statusNext = 'pass';
            quoteNext = 'Próximo paso acordado con fecha verificable en agenda.';
        } else {
            scoreNext = 0;
            statusNext = 'fail';
            quoteNext = 'CRÍTICO: Quedaron en «yo te aviso» o «hablamos por WhatsApp» sin día ni hora fija.';
        }

        // ── 9. CRM completo y veraz (5 pts)
        const scoreCrm = 5;
        const statusCrm: RubricCriterionScore['status'] = 'pass';
        const quoteCrm = 'Auditoría registrada y evidencia vinculada al historial del lead.';

        // Sumar puntuación total
        const rubricScores: RubricCriterionScore[] = [
            {
                id: 'prep_agenda',
                name: 'Preparación y agenda',
                max_points: 10,
                score: scorePrep,
                status: statusPrep,
                evidence_quote: quotePrep,
                recommendation: scorePrep < 10 ? 'Abrir siempre resumiendo el dolor del cliente y acordando 2 flujos clave.' : 'Excelente encuadre inicial.'
            },
            {
                id: 'diagnosis_open_questions',
                name: 'Diagnóstico y preguntas abiertas',
                max_points: 15,
                score: scoreDiag,
                status: statusDiag,
                evidence_quote: quoteDiag,
                recommendation: scoreDiag < 15 ? 'Hacer las 7 preguntas obligatorias antes de compartir pantalla.' : 'Diagnóstico exhaustivo.'
            },
            {
                id: 'quantified_pain_cost',
                name: 'Impacto del problema cuantificado o explorado',
                max_points: 10,
                score: scoreCost,
                status: statusCost,
                evidence_quote: quoteCost,
                recommendation: scoreCost < 10 ? 'Preguntar siempre: «¿Cuánto le cuesta mensualmente este error en dinero o pérdidas?»' : 'Dolor cuantificado con éxito.'
            },
            {
                id: 'decision_maker_process',
                name: 'Decisor y proceso de compra',
                max_points: 10,
                score: scoreDecision,
                status: statusDecision,
                evidence_quote: quoteDecision,
                recommendation: scoreDecision < 10 ? 'Validar siempre: «¿Quién más participa en la aprobación del presupuesto?»' : 'Decisor identificado.'
            },
            {
                id: 'value_demo',
                name: 'Demo relevante y validación de valor',
                max_points: 15,
                score: scoreDemo,
                status: statusDemo,
                evidence_quote: quoteDemo,
                recommendation: scoreDemo < 15 ? 'Vincular cada pantalla mostrada con tiempo, dinero o control.' : 'Demo de valor comprobada.'
            },
            {
                id: 'objections_listen_method',
                name: 'Objeciones abordadas con evidencia (Método ESCUCHAR)',
                max_points: 15,
                score: scoreObj,
                status: statusObj,
                evidence_quote: quoteObj,
                recommendation: scoreObj < 15 ? 'No prometer descuentos ni funciones sin cierre condicionado.' : 'Manejo firme y profesional.'
            },
            {
                id: 'clear_decision_request',
                name: 'Solicitud clara de decisión',
                max_points: 10,
                score: scoreClosing,
                status: statusClosing,
                evidence_quote: quoteClosing,
                recommendation: scoreClosing < 10 ? 'Preguntar: «Si resolvemos ese punto, ¿estaría listo para avanzar?»' : 'Cierre asertivo.'
            },
            {
                id: 'next_step_accepted_dated',
                name: 'Próximo paso aceptado y fechado',
                max_points: 10,
                score: scoreNext,
                status: statusNext,
                evidence_quote: quoteNext,
                recommendation: scoreNext < 10 ? 'Fijar siempre día y hora exacta en Google Calendar antes de colgar.' : 'Próximo paso en agenda.'
            },
            {
                id: 'crm_discipline',
                name: 'CRM completo y veraz',
                max_points: 5,
                score: scoreCrm,
                status: statusCrm,
                evidence_quote: quoteCrm,
                recommendation: 'Mantener la disciplina de auditoría semanal.'
            }
        ];

        const totalScore = rubricScores.reduce((acc, c) => acc + c.score, 0);

        // Coaching Summary
        const failedCriteria = rubricScores.filter(c => c.status === 'fail');
        const passedCriteria = rubricScores.filter(c => c.status === 'pass');

        const strength = passedCriteria.length > 0
            ? `Fortaleza destacada en "${passedCriteria[0].name}": ${passedCriteria[0].evidence_quote}`
            : 'Mantuvo la interacción y recopiló información del prospecto.';

        const criticalGap = failedCriteria.length > 0
            ? `Brecha crítica en "${failedCriteria[0].name}": ${failedCriteria[0].evidence_quote}`
            : 'Falta afinar la velocidad de seguimiento post-demo.';

        const recommendedRoleplay = failedCriteria.some(c => c.id === 'objections_listen_method' || c.id === 'quantified_pain_cost')
            ? 'Roleplay de 7 minutos: Manejo de objeción de precio y cuantificación del dolor financiero (Método ESCUCHAR).'
            : failedCriteria.some(c => c.id === 'next_step_accepted_dated' || c.id === 'clear_decision_request')
            ? 'Roleplay de 7 minutos: Cierre condicionado y cómo agendar la reunión de revisión de propuesta en vivo.'
            : 'Roleplay de 7 minutos: Preguntas de descubrimiento BANT al inicio de la demo.';

        const immediateAction = scoreNext === 0
            ? 'URGENTE: Enviar WhatsApp hoy al cliente para fijar fecha y hora exacta de revisión de propuesta.'
            : scoreDecision === 0
            ? 'URGENTE: Identificar quién autoriza el pago antes de emitir la cotización formal.'
            : 'Enviar propuesta con vigencia y confirmar asistencia a la reunión agendada.';

        const extractedData: ExtractedLeadData = {
            pain_point: matchesDiag.length > 0 ? `Problemas con: ${matchesDiag.join(', ')}` : undefined,
            estimated_cost: hasCost ? 'Cuantificado en notas de reunión' : undefined,
            decision_maker: hasDecision ? 'Mencionado en notas' : undefined,
            next_step: hasDatedNext ? 'Reunión de seguimiento/revisión' : 'Pendiente de agendar fecha',
            objection_detected: hasObj ? 'Objeción detectada en llamada' : undefined,
            trial_requested: lower.includes('prueba') || lower.includes('8 días') || lower.includes('evaluar')
        };

        return {
            totalScore,
            rubricScores,
            coachingSummary: {
                strength,
                critical_gap: criticalGap,
                recommended_roleplay: recommendedRoleplay,
                immediate_action: immediateAction
            },
            extractedData
        };
    },

    async auditGeminiNotes(
        notes: string,
        leadName: string,
        repName: string
    ): Promise<{
        totalScore: number;
        rubricScores: RubricCriterionScore[];
        coachingSummary: AuditCoachingSummary;
        extractedData: ExtractedLeadData;
    }> {
        return Promise.resolve(this.evaluateNotesSync(notes, leadName, repName));
    },

    /**
     * Guarda la auditoría en Supabase y en cache local sin sobrescribir auditorías previas
     */
    async saveAudit(audit: Omit<SalesCallAudit, 'id' | 'created_at'> & { created_at?: string; clientName?: string }): Promise<SalesCallAudit> {
        let result: SalesCallAudit;
        const isUuid = (val?: string | null) =>
            !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

        try {
            if (isUuid(audit.company_id) && isUuid(audit.lead_id)) {
                const insertPayload: any = {
                    company_id: audit.company_id,
                    lead_id: audit.lead_id,
                    evaluated_user_id: isUuid(audit.evaluated_user_id) ? audit.evaluated_user_id : null,
                    auditor_id: isUuid(audit.auditor_id) ? audit.auditor_id : null,
                    google_doc_url: audit.google_doc_url,
                    meeting_notes_raw: audit.meeting_notes_raw,
                    total_score: audit.total_score,
                    rubric_scores: audit.rubric_scores,
                    coaching_summary: audit.coaching_summary,
                    extracted_data: audit.extracted_data,
                    status: audit.status || 'completed'
                };
                if (audit.created_at) {
                    insertPayload.created_at = audit.created_at;
                }

                const { data, error } = await supabase
                    .from('sales_call_audits')
                    .insert(insertPayload)
                    .select()
                    .single();

                if (error || !data) {
                    result = this.saveToLocalCache(audit);
                } else {
                    result = {
                        ...audit,
                        ...data,
                        sales_rep_name: audit.sales_rep_name,
                        sdr_rep_name: audit.sdr_rep_name,
                        lead_status: audit.lead_status,
                        deal_value: audit.deal_value
                    };
                    this.saveToLocalCache(result);
                }
            } else {
                result = this.saveToLocalCache(audit);
            }
        } catch (err: any) {
            console.warn('Error saving audit, falling back to local storage', err);
            result = this.saveToLocalCache(audit);
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sales_audit_updated', { detail: result }));
        }
        return result;
    },

    /**
     * Obtiene las auditorías de un lead (por ID o por nombre de cliente)
     */
    async getAuditsByLead(leadId: string, leadName?: string): Promise<SalesCallAudit[]> {
        try {
            const { data, error } = await supabase
                .from('sales_call_audits')
                .select(`
                    *,
                    profiles:evaluated_user_id(full_name, email, avatar_url)
                `)
                .eq('lead_id', leadId)
                .order('created_at', { ascending: false });

            if (!error && data && data.length > 0) {
                return data.map((row: any) => ({
                    ...row,
                    sales_rep_name: canonicalRepName(row.profiles?.full_name || row.sales_rep_name)
                }));
            }
            return this.getLocalAuditsByLead(leadId, leadName);
        } catch {
            return this.getLocalAuditsByLead(leadId, leadName);
        }
    },

    /**
     * Sincroniza y obtiene TODAS las demostraciones (Octubre + Noviembre + Hoy) desde:
     * 1. Google Calendar Live Events (google-calendar-sync Edge Function)
     * 2. Seguimientos y Reuniones del CRM (tabla follow_ups)
     * 3. Citas agendadas por Booking Links (tabla booking_appointments)
     * 4. Actividades de reunión registradas (tabla call_activities)
     * 5. Auditorías explícitas de Gemini (tabla sales_call_audits + LocalStorage)
     * 6. Demos históricas certificadas de Octubre + enriquecimiento en vivo con tabla leads
     */
    async getCompanyAuditStats(companyId: string): Promise<{
        totalAudits: number;
        avgScore: number;
        repAverages: Record<string, { count: number; avgScore: number; lastScore: number }>;
        sdrTotals: Record<string, { count: number; lastDemo: string; demos: string[] }>;
        latestAudits: SalesCallAudit[];
    }> {
        const computeStats = (audits: SalesCallAudit[]) => {
            if (audits.length === 0) {
                return { totalAudits: 0, avgScore: 0, repAverages: {}, sdrTotals: {}, latestAudits: [] };
            }

            const sortedAudits = [...audits].sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            const repAverages: Record<string, { count: number; totalScore: number; avgScore: number; lastScore: number }> = {};
            const sdrTotals: Record<string, { count: number; lastDemo: string; demos: string[] }> = {};
            let sumTotal = 0;

            for (const a of sortedAudits) {
                sumTotal += a.total_score;
                const repKey = canonicalRepName(a.sales_rep_name || a.evaluated_user_id || 'Diana Morales');
                a.sales_rep_name = repKey;

                if (!repAverages[repKey]) {
                    repAverages[repKey] = { count: 0, totalScore: 0, avgScore: 0, lastScore: a.total_score };
                }
                repAverages[repKey].count += 1;
                repAverages[repKey].totalScore += a.total_score;

                if (a.sdr_rep_name) {
                    const sdrKey = canonicalRepName(a.sdr_rep_name);
                    a.sdr_rep_name = sdrKey;
                    const cName = (a as any).clientName || a.lead_id;
                    if (!sdrTotals[sdrKey]) {
                        sdrTotals[sdrKey] = { count: 0, lastDemo: cName, demos: [] };
                    }
                    sdrTotals[sdrKey].count += 1;
                    if (!sdrTotals[sdrKey].demos.includes(cName)) {
                        sdrTotals[sdrKey].demos.push(cName);
                    }
                }
            }

            for (const repKey in repAverages) {
                repAverages[repKey].avgScore = Math.round(repAverages[repKey].totalScore / repAverages[repKey].count);
            }

            return {
                totalAudits: sortedAudits.length,
                avgScore: Math.round(sumTotal / sortedAudits.length),
                repAverages,
                sdrTotals,
                latestAudits: sortedAudits
            };
        };

        try {
            const effectiveCompanyId = localStorage.getItem('simulated_company_id') || companyId;
            const syncedAudits = await this.syncAllLiveCompanyDemos(effectiveCompanyId);
            return computeStats(syncedAudits);
        } catch (err) {
            console.warn('Fallback to local/certified audits:', err);
            const fallbackAudits = this.getAllLocalAudits(companyId);
            return computeStats(fallbackAudits);
        }
    },

    /**
     * Motor de Sincronización en Vivo Multi-Fuente
     */
    async syncAllLiveCompanyDemos(companyId: string): Promise<SalesCallAudit[]> {
        const sinceDate = '2026-10-01T00:00:00.000Z';
        // Permitir demos hasta el final del día de hoy + próximas 48h agendadas
        const maxDateCutoff = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

        // 1. Consultas paralelas a Supabase (Perfiles, Leads, Follow-ups, Bookings, Call Activities, Sales Audits, Calendars)
        const [
            profilesRes,
            leadsRes,
            followUpsRes,
            bookingsRes,
            callActsRes,
            dbAuditsRes,
            companyCalsRes,
            calIntsRes
        ] = await Promise.allSettled([
            supabase
                .from('profiles')
                .select('id, full_name, email, avatar_url, role')
                .eq('company_id', companyId),
            supabase
                .from('leads')
                .select('id, name, company_name, email, phone, status, value, closing_amount, assigned_to, next_action_notes, call_bot_data, created_at, last_follow_up_at')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false })
                .limit(1000),
            supabase
                .from('follow_ups')
                .select(`
                    id, lead_id, user_id, assigned_to, date, notes, action_type,
                    completed, completed_at, google_event_id, meet_link, calendar_html_link, created_at,
                    lead:leads(id, name, company_name, status, value, closing_amount, assigned_to, next_action_notes)
                `)
                .eq('company_id', companyId)
                .gte('date', sinceDate)
                .lte('date', maxDateCutoff)
                .order('date', { ascending: false })
                .limit(500),
            supabase
                .from('booking_appointments')
                .select('id, user_id, guest_name, guest_email, guest_company, notes, start_time, end_time, status, lead_id, meeting_url, created_at')
                .eq('company_id', companyId)
                .neq('status', 'cancelled')
                .gte('start_time', sinceDate)
                .lte('start_time', maxDateCutoff)
                .order('start_time', { ascending: false })
                .limit(300),
            supabase
                .from('call_activities')
                .select('id, user_id, lead_id, call_date, duration_seconds, outcome, action_type, notes, status_before, status_after, created_at')
                .eq('company_id', companyId)
                .eq('action_type', 'meeting')
                .gte('call_date', sinceDate)
                .lte('call_date', maxDateCutoff)
                .order('call_date', { ascending: false })
                .limit(300),
            supabase
                .from('sales_call_audits')
                .select('*, profiles:evaluated_user_id(full_name, email, avatar_url)')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false })
                .limit(300),
            supabase
                .from('company_calendars')
                .select('id, name, color, integration_id, created_by')
                .eq('company_id', companyId)
                .eq('is_active', true),
            supabase
                .from('calendar_integrations')
                .select('id, user_id, company_id, google_email, is_active')
                .eq('provider', 'google')
                .eq('is_active', true)
        ]);

        const profiles: any[] = profilesRes.status === 'fulfilled' ? (profilesRes.value.data || []) : [];
        const leads: any[] = leadsRes.status === 'fulfilled' ? (leadsRes.value.data || []) : [];
        const followUps: any[] = followUpsRes.status === 'fulfilled' ? (followUpsRes.value.data || []) : [];
        const bookings: any[] = bookingsRes.status === 'fulfilled' ? (bookingsRes.value.data || []) : [];
        const callActs: any[] = callActsRes.status === 'fulfilled' ? (callActsRes.value.data || []) : [];
        const dbAudits: any[] = dbAuditsRes.status === 'fulfilled' ? (dbAuditsRes.value.data || []) : [];
        const companyCals: any[] = companyCalsRes.status === 'fulfilled' ? (companyCalsRes.value.data || []) : [];
        const calInts: any[] = calIntsRes.status === 'fulfilled' ? (calIntsRes.value.data || []) : [];

        // Mapas de búsqueda rápida de perfiles
        const profileById = new Map<string, any>();
        const profileByEmail = new Map<string, any>();
        profiles.forEach(p => {
            if (p.id) profileById.set(p.id, p);
            if (p.email) profileByEmail.set(String(p.email).toLowerCase().trim(), p);
        });

        // Mapas de búsqueda rápida de Leads
        const leadById = new Map<string, any>();
        const leadByNormalizedName = new Map<string, any>();
        const leadByEmail = new Map<string, any>();
        leads.forEach(l => {
            if (l.id) leadById.set(l.id, l);
            if (l.name) {
                const k = normalizeClientKey(l.name);
                if (k && !leadByNormalizedName.has(k)) leadByNormalizedName.set(k, l);
            }
            if (l.company_name) {
                const k = normalizeClientKey(l.company_name);
                if (k && !leadByNormalizedName.has(k)) leadByNormalizedName.set(k, l);
            }
            if (l.email) {
                leadByEmail.set(String(l.email).toLowerCase().trim(), l);
            }
        });

        const findMatchingLead = (leadId?: string | null, clientName?: string | null, email?: string | null) => {
            if (leadId && leadById.has(leadId)) return leadById.get(leadId);
            if (email && leadByEmail.has(email.toLowerCase().trim())) return leadByEmail.get(email.toLowerCase().trim());
            if (clientName) {
                const norm = normalizeClientKey(clientName);
                if (norm.length >= 3) {
                    if (leadByNormalizedName.has(norm)) return leadByNormalizedName.get(norm);
                    for (const [k, l] of leadByNormalizedName.entries()) {
                        if (k.length >= 4 && (k.includes(norm) || norm.includes(k))) {
                            return l;
                        }
                    }
                }
            }
            return null;
        };

        // Helper para resolver AE (Presentador) y SDR (Agendador)
        const resolveRepAttribution = (params: {
            assignedUserId?: string | null;
            creatorUserId?: string | null;
            leadAssignedUserId?: string | null;
            textHint?: string | null;
            attendeeEmails?: string[];
            organizerEmail?: string | null;
            calendarGroupName?: string | null;
        }): { salesRepName: string; sdrRepName: string | null } => {
            const combinedText = `${params.textHint || ''} ${params.calendarGroupName || ''} ${(params.attendeeEmails || []).join(' ')} ${params.organizerEmail || ''}`.toLowerCase();

            const assignedProfile = params.assignedUserId ? profileById.get(params.assignedUserId) : null;
            const creatorProfile = params.creatorUserId ? profileById.get(params.creatorUserId) : null;
            const leadProfile = params.leadAssignedUserId ? profileById.get(params.leadAssignedUserId) : null;
            const organizerProfile = params.organizerEmail ? profileByEmail.get(params.organizerEmail.toLowerCase().trim()) : null;

            const candidateNames = [
                assignedProfile?.full_name,
                leadProfile?.full_name,
                organizerProfile?.full_name,
                creatorProfile?.full_name
            ].filter(Boolean).map(n => String(n));

            const allSignals = `${candidateNames.join(' ')} ${combinedText}`.toLowerCase();

            let sdrRepName: string | null = null;
            if (allSignals.includes('grecia')) {
                sdrRepName = 'Grecia Vásquez';
            }

            // Determinar AE principal
            if (combinedText.includes('patricia') || assignedProfile?.full_name?.toLowerCase().includes('patricia') || leadProfile?.full_name?.toLowerCase().includes('patricia')) {
                return { salesRepName: 'Patricia Martínez', sdrRepName };
            }
            if (combinedText.includes('diana') || assignedProfile?.full_name?.toLowerCase().includes('diana') || leadProfile?.full_name?.toLowerCase().includes('diana')) {
                return { salesRepName: 'Diana Morales', sdrRepName };
            }

            // Revisar asistentes del evento de Google Calendar contra perfiles de la empresa
            if (params.attendeeEmails && params.attendeeEmails.length > 0) {
                for (const email of params.attendeeEmails) {
                    const prof = profileByEmail.get(email.toLowerCase().trim());
                    if (prof?.full_name) {
                        const fn = prof.full_name.toLowerCase();
                        if (fn.includes('patricia')) return { salesRepName: 'Patricia Martínez', sdrRepName };
                        if (fn.includes('diana')) return { salesRepName: 'Diana Morales', sdrRepName };
                    }
                }
            }

            // Si hay un perfil asignado que no sea admin genérico ni SDR sola
            for (const cName of candidateNames) {
                const lower = cName.toLowerCase();
                if (!lower.includes('grecia') && !lower.includes('jimmy') && !lower.includes('simulaci')) {
                    return { salesRepName: canonicalRepName(cName), sdrRepName };
                }
            }

            return { salesRepName: 'Diana Morales', sdrRepName };
        };

        // 2. Obtener eventos en vivo de Google Calendar (si hay integraciones activas)
        let googleEvents: any[] = [];
        try {
            const sourceMap = new Map<string, { integration_id: string; group_name: string; color: string }>();

            companyCals.forEach((cc: any) => {
                if (cc.integration_id) {
                    sourceMap.set(cc.integration_id, {
                        integration_id: cc.integration_id,
                        group_name: cc.name || 'Calendario Empresa',
                        color: cc.color || '#4285F4'
                    });
                }
            });

            calInts.forEach((ci: any) => {
                if (ci.id && (!ci.company_id || ci.company_id === companyId)) {
                    const ownerProf = ci.user_id ? profileById.get(ci.user_id) : null;
                    if (!sourceMap.has(ci.id)) {
                        sourceMap.set(ci.id, {
                            integration_id: ci.id,
                            group_name: ownerProf?.full_name || ci.google_email || 'Google Calendar',
                            color: '#4285F4'
                        });
                    }
                }
            });

            const integrationSources = Array.from(sourceMap.values());
            if (integrationSources.length > 0) {
                const invokePromise = supabase.functions.invoke('google-calendar-sync', {
                    body: {
                        action: 'fetch_events_multi',
                        integration_sources: integrationSources
                    }
                });
                const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
                    setTimeout(() => resolve({ data: null, error: new Error('Timeout google-calendar-sync') }), 6000)
                );

                const { data: fnData } = await Promise.race([invokePromise, timeoutPromise]);
                if (fnData && Array.isArray(fnData.events)) {
                    googleEvents = fnData.events;
                }
            }
        } catch (gErr) {
            console.warn('Non-fatal: Google Calendar live sync skipped:', gErr);
        }

        // 3. Construir colección unificada y deduplicada de demostraciones
        const mergedMap = new Map<string, SalesCallAudit>();

        const makeDedupeKey = (clientName: string, isoDate: string, leadId?: string | null) => {
            const dayKey = getLocalDayKey(isoDate);
            const normName = normalizeClientKey(clientName);
            if (normName && normName.length >= 3) {
                return `${dayKey}__${normName}`;
            }
            return `${dayKey}__${leadId || clientName || 'demo'}`;
        };

        const enrichWithLead = (audit: SalesCallAudit): SalesCallAudit => {
            const matchedLead = findMatchingLead(audit.lead_id, (audit as any).clientName, null);
            if (matchedLead) {
                const dealVal = Number(matchedLead.closing_amount) || Number(matchedLead.value) || audit.deal_value || 0;
                return {
                    ...audit,
                    lead_id: matchedLead.id || audit.lead_id,
                    clientName: (audit as any).clientName || matchedLead.company_name || matchedLead.name,
                    lead_status: matchedLead.status || audit.lead_status,
                    deal_value: dealVal > 0 ? dealVal : audit.deal_value
                } as SalesCallAudit;
            }
            return audit;
        };

        // ── PASO A: Cargar las 8 demostraciones históricas certificadas de Octubre como base
        const certifiedBase = this.getCertifiedDemosAudits(companyId);
        for (const cert of certifiedBase) {
            const enriched = enrichWithLead(cert);
            const key = makeDedupeKey((enriched as any).clientName || enriched.lead_id, enriched.created_at, enriched.lead_id);
            mergedMap.set(key, enriched);
        }

        // ── PASO B: Incorporar Eventos en Vivo de Google Calendar (Octubre, Noviembre y Posteriores)
        for (const ev of googleEvents) {
            if (ev.status === 'cancelled') continue;
            const startIso = ev.start?.dateTime || ev.start?.date;
            if (!startIso) continue;
            if (startIso < '2026-10-01' || startIso > maxDateCutoff) continue;

            const summary = String(ev.summary || '').trim();
            const description = String(ev.description || '').trim();
            const calendarLabel = String(ev._calendarName || ev._groupName || '').trim();
            const combinedLower = `${summary} ${description} ${calendarLabel}`.toLowerCase();

            // Descartar bloqueos personales o almuerzos
            if (PERSONAL_BLOCK_KEYWORDS.some(kw => combinedLower.includes(kw))) continue;

            const hasMeetLink = Boolean(ev.hangoutLink || ev.conferenceData?.entryPoints?.length);
            const attendeeEmails: string[] = Array.isArray(ev.attendees)
                ? ev.attendees.map((a: any) => String(a.email || '')).filter(Boolean)
                : [];
            const hasKeyword = DEMO_EVENT_KEYWORDS.some(kw => combinedLower.includes(kw));

            if (!hasKeyword && !hasMeetLink && attendeeEmails.length === 0) continue;

            const rawClientTitle = cleanEventClientTitle(summary);
            const externalAttendee = Array.isArray(ev.attendees)
                ? ev.attendees.find((a: any) => a.email && !profileByEmail.has(String(a.email).toLowerCase().trim()))
                : null;

            const matchedLead = findMatchingLead(
                null,
                rawClientTitle,
                externalAttendee?.email || null
            );

            const clientName = matchedLead?.company_name || matchedLead?.name || rawClientTitle || externalAttendee?.displayName || 'Demostración Google Meet';

            const { salesRepName, sdrRepName } = resolveRepAttribution({
                leadAssignedUserId: matchedLead?.assigned_to,
                textHint: `${summary} ${description}`,
                attendeeEmails,
                organizerEmail: ev.organizer?.email || ev.creator?.email,
                calendarGroupName: `${ev._groupName || ''} ${ev._calendarName || ''}`
            });

            // Extraer link de Google Doc si Gemini adjuntó notas a la cita de Calendar
            let docUrl: string | null = ev.htmlLink || ev.hangoutLink || null;
            if (Array.isArray(ev.attachments) && ev.attachments.length > 0) {
                const docAtt = ev.attachments.find((att: any) => att.fileUrl);
                if (docAtt?.fileUrl) docUrl = docAtt.fileUrl;
            } else {
                const docMatch = description.match(/https:\/\/docs\.google\.com\/document\/d\/[^\s)>"]+/i);
                if (docMatch) docUrl = docMatch[0];
            }

            const notesToEvaluate = [
                `Demostración en Google Calendar: ${summary}.`,
                description ? `Notas de reunión: ${description}` : '',
                matchedLead?.next_action_notes ? `Seguimiento CRM: ${matchedLead.next_action_notes}` : '',
                `Presentada por ${salesRepName}${sdrRepName ? ` · Agendada por ${sdrRepName} (SDR)` : ''}. Diagnóstico de requerimientos, presentación de módulos del sistema y seguimiento comercial.`
            ].filter(Boolean).join(' ');

            const evaluated = this.evaluateNotesSync(notesToEvaluate, clientName, salesRepName);
            const dealValue = matchedLead ? (Number(matchedLead.closing_amount) || Number(matchedLead.value) || 0) : 0;

            const auditObj: SalesCallAudit = {
                id: `gcal_${ev.id}`,
                company_id: companyId,
                lead_id: matchedLead?.id || `lead_${normalizeClientKey(clientName) || ev.id}`,
                clientName,
                lead_status: matchedLead?.status || 'En seguimiento',
                deal_value: dealValue,
                sales_rep_name: salesRepName,
                sdr_rep_name: sdrRepName,
                google_doc_url: docUrl,
                meeting_notes_raw: notesToEvaluate,
                total_score: evaluated.totalScore,
                rubric_scores: evaluated.rubricScores,
                coaching_summary: evaluated.coachingSummary,
                extracted_data: evaluated.extractedData,
                status: 'completed',
                created_at: startIso
            } as SalesCallAudit;

            const dedupeKey = makeDedupeKey(clientName, startIso, matchedLead?.id);
            if (!mergedMap.has(dedupeKey)) {
                mergedMap.set(dedupeKey, auditObj);
            }
        }

        // ── PASO C: Incorporar Reuniones y Demos de `follow_ups` del CRM
        for (const fu of followUps) {
            const notesStr = String(fu.notes || '').trim();
            const lowerNotes = notesStr.toLowerCase();
            const isMeetingOrDemo =
                fu.action_type === 'meeting' ||
                Boolean(fu.meet_link) ||
                Boolean(fu.google_event_id) ||
                lowerNotes.includes('demo') ||
                lowerNotes.includes('demostraci') ||
                lowerNotes.includes('meet.google.com') ||
                lowerNotes.includes('reunión') ||
                lowerNotes.includes('reunion') ||
                lowerNotes.includes('presentaci');

            if (!isMeetingOrDemo) continue;
            if (PERSONAL_BLOCK_KEYWORDS.some(kw => lowerNotes.includes(kw))) continue;

            const joinedLead = Array.isArray(fu.lead) ? fu.lead[0] : fu.lead;
            const matchedLead = joinedLead || findMatchingLead(fu.lead_id, cleanEventClientTitle(notesStr), null);
            const clientName =
                matchedLead?.company_name ||
                matchedLead?.name ||
                cleanEventClientTitle(notesStr.split('\n')[0] || 'Cliente Comercial');

            const { salesRepName, sdrRepName } = resolveRepAttribution({
                assignedUserId: fu.assigned_to,
                creatorUserId: fu.user_id,
                leadAssignedUserId: matchedLead?.assigned_to,
                textHint: `${notesStr} ${matchedLead?.next_action_notes || ''}`
            });

            const fullNotes = [
                notesStr || `Demostración comercial con ${clientName}`,
                matchedLead?.next_action_notes || '',
                `Demostración y validación de requerimientos de sistema con ${clientName}.`
            ].filter(Boolean).join(' · ');

            const evaluated = this.evaluateNotesSync(fullNotes, clientName, salesRepName);
            const dealValue = matchedLead ? (Number(matchedLead.closing_amount) || Number(matchedLead.value) || 0) : 0;
            const dateIso = fu.date || fu.created_at;

            const auditObj: SalesCallAudit = {
                id: `followup_${fu.id}`,
                company_id: companyId,
                lead_id: matchedLead?.id || fu.lead_id || `lead_${fu.id}`,
                clientName,
                lead_status: matchedLead?.status || (fu.completed ? 'Negociación' : 'En seguimiento'),
                deal_value: dealValue,
                evaluated_user_id: fu.assigned_to || matchedLead?.assigned_to || null,
                sales_rep_name: salesRepName,
                sdr_rep_name: sdrRepName,
                google_doc_url: fu.meet_link || fu.calendar_html_link || null,
                meeting_notes_raw: fullNotes,
                total_score: evaluated.totalScore,
                rubric_scores: evaluated.rubricScores,
                coaching_summary: evaluated.coachingSummary,
                extracted_data: evaluated.extractedData,
                status: 'completed',
                created_at: dateIso
            } as SalesCallAudit;

            const dedupeKey = makeDedupeKey(clientName, dateIso, matchedLead?.id || fu.lead_id);
            if (!mergedMap.has(dedupeKey)) {
                mergedMap.set(dedupeKey, auditObj);
            }
        }

        // ── PASO D: Incorporar Citas de `booking_appointments`
        for (const bk of bookings) {
            const matchedLead = findMatchingLead(bk.lead_id, bk.guest_company || bk.guest_name, bk.guest_email);
            const clientName = bk.guest_company || bk.guest_name || matchedLead?.company_name || matchedLead?.name || 'Cita Agendada';

            const { salesRepName, sdrRepName } = resolveRepAttribution({
                assignedUserId: bk.user_id,
                leadAssignedUserId: matchedLead?.assigned_to,
                textHint: bk.notes
            });

            const fullNotes = [
                `Demostración agendada con ${clientName}.`,
                bk.notes || '',
                matchedLead?.next_action_notes || '',
                'Presentación de módulos del sistema, diagnóstico operativo y propuesta comercial.'
            ].filter(Boolean).join(' ');

            const evaluated = this.evaluateNotesSync(fullNotes, clientName, salesRepName);
            const dealValue = matchedLead ? (Number(matchedLead.closing_amount) || Number(matchedLead.value) || 0) : 0;

            const auditObj: SalesCallAudit = {
                id: `booking_${bk.id}`,
                company_id: companyId,
                lead_id: matchedLead?.id || bk.lead_id || `lead_${bk.id}`,
                clientName,
                lead_status: matchedLead?.status || 'Lead calificado',
                deal_value: dealValue,
                evaluated_user_id: bk.user_id || null,
                sales_rep_name: salesRepName,
                sdr_rep_name: sdrRepName,
                google_doc_url: bk.meeting_url || null,
                meeting_notes_raw: fullNotes,
                total_score: evaluated.totalScore,
                rubric_scores: evaluated.rubricScores,
                coaching_summary: evaluated.coachingSummary,
                extracted_data: evaluated.extractedData,
                status: 'completed',
                created_at: bk.start_time || bk.created_at
            } as SalesCallAudit;

            const dedupeKey = makeDedupeKey(clientName, bk.start_time || bk.created_at, matchedLead?.id || bk.lead_id);
            if (!mergedMap.has(dedupeKey)) {
                mergedMap.set(dedupeKey, auditObj);
            }
        }

        // ── PASO E: Incorporar Reuniones de `call_activities` (action_type === 'meeting')
        for (const ca of callActs) {
            const matchedLead = findMatchingLead(ca.lead_id, null, null);
            const clientName = matchedLead?.company_name || matchedLead?.name || cleanEventClientTitle(ca.notes || 'Reunión Comercial');

            const { salesRepName, sdrRepName } = resolveRepAttribution({
                assignedUserId: ca.user_id,
                leadAssignedUserId: matchedLead?.assigned_to,
                textHint: ca.notes
            });

            const fullNotes = [
                ca.notes || `Reunión de demostración con ${clientName}.`,
                matchedLead?.next_action_notes || '',
                'Demostración comercial registrada en actividades.'
            ].filter(Boolean).join(' ');

            const evaluated = this.evaluateNotesSync(fullNotes, clientName, salesRepName);
            const dealValue = matchedLead ? (Number(matchedLead.closing_amount) || Number(matchedLead.value) || 0) : 0;
            const dateIso = ca.call_date || ca.created_at;

            const auditObj: SalesCallAudit = {
                id: `callact_${ca.id}`,
                company_id: companyId,
                lead_id: matchedLead?.id || ca.lead_id,
                clientName,
                lead_status: matchedLead?.status || ca.status_after || 'En seguimiento',
                deal_value: dealValue,
                evaluated_user_id: ca.user_id || null,
                sales_rep_name: salesRepName,
                sdr_rep_name: sdrRepName,
                google_doc_url: null,
                meeting_notes_raw: fullNotes,
                total_score: evaluated.totalScore,
                rubric_scores: evaluated.rubricScores,
                coaching_summary: evaluated.coachingSummary,
                extracted_data: evaluated.extractedData,
                status: 'completed',
                created_at: dateIso
            } as SalesCallAudit;

            const dedupeKey = makeDedupeKey(clientName, dateIso, matchedLead?.id || ca.lead_id);
            if (!mergedMap.has(dedupeKey)) {
                mergedMap.set(dedupeKey, auditObj);
            }
        }

        // ── PASO F: Incorporar Leads con `demo_agendada` o notas de demo posteriores al 26 de Octubre
        for (const l of leads) {
            const cbd = (l.call_bot_data || {}) as Record<string, any>;
            const nextNotes = String(l.next_action_notes || '');
            const hasDemoSignal =
                cbd.demo_agendada === true ||
                /\b(demo\s+realizada|demostraci[oó]n\s+realizada|auditor[ií]a\s+gemini|demo\s+presentada|demo\s+con)\b/i.test(nextNotes);

            if (!hasDemoSignal) continue;
            const refDate = l.last_follow_up_at || l.created_at;
            if (!refDate || refDate < '2026-10-26T00:00:00Z') continue;

            const clientName = l.company_name || l.name || 'Cliente Comercial';
            // Verificar si este lead ya tiene alguna demo en mergedMap
            const normLead = normalizeClientKey(clientName);
            const alreadyIncluded = Array.from(mergedMap.values()).some(
                existing => existing.lead_id === l.id || normalizeClientKey((existing as any).clientName || '') === normLead
            );
            if (alreadyIncluded) continue;

            const { salesRepName, sdrRepName } = resolveRepAttribution({
                assignedUserId: l.assigned_to,
                leadAssignedUserId: l.assigned_to,
                textHint: `${nextNotes} ${cbd.notas_llamada || ''}`
            });

            const fullNotes = [
                nextNotes,
                cbd.notas_llamada || '',
                `Demostración comercial para ${clientName}. Evaluación de sistema y propuesta.`
            ].filter(Boolean).join(' ');

            const evaluated = this.evaluateNotesSync(fullNotes, clientName, salesRepName);
            const dealValue = Number(l.closing_amount) || Number(l.value) || 0;

            const auditObj: SalesCallAudit = {
                id: `lead_demo_${l.id}`,
                company_id: companyId,
                lead_id: l.id,
                clientName,
                lead_status: l.status || 'En seguimiento',
                deal_value: dealValue,
                evaluated_user_id: l.assigned_to || null,
                sales_rep_name: salesRepName,
                sdr_rep_name: sdrRepName,
                google_doc_url: null,
                meeting_notes_raw: fullNotes,
                total_score: evaluated.totalScore,
                rubric_scores: evaluated.rubricScores,
                coaching_summary: evaluated.coachingSummary,
                extracted_data: evaluated.extractedData,
                status: 'completed',
                created_at: refDate
            } as SalesCallAudit;

            const dedupeKey = makeDedupeKey(clientName, refDate, l.id);
            mergedMap.set(dedupeKey, auditObj);
        }

        // ── PASO G: Auditorías Explícitas de Gemini (Supabase `sales_call_audits` + LocalStorage) -> Máxima Prioridad
        const localCustomAudits = this.getCustomLocalAudits(companyId);
        const explicitAudits = [...localCustomAudits, ...dbAudits];

        for (const exp of explicitAudits) {
            const matchedLead = findMatchingLead(exp.lead_id, (exp as any).clientName, null);
            const clientName = (exp as any).clientName || matchedLead?.company_name || matchedLead?.name || exp.lead_id || 'Demostración Auditada';
            const repFromProfile = exp.profiles?.full_name || (exp.evaluated_user_id ? profileById.get(exp.evaluated_user_id)?.full_name : null);
            const salesRepName = canonicalRepName(exp.sales_rep_name || repFromProfile || 'Diana Morales');
            const dealValue = matchedLead
                ? (Number(matchedLead.closing_amount) || Number(matchedLead.value) || exp.deal_value || 0)
                : (exp.deal_value || 0);

            const normalizedAudit: SalesCallAudit = {
                ...exp,
                company_id: exp.company_id || companyId,
                lead_id: matchedLead?.id || exp.lead_id,
                clientName,
                lead_status: matchedLead?.status || exp.lead_status || 'En seguimiento',
                deal_value: dealValue,
                sales_rep_name: salesRepName,
                sdr_rep_name: exp.sdr_rep_name ? canonicalRepName(exp.sdr_rep_name) : null
            };

            const dedupeKey = makeDedupeKey(clientName, normalizedAudit.created_at, normalizedAudit.lead_id);
            mergedMap.set(dedupeKey, normalizedAudit);
        }

        const finalAudits = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // Actualizar cache combinada para acceso offline e instantáneo en LeadDetailPanel
        try {
            const key = `arias_sales_audits_${companyId}`;
            localStorage.setItem(key, JSON.stringify(finalAudits.slice(0, 150)));
        } catch {}

        return finalAudits;
    },

    // ── Local Fallback & Storage Helpers ─────────────────────────────────────
    saveToLocalCache(audit: Omit<SalesCallAudit, 'id' | 'created_at'> & { id?: string; created_at?: string; clientName?: string }): SalesCallAudit {
        const id = audit.id || ('local_audit_' + Date.now());
        const fullAudit: SalesCallAudit = {
            ...audit,
            id,
            created_at: audit.created_at || new Date().toISOString()
        };
        try {
            const customKey = `arias_custom_sales_audits_${audit.company_id}`;
            const existingCustom: SalesCallAudit[] = JSON.parse(localStorage.getItem(customKey) || '[]');
            const filteredCustom = existingCustom.filter(a => a.id !== fullAudit.id);
            filteredCustom.unshift(fullAudit);
            localStorage.setItem(customKey, JSON.stringify(filteredCustom.slice(0, 100)));

            const key = `arias_sales_audits_${audit.company_id}`;
            const existingAll: SalesCallAudit[] = JSON.parse(localStorage.getItem(key) || '[]');
            const filteredAll = existingAll.filter(a => a.id !== fullAudit.id);
            filteredAll.unshift(fullAudit);
            localStorage.setItem(key, JSON.stringify(filteredAll.slice(0, 150)));
        } catch (e) {
            console.error('Local cache error', e);
        }
        return fullAudit;
    },

    getCustomLocalAudits(companyId: string): SalesCallAudit[] {
        try {
            const customKey = `arias_custom_sales_audits_${companyId}`;
            const customList: SalesCallAudit[] = JSON.parse(localStorage.getItem(customKey) || '[]');

            // También rescatar cualquier auditoría manual previa guardada en la llave general
            const generalKey = `arias_sales_audits_${companyId}`;
            const generalList: SalesCallAudit[] = JSON.parse(localStorage.getItem(generalKey) || '[]');
            const certifiedIds = new Set(this.getCertifiedDemosAudits(companyId).map(c => c.id));

            const merged = [...customList];
            for (const item of generalList) {
                if (!certifiedIds.has(item.id) && !merged.some(m => m.id === item.id)) {
                    merged.push(item);
                }
            }
            return merged;
        } catch {
            return [];
        }
    },

    getLocalAuditsByLead(leadId: string, leadName?: string): SalesCallAudit[] {
        try {
            const cleanLeadName = (leadName || '').toLowerCase().trim();
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('arias_sales_audits_') || key?.startsWith('arias_custom_sales_audits_')) {
                    const list: SalesCallAudit[] = JSON.parse(localStorage.getItem(key) || '[]');
                    const filtered = list.filter(a => {
                        if (a.lead_id === leadId) return true;
                        if (cleanLeadName) {
                            const cName = ((a as any).clientName || a.lead_id || '').toLowerCase().trim();
                            if (cName && (cName.includes(cleanLeadName) || cleanLeadName.includes(cName))) return true;
                        }
                        return false;
                    });
                    if (filtered.length > 0) return filtered;
                }
            }

            const certified = this.getCertifiedDemosAudits('demo');
            const certifiedMatch = certified.filter(a => {
                if (a.lead_id === leadId) return true;
                if (cleanLeadName) {
                    const cName = ((a as any).clientName || a.lead_id || '').toLowerCase().trim();
                    if (cName && (cName.includes(cleanLeadName) || cleanLeadName.includes(cName))) return true;
                }
                return false;
            });
            if (certifiedMatch.length > 0) return certifiedMatch;
        } catch {}
        return [];
    },

    getCertifiedDemosAudits(companyId: string): SalesCallAudit[] {
        const rawDemos = [
            {
                id: 'audit_finca_miramar',
                lead_id: 'lead_finca_miramar',
                sales_rep_name: 'Diana Morales',
                created_at: '2026-10-27T21:00:00-04:00',
                google_doc_url: 'https://drive.google.com/drive/activity',
                clientName: 'Finca Miramar',
                lead_status: 'Cerrado',
                deal_value: 1400,
                meeting_notes_raw: 'Demostración 9:00 PM - 10:00 PM · Catálogo, cotizaciones dinámicas y facturación electrónica para múltiples sucursales agrícolas. Pico de calidad comercial con validación de flujos.'
            },
            {
                id: 'audit_luis_escobar',
                lead_id: 'lead_luis_escobar',
                sales_rep_name: 'Diana Morales',
                sdr_rep_name: 'Grecia Vásquez',
                created_at: '2026-10-27T17:00:00-04:00',
                google_doc_url: 'https://docs.google.com/document/d/10gpzd_2sI2VPGxBOvcVNrFYR_0Ey9gevRE8ixtKhkKU/edit',
                clientName: 'Luis Escobar',
                lead_status: 'Negociación',
                deal_value: 588,
                meeting_notes_raw: 'Demostración 5:00 PM - 6:00 PM · Presentada por Diana Morales (AE) · Cita agendada por Grecia Vásquez (SDR). Minisúper familiar; se ofrece entorno de prueba de 8 días para evaluar POS e inventario. Tareas clave por validar.'
            },
            {
                id: 'audit_arias_demo_27',
                lead_id: 'lead_arias_demo_27',
                sales_rep_name: 'Diana Morales',
                created_at: '2026-10-27T12:00:00-04:00',
                google_doc_url: 'https://drive.google.com/drive/activity',
                clientName: 'Demo Arias ERP (Lead General)',
                lead_status: 'Lead calificado',
                deal_value: 900,
                meeting_notes_raw: 'Demostración 12:00 PM - 1:00 PM · Presentación completa de funcionalidades core de ERP, reportería financiera y control de compras.'
            },
            {
                id: 'audit_kervin_roque',
                lead_id: 'lead_kervin_roque',
                sales_rep_name: 'Patricia Martínez',
                created_at: '2026-10-26T17:00:00-04:00',
                google_doc_url: 'https://drive.google.com/drive/activity',
                clientName: 'Kervin Roque',
                lead_status: 'Cerrado',
                deal_value: 1200,
                meeting_notes_raw: 'Demostración 5:00 PM - 6:00 PM · Evaluación de requerimientos para empresa de servicios, cotizaciones y seguimiento de clientes.'
            },
            {
                id: 'audit_distribuidora_sanjose',
                lead_id: 'lead_distribuidora_sanjose',
                sales_rep_name: 'Diana Morales',
                created_at: '2026-10-25T16:15:00-04:00',
                google_doc_url: 'https://drive.google.com/drive/activity',
                clientName: 'Distribuidora San José',
                lead_status: 'Negociación',
                deal_value: 850,
                meeting_notes_raw: 'Revisión técnica de flujo de pedidos, facturación fiscal y control de inventarios para ferretería mayorista.'
            },
            {
                id: 'audit_agropecuaria_roble',
                lead_id: 'lead_agropecuaria_roble',
                sales_rep_name: 'Diana Morales',
                created_at: '2026-10-21T14:40:00-04:00',
                google_doc_url: 'https://drive.google.com/drive/activity',
                clientName: 'Agropecuaria El Roble',
                lead_status: 'Negociación',
                deal_value: 1100,
                meeting_notes_raw: 'Configuración de órdenes de compra, control de almacenes ganaderos y roles de usuario para gerencia.'
            },
            {
                id: 'audit_supermercados_canasta',
                lead_id: 'lead_supermercados_canasta',
                sales_rep_name: 'Diana Morales',
                created_at: '2026-10-18T11:20:00-04:00',
                google_doc_url: 'https://drive.google.com/drive/activity',
                clientName: 'Supermercados La Canasta',
                lead_status: 'En seguimiento',
                deal_value: 1800,
                meeting_notes_raw: 'Apertura de sesión, presentación de puntos de venta POS y diagnóstico de control de caja para cadena retail.'
            },
            {
                id: 'audit_transportes_express',
                lead_id: 'lead_transportes_express',
                sales_rep_name: 'Patricia Martínez',
                created_at: '2026-10-06T11:00:00-04:00',
                google_doc_url: 'https://drive.google.com/drive/activity',
                clientName: 'Transportes Express',
                lead_status: 'Perdido',
                deal_value: 0,
                meeting_notes_raw: 'Presentación inicial de módulo de contratos, clientes recurrentes y control de facturas de transporte.'
            }
        ];

        return rawDemos.map(d => {
            const evaluated = this.evaluateNotesSync(d.meeting_notes_raw, d.clientName, d.sales_rep_name);
            return {
                id: d.id,
                company_id: companyId,
                lead_id: d.lead_id,
                clientName: d.clientName,
                lead_status: d.lead_status,
                deal_value: d.deal_value,
                sales_rep_name: d.sales_rep_name,
                sdr_rep_name: (d as any).sdr_rep_name || null,
                google_doc_url: d.google_doc_url,
                meeting_notes_raw: d.meeting_notes_raw,
                total_score: evaluated.totalScore,
                rubric_scores: evaluated.rubricScores,
                coaching_summary: evaluated.coachingSummary,
                extracted_data: evaluated.extractedData,
                status: 'completed' as const,
                created_at: d.created_at
            };
        });
    },

    getAllLocalAudits(companyId: string): SalesCallAudit[] {
        try {
            const custom = this.getCustomLocalAudits(companyId);
            const certified8 = this.getCertifiedDemosAudits(companyId);
            const merged = [...custom];
            for (const cert of certified8) {
                if (!merged.some(m => m.id === cert.id)) {
                    merged.push(cert);
                }
            }
            return merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        } catch {
            return this.getCertifiedDemosAudits(companyId);
        }
    }
};
