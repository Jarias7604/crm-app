// src/pages/company/SalesTraining.tsx
// Módulo Oficial de Academia & Training en el CRM SaaS
// Soporta:
// 1. Gestor CRUD de Presentaciones (Crear, Duplicar, Editar, Eliminar)
// 2. Reproductor Ejecutivo Cinema Mode (Sin barras feas abajo, Guion de líder 100% ocultable, Drawer de diapositivas)
// 3. Guía Rápida & Scripts interactiva con botones de copiado
// 4. Aislamiento estricto multi-tenant (White-Label para empresas que no sean Arias Defense)

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
    Plus,
    Trash2,
    Edit3,
    Layers,
    LayoutGrid,
    Calendar,
    ArrowLeft
} from 'lucide-react';

export interface SlideData {
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

export interface TrainingDeck {
    id: string;
    title: string;
    subtitle: string;
    category: string;
    isOfficial?: boolean;
    slides: SlideData[];
    createdAt: string;
    updatedAt: string;
}

export default function SalesTraining() {
    const { profile } = useAuth();
    const [company, setCompany] = useState<{ id: string; name: string; logo_url?: string } | null>(null);
    const [activeTab, setActiveTab] = useState<'decks' | 'presentation' | 'handbook'>('presentation');
    const [activeDeckId, setActiveDeckId] = useState<string>('official-25-slides');
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showNotes, setShowNotes] = useState(false); // Por defecto oculto para que no estorbe abajo
    const [showSlidesModal, setShowSlidesModal] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [zoomedImage, setZoomedImage] = useState<{ src: string; caption?: string } | null>(null);
    const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
    
    // Estados del CRUD de Presentaciones
    const [decks, setDecks] = useState<TrainingDeck[]>([]);
    const [showDeckModal, setShowDeckModal] = useState(false);
    const [editingDeck, setEditingDeck] = useState<TrainingDeck | null>(null);
    const [deckForm, setDeckForm] = useState({
        title: '',
        subtitle: '',
        category: 'Ventas y Cierre',
        cloneFromOfficial: true
    });

    // Estados de Dinamización con IA
    const [showAiModal, setShowAiModal] = useState(false);
    const [isSimulatingAi, setIsSimulatingAi] = useState(false);
    const [simulatedComplete, setSimulatedComplete] = useState(false);

    const deckContainerRef = useRef<HTMLDivElement>(null);

    // Cargar datos de la empresa para white-label
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

