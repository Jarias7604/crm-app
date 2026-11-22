import React, { useMemo, useState } from 'react';
import {
    ClipboardList,
    Settings2,
    Flame,
    Clock3,
    Sparkles,
    ChevronDown,
    ChevronUp,
    Target,
    Briefcase,
    Receipt,
    Building2,
    Megaphone,
    MessageSquareText,
    CalendarClock,
    Layers,
} from 'lucide-react';
import type { Lead } from '../../types';
import {
    DEFAULT_INTAKE_DISPLAY_SETTINGS,
    extractLeadIntakeProfile,
    type IntakeFieldCategory,
    type LeadIntakeDisplaySettings,
    type LeadIntakeEntry,
} from '../../utils/leadIntakeProfile';

interface LeadIntakeDiagnosticCardProps {
    lead: Lead;
    settings?: LeadIntakeDisplaySettings;
    isAdmin?: boolean;
    onOpenSettings?: () => void;
}

const URGENCY_BADGE: Record<
    'high' | 'medium' | 'low',
    { label: string; classes: string; cardClasses: string }
> = {
    high: {
        label: 'Urgencia Alta',
        classes: 'bg-rose-50 text-rose-700 border-rose-200',
        cardClasses: 'bg-rose-50/70 border-rose-200/90 text-rose-950',
    },
    medium: {
        label: 'Urgencia Media',
        classes: 'bg-amber-50 text-amber-800 border-amber-200',
        cardClasses: 'bg-amber-50/60 border-amber-200/90 text-amber-950',
    },
    low: {
        label: 'Solo evaluando',
        classes: 'bg-slate-100 text-slate-600 border-slate-200',
        cardClasses: 'bg-slate-50 border-slate-200 text-slate-800',
    },
};

function renderFieldIcon(entry: LeadIntakeEntry) {
    switch (entry.key) {
        case 'punto_de_mejora':
            return <Target className="w-3.5 h-3.5 text-indigo-600 shrink-0" />;
        case 'urgencia':
            return <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" />;
        case 'facturas_anual':
            return <Receipt className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
        case 'cargo':
            return <Briefcase className="w-3.5 h-3.5 text-slate-600 shrink-0" />;
        case 'metodo_actual':
            return <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
        case 'proyectos_disponibles':
            return <Layers className="w-3.5 h-3.5 text-violet-600 shrink-0" />;
        case 'anuncio':
            return <Megaphone className="w-3.5 h-3.5 text-blue-600 shrink-0" />;
        case 'comentarios':
            return <MessageSquareText className="w-3.5 h-3.5 text-teal-600 shrink-0" />;
        case 'fecha_formulario':
            return <CalendarClock className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
        default:
            return categoryIcon(entry.category);
    }
}

function categoryIcon(cat: IntakeFieldCategory) {
    if (cat === 'priority') return <Clock3 className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
    if (cat === 'pain') return <Target className="w-3.5 h-3.5 text-indigo-600 shrink-0" />;
    return <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />;
}

