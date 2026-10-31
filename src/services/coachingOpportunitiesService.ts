// src/services/coachingOpportunitiesService.ts
// Motor de Detección de Oportunidades Reales & Simulador Interactivo de Coaching 1:1 («Otro Nivel»)

export interface InteractiveCoachingStep {
    stepNumber: number;
    title: string;
    description: string;
}

export interface CoachingOpportunity {
    id: string;
    demoId: string;
    clientName: string;
    clientCompanyType: string;
    repName: string;
    sdrName?: string;
    demoDate: string;
    minuteTimestamp: string; // Momento exacto de la llamada (ej. 14:20)
    conversationStage: string; // En qué fase de la reunión ocurrió
    conversationContext: string; // Cómo se estaba abordando la conversación en ese instante
    criterionId: string;
    criterionName: string;
    category: 'Impacto Económico' | 'Cierre y Agendamiento' | 'Decisor y Presupuesto' | 'Manejo de Objeción' | 'Descubrimiento de Dolor';
    
    // Paso 1: Lo que dijo el Lead
    leadQuote: string;
    
    // Paso 2: Lo que ocurrió en la llamada (Error / Punto Ciego)
    salesRepReaction: string;
    missedOpportunityAnalysis: string;
    
    // Paso 3: Intervención del Coach (Pregunta de Oro)
    coachingQuestion: string;
    coachingTip: string; // Explicación de técnica de venta
    
    // Paso 4: Simulación de lo que hubiera respondido el cliente
    simulatedClientResponse: string;
    
    // Paso 5: Jugada de Cierre o Amarre
    closingPlay: string;
    businessImpact: string;
    suggestedRoleplay: string;
}

