import React from 'react';
import { ShieldCheck, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { WA_ACCESS_MODE_OPTIONS, type WaAccessMode } from '../../../../lib/whatsappScopes';
import type { CircleFilter, TeamWaAccessMember } from '../types';
import { initials } from '../helpers';

export interface TeamWaAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminPreviewMode: WaAccessMode | null;
  onChangeAdminPreviewMode: (mode: WaAccessMode | null, nextFilter: CircleFilter) => void;
  loadingTeamAccess: boolean;
  teamAccessList: TeamWaAccessMember[];
  savingUserAccessId: string | null;
  onChangeUserWaAccess: (targetUserId: string, nextMode: WaAccessMode) => void;
}

export const TeamWaAccessModal: React.FC<TeamWaAccessModalProps> = ({
  isOpen,
  onClose,
  adminPreviewMode,
  onChangeAdminPreviewMode,
  loadingTeamAccess,
  teamAccessList,
  savingUserAccessId,
  onChangeUserWaAccess,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-black text-slate-900">
                Control de Accesos WhatsApp por Área (Admin · Técnicos · Ventas)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Define en 1 clic qué bandeja, chats y alertas puede ver cada miembro de tu equipo (protegido también por base de datos RLS).
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Visual Guide of the 3 Core Profiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs">
          <div className="bg-white p-2.5 rounded-xl border border-indigo-100 space-y-1">
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800">
              Administradores
            </span>
            <p className="text-[11px] text-slate-600 leading-snug">
              Ven <strong>Todo</strong>: Soporte, Leads nuevos, todos los Leads de todos los vendedores, Equipo, Spam e IA.
            </p>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-sky-100 space-y-1">
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-sky-800">
              Técnicos (Soporte)
            </span>
            <p className="text-[11px] text-slate-600 leading-snug">
              Solo ven <strong>Soporte</strong> (grupos y clientes). <strong>0% acceso a Ventas/Leads</strong>; su campana solo suena por Soporte.
            </p>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-emerald-100 space-y-1">
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
              Vendedores (Ventas)
            </span>
            <p className="text-[11px] text-slate-600 leading-snug">
              Solo ven <strong>Leads nuevos · por tomar</strong> y <strong>Mis leads</strong>. No ven los leads de otro vendedor ni Soporte.
            </p>
          </div>
        </div>

        {/* 1-Click Preview Mode for Admin */}
        <div className="flex items-center justify-between gap-2 flex-wrap bg-[#EEF0FF]/70 px-3.5 py-2.5 rounded-2xl border border-indigo-200/70">
          <div className="text-xs">
            <span className="font-black text-indigo-950">Simulador rápido de vista:</span>{' '}
            <span className="text-indigo-800 font-medium">Comprueba cómo ve la pantalla cada perfil sin cerrar sesión.</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { mode: null, label: 'Vista Admin (Todo)', nextFilter: 'all' as CircleFilter },
                { mode: 'soporte_team' as WaAccessMode, label: 'Probar como Técnico', nextFilter: 'soporte' as CircleFilter },
                { mode: 'ventas_pool' as WaAccessMode, label: 'Probar como Vendedor', nextFilter: 'por_clasificar' as CircleFilter },
              ]
            ).map((p) => {
              const active = adminPreviewMode === p.mode;
              return (
                <button
                  key={String(p.mode)}
                  type="button"
                  onClick={() => {
                    onChangeAdminPreviewMode(p.mode, p.nextFilter);
                    toast.success(`Vista cambiada a: ${p.label}`);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition ${
                    active ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-indigo-800 border border-indigo-200 hover:bg-indigo-50'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Team Member Access Table */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl">
          {loadingTeamAccess ? (
            <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Cargando miembros del equipo...</span>
            </div>
          ) : teamAccessList.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No se encontraron usuarios activos en la empresa.</div>
          ) : (
            teamAccessList.map((member) => {
              const currentOpt =
                WA_ACCESS_MODE_OPTIONS.find((o) => o.mode === member.access_mode) || WA_ACCESS_MODE_OPTIONS[0];
              const isSaving = savingUserAccessId === member.id;
              return (
                <div key={member.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/70 font-bold text-xs flex items-center justify-center shrink-0">
                      {initials(member.full_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-black text-slate-900 truncate">{member.full_name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${currentOpt.badgeColor}`}>
                          {currentOpt.shortLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {member.email} · Rol base: <span className="font-semibold text-slate-700">{member.role_label}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />}
                    {member.is_system_admin ? (
                      <span className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-black">
                        Administrador del Sistema (Ve Todo)
                      </span>
                    ) : (
                      <select
                        disabled={isSaving}
                        value={member.access_mode}
                        onChange={(e) => onChangeUserWaAccess(member.id, e.target.value as WaAccessMode)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-800 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer disabled:opacity-50"
                      >
                        {WA_ACCESS_MODE_OPTIONS.map((opt) => (
                          <option key={opt.mode} value={opt.mode}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
          <span>Los cambios se aplican en tiempo real sin necesidad de que el usuario cierre sesión.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
