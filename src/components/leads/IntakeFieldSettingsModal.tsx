import React, { useEffect, useMemo, useState } from 'react';
import {
    X,
    SlidersHorizontal,
    Save,
    Loader2,
    RotateCcw,
    Sparkles,
    Eye,
    Table2,
    Bot,
    Clock,
    ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    DEFAULT_INTAKE_DISPLAY_SETTINGS,
    discoverAvailableIntakeFields,
    type LeadIntakeDisplaySettings,
    type LeadLikeInput,
} from '../../utils/leadIntakeProfile';
import { leadIntakeSettingsService } from '../../services/leadIntakeSettings';

interface IntakeFieldSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyId: string;
    userId?: string;
    isAdmin: boolean;
    leads: LeadLikeInput[];
    settings: LeadIntakeDisplaySettings;
    onSaved: (updated: LeadIntakeDisplaySettings) => void;
}

export const IntakeFieldSettingsModal: React.FC<IntakeFieldSettingsModalProps> = ({
    isOpen,
    onClose,
    companyId,
    userId,
    isAdmin,
    leads,
    settings,
    onSaved,
}) => {
    const [detailKeys, setDetailKeys] = useState<string[]>(settings.visible_in_detail);
    const [tableKeys, setTableKeys] = useState<string[]>(settings.visible_in_table);
    const [aiKeys, setAiKeys] = useState<string[]>(settings.visible_in_ai);
    const [showInTimeline, setShowInTimeline] = useState<boolean>(settings.show_in_timeline);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setDetailKeys(settings.visible_in_detail);
        setTableKeys(settings.visible_in_table);
        setAiKeys(settings.visible_in_ai);
        setShowInTimeline(settings.show_in_timeline);
    }, [isOpen, settings]);

    const availableFields = useMemo(
        () => discoverAvailableIntakeFields(leads, settings.custom_field_labels),
        [leads, settings.custom_field_labels],
    );

    if (!isOpen) return null;

    const toggleKey = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, key: string) => {
        if (!isAdmin) return;
        setList((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    };

    const handleResetDefaults = () => {
        if (!isAdmin) return;
        setDetailKeys(DEFAULT_INTAKE_DISPLAY_SETTINGS.visible_in_detail);
        setTableKeys(DEFAULT_INTAKE_DISPLAY_SETTINGS.visible_in_table);
        setAiKeys(DEFAULT_INTAKE_DISPLAY_SETTINGS.visible_in_ai);
        setShowInTimeline(DEFAULT_INTAKE_DISPLAY_SETTINGS.show_in_timeline);
    };

    const handleSave = async () => {
        if (!isAdmin || !companyId) return;
        setSaving(true);
        try {
            const updated = await leadIntakeSettingsService.saveSettings(companyId, userId, {
                visible_in_detail: detailKeys,
                visible_in_table: tableKeys,
                visible_in_ai: aiKeys,
                show_in_timeline: showInTimeline,
            });
            onSaved(updated);
            toast.success('Configuración de campos del formulario guardada');
            onClose();
        } catch (err: any) {
            toast.error(err?.message || 'No se pudo guardar la configuración');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                            <SlidersHorizontal className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                                Campos del Formulario (Google Sheets / Ads)
                            </h3>
                            <p className="text-[11px] text-slate-500 font-medium">
                                El sistema siempre guarda el 100% de las columnas; aquí decides qué destacar en tu empresa.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {!isAdmin && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-semibold flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 shrink-0" />
                            <span>Solo un administrador de la empresa puede modificar esta configuración global.</span>
                        </div>
                    )}

                    {/* Timeline Toggle */}
                    <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-200/80 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                            <div>
                                <p className="text-xs font-black text-slate-900">
                                    Mostrar ingreso de formulario en Línea de Tiempo (Seguimientos)
                                </p>
                                <p className="text-[11px] text-slate-500">
                                    Registra visualmente el diagnóstico completo inicial y cada reingreso sin afectar métricas ni Next Trigger.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            disabled={!isAdmin}
                            onClick={() => setShowInTimeline((v) => !v)}
                            className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 ${
                                showInTimeline ? 'bg-indigo-600' : 'bg-slate-300'
                            } ${!isAdmin ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <span
                                className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                                    showInTimeline ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Matrix Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                        Campo detectado del Excel
                                    </th>
                                    <th className="px-3 py-2.5 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider w-28">
                                        <span className="inline-flex items-center gap-1">
                                            <Eye className="w-3 h-3 text-blue-600" /> Ficha Lead
                                        </span>
                                    </th>
                                    <th className="px-3 py-2.5 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider w-28">
                                        <span className="inline-flex items-center gap-1">
                                            <Table2 className="w-3 h-3 text-indigo-600" /> Tabla Leads
                                        </span>
                                    </th>
                                    <th className="px-3 py-2.5 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider w-28">
                                        <span className="inline-flex items-center gap-1">
                                            <Bot className="w-3 h-3 text-emerald-600" /> Contexto IA
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {availableFields.map((field) => {
                                    const inDetail = detailKeys.includes(field.key);
                                    const inTable = tableKeys.includes(field.key);
                                    const inAi = aiKeys.includes(field.key);
                                    return (
                                        <tr key={field.key} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-slate-800">
                                                        {field.label}
                                                    </span>
                                                    {field.isExtra && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 text-[9px] font-black uppercase">
                                                            <Sparkles className="w-2.5 h-2.5" /> Nuevo Excel
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={inDetail}
                                                    disabled={!isAdmin}
                                                    onChange={() => toggleKey(detailKeys, setDetailKeys, field.key)}
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={inTable}
                                                    disabled={!isAdmin}
                                                    onChange={() => toggleKey(tableKeys, setTableKeys, field.key)}
                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={inAi}
                                                    disabled={!isAdmin}
                                                    onChange={() => toggleKey(aiKeys, setAiKeys, field.key)}
                                                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
                    {isAdmin ? (
                        <button
                            type="button"
                            onClick={handleResetDefaults}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restablecer recomendados</span>
                        </button>
                    ) : (
                        <div />
                    )}

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
                        >
                            Cerrar
                        </button>
                        {isAdmin && (
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4449AA] hover:bg-[#383d8f] disabled:opacity-60 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                            >
                                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                <span>Guardar configuración</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
