const fs = require('fs');
let src = fs.readFileSync('src/pages/marketing/FollowupSettings.tsx', 'utf8');
const lines = src.split('\n');

// Replace lines 492-674 (0-indexed: 491-673) with new hub UI
// Also need to update state and helper in the component (around line 220-240)

const NEW_HUB = `                    {/* ── NOTIFICATION HUB ── */}
                    <div className="bg-white rounded-[24px] border border-gray-100 shadow-xl overflow-hidden">
                        {/* Header */}
                        <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-2xl bg-violet-100 flex items-center justify-center">
                                    <Radio className="w-4 h-4 text-violet-600" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                                        Hub de Alertas
                                        <span className="text-[9px] font-bold text-violet-600 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">Multi-Canal</span>
                                    </h2>
                                    <p className="text-[10px] text-slate-400">Activa canales simultáneos — cada uno entrega alertas en paralelo</p>
                                </div>
                            </div>
                            {/* Tab Navigator */}
                            <div className="flex gap-0 mt-4 border-b border-slate-100">
                                {([
                                    { id: 'telegram', label: 'Telegram',  color: '#229ED9', activeChannels: [settings.escalation_ch_agent_tg, settings.escalation_ch_group_tg] },
                                    { id: 'whatsapp', label: 'WhatsApp',  color: '#25D366', activeChannels: [settings.escalation_ch_whatsapp] },
                                    { id: 'slack',    label: 'Slack',     color: '#611f69', activeChannels: [settings.escalation_ch_slack] },
                                    { id: 'sla',      label: 'SLA & DND', color: '#6366f1', activeChannels: [] },
                                ] as const).map(tab => {
                                    const isActive = hubTab === tab.id;
                                    const hasActive = tab.activeChannels.some(Boolean);
                                    return (
                                        <button key={tab.id} type="button" onClick={() => setHubTab(tab.id as any)}
                                            className="relative px-4 py-2.5 text-[11px] font-black transition-colors focus:outline-none flex items-center gap-1.5"
                                            style={{ color: isActive ? tab.color : '#94a3b8' }}>
                                            {hasActive && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tab.color }} />}
                                            {tab.label}
                                            {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ backgroundColor: tab.color }} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="p-5">

                            {/* ── TELEGRAM TAB ── */}
                            {hubTab === 'telegram' && (
                                <div className="space-y-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Canales Activos</p>

                                    {/* Agente Directo */}
                                    <div className={\`rounded-2xl border transition-all \${settings.escalation_ch_agent_tg ? 'border-[#229ED9]/25 bg-[#229ED9]/5' : 'border-slate-100'}\`}>
                                        <div className="flex items-center gap-3 p-3.5">
                                            <div className={\`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 \${settings.escalation_ch_agent_tg ? 'bg-[#229ED9]' : 'bg-slate-100'}\`}>
                                                <Smartphone className="w-4 h-4 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <p className={\`text-xs font-black \${settings.escalation_ch_agent_tg ? 'text-[#229ED9]' : 'text-slate-500'}\`}>Telegram — Agente Directo</p>
                                                <p className="text-[9px] text-slate-400">Notifica al Telegram personal del agente asignado al lead</p>
                                            </div>
                                            {settings.escalation_ch_agent_tg && <span className="text-[9px] font-black text-[#229ED9] bg-[#229ED9]/10 px-2 py-0.5 rounded-full">ACTIVO</span>}
                                            <button type="button" onClick={() => update('escalation_ch_agent_tg', !settings.escalation_ch_agent_tg)} className="shrink-0 focus:outline-none">
                                                {settings.escalation_ch_agent_tg ? <ToggleRight className="w-7 h-7 text-[#229ED9]" /> : <ToggleLeft className="w-7 h-7 text-slate-300" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Grupo Central */}
                                    <div className={\`rounded-2xl border transition-all \${settings.escalation_ch_group_tg ? 'border-[#229ED9]/25 bg-[#229ED9]/5' : 'border-slate-100'}\`}>
                                        <div className="flex items-center gap-3 p-3.5">
                                            <div className={\`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 \${settings.escalation_ch_group_tg ? 'bg-[#229ED9]' : 'bg-slate-100'}\`}>
                                                <Send className="w-4 h-4 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <p className={\`text-xs font-black \${settings.escalation_ch_group_tg ? 'text-[#229ED9]' : 'text-slate-500'}\`}>Telegram — Grupo Central</p>
                                                <p className="text-[9px] text-slate-400">Un grupo general para todas las alertas del equipo</p>
                                            </div>
                                            {settings.escalation_ch_group_tg && <span className="text-[9px] font-black text-[#229ED9] bg-[#229ED9]/10 px-2 py-0.5 rounded-full">ACTIVO</span>}
                                            <button type="button" onClick={() => update('escalation_ch_group_tg', !settings.escalation_ch_group_tg)} className="shrink-0 focus:outline-none">
                                                {settings.escalation_ch_group_tg ? <ToggleRight className="w-7 h-7 text-[#229ED9]" /> : <ToggleLeft className="w-7 h-7 text-slate-300" />}
                                            </button>
                                        </div>
                                        {settings.escalation_ch_group_tg && (
                                            <div className="px-3.5 pb-3.5">
                                                <input type="text" placeholder="Chat ID del grupo  Ej: -100123456789"
                                                    value={settings.escalation_telegram_chat_id || ''}
                                                    onChange={e => update('escalation_telegram_chat_id', e.target.value || null)}
                                                    className="w-full p-2.5 bg-white border border-[#229ED9]/20 rounded-xl text-xs font-semibold text-slate-600 outline-none placeholder:text-slate-300 focus:ring-2 focus:ring-[#229ED9]/15" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Department Routing — Telegram */}
                                    <div className="border-t border-slate-50 pt-4 space-y-3">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grupos por Departamento</p>
                                            <p className="text-[9px] text-slate-400 mt-0.5">Cada departamento recibe alertas en su propio grupo de Telegram</p>
                                        </div>
                                        {([
                                            { key: 'sales',      emoji: '💼', label: 'Ventas' },
                                            { key: 'accounting', emoji: '📊', label: 'Contabilidad' },
                                            { key: 'support',    emoji: '🛠', label: 'Soporte Técnico' },
                                        ] as const).map(dept => (
                                            <div key={dept.key} className="flex items-center gap-3">
                                                <span className="text-[11px] font-black text-slate-600 w-28 shrink-0">{dept.emoji} {dept.label}</span>
                                                <input type="text" placeholder="Chat ID del grupo (opcional)"
                                                    value={settings.dept_routing?.[dept.key]?.telegram || ''}
                                                    onChange={e => updateDeptRoute(dept.key, 'telegram', e.target.value)}
                                                    className="flex-1 p-2 bg-slate-50 border-none rounded-xl text-xs font-semibold text-slate-600 outline-none placeholder:text-slate-300 focus:ring-2 focus:ring-[#229ED9]/15 focus:bg-white transition-colors" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── WHATSAPP TAB ── */}
                            {hubTab === 'whatsapp' && (
                                <div className="space-y-4">
                                    {/* WhatsApp Channel */}
                                    <div className={\`rounded-2xl border transition-all \${settings.escalation_ch_whatsapp ? 'border-[#25D366]/25 bg-[#25D366]/5' : 'border-slate-100'}\`}>
                                        <div className="flex items-center gap-3 p-3.5">
                                            <div className={\`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-black text-sm \${settings.escalation_ch_whatsapp ? 'bg-[#25D366]' : 'bg-slate-100'}\`}>W</div>
                                            <div className="flex-1">
                                                <p className={\`text-xs font-black \${settings.escalation_ch_whatsapp ? 'text-[#25D366]' : 'text-slate-500'}\`}>WhatsApp Business API</p>
                                                <p className="text-[9px] text-slate-400">Meta Cloud API — alertas a números individuales o por departamento</p>
                                            </div>
                                            {settings.escalation_ch_whatsapp && <span className="text-[9px] font-black text-[#25D366] bg-[#25D366]/10 px-2 py-0.5 rounded-full">ACTIVO</span>}
                                            <button type="button" onClick={() => update('escalation_ch_whatsapp', !settings.escalation_ch_whatsapp)} className="shrink-0 focus:outline-none">
                                                {settings.escalation_ch_whatsapp ? <ToggleRight className="w-7 h-7 text-[#25D366]" /> : <ToggleLeft className="w-7 h-7 text-slate-300" />}
                                            </button>
                                        </div>
                                        {settings.escalation_ch_whatsapp && (
                                            <div className="px-3.5 pb-3.5 space-y-2">
                                                <input type="tel" placeholder="Número Principal  Ej: +15551234567"
                                                    value={settings.escalation_whatsapp_number || ''}
                                                    onChange={e => update('escalation_whatsapp_number', e.target.value || null)}
                                                    className="w-full p-2.5 bg-white border border-[#25D366]/20 rounded-xl text-xs font-semibold text-slate-600 outline-none placeholder:text-slate-300" />
                                                <input type="text" placeholder="API Token (Meta Cloud / 360dialog)"
                                                    value={settings.escalation_whatsapp_token || ''}
                                                    onChange={e => update('escalation_whatsapp_token', e.target.value || null)}
                                                    className="w-full p-2.5 bg-white border border-[#25D366]/20 rounded-xl text-xs font-semibold text-slate-600 outline-none placeholder:text-slate-300" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Info box */}
                                    <div className="flex gap-2 bg-amber-50 border border-amber-100 rounded-2xl p-3">
                                        <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-[9px] text-amber-700 leading-relaxed">WhatsApp no soporta grupos como Telegram. Usa <strong>números destino diferentes</strong> para enrutar por departamento — cada número puede ser un agente o un número de grupo de WhatsApp Business.</p>
                                    </div>

                                    {/* Department Routing — WhatsApp */}
                                    <div className="border-t border-slate-50 pt-4 space-y-3">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Números por Departamento</p>
                                            <p className="text-[9px] text-slate-400 mt-0.5">Cada departamento recibe alertas en su número de WhatsApp</p>
                                        </div>
                                        {([
                                            { key: 'sales',      emoji: '💼', label: 'Ventas' },
                                            { key: 'accounting', emoji: '📊', label: 'Contabilidad' },
                                            { key: 'support',    emoji: '🛠', label: 'Soporte Técnico' },
                                        ] as const).map(dept => (
                                            <div key={dept.key} className="flex items-center gap-3">
                                                <span className="text-[11px] font-black text-slate-600 w-28 shrink-0">{dept.emoji} {dept.label}</span>
                                                <input type="tel" placeholder="+503 xxxx xxxx (opcional)"
                                                    value={settings.dept_routing?.[dept.key]?.whatsapp || ''}
                                                    onChange={e => updateDeptRoute(dept.key, 'whatsapp', e.target.value)}
                                                    className="flex-1 p-2 bg-slate-50 border-none rounded-xl text-xs font-semibold text-slate-600 outline-none placeholder:text-slate-300 focus:ring-2 focus:ring-[#25D366]/15 focus:bg-white transition-colors" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── SLACK TAB ── */}
                            {hubTab === 'slack' && (
                                <div className="space-y-4">
                                    <div className={\`rounded-2xl border transition-all \${settings.escalation_ch_slack ? 'border-purple-200 bg-purple-50/30' : 'border-slate-100'}\`}>
                                        <div className="flex items-center gap-3 p-3.5">
                                            <div className={\`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 \${settings.escalation_ch_slack ? 'bg-purple-600' : 'bg-slate-100'}\`}>
                                                <Bell className="w-4 h-4 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <p className={\`text-xs font-black \${settings.escalation_ch_slack ? 'text-purple-700' : 'text-slate-500'}\`}>Slack / Microsoft Teams</p>
                                                <p className="text-[9px] text-slate-400">Webhooks entrantes — un canal general o por departamento</p>
                                            </div>
                                            {settings.escalation_ch_slack && <span className="text-[9px] font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">ACTIVO</span>}
                                            <button type="button" onClick={() => update('escalation_ch_slack', !settings.escalation_ch_slack)} className="shrink-0 focus:outline-none">
                                                {settings.escalation_ch_slack ? <ToggleRight className="w-7 h-7 text-purple-600" /> : <ToggleLeft className="w-7 h-7 text-slate-300" />}
                                            </button>
                                        </div>
                                        {settings.escalation_ch_slack && (
                                            <div className="px-3.5 pb-3.5">
                                                <input type="url" placeholder="Webhook General  https://hooks.slack.com/services/..."
                                                    value={settings.escalation_webhook_url || ''}
                                                    onChange={e => update('escalation_webhook_url', e.target.value || null)}
                                                    className="w-full p-2.5 bg-white border border-purple-100 rounded-xl text-xs font-semibold text-slate-600 outline-none placeholder:text-slate-300" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Department Routing — Slack */}
                                    <div className="border-t border-slate-50 pt-4 space-y-3">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Webhooks por Departamento</p>
                                            <p className="text-[9px] text-slate-400 mt-0.5">Cada departamento puede tener su propio canal de Slack o Teams</p>
                                        </div>
                                        {([
                                            { key: 'sales',      emoji: '💼', label: 'Ventas' },
                                            { key: 'accounting', emoji: '📊', label: 'Contabilidad' },
                                            { key: 'support',    emoji: '🛠', label: 'Soporte Técnico' },
                                        ] as const).map(dept => (
                                            <div key={dept.key} className="flex items-center gap-3">
                                                <span className="text-[11px] font-black text-slate-600 w-28 shrink-0">{dept.emoji} {dept.label}</span>
                                                <input type="url" placeholder="Webhook URL (opcional)"
                                                    value={settings.dept_routing?.[dept.key]?.slack || ''}
                                                    onChange={e => updateDeptRoute(dept.key, 'slack', e.target.value)}
                                                    className="flex-1 p-2 bg-slate-50 border-none rounded-xl text-xs font-semibold text-slate-600 outline-none placeholder:text-slate-300 focus:ring-2 focus:ring-purple-200/40 focus:bg-white transition-colors" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── SLA & DND TAB ── */}
                            {hubTab === 'sla' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Timer className="w-3 h-3" /> SLA de Respuesta</label>
                                            <select value={settings.escalation_sla_minutes} onChange={e => update('escalation_sla_minutes', parseInt(e.target.value))}
                                                className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-bold text-slate-700 outline-none border-none">
                                                <option value="15">⚡ 15 min — Urgente</option>
                                                <option value="30">✅ 30 min — Normal</option>
                                                <option value="60">🕐 1 hora</option>
                                                <option value="120">🕑 2 horas</option>
                                                <option value="240">🕓 4 horas</option>
                                                <option value="1440">📅 24 horas</option>
                                            </select>
                                            <p className="text-[9px] text-slate-400">Si el agente no atiende el lead dentro de este plazo, se dispara la alerta.</p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><UserCheck className="w-3 h-3 text-rose-400" /> Agente Fallback</label>
                                            <select value={settings.escalation_backup_agent_id || ''} onChange={e => update('escalation_backup_agent_id', e.target.value || null)}
                                                className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-bold text-slate-700 outline-none border-none">
                                                <option value="">— Ninguno —</option>
                                                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                            </select>
                                            <p className="text-[9px] text-slate-400">Recibirá la alerta secundaria si el primer agente no responde.</p>
                                        </div>
                                    </div>
                                    <div className="border-t border-slate-50 pt-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Moon className="w-3.5 h-3.5 text-slate-400" /> Horario No Molestar (DND)</p>
                                                <p className="text-[9px] text-slate-400">Las alertas se pausan fuera del horario laboral</p>
                                            </div>
                                            <button type="button" onClick={() => update('escalation_dnd_enabled', !settings.escalation_dnd_enabled)} className="shrink-0 focus:outline-none">
                                                {settings.escalation_dnd_enabled ? <ToggleRight className="w-7 h-7 text-indigo-500" /> : <ToggleLeft className="w-7 h-7 text-slate-300" />}
                                            </button>
                                        </div>
                                        {settings.escalation_dnd_enabled && (
                                            <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-2xl p-3">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-center">Inicio (Silenciar)</label>
                                                    <input type="time" value={settings.escalation_dnd_start} onChange={e => update('escalation_dnd_start', e.target.value)}
                                                        className="w-full p-2 bg-white border border-slate-100 rounded-xl text-xs font-bold text-center text-slate-600 outline-none" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-center">Fin (Reactivar)</label>
                                                    <input type="time" value={settings.escalation_dnd_end} onChange={e => update('escalation_dnd_end', e.target.value)}
                                                        className="w-full p-2 bg-white border border-slate-100 rounded-xl text-xs font-bold text-center text-slate-600 outline-none" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>`;

// Replace lines 492-674 (0-indexed 491-673)
const newLines = [...lines.slice(0, 491), NEW_HUB, ...lines.slice(674)];
fs.writeFileSync('src/pages/marketing/FollowupSettings.tsx', newLines.join('\n'), 'utf8');
console.log('✅ Hub replaced. New total lines:', newLines.length);