    // Slides oficiales del Método de Ventas (25 Slides)
    const officialSlides: SlideData[] = useMemo(() => {
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

    // Clave para guardar en localStorage de forma multi-tenant
    const storageKey = useMemo(() => {
        return `crm_training_decks_${profile?.company_id || 'default'}`;
    }, [profile?.company_id]);

    // Cargar o inicializar mazos de presentación
    useEffect(() => {
        const officialDeck: TrainingDeck = {
            id: 'official-25-slides',
            title: isAriasDefense ? 'ARIAS Sales Excellence' : `Método de Ventas · ${tenantBrand.companyName}`,
            subtitle: 'El nuevo estándar de diagnóstico, demos de alto impacto y disciplina de cierre.',
            category: 'Metodología Oficial',
            isOfficial: true,
            slides: officialSlides,
            createdAt: '2026-10-31',
            updatedAt: '2026-10-31'
        };

        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved) as TrainingDeck[];
                // Siempre mantener el oficial actualizado con los nombres/logos multi-tenant
                const customDecks = parsed.filter(d => d.id !== 'official-25-slides');
                setDecks([officialDeck, ...customDecks]);
            } else {
                setDecks([officialDeck]);
                localStorage.setItem(storageKey, JSON.stringify([officialDeck]));
            }
        } catch (e) {
            setDecks([officialDeck]);
        }
    }, [storageKey, officialSlides, isAriasDefense, tenantBrand.companyName]);

    // Deck actualmente seleccionado
    const activeDeck = useMemo(() => {
        return decks.find(d => d.id === activeDeckId) || decks[0] || {
            id: 'official-25-slides',
            title: 'Metodología Oficial',
            subtitle: '25 Slides',
            category: 'Oficial',
            slides: officialSlides,
            createdAt: '',
            updatedAt: ''
        };
    }, [decks, activeDeckId, officialSlides]);

    const activeSlides = activeDeck.slides && activeDeck.slides.length > 0 ? activeDeck.slides : officialSlides;
    const slide = activeSlides[currentSlide] || activeSlides[0];

    // Funciones del CRUD de Presentaciones
    const saveDecksToStorage = (updated: TrainingDeck[]) => {
        setDecks(updated);
        try {
            localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch (err) {
            console.error('Error guardando presentaciones:', err);
        }
    };

    const handleCreateOrUpdateDeck = (e: React.FormEvent) => {
        e.preventDefault();
        if (!deckForm.title.trim()) {
            toast.error('Por favor escribe un título para la presentación');
            return;
        }

        const now = new Date().toISOString().split('T')[0];

        if (editingDeck) {
            // Actualizar presentación existente
            const updated = decks.map(d => {
                if (d.id === editingDeck.id) {
                    return {
                        ...d,
                        title: deckForm.title,
                        subtitle: deckForm.subtitle,
                        category: deckForm.category,
                        updatedAt: now
                    };
                }
                return d;
            });
            saveDecksToStorage(updated);
            toast.success('Presentación actualizada con éxito');
        } else {
            // Crear nueva presentación
            const newId = `deck-${Date.now()}`;
            const initialSlides: SlideData[] = deckForm.cloneFromOfficial
                ? JSON.parse(JSON.stringify(officialSlides))
                : [
                    {
                        num: 1,
                        isCover: true,
                        category: deckForm.category,
                        title: deckForm.title,
                        subtitle: deckForm.subtitle || 'Entrenamiento Comercial Especializado',
                        bullets: [],
                        speakerNotes: 'Bienvenida al equipo. Objetivos clave de esta sesión.'
                    }
                ];

            const newDeck: TrainingDeck = {
                id: newId,
                title: deckForm.title,
                subtitle: deckForm.subtitle,
                category: deckForm.category,
                isOfficial: false,
                slides: initialSlides,
                createdAt: now,
                updatedAt: now
            };

            const updated = [...decks, newDeck];
            saveDecksToStorage(updated);
            toast.success('Nueva presentación creada con éxito');
            setActiveDeckId(newId);
            setCurrentSlide(0);
            setActiveTab('presentation');
        }

        setShowDeckModal(false);
        setEditingDeck(null);
        setDeckForm({ title: '', subtitle: '', category: 'Ventas y Cierre', cloneFromOfficial: true });
    };

    const handleDuplicateDeck = (deck: TrainingDeck) => {
        const newId = `deck-${Date.now()}`;
        const now = new Date().toISOString().split('T')[0];
        const duplicated: TrainingDeck = {
            ...deck,
            id: newId,
            title: `Copia de ${deck.title}`,
            isOfficial: false,
            createdAt: now,
            updatedAt: now,
            slides: JSON.parse(JSON.stringify(deck.slides))
        };
        const updated = [...decks, duplicated];
        saveDecksToStorage(updated);
        toast.success(`Presentación "${deck.title}" duplicada con éxito`);
    };

    const handleDeleteDeck = (id: string, title: string) => {
        if (id === 'official-25-slides') {
            toast.error('La presentación oficial del sistema no puede ser eliminada');
            return;
        }
        if (confirm(`¿Estás seguro de que deseas eliminar la presentación "${title}"?`)) {
            const updated = decks.filter(d => d.id !== id);
            saveDecksToStorage(updated);
            if (activeDeckId === id) {
                setActiveDeckId('official-25-slides');
                setCurrentSlide(0);
            }
            toast.success('Presentación eliminada');
        }
    };

    const startPresentation = (deckId: string) => {
        setActiveDeckId(deckId);
        setCurrentSlide(0);
        setShowNotes(false);
        setActiveTab('presentation');
    };

    // Navegación por teclado
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (activeTab !== 'presentation') return;
            if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
                e.preventDefault();
                setCurrentSlide(prev => Math.min(activeSlides.length - 1, prev + 1));
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                e.preventDefault();
                setCurrentSlide(prev => Math.max(0, prev - 1));
            } else if (e.key === 'f' || e.key === 'F') {
                toggleFullscreen();
            } else if (e.key === 'Escape') {
                if (zoomedImage) setZoomedImage(null);
                else if (showSlidesModal) setShowSlidesModal(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeSlides.length, activeTab, zoomedImage, showSlidesModal]);

    // Auto Play Slideshow
    useEffect(() => {
        if (!isPlaying || activeTab !== 'presentation') return;
        const interval = setInterval(() => {
            setCurrentSlide(prev => {
                if (prev >= activeSlides.length - 1) {
                    setIsPlaying(false);
                    return prev;
                }
                return prev + 1;
            });
        }, 10000);
        return () => clearInterval(interval);
    }, [isPlaying, activeTab, activeSlides.length]);

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
        <div className="space-y-3 pb-4">
            {/* Barra Superior Ejecutiva Unificada (Zero Bloat, Máximo Espacio para la Presentación) */}
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 shadow-xs">
                {/* Izquierda: Marca y Selector de Vista */}
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-xl shadow-xs shrink-0">
                        <GraduationCap className="w-5 h-5" />
                    </div>
                    <div className="hidden sm:block">
                        <span className="font-extrabold text-sm text-gray-900">
                            {isAriasDefense ? 'ARIAS Sales Excellence' : tenantBrand.companyName}
                        </span>
                    </div>

                    {/* Selector de Modo */}
                    <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-bold">
                        <button
                            onClick={() => setActiveTab('presentation')}
                            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                                activeTab === 'presentation' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Presentation className="w-3.5 h-3.5 text-rose-600" />
                            <span>Presentación</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('decks')}
                            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                                activeTab === 'decks' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Layers className="w-3.5 h-3.5 text-blue-600" />
                            <span>Mis Mazos ({decks.length})</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('handbook')}
                            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                                activeTab === 'handbook' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Scripts & Objeciones</span>
                        </button>
                    </div>
                </div>

                {/* Derecha: Herramientas */}
                <div className="flex items-center gap-2">
                    {activeTab === 'presentation' && (
                        <>
                            <button
                                onClick={() => setShowSlidesModal(true)}
                                className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 flex items-center gap-1.5 transition-all"
                                title="Ver todas las diapositivas"
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">Diapositivas ({slide.num}/{activeSlides.length})</span>
                                <span className="md:hidden">{slide.num}/{activeSlides.length}</span>
                            </button>

                            <button
                                onClick={() => setIsPlaying(!isPlaying)}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                                    isPlaying ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-xs animate-pulse' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
                                }`}
                                title={isPlaying ? 'Pausar Reproducción' : 'Auto Play'}
                            >
                                {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                                <span className="hidden lg:inline">{isPlaying ? 'Pausar' : 'Auto Play'}</span>
                            </button>

                            <button
                                onClick={() => setShowNotes(!showNotes)}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                    showNotes ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
                                }`}
                                title="Guion del Líder / Notas"
                            >
                                <Volume2 className="w-3.5 h-3.5" />
                                <span className="hidden lg:inline">Guion del Líder</span>
                            </button>

                            <button
                                onClick={toggleFullscreen}
                                className="p-1.5 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-700 transition-all shadow-xs"
                                title="Pantalla Completa"
                            >
                                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            </button>
                        </>
                    )}

                    {activeTab === 'decks' && (
                        <button
                            onClick={() => {
                                setEditingDeck(null);
                                setDeckForm({ title: '', subtitle: '', category: 'Ventas y Cierre', cloneFromOfficial: true });
                                setShowDeckModal(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-xs active:scale-95"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Nueva Presentación</span>
                        </button>
                    )}

                    <button
                        onClick={() => setShowAiModal(true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-xs"
                        title="Dinamizar con IA"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">IA</span>
                    </button>

                    <a
                        href={tenantBrand.pptxFile}
                        download={tenantBrand.pptxDownloadName}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                        title="Descargar PPTX"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">PPTX</span>
                    </a>
                </div>
            </div>

            {/* VISTA 1: CATÁLOGO CRUD DE PRESENTACIONES */}
            {activeTab === 'decks' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black text-gray-900">Catálogo de Presentaciones Comerciales</h2>
                            <p className="text-xs md:text-sm text-gray-500 font-medium">Selecciona una presentación para entrenar a tu equipo o crea una nueva versión personalizada.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {decks.map(deck => (
                            <div 
                                key={deck.id} 
                                className="bg-white rounded-3xl border border-gray-200/90 hover:border-rose-300 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group"
                            >
                                <div>
                                    {/* Miniatura de la Portada */}
                                    <div 
                                        onClick={() => startPresentation(deck.id)}
                                        className="h-44 bg-gradient-to-br from-slate-900 via-slate-800 to-rose-950 p-6 text-white flex flex-col justify-between relative cursor-pointer overflow-hidden"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider ${
                                                deck.isOfficial ? 'bg-rose-600 text-white' : 'bg-white/20 text-white backdrop-blur-xs'
                                            }`}>
                                                {deck.isOfficial ? 'OFICIAL · SISTEMA' : deck.category || 'PERSONALIZADA'}
                                            </span>
                                            <span className="text-xs font-mono font-bold opacity-80">
                                                {deck.slides.length} Slides
                                            </span>
                                        </div>

                                        <div>
                                            <h3 className="text-xl font-black leading-snug line-clamp-2 group-hover:text-rose-300 transition-colors">
                                                {deck.title}
                                            </h3>
                                            {deck.subtitle && (
                                                <p className="text-xs text-gray-300 mt-1 line-clamp-1 opacity-90 font-medium">
                                                    {deck.subtitle}
                                                </p>
                                            )}
                                        </div>

                                        <div className="absolute inset-0 bg-rose-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                            <span className="px-4 py-2 bg-white text-gray-900 text-xs font-black rounded-xl shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                                ▶ Abrir Presentación
                                            </span>
                                        </div>
                                    </div>

                                    {/* Metadatos */}
                                    <div className="p-5 space-y-3">
                                        <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                                            <span className="flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5" />
                                                Actualizado: {deck.updatedAt || 'Hoy'}
                                            </span>
                                            <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-700 font-bold">
                                                {deck.slides.length} diapositivas
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Acciones CRUD */}
                                <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
                                    <button
                                        onClick={() => startPresentation(deck.id)}
                                        className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-rose-600/20"
                                    >
                                        <Play className="w-3.5 h-3.5 fill-current" />
                                        <span>Presentar</span>
                                    </button>

                                    <button
                                        onClick={() => handleDuplicateDeck(deck)}
                                        className="p-2 hover:bg-white text-gray-600 hover:text-gray-900 border border-transparent hover:border-gray-200 rounded-xl transition-all"
                                        title="Duplicar presentación"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>

                                    {!deck.isOfficial && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setEditingDeck(deck);
                                                    setDeckForm({
                                                        title: deck.title,
                                                        subtitle: deck.subtitle || '',
                                                        category: deck.category || 'Ventas',
                                                        cloneFromOfficial: false
                                                    });
                                                    setShowDeckModal(true);
                                                }}
                                                className="p-2 hover:bg-white text-gray-600 hover:text-blue-600 border border-transparent hover:border-gray-200 rounded-xl transition-all"
                                                title="Editar información"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>

                                            <button
                                                onClick={() => handleDeleteDeck(deck.id, deck.title)}
                                                className="p-2 hover:bg-white text-gray-400 hover:text-rose-600 border border-transparent hover:border-gray-200 rounded-xl transition-all"
                                                title="Eliminar presentación"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}

                                    <a
                                        href={tenantBrand.pptxFile}
                                        download={tenantBrand.pptxDownloadName}
                                        className="p-2 hover:bg-white text-gray-600 hover:text-emerald-600 border border-transparent hover:border-gray-200 rounded-xl transition-all"
                                        title="Descargar PPTX"
                                    >
                                        <Download className="w-4 h-4" />
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* VISTA 2: REPRODUCTOR CINEMA (Zero Bloat, Slide con textos grandes y legibles) */}
            {activeTab === 'presentation' && (
                <div 
                    ref={deckContainerRef} 
                    className={`relative flex flex-col justify-between bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${
                        isFullscreen ? 'fixed inset-0 z-50 bg-white p-8' : 'h-[calc(100vh-140px)] min-h-[520px] max-h-[760px] p-6 md:p-8'
                    }`}
                >
                    <div key={currentSlide} className="h-full flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
                        {slide.isCover ? (
                            slide.num === 1 ? (
                                <div className="flex flex-col lg:flex-row justify-between items-stretch h-full gap-8 my-auto">
                                    <div className="flex-1 flex flex-col justify-center py-2">
                                        <div className="text-xs md:text-sm font-black text-rose-600 tracking-widest uppercase mb-3 flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                                            {slide.category}
                                        </div>
                                        {tenantBrand.logoUrl ? (
                                            <img
                                                src={tenantBrand.logoUrl}
                                                alt={tenantBrand.companyName}
                                                className="h-12 md:h-14 w-auto object-contain self-start mb-5"
                                            />
                                        ) : (
                                            <div className="flex items-center gap-3 mb-5 text-gray-900 font-black text-2xl md:text-3xl">
                                                <Building2 className="w-8 h-8 text-rose-600" />
                                                {tenantBrand.companyName}
                                            </div>
                                        )}
                                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-gray-900 leading-[1.05] tracking-tight mb-4">
                                            Vendemos resultados.<br />
                                            <span className="text-rose-600">No pantallas.</span>
                                        </h1>
                                        <p className="text-lg md:text-xl text-gray-600 font-medium mb-6 max-w-xl leading-relaxed">
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
                                    <div className="w-full lg:w-2/5 bg-gradient-to-br from-rose-600 to-rose-700 rounded-2xl p-6 md:p-8 text-white flex flex-col justify-between shadow-xl shadow-rose-900/20">
                                        <div>
                                            <div className="text-xs font-black tracking-widest uppercase opacity-85 mb-3 flex items-center gap-2">
                                                <Sparkles className="w-4 h-4" />
                                                OBJETIVO ESTRATÉGICO
                                            </div>
                                            <div className="text-2xl md:text-4xl font-black leading-tight">
                                                Más decisiones de compra, sin perder confianza ni integridad.
                                            </div>
                                        </div>
                                        <div className="text-sm md:text-base space-y-2 opacity-95 border-t border-rose-500/50 pt-5 font-bold">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="w-5 h-5 text-rose-200 shrink-0" />
                                                <span>Rúbrica Oficial de 100 Puntos</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="w-5 h-5 text-rose-200 shrink-0" />
                                                <span>Auditoría Automática con IA</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="w-5 h-5 text-rose-200 shrink-0" />
                                                <span>Trazabilidad en Vivo de cada Demo</span>
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
                                        <p className="text-lg md:text-xl text-gray-600 font-medium mb-6">{slide.subtitle}</p>
                                    </div>

                                    <div className="space-y-4 my-2">
                                        {slide.bullets.map((b, idx) => (
                                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 md:p-6 flex items-center gap-5 shadow-xs hover:border-rose-300 hover:shadow-md transition-all">
                                                <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white font-mono font-black text-xl flex items-center justify-center shrink-0 shadow-md shadow-rose-600/30">
                                                    0{idx + 1}
                                                </div>
                                                <div>
                                                    <div className="text-lg md:text-xl font-extrabold text-gray-900">{b.label}</div>
                                                    <div className="text-base text-gray-600 mt-1 font-medium">{b.text}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-center text-base md:text-lg font-black text-emerald-900 shadow-xs">
                                        «EL PROFESIONAL DE VENTAS NO ESPERA QUE EL CLIENTE COMPRE; LO GUÍA A TOMAR LA MEJOR DECISIÓN FINANCIERA PARA SU NEGOCIO.»
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="flex flex-col h-full justify-between">
                                {/* Título Superior del Slide */}
                                <div className="pb-3 border-b border-gray-100">
                                    <div className="text-xs md:text-sm font-black text-rose-600 tracking-widest uppercase mb-1 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-rose-600" />
                                        {slide.category}
                                    </div>
                                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-gray-900 tracking-tight leading-tight">
                                        {slide.title}
                                    </h2>
                                    {slide.subtitle && (
                                        <p className="text-base md:text-lg text-gray-600 font-medium mt-1 leading-snug">
                                            {slide.subtitle}
                                        </p>
                                    )}
                                </div>

                                {/* Contenido Central: 2 Columnas (Textos a la izquierda, Captura a la derecha) */}
                                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch my-3 min-h-0 overflow-hidden">
                                    <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 flex flex-col justify-between overflow-y-auto">
                                        <div className="space-y-4">
                                            {slide.badgeText && (
                                                <span className={`inline-block px-3 py-1 text-xs font-black uppercase tracking-wider rounded-lg border ${
                                                    slide.badgeColor === 'red' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                    slide.badgeColor === 'green' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    slide.badgeColor === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    'bg-blue-50 text-blue-700 border-blue-200'
                                                }`}>
                                                    {slide.badgeText}
                                                </span>
                                            )}

                                            {slide.mainQuote && (
                                                <div className="text-lg md:text-xl lg:text-2xl font-black text-gray-900 leading-snug border-l-4 border-rose-600 pl-4 py-2.5 bg-gradient-to-r from-rose-50 to-white rounded-r-xl shadow-xs">
                                                    {slide.mainQuote}
                                                </div>
                                            )}

                                            <div className="space-y-3">
                                                {slide.bullets.map((b, idx) => (
                                                    <div 
                                                        key={idx} 
                                                        className={`p-3.5 rounded-xl border transition-all duration-200 hover:shadow-md ${
                                                            b.isDanger 
                                                                ? 'bg-rose-50/80 border-rose-200' 
                                                                : b.isSuccess 
                                                                ? 'bg-emerald-50/80 border-emerald-200' 
                                                                : 'bg-white border-gray-200 shadow-xs'
                                                        }`}
                                                    >
                                                        <div className={`text-base md:text-lg font-black flex items-center gap-2 ${
                                                            b.isDanger ? 'text-rose-700' : b.isSuccess ? 'text-emerald-800' : 'text-gray-900'
                                                        }`}>
                                                            {b.isDanger && <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />}
                                                            {b.isSuccess && <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />}
                                                            {!b.isDanger && !b.isSuccess && <div className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0" />}
                                                            <span>{b.label}</span>
                                                        </div>
                                                        <div className="text-sm md:text-base text-gray-700 leading-relaxed font-medium mt-1 pl-4 whitespace-pre-line">
                                                            {b.text}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div 
                                        onClick={() => slide.imageSrc && setZoomedImage({ src: slide.imageSrc, caption: slide.imageCaption })}
                                        className="group relative bg-slate-100/70 hover:bg-slate-100 border border-gray-200 hover:border-rose-400 rounded-2xl p-3 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer shadow-inner overflow-hidden"
                                    >
                                        {slide.imageSrc ? (
                                            <>
                                                <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-xl">
                                                    <img
                                                        src={slide.imageSrc}
                                                        alt={slide.imageCaption || 'Captura Real CRM'}
                                                        className="max-h-[300px] lg:max-h-[380px] w-auto object-contain rounded-xl shadow-lg border border-white group-hover:scale-[1.02] transition-transform duration-300"
                                                    />
                                                    <div className="absolute inset-0 bg-gray-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-black text-xs md:text-sm rounded-xl backdrop-blur-xs">
                                                        <ZoomIn className="w-5 h-5" />
                                                        <span>Clic para ampliar captura en HD</span>
                                                    </div>
                                                </div>
                                                {slide.imageCaption && (
                                                    <div className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mt-2 flex items-center gap-1.5">
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

                    {/* Guion del Líder Flotante (Solo visible si showNotes es TRUE; 100% oculto si es FALSE) */}
                    {showNotes && (
                        <div className="absolute bottom-16 left-6 right-6 z-20 bg-slate-900/95 text-white p-5 rounded-2xl shadow-2xl border border-slate-700 backdrop-blur-md flex items-start justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-blue-500 text-white rounded-lg shrink-0 shadow-sm">
                                    <Volume2 className="w-5 h-5" />
                                </div>
                                <div className="space-y-1">
                                    <div className="text-xs font-black uppercase tracking-wider text-blue-300 flex items-center gap-2">
                                        <span>Guion del Líder / Notas del Facilitador</span>
                                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-200 rounded text-[10px]">OFICIAL</span>
                                    </div>
                                    <p className="text-sm md:text-base text-slate-100 font-medium italic leading-relaxed">
                                        "{slide.speakerNotes}"
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowNotes(false)}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                                title="Cerrar guion"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {/* Dock Inferior Limpio (Dentro del contenedor, sin barras extras ni scrollbars) */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-auto">
                        <button
                            onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
                            disabled={currentSlide === 0}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            <span>Anterior</span>
                        </button>

                        <div className="flex items-center gap-2">
                            <span className="font-mono text-xs md:text-sm font-black text-gray-800 bg-gray-50 border border-gray-200 px-3 py-1 rounded-xl">
                                Slide {slide.num} de {activeSlides.length}
                            </span>
                        </div>

                        <button
                            onClick={() => setCurrentSlide(prev => Math.min(activeSlides.length - 1, prev + 1))}
                            disabled={currentSlide === activeSlides.length - 1}
                            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs md:text-sm font-black flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md shadow-rose-600/20 active:scale-95"
                        >
                            <span>Siguiente</span>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* VISTA 3: GUÍA RÁPIDA & SCRIPTS */}
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

            {/* MODAL GRID: SELECTOR DE DIAPOSITIVAS (Reemplaza el scrollbar feo) */}
            {showSlidesModal && (
                <div 
                    onClick={() => setShowSlidesModal(false)}
                    className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                >
                    <div 
                        onClick={e => e.stopPropagation()}
                        className="bg-white rounded-3xl max-w-4xl w-full max-h-[85vh] p-6 shadow-2xl flex flex-col justify-between overflow-hidden"
                    >
                        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl">
                                    <LayoutGrid className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-gray-900">Navegador de Diapositivas</h3>
                                    <p className="text-xs text-gray-500 font-medium">Haz clic en cualquier diapositiva para saltar directamente a ella.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowSlidesModal(false)}
                                className="p-2 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-xl transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto py-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {activeSlides.map((s, idx) => (
                                <button
                                    key={s.num}
                                    onClick={() => {
                                        setCurrentSlide(idx);
                                        setShowSlidesModal(false);
                                    }}
                                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                                        currentSlide === idx
                                            ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/30 shadow-md'
                                            : 'bg-slate-50 border-gray-200 hover:bg-white hover:border-gray-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${
                                            currentSlide === idx ? 'bg-rose-600 text-white' : 'bg-gray-200 text-gray-700'
                                        }`}>
                                            {s.num}
                                        </span>
                                        {s.isCover && (
                                            <span className="text-[9px] font-black text-rose-600 uppercase">Portada</span>
                                        )}
                                    </div>
                                    <div className="text-xs font-bold text-gray-900 line-clamp-2 leading-snug">
                                        {s.title}
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="pt-3 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setShowSlidesModal(false)}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CRUD: CREAR / EDITAR PRESENTACIÓN */}
            {showDeckModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-lg w-full border border-gray-100 shadow-2xl p-6 md:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl">
                                    <Presentation className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-black text-gray-900 text-lg">
                                        {editingDeck ? 'Editar Presentación' : 'Crear Nueva Presentación'}
                                    </h3>
                                    <p className="text-xs text-gray-500 font-bold">
                                        {tenantBrand.companyName}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDeckModal(false)}
                                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateOrUpdateDeck} className="space-y-4">
                            <div>
                                <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1">
                                    Título de la Presentación *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Capacitación Cierre de Demos Q4"
                                    value={deckForm.title}
                                    onChange={e => setDeckForm({ ...deckForm, title: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1">
                                    Subtítulo / Objetivo
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: Técnicas avanzadas de diagnóstico y manejo de objeciones"
                                    value={deckForm.subtitle}
                                    onChange={e => setDeckForm({ ...deckForm, subtitle: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1">
                                    Categoría
                                </label>
                                <select
                                    value={deckForm.category}
                                    onChange={e => setDeckForm({ ...deckForm, category: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
                                >
                                    <option value="Ventas y Cierre">Ventas y Cierre</option>
                                    <option value="Onboarding de SDRs">Onboarding de SDRs</option>
                                    <option value="Demostración de Producto">Demostración de Producto</option>
                                    <option value="Sector Agrícola">Sector Agrícola</option>
                                    <option value="Sector Servicios">Sector Servicios</option>
                                    <option value="Personalizada">Personalizada</option>
                                </select>
                            </div>

                            {!editingDeck && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-rose-900">
                                        <input
                                            type="checkbox"
                                            checked={deckForm.cloneFromOfficial}
                                            onChange={e => setDeckForm({ ...deckForm, cloneFromOfficial: e.target.checked })}
                                            className="rounded text-rose-600 focus:ring-rose-500"
                                        />
                                        <span>Copiar las 25 diapositivas de la metodología oficial como base inicial</span>
                                    </label>
                                </div>
                            )}

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowDeckModal(false)}
                                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/20 transition-all active:scale-95"
                                >
                                    {editingDeck ? 'Guardar Cambios' : 'Crear Presentación'}
                                </button>
                            </div>
                        </form>
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

            {/* Modal de Dinamización con IA */}
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
