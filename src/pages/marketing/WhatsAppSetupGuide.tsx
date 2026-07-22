import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    MessageSquare, ArrowLeft, Copy, Check, ExternalLink,
    ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';

const WEBHOOK_URL = 'https://mtxqqamitglhehaktgxm.supabase.co/functions/v1/meta-webhook';
const VERIFY_TOKEN = 'crm_secure_verify';

interface Step {
    id: number;
    title: string;
    description: string;
    details: string[];
    link?: { label: string; url: string };
    warning?: string;
    tip?: string;
    isCopy?: boolean;
}

const STEPS: Step[] = [
    {
        id: 1,
        title: 'Crea una cuenta en Meta Business Suite',
        description: 'Necesitas una cuenta de Meta Business para registrar tu número de WhatsApp de forma oficial.',
        details: [
            'Ve a business.facebook.com',
            'Inicia sesión con tu cuenta de Facebook personal',
            'Crea un negocio nuevo o usa uno existente',
            'Agrega el nombre de tu empresa y correo de contacto',
        ],
        link: { label: 'Ir a Meta Business Suite', url: 'https://business.facebook.com' },
        tip: 'Si ya tienes Meta Business Suite configurado para tu empresa, puedes saltar este paso.',
    },
    {
        id: 2,
        title: 'Crea una App en Meta Developers',
        description: 'La App de Meta es el puente que conecta tu número de WhatsApp con el CRM.',
        details: [
            'Ve a developers.facebook.com',
            'Clic en "Mis apps" → "Crear app"',
            'Selecciona el tipo: "Negocios"',
            'Pon el nombre de tu app (ej: "Mi Empresa CRM")',
            'Vincula tu cuenta de Meta Business creada en el paso anterior',
        ],
        link: { label: 'Ir a Meta Developers', url: 'https://developers.facebook.com' },
    },
    {
        id: 3,
        title: 'Agrega WhatsApp a tu App',
        description: 'Dentro de tu App de Meta, activa el producto de WhatsApp Business.',
        details: [
            'Dentro de tu App → panel izquierdo → "Agregar producto"',
            'Busca "WhatsApp" y haz clic en "Configurar"',
            'Vincula tu cuenta de WhatsApp Business (WABA)',
            'Si no tienes una WABA, Meta te guiará para crearla',
        ],
        warning: 'Tu número de WhatsApp no puede estar registrado en la app de WhatsApp personal mientras lo usas en la API. Deberás eliminarlo de la app primero.',
    },
    {
        id: 4,
        title: 'Genera tu Access Token permanente',
        description: 'El token es la contraseña que le da al CRM permiso de enviar y recibir mensajes por tu número.',
        details: [
            'Ve a business.facebook.com → Configuración → Usuarios del Sistema',
            'Crea un nuevo "Usuario del Sistema" (rol: Administrador)',
            'Asígnale acceso a tu App de WhatsApp',
            'Clic en "Generar token"',
            'Elige tu App y marca el permiso: whatsapp_business_messaging',
            'Marca también: whatsapp_business_management',
            'Clic en "Generar token" y COPIA el token inmediatamente',
        ],
        link: { label: 'Ir a Usuarios del Sistema', url: 'https://business.facebook.com/settings/system-users' },
        warning: 'El token solo se muestra UNA VEZ. Guárdalo en un lugar seguro antes de cerrar la ventana.',
        tip: 'Un "Usuario del Sistema" genera tokens que NO vencen, a diferencia de tokens de usuario personal que expiran en 60 días.',
    },
    {
        id: 5,
        title: 'Configura el Webhook en Meta',
        description: 'El Webhook le dice a Meta a dónde enviar los mensajes de WhatsApp que recibe tu número. Solo se hace UNA VEZ por App.',
        details: [
            'Ve a developers.facebook.com → Tu App → WhatsApp → Configuración',
            'Busca la sección "Webhook"',
            'Haz clic en "Verificar y guardar"',
            'Ingresa la URL de Callback y el Token de Verificación (cópialos abajo)',
            'Suscribe el campo "messages" y guarda',
        ],
        isCopy: true,
        tip: 'Después de guardar el webhook, asegúrate de que el campo "messages" aparezca como suscrito (con un ✅).',
    },
    {
        id: 6,
        title: 'Conecta tu número en el CRM',
        description: 'Con el token ya generado, vuelve al CRM y usa el asistente de conexión.',
        details: [
            'Ve a Configuración → Workspaces & Departamentos',
            'Haz clic en ⚙️ de tu workspace o crea uno nuevo',
            'En la sección WhatsApp, pega tu Access Token',
            'El CRM detectará automáticamente todos tus números',
            'Selecciona el número que quieres conectar a este workspace',
            'Clic en "Guardar y Activar"',
        ],
        link: { label: 'Ir a Workspaces', url: '/company/workspaces' },
        tip: 'Si tienes 3 números, crea 3 workspaces y repite este paso para cada uno.',
    },
];