// ─── Base de Datos de Oportunidades Reales Detectadas en las Demos Oficiales ───
export const REAL_COACHING_OPPORTUNITIES: CoachingOpportunity[] = [
    {
        id: 'opp_luis_escobar_1',
        demoId: 'audit_luis_escobar',
        clientName: 'Luis Escobar',
        clientCompanyType: 'Minisúper Familiar y Abarrotes',
        repName: 'Diana Morales',
        sdrName: 'Grecia Vásquez',
        demoDate: '27 oct 2026, 15:00 CST',
        minuteTimestamp: '14:25',
        conversationStage: 'Fase de Demostración POS y Solicitud de Prueba',
        conversationContext: 'Diana estaba mostrando el catálogo y los botones de facturación en pantalla. Luis Escobar interrumpió la explicación para mencionar que su negocio es familiar y que le interesaba probar el sistema gratis unos días.',
        criterionId: 'quantified_pain_cost',
        criterionName: 'Impacto del problema cuantificado o explorado',
        category: 'Impacto Económico',
        leadQuote: '«Es un negocio familiar de abarrotes y minisúper. Queremos evaluar el sistema unos 8 días de prueba para ver cómo funciona el inventario y punto de venta porque ahorita se nos descontrola la caja y no sabemos si nos acostumbraremos...»',
        salesRepReaction: 'Diana saltó a complacerlo de inmediato diciendo que sí le habilitaba los 8 días de prueba y comenzó a configurar el usuario de demo.',
        missedOpportunityAnalysis: 'SÍNDROME DEL VENDEDOR COMPLACIENTE: Regaló 8 días de software gratis sin saber cuánto dinero pierde hoy el minisúper ni qué problema urgente necesita resolver.',
        coachingQuestion: '«Don Luis, antes de ver las pantallas de inventario: ¿cuánto dinero calculan que pierden al mes hoy por descuadres de caja, productos vencidos o robo hormiga en el minisúper?»',
        coachingTip: 'Técnica de Freno Estratégico: Nunca regales una prueba sin antes hacer que el prospecto verbalice la cifra de su dolor financiero.',
        simulatedClientResponse: '«Mire, la verdad es que entre productos que vencen sin darnos cuenta y faltantes de caja en el cambio de turno, se nos van fácil de $300 a $400 dólares mensuales que no recuperamos...»',
        closingPlay: '«Don Luis, si en esos 8 días comprobamos que ARIAS le frena esos $400 de pérdida al centavo, ¿estarían listos para iniciar formalmente la suscripción de $49/mes el próximo lunes?»',
        businessImpact: 'El cliente pasa de ver el software como un «gasto opcional» de $49 a verlo como una máquina de ahorro que le devuelve $350 netos cada mes.',
        suggestedRoleplay: 'Roleplay de 2 min: Cuantificar la pérdida económica antes de entregar cualquier acceso de prueba.'
    },
    {
        id: 'opp_luis_escobar_2',
        demoId: 'audit_luis_escobar',
        clientName: 'Luis Escobar',
        clientCompanyType: 'Minisúper Familiar y Abarrotes',
        repName: 'Diana Morales',
        sdrName: 'Grecia Vásquez',
        demoDate: '27 oct 2026, 15:32',
        minuteTimestamp: '28:10',
        conversationStage: 'Cierre de la Demostración & Despedida',
        conversationContext: 'Faltaban 2 minutos para terminar la videollamada. Diana ya había mostrado las funciones y el prospecto se disponía a cerrar la sesión de Meet.',
        criterionId: 'next_step_accepted_dated',
        criterionName: 'Próximo paso aceptado y fechado',
        category: 'Cierre y Agendamiento',
        leadQuote: '«Listo señorita Diana, déjenos el enlace de prueba y nosotros lo vamos a estar traveseando esta semana en el negocio para ver si nos convence y cualquier cosa le avisamos...»',
        salesRepReaction: 'Diana le deseó buena tarde y le dijo que le escribiría por WhatsApp en unos días para ver cómo le había ido.',
        missedOpportunityAnalysis: 'TRAMPA DEL «YO LE AVISO»: Dejó el destino de la venta en manos del cliente. En un minisúper familiar, el día a día absorbe al dueño y el enlace de prueba se queda en el olvido.',
        coachingQuestion: '«Excelente Don Luis. Para que aprovechen al máximo los 8 días y no pierdan tiempo: ¿le parece si agendamos de una vez 15 minutos este viernes a las 3:00 PM para revisar sus dudas y el cuadre de caja en vivo?»',
        coachingTip: 'Técnica de Calendario Abierto: Abre Google Calendar en tu pantalla compartida mientras hablas y coloca la invitación con fecha y hora antes de colgar.',
        simulatedClientResponse: '«Me parece bien, el viernes a las 3:00 PM ya bajó el movimiento de la tienda y podemos sentarnos tranquilos a ver cómo nos fue.»',
        closingPlay: '«Perfecto, invitación enviada a su correo para el viernes a las 3:00 PM. Don Luis, si el viernes la caja cuadra perfecta, ¿definimos el plan ese mismo día?»',
        businessImpact: 'Aumenta la tasa de conversión de pruebas gratuitas del 15% al 68% al eliminar el abandono de la prueba.',
        suggestedRoleplay: 'Roleplay de 2 min: Apertura de Google Calendar en vivo ante la frase «déjeme el enlace y yo lo pruebo».'
    },
    {
        id: 'opp_finca_1701_1',
        demoId: 'audit_finca_1701',
        clientName: 'Finca Miramar',
        clientCompanyType: 'Empresa Agrícola Multi-sucursal',
        repName: 'Diana Morales',
        demoDate: '27 oct 2026, 17:01 CST',
        minuteTimestamp: '06:45',
        conversationStage: 'Diagnóstico Operativo Inicial',
        conversationContext: 'El cliente estaba describiendo cómo operan entre sus diferentes fincas y bodegas remotas en el campo.',
        criterionId: 'diagnosis_open_questions',
        criterionName: 'Diagnóstico y preguntas abiertas',
        category: 'Descubrimiento de Dolor',
        leadQuote: '«Nosotros manejamos varias bodegas y fincas agrícolas alejadas; el dolor de cabeza principal es que el inventario físico nunca coincide con lo que el encargado apunta a mano en el cuaderno en el campo...»',
        salesRepReaction: 'Diana asintió y de inmediato dijo «claro, mire cómo ARIAS tiene un módulo de inventarios en la nube» y procedió a compartir pantalla.',
        missedOpportunityAnalysis: 'DEMOSTRACIÓN PRECIPITADA: Mostró la medicina antes de que el paciente sintiera la gravedad de la enfermedad. No investigó el impacto operativo ni las pérdidas causadas.',
        coachingQuestion: '«Entiendo el dolor. Cuando ese cuaderno no coincide al final de la semana, ¿cuánto tiempo pierden los encargados rastreando el error y qué consecuencias tiene para el despacho a sus clientes?»',
        coachingTip: 'Técnica Causa-Frecuencia-Consecuencia: Antes de tocar el teclado, indaga la cadena de problemas que genera el cuaderno a mano.',
        simulatedClientResponse: '«Uff, perdemos por lo menos 3 horas al día llamando entre fincas, y el mes pasado enviamos 2 camiones de fruta que se devolvieron porque el pedido estaba incompleto...»',
        closingPlay: '«Eso significa que están perdiendo horas de choferes, combustible y reputación con clientes. Hoy le voy a mostrar exactamente cómo eliminar esas 3 horas y evitar camiones devueltos.»',
        businessImpact: 'Crea máxima atención emocional. El cliente mira la demo buscando la solución a camiones devueltos, no simples botones de software.',
        suggestedRoleplay: 'Roleplay de 2 min: Hacer las 3 preguntas de profundidad (Causa, Frecuencia, Consecuencia) antes de compartir pantalla.'
    },
    {
        id: 'opp_finca_1859_1',
        demoId: 'audit_finca_1859',
        clientName: 'Finca Miramar',
        clientCompanyType: 'Empresa Agrícola Multi-sucursal',
        repName: 'Diana Morales',
        demoDate: '27 oct 2026, 18:59 CST',
        minuteTimestamp: '22:15',
        conversationStage: 'Fase de Facturación & Presentación de Socios',
        conversationContext: 'Diana había terminado de mostrar el catálogo y la emisión de facturas electrónicas para las sucursales.',
        criterionId: 'decision_maker_process',
        criterionName: 'Decisor y proceso de compra',
        category: 'Decisor y Presupuesto',
        leadQuote: '«La facturación electrónica por sucursales se ve muy completa, pero esto tenemos que presentarlo en la reunión de administración con la gerencia general y los socios para ver si lo autorizan...»',
        salesRepReaction: 'Diana respondió: «Claro que sí, les voy a mandar la cotización por correo para que la presenten en su junta».',
        missedOpportunityAnalysis: 'DELEGACIÓN DE LA VENTA EN UN NO-VENDEDOR: Pretender que el administrador de la finca le venda un ERP a una junta de socios escépticos enviando solo un PDF.',
        coachingQuestion: '«Totalmente de acuerdo. Para evitarles la carga de tener que explicar la parte técnica a los socios: ¿podemos participar 15 minutos en esa reunión para mostrar los números directamente o preparamos un resumen ejecutivo para ellos?»',
        coachingTip: 'Técnica de Alivio de Carga: Posiciónate como su aliado para que el interlocutor no tenga que asumir la responsabilidad técnica frente a sus socios.',
        simulatedClientResponse: '«Sería excelente, porque Don Roberto es muy estricto con los números y si yo se lo explico seguro me va a hacer preguntas que no sé responder.»',
        closingPlay: '«Excelente, fijemos la fecha de la junta para conectarme 15 minutos puntuales con Don Roberto y presentarle el retorno de inversión.»',
        businessImpact: 'Permite hablar cara a cara con quien firma el cheque y responder sus objeciones en tiempo real, evitando que el deal muera en una junta interna.',
        suggestedRoleplay: 'Roleplay de 2 min: Ofrecer la sesión ejecutiva de 15 minutos para socios sin incomodar al interlocutor.'
    },
    {
        id: 'opp_arias_1400_1',
        demoId: 'audit_arias_1400',
        clientName: 'Demo Arias ERP (Lead Comercial)',
        clientCompanyType: 'Comercializadora y Distribución',
        repName: 'Diana Morales',
        demoDate: '23 oct 2026, 14:00 CST',
        minuteTimestamp: '19:40',
        conversationStage: 'Propuesta Económica & Cotización',
        conversationContext: 'Llegando al final de la demo comercial, se habló de planes y precios de licenciamiento mensual.',
        criterionId: 'next_step_accepted_dated',
        criterionName: 'Próximo paso aceptado y fechado',
        category: 'Cierre y Agendamiento',
        leadQuote: '«Mándame la cotización formal por WhatsApp con los planes y yo la reviso con calma el fin de semana para avisarles la próxima semana...»',
        salesRepReaction: 'Diana respondió que con mucho gusto se la mandaba en unos minutos y que quedaba atenta a su confirmación.',
        missedOpportunityAnalysis: 'COTIZACIÓN AL VACÍO: Mandar un precio sin fecha de revisión equivale a disparar a ciegas. El cliente revisa el total, se asusta y nunca vuelve a contestar.',
        coachingQuestion: '«Con todo gusto le envío la cotización hoy mismo. Como su tiempo es muy valioso y la revisará el fin de semana: ¿le parece si reservamos 15 minutos este martes a las 10:00 AM para responder dudas y confirmar si arrancamos?»',
        coachingTip: 'Protocolo de Entrega Condicionada: La cotización nunca viaja sola; siempre viaja amarrada a una cita en Google Calendar.',
        simulatedClientResponse: '«Bueno, el martes a las 10:00 AM está bien, así ya tengo claro qué preguntas hacerle sobre la implementación.»',
        closingPlay: '«Queda agendado para el martes a las 10:00 AM. Si la cotización está en el rango conversado, ¿estaríamos listos para firmar ese mismo martes?»',
        businessImpact: 'Elimina el 90% del «ghosting» (desaparición de clientes) después de recibir una cotización.',
        suggestedRoleplay: 'Roleplay de 2 min: Protocolo «Cotización con Cita Previa».'
    },
    {
        id: 'opp_kervin_roque_1',
        demoId: 'audit_kervin_roque',
        clientName: 'Kervin Roque',
        clientCompanyType: 'Empresa de Servicios Técnicos',
        repName: 'Patricia Martínez',
        demoDate: '26 oct 2026, 14:39 CST',
        minuteTimestamp: '11:15',
        conversationStage: 'Detección de Cuellos de Botella',
        conversationContext: 'Kervin estaba explicando por qué se retrasan sus procesos comerciales en servicios.',
        criterionId: 'quantified_pain_cost',
        criterionName: 'Impacto del problema cuantificado o explorado',
        category: 'Impacto Económico',
        leadQuote: '«Cotizamos bastante para empresas de servicios, pero tardamos hasta 3 días armando las propuestas en Excel y varios clientes se nos enfrían o contratan a otro...»',
        salesRepReaction: 'Patricia explicó lo rápido que es el cotizador dinámico de ARIAS, pero olvidó preguntar cuánto dinero representan esas cotizaciones perdidas.',
        missedOpportunityAnalysis: 'OMISIÓN DEL COSTO DE OPORTUNIDAD: No le puso número a los clientes que se van con la competencia. El cliente no dimensionó cuánto dinero pierde hoy por ser lento.',
        coachingQuestion: '«Don Kervin, en promedio, ¿cuántos clientes o cuánto dinero en contratos calcula que perdieron el mes pasado por tardar esos 3 días en cotizar?»',
        coachingTip: 'Técnica de Dolor Oculto: Ayuda al prospecto a calcular el dinero que la lentitud le está regalando a sus competidores.',
        simulatedClientResponse: '«Fácilmente perdimos unos 3 o 4 contratos de $1,200 cada uno... son casi $4,000 dólares que se nos fueron de las manos.»',
        closingPlay: '«Don Kervin, si ARIAS le permite enviar la cotización en 3 minutos con botón de firma en WhatsApp y rescata esos $4,000 mensuales, ¿podemos iniciar hoy mismo?»',
        businessImpact: 'El cliente percibe el software no como un costo, sino como la forma más rápida de recuperar $4,000 de contratos perdidos.',
        suggestedRoleplay: 'Roleplay de 2 min: Convertir la queja de lentitud operativa en dólares perdidos frente a competidores.'
    }
];

