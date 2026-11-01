// src/types/salesExcellence.ts
// Standard Types & Constants for ARIAS Sales Excellence & Gemini Audits

export interface RubricCriterionScore {
    id: string;
    name: string;
    max_points: number;
    score: number; // 0, 50% or 100% of max_points
    evidence_quote: string;
    status: 'pass' | 'coaching' | 'fail' | 'unverifiable';
    recommendation: string;
}

export interface AuditCoachingSummary {
    strength: string;
    critical_gap: string;
    recommended_roleplay: string;
    immediate_action: string;
    target_date_for_coaching?: string;
}

export interface ExtractedLeadData {
    pain_point?: string;
    estimated_cost?: string;
    decision_maker?: string;
    decision_date?: string;
    next_step?: string;
    next_date?: string;
    competitor_or_system?: string;
    objection_detected?: string;
    trial_requested?: boolean;
    trial_success_criteria?: string[];
}

export interface SalesCallAudit {
    id: string;
    company_id: string;
    lead_id: string;
    evaluated_user_id?: string | null;
    sales_rep_name?: string | null;
    sdr_rep_name?: string | null; // Nombre de la SDR / agendadora de la cita
    auditor_id?: string | null;
    google_doc_url?: string | null;
    meeting_notes_raw: string;
    total_score: number; // 0 - 100
    rubric_scores: RubricCriterionScore[];
    coaching_summary: AuditCoachingSummary;
    extracted_data: ExtractedLeadData;
    status: 'completed' | 'draft' | 'reviewed';
    clientName?: string;
    lead_status?: string | null;
    deal_value?: number | null;
    created_at: string;
    updated_at?: string;
    profiles?: {
        full_name?: string | null;
        email?: string | null;
        avatar_url?: string | null;
    };
}

export interface LiveDemoQuestion {
    id: number;
    question: string;
    category: 'Diagnóstico' | 'Impacto Económico' | 'Sistema Actual' | 'Decisor' | 'Tiempos' | 'Confianza';
    purpose: string;
    exampleHint: string;
}

export interface ObjectionScript {
    id: string;
    label: string;
    triggerWords: string[];
    dangerWarning: string;
    listenStep: string;
    probeQuestion: string;
    decisionScript: string;
}

// ─── OFICIAL: Rúbrica de 100 Puntos (Manual ARIAS Octubre 2026) ───────────────
export const OFFICIAL_ARIAS_RUBRIC: { id: string; name: string; max_points: number; description: string }[] = [
    {
        id: 'prep_agenda',
        name: 'Preparación y agenda',
        max_points: 10,
        description: 'Abre con resumen del problema del cliente y acuerda agenda de 2-3 flujos relevantes.'
    },
    {
        id: 'diagnosis_open_questions',
        name: 'Diagnóstico y preguntas abiertas',
        max_points: 15,
        description: 'Pregunta qué proceso genera errores/tiempo perdido y qué sistema usa hoy.'
    },
    {
        id: 'quantified_pain_cost',
        name: 'Impacto del problema cuantificado o explorado',
        max_points: 10,
        description: 'Explora cuánto cuesta mensualmente el problema en dinero, tiempo o pérdidas.'
    },
    {
        id: 'decision_maker_process',
        name: 'Decisor y proceso de compra',
        max_points: 10,
        description: 'Identifica quién participa en la aprobación final, presupuesto y fecha de implementación.'
    },
    {
        id: 'value_demo',
        name: 'Demo relevante y validación de valor',
        max_points: 15,
        description: 'Demuestra 2-3 flujos reales (no paseo de pantallas) y pide confirmación: «¿Esto resuelve el problema que describió?»'
    },
    {
        id: 'objections_listen_method',
        name: 'Objeciones abordadas con evidencia (Método ESCUCHAR)',
        max_points: 15,
        description: 'Escucha sin interrumpir, sondea causa real, no inventa descuentos ni promesas no validadas.'
    },
    {
        id: 'clear_decision_request',
        name: 'Solicitud clara de decisión',
        max_points: 10,
        description: 'Cierre condicionado y persistente: «Si resolvemos ese punto, ¿estaría listo para avanzar?»'
    },
    {
        id: 'next_step_accepted_dated',
        name: 'Próximo paso aceptado y fechado',
        max_points: 10,
        description: 'Compromiso verificable con fecha y hora pactada (reunión de revisión o entrega).'
    },
    {
        id: 'crm_discipline',
        name: 'CRM completo y veraz',
        max_points: 5,
        description: 'Campos obligatorios registrados con responsable y fecha acordada dentro de 1 día hábil.'
    }
];

