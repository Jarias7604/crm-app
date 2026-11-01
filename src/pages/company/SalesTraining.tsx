// src/pages/company/SalesTraining.tsx
// Módulo Oficial de Capacitación Comercial y Academia de Ventas en el CRM SaaS
// Diseño dinámico, tipografía ejecutiva grande, transiciones fluidas, lightbox HD y multi-tenant white-label

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import {
    GraduationCap,
    ChevronLeft,
    ChevronRight,
    Maximize2,
    Minimize2,
    Download,
    BookOpen,
    Presentation,
    CheckCircle2,
    AlertCircle,
    Shield,
    Sparkles,
    Building2,
    X,
    Play,
    Pause,
    Copy,
    Check,
    ZoomIn,
    Volume2,
    CheckSquare
} from 'lucide-react';

interface SlideData {
    num: number;
    category: string;
    title: string;
    subtitle?: string;
    isCover?: boolean;
    imageSrc?: string;
    imageCaption?: string;
    badgeText?: string;
    badgeColor?: 'red' | 'green' | 'blue' | 'amber';
    mainQuote?: string;
    bullets: { label: string; text: string; isDanger?: boolean; isSuccess?: boolean }[];
    speakerNotes: string;
}

export default function SalesTraining() {
    const { profile } = useAuth();
    const [company, setCompany] = useState<{ id: string; name: string; logo_url?: string } | null>(null);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showNotes, setShowNotes] = useState(true);
    const [activeTab, setActiveTab] = useState<'presentation' | 'handbook'>('presentation');
    const [isPlaying, setIsPlaying] = useState(false);
    const [zoomedImage, setZoomedImage] = useState<{ src: string; caption?: string } | null>(null);
    const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
    const [showAiModal, setShowAiModal] = useState(false);
    const [isSimulatingAi, setIsSimulatingAi] = useState(false);
    const [simulatedComplete, setSimulatedComplete] = useState(false);
    const deckContainerRef = useRef<HTMLDivElement>(null);

    // Cargar datos de la empresa para personalizar o aplicar white-label
    useEffect(() => {
        if (!profile?.company_id) return;
        supabase
            .from('companies')
            .select('id, name, logo_url')
            .eq('id', profile.company_id)
            .single()
            .then(({ data }) => {
                if (data) setCompany(data);
            });
    }, [profile?.company_id]);

    // Validación estricta multi-tenant: solo Arias Defense ve la marca de defensa.
    // Todos los demás clientes/inquilinos del SaaS ven su propio nombre y logo en modo white-label.
    const isAriasDefense = useMemo(() => {
        const cName = company?.name?.toLowerCase() || '';
        const userEmail = profile?.email?.toLowerCase() || '';
        return (
            cName.includes('arias defense') ||
            userEmail.includes('ariasdefense') ||
            userEmail === 'jarias7604@gmail.com'
        );
    }, [company?.name, profile?.email]);

    const tenantBrand = useMemo(() => {
        if (isAriasDefense) {
            return {
                companyName: 'ARIAS DEFENSE COMPONENTS',
                subTitle: 'Entrenamiento Comercial · ARIAS ERP',
                logoUrl: '/arias_real_logo.png',
                isDefaultBrand: true,
                pptxFile: '/ARIAS_Training_Ventas_Equipo.pptx',
                pptxDownloadName: 'ARIAS_Training_Ventas_Equipo.pptx'
            };
        }
        return {
            companyName: company?.name || 'Academia de Ventas Pro',
            subTitle: `Entrenamiento Comercial · ${company?.name || 'CRM'}`,
            logoUrl: company?.logo_url || null,
            isDefaultBrand: false,
            pptxFile: '/Training_Ventas_Equipo.pptx',
            pptxDownloadName: `Training_Ventas_${(company?.name || 'Equipo').replace(/\s+/g, '_')}.pptx`
        };
    }, [isAriasDefense, company]);

    // Slides dinámicas adaptadas con trazabilidad y privacidad de datos
    const slides: SlideData[] = useMemo(() => {
        const cName = isAriasDefense ? 'ARIAS' : (company?.name || 'nuestro software');

        return [
            {
                num: 1,
                isCover: true,
                category: isAriasDefense ? 'Entrenamiento Comercial · ARIAS DEFENSE COMPONENTS' : `Entrenamiento Comercial · ${tenantBrand.companyName}`,
                title: 'Vendemos resultados. No pantallas.',
                subtitle: 'El nuevo estándar de diagnóstico, demos de alto impacto y disciplina de cierre.',
                speakerNotes: 'Equipo: bienvenidos. Esta reunión no es para hablar de teoría ni dar consejos genéricos. A partir de hoy cambiamos la forma en que vendemos. No somos operadores de software que muestran botones; somos consultores de negocios que resuelven problemas caros y cierran contratos.',
                bullets: []
            },
            {
                num: 2,
                category: '01 · Diagnóstico del Problema',
                title: '¿Por qué perdíamos ventas?',
                subtitle: 'El error clásico: convertir una reunión de negocios en un paseo por pantallas sin rumbo.',
                imageSrc: '/real_performance_audits_table.png',
                imageCaption: 'Registro de Demos Auditadas en el CRM',
                badgeText: 'EL VIEJO HÁBITO A ERRADICAR',
                badgeColor: 'red',
                bullets: [
                    { label: 'Abrir Google Meet y decir de inmediato:', text: '«Mire, aquí están los clientes, aquí los productos, aquí las cotizaciones...»' },
                    { label: '40 minutos mostrando botones:', text: 'Sin saber qué le duele al cliente ni cuánto dinero pierde al mes en su operación.' },
                    { label: 'El cliente se abruma y termina diciendo:', text: '«Está bonito, mándame una cotización y yo te aviso.»' },
                    { label: 'Resultado inevitable:', text: 'Semanas persiguiendo fantasmas y cero dólares en el banco.', isDanger: true }
                ],
                speakerNotes: 'Si abren una llamada y se ponen a pasear por el sistema durante 40 minutos, el cliente los ve como un catálogo ambulante. El "yo te aviso" es culpa nuestra por no haber hecho las preguntas duras al inicio.'
            },
            {
                num: 3,
                category: '02 · Filosofía de Venta',
                title: 'La Regla de Oro Comercial',
                subtitle: 'Ningún software es caro cuando resuelve un problema que cuesta el doble.',
                imageSrc: '/real_leads_pipeline.png',
                imageCaption: 'Gestión de Oportunidades en CRM',
                badgeText: 'PRINCIPIO FUNDAMENTAL',
                badgeColor: 'red',
                mainQuote: `«Ningún cliente compra módulos de software. Compra no perder $800 al mes en despachos erróneos, no sufrir robos y recuperar su tiempo.»`,
                bullets: [
                    { label: '1. Dolor Financiero:', text: `Si pierde $500/mes, pagar $80/mes por ${cName} es una ganancia neta inmediata.` },
                    { label: '2. Silencio Activo:', text: 'El cliente debe hablar el 70% del tiempo durante el diagnóstico inicial.' },
                    { label: '3. Prohibido Pantallas:', text: 'No abras el software sin saber qué proceso específico le quita el sueño al dueño.' }
                ],
                speakerNotes: 'Grábense esto: cuando un cliente les dice "está muy caro", no es por el precio, es porque no conectaron el sistema con la pérdida de dinero que tiene todos los días en su negocio.'
            },
            {
                num: 4,
                category: '03 · Arquitectura Comercial',
                title: 'El Nuevo Ecosistema en Vivo',
                subtitle: 'Trazabilidad total desde la prospección hasta el cobro en caja.',
                imageSrc: '/real_lead_detail_panel.png',
                imageCaption: 'Ficha del Lead con Botones HUD y Gemini',
                badgeText: 'CIRCUITO OFICIAL EN 4 PASOS',
                badgeColor: 'blue',
                bullets: [
                    { label: '01 · SDR Califica y Agenda:', text: 'Cita agendada en Google Calendar con dolor inicial anotado.' },
                    { label: '02 · AE Conduce la Demo:', text: 'Usa el Guion Demo HUD lateral con las 7 preguntas obligatorias.' },
                    { label: '03 · Google Meet + Gemini Toma Notas:', text: 'Gemini transcribe y redacta el Google Doc en automático.' },
                    { label: '04 · Auditoría en CRM (Auditar Gemini):', text: 'El CRM califica los 100 pts y vincula acuerdos al Lead al instante.', isSuccess: true }
                ],
                speakerNotes: 'Miren esto: no estamos improvisando. Cada videollamada de Google Meet ahora es transcrita por Gemini, evaluada bajo una rúbrica oficial de 100 puntos y vinculada directamente a la ficha del lead.'
            },
            {
                num: 5,
                category: '04 · Descubrimiento Obligatorio',
                title: 'Pregunta 1 · El Dolor Operativo Raíz',
                subtitle: 'Paso 1 del Guion HUD en Vivo antes de cualquier demostración.',
                imageSrc: '/real_hud_questions.png',
                imageCaption: 'Pantalla Real del Guion Demo HUD',
                badgeText: 'PREGUNTA OBLIGATORIA 1',
                badgeColor: 'red',
                mainQuote: '«¿Qué proceso le está generando más errores o tiempo perdido hoy?»',
                bullets: [
                    { label: 'Objetivo Estratégico:', text: 'Obliga al cliente a hablar desde el segundo uno y destruye suposiciones.' },
                    { label: 'Enfoque de la Demo:', text: 'Te entrega en bandeja de plata los 2 únicos módulos que debes mostrar.' },
                    { label: 'Casos Reales:', text: 'Descontrol en despacho entre bodegas o retrasos de 3 horas diarias en facturación.' }
                ],
                speakerNotes: 'No asuman lo que el cliente quiere. Empiecen la llamada con esta pregunta y cállense. Dejen que el cliente hable durante 3 minutos seguidos.'
            },
            {
                num: 6,
                category: '05 · Descubrimiento Obligatorio',
                title: 'Pregunta 2 · El Costo Financiero del Problema',
                subtitle: 'El ancla de valor que justifica el precio del sistema.',
                imageSrc: '/real_hud_questions.png',
                imageCaption: 'Pantalla Real del Guion Demo HUD',
                badgeText: 'PREGUNTA OBLIGATORIA 2',
                badgeColor: 'red',
                mainQuote: '«¿Cuánto le cuesta mensualmente este problema en dinero o pérdidas?»',
                bullets: [
                    { label: 'Alerta de Auditoría (10 Pts):', text: 'Si la llamada termina sin cifra en dólares, reprueba la auditoría.' },
                    { label: 'Si el cliente dice «no sé»:', text: 'Guíalo: ¿cuántas horas extra pagan o cuánto se merma en inventario?' },
                    { label: 'Justificación Matemática:', text: 'Si pierde $600/mes, pagar $80/mes le ahorra $520 limpios al mes.', isSuccess: true }
                ],
                speakerNotes: 'Si no sabemos cuánto le cuesta el dolor, ¿con qué cara vamos a defender nuestro precio al final? Si la demo no tiene un número anotado en este punto, reprueba la auditoría de inmediato.'
            },
            {
                num: 7,
                category: '06 · Descubrimiento Obligatorio',
                title: 'Pregunta 3 · El Sistema Actual y la Competencia',
                subtitle: 'Comprender qué método usan hoy y por qué quieren cambiar.',
                imageSrc: '/real_hud_questions.png',
                imageCaption: 'Pantalla Real del Guion Demo HUD',
                badgeText: 'PREGUNTA OBLIGATORIA 3',
                badgeColor: 'blue',
                mainQuote: '«¿Qué sistema o método usa hoy y qué debe mejorar para justificar el cambio?»',
                bullets: [
                    { label: 'Excel o Libretas:', text: 'Fórmulas borradas, descontrol de cajas registradoras y sin trazabilidad.' },
                    { label: 'Software Obsoleto:', text: 'Lento, sin soporte local y caro de mantener.' },
                    { label: 'El Golpe de Convicción:', text: 'Cuando el cliente enumera las fallas de su sistema actual, él solo se convence de comprar.' }
                ],
                speakerNotes: 'Cuando el cliente mismo dice: "Excel ya no nos da abasto porque se borran fórmulas y nos roban", él mismo se está convenciendo de que necesita cambiar ya.'
            },
            {
                num: 8,
                category: '07 · Descubrimiento Obligatorio',
                title: 'Pregunta 4 · El Decisor y el Dinero',
                subtitle: 'Filtro crítico para no regalar demos a personas que no pueden comprar.',
                imageSrc: '/real_hud_questions.png',
                imageCaption: 'Pantalla Real del Guion Demo HUD',
                badgeText: 'PREGUNTA OBLIGATORIA 4',
                badgeColor: 'red',
                mainQuote: '«¿Quién más además de usted participa en la aprobación del presupuesto y la compra?»',
                bullets: [
                    { label: 'Regla de Oro de Decisión:', text: 'Nunca des una demo completa a un no-decisor sin acordar el puente al dueño.', isDanger: true },
                    { label: 'Guión si no está el dueño:', text: '«Si confirmamos que el sistema resuelve esto, ¿cómo agendamos 15 minutos con su socio para ver el presupuesto?»' }
                ],
                speakerNotes: 'Si le dan una demo de 1 hora a un asistente sin preguntar quién firma el cheque, perdieron 60 minutos de su vida laboral. El asistente nunca va a saber venderle a su jefe con la misma fuerza que ustedes.'
            },
            {
                num: 9,
                category: '08 · Descubrimiento Obligatorio',
                title: 'Pregunta 5 · El Plazo de Implementación',
                subtitle: 'Separar a los curiosos de los clientes listos para firmar.',
                imageSrc: '/real_hud_questions.png',
                imageCaption: 'Pantalla Real del Guion Demo HUD',
                badgeText: 'PREGUNTA OBLIGATORIA 5',
                badgeColor: 'blue',
                mainQuote: '«¿Para cuándo necesitan tener este sistema implementado y funcionando?»',
                bullets: [
                    { label: 'Si dicen «para fin de mes»:', text: '«La parametrización toma 5 días, así que debemos firmar hoy mismo.»' },
                    { label: 'Si dicen «no tenemos prisa»:', text: '«Mientras no cambien, ¿cuánto dinero siguen perdiendo en mermas cada mes?»', isDanger: true }
                ],
                speakerNotes: 'El tiempo es el mejor amigo del vendedor proactivo. Si necesitan el sistema para fin de mes, el cierre tiene que ocurrir hoy, no el próximo año.'
            },
            {
                num: 10,
                category: '09 · Descubrimiento Obligatorio',
                title: 'Pregunta 6 · El Criterio de Victoria',
                subtitle: 'Fijar la condición exacta para ganar la venta antes de mostrar el sistema.',
                imageSrc: '/real_hud_questions.png',
                imageCaption: 'Pantalla Real del Guion Demo HUD',
                badgeText: 'PREGUNTA OBLIGATORIA 6',
                badgeColor: 'green',
                mainQuote: '«¿Qué tendría que demostrarle hoy para ganar su total confianza?»',
                bullets: [
                    { label: 'La Llave Maestra:', text: 'El cliente te dice exactamente qué necesita ver para comprar.' },
                    { label: 'Ahorro de Tiempo:', text: 'Te ahorra 30 minutos de pasear por funciones secundarias.' },
                    { label: 'Ejemplos Reales:', text: '«Que el cuadre de caja sea ciego», «Que facture en 10 segundos», «Que sincronice 3 locales».' }
                ],
                speakerNotes: 'Esta pregunta es mágica. Cuando el cliente te dice: "Si me demuestra que puedo controlar las cajas desde mi casa, lo compro", ya te dio la llave del cierre. Solo tienes que mostrarle eso.'
            },
            {
                num: 11,
                category: '10 · Descubrimiento Obligatorio',
                title: 'Pregunta 7 · La Validación Inmediata Post-Demo',
                subtitle: 'El puente obligatorio antes de hablar de precios o cotizaciones.',
                imageSrc: '/real_hud_questions.png',
                imageCaption: 'Pantalla Real del Guion Demo HUD',
                badgeText: 'PREGUNTA OBLIGATORIA 7',
                badgeColor: 'green',
                mainQuote: '«¿Esto que acaba de ver resuelve el problema específico que me describió al inicio?»',
                bullets: [
                    { label: 'Si responde que SÍ:', text: 'Tienes autorización moral para avanzar inmediatamente a la contratación.', isSuccess: true },
                    { label: 'Si tiene dudas:', text: 'PROHIBIDO hablar de precios. Indaga qué faltó antes de mostrar números.', isDanger: true }
                ],
                speakerNotes: 'Nunca hablen de precios sin que el cliente haya dicho "SÍ, esto resuelve mi problema". Si dan el precio antes del "Sí", el cliente lo ve como un costo, no como una solución.'
            },
            {
                num: 12,
                category: '11 · Estructura de la Demo',
                title: 'La Regla de los 3 Flujos (Menos es Más)',
                subtitle: 'Cómo estructurar los 20 minutos de demostración para maximizar el impacto.',
                imageSrc: '/real_lead_detail_panel.png',
                imageCaption: 'Flujo de Venta en la Ficha del Lead',
                badgeText: 'ESTRUCTURA DE IMPACTO',
                badgeColor: 'blue',
                bullets: [
                    { label: 'Flujo 1 · El Dolor Principal:', text: 'El problema crítico detectado en la Pregunta 1 (ej: facturación rápida).' },
                    { label: 'Flujo 2 · La Pesadilla Operativa:', text: 'Lo que quita el sueño al administrador (control de stock e inventario).' },
                    { label: 'Flujo 3 · El Control del Dueño:', text: 'Reporte gerencial en el móvil en 3 clics para el que paga la factura.' }
                ],
                speakerNotes: 'El cliente se abruma cuando le muestran 20 botones. Muéstrenle únicamente los 3 flujos donde le duele el bolsillo. Hagan que la demo dure 25 minutos de alto impacto, no 60 minutos de cansancio.'
            },
            {
                num: 13,
                category: '12 · Técnicas de Cierre',
                title: 'El Cierre Condicionado',
                subtitle: 'Cómo solicitar el compromiso con firmeza y elegancia comercial.',
                imageSrc: '/real_performance_audits_table.png',
                imageCaption: 'Seguimiento de Cierres en el CRM',
                badgeText: 'FÓRMULA OFICIAL DE CIERRE',
                badgeColor: 'red',
                mainQuote: '«Si resolvemos [Condición X], ¿estamos listos para programar la instalación este [Día Y]?»',
                bullets: [
                    { label: 'Validación Técnica:', text: '«Si confirmamos que el lector funciona sin cables, ¿arrancamos el lunes?»' },
                    { label: 'Forma de Pago:', text: '«Si gerencia aprueba el pago en 2 cuotas, ¿firmamos el contrato hoy?»' },
                    { label: 'Migración:', text: '«Si migramos los productos desde Excel sin costo, ¿capacitamos mañana?»' }
                ],
                speakerNotes: 'No terminen la demo diciendo "¿Qué le pareció?". Esa es la peor pregunta de la historia de las ventas. Pidan el compromiso con una pregunta cerrada y condicional.'
            },
            {
                num: 14,
                category: '13 · Disciplina de Cierre',
                title: 'La Regla de la Fecha Sagrada',
                subtitle: 'Toda conversación comercial termina con día y hora en Google Calendar.',
                imageSrc: isAriasDefense ? '/real_finca_miramar_drawer.png' : '/real_lead_detail_panel.png',
                imageCaption: isAriasDefense ? 'Próximo Paso Fechado en Finca Miramar' : 'Próximo Paso Fechado en Oportunidad',
                badgeText: 'PROTOCOLO DE 100 PUNTOS',
                badgeColor: 'green',
                bullets: [
                    { label: 'Lo que reprueba la llamada (0 pts):', text: '«Le mando la cotización y quedamos en contacto por WhatsApp.»', isDanger: true },
                    { label: 'Lo que aprueba con 100 puntos:', text: 'Abrir Google Calendar en vivo antes de colgar y fijar reunión de revisión.', isSuccess: true }
                ],
                speakerNotes: 'Si cuelgan la llamada sin haber fijado fecha y hora en Google Calendar para revisar la propuesta, esa llamada fue un fracaso comercial y el CRM la marcará en rojo.'
            },
            {
                num: 15,
                category: '14 · Manejo de Objeciones',
                title: 'El Método ESCUCHAR en el HUD',
                subtitle: 'Estructura oficial para neutralizar objeciones sin perder margen.',
                imageSrc: '/real_hud_objections.png',
                imageCaption: 'Pestaña de Objeciones en el Guion Demo HUD',
                badgeText: 'MÉTODO ESCUCHAR',
                badgeColor: 'amber',
                bullets: [
                    { label: 'E - Escuchar:', text: 'Esperar 3 segundos de silencio antes de responder. No interrumpir jamás.' },
                    { label: 'S - Sondear:', text: '¿Es problema real de dinero o falta de confianza en el resultado?' },
                    { label: 'C - Comprender:', text: 'No discutir ni ponerse a la defensiva. Validar la duda del cliente.' },
                    { label: 'U - Unir al Cierre:', text: 'Vincular la objeción con la pérdida que sufre hoy y pedir decisión condicionada.' }
                ],
                speakerNotes: 'Cuando un cliente pone una objeción, no se asusten. La objeción es el primer síntoma de que el cliente está considerando comprar. Respiren, no interrumpan y sigan el método.'
            },
            {
                num: 16,
                category: '15 · Casos Reales del CRM',
                title: 'Caso Real: Precio y Petición de Descuento',
                subtitle: 'Objeción: «El precio está muy alto para mi presupuesto»',
                imageSrc: '/real_hud_objections.png',
                imageCaption: 'Script de Manejo de Precio en el HUD',
                badgeText: 'OBJECIÓN DE PRECIO',
                badgeColor: 'red',
                bullets: [
                    { label: 'Error fatal a evitar:', text: '«Déjeme hablar con mi jefe a ver si le rebajamos un 20%...» (Destruye autoridad y margen).', isDanger: true },
                    { label: '1. Sondear:', text: '«Entiendo perfectamente. ¿El valor está fuera de su presupuesto total o comparado contra otra opción?»' },
                    { label: '2. Re-anclar al dolor:', text: '«Recuerde que hoy se le pierden $400 al mes en despachos erróneos.»' },
                    { label: '3. Cierre condicionado:', text: '«Si resolvemos el costo dentro de lo autorizado, ¿qué otra condición faltaría para programar la instalación?»', isSuccess: true }
                ],
                speakerNotes: 'El cliente siempre va a pedir rebaja por reflejo. Si ustedes se bajan los pantalones al segundo 1, el cliente piensa que el software no vale nada.'
            },
            {
                num: 17,
                category: '16 · Casos Reales del CRM',
                title: 'Caso Real: Petición de Prueba Gratis',
                subtitle: 'Petición: «Actívame una prueba gratis de 8 días para evaluar»',
                imageSrc: '/real_hud_objections.png',
                imageCaption: 'Script de Prueba Condicionada en el HUD',
                badgeText: 'PRUEBA CONDICIONADA',
                badgeColor: 'amber',
                bullets: [
                    { label: 'Alerta crítica:', text: 'Una prueba gratis NO es una venta. Si das acceso libre sin tareas definidas, nadie entra y el lead se enfría.', isDanger: true },
                    { label: '1. Acotar el alcance:', text: '«Con gusto abrimos un entorno de 8 días. ¿Cuáles son las 3 tareas específicas que necesita verificar para tomar la decisión?»' },
                    { label: '2. Reunión de cierre:', text: '«Pactemos la reunión de revisión final para el día 8 a las 3:00 PM con quien aprueba la compra.»' },
                    { label: '3. Compromiso:', text: '«Si las 3 tareas cumplen, ¿avanzamos con la contratación?»', isSuccess: true }
                ],
                speakerNotes: 'Miren el caso en el CRM. Si no le fijamos los 3 criterios de éxito y la fecha de firma, esa prueba se convierte en un fantasma.'
            },
            {
                num: 18,
                category: '17 · Casos Reales del CRM',
                title: 'Caso Real: Cotización Sola por Correo',
                subtitle: 'Objeción: «Mándame la cotización y yo te aviso»',
                imageSrc: '/real_hud_objections.png',
                imageCaption: 'Script de Cotización Blindada en el HUD',
                badgeText: 'BLINDAJE DE PROPUESTA',
                badgeColor: 'red',
                bullets: [
                    { label: 'Peligro mortal:', text: 'Cotización en PDF enviada al aire = Venta muerta en el 90% de los casos.', isDanger: true },
                    { label: 'Guión de Blindaje:', text: '«Con mucho gusto le preparo la propuesta formal con el alcance exacto. Para asegurar que no pague de más y solo incluya lo que necesita hoy... ¿podemos reservar 15 minutos este jueves a las 10:00 AM para revisarla en vivo junto con la persona que aprueba el presupuesto?»', isSuccess: true }
                ],
                speakerNotes: 'Nunca manden un documento de precios sin una reunión de revisión agendada. Un PDF no tiene voz para defender el valor frente a las dudas del cliente.'
            },
            {
                num: 19,
                category: '18 · Casos Reales del CRM',
                title: 'Caso Real: Función Faltante o Ajuste Técnico',
                subtitle: 'Objeción: «Le falta una función técnica / Personalización»',
                imageSrc: '/real_hud_objections.png',
                imageCaption: 'Script de Integridad Técnica en el HUD',
                badgeText: 'INTEGRIDAD TÉCNICA',
                badgeColor: 'blue',
                bullets: [
                    { label: 'Prohibición estricta:', text: 'Prohibido prometer funcionalidades que ingeniería no ha autorizado.', isDanger: true },
                    { label: '1. Validar el impacto:', text: '«Entiendo la necesidad de ese flujo. ¿Cómo lo resuelven hoy y qué impacto tiene en costos?»' },
                    { label: '2. Postura profesional:', text: '«Validaremos este escenario con el equipo técnico para no prometer lo que no esté listo.»' },
                    { label: '3. Próximo paso:', text: '«Agendemos seguimiento para el viernes con el reporte de factibilidad técnica.»', isSuccess: true }
                ],
                speakerNotes: 'Jamás inventen funciones que el sistema no tiene. Vender con integridad es lo que nos mantiene vivos. Documenten el caso y validen con gerencia.'
            },
            {
                num: 20,
                category: '19 · Evidencia en Vivo',
                title: isAriasDefense ? 'Caso Auditado de Éxito: Finca Miramar' : 'Caso Auditado de Éxito: Cliente Agrícola',
                subtitle: 'Cerrado Ganado: $1,400 USD · Rúbrica Oficial: 92/100 Pts',
                imageSrc: isAriasDefense ? '/real_finca_miramar_drawer.png' : '/real_lead_detail_panel.png',
                imageCaption: isAriasDefense ? 'Auditoría Real y Cierre de $1,400 USD en CRM' : 'Ficha de Oportunidad y Cierre en el CRM',
                badgeText: 'CERRADO GANADO · $1,400 USD',
                badgeColor: 'green',
                bullets: [
                    { label: 'Calificación Auditada:', text: '92 / 100 Pts (Nivel Sólido de Excelencia)', isSuccess: true },
                    { label: 'Factores de Victoria:', text: '1. Diagnóstico profundo de sucursales y procesos desfasados.\n2. Cuantificación de mermas e inventario descontrolado.\n3. Mostró solo 2 flujos: catálogo y facturación rápida.\n4. Cierre condicionado y fecha de pago pactada.' }
                ],
                speakerNotes: isAriasDefense
                    ? 'Este caso no es inventado. Está en el CRM, cerrado con $1,400 en caja. El asesor aplicó el guión: diagnosticó el dolor, mostró 2 flujos y cerró.'
                    : 'Este caso está registrado en el CRM con $1,400 cerrados. El asesor aplicó la metodología oficial: diagnosticó el dolor raíz, cuantificó el impacto y cerró con fecha firme.'
            },
            {
                num: 21,
                category: '20 · Evidencia en Vivo',
                title: isAriasDefense ? 'Caso Auditado de Éxito: Kervin Roque' : 'Caso Auditado de Éxito: Empresa de Servicios',
                subtitle: 'Cerrado Ganado: $1,200 USD · Rúbrica Oficial: 88/100 Pts',
                imageSrc: '/real_performance_audits_table.png',
                imageCaption: isAriasDefense ? 'Tabla de Rendimiento con $2,600 Cerrados' : 'Tabla de Rendimiento con Ventas Cerradas',
                badgeText: 'CERRADO GANADO · $1,200 USD',
                badgeColor: 'green',
                bullets: [
                    { label: 'Calificación Auditada:', text: '88 / 100 Pts (Nivel Sólido de Excelencia)', isSuccess: true },
                    { label: 'Por qué se cerró en 1 sola llamada:', text: '• Se validó en el minuto 10 quién firmaba el cheque y el presupuesto disponible.\n• No regaló descuentos; demostró que la velocidad de cotizaciones pagaba el software en 30 días.\n• Contratación firmada al finalizar.' }
                ],
                speakerNotes: isAriasDefense
                    ? 'Kervin Roque: $1,200 cerrados. ¿Por qué se cerró rápido? Porque se validó el presupuesto y quién firmaba desde los primeros 10 minutos.'
                    : 'Caso de $1,200 cerrados en una sola sesión. ¿Por qué se logró el cierre rápido? Porque se validó el decisor y el presupuesto disponible desde los primeros 10 minutos.'
            },
            {
                num: 22,
                category: '21 · Evidencia en Vivo',
                title: isAriasDefense ? 'Caso de Aprendizaje: Transportes Express' : 'Caso de Aprendizaje: Transporte Regional',
                subtitle: 'Resultado: PERDIDO ($0 USD) · Auditoría: 45/100 Pts (Intervención)',
                imageSrc: '/real_performance_audits_table.png',
                imageCaption: 'Registro de Oportunidad Perdida en Auditoría',
                badgeText: 'CASO PERDIDO: $0 USD',
                badgeColor: 'red',
                bullets: [
                    { label: 'Puntaje de Auditoría:', text: '45 / 100 Pts (Requiere Intervención Urgente)', isDanger: true },
                    { label: 'Errores Detectados por la IA en las Notas:', text: '• 40 minutos mostrando módulos sin preguntar cuánto perdían hoy.\n• No se validó quién tenía la chequera para autorizar.\n• Terminó con «mándame los precios por WhatsApp y yo te aviso».\n• No se agendó fecha ni hora en Google Calendar.' }
                ],
                speakerNotes: isAriasDefense
                    ? 'Transportes Express: $0. Perdimos tiempo y recursos. ¿Por qué? Porque fue un paseo de pantallas sin calificar al decisor ni fijar fecha. Esta diapositiva es el ejemplo exacto de lo que NO volveremos a hacer.'
                    : 'Oportunidad de $0: Se invirtió tiempo sin resultado. ¿Por qué? Porque fue un paseo por el software sin calificar al decisor ni fijar una fecha sagrada. Este es el contraejemplo exacto de lo que debemos evitar.'
            },
            {
                num: 23,
                category: '22 · Tus Armas en el CRM',
                title: 'Las Nuevas Herramientas en Pantalla',
                subtitle: 'Guion Demo HUD en vivo y Auditoría Gemini 100% automática.',
                imageSrc: '/real_gemini_evaluator.png',
                imageCaption: 'Evaluador Automático de Gemini en CRM',
                badgeText: 'TECNOLOGÍA A TU FAVOR',
                badgeColor: 'blue',
                bullets: [
                    { label: '1. Guion Demo HUD (Durante la Demo):', text: 'Panel lateral flotante mientras das la llamada en Google Meet con las 7 preguntas y objeciones a 1 clic.' },
                    { label: '2. Auditar Gemini (100% Automático):', text: 'Gemini toma las notas en Google Meet. Solo pegas el enlace en el CRM y califica los 9 criterios al instante.', isSuccess: true }
                ],
                speakerNotes: 'Tienen toda la ayuda en pantalla. Durante la llamada abren el HUD para ver qué preguntar. Al terminar, pegan el link de Gemini y el sistema les dice exactamente qué hicieron bien y qué mejorar.'
            },
            {
                num: 24,
                category: '23 · Medición y Rendimiento',
                title: 'La Rúbrica Oficial de 100 Puntos',
                subtitle: 'Cómo se audita la calidad comercial de cada demo semanalmente.',
                imageSrc: '/real_gemini_evaluator.png',
                imageCaption: 'Calificación de los 9 Criterios en CRM',
                badgeText: 'LOS 9 CRITERIOS OFICIALES',
                badgeColor: 'blue',
                bullets: [
                    { label: 'Apertura y Diagnóstico (35 pts):', text: 'Preparación y Agenda (10 pts) + Diagnóstico Abierto (15 pts) + Dolor Cuantificado (10 pts).' },
                    { label: 'Calificación y Demo (40 pts):', text: 'Decisor Identificado (10 pts) + Demo Relevante de Valor (15 pts) + Método ESCUCHAR (15 pts).' },
                    { label: 'Cierre y Disciplina (25 pts):', text: 'Solicitud de Decisión (10 pts) + Próximo Paso Fechado (10 pts) + Disciplina en CRM (5 pts).' }
                ],
                speakerNotes: 'Esta es la rúbrica con la que gerencia revisa cada demo los viernes. No se trata de suerte ni de si el cliente era simpático: se trata de cumplir estos 9 puntos en cada oportunidad.'
            },
            {
                num: 25,
                isCover: true,
                category: '24 · Compromiso Comercial',
                title: 'Las 3 Reglas No Negociables a Partir de Hoy',
                subtitle: 'El estándar de excelencia que nos llevará a duplicar las ventas de la empresa.',
                bullets: [
                    { label: '01. NINGUNA DEMO SIN DIAGNÓSTICO', text: 'Primero entendemos el dolor y el dinero que cuesta. Prohibido abrir pantallas a ciegas.' },
                    { label: '02. NINGUNA OBJECIÓN CON REBAJA REGALADA', text: 'Protegemos el valor de nuestro trabajo. Todo acuerdo comercial exige una fecha de pago firme.' },
                    { label: '03. NINGUNA LLAMADA SIN FECHA SAGRADA', text: 'Toda llamada termina con día y hora exacta en Google Calendar. Se acabó el «yo te aviso».' }
                ],
                speakerNotes: 'Equipo: tenemos el producto, tenemos el CRM y tenemos los casos reales demostrados. Ahora salgamos a ejecutar este proceso en cada llamada. A partir de hoy, cada demo cuenta.'
            }
        ];
    }, [isAriasDefense, tenantBrand, company?.name]);

    const slide = slides[currentSlide];

    // Navegación por teclado (Flechas, Espacio, PageUp/Down, Tecla F)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (activeTab !== 'presentation') return;
            if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
                e.preventDefault();
                setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1));
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                e.preventDefault();
                setCurrentSlide(prev => Math.max(0, prev - 1));
            } else if (e.key === 'f' || e.key === 'F') {
                toggleFullscreen();
            } else if (e.key === 'Escape' && zoomedImage) {
                setZoomedImage(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [slides.length, activeTab, zoomedImage]);

    // Auto Play Slideshow (10 segundos por slide)
    useEffect(() => {
        if (!isPlaying || activeTab !== 'presentation') return;
        const interval = setInterval(() => {
            setCurrentSlide(prev => {
                if (prev >= slides.length - 1) {
                    setIsPlaying(false);
                    return prev;
                }
                return prev + 1;
            });
        }, 10000);
        return () => clearInterval(interval);
    }, [isPlaying, activeTab, slides.length]);

    const toggleFullscreen = () => {
        if (!deckContainerRef.current) return;
        if (!document.fullscreenElement) {
            deckContainerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
        }
    };

    const handleCopy = (text: string, id: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(id);
        toast.success(`¡${label} copiado al portapapeles!`);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <div className="space-y-6">
            {/* Header del Módulo con Tabs y Controles */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-2xl shadow-md shadow-rose-600/20">
                        <GraduationCap className="w-8 h-8" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
                                {isAriasDefense ? 'Academia de Ventas · ARIAS Sales Excellence' : `Academia de Ventas · ${tenantBrand.companyName}`}
                            </h1>
                            <span className="px-3 py-1 text-xs font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 rounded-full">
                                25 Slides Oficiales
                            </span>
                        </div>
                        <p className="text-sm md:text-base text-gray-600 mt-1 font-medium">
                            Metodología oficial de diagnóstico, manejo de objeciones y disciplina de cierre para el equipo comercial.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end flex-wrap">
                    <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200 text-xs md:text-sm font-bold">
                        <button
                            onClick={() => setActiveTab('presentation')}
                            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
                                activeTab === 'presentation' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Presentation className="w-4 h-4 text-rose-600" />
                            Modo Presentación
                        </button>
                        <button
                            onClick={() => setActiveTab('handbook')}
                            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
                                activeTab === 'handbook' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <BookOpen className="w-4 h-4 text-blue-600" />
                            Guía Rápida & Scripts
                        </button>
                    </div>

                    <button
                        onClick={() => setShowAiModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs md:text-sm font-black transition-all shadow-sm shadow-violet-600/20 active:scale-95"
                    >
                        <Sparkles className="w-4 h-4" />
                        <span className="hidden sm:inline">Dinamizar con IA</span>
                    </button>

                    <a
                        href={tenantBrand.pptxFile}
                        download={tenantBrand.pptxDownloadName}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs md:text-sm font-black transition-all shadow-sm shadow-emerald-600/20 active:scale-95"
                    >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Descargar PPTX</span>
                    </a>
                </div>
            </div>

            {/* TAB 1: PRESENTACIÓN INTERACTIVA DINÁMICA */}
            {activeTab === 'presentation' && (
                <div ref={deckContainerRef} className={`space-y-4 ${isFullscreen ? 'bg-slate-950 p-6 md:p-12 min-h-screen flex flex-col justify-center' : ''}`}>
                    
                    {/* Barra de progreso animada interactiva */}
                    <div className="w-full bg-gray-200/80 h-2 rounded-full overflow-hidden shadow-inner">
                        <div 
                            className="h-full bg-gradient-to-r from-rose-500 via-rose-600 to-emerald-500 transition-all duration-500 ease-out"
                            style={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
                        />
                    </div>

                    {/* Barra de control superior de la diapositiva */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-6 py-4 rounded-2xl border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-3">
                            <span className="font-mono text-xs md:text-sm font-black text-rose-700 bg-rose-50 border border-rose-200 px-3.5 py-1.5 rounded-xl">
                                Slide {slide.num} de {slides.length}
                            </span>
                            <span className="text-xs md:text-sm font-black text-gray-800 hidden sm:inline truncate max-w-xs md:max-w-md">
                                {slide.title}
                            </span>
                            <span className="text-[11px] font-bold text-gray-500 hidden lg:inline">
                                ({Math.round(((currentSlide + 1) / slides.length) * 100)}% completado)
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Auto Play Slideshow */}
                            <button
                                onClick={() => setIsPlaying(!isPlaying)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                                    isPlaying ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-sm animate-pulse' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                }`}
                                title={isPlaying ? 'Pausar Reproducción Automática' : 'Iniciar Reproducción Automática (10s por slide)'}
                            >
                                {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                                <span className="hidden sm:inline">{isPlaying ? 'Pausar' : 'Auto Play'}</span>
                            </button>

                            {/* Guion del Líder */}
                            <button
                                onClick={() => setShowNotes(!showNotes)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                    showNotes ? 'bg-blue-50 text-blue-700 border-blue-200 font-extrabold' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                Guion del Líder
                            </button>

                            {/* Botón Anterior */}
                            <button
                                onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
                                disabled={currentSlide === 0}
                                className="p-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xs"
                                title="Slide Anterior (Flecha Izquierda)"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>

                            {/* Botón Siguiente */}
                            <button
                                onClick={() => setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1))}
                                disabled={currentSlide === slides.length - 1}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs md:text-sm font-black flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md shadow-rose-600/20"
                                title="Siguiente Slide (Espacio o Flecha Derecha)"
                            >
                                <span>Siguiente</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>

                            {/* Pantalla Completa */}
                            <button
                                onClick={toggleFullscreen}
                                className="p-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-700 transition-all shadow-xs"
                                title="Pantalla Completa (Tecla F)"
                            >
                                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Escenario de la Diapositiva (Espacioso, Tipografía Grande y Animado) */}
                    <div className="w-full min-h-[580px] lg:min-h-[640px] bg-white rounded-3xl border border-gray-200/90 shadow-xl shadow-gray-200/40 p-6 md:p-10 flex flex-col justify-between overflow-hidden relative">
                        <div key={currentSlide} className="h-full flex flex-col justify-between animate-in fade-in zoom-in-[0.99] duration-300">
                            {slide.isCover ? (
                                slide.num === 1 ? (
                                    <div className="flex flex-col lg:flex-row justify-between items-stretch h-full gap-8 my-auto">
                                        <div className="flex-1 flex flex-col justify-center py-4">
                                            <div className="text-xs md:text-sm font-black text-rose-600 tracking-widest uppercase mb-4 flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                                                {slide.category}
                                            </div>
                                            {tenantBrand.logoUrl ? (
                                                <img
                                                    src={tenantBrand.logoUrl}
                                                    alt={tenantBrand.companyName}
                                                    className="h-14 md:h-16 w-auto object-contain self-start mb-6"
                                                />
                                            ) : (
                                                <div className="flex items-center gap-3 mb-6 text-gray-900 font-black text-2xl md:text-3xl">
                                                    <Building2 className="w-8 h-8 text-rose-600" />
                                                    {tenantBrand.companyName}
                                                </div>
                                            )}
                                            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-gray-900 leading-[1.08] tracking-tight mb-4">
                                                Vendemos resultados.<br />
                                                <span className="text-rose-600">No pantallas.</span>
                                            </h1>
                                            <p className="text-base md:text-xl text-gray-600 font-medium mb-8 max-w-xl leading-relaxed">
                                                {slide.subtitle}
                                            </p>
                                            <div className="w-full h-1 bg-gray-900 rounded-full mb-4" />
                                            <div className="text-xs md:text-sm font-extrabold text-gray-700 tracking-wider flex items-center gap-3 flex-wrap">
                                                <span className="px-3 py-1 bg-gray-100 rounded-lg border border-gray-200">CASOS REALES</span>
                                                <span>·</span>
                                                <span className="px-3 py-1 bg-gray-100 rounded-lg border border-gray-200">PRÁCTICA EN VIVO</span>
                                                <span>·</span>
                                                <span className="px-3 py-1 bg-gray-100 rounded-lg border border-gray-200">AUDITORÍA SEMANAL</span>
                                            </div>
                                        </div>
                                        <div className="w-full lg:w-2/5 bg-gradient-to-br from-rose-600 to-rose-700 rounded-2xl p-8 md:p-10 text-white flex flex-col justify-between shadow-2xl shadow-rose-900/20">
                                            <div>
                                                <div className="text-xs font-black tracking-widest uppercase opacity-85 mb-4 flex items-center gap-2">
                                                    <Sparkles className="w-4 h-4" />
                                                    OBJETIVO ESTRATÉGICO
                                                </div>
                                                <div className="text-2xl md:text-4xl font-black leading-tight">
                                                    Más decisiones de compra, sin perder confianza ni integridad.
                                                </div>
                                            </div>
                                            <div className="text-sm md:text-base space-y-2 opacity-95 border-t border-rose-500/50 pt-6 font-bold">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="w-5 h-5 text-rose-200" />
                                                    Rúbrica Oficial de 100 Puntos
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="w-5 h-5 text-rose-200" />
                                                    Auditoría Automática con IA
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="w-5 h-5 text-rose-200" />
                                                    Trazabilidad en Vivo de cada Demo
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col justify-between py-2">
                                        <div>
                                            <div className="text-xs md:text-sm font-black text-rose-600 tracking-wider uppercase mb-2">
                                                {slide.category}
                                            </div>
                                            <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-3 tracking-tight">
                                                {slide.title}
                                            </h2>
                                            <p className="text-base md:text-lg text-gray-600 font-medium mb-6">{slide.subtitle}</p>
                                        </div>

                                        <div className="space-y-4 my-4">
                                            {slide.bullets.map((b, idx) => (
                                                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 md:p-6 flex items-center gap-5 shadow-xs hover:border-rose-300 hover:shadow-md transition-all">
                                                    <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white font-mono font-black text-xl flex items-center justify-center shrink-0 shadow-md shadow-rose-600/30">
                                                        0{idx + 1}
                                                    </div>
                                                    <div>
                                                        <div className="text-base md:text-xl font-extrabold text-gray-900">{b.label}</div>
                                                        <div className="text-sm md:text-base text-gray-600 mt-1 font-medium">{b.text}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="p-5 bg-emerald-50 border border-emerald-300 rounded-2xl text-center text-sm md:text-base font-black text-emerald-900 shadow-sm">
                                            «EL PROFESIONAL DE VENTAS NO ESPERA QUE EL CLIENTE COMPRE; LO GUÍA A TOMAR LA MEJOR DECISIÓN FINANCIERA PARA SU NEGOCIO.»
                                        </div>
                                    </div>
                                )
                            ) : (
                                <div className="flex flex-col h-full justify-between">
                                    {/* Cabecera del Slide */}
                                    <div className="pb-4">
                                        <div className="text-xs md:text-sm font-black text-rose-600 tracking-widest uppercase mb-1.5 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-rose-600" />
                                            {slide.category}
                                        </div>
                                        <h2 className="text-2xl md:text-4xl lg:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
                                            {slide.title}
                                        </h2>
                                        {slide.subtitle && (
                                            <p className="text-sm md:text-lg text-gray-600 font-medium mt-1 leading-snug">
                                                {slide.subtitle}
                                            </p>
                                        )}
                                        <div className="w-full h-px bg-gray-200 mt-3" />
                                    </div>

                                    {/* Contenido en 2 Columnas de Gran Escala */}
                                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch my-2">
                                        
                                        {/* Columna Izquierda: Bullets y Citas de Gran Tamaño */}
                                        <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-5 md:p-6 flex flex-col justify-between overflow-y-auto">
                                            <div className="space-y-4">
                                                {slide.badgeText && (
                                                    <span className={`inline-block px-3.5 py-1 text-xs font-black uppercase tracking-wider rounded-lg border ${
                                                        slide.badgeColor === 'red' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                        slide.badgeColor === 'green' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                        slide.badgeColor === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                        'bg-blue-50 text-blue-700 border-blue-200'
                                                    }`}>
                                                        {slide.badgeText}
                                                    </span>
                                                )}

                                                {slide.mainQuote && (
                                                    <div className="text-base md:text-xl font-extrabold text-gray-900 leading-snug border-l-4 border-rose-600 pl-4 py-2.5 bg-gradient-to-r from-rose-50 to-white rounded-r-xl shadow-xs">
                                                        {slide.mainQuote}
                                                    </div>
                                                )}

                                                <div className="space-y-3">
                                                    {slide.bullets.map((b, idx) => (
                                                        <div 
                                                            key={idx} 
                                                            className={`p-3.5 md:p-4 rounded-xl border transition-all duration-200 hover:scale-[1.01] hover:shadow-md ${
                                                                b.isDanger 
                                                                    ? 'bg-rose-50/70 border-rose-200' 
                                                                    : b.isSuccess 
                                                                    ? 'bg-emerald-50/70 border-emerald-200' 
                                                                    : 'bg-white border-gray-200/90 shadow-xs'
                                                            }`}
                                                        >
                                                            <div className={`text-sm md:text-base font-extrabold flex items-center gap-2 ${
                                                                b.isDanger ? 'text-rose-700' : b.isSuccess ? 'text-emerald-800' : 'text-gray-900'
                                                            }`}>
                                                                {b.isDanger && <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
                                                                {b.isSuccess && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
                                                                {!b.isDanger && !b.isSuccess && <div className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />}
                                                                <span>{b.label}</span>
                                                            </div>
                                                            <div className="text-xs md:text-sm text-gray-700 leading-relaxed font-medium mt-1 pl-4 whitespace-pre-line">
                                                                {b.text}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Columna Derecha: Captura de Pantalla Real con Hover Zoom */}
                                        <div 
                                            onClick={() => slide.imageSrc && setZoomedImage({ src: slide.imageSrc, caption: slide.imageCaption })}
                                            className="group relative bg-slate-100/70 hover:bg-slate-100 border-2 border-dashed border-gray-300 hover:border-rose-400 rounded-2xl p-4 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer shadow-inner min-h-[300px] md:min-h-[380px]"
                                        >
                                            {slide.imageSrc ? (
                                                <>
                                                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-xl">
                                                        <img
                                                            src={slide.imageSrc}
                                                            alt={slide.imageCaption || 'Captura Real CRM'}
                                                            className="max-h-[340px] md:max-h-[400px] w-auto object-contain rounded-xl shadow-lg border border-white group-hover:scale-[1.03] transition-transform duration-300"
                                                        />
                                                        <div className="absolute inset-0 bg-gray-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-black text-xs md:text-sm rounded-xl backdrop-blur-xs">
                                                            <ZoomIn className="w-5 h-5" />
                                                            <span>Clic para ampliar captura en HD</span>
                                                        </div>
                                                    </div>
                                                    {slide.imageCaption && (
                                                        <div className="text-xs md:text-sm font-extrabold text-gray-700 uppercase tracking-wider mt-3 flex items-center gap-1.5">
                                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                            {slide.imageCaption}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="text-center text-gray-400 font-bold text-sm">
                                                    Visualización Oficial
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Guion del Líder (Speaker Notes) con Tipografía Amplia */}
                    {showNotes && (
                        <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-white p-5 rounded-2xl border border-blue-200/90 flex items-start gap-4 shadow-sm animate-in fade-in duration-200">
                            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm shrink-0">
                                <Volume2 className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                                <div className="text-xs font-black text-blue-900 uppercase tracking-wider flex items-center gap-2">
                                    <span>Guion del Líder / Notas del Facilitador</span>
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px]">OFICIAL</span>
                                </div>
                                <p className="text-sm md:text-base text-gray-800 leading-relaxed font-medium italic">
                                    "{slide.speakerNotes}"
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Tira de Miniaturas Interactiva */}
                    <div className="flex gap-2 overflow-x-auto pb-2 pt-1 px-1 custom-scrollbar">
                        {slides.map((s, idx) => (
                            <button
                                key={s.num}
                                onClick={() => setCurrentSlide(idx)}
                                className={`px-3 py-2 text-xs font-bold rounded-xl shrink-0 border transition-all flex items-center gap-2 ${
                                    currentSlide === idx
                                        ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20 scale-105'
                                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                                }`}
                            >
                                <span className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center ${
                                    currentSlide === idx ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                                }`}>
                                    {s.num}
                                </span>
                                <span className="truncate max-w-[130px]">{s.title}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 2: GUÍA RÁPIDA & SCRIPTS (Con botones de copiado y tipografía grande) */}
            {activeTab === 'handbook' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Las 7 Preguntas de Descubrimiento */}
                    <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-5">
                        <div className="flex items-center gap-3">
                            <span className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-xs">
                                <Sparkles className="w-6 h-6" />
                            </span>
                            <div>
                                <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Las 7 Preguntas de Descubrimiento</h2>
                                <p className="text-xs md:text-sm text-gray-500 font-medium">Ejecutar antes de compartir pantalla o hablar de precios</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {[
                                { n: 1, q: '¿Qué proceso le está generando más errores o tiempo perdido hoy?', desc: 'Encontrar el dolor raíz y no asumir lo que el cliente necesita.' },
                                { n: 2, q: '¿Cuánto le cuesta mensualmente este problema en dinero o pérdidas?', desc: 'Cuantificar el dolor financiero antes de cotizar.' },
                                { n: 3, q: '¿Qué sistema o método usa hoy y qué debe mejorar para justificar el cambio?', desc: 'Conocer a la competencia y el deseo de control.' },
                                { n: 4, q: '¿Quién más además de usted participa en la aprobación del presupuesto y compra?', desc: 'Identificar al decisor y ruta de acceso.' },
                                { n: 5, q: '¿Para cuándo necesitan tener este sistema implementado y funcionando?', desc: 'Establecer urgencia real y plan de migración.' },
                                { n: 6, q: '¿Qué tendría que demostrarle hoy para ganar su total confianza?', desc: 'Fijar el criterio de victoria antes de la demo.' },
                                { n: 7, q: '¿Esto que acaba de ver resuelve el problema específico que me describió?', desc: 'Validación obligatoria post-demo antes de cotizar.' }
                            ].map(item => (
                                <div key={item.n} className="p-4 md:p-5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all space-y-2">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm shadow-rose-600/30">
                                                #{item.n}
                                            </span>
                                            <div>
                                                <h3 className="text-base md:text-lg font-extrabold text-gray-900 leading-snug">
                                                    {item.q}
                                                </h3>
                                                <p className="text-xs md:text-sm text-gray-600 mt-1 font-medium leading-relaxed">
                                                    {item.desc}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleCopy(item.q, `q-${item.n}`, 'Pregunta')}
                                            className="p-2 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-xl transition-all shrink-0 border border-transparent hover:border-rose-200"
                                            title="Copiar pregunta"
                                        >
                                            {copiedIndex === `q-${item.n}` ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Matriz de Objeciones (Método ESCUCHAR) */}
                    <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-5">
                        <div className="flex items-center gap-3">
                            <span className="p-3 bg-amber-50 text-amber-600 rounded-2xl shadow-xs">
                                <Shield className="w-6 h-6" />
                            </span>
                            <div>
                                <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Matriz de Objeciones (Método ESCUCHAR)</h2>
                                <p className="text-xs md:text-sm text-gray-500 font-medium">Cómo responder con postura firme sin regalar descuentos</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {[
                                {
                                    tipo: 'Precio / Petición de Descuento',
                                    alerta: 'Prohibido ofrecer rebajas de inmediato',
                                    script: '«Entiendo perfectamente. ¿El valor está fuera de su presupuesto total o comparado contra otra opción? Recuerde que hoy se le pierden $400 al mes en errores de inventario. Si resolvemos el costo dentro de lo autorizado, ¿qué otra condición faltaría para programar la instalación este mes?»'
                                },
                                {
                                    tipo: 'Petición de Prueba Gratis',
                                    alerta: 'Una prueba no es una venta',
                                    script: '«Con gusto abrimos un entorno de 8 días. ¿Cuáles son las 3 tareas específicas que necesita verificar para tomar la decisión? Pactemos la reunión de revisión para el día 8 con quien aprueba la compra. Si las 3 tareas cumplen, ¿avanzamos con la contratación?»'
                                },
                                {
                                    tipo: 'Mándame la Cotización en PDF',
                                    alerta: 'Un PDF no defiende el valor',
                                    script: '«Con gusto preparo la propuesta formal con el alcance exacto. Para garantizar que solo incluya lo que necesita hoy y no pague de más... ¿podemos reservar 15 minutos este jueves a las 10:00 AM para revisarla en vivo junto con quien aprueba el presupuesto?»'
                                }
                            ].map((obj, i) => (
                                <div key={i} className="p-5 bg-slate-50 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all space-y-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <span className="text-sm md:text-base font-black text-gray-900">{obj.tipo}</span>
                                        <span className="text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full font-extrabold">{obj.alerta}</span>
                                    </div>
                                    <div className="p-4 bg-white border border-gray-200 rounded-xl text-sm md:text-base text-gray-800 leading-relaxed italic relative group">
                                        <p className="pr-8">{obj.script}</p>
                                        <button
                                            onClick={() => handleCopy(obj.script, `obj-${i}`, 'Guión')}
                                            className="absolute top-3 right-3 p-1.5 bg-gray-50 shadow-sm border border-gray-200 hover:border-rose-300 text-gray-500 hover:text-rose-600 rounded-lg transition-all opacity-80 group-hover:opacity-100"
                                            title="Copiar guión"
                                        >
                                            {copiedIndex === `obj-${i}` ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Lightbox de Capturas en Alta Definición */}
            {zoomedImage && (
                <div 
                    onClick={() => setZoomedImage(null)}
                    className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
                >
                    <div 
                        onClick={e => e.stopPropagation()}
                        className="relative max-w-5xl w-full max-h-[92vh] bg-white rounded-3xl p-5 shadow-2xl flex flex-col items-center"
                    >
                        <div className="w-full flex items-center justify-between pb-3 border-b mb-3">
                            <span className="text-base font-black text-gray-900 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-rose-600" />
                                {zoomedImage.caption || 'Captura en Alta Definición del CRM'}
                            </span>
                            <button 
                                onClick={() => setZoomedImage(null)}
                                className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-gray-900 transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <img 
                            src={zoomedImage.src} 
                            alt={zoomedImage.caption} 
                            className="max-h-[75vh] w-auto object-contain rounded-2xl border border-gray-100 shadow-md"
                        />
                    </div>
                </div>
            )}

            {/* Modal de Dinamización con IA (Visión Futura Solicitada por el Usuario) */}
            {showAiModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-lg w-full border border-gray-100 shadow-2xl p-6 md:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-violet-100 text-violet-700 rounded-2xl">
                                    <Sparkles className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-black text-gray-900 text-lg">
                                        Motor Dinámico con IA
                                    </h3>
                                    <p className="text-xs text-gray-500 font-bold">
                                        {tenantBrand.companyName}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setShowAiModal(false);
                                    setIsSimulatingAi(false);
                                    setSimulatedComplete(false);
                                }}
                                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs md:text-sm text-gray-600 leading-relaxed font-medium">
                            <p className="bg-violet-50 text-violet-900 p-4 rounded-2xl border border-violet-200 font-bold">
                                🤖 <strong>Actualización Autónoma de Capacitación:</strong> En la próxima versión, solo tendrás que presionar este botón para que la IA audite las grabaciones de Google Meet y los leads cerrados en tu CRM, actualizando automáticamente:
                            </p>
                            <ul className="space-y-2.5 pl-1">
                                <li className="flex items-start gap-2.5">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                    <span><strong>Objeciones Reales del Mercado:</strong> Extraídas directamente de las transcripciones de Gemini de tu equipo.</span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                    <span><strong>Casos Reales Cerrados:</strong> Montos e industrias de los mejores contratos ganados de tu empresa.</span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                    <span><strong>Rúbrica HUD Calibrada:</strong> Adaptada a los flujos y productos específicos de tu software.</span>
                                </li>
                            </ul>
                        </div>

                        {simulatedComplete ? (
                            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 text-center animate-in zoom-in duration-300">
                                <div className="inline-flex p-3 bg-emerald-100 text-emerald-700 rounded-full">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <div className="text-sm font-black text-emerald-900">
                                    ¡Metodología Sincronizada con el CRM!
                                </div>
                                <p className="text-xs text-emerald-700 font-medium">
                                    Se auditaron las llamadas recientes. Las 25 diapositivas reflejan los casos de éxito y el nuevo estándar comercial de {tenantBrand.companyName}.
                                </p>
                            </div>
                        ) : (
                            <div className="pt-2">
                                <button
                                    onClick={() => {
                                        setIsSimulatingAi(true);
                                        setTimeout(() => {
                                            setIsSimulatingAi(false);
                                            setSimulatedComplete(true);
                                        }, 1800);
                                    }}
                                    disabled={isSimulatingAi}
                                    className="w-full py-3 px-5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-2xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2 shadow-md shadow-violet-600/30 disabled:opacity-50"
                                >
                                    {isSimulatingAi ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Auditando llamadas y oportunidades en tu CRM...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            <span>Probar Auditoría y Sincronización IA</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
