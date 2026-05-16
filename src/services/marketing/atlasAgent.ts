/**
 * Atlas — Data Intelligence Agent
 *
 * Analyzes lead data quality using ONLY columns verified to exist in production:
 * id, name, company_name, email, phone, status, priority, value, assigned_to,
 * created_at, source, next_followup_date, industry, contact_count, address
 *
 * NO RPC calls. NO new columns. NO new tables. Direct table reads only.
 */
import { supabase } from '../supabase';
import { auditTrailService } from './auditTrail';

// Columns verified to exist in production leads table
const SAFE_LEAD_FIELDS = 'id, name, company_name, email, phone, status, priority, value, assigned_to, created_at, source, next_followup_date, industry, contact_count, address';

export interface DataIssue {
    field: string;
    label: string;
    severity: 'critical' | 'warning' | 'info';
    fix?: string;
}

export interface LeadDataReport {
    lead_id: string;
    lead_name: string;
    company_name: string | null;
    status: string;
    value: number;
    completeness_score: number; // 0–100
    issues: DataIssue[];
    priority_fix: string;
}

export interface AtlasSummary {
    total_leads: number;
    healthy: number;           // score >= 80
    needs_attention: number;   // score 50–79
    critical: number;          // score < 50
    avg_score: number;
    reports: LeadDataReport[];
}

/** Score a single lead based on verified columns */
function scoreLead(lead: Record<string, unknown>): LeadDataReport {
    const issues: DataIssue[] = [];
    let score = 100;

    // Critical — without these, the lead is almost useless
    if (!lead.name || String(lead.name).trim() === '') {
        issues.push({ field: 'name', label: 'Sin nombre', severity: 'critical', fix: 'Agregar nombre completo' });
        score -= 30;
    }
    if (!lead.phone || String(lead.phone).trim() === '') {
        issues.push({ field: 'phone', label: 'Sin teléfono', severity: 'critical', fix: 'Buscar número en LinkedIn o web' });
        score -= 25;
    }
    if (!lead.email || String(lead.email).trim() === '') {
        issues.push({ field: 'email', label: 'Sin email', severity: 'warning', fix: 'Obtener email de contacto' });
        score -= 15;
    }

    // Warnings — reduce qualification quality
    if (!lead.company_name || String(lead.company_name).trim() === '') {
        issues.push({ field: 'company_name', label: 'Sin empresa', severity: 'warning', fix: 'Identificar empresa del lead' });
        score -= 10;
    }
    if (!lead.value || Number(lead.value) === 0) {
        issues.push({ field: 'value', label: 'Sin valor estimado', severity: 'warning', fix: 'Asignar valor del negocio' });
        score -= 10;
    }
    if (!lead.source || String(lead.source).trim() === '') {
        issues.push({ field: 'source', label: 'Sin fuente de origen', severity: 'info', fix: 'Registrar cómo llegó este lead' });
        score -= 5;
    }
    if (!lead.next_followup_date) {
        issues.push({ field: 'next_followup_date', label: 'Sin próximo seguimiento', severity: 'warning', fix: 'Programar fecha de contacto' });
        score -= 5;
    }

    const finalScore = Math.max(0, score);

    const priority_fix = issues.length > 0
        ? issues.sort((a, b) => {
            const order = { critical: 0, warning: 1, info: 2 };
            return order[a.severity] - order[b.severity];
        })[0].fix || 'Sin acciones pendientes'
        : 'Datos completos';

    return {
        lead_id: String(lead.id),
        lead_name: String(lead.name || 'Sin nombre'),
        company_name: lead.company_name ? String(lead.company_name) : null,
        status: String(lead.status || 'Prospecto'),
        value: Number(lead.value || 0),
        completeness_score: finalScore,
        issues,
        priority_fix,
    };
}

export const atlasAgentService = {
    /**
     * Analyze all leads for data quality.
     * Uses select() with verified columns only — safe for production.
     * Returns empty summary on any error (never breaks the UI).
     */
    async analyzeDataQuality(companyId: string): Promise<AtlasSummary> {
        try {
            const { data: leads, error } = await supabase
                .from('leads')
                .select(SAFE_LEAD_FIELDS)
                .eq('company_id', companyId)
                .order('created_at', { ascending: false })
                .limit(500); // Cap at 500 for performance

            if (error) {
                console.error('[Atlas] analyzeDataQuality error:', error.message);
                return { total_leads: 0, healthy: 0, needs_attention: 0, critical: 0, avg_score: 0, reports: [] };
            }

            const rawLeads = (leads || []) as Record<string, unknown>[];
            const reports = rawLeads.map(scoreLead);

            const healthy = reports.filter(r => r.completeness_score >= 80).length;
            const needs_attention = reports.filter(r => r.completeness_score >= 50 && r.completeness_score < 80).length;
            const critical = reports.filter(r => r.completeness_score < 50).length;
            const avg_score = reports.length > 0
                ? Math.round(reports.reduce((s, r) => s + r.completeness_score, 0) / reports.length)
                : 0;

            try {
                auditTrailService.logDecision({
                    companyId,
                    agentName: 'atlas',
                    decisionType: 'data_enriched',
                    title: 'Análisis de calidad de datos',
                    reasoning: `Analizados ${reports.length} leads. Score promedio: ${avg_score}%. Críticos: ${critical}. Atención: ${needs_attention}.`,
                    confidence: 95,
                    affectedLeadsCount: reports.length,
                });
            } catch { /* audit log errors are silent */ }

            return { total_leads: reports.length, healthy, needs_attention, critical, avg_score, reports };
        } catch (err) {
            console.error('[Atlas] Unexpected error:', err);
            return { total_leads: 0, healthy: 0, needs_attention: 0, critical: 0, avg_score: 0, reports: [] };
        }
    },

    /** Returns only leads that need attention (score < 80), sorted worst first */
    async getCriticalLeads(companyId: string): Promise<LeadDataReport[]> {
        const summary = await this.analyzeDataQuality(companyId);
        return summary.reports
            .filter(r => r.completeness_score < 80)
            .sort((a, b) => a.completeness_score - b.completeness_score);
    },
};
