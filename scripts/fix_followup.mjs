import { readFileSync, writeFileSync } from 'fs';

const c = readFileSync('src/pages/company/TeamPerformance.tsx', 'utf8');

const anchor = 'const [followUpStats, setFollowUpStats]';
const anchorIdx = c.indexOf(anchor);
const useEffStart = c.indexOf('    useEffect(() => {', anchorIdx);
const endMarker = '    }, [companyId, filters.period, filters.date_from, filters.date_to, userPerformance.length]);\r\n';
const useEffEnd = c.indexOf(endMarker, useEffStart) + endMarker.length;

console.log('useEffStart:', useEffStart, 'useEffEnd:', useEffEnd);

const newBlock = `    useEffect(() => {
        if (!companyId) return;
        const fetchFollowUpStats = async () => {
            try {
                // 1. Timezone de la empresa (SaaS: El Salvador, NY, California, etc.)
                const { data: co } = await supabase
                    .from('companies').select('timezone').eq('id', companyId).single();
                const tz = (co as any)?.timezone || DEFAULT_TIMEZONE;

                // 2. Hoy en TZ empresa
                const now = new Date();
                const todayInTZ = now.toLocaleDateString('en-CA', { timeZone: tz });

                // 3. Convierte fecha local YYYY-MM-DD a UTC ISO correcto para el TZ
                // Mide el offset comparando noon UTC vs noon en TZ empresa
                const localToUTC = (dateStr: string, endOfDay = false): string => {
                    const sampleUTC = new Date(dateStr + 'T12:00:00Z');
                    const tzHStr = sampleUTC.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', hour12: false });
                    const tzH = parseInt(tzHStr === '24' ? '0' : tzHStr);
                    const offsetMs = (12 - tzH) * 3600000;
                    const base = new Date(dateStr + (endOfDay ? 'T23:59:59Z' : 'T00:00:00Z'));
                    return new Date(base.getTime() + offsetMs).toISOString();
                };

                // 4. Rango del periodo en TZ empresa usando Intl
                const dtParts = new Intl.DateTimeFormat('en-CA', {
                    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
                }).formatToParts(now);
                const tzY = parseInt(dtParts.find(p => p.type === 'year')?.value  || '0');
                const tzM = parseInt(dtParts.find(p => p.type === 'month')?.value || '0');
                const pad2 = (n: number) => String(n).padStart(2, '0');
                const ds = (y: number, m: number, d: number) => \`\${y}-\${pad2(m)}-\${pad2(d)}\`;
                const dim = (y: number, m: number) => new Date(y, m, 0).getDate();

                let fromLocal: string | undefined, toLocal: string | undefined;
                switch (filters.period) {
                    case 'today':   fromLocal = toLocal = todayInTZ; break;
                    case 'week': {
                        const w = new Date(now); w.setDate(w.getDate() - 7);
                        fromLocal = w.toLocaleDateString('en-CA', { timeZone: tz });
                        toLocal   = todayInTZ; break;
                    }
                    case 'month':
                        fromLocal = ds(tzY, tzM, 1);
                        toLocal   = ds(tzY, tzM, dim(tzY, tzM)); break;
                    case 'quarter': {
                        const qs = Math.floor((tzM - 1) / 3) * 3 + 1;
                        fromLocal = ds(tzY, qs, 1);
                        toLocal   = ds(tzY, qs + 2, dim(tzY, qs + 2)); break;
                    }
                    case 'year':
                        fromLocal = ds(tzY, 1, 1); toLocal = ds(tzY, 12, 31); break;
                    case 'custom':
                        fromLocal = filters.date_from; toLocal = filters.date_to; break;
                    default: break;
                }

                const utcFrom       = fromLocal ? localToUTC(fromLocal, false) : undefined;
                const utcTo         = toLocal   ? localToUTC(toLocal,   true)  : undefined;
                const todayUtcStart = localToUTC(todayInTZ, false);

                // 5. COUNT server-side — SIN limite de 1000 filas de Supabase
                // head:true = solo devuelve el COUNT, cero datos, rapido y preciso
                const base = () => supabase
                    .from('follow_ups')
                    .select('*', { count: 'exact', head: true })
                    .eq('company_id', companyId);

                let sqQ = base();
                if (utcFrom) sqQ = sqQ.gte('date', utcFrom);
                if (utcTo)   sqQ = sqQ.lte('date', utcTo);

                let cpQ = base().eq('completed', true as any);
                if (utcFrom) cpQ = cpQ.gte('completed_at', utcFrom);
                if (utcTo)   cpQ = cpQ.lte('completed_at', utcTo);

                const ovQ = base()
                    .eq('completed', false as any)
                    .lt('date', todayUtcStart);

                const [sqR, cpR, ovR] = await Promise.all([sqQ, cpQ, ovQ]);
                setFollowUpStats({
                    scheduled: sqR.count ?? 0,
                    completed: cpR.count ?? 0,
                    overdue:   ovR.count ?? 0,
                });
            } catch (err) {
                console.warn('[TeamPerformance] followUpStats error:', err);
            }
        };
        fetchFollowUpStats();
    }, [companyId, filters.period, filters.date_from, filters.date_to, userPerformance.length]);
`;

const result = c.substring(0, useEffStart) + newBlock.replace(/\n/g, '\r\n') + c.substring(useEffEnd);
writeFileSync('src/pages/company/TeamPerformance.tsx', result, 'utf8');
console.log('Done. File length:', result.length);