export default function WhatsAppSetupGuide() {
    const [expanded, setExpanded] = useState<number | null>(1);
    const [copied, setCopied] = useState<string | null>(null);

    const copy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
        toast.success('Copiado al portapapeles');
    };

    return (
        <div className="max-w-3xl mx-auto pb-16 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    to="/marketing/settings"
                    className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-green-500 flex items-center justify-center shadow-lg shadow-green-200">
                        <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">Guía de Configuración WhatsApp</h1>
                        <p className="text-sm text-gray-400 font-medium">Sigue estos 6 pasos para conectar tu número de WhatsApp al CRM</p>
                    </div>
                </div>
            </div>

            {/* Time estimate */}
            <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center gap-3">
                <Zap className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                    <p className="text-sm font-black text-green-800">Tiempo estimado: 15-20 minutos</p>
                    <p className="text-xs text-green-600 font-medium">Una vez configurado, funciona permanentemente sin necesidad de renovar nada.</p>
                </div>
            </div>

            {/* Steps */}
            <div className="space-y-3">
                {STEPS.map((step) => {
                    const isOpen = expanded === step.id;
                    return (
                        <div
                            key={step.id}
                            className={`bg-white rounded-3xl border transition-all overflow-hidden ${
                                isOpen ? 'border-green-300 shadow-lg shadow-green-50' : 'border-gray-100 hover:border-gray-200'
                            }`}
                        >
                            {/* Step header */}
                            <button
                                onClick={() => setExpanded(isOpen ? null : step.id)}
                                className="w-full flex items-center gap-4 p-5 text-left"
                            >
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black shrink-0 transition-all ${
                                    isOpen ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
                                }`}>
                                    {step.id}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-black text-gray-900">{step.title}</h3>
                                    <p className="text-xs text-gray-400 font-medium truncate">{step.description}</p>
                                </div>
                                {isOpen
                                    ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                                    : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                            </button>

                            {/* Step content */}
                            {isOpen && (
                                <div className="px-5 pb-6 space-y-4">
                                    <div className="space-y-2 pl-14">
                                        {step.details.map((d, i) => (
                                            <div key={i} className="flex items-start gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                                                <p className="text-sm text-gray-600 font-medium">{d}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Webhook copy box */}
                                    {step.isCopy && (
                                        <div className="ml-14 bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Copia estos datos en Meta:</p>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-2.5">
                                                    <div>
                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">URL de Callback</p>
                                                        <p className="text-xs font-mono text-gray-700 break-all">{WEBHOOK_URL}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => copy(WEBHOOK_URL, 'url')}
                                                        className="ml-3 p-2 hover:bg-gray-50 rounded-lg transition-colors shrink-0"
                                                    >
                                                        {copied === 'url'
                                                            ? <Check className="w-4 h-4 text-green-500" />
                                                            : <Copy className="w-4 h-4 text-gray-400" />}
                                                    </button>
                                                </div>
                                                <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-2.5">
                                                    <div>
                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Token de Verificación</p>
                                                        <p className="text-xs font-mono text-gray-700">{VERIFY_TOKEN}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => copy(VERIFY_TOKEN, 'vt')}
                                                        className="ml-3 p-2 hover:bg-gray-50 rounded-lg transition-colors shrink-0"
                                                    >
                                                        {copied === 'vt'
                                                            ? <Check className="w-4 h-4 text-green-500" />
                                                            : <Copy className="w-4 h-4 text-gray-400" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Warning */}
                                    {step.warning && (
                                        <div className="ml-14 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                            <p className="text-xs text-amber-700 font-medium">{step.warning}</p>
                                        </div>
                                    )}

                                    {/* Tip */}
                                    {step.tip && (
                                        <div className="ml-14 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                                            <Zap className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                            <p className="text-xs text-blue-700 font-medium">{step.tip}</p>
                                        </div>
                                    )}

                                    {/* Link */}
                                    {step.link && (
                                        <div className="ml-14">
                                            {step.link.url.startsWith('http') ? (
                                                <a
                                                    href={step.link.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-black text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all"
                                                >
                                                    {step.link.label}
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            ) : (
                                                <Link
                                                    to={step.link.url}
                                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all"
                                                >
                                                    {step.link.label}
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </Link>
                                            )}
                                        </div>
                                    )}

                                    {/* Next step button */}
                                    {step.id < 6 && (
                                        <div className="ml-14 pt-2">
                                            <button
                                                onClick={() => setExpanded(step.id + 1)}
                                                className="text-xs text-green-600 font-black hover:text-green-700 transition-colors"
                                            >
                                                Continuar al paso {step.id + 1} →
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer CTA */}
            <div className="bg-gray-900 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <p className="text-white font-black text-base">¿Listo para conectar?</p>
                    <p className="text-gray-400 text-sm font-medium">Sigue los pasos de arriba y luego vuelve al CRM para activar tu número.</p>
                </div>
                <Link
                    to="/company/workspaces"
                    className="px-6 py-3 bg-green-500 hover:bg-green-400 text-white font-black text-[11px] uppercase tracking-widest rounded-xl transition-all whitespace-nowrap"
                >
                    Ir a Workspaces →
                </Link>
            </div>
        </div>
    );
}
