import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Clock,
  Repeat,
  KeyRound,
  ExternalLink,
  Copy,
  Zap,
  RefreshCw,
  HelpCircle,
  SearchCheck,
  FileWarning,
  Bot,
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface AuditorCollaboratorData {
  userId: string;
  userName: string;
  userEmail: string;
  netPay: number;
  grossPay: number;
  hourlyRate: number;
  totalTimesheetHours: number;
  explicitTaskHoursSum: number;
  unjustifiedHours: number;
  justificationPct: number;
  unjustifiedCost: number;
  tasksCount: number;
  timesheets: {
    id: string;
    work_date: string;
    regular_hours: number;
    overtime_hours: number;
    work_summary: string;
    overtime_reason?: string | null;
  }[];
  tasks: {
    uid: string;
    id: string;
    title: string;
    source: 'ticket' | 'task' | 'timesheet';
    sourceLabel: string;
    projectOrClient: string;
    statusLabel: string;
    dateStr: string;
    hoursTaken: number | null;
    timeBadge: string;
  }[];
}

interface TeamAiAuditorModuleProps {
  collaborators: AuditorCollaboratorData[];
  periodLabel: string;
  startDate: string;
  endDate: string;
  selectedUserIds: string[];
  onSelectUserIds: (ids: string[]) => void;
}

type AiProvider = 'claude' | 'chatgpt' | 'gemini';

interface TaskAuditDiagnosis {
  uid: string;
  title: string;
  dateStr: string;
  projectOrClient: string;
  reportedHours: number;
  estimatedIdealHours: number;
  verdict: 'honest' | 'questionable' | 'inflated_or_filler';
  verdictLabel: string;
  reason: string;
  isRepetitive: boolean;
}

interface CollaboratorForensicReport {
  userId: string;
  userName: string;
  credibilityScore: number;
  riskLevel: 'ALTO RIESGO (POSIBLE RELLENO / INFLACIÓN)' | 'RIESGO MEDIO (REVISAR TIEMPOS)' | 'CONFIABLE (ENTREGABLES CLAROS)';
  repetitivePatterns: {
    topic: string;
    count: number;
    details: string;
    diagnosis: string;
  }[];
  fillerOrVagueSummaries: {
    dateStr: string;
    text: string;
    reportedHours: number;
    issue: string;
  }[];
  taskDiagnoses: TaskAuditDiagnosis[];
  totalReportedWorkdayHours: number;
  totalTaskHours: number;
  totalEstimatedRealHours: number;
  suspectedOverchargedHours: number;
  suspectedOverchargedCost: number;
  confrontationQuestions: string[];
}

const STORAGE_KEYS: Record<AiProvider, string> = {
  claude: 'arias_crm_ai_key_claude',
  chatgpt: 'arias_crm_ai_key_openai',
  gemini: 'arias_crm_ai_key_gemini',
};

