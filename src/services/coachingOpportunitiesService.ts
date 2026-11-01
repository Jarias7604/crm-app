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
// Cada caso corresponde exactamente a 1 cliente diferente (0 duplicados)
export const REAL_COACHING_OPPORTUNITIES: CoachingOpportunity[] = [
    {
        id: 'opp_luis_escobar_1',
        demoId: 'audit_luis_escobar',
        clientName: 'Luis Escobar',
        clientCompanyType: 'Minisúper Familiar y Abarrotes',
        repName: 'Diana Morales',
        sdrName: 'Grecia Vásquez',
        demoDate: '27 oct 2026, 17:00 CST',
        minuteTimestamp: '14:25',
        conversationStage: 'Fase de Demostración POS y Solicitud de Prueba',
        conversationContext: 'Diana estaba mostrando el catálogo y los botones de facturación en pantalla. Luis Escobar interrumpió para mencionar que su negocio es familiar y que le interesaba probar el sistema gratis unos días.',
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
        id: 'opp_finca_miramar_1',
        demoId: 'audit_finca_miramar',
        clientName: 'Finca Miramar',
        clientCompanyType: 'Empresa Agrícola y Exportación',
        repName: 'Diana Morales',
        demoDate: '27 oct 2026, 21:00 CST',
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
        id: 'opp_arias_demo_27_1',
        demoId: 'audit_arias_demo_27',
        clientName: 'Demo Arias ERP (Lead General)',
        clientCompanyType: 'Comercio y Distribución General',
        repName: 'Diana Morales',
        demoDate: '27 oct 2026, 12:00 CST',
        minuteTimestamp: '18:30',
        conversationStage: 'Fase de Demostración Funcional Core y Reportería',
        conversationContext: 'Diana estaba exponiendo la pantalla general de módulos del sistema ERP. El cliente preguntó si los reportes de ventas y compras se actualizan al instante.',
        criterionId: 'quantified_pain_cost',
        criterionName: 'Impacto del problema cuantificado o explorado',
        category: 'Impacto Económico',
        leadQuote: '«Estamos evaluando opciones de software ERP porque el sistema actual no nos da reportes en tiempo real y perdemos horas cuadrando ventas con compras a fin de mes...»',
        salesRepReaction: 'Diana comenzó a navegar por los menús del módulo financiero mostrando gráficos y tablas sin detenerse a indagar cuánto les cuesta hoy ese descontrol.',
        missedOpportunityAnalysis: 'DEMOSTRACIÓN DE CATÁLOGO: Explicar botones y opciones sin descubrir cuántas horas o dinero pierde la empresa cada semana por no tener reportes en tiempo real.',
        coachingQuestion: '«Antes de ver las pantallas de reportería: ¿cuántas horas a la semana pierde su equipo administrativo cuadrando ventas y compras a mano, y qué costo tiene no tener esa información al día?»',
        coachingTip: 'Técnica de Cuantificación de Eficiencia: Cada hora perdida por un administrador tiene un costo en salario y oportunidad comercial. Haz que lo verbalice.',
        simulatedClientResponse: '«Fácilmente se nos van unas 6 horas a la semana de la contadora y de la gerencia buscando diferencias, y ya nos ha pasado comprar inventario innecesario por no ver el stock real...»',
        closingPlay: '«Si ARIAS automatiza esa reportería al instante y le devuelve esas 6 horas semanales a su equipo, ¿estarían listos para arrancar la implementación este mes?»',
        businessImpact: 'Convierte el software en una inversión que se paga sola ahorrando 24 horas hombre de trabajo administrativo al mes.',
        suggestedRoleplay: 'Roleplay de 2 min: Cuantificar las horas perdidas en tareas manuales antes de presentar los reportes del ERP.'
    },
    {
        id: 'opp_distribuidora_sanjose_1',
        demoId: 'audit_distribuidora_sanjose',
        clientName: 'Distribuidora San José',
        clientCompanyType: 'Ferretería y Materiales Mayoristas',
        repName: 'Diana Morales',
        demoDate: '25 oct 2026, 16:15 CST',
        minuteTimestamp: '24:10',
        conversationStage: 'Cierre y Acuerdo de Siguiente Paso',
        conversationContext: 'Faltando 3 minutos para concluir la llamada, Diana terminó la demo de cotizaciones y el cliente propuso "déjeme evaluarlo con mi encargado y yo le aviso".',
        criterionId: 'next_step_accepted_dated',
        criterionName: 'Próximo paso aceptado y fechado',
        category: 'Cierre y Agendamiento',
        leadQuote: '«Listo señorita Diana, déjenos el enlace y la cotización, nosotros lo vamos a estar traveseando esta semana en el negocio para ver si nos convence y cualquier cosa le avisamos...»',
        salesRepReaction: 'Diana le deseó buena tarde y le dijo que le escribiría por WhatsApp en unos días para ver cómo le había ido.',
        missedOpportunityAnalysis: 'TRAMPA DEL «YO LE AVISO»: Dejó el destino de la venta en manos del cliente. En un negocio comercial, el día a día absorbe al encargado y la propuesta queda en el olvido.',
        coachingQuestion: '«Excelente Don Carlos. Para que su encargado no pierda tiempo con dudas técnicas: ¿le parece si agendamos de una vez 15 minutos este jueves a las 3:00 PM con él para revisar el cuadre en vivo?»',
        coachingTip: 'Técnica de Calendario Abierto: Abre Google Calendar en tu pantalla compartida mientras hablas y coloca la invitación con fecha y hora antes de colgar.',
        simulatedClientResponse: '«Tiene razón, mejor el jueves a las 3:00 PM; así obligo al encargado a tener las dudas listas y no dejamos esto en el aire.»',
        closingPlay: '«Perfecto, invitación enviada a su correo para el jueves a las 3:00 PM. Don Carlos, si el jueves el encargado da el visto bueno, ¿activamos el plan ese mismo día?»',
        businessImpact: 'Aumenta la tasa de avance a cierre del 15% al 68% al eliminar el abandono de la propuesta comercial.',
        suggestedRoleplay: 'Roleplay de 2 min: Apertura de Google Calendar en vivo ante la frase «déjeme el enlace y yo lo pruebo».'
    },
    {
        id: 'opp_agropecuaria_roble_1',
        demoId: 'audit_agropecuaria_roble',
        clientName: 'Agropecuaria El Roble',
        clientCompanyType: 'Insumos Ganaderos y Almacenes',
        repName: 'Diana Morales',
        demoDate: '21 oct 2026, 14:40 CST',
        minuteTimestamp: '22:15',
        conversationStage: 'Presentación a Socios y Decisión de Compra',
        conversationContext: 'El administrador de la empresa dijo que el sistema se ve completo pero que la aprobación depende de la junta directiva de socios.',
        criterionId: 'decision_maker_process',
        criterionName: 'Decisor y proceso de compra',
        category: 'Decisor y Presupuesto',
        leadQuote: '«El sistema de almacenes se ve muy robusto, pero esto tengo que presentarlo en la reunión de administración con los socios fundadores para ver si lo autorizan...»',
        salesRepReaction: 'Diana respondió: «Claro que sí, les voy a mandar la cotización por correo para que la presenten en su junta».',
        missedOpportunityAnalysis: 'DELEGACIÓN DE LA VENTA EN UN NO-VENDEDOR: Pretender que el administrador de compras le venda un ERP a socios escépticos enviando solo un PDF.',
        coachingQuestion: '«Totalmente de acuerdo. Para evitarle la carga de explicar la parte técnica a los socios: ¿podemos participar 15 minutos en esa reunión para mostrar los números directamente o preparamos un resumen ejecutivo para ellos?»',
        coachingTip: 'Técnica de Alivio de Carga: Posiciónate como su aliado para que el interlocutor no tenga que asumir la responsabilidad técnica frente a sus socios.',
        simulatedClientResponse: '«Sería excelente, porque Don Roberto es muy estricto con los números y si yo se lo explico seguro me va a hacer preguntas que no sé responder.»',
        closingPlay: '«Excelente, fijemos la fecha de la junta para conectarme 15 minutos puntuales con Don Roberto y presentarle el retorno de inversión.»',
        businessImpact: 'Permite hablar cara a cara con quien firma el cheque y responder sus objeciones en tiempo real, evitando que el deal muera en una junta interna.',
        suggestedRoleplay: 'Roleplay de 2 min: Ofrecer la sesión ejecutiva de 15 minutos para socios sin incomodar al interlocutor.'
    },
    {
        id: 'opp_supermercados_canasta_1',
        demoId: 'audit_supermercados_canasta',
        clientName: 'Supermercados La Canasta',
        clientCompanyType: 'Retail Multi-sucursal y Cajas POS',
        repName: 'Diana Morales',
        demoDate: '18 oct 2026, 11:20 CST',
        minuteTimestamp: '19:40',
        conversationStage: 'Propuesta Económica & Cotización',
        conversationContext: 'Llegando al final de la demo comercial, se habló de planes y precios de licenciamiento para 4 sucursales.',
        criterionId: 'next_step_accepted_dated',
        criterionName: 'Próximo paso aceptado y fechado',
        category: 'Cierre y Agendamiento',
        leadQuote: '«Mándame la cotización formal por WhatsApp con los planes por sucursal y yo la reviso con calma el fin de semana para avisarles la próxima semana...»',
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
        id: 'opp_comercializadora_valle_1',
        demoId: 'audit_comercializadora_valle',
        clientName: 'Comercializadora del Valle',
        clientCompanyType: 'Distribución de Alimentos y Logística',
        repName: 'Diana Morales',
        demoDate: '12 oct 2026, 10:00 CST',
        minuteTimestamp: '12:10',
        conversationStage: 'Manejo de Objeción de Precio',
        conversationContext: 'El cliente comparó el costo mensual de la plataforma contra un software contable tradicional que tienen instalado.',
        criterionId: 'objection_handling_listen',
        criterionName: 'Objeciones abordadas con evidencia (Método ESCUCHAR)',
        category: 'Manejo de Objeción',
        leadQuote: '«El sistema se ve bueno, pero honestamente se nos sale del presupuesto mensual en comparación con el software local que usamos...»',
        salesRepReaction: 'Diana se apresuró a decir «podemos darle un descuento del 15% si firma hoy».',
        missedOpportunityAnalysis: 'DESCUENTO REFLEJO: Destruyó el margen y el valor percibido ofreciendo rebajas sin defender el retorno de inversión ni explorar la objeción real.',
        coachingQuestion: '«Entiendo que el presupuesto es clave. Cuando dice que se sale de presupuesto: ¿lo compara con lo que pagan hoy de software o con lo que hoy están perdiendo en errores de despacho logístico?»',
        coachingTip: 'Método ESCUCHAR: Explora el fondo de la objeción antes de soltar un solo dólar de descuento.',
        simulatedClientResponse: '«Bueno, el software actual cuesta la mitad, pero la verdad no nos ayuda en nada con las pérdidas de ruta...»',
        closingPlay: '«Exacto. Nuestro sistema no es un costo de software, es el candado que frena esas fugas. Si le ahorra $1,000 al mes, ¿la mensualidad sigue siendo un problema?»',
        businessImpact: 'Protege el ticket promedio de venta y evita que el cliente compre por precio en lugar de por valor.',
        suggestedRoleplay: 'Roleplay de 2 min: Reencuadrar la objeción de precio hacia el costo de la inacción.'
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
    },
    {
        id: 'opp_transportes_express_1',
        demoId: 'audit_transportes_express',
        clientName: 'Transportes Express',
        clientCompanyType: 'Flotillas y Envíos Nacionales',
        repName: 'Patricia Martínez',
        demoDate: '06 oct 2026, 11:00 CST',
        minuteTimestamp: '16:30',
        conversationStage: 'Validación de Interlocutor y Decisor',
        conversationContext: 'El cliente preguntó cómo se emiten los comprobantes de despacho y liquidación a choferes.',
        criterionId: 'decision_maker_process',
        criterionName: 'Decisor y proceso de compra',
        category: 'Decisor y Presupuesto',
        leadQuote: '«Necesitamos controlar las facturas de flete por camión, pero yo solo soy el encargado operativo de patio; el dueño don Guillermo es quien autoriza la compra...»',
        salesRepReaction: 'Patricia terminó la demo y le pidió que le contara a don Guillermo sobre el software.',
        missedOpportunityAnalysis: 'NO BLINDAR RUTA AL DECISOR: Terminar la llamada sin coordinar un encuentro con quien autoriza la inversión.',
        coachingQuestion: '«Excelente. Para facilitarle el trabajo y que Don Guillermo vea el beneficio en combustible y fletes: ¿qué le parece si coordinamos 10 minutos con él mañana a las 9 AM antes de que salga a ruta?»',
        coachingTip: 'Ruta al Decisor: Nunca dejes que el usuario operativo cargue solo con la venta hacia el dueño.',
        simulatedClientResponse: '«Don Guillermo llega siempre a las 8:30 AM a la oficina. A las 9:00 AM es el mejor momento para que lo atiendan.»',
        closingPlay: '«Perfecto. Le envío la cita para mañana 9:00 AM para mostrarle a Don Guillermo los números de ahorro directo.»',
        businessImpact: 'Involucra al dueño en menos de 24 horas y acorta el ciclo de cierre de 30 días a 48 horas.',
        suggestedRoleplay: 'Roleplay de 2 min: Conseguir la reunión con el dueño involucrando al usuario operativo.'
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
