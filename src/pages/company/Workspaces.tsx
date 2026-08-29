import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    Building2, Plus, Key, Loader2, X, Check, ChevronDown,
    Settings, ShieldAlert, ArrowLeftRight, Wifi, WifiOff, CheckCircle2, XCircle, RefreshCw, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../services/supabase';
import type { Company, Profile } from '../../types';
import WhatsAppConnectWizard from '../../components/marketing/WhatsAppConnectWizard';
import WhatsAppEmbeddedConnect from '../../components/marketing/WhatsAppEmbeddedConnect';
import { CustomSelect } from '../../components/ui/CustomSelect';

export default function Workspaces() {
    const { profile, setSimulatedCompanyId } = useAuth();
    const [parentCompany, setParentCompany] = useState<Company | null>(null);
    const [workspaces, setWorkspaces] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingWorkspace, setEditingWorkspace] = useState<Company | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        waba_id: '',
        phone_number_id: '',
        sender_phone_number: '',
        whatsapp_token: '',
        allowed_permissions: [] as string[],
        agentId: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [verifyStatus, setVerifyStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
    const [verifyDetails, setVerifyDetails] = useState<string>('');
    const [showWizard, setShowWizard] = useState<'embedded' | 'manual' | false>(false);
    const [agents, setAgents] = useState<Profile[]>([]);
    const [agentsByWorkspace, setAgentsByWorkspace] = useState<Record<string, Profile[]>>({});
    const [showAdvanced, setShowAdvanced] = useState(false);

    // WhatsApp status per workspace: { [companyId]: 'active' | 'inactive' | 'loading' }
    const [waStatus, setWaStatus] = useState<Record<string, 'active' | 'inactive' | 'loading'>>({});

    // Parent allowed permissions (to constrain child feature selection)
    const [parentPermissions, setParentPermissions] = useState<string[]>([]);

    const loadData = useCallback(async () => {
        if (!profile?.company_id) return;
        setLoading(true);
        try {
            // Step 1: get current company to find parentId (required first)
            const { data: currentComp } = await supabase
                .from('companies')
                .select('id, parent_company_id, allowed_permissions')
                .eq('id', profile.company_id)
                .single();

            const parentId = currentComp?.parent_company_id || profile.company_id;

            // Step 2: fire all remaining queries in parallel (they all depend on parentId)
            const [parentResult, listResult] = await Promise.all([
                supabase.from('companies').select('*').eq('id', parentId).single(),
                supabase.from('companies').select('*').or(`id.eq.${parentId},parent_company_id.eq.${parentId}`).order('name')
            ]);

            if (listResult.error) throw listResult.error;

            if (parentResult.data) {
                setParentCompany(parentResult.data as Company);
                setParentPermissions(parentResult.data.allowed_permissions || []);
            }

            const ws = listResult.data || [];
            setWorkspaces(ws);

            // Step 3: parallel — WhatsApp integrations + agents (both need ws IDs)
            const allIds = [parentId, ...ws.map((w: Company) => w.id)];
            const [integrationsResult, agentsResult] = await Promise.all([
                ws.length > 0
                    ? supabase.from('marketing_integrations').select('company_id, is_active, settings').in('company_id', allIds).eq('provider', 'whatsapp').eq('is_active', true)
                    : Promise.resolve({ data: [] }),
                supabase.from('profiles').select('id, full_name, email, avatar_url, company_id, role').in('company_id', allIds).order('full_name')
            ]);

            // WhatsApp status map
            const statusMap: Record<string, 'active' | 'inactive'> = {};
            allIds.forEach((id: string) => { statusMap[id] = 'inactive'; });
            ((integrationsResult as any).data || []).forEach((i: any) => {
                if (i.settings?.token && i.settings?.phoneNumberId) statusMap[i.company_id] = 'active';
            });
            setWaStatus(statusMap);

            // Agents map
            const agentsData = agentsResult.data || [];
            const aMap: Record<string, Profile[]> = {};
            allIds.forEach(id => { aMap[id] = []; });
            agentsData.forEach((a: any) => { if (aMap[a.company_id]) aMap[a.company_id].push(a as Profile); });
            setAgents(agentsData as Profile[]);
            setAgentsByWorkspace(aMap);

        } catch (err) {
            console.error('Error loading workspaces:', err);
            toast.error('Error al cargar workspaces');
        } finally {
            setLoading(false);
        }
    }, [profile?.company_id]);



    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSwitchWorkspace = (workspaceId: string, name: string) => {
        if (workspaceId === profile?.company_id) {
            toast.error('Ya te encuentras en este workspace');
            return;
        }
        setSimulatedCompanyId(workspaceId);
        window.dispatchEvent(new CustomEvent('company-changed', { detail: workspaceId }));
        toast.success(`Cambiado al workspace "${name}"`);
    };

    const openCreateModal = () => {
        setEditingWorkspace(null);
        setShowWizard('embedded');
        setFormData({
            name: '',
            waba_id: '',
            phone_number_id: '',
            sender_phone_number: '',
            whatsapp_token: '',
            allowed_permissions: [...parentPermissions],
            agentId: ''
        });
        setShowAdvanced(false);
        setShowModal(true);
    };

    const openEditModal = (workspace: Company) => {
        setEditingWorkspace(workspace);
        setVerifyStatus('idle');
        setVerifyDetails('');
        setShowWizard('embedded'); // default: premium Embedded Signup
        // Pre-populate the agent from existing profiles for this workspace
        const existingAgent = agentsByWorkspace[workspace.id]?.[0];
        setFormData(prev => ({ ...prev, agentId: existingAgent?.id || '' }));
        setShowModal(true);
        fetchIntegrationDetails(workspace);
    };

    // Called by the WhatsAppConnectWizard when the user completes the flow
    const handleWizardSave = async (data: { token: string; phoneNumberId: string; wabaId: string; phone: string }) => {
        const targetCompanyId = editingWorkspace?.id;
        if (!targetCompanyId) throw new Error('No workspace seleccionado');

        const settingsPayload = {
            token: data.token,
            phoneNumberId: data.phoneNumberId,
            wabaId: data.wabaId,
            phone: data.phone,
        };

        // Save WhatsApp integration
        const { data: existing } = await supabase
            .from('marketing_integrations')
            .select('id')
            .eq('company_id', targetCompanyId)
            .eq('provider', 'whatsapp')
            .maybeSingle();

        if (existing) {
            await supabase.from('marketing_integrations').update({ settings: settingsPayload, is_active: true }).eq('id', existing.id);
        } else {
            await supabase.from('marketing_integrations').insert({ company_id: targetCompanyId, provider: 'whatsapp', settings: settingsPayload, is_active: true });
        }

        // Also save workspace name if changed
        if (formData.name.trim() && formData.name !== editingWorkspace?.name) {
            await supabase.from('companies').update({ name: formData.name }).eq('id', targetCompanyId);
        }

        // Also save agent assignment if selected — this must persist even after WhatsApp connects
        if (formData.agentId) {
            await supabase.from('profiles').update({ company_id: targetCompanyId }).eq('id', formData.agentId);
        }

        // Update badge and reload
        setWaStatus(prev => ({ ...prev, [targetCompanyId]: 'active' }));
        toast.success(`✅ WhatsApp ${data.phone} conectado al workspace`);
        window.dispatchEvent(new CustomEvent('refresh-workspaces'));
        loadData();
    };

    const handleVerifyConnection = async () => {
        if (!formData.whatsapp_token || !formData.phone_number_id) {
            toast.error('Ingresa el Token y el Phone Number ID primero');
            return;
        }
        setVerifyStatus('loading');
        setVerifyDetails('');
        try {
            const res = await fetch(
                `https://graph.facebook.com/v19.0/${formData.phone_number_id}?fields=display_phone_number,verified_name,status,quality_rating&access_token=${formData.whatsapp_token}`
            );
            const data = await res.json();
            if (data.error) {
                setVerifyStatus('error');
                setVerifyDetails(`Error ${data.error.code}: ${data.error.message}`);
            } else {
                setVerifyStatus('ok');
                setVerifyDetails(`✅ ${data.display_phone_number} — ${data.verified_name} | Estado: ${data.status} | Calidad: ${data.quality_rating}`);
            }
        } catch (e: any) {
            setVerifyStatus('error');
            setVerifyDetails('No se pudo conectar con Meta. Verifica el token.');
        }
    };

    const fetchIntegrationDetails = async (workspace: Company) => {
        try {
            const { data: mktData } = await supabase
                .from('marketing_integrations')
                .select('*')
                .eq('company_id', workspace.id)
                .eq('provider', 'whatsapp')
                .maybeSingle();

            const settings = mktData?.settings || {};
            const currentAgent = agentsByWorkspace[workspace.id]?.find(a => (a as any).role !== 'company_admin' && (a as any).role !== 'super_admin');
            setFormData({
                name: workspace.name,
                waba_id: settings.wabaId || '',
                phone_number_id: settings.phoneNumberId || '',
                sender_phone_number: settings.phone || '',
                whatsapp_token: settings.token || '',
                allowed_permissions: workspace.allowed_permissions || [],
                agentId: currentAgent?.id || ''
            });
        } catch (err) {
            console.error('Error fetching workspace integration details:', err);
            setFormData({
                name: workspace.name,
                waba_id: '',
                phone_number_id: '',
                sender_phone_number: '',
                whatsapp_token: '',
                allowed_permissions: workspace.allowed_permissions || [],
                agentId: ''
            });
        }
    };

    const handleSaveWorkspace = async () => {
        if (!formData.name.trim()) {
            toast.error('El nombre del workspace es requerido');
            return;
        }
        if (!parentCompany) return;

        setIsSaving(true);
        try {
            let targetCompanyId = editingWorkspace?.id;

            if (editingWorkspace) {
                // Update company name & permissions
                const { error: updateError } = await supabase
                    .from('companies')
                    .update({
                        name: formData.name,
                        allowed_permissions: formData.allowed_permissions
                    })
                    .eq('id', editingWorkspace.id);

                if (updateError) throw updateError;
                // Assign agent to this workspace
                if (formData.agentId) {
                    await supabase.from('profiles').update({ company_id: editingWorkspace.id }).eq('id', formData.agentId);
                }
                toast.success('Workspace actualizado');
            } else {
                // Create child company inheriting billing and active status from parent
                const { data: newComp, error: insertError } = await supabase
                    .from('companies')
                    .insert({
                        name: formData.name,
                        parent_company_id: parentCompany.id,
                        allowed_permissions: formData.allowed_permissions,
                        license_status: parentCompany.license_status,
                        is_active: true,
                        max_users: parentCompany.max_users || 5,
                        trial_start_date: parentCompany.trial_start_date,
                        trial_end_date: parentCompany.trial_end_date
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;
                targetCompanyId = newComp.id;
                // Assign agent to this new workspace
                if (formData.agentId) {
                    await supabase.from('profiles').update({ company_id: targetCompanyId }).eq('id', formData.agentId);
                }
                toast.success('Workspace creado exitosamente');
            }

            // Sync/Upsert WhatsApp integration credentials to the child workspace
            if (targetCompanyId && (formData.waba_id || formData.phone_number_id || formData.whatsapp_token)) {
                // Upsert to marketing_integrations table for targetCompanyId
                const { data: existingInt } = await supabase
                    .from('marketing_integrations')
                    .select('id')
                    .eq('company_id', targetCompanyId)
                    .eq('provider', 'whatsapp')
                    .maybeSingle();

                const settingsPayload = {
                    wabaId: formData.waba_id.trim() || null,
                    phoneNumberId: formData.phone_number_id.trim() || null,
                    phone: formData.sender_phone_number.trim() || null,
                    token: formData.whatsapp_token.trim() || null
                };

                if (existingInt) {
                    await supabase
                        .from('marketing_integrations')
                        .update({
                            settings: settingsPayload,
                            is_active: true
                        })
                        .eq('id', existingInt.id);
                } else {
                    await supabase
                        .from('marketing_integrations')
                        .insert({
                            company_id: targetCompanyId,
                            provider: 'whatsapp',
                            settings: settingsPayload,
                            is_active: true
                        });
                }
            }

            setShowModal(false);
            // Notify sidebar to refresh
            window.dispatchEvent(new CustomEvent('refresh-workspaces'));
            loadData();
        } catch (err: any) {
            console.error('Error saving workspace:', err);
            toast.error(err.message || 'Error al guardar workspace');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTogglePermission = (permission: string) => {
        const current = [...formData.allowed_permissions];
        if (current.includes(permission)) {
            setFormData({
                ...formData,
                allowed_permissions: current.filter(p => p !== permission)
            });
        } else {
            setFormData({
                ...formData,
                allowed_permissions: [...current, permission]
            });
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Loader2 className="w-10 h-10 text-[#4449AA] animate-spin" />
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Cargando workspaces...</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1500px] mx-auto pb-6 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                        <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-extrabold text-[#4449AA] tracking-tight uppercase">
                            Workspaces <span className="text-gray-900 font-black">& Departamentos</span>
                        </h1>
                        <p className="text-[13px] text-gray-400 font-medium">
                            Crea y administra cuentas aisladas para cada departamento de tu empresa
                        </p>
                    </div>
                </div>
                {(profile?.role === 'company_admin' || profile?.role === 'super_admin') && (
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 px-6 py-3 bg-[#4449AA] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200 hover:translate-y-[-1px] active:scale-95 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo Workspace
                    </button>
                )}
            </header>

            {/* Warning note */}
            <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 flex gap-3 items-start max-w-4xl">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                    <h4 className="text-xs font-black text-amber-800 uppercase tracking-wider">Monitoreo y Control</h4>
                    <p className="text-[11px] text-amber-700/80 font-medium mt-1">
                        Como administrador principal, puedes ver todos los departamentos/workspaces de tu organización.
                        Puedes cambiar de contexto de forma dinámica y configurar números de WhatsApp independientes por cada departamento,
                        mientras que tu equipo solo tendrá acceso al departamento al que sea asignado.
                    </p>
                </div>
            </div>

            {/* Grid layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workspaces.map(w => {
                    const isCurrent = w.id === profile?.company_id;
                    const isParent = !w.parent_company_id;
                    const waSt = waStatus[w.id];

                    return (
                        <div
                            key={w.id}
                            className={`bg-white rounded-[2rem] border p-6 flex flex-col justify-between transition-all group relative overflow-hidden ${
                                isCurrent
                                    ? 'border-[#4449AA] shadow-lg shadow-[#4449AA]/5 ring-2 ring-[#4449AA]/10'
                                    : 'border-gray-100 hover:border-gray-200 shadow-sm'
                            }`}
                        >
                            {/* Accent tag */}
                            {isCurrent && (
                                <div className="absolute top-0 right-0 bg-[#4449AA] text-white px-3 py-1 rounded-bl-xl text-[8px] font-black uppercase tracking-widest">
                                    Activo
                                </div>
                            )}

                            <div>
                                <div className="flex items-center gap-3.5 mb-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-sm ${
                                        isParent ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-[#4449AA]'
                                    }`}>
                                        {isParent ? '👑' : '🏢'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight truncate">
                                            {w.name}
                                        </h3>
                                        <span className={`inline-block text-[8px] font-black uppercase tracking-wider mt-0.5 px-2 py-0.5 rounded-full ${
                                            isParent ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400'
                                        }`}>
                                            {isParent ? 'Workspace Principal' : 'Departamento / Sede'}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2.5 text-[11px] text-gray-500 font-bold border-t border-gray-50 pt-4 mb-4">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Estado de Licencia:</span>
                                        <span className="text-emerald-600 uppercase tracking-wider text-[10px]">{w.license_status}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Fecha de Creación:</span>
                                        <span>{new Date(w.created_at).toLocaleDateString()}</span>
                                    </div>
                                    {/* WhatsApp Status Badge */}
                                    <div className="flex justify-between items-center pt-1">
                                        <span className="text-gray-400">WhatsApp:</span>
                                        {waSt === 'active' ? (
                                            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-black rounded-full border border-emerald-200">
                                                <Wifi className="w-2.5 h-2.5" /> Conectado
                                            </span>
                                        ) : waSt === 'inactive' ? (
                                            <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-400 text-[9px] font-black rounded-full border border-gray-200">
                                                <WifiOff className="w-2.5 h-2.5" /> Sin configurar
                                            </span>
                                        ) : (
                                            <span className="w-12 h-4 bg-gray-100 rounded-full animate-pulse" />
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleSwitchWorkspace(w.id, w.name)}
                                    disabled={isCurrent}
                                    className={`flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${
                                        isCurrent
                                            ? 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100'
                                            : 'bg-[#4449AA] hover:bg-[#4449AA]/95 text-white hover:translate-y-[-1px] shadow-md shadow-indigo-100'
                                    }`}
                                >
                                    <ArrowLeftRight className="w-3.5 h-3.5" />
                                    {isCurrent ? 'Actual' : 'Cambiar'}
                                </button>

                                <button
                                    onClick={() => openEditModal(w)}
                                    className="p-2.5 rounded-xl border border-gray-100 text-gray-400 hover:text-[#4449AA] hover:bg-indigo-50/50 transition-all"
                                    title="Configurar Integraciones y Permisos"
                                >
                                    <Settings className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Create/Edit Modal */}
            {showModal && createPortal(
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-lg font-black text-[#4449AA] uppercase tracking-tight">
                                    {editingWorkspace ? 'Configurar Workspace' : 'Nuevo Workspace'}
                                </h2>
                                <p className="text-[11px] text-gray-400 font-medium">
                                    Define los accesos y credenciales de comunicación para este canal
                                </p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                <X className="w-5 h-5 text-gray-300" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-6">
                            {/* General details */}
                            <div className="space-y-4">
                                <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-2">
                                    Datos Generales
                                </h3>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre del Workspace*</label>
                                    <input
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Ej: Departamento de Ventas, Soporte CDMX..."
                                        className="w-full h-12 px-4 rounded-xl bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-[#4449AA]/30 outline-none font-bold text-sm transition-all"
                                    />
                                </div>

                                {/* Agent Picker */}
                                {agents.length > 0 && (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">👤 Agente Responsable</label>
                                        <CustomSelect
                                            value={formData.agentId}
                                            onChange={val => setFormData({ ...formData, agentId: val })}
                                            placeholder="— Sin asignar —"
                                            options={[
                                                { value: '', label: '— Sin asignar —' },
                                                ...agents.map(a => ({ value: a.id, label: a.full_name || a.email || '', icon: '👤' }))
                                            ]}
                                        />
                                        <p className="text-[9px] text-gray-400 font-medium pl-1">El agente seleccionado será movido a este workspace automáticamente.</p>
                                    </div>
                                )}
                            </div>

                            {/* WhatsApp API Configuration */}
                            <div className="space-y-4 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                                            <Key className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h3 className="text-xs font-black text-gray-900 uppercase tracking-tight">WhatsApp de este Workspace</h3>
                                            <p className="text-[10px] text-gray-400 font-medium">Conecta un número de WhatsApp dedicado a este departamento</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowWizard(prev => prev === 'embedded' ? 'manual' : 'embedded')}
                                        className="text-[9px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest transition-colors"
                                    >
                                        {showWizard ? 'Modo avanzado' : 'Modo simple'}
                                    </button>
                                </div>

                                {showWizard === 'embedded' ? (
                                    // PREMIUM: Embedded Signup (one-click Meta popup)
                                    <WhatsAppEmbeddedConnect
                                        companyId={editingWorkspace?.id || ''}
                                        onSuccess={async (data) => {
                                            if (editingWorkspace?.id) {
                                                await handleWizardSave({ token: data.token, phoneNumberId: data.phoneNumberId, wabaId: data.wabaId, phone: data.phone });
                                            }
                                        }}
                                        onSwitchManual={() => setShowWizard('manual')}
                                    />
                                ) : showWizard === 'manual' ? (
                                    // FALLBACK: Manual Token Wizard
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setShowWizard('embedded')}
                                            className="flex items-center gap-1.5 text-[9px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest transition-colors mb-3"
                                        >
                                            ← Volver a Conexión Rápida
                                        </button>
                                        <WhatsAppConnectWizard
                                            onSave={handleWizardSave}
                                            onCancel={() => { setShowWizard('embedded'); }}
                                            initialToken={formData.whatsapp_token}
                                        />
                                    </>
                                ) : null}
                            </div>
                            {/* Configuración Avanzada: Módulos */}
                            {parentPermissions.length > 0 && (
                                <div className="space-y-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowAdvanced(!showAdvanced)}
                                        className="flex items-center gap-2 w-full text-left py-2 border-t border-gray-50"
                                    >
                                        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors">
                                            Configuración Avanzada — Módulos habilitados
                                        </span>
                                    </button>
                                    {showAdvanced && (
                                        <div className="space-y-3 animate-in fade-in duration-200">
                                            <p className="text-[10px] text-gray-400 font-medium">
                                                Elige los módulos de tu plan principal que deseas activar para este workspace.
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {parentPermissions.map(perm => (
                                                    <button
                                                        key={perm}
                                                        onClick={() => handleTogglePermission(perm)}
                                                        className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                                                            formData.allowed_permissions.includes(perm)
                                                                ? 'border-[#4449AA] bg-indigo-50/20 text-indigo-950 font-black shadow-sm'
                                                                : 'border-gray-100 hover:border-gray-200 text-gray-400 font-medium'
                                                        }`}
                                                    >
                                                        <span className="text-xs uppercase tracking-wider">{perm}</span>
                                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                                            formData.allowed_permissions.includes(perm)
                                                                ? 'border-[#4449AA] bg-[#4449AA] text-white'
                                                                : 'border-gray-200 bg-white'
                                                        }`}>
                                                            {formData.allowed_permissions.includes(perm) && <Check className="w-3 h-3 stroke-[3]" />}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex gap-4 shrink-0 rounded-b-[2.5rem]">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 h-12 rounded-xl font-black text-[11px] text-gray-400 hover:text-gray-700 uppercase tracking-widest transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveWorkspace}
                                disabled={isSaving}
                                className="flex-[2] h-12 rounded-xl bg-[#4449AA] text-white font-black text-[11px] uppercase tracking-widest shadow-lg shadow-indigo-200 hover:translate-y-[-1px] active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isSaving ? 'Guardando...' : (editingWorkspace ? 'Guardar Cambios' : 'Crear Workspace')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