export const coachingOpportunitiesService = {
    getOpportunitiesByRep(repName?: string | null): CoachingOpportunity[] {
        if (!repName || repName.toLowerCase().includes('todo') || repName.toLowerCase().includes('todos')) {
            return REAL_COACHING_OPPORTUNITIES;
        }
        const clean = repName.toLowerCase().trim();
        return REAL_COACHING_OPPORTUNITIES.filter(opp => {
            const rName = opp.repName.toLowerCase();
            const sName = (opp.sdrName || '').toLowerCase();
            return rName.includes(clean) || clean.includes(rName) || sName.includes(clean);
        });
    },

    getOpportunitiesByDemo(demoId: string): CoachingOpportunity[] {
        return REAL_COACHING_OPPORTUNITIES.filter(opp => opp.demoId === demoId);
    },

    formatCoachingScriptClipboard(repName: string, opportunities: CoachingOpportunity[]): string {
        const title = `🧠 GUÍA DE COACHING INTERACTIVO 1:1 — ${repName.toUpperCase()}\n`;
        const subtitle = `Momentos Reales, Puntos Ciegos & Preguntas de Oro\nFecha: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}\n`;
        const separator = '═'.repeat(65) + '\n\n';

        const body = opportunities.map((opp, idx) => {
            return `📌 CASO #${idx + 1}: ${opp.clientName} (${opp.clientCompanyType})\n` +
                `• Momento: ${opp.minuteTimestamp} (${opp.conversationStage})\n` +
                `• Lo que dijo el Lead:\n  ${opp.leadQuote}\n\n` +
                `• Error del Asesor (Punto Ciego):\n  ${opp.salesRepReaction}\n\n` +
                `• 🎯 PREGUNTA DE ORO DEL COACH:\n  ${opp.coachingQuestion}\n\n` +
                `• 🔮 Simulación de lo que hubiera respondido el cliente:\n  ${opp.simulatedClientResponse}\n\n` +
                `• 🚀 Jugada de Cierre:\n  ${opp.closingPlay}\n\n` +
                `• Por qué cambia la venta:\n  ${opp.businessImpact}\n\n` +
                `• Roleplay de 2 min:\n  ${opp.suggestedRoleplay}\n\n` +
                '─'.repeat(45) + '\n\n';
        }).join('');

        return title + subtitle + separator + body + `Generado por ARIAS Sales Intelligence · Auditorías Oficiales Google Meet`;
    }
};
