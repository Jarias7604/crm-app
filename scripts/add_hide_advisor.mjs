import { readFileSync, writeFileSync } from 'fs';

let c = readFileSync('src/pages/company/TeamPerformance.tsx', 'utf8');

// ── 1. Add hiddenAdvisorIds state + toggle after followUpStats state ──────────
const stateAnchor = '    const [followUpStats, setFollowUpStats] = useState<{\r\n        scheduled: number;\r\n        completed: number;\r\n        overdue: number;\r\n    }>({ scheduled: 0, completed: 0, overdue: 0 });';

const stateReplacement = stateAnchor + `\r\n\r\n    // Asesores ocultos: persiste en localStorage para no perder la configuracion\r\n    const hiddenKey = companyId ? \`crm_hidden_advisors_\${companyId}\` : 'crm_hidden_advisors';\r\n    const [hiddenAdvisorIds, setHiddenAdvisorIds] = useState<Set<string>>(() => {\r\n        try { return new Set(JSON.parse(localStorage.getItem(hiddenKey) || '[]')); }\r\n        catch { return new Set(); }\r\n    });\r\n    const toggleHideAdvisor = (userId: string) => {\r\n        setHiddenAdvisorIds(prev => {\r\n            const next = new Set(prev);\r\n            if (next.has(userId)) { next.delete(userId); } else { next.add(userId); }\r\n            try { localStorage.setItem(hiddenKey, JSON.stringify([...next])); } catch {}\r\n            return next;\r\n        });\r\n    };\r\n    const restoreAllAdvisors = () => {\r\n        setHiddenAdvisorIds(new Set());\r\n        try { localStorage.removeItem(hiddenKey); } catch {}\r\n    };`;

if (!c.includes(stateAnchor)) { console.error('State anchor not found!'); process.exit(1); }
c = c.replace(stateAnchor, stateReplacement);
console.log('✅ Step 1: hiddenAdvisorIds state added');

// ── 2. Filter reportData after sort ──────────────────────────────────────────
const sortLine = '    }).sort((a, b) => b.percent - a.percent);\r\n\r\n    const totalLostLeadsEst';
const sortReplacement = '    }).sort((a, b) => b.percent - a.percent);\r\n\r\n    // Asesores visibles: excluye los ocultos del reporte visual y de los totales\r\n    const visibleReportData = reportData.filter(r => !hiddenAdvisorIds.has(r.userId));\r\n    const hiddenCount = hiddenAdvisorIds.size;\r\n\r\n    const totalLostLeadsEst';

if (!c.includes(sortLine)) { console.error('Sort line not found!'); process.exit(1); }
c = c.replace(sortLine, sortReplacement);
console.log('✅ Step 2: visibleReportData filter added');

// ── 3. Add "N ocultos" badge + restore button in header ───────────────────────
const matasBtn = `                    {isAdmin && (\r\n                        <button\r\n                            onClick={openGoalPanel}\r\n                            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:border-teal-300 hover:text-teal-600 transition-all"\r\n                        >\r\n                            <Settings className="w-3 h-3" />\r\n                            Metas\r\n                        </button>\r\n                    )}`;

const matasBtnReplacement = `                    {hiddenCount > 0 && (\r\n                        <button\r\n                            onClick={restoreAllAdvisors}\r\n                            className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-amber-100 transition-all"\r\n                            title="Mostrar todos los asesores ocultos"\r\n                        >\r\n                            <span className="w-4 h-4 bg-amber-400 text-white rounded-full text-[9px] flex items-center justify-center font-black">{hiddenCount}</span>\r\n                            Ocultos\r\n                        </button>\r\n                    )}\r\n                    {isAdmin && (\r\n                        <button\r\n                            onClick={openGoalPanel}\r\n                            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:border-teal-300 hover:text-teal-600 transition-all"\r\n                        >\r\n                            <Settings className="w-3 h-3" />\r\n                            Metas\r\n                        </button>\r\n                    )}`;

if (!c.includes(matasBtn)) { console.error('Metas button not found!'); process.exit(1); }
c = c.replace(matasBtn, matasBtnReplacement);
console.log('✅ Step 3: hidden count badge added');

// ── 4. Change reportData.map to visibleReportData.map in table ────────────────
const tableMap = '                {reportData.map((row) => {';
const tableMapReplacement = '                {visibleReportData.map((row) => {';
if (!c.includes(tableMap)) { console.error('Table map not found!'); process.exit(1); }
c = c.replace(tableMap, tableMapReplacement);
console.log('✅ Step 4: table uses visibleReportData');

// ── 5. Add eye-off hide button in VER column ──────────────────────────────────
// Find the printer button and add hide button before it
const printerBtn = `                                        <button onClick={(e) => { e.stopPropagation(); handlePrintUserReport(row.userId); }} className="w-6 h-6 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-400 no-print" title="Imprimir reporte">\r\n                                            <Printer className="w-3 h-3" />\r\n                                        </button>`;

const printerBtnReplacement = `                                        <button\r\n                                            onClick={(e) => { e.stopPropagation(); toggleHideAdvisor(row.userId); }}\r\n                                            className="w-6 h-6 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-rose-50 hover:border-rose-200 transition-colors text-slate-400 hover:text-rose-400 no-print"\r\n                                            title="Ocultar este asesor del reporte"\r\n                                        >\r\n                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>\r\n                                        </button>\r\n                                        <button onClick={(e) => { e.stopPropagation(); handlePrintUserReport(row.userId); }} className="w-6 h-6 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-400 no-print" title="Imprimir reporte">\r\n                                            <Printer className="w-3 h-3" />\r\n                                        </button>`;

if (!c.includes(printerBtn)) { console.error('Printer button not found!'); process.exit(1); }
c = c.replace(printerBtn, printerBtnReplacement);
console.log('✅ Step 5: hide button added in VER column');

writeFileSync('src/pages/company/TeamPerformance.tsx', c, 'utf8');
console.log('\n🎉 All done! File updated successfully. Length:', c.length);