export default function TeamAiAuditorModule({
  collaborators,
  periodLabel,
  startDate,
  endDate,
  selectedUserIds,
  onSelectUserIds,
}: TeamAiAuditorModuleProps) {
  const [activeProvider, setActiveProvider] = useState<AiProvider>('claude');
  const [apiKeys, setApiKeys] = useState<Record<AiProvider, string>>(() => ({
    claude: localStorage.getItem(STORAGE_KEYS.claude) || '',
    chatgpt: localStorage.getItem(STORAGE_KEYS.chatgpt) || '',
    gemini: localStorage.getItem(STORAGE_KEYS.gemini) || '',
  }));
  const [showKeyConfig, setShowKeyConfig] = useState<boolean>(false);
  const [keyInput, setKeyInput] = useState<string>('');
  const [runningUserId, setRunningUserId] = useState<string | null>(null);
  const [liveAiOutput, setLiveAiOutput] = useState<Record<string, { text: string; modelUsed: string }>>({});

  const activeCollaborators = useMemo(() => {
    const withData = collaborators.filter(
      (c) => c.tasksCount > 0 || c.totalTimesheetHours > 0 || c.grossPay > 0
    );
    if (selectedUserIds.length > 0) {
      return collaborators.filter((c) => selectedUserIds.includes(c.userId));
    }
    return withData;
  }, [collaborators, selectedUserIds]);

  const handleSaveApiKey = (provider: AiProvider, value: string) => {
    const clean = value.trim();
    localStorage.setItem(STORAGE_KEYS[provider], clean);
    setApiKeys((prev) => ({ ...prev, [provider]: clean }));
    setShowKeyConfig(false);
    toast.success(
      clean
        ? `Cuenta / API Key de ${provider.toUpperCase()} conectada correctamente.`
        : `API Key de ${provider.toUpperCase()} eliminada.`
    );
  };

  // ── MOTOR FORENSE INTELIGENTE (ANALIZA REPETICIÓN, TIEMPOS INFLADOS Y MENTIRAS/RELLENO) ──
  const forensicReports = useMemo<CollaboratorForensicReport[]>(() => {
    const stopWords = new Set([
      'de', 'la', 'el', 'en', 'y', 'a', 'los', 'del', 'las', 'un', 'por', 'con', 'no', 'una', 'su', 'para', 'es', 'al', 'lo', 'como', 'mas', 'o', 'pero', 'sus', 'le', 'ha', 'me', 'si', 'sin', 'sobre', 'este', 'ya', 'entre', 'cuando', 'todo', 'esta', 'ser', 'son', 'dos', 'tambien', 'fue', 'habia', 'era', 'muy', 'anos', 'hasta', 'desde', 'esta', 'mi', 'porque', 'que', 'dia', '1h', '2h', '3h', '4h', '8h', 'hrs', 'hora', 'horas'
    ]);

    const normalizeWords = (text: string): string[] => {
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !stopWords.has(w));
    };

    return activeCollaborators.map((collab) => {
      const userFirstName = (collab.userName.split(' ')[0] || '').toLowerCase();

      // 1. Detectar patrones repetitivos o mismo problema reportado varias veces
      const keywordBuckets = new Map<string, { count: number; titles: string[] }>();
      collab.tasks.forEach((t) => {
        const words = new Set(normalizeWords(`${t.title} ${t.projectOrClient}`));
        words.forEach((w) => {
          if (w === userFirstName || w === 'soporte' || w === 'general' || w === 'ticket' || w === 'tarea') return;
          const prev = keywordBuckets.get(w) || { count: 0, titles: [] };
          prev.count += 1;
          if (!prev.titles.includes(t.title)) prev.titles.push(t.title);
          keywordBuckets.set(w, prev);
        });
      });

      const repetitivePatterns: CollaboratorForensicReport['repetitivePatterns'] = [];
      Array.from(keywordBuckets.entries())
        .filter(([, info]) => info.count >= 2)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 4)
        .forEach(([word, info]) => {
          const isGenericWord = ['jornada', 'varias', 'tareas', 'reunion', 'revision'].includes(word);
          repetitivePatterns.push({
            topic: word.toUpperCase(),
            count: info.count,
            details: info.titles.join('  •  '),
            diagnosis: isGenericWord
              ? `Usa la palabra genérica "${word}" en ${info.count} registros distintos para llenar su reporte sin especificar el entregable técnico exacto.`
              : `El tema/cliente "${word.toUpperCase()}" se repite en ${info.count} tareas (${info.titles.join(', ')}). Validar si es el mismo problema sin resolver que está reportando varias veces o si dividió una sola gestión en varios tickets.`,
          });
        });

      // Revisar también resúmenes de jornada repetidos o evasivos
      const fillerOrVagueSummaries: CollaboratorForensicReport['fillerOrVagueSummaries'] = [];
      collab.timesheets.forEach((ts) => {
        const summaryLower = (ts.work_summary || '').toLowerCase();
        const isEvasive =
          summaryLower.includes('descrita en el ticket') ||
          summaryLower.includes('descripcion en ticket') ||
          summaryLower.includes('tareas varias') ||
          summaryLower.includes('jornada trabajada') ||
          summaryLower.trim().length < 25;

        if (isEvasive) {
          fillerOrVagueSummaries.push({
            dateStr: ts.work_date,
            text: ts.work_summary,
            reportedHours: Number(ts.regular_hours || 0) + Number(ts.overtime_hours || 0),
            issue:
              summaryLower.includes('ticket')
                ? 'Resumen evasivo: remite a los tickets ("descrita en el ticket"), pero los tickets de ese día no cubren las horas cobradas.'
                : 'Descripción demasiado genérica para justificar un día completo de salario.',
          });
        }
      });

      // 2. Evaluar tarea por tarea: ¿Debía tomar menos tiempo? ¿Es relleno?
      const taskDiagnoses: TaskAuditDiagnosis[] = collab.tasks.map((t) => {
        const lower = t.title.toLowerCase();
        const repHrs = t.hoursTaken !== null ? t.hoursTaken : 0;
        const isSelfNamedJornada =
          lower.includes('jornada ') ||
          (userFirstName && lower.includes(userFirstName)) ||
          lower.includes('tareas varias');
        const isMeeting = lower.includes('reunion') || lower.includes('reunión') || lower.includes('llamada');
        const isSimpleReview = lower.includes('revision') || lower.includes('revisión') || lower.includes('validar');

        let estimatedIdealHours = repHrs;
        let verdict: TaskAuditDiagnosis['verdict'] = 'honest';
        let verdictLabel = '🟢 Tiempo Razonable';
        let reason = 'El tiempo reportado es proporcional a una actividad operativa estándar.';

        if (isSelfNamedJornada) {
          estimatedIdealHours = 0;
          verdict = 'inflated_or_filler';
          verdictLabel = '🔴 Ticket de Relleno / Genérico';
          reason =
            repHrs > 0
              ? `Le asignó ${repHrs}h a un ticket llamado "${t.title}". Poner "jornada" o "tareas varias" NO es un entregable verificable; debería valer 0h hasta que detalle qué resolvió.`
              : `Ticket comodín ("${t.title}") sin horas ni entregable específico. No justifica horas de nómina.`;
        } else if (isMeeting) {
          estimatedIdealHours = Math.min(repHrs > 0 ? repHrs : 0.5, 0.5);
          if (repHrs >= 1) {
            verdict = 'questionable';
            verdictLabel = '🟡 Reunión (Validar Duración)';
            reason = `Reporta ${repHrs}h en reunión ("${t.title}"). Una reunión operativa/revisión suele tomar 20–30 min (0.5h) salvo sesión extensa con acta de acuerdos.`;
          }
        } else if (isSimpleReview && repHrs > 1) {
          estimatedIdealHours = 0.5;
          verdict = 'inflated_or_filler';
          verdictLabel = '🔴 Tiempo Excesivo';
          reason = `Reporta ${repHrs}h para una revisión simple ("${t.title}"), que normalmente toma 30 min (0.5h).`;
        } else if (repHrs === 0) {
          estimatedIdealHours = 0.5;
          verdict = 'questionable';
          verdictLabel = '🟡 Sin Tiempo Declarado (0h)';
          reason = `Cerró el ticket "${t.title}" sin registrar cuánto tiempo le tomó.`;
        }

        const isRepetitive = repetitivePatterns.some((rp) =>
          lower.includes(rp.topic.toLowerCase())
        );

        return {
          uid: t.uid,
          title: t.title,
          dateStr: t.dateStr,
          projectOrClient: t.projectOrClient,
          reportedHours: repHrs,
          estimatedIdealHours: +estimatedIdealHours.toFixed(2),
          verdict,
          verdictLabel,
          reason,
          isRepetitive,
        };
      });

      const totalEstimatedRealHours = +taskDiagnoses
        .reduce((acc, td) => acc + td.estimatedIdealHours, 0)
        .toFixed(2);

      const suspectedOverchargedHours = Math.max(
        0,
        +(collab.totalTimesheetHours - totalEstimatedRealHours).toFixed(2)
      );
      const suspectedOverchargedCost = +(suspectedOverchargedHours * collab.hourlyRate).toFixed(2);

      // Calcular Score de Credibilidad (0 a 100)
      const baseCoverage =
        collab.totalTimesheetHours > 0
          ? Math.min(100, (totalEstimatedRealHours / collab.totalTimesheetHours) * 100)
          : collab.tasksCount > 0
          ? 75
          : 0;
      const fillerPenalty = fillerOrVagueSummaries.length * 12;
      const inflatedPenalty = taskDiagnoses.filter((d) => d.verdict === 'inflated_or_filler').length * 15;
      const credibilityScore = Math.max(5, Math.min(100, Math.round(baseCoverage - fillerPenalty - inflatedPenalty)));

      const riskLevel: CollaboratorForensicReport['riskLevel'] =
        credibilityScore < 45 || collab.unjustifiedHours >= 4
          ? 'ALTO RIESGO (POSIBLE RELLENO / INFLACIÓN)'
          : credibilityScore < 75
          ? 'RIESGO MEDIO (REVISAR TIEMPOS)'
          : 'CONFIABLE (ENTREGABLES CLAROS)';

      // 3. Construir preguntas directas de confrontación para el Admin
      const confrontationQuestions: string[] = [];
      if (collab.unjustifiedHours > 0) {
        confrontationQuestions.push(
          `1. Brecha de Horas: Reportaste ${collab.totalTimesheetHours}h de jornada ($${collab.netPay.toFixed(2)} neto), pero tus tickets solo suman ${collab.explicitTaskHoursSum}h (y según auditoría técnica equivalen a ~${totalEstimatedRealHours}h reales). ¿Qué entregables exactos hiciste en las ${collab.unjustifiedHours}h restantes?`
        );
      }
      const fillerTasks = taskDiagnoses.filter((d) => d.verdict === 'inflated_or_filler');
      if (fillerTasks.length > 0) {
        confrontationQuestions.push(
          `2. Tickets de Relleno Detectados: Creaste ${fillerTasks.map((f) => `"${f.title}" (${f.reportedHours}h)`).join(', ')}. Un ticket llamado "jornada" o "tareas varias" no demuestra trabajo real. ¿Cuáles fueron los cambios o soluciones específicas entregadas al cliente?`
        );
      }
      if (repetitivePatterns.length > 0) {
        const topRep = repetitivePatterns[0];
        confrontationQuestions.push(
          `3. Repetición del Mismo Tema (${topRep.topic}): Aparece ${topRep.count} veces en tus reportes (${topRep.details}). ¿Seguimos con el mismo problema sin resolver o estás dividiendo una misma tarea en varios tickets para sumar horas?`
        );
      }
      if (fillerOrVagueSummaries.length > 0) {
        confrontationQuestions.push(
          `4. Reportes de Jornada Evasivos: En tus jornadas escribiste "${fillerOrVagueSummaries[0].text}". A partir de hoy cada jornada requiere listar los entregables reales terminados y que la suma de horas coincida exactamente.`
        );
      }

      return {
        userId: collab.userId,
        userName: collab.userName,
        credibilityScore,
        riskLevel,
        repetitivePatterns,
        fillerOrVagueSummaries,
        taskDiagnoses,
        totalReportedWorkdayHours: collab.totalTimesheetHours,
        totalTaskHours: collab.explicitTaskHoursSum,
        totalEstimatedRealHours,
        suspectedOverchargedHours,
        suspectedOverchargedCost,
        confrontationQuestions,
      };
    });
  }, [activeCollaborators]);

  // ── GENERADOR DE PROMPT FORENSE PARA CLAUDE, CHATGPT O GEMINI ──
  const buildForensicPromptForCollaborator = (collab: AuditorCollaboratorData) => {
    const timesheetsText =
      collab.timesheets.length > 0
        ? collab.timesheets
            .map(
              (ts) =>
                `- Fecha ${ts.work_date}: Reportó ${ts.regular_hours}h regulares + ${ts.overtime_hours}h extras. Resumen escrito: "${ts.work_summary}"`
            )
            .join('\n')
        : '- Sin registros de jornada.';

    const tasksText =
      collab.tasks.length > 0
        ? collab.tasks
            .map(
              (t, idx) =>
                `${idx + 1}. [${t.dateStr}] Título: "${t.title}" | Cliente/Proyecto: ${t.projectOrClient} | Estado: ${t.statusLabel} | Tiempo reportado en tarea: ${t.hoursTaken !== null ? `${t.hoursTaken}h` : '0h (Sin especificar)'}`
            )
            .join('\n')
        : '- Sin tareas ni tickets registrados.';

    return `Actúa como un Auditor Forense Senior de Productividad, Ingeniería y Nómina.
Necesito que analices de forma directa, sin filtros y muy clara el trabajo reportado por el colaborador: ${collab.userName} en el período ${periodLabel} (${startDate} a ${endDate}).

DATOS DE NÓMINA Y HORAS REPORTADAS:
- Horas totales cobradas en jornada: ${collab.totalTimesheetHours} horas
- Horas sumadas en tareas/tickets: ${collab.explicitTaskHoursSum} horas
- Horas sin justificar: ${collab.unjustifiedHours} horas
- Pago Neto en el período: $${collab.netPay.toFixed(2)} USD ($${collab.grossPay.toFixed(2)} bruto | Tarifa: $${collab.hourlyRate.toFixed(2)}/h)

JORNADAS REPORTADAS POR EL COLABORADOR:
${timesheetsText}

TAREAS Y TICKETS COMPLETADOS POR EL COLABORADOR:
${tasksText}

POR FAVOR RESPONDE DE FORMA EJECUTIVA Y CLARA ESTOS 4 PUNTOS:
1. 🔁 ¿ESTÁ REPORTANDO LO MISMO TODO EL TIEMPO / MISMOS PROBLEMAS?: Analiza si los tickets son repetitivos, si está reportando el mismo cliente/reunión varias veces o si usa títulos genéricos ("jornada", "tareas varias") como relleno.
2. ⏱️ ¿LE DEBIÓ TOMAR MENOS TIEMPO? (DETECTOR DE MENTIRAS / INFLACIÓN DE HORAS): Evalúa cada tarea una por una y dime cuánto tiempo real debería tomarle a un profesional vs. lo que reportó.
3. 💵 IMPACTO EN NÓMINA: ¿Cuántas de las ${collab.totalTimesheetHours} horas cobradas están realmente justificadas y cuánto dinero se le está pagando sin respaldo?
4. 💬 GUIÓN DE CONFRONTACIÓN: Dame 3 preguntas directas y objetivas para confrontar a ${collab.userName} hoy mismo.`;
  };

  // ── LLAMADA EN VIVO A LA API DE CLAUDE, CHATGPT O GEMINI CON AUTO-DETECCIÓN DE MODELOS ACTIVOS ──
  const handleRunLiveAi = async (collab: AuditorCollaboratorData) => {
    const key = apiKeys[activeProvider];
    if (!key) {
      setKeyInput('');
      setShowKeyConfig(true);
      toast('Conecta tu API Key de ' + activeProvider.toUpperCase() + ' o usa el botón "Abrir en mi Cuenta Web" al lado.', {
        icon: '🔌',
      });
      return;
    }

    const prompt = buildForensicPromptForCollaborator(collab);
    setRunningUserId(collab.userId);
    try {
      let responseText = '';
      let modelUsed = '';

      if (activeProvider === 'claude') {
        const claudeHeaders = {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        };

        // 1. Consultar dinámicamente qué modelos tiene activos la cuenta de Anthropic del usuario
        let candidateModels: string[] = [];
        try {
          const modelsRes = await fetch('https://api.anthropic.com/v1/models', {
            method: 'GET',
            headers: claudeHeaders,
          });
          if (modelsRes.ok) {
            const modelsJson = await modelsRes.json();
            const fetchedIds: string[] = (modelsJson?.data || [])
              .map((m: any) => m?.id)
              .filter(Boolean);
            // Priorizar Sonnet 4.x / 3.7 / Haiku activos en la cuenta
            const sonnets = fetchedIds.filter((id) => id.includes('sonnet'));
            const others = fetchedIds.filter((id) => !id.includes('sonnet'));
            candidateModels = [...sonnets, ...others];
          }
        } catch {
          // Si falla el listado, usamos la lista de respaldo oficial
        }

        const fallbackClaudeModels = [
          'claude-sonnet-4-5-20250929',
          'claude-sonnet-4-20250514',
          'claude-3-7-sonnet-20250219',
          'claude-3-5-haiku-20241022',
          'claude-3-haiku-20240307',
        ];
        fallbackClaudeModels.forEach((m) => {
          if (!candidateModels.includes(m)) candidateModels.push(m);
        });

        let lastError = 'No se pudo completar la llamada a Claude API';
        for (const modelId of candidateModels) {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: claudeHeaders,
            body: JSON.stringify({
              model: modelId,
              max_tokens: 1600,
              temperature: 0.2,
              messages: [{ role: 'user', content: prompt }],
            }),
          });
          const data = await res.json();
          if (res.ok) {
            responseText = data?.content?.[0]?.text || 'Sin respuesta.';
            modelUsed = modelId;
            break;
          } else {
            const errType = data?.error?.type || '';
            const errMsg = data?.error?.message || '';
            lastError = errMsg || `Error HTTP ${res.status}`;
            // Si es un error de modelo no encontrado, probamos el siguiente modelo automáticamente
            if (errType === 'not_found_error' || errMsg.toLowerCase().includes('model')) {
              continue;
            } else {
              throw new Error(lastError);
            }
          }
        }

        if (!responseText) {
          throw new Error(lastError);
        }
      } else if (activeProvider === 'gemini') {
        const geminiCandidates = [
          'gemini-2.5-flash',
          'gemini-2.0-flash',
          'gemini-1.5-flash-latest',
          'gemini-1.5-pro-latest',
        ];
        let lastError = 'Error en Gemini API';

        for (const modelId of geminiCandidates) {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(key)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2 },
              }),
            }
          );
          const data = await res.json();
          if (res.ok) {
            responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta.';
            modelUsed = modelId;
            break;
          } else {
            lastError = data?.error?.message || `Error HTTP ${res.status}`;
            if (res.status === 404 || lastError.toLowerCase().includes('not found')) {
              continue;
            } else {
              throw new Error(lastError);
            }
          }
        }

        if (!responseText) {
          throw new Error(lastError);
        }
      } else if (activeProvider === 'chatgpt') {
        const openAiCandidates = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'];
        let lastError = 'Error en OpenAI API';

        for (const modelId of openAiCandidates) {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
              model: modelId,
              temperature: 0.2,
              messages: [
                { role: 'system', content: 'Eres un auditor forense ejecutivo de productividad y nómina.' },
                { role: 'user', content: prompt },
              ],
            }),
          });
          const data = await res.json();
          if (res.ok) {
            responseText = data?.choices?.[0]?.message?.content || 'Sin respuesta.';
            modelUsed = modelId;
            break;
          } else {
            lastError = data?.error?.message || `Error HTTP ${res.status}`;
            if (lastError.toLowerCase().includes('model') || res.status === 404) {
              continue;
            } else {
              throw new Error(lastError);
            }
          }
        }

        if (!responseText) {
          throw new Error(lastError);
        }
      }

      setLiveAiOutput((prev) => ({
        ...prev,
        [collab.userId]: { text: responseText, modelUsed },
      }));
      toast.success(`Auditoría completada con ${activeProvider.toUpperCase()} (${modelUsed})`);
    } catch (err: any) {
      toast.error(`Error al conectar con ${activeProvider.toUpperCase()}: ${err.message}`, {
        duration: 6000,
      });
    } finally {
      setRunningUserId(null);
    }
  };

  // ── PUENTE EN 1 CLIC A LA CUENTA WEB (CLAUDE.AI, CHATGPT.COM, GEMINI.GOOGLE.COM) ──
  const handleOpenInWebAccount = async (collab: AuditorCollaboratorData, provider: AiProvider) => {
    const prompt = buildForensicPromptForCollaborator(collab);
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // fallback
    }

    const urls: Record<AiProvider, string> = {
      claude: 'https://claude.ai/new',
      chatgpt: 'https://chatgpt.com/',
      gemini: 'https://gemini.google.com/app',
    };
    const names: Record<AiProvider, string> = {
      claude: 'Claude.ai',
      chatgpt: 'ChatGPT',
      gemini: 'Google Gemini',
    };

    toast.success(
      `¡Datos de ${collab.userName} copiados! Solo pega (Ctrl+V) en tu cuenta de ${names[provider]}.`,
      { duration: 5000 }
    );
    window.open(urls[provider], '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* ── 1. BARRA SUPERIOR DE CONEXIÓN A TUS CUENTAS DE IA (CLAUDE, CHATGPT, GEMINI) ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-md border border-indigo-500/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0 text-indigo-300">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold tracking-tight text-white">
                  AI Workforce Auditor — Detector de Repetición, Tiempos Inflados y Productividad
                </h2>
                <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500 text-white px-2.5 py-0.5 rounded-full">
                  Claude • ChatGPT • Gemini
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Analiza automáticamente si un colaborador reporta siempre las mismas tareas, si usa tickets genéricos de relleno o si reporta más horas de las que realmente toma cada tarea.
              </p>
            </div>
          </div>

          {/* Selector de Motor de IA + Botón de Conexión */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'claude' as const, label: '🟣 Claude', desc: 'Anthropic' },
                { id: 'chatgpt' as const, label: '🟢 ChatGPT', desc: 'OpenAI' },
                { id: 'gemini' as const, label: '🔵 Gemini', desc: 'Google' },
              ]
            ).map((prov) => {
              const isSel = activeProvider === prov.id;
              const hasKey = Boolean(apiKeys[prov.id]);
              return (
                <button
                  key={prov.id}
                  type="button"
                  onClick={() => {
                    setActiveProvider(prov.id);
                    setKeyInput(apiKeys[prov.id] || '');
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer border flex items-center gap-2 ${
                    isSel
                      ? 'bg-white text-slate-900 border-white shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <span>{prov.label}</span>
                  {hasKey && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" title="API Key conectada" />
                  )}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setKeyInput(apiKeys[activeProvider] || '');
                setShowKeyConfig(!showKeyConfig);
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/40 transition cursor-pointer flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {apiKeys[activeProvider] ? 'API Conectada ✓' : 'Conectar API Key'}
            </button>
          </div>
        </div>

        {/* Panel desplegable para pegar la API Key de Claude, ChatGPT o Gemini */}
        {showKeyConfig && (
          <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-indigo-300 uppercase tracking-wider mb-1">
                API Key de {activeProvider === 'claude' ? 'Claude (Anthropic)' : activeProvider === 'chatgpt' ? 'ChatGPT (OpenAI)' : 'Google Gemini'} (Se guarda en tu navegador)
              </label>
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder={
                  activeProvider === 'claude'
                    ? 'sk-ant-api03-...'
                    : activeProvider === 'chatgpt'
                    ? 'sk-proj-...'
                    : 'AIzaSy...'
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-indigo-400"
              />
            </div>
            <div className="flex items-end gap-2 sm:pt-5">
              <button
                type="button"
                onClick={() => handleSaveApiKey(activeProvider, keyInput)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
              >
                Guardar Conexión
              </button>
              <button
                type="button"
                onClick={() => setShowKeyConfig(false)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 2. RESULTADOS DE AUDITORÍA FORENSE POR COLABORADOR ── */}
      {forensicReports.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
          <Sparkles className="w-8 h-8 text-indigo-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-900">
            Selecciona un colaborador arriba para auditar sus tareas y tiempos con IA
          </h3>
          <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
            {collaborators
              .filter((c) => c.tasksCount > 0 || c.totalTimesheetHours > 0)
              .map((c) => (
                <button
                  key={c.userId}
                  type="button"
                  onClick={() => onSelectUserIds([c.userId])}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold cursor-pointer"
                >
                  🔍 Auditar a {c.userName} ({c.tasksCount} tareas • {c.totalTimesheetHours}h)
                </button>
              ))}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {forensicReports.map((report) => {
            const collab = activeCollaborators.find((c) => c.userId === report.userId)!;
            const isHighRisk = report.riskLevel.startsWith('ALTO');
            const isMedRisk = report.riskLevel.startsWith('RIESGO MEDIO');
            const isRunningThisUser = runningUserId === report.userId;

            return (
              <div
                key={report.userId}
                className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden"
              >
                {/* CABECERA DEL REPORTE DE AUDITORÍA DEL COLABORADOR */}
                <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl font-black text-lg flex items-center justify-center shrink-0 text-white shadow-xs ${
                        isHighRisk ? 'bg-rose-600' : isMedRisk ? 'bg-amber-600' : 'bg-emerald-600'
                      }`}
                    >
                      {report.credibilityScore}%
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-extrabold text-slate-900">
                          Auditoría IA: {report.userName}
                        </h3>
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                            isHighRisk
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : isMedRisk
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {report.riskLevel}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">
                          📅 {periodLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Índice de Credibilidad Operativa: <strong>{report.credibilityScore}/100</strong> •{' '}
                        Reportó <strong>{report.totalReportedWorkdayHours}h</strong> en jornada |{' '}
                        Declaró <strong>{report.totalTaskHours}h</strong> en tareas |{' '}
                        Tiempo real estimado por IA: <strong className="text-indigo-700">{report.totalEstimatedRealHours}h</strong>
                      </p>
                    </div>
                  </div>

                  {/* BOTONES PARA LANZAR EN TU CUENTA DE CLAUDE, CHATGPT O GEMINI */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isRunningThisUser}
                      onClick={() => handleRunLiveAi(collab)}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                    >
                      {isRunningThisUser ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}
                      {isRunningThisUser
                        ? 'Analizando con IA...'
                        : `Analizar con ${activeProvider === 'claude' ? 'Claude' : activeProvider === 'chatgpt' ? 'ChatGPT' : 'Gemini'} (API)`}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenInWebAccount(collab, 'claude')}
                      className="px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      title="Copia el análisis de este empleado y abre tu cuenta de Claude.ai"
                    >
                      <span>🟣 Abrir en Claude.ai</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenInWebAccount(collab, 'chatgpt')}
                      className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      title="Copia el análisis de este empleado y abre tu cuenta de ChatGPT"
                    >
                      <span>🟢 ChatGPT</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenInWebAccount(collab, 'gemini')}
                      className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      title="Copia el análisis de este empleado y abre tu cuenta de Google Gemini"
                    >
                      <span>🔵 Gemini</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* CUERPO DEL ANÁLISIS FORENSE */}
                <div className="p-4 sm:p-5 space-y-5">
                  {/* RESPUESTA EN VIVO DEL MODELO EXTERNO SI SE EJECUTÓ CON API KEY */}
                  {liveAiOutput[report.userId] && (
                    <div className="bg-indigo-950 text-indigo-50 rounded-2xl p-4 border border-indigo-700 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-indigo-400" />
                          Dictamen en Vivo de {activeProvider.toUpperCase()} ({liveAiOutput[report.userId].modelUsed})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(liveAiOutput[report.userId].text);
                            toast.success('Dictamen copiado al portapapeles');
                          }}
                          className="text-[11px] font-bold text-indigo-300 hover:text-white flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" /> Copiar
                        </button>
                      </div>
                      <div className="text-xs leading-relaxed whitespace-pre-wrap font-sans text-slate-100 bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
                        {liveAiOutput[report.userId].text}
                      </div>
                    </div>
                  )}

                  {/* 3 PILARES DEL DIAGNÓSTICO DE HONESTIDAD DE TIEMPOS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        1. Horas Cobradas vs. Horas en Tareas
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-xl font-black text-slate-900 font-mono">
                          {report.totalReportedWorkdayHours}h cobradas
                        </span>
                        <span className="text-xs font-bold text-indigo-700">
                          vs {report.totalTaskHours}h en tareas
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Pago neto del período: <strong>${collab.netPay.toFixed(2)}</strong>
                      </p>
                    </div>

                    <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3.5">
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">
                        2. Tiempo Real que Debió Tomar (IA)
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-xl font-black text-indigo-950 font-mono">
                          ~{report.totalEstimatedRealHours}h reales
                        </span>
                        <span className="text-xs font-bold text-indigo-700">
                          según complejidad real
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-800 mt-1">
                        Descontando tickets genéricos/relleno y reuniones infladas.
                      </p>
                    </div>

                    <div
                      className={`rounded-xl p-3.5 border ${
                        report.suspectedOverchargedHours > 0
                          ? 'bg-rose-50/70 border-rose-300'
                          : 'bg-emerald-50/70 border-emerald-200'
                      }`}
                    >
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider block ${
                          report.suspectedOverchargedHours > 0 ? 'text-rose-800' : 'text-emerald-800'
                        }`}
                      >
                        3. Tiempo Inflado / Sin Respaldo Real
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span
                          className={`text-xl font-black font-mono ${
                            report.suspectedOverchargedHours > 0 ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {report.suspectedOverchargedHours}h sin sustento
                        </span>
                        {report.suspectedOverchargedCost > 0 && (
                          <span className="text-xs font-extrabold text-rose-800">
                            (${report.suspectedOverchargedCost.toFixed(2)})
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-[11px] mt-1 font-medium ${
                          report.suspectedOverchargedHours > 0 ? 'text-rose-800' : 'text-emerald-800'
                        }`}
                      >
                        {report.suspectedOverchargedHours > 0
                          ? `Cobró ${report.totalReportedWorkdayHours}h pero el trabajo real equivale a ~${report.totalEstimatedRealHours}h.`
                          : 'El tiempo cobrado concuerda con la complejidad de las tareas.'}
                      </p>
                    </div>
                  </div>

                  {/* SECCIÓN A: DETECTOR DE TAREAS REPETIDAS / MISMOS PROBLEMAS / RELLENO */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="border border-slate-200 rounded-xl p-4 space-y-2.5 bg-slate-50/40">
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Repeat className="w-4 h-4 text-amber-600" />
                        1. ¿Está reportando lo mismo o el mismo problema?
                      </h4>

                      {report.repetitivePatterns.length === 0 ? (
                        <p className="text-xs text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-200 font-medium">
                          ✓ No se detectaron tareas repetitivas ni reciclaje del mismo ticket en este período.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {report.repetitivePatterns.map((pat) => (
                            <div
                              key={pat.topic}
                              className="bg-white border border-amber-200 rounded-xl p-3 space-y-1 shadow-2xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-amber-950">
                                  🔁 Tema repetido: “{pat.topic}”
                                </span>
                                <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                                  {pat.count} veces en el período
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                {pat.details}
                              </p>
                              <p className="text-xs text-slate-800 font-medium leading-snug">
                                💡 <strong>Análisis IA:</strong> {pat.diagnosis}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* RESÚMENES DE JORNADA EVASIVOS O COPIADOS */}
                    <div className="border border-slate-200 rounded-xl p-4 space-y-2.5 bg-slate-50/40">
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <FileWarning className="w-4 h-4 text-rose-600" />
                        2. Auditoría de lo que escribe en “Mi Jornada”
                      </h4>

                      {report.fillerOrVagueSummaries.length === 0 ? (
                        <p className="text-xs text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-200 font-medium">
                          ✓ Los resúmenes escritos en Mi Jornada describen actividades concretas.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {report.fillerOrVagueSummaries.map((fv, i) => (
                            <div
                              key={`${fv.dateStr}-${i}`}
                              className="bg-white border border-rose-200 rounded-xl p-3 space-y-1 shadow-2xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-900">
                                  📅 Jornada {fv.dateStr} ({fv.reportedHours}h cobradas)
                                </span>
                                <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                                  Texto Evasivo / Genérico
                                </span>
                              </div>
                              <p className="text-xs italic text-slate-700 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                                “{fv.text}”
                              </p>
                              <p className="text-[11px] text-rose-800 font-semibold">
                                ⚠️ {fv.issue}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SECCIÓN B: EVALUACIÓN TAREA POR TAREA (¿DEBIÓ TOMAR MENOS TIEMPO?) */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <SearchCheck className="w-4 h-4 text-indigo-600" />
                      3. Evaluación de Tiempos por Tarea: ¿Debió tomar menos tiempo o es relleno?
                    </h4>

                    {report.taskDiagnoses.length === 0 ? (
                      <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-4 text-xs text-rose-900 font-medium">
                        🚨 Este colaborador reportó <strong>{report.totalReportedWorkdayHours}h</strong> de jornada pero tiene <strong>0 tareas o tickets</strong> registrados en este período.
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              <th className="py-2.5 px-3">Tarea / Ticket</th>
                              <th className="py-2.5 px-3 text-center">Fecha</th>
                              <th className="py-2.5 px-3 text-center">Reportó</th>
                              <th className="py-2.5 px-3 text-center">Tiempo Ideal IA</th>
                              <th className="py-2.5 px-3">Dictamen IA</th>
                              <th className="py-2.5 px-3">Explicación Objetiva</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {report.taskDiagnoses.map((td) => (
                              <tr key={td.uid} className="hover:bg-slate-50/70">
                                <td className="py-2.5 px-3 font-bold text-slate-900">
                                  <div>{td.title}</div>
                                  <span className="text-[10px] font-semibold text-slate-500">
                                    📁 {td.projectOrClient}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600">
                                  {td.dateStr}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                                  {td.reportedHours}h
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-extrabold text-indigo-700">
                                  {td.estimatedIdealHours}h
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                      td.verdict === 'inflated_or_filler'
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : td.verdict === 'questionable'
                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    }`}
                                  >
                                    {td.verdictLabel}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-[11px] text-slate-700 leading-snug max-w-md">
                                  {td.reason}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* SECCIÓN C: PREGUNTAS DIRECTAS SUGERIDAS POR LA IA PARA CONFRONTAR AL COLABORADOR */}
                  {report.confrontationQuestions.length > 0 && (
                    <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                          <HelpCircle className="w-4 h-4 text-amber-700" />
                          4. Preguntas Exactas Sugeridas por la IA para Confrontar a {report.userName}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(report.confrontationQuestions.join('\n\n'));
                            toast.success('Preguntas de confrontación copiadas');
                          }}
                          className="text-[11px] font-bold text-amber-900 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" /> Copiar preguntas
                        </button>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-800">
                        {report.confrontationQuestions.map((q, idx) => (
                          <p key={idx} className="bg-white/90 p-2.5 rounded-lg border border-amber-200/70 leading-relaxed">
                            {q}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