// ─── OFICIAL: Las 7 Preguntas de Descubrimiento Obligatorias ─────────────────
export const ARIAS_DISCOVERY_QUESTIONS: LiveDemoQuestion[] = [
    {
        id: 1,
        question: '¿Qué proceso le está generando más errores o tiempo perdido hoy?',
        category: 'Diagnóstico',
        purpose: 'Encontrar el dolor crítico y no asumir lo que el cliente necesita.',
        exampleHint: 'Ej: Robos en despacho, inventario desfasado, facturación manual.'
    },
    {
        id: 2,
        question: '¿Cuánto le cuesta mensualmente este problema en dinero o pérdidas?',
        category: 'Impacto Económico',
        purpose: 'Cuantificar el dolor antes de hablar de precios o cotizar.',
        exampleHint: 'Ej: $500/mes en mermas, 20 horas extra semanales de personal.'
    },
    {
        id: 3,
        question: '¿Qué sistema o método usa hoy y qué debe mejorar para justificar el cambio?',
        category: 'Sistema Actual',
        purpose: 'Conocer a la competencia y las expectativas del cliente.',
        exampleHint: 'Ej: Excel, libreta, software antiguo sin soporte.'
    },
    {
        id: 4,
        question: '¿Quién más además de usted participa en la aprobación del presupuesto y compra?',
        category: 'Decisor',
        purpose: 'Evitar dar demos a no-decisores sin una ruta de acceso al decisor.',
        exampleHint: 'Ej: Socio, gerente de finanzas, junta directiva.'
    },
    {
        id: 5,
        question: '¿Para cuándo necesitan tener este sistema implementado y funcionando?',
        category: 'Tiempos',
        purpose: 'Establecer urgencia real y plan de implementación.',
        exampleHint: 'Ej: Antes del cierre de mes, en 2 semanas.'
    },
    {
        id: 6,
        question: '¿Qué tendría que demostrar ARIAS en esta sesión para ganar su total confianza?',
        category: 'Confianza',
        purpose: 'Fijar el criterio de victoria antes de mostrar una sola pantalla.',
        exampleHint: 'Ej: Que el cuadre de caja sea exacto en 3 clics.'
    },
    {
        id: 7,
        question: '¿Esto que acaba de ver resuelve el problema específico que me describió?',
        category: 'Diagnóstico',
        purpose: 'Pregunta obligatoria de validación de valor post-demo.',
        exampleHint: 'Hacer esta pregunta antes de pasar a precios o cotización.'
    }
];

// ─── OFICIAL: Matriz de Objeciones (Método ESCUCHAR) ──────────────────────────
export const ARIAS_OBJECTION_SCRIPTS: ObjectionScript[] = [
    {
        id: 'price',
        label: '💰 Precio / Descuento (Caso Roberto Medina)',
        triggerWords: ['caro', 'descuento', 'presupuesto', 'muy alto', 'rebaja', 'precio'],
        dangerWarning: '⛔ PROHIBIDO: Ofrecer descuentos antes de entender la causa o inventar urgencia/escasez ficticia.',
        listenStep: 'Escucha sin interrumpir y confirma comprensión.',
        probeQuestion: '«Entiendo perfectamente. ¿El valor está fuera de su presupuesto total o comparado contra otra opción?»',
        decisionScript: '«Si resolvemos el costo dentro de lo autorizado por gerencia, ¿qué otra condición faltaría para programar la instalación?»'
    },
    {
        id: 'trial',
        label: '📦 Petición de Prueba Gratis (Caso Luis Escobar)',
        triggerWords: ['prueba', 'probar', 'demo gratis', 'días gratis', 'evaluar'],
        dangerWarning: '⛔ ALERTA: La activación de prueba NO equivale a una venta. Exige 3 criterios de éxito y fecha de decisión.',
        listenStep: 'Acepta la prueba solo si hay compromiso de compra condicionado.',
        probeQuestion: '«Con gusto abrimos un entorno de 8 días. ¿Cuáles son las 3 tareas específicas que necesita verificar para tomar la decisión?»',
        decisionScript: '«Pactemos la reunión de revisión final para el día 8 a las 3:00 PM con quien aprueba la compra. Si las 3 tareas cumplen, ¿avanzamos con la contratación?»'
    },
    {
        id: 'quote_alone',
        label: '📋 «Mándame la cotización y yo te aviso» (Caso Nehemías Regalo)',
        triggerWords: ['mándame la cotización', 'envíame los precios', 'yo te aviso', 'lo voy a evaluar'],
        dangerWarning: '⛔ ALERTA: Cotización enviada ≠ Venta ganada. Nunca mandes un PDF al aire sin agendar reunión de revisión.',
        listenStep: 'Prepara la propuesta formal pero vincula la entrega a una sesión en vivo.',
        probeQuestion: '«Con gusto le preparo la propuesta formal con el alcance exacto. Para asegurar que incluya solo lo que necesitan...»',
        decisionScript: '«¿Podemos reservar 20 minutos este jueves a las 10:00 AM para revisarla en vivo junto con la persona que aprueba el presupuesto?»'
    },
    {
        id: 'missing_feature',
        label: '⚙️ Falta una función técnica / Ajuste (Caso Moisés Efigenio)',
        triggerWords: ['fletes', 'consolidación', 'no tiene esa función', 'le falta', 'desarrollo a medida'],
        dangerWarning: '⛔ PROHIBIDO: Prometer funcionalidades que no están en el CRM por desesperación de cerrar.',
        listenStep: 'Anota el caso de uso exacto con ejemplos reales del cliente.',
        probeQuestion: '«Entiendo la necesidad de ese flujo. ¿Cómo lo resuelven actualmente y qué impacto tiene en su operación?»',
        decisionScript: '«Validaremos este escenario con el equipo técnico para no prometer lo que no esté listo. Agendemos seguimiento para el viernes con el reporte de factibilidad.»'
    },
    {
        id: 'decision_maker_missing',
        label: '👥 «Tengo que consultarlo con mi socio / jefe»',
        triggerWords: ['consultarlo', 'mi socio', 'mi jefe', 'el dueño', 'junta directiva'],
        dangerWarning: 'No presiones al interlocutor; facilítale el camino para incluir al decisor.',
        listenStep: 'Valida que el interlocutor actual sí esté convencido.',
        probeQuestion: '«Desde su punto de vista personal, ¿usted recomendaría que su empresa implemente esta solución?»',
        decisionScript: '«Excelente. Para evitarle a usted la carga de explicar la parte técnica a su socio, ¿podemos reservar 15 minutos juntos este miércoles?»'
    }
];