export const LeadIntakeDiagnosticCard: React.FC<LeadIntakeDiagnosticCardProps> = ({
    lead,
    settings,
    isAdmin = false,
    onOpenSettings,
}) => {
    const [showHidden, setShowHidden] = useState(false);

    const activeSettings = settings || {
        company_id: lead.company_id,
        ...DEFAULT_INTAKE_DISPLAY_SETTINGS,
    };

    const intakeProfile = useMemo(
        () => extractLeadIntakeProfile(lead, activeSettings.custom_field_labels),
        [lead, activeSettings.custom_field_labels],
    );

    if (!intakeProfile.hasData || intakeProfile.entries.length === 0) {
        return null;
    }

    const visibleSet = new Set(activeSettings.visible_in_detail || []);
    const visibleEntries = intakeProfile.entries.filter((e) => visibleSet.has(e.key));
    const hiddenEntries = intakeProfile.entries.filter((e) => !visibleSet.has(e.key));
    const entriesToRender = showHidden ? intakeProfile.entries : visibleEntries;

    // Highlight cards: Pain ("punto_de_mejora") & Urgency ("urgencia")
    const painEntry = entriesToRender.find((e) => e.key === 'punto_de_mejora') || null;
    const urgencyEntry = entriesToRender.find((e) => e.key === 'urgencia') || null;
    const detailEntries = entriesToRender.filter(
        (e) => e.key !== 'punto_de_mejora' && e.key !== 'urgencia',
    );

    const urgencyMeta = intakeProfile.urgencyLevel
        ? URGENCY_BADGE[intakeProfile.urgencyLevel]
        : URGENCY_BADGE.medium;

    return (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            {/* Header Strip */}
            <div className="bg-slate-50/90 border-b border-slate-200/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
                        <ClipboardList className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider truncate">
                        Diagnóstico del Formulario
                    </h4>
                    {(intakeProfile.sourceSheetName || intakeProfile.sourceRowNumber) && (
                        <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-600 shrink-0">
                            {intakeProfile.sourceSheetName || 'Google Sheets'}
                            {intakeProfile.sourceRowNumber ? ` · Fila ${intakeProfile.sourceRowNumber}` : ''}
                        </span>
                    )}
                    {intakeProfile.reentries.length > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[10px] font-black text-amber-700 shrink-0">
                            ♻️ {intakeProfile.reentries.length} {intakeProfile.reentries.length === 1 ? 'reingreso' : 'reingresos'}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {intakeProfile.urgencyLevel && (
                        <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wide ${urgencyMeta.classes}`}
                        >
                            {intakeProfile.urgencyLevel === 'high' && <Flame className="w-3 h-3" />}
                            {urgencyMeta.label}
                        </span>
                    )}
                    {onOpenSettings && isAdmin && (
                        <button
                            type="button"
                            onClick={onOpenSettings}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 text-[10px] font-bold transition-colors cursor-pointer"
                            title="Configurar qué campos del formulario se muestran"
                        >
                            <Settings2 className="w-3 h-3" />
                            <span>Configurar</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="p-4 space-y-3">
                {/* Decision Highlights: Pain & Urgency */}
                {(painEntry || urgencyEntry) && (
                    <div className={`grid grid-cols-1 ${painEntry && urgencyEntry ? 'sm:grid-cols-2' : ''} gap-2.5`}>
                        {painEntry && (
                            <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/90 space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                                    <Target className="w-3.5 h-3.5" />
                                    {painEntry.label}
                                </span>
                                <p className="text-xs sm:text-[13px] font-extrabold text-indigo-950 leading-snug">
                                    {painEntry.value}
                                </p>
                            </div>
                        )}
                        {urgencyEntry && (
                            <div className={`p-3 rounded-xl border space-y-1 ${urgencyMeta.cardClasses}`}>
                                <span className="text-[10px] font-black uppercase tracking-wider opacity-80 flex items-center gap-1.5">
                                    <Flame className="w-3.5 h-3.5" />
                                    {urgencyEntry.label}
                                </span>
                                <p className="text-xs sm:text-[13px] font-extrabold leading-snug">
                                    {urgencyEntry.value}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Secondary Qualification Fields Grid */}
                {detailEntries.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {detailEntries.map((entry) => (
                            <div
                                key={entry.key}
                                className={`p-2.5 rounded-lg bg-slate-50/90 border border-slate-200/80 space-y-0.5 ${
                                    entry.key === 'comentarios' || entry.value.length > 60 ? 'sm:col-span-2 lg:col-span-3' : ''
                                }`}
                            >
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                    {renderFieldIcon(entry)}
                                    <span className="truncate">{entry.shortLabel}</span>
                                    {entry.isExtra && (
                                        <span className="px-1.5 py-0.2 rounded bg-violet-100 text-violet-700 text-[8px] font-black">
                                            NUEVO
                                        </span>
                                    )}
                                </span>
                                <p className="text-xs font-semibold text-slate-800 leading-snug whitespace-pre-wrap break-words">
                                    {entry.value}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {visibleEntries.length === 0 && !showHidden && (
                    <p className="text-xs text-slate-500 italic">
                        Todos los campos capturados del formulario están ocultos por la configuración actual de la empresa.
                    </p>
                )}

                {hiddenEntries.length > 0 && (
                    <div className="pt-1 flex justify-end">
                        <button
                            type="button"
                            onClick={() => setShowHidden((v) => !v)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                            {showHidden ? (
                                <>
                                    <ChevronUp className="w-3.5 h-3.5" />
                                    <span>Ocultar campos adicionales</span>
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="w-3.5 h-3.5" />
                                    <span>Ver {hiddenEntries.length} campo{hiddenEntries.length === 1 ? '' : 's'} oculto{hiddenEntries.length === 1 ? '' : 's'}</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
