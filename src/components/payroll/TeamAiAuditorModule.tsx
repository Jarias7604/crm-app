import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  KeyRound,
  ExternalLink,
  Copy,
  Zap,
  RefreshCw,
  Bot,
  CheckCircle2,
  AlertTriangle,
  FileText,
  MessageSquare,
  ClipboardCheck,
  Repeat,
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

interface StructuredTaskEval {
  title: string;
  dateStr: string;
  projectOrClient: string;
  reportedHours: number;
  shouldTakeHours: number;
  status: 'ok' | 'warning' | 'danger';
  statusLabel: string;
  shortNote: string;
}

interface StructuredQuestion {
  topic: string;
  question: string;
}

interface StructuredAuditReport {
  sourceLabel: string;
  isLiveAi: boolean;
  credibilityScore: number;
  verdictStatus: 'ok' | 'warning' | 'danger';
  verdictTitle: string;
  shortExecutiveSummary: string;
  managementRecommendation: string;
  reportedHours: number;
  declaredTaskHours: number;
  estimatedRealHours: number;
  inflatedOrMissingHours: number;
  repetitionSummary: string;
  repetitionBullets: string[];
  taskEvaluations: StructuredTaskEval[];
  questionsToAsk: StructuredQuestion[];
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
  const [liveAiReports, setLiveAiReports] = useState<Record<string, StructuredAuditReport>>({});

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
        ? `API Key de ${provider.toUpperCase()} guardada correctamente.`
        : `API Key de ${provider.toUpperCase()} eliminada.`
    );
  };

  // ── MOTOR DE AUDITORÍA ESTRUCTURADO Y PROFESIONAL ──
  const defaultStructuredReports = useMemo<Record<string, StructuredAuditReport>>(() => {
    const stopWords = new Set([
      'de', 'la', 'el', 'en', 'y', 'a', 'los', 'del', 'las', 'un', 'por', 'con', 'no', 'una', 'su', 'para', 'es', 'al', 'lo', 'como', 'mas', 'o', 'pero', 'sus', 'le', 'ha', 'me', 'si', 'sin', 'sobre', 'este', 'ya', 'entre', 'cuando', 'todo', 'esta', 'ser', 'son', 'dos', 'tambien', 'fue', 'muy', 'hasta', 'desde', 'mi', 'porque', 'que', 'dia', '1h', '2h', '3h', '4h', '8h', 'hrs', 'hora', 'horas', 'soporte', 'general', 'ticket', 'tarea'
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

    const result: Record<string, StructuredAuditReport> = {};

    activeCollaborators.forEach((collab) => {
      const userFirstName = (collab.userName.split(' ')[0] || '').toLowerCase();

      const keywordBuckets = new Map<string, { count: number; titles: string[] }>();
      collab.tasks.forEach((t) => {
        const words = new Set(normalizeWords(`${t.title} ${t.projectOrClient}`));
        words.forEach((w) => {
          if (w === userFirstName) return;
          const prev = keywordBuckets.get(w) || { count: 0, titles: [] };
          prev.count += 1;
          if (!prev.titles.includes(t.title)) prev.titles.push(t.title);
          keywordBuckets.set(w, prev);
        });
      });

      const repeatedEntries = Array.from(keywordBuckets.entries())
        .filter(([, info]) => info.count >= 2)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3);

      const repetitionBullets: string[] = repeatedEntries.map(([word, info]) => {
        const isGeneric = ['jornada', 'varias', 'tareas', 'reunion', 'revision', 'tecnico'].includes(word);
        return isGeneric
          ? `Uso reiterado del término genérico "${word.toUpperCase()}" en ${info.count} registros (${info.titles.join(', ')}) sin especificar el entregable técnico.`
          : `El cliente o tema "${word.toUpperCase()}" se repite en ${info.count} tickets distintos (${info.titles.join(', ')}).`;
      });

      collab.timesheets.forEach((ts) => {
        const sLower = (ts.work_summary || '').toLowerCase();
        if (sLower.includes('descrita en el ticket') || sLower.includes('descripcion en ticket')) {
          repetitionBullets.push(
            `Jornada del ${ts.work_date} (${ts.regular_hours + ts.overtime_hours}h): Texto genérico ("${ts.work_summary}") que remite a tickets incompletos.`
          );
        }
      });

      const repetitionSummary =
        repetitionBullets.length > 0
          ? `Se detectaron ${repetitionBullets.length} patrones de repetición o descripciones genéricas.`
          : 'Las actividades registradas corresponden a tareas diferenciadas sin repetición anómala.';

      const taskEvaluations: StructuredTaskEval[] = collab.tasks.map((t) => {
        const lower = t.title.toLowerCase();
        const repHrs = t.hoursTaken !== null ? t.hoursTaken : 0;
        const isFiller =
          lower.includes('jornada ') ||
          (userFirstName && lower.includes(userFirstName)) ||
          lower.includes('tareas varias');
        const isMeeting = lower.includes('reunion') || lower.includes('reunión') || lower.includes('llamada');

        if (isFiller) {
          return {
            title: t.title,
            dateStr: t.dateStr,
            projectOrClient: t.projectOrClient,
            reportedHours: repHrs,
            shouldTakeHours: 0,
            status: 'danger',
            statusLabel: 'Relleno / Genérico',
            shortNote: 'Título genérico ("jornada" / "tareas varias") sin entregable verificable.',
          };
        }
        if (isMeeting && repHrs >= 1) {
          return {
            title: t.title,
            dateStr: t.dateStr,
            projectOrClient: t.projectOrClient,
            reportedHours: repHrs,
            shouldTakeHours: 0.5,
            status: 'warning',
            statusLabel: 'Tiempo Elevado',
            shortNote: 'Una reunión operativa estándar toma ~30 min (0.5h). Validar minuta o acuerdos.',
          };
        }
        if (repHrs === 0) {
          return {
            title: t.title,
            dateStr: t.dateStr,
            projectOrClient: t.projectOrClient,
            reportedHours: 0,
            shouldTakeHours: 0.5,
            status: 'warning',
            statusLabel: 'Sin Horas (0h)',
            shortNote: 'Ticket registrado sin declarar tiempo real de ejecución.',
          };
        }
        return {
          title: t.title,
          dateStr: t.dateStr,
          projectOrClient: t.projectOrClient,
          reportedHours: repHrs,
          shouldTakeHours: repHrs,
          status: 'ok',
          statusLabel: 'Correcto',
          shortNote: 'Tiempo razonable y proporcional al tipo de tarea.',
        };
      });

      const estimatedRealHours = +taskEvaluations
        .reduce((acc, item) => acc + item.shouldTakeHours, 0)
        .toFixed(2);
      const inflatedOrMissingHours = Math.max(
        0,
        +(collab.totalTimesheetHours - estimatedRealHours).toFixed(2)
      );

      const credibilityScore =
        collab.totalTimesheetHours > 0
          ? Math.max(
              10,
              Math.min(
                100,
                Math.round((estimatedRealHours / collab.totalTimesheetHours) * 100) -
                  taskEvaluations.filter((e) => e.status === 'danger').length * 10
              )
            )
          : 80;

      const verdictStatus: 'ok' | 'warning' | 'danger' =
        credibilityScore < 50 || inflatedOrMissingHours >= 4
          ? 'danger'
          : credibilityScore < 80 || inflatedOrMissingHours >= 1
          ? 'warning'
          : 'ok';

      const verdictTitle =
        verdictStatus === 'danger'
          ? 'Requiere Justificación de Horas'
          : verdictStatus === 'warning'
          ? 'Observaciones en Tiempos y Detalle'
          : 'Productividad Validada';

      const shortExecutiveSummary =
        inflatedOrMissingHours > 0
          ? `${collab.userName} reportó ${collab.totalTimesheetHours} horas de jornada laboral, pero solo documenta ${collab.explicitTaskHoursSum} horas en ${collab.tasksCount} tareas (con un tiempo técnico real estimado de ${estimatedRealHours} horas). Existe una diferencia de ${inflatedOrMissingHours} horas sin respaldo técnico.`
          : `${collab.userName} reportó ${collab.totalTimesheetHours} horas de jornada y respaldó ${collab.explicitTaskHoursSum} horas distribuidas en ${collab.tasksCount} tareas con tiempos coherentes.`;

      const managementRecommendation =
        inflatedOrMissingHours > 0
          ? `Solicitar el desglose detallado de las ${inflatedOrMissingHours} horas no respaldadas antes de aprobar el cierre de planilla y exigir que cada ticket describa la solución entregada.`
          : `Mantener el seguimiento regular y verificar que la evidencia técnica quede adjunta en cada ticket cerrado.`;

      const questionsToAsk: StructuredQuestion[] = [];
      if (collab.unjustifiedHours > 0) {
        questionsToAsk.push({
          topic: 'Brecha de horas sin respaldo',
          question: `Reportaste ${collab.totalTimesheetHours} horas en tu jornada, pero la suma de tus tickets registrados es de solo ${collab.explicitTaskHoursSum} horas. ¿En qué tareas específicas trabajaste durante las ${collab.unjustifiedHours} horas restantes?`,
        });
      }
      const dangerTasks = taskEvaluations.filter((t) => t.status === 'danger');
      if (dangerTasks.length > 0) {
        questionsToAsk.push({
          topic: 'Tickets genéricos o de relleno',
          question: `El ticket "${dangerTasks[0].title}" (${dangerTasks[0].reportedHours}h) tiene un nombre genérico y no describe ningún entregable. ¿Cuál fue el resultado concreto que se entregó en ese tiempo?`,
        });
      }
      if (repeatedEntries.length > 0) {
        const [topWord, topInfo] = repeatedEntries[0];
        questionsToAsk.push({
          topic: `Repetición en "${topWord.toUpperCase()}"`,
          question: `Aparecen ${topInfo.count} registros relacionados con "${topWord.toUpperCase()}" (${topInfo.titles.slice(0, 3).join(', ')}). ¿Se trata del mismo problema que sigue sin resolverse o por qué se dividió en varios tickets?`,
        });
      }
      if (questionsToAsk.length < 3) {
        questionsToAsk.push({
          topic: 'Verificación de tiempos y evidencia',
          question: `De las ${collab.tasksCount} tareas reportadas en este período, ¿cuáles cuentan con evidencia o confirmación del cliente de que quedaron 100% resueltas?`,
        });
      }

      result[collab.userId] = {
        sourceLabel: 'Auditoría Automática del Sistema',
        isLiveAi: false,
        credibilityScore,
        verdictStatus,
        verdictTitle,
        shortExecutiveSummary,
        managementRecommendation,
        reportedHours: collab.totalTimesheetHours,
        declaredTaskHours: collab.explicitTaskHoursSum,
        estimatedRealHours,
        inflatedOrMissingHours,
        repetitionSummary,
        repetitionBullets,
        taskEvaluations,
        questionsToAsk,
      };
    });

    return result;
  }, [activeCollaborators]);

  // ── PROMPT EJECUTIVO JSON PARA CLAUDE, CHATGPT Y GEMINI ──
  const buildStructuredJsonPrompt = (collab: AuditorCollaboratorData) => {
    const timesheetsText =
      collab.timesheets.length > 0
        ? collab.timesheets
            .map(
              (ts) =>
                `- Fecha ${ts.work_date}: ${ts.regular_hours}h reg + ${ts.overtime_hours}h ext. Resumen: "${ts.work_summary}"`
            )
            .join('\n')
        : '- Sin registros de jornada.';

    const tasksText =
      collab.tasks.length > 0
        ? collab.tasks
            .map(
              (t, idx) =>
                `${idx + 1}. [${t.dateStr}] "${t.title}" | Cliente/Proyecto: ${t.projectOrClient} | Horas reportadas: ${t.hoursTaken !== null ? `${t.hoursTaken}h` : '0h'}`
            )
            .join('\n')
        : '- Sin tareas ni tickets registrados.';

    return `Eres un Director de Auditoría Operativa. Analiza de forma PROFESIONAL, CLARA, CORTA y OBJETIVA el rendimiento de ${collab.userName} (${periodLabel}: ${startDate} a ${endDate}).

DATOS:
- Horas cobradas en jornada: ${collab.totalTimesheetHours}h
- Horas sumadas en tareas/tickets: ${collab.explicitTaskHoursSum}h
- Horas sin justificar: ${collab.unjustifiedHours}h

JORNADAS:
${timesheetsText}

TAREAS / TICKETS:
${tasksText}

Responde ÚNICAMENTE con un objeto JSON válido (sin bloques markdown, sin símbolos # ni **) con esta estructura exacta:
{
  "credibilityScore": 0-100,
  "verdictStatus": "ok" | "warning" | "danger",
  "verdictTitle": "Título profesional corto (máx 5 palabras)",
  "shortExecutiveSummary": "Resumen ejecutivo claro y profesional en máximo 2 oraciones directas.",
  "managementRecommendation": "Recomendación concreta de 1 oración para el gerente.",
  "estimatedRealHours": numero_horas_reales_que_debio_tomar,
  "inflatedOrMissingHours": numero_horas_infladas_o_sin_justificar,
  "repetitionSummary": "1 oración corta sobre si repite las mismas tareas, usa títulos vacíos o si lo que escribe en su jornada no coincide con los tickets.",
  "repetitionBullets": [
    "Hallazgo concreto 1 (ej. si repite 'Soporte técnico: [Cliente]' sin detalle o recicla el mismo tema)",
    "Hallazgo concreto 2 (ej. si en el resumen de jornada menciona cosas que NO tienen ticket ni horas asignadas)"
  ],
  "taskEvaluations": [
    {
      "title": "Nombre de la tarea",
      "dateStr": "YYYY-MM-DD",
      "projectOrClient": "Cliente o Proyecto",
      "reportedHours": 1,
      "shouldTakeHours": 0.5,
      "status": "ok" | "warning" | "danger",
      "statusLabel": "Correcto | Tiempo Elevado | Relleno / Sin Detalle",
      "shortNote": "Explicación ejecutiva de 1 sola línea."
    }
  ],
  "questionsToAsk": [
    {
      "topic": "Tema corto de la pregunta 1",
      "question": "Pregunta directa y profesional #1 para hacerle al colaborador"
    },
    {
      "topic": "Tema corto de la pregunta 2",
      "question": "Pregunta directa y profesional #2 para hacerle al colaborador"
    },
    {
      "topic": "Tema corto de la pregunta 3",
      "question": "Pregunta directa y profesional #3 para hacerle al colaborador"
    }
  ]
}`;
  };

  const buildHumanReadablePrompt = (collab: AuditorCollaboratorData) => {
    const timesheetsText =
      collab.timesheets
        .map((ts) => `- ${ts.work_date}: ${ts.regular_hours + ts.overtime_hours}h ("${ts.work_summary}")`)
        .join('\n') || '- Sin jornadas';
    const tasksText =
      collab.tasks
        .map((t, i) => `${i + 1}. [${t.dateStr}] "${t.title}" (${t.projectOrClient}) -> ${t.hoursTaken ?? 0}h`)
        .join('\n') || '- Sin tareas';

    return `Genera un Informe Ejecutivo corto y organizado sobre ${collab.userName} (${periodLabel}):
- Horas reportadas en jornada: ${collab.totalTimesheetHours}h
- Horas en tareas hechas: ${collab.explicitTaskHoursSum}h
- Jornadas:\n${timesheetsText}
- Tareas:\n${tasksText}

Estructura tu respuesta en 4 secciones cortas:
1. RESUMEN EJECUTIVO (3 líneas)
2. PATRONES DE REPETICIÓN O TAREAS GENÉRICAS
3. TABLA DE TIEMPO REPORTADO VS TIEMPO QUE DEBIÓ TOMAR
4. 3 PREGUNTAS DIRECTAS PARA HACERLE AL COLABORADOR`;
  };

  const cleanMarkdownSymbols = (str: string): string => {
    return (str || '')
      .replace(/\*\*/g, '')
      .replace(/__/g, '')
      .replace(/^#+\s*/gm, '')
      .replace(/`/g, '')
      .trim();
  };

  const parseAiJsonToReport = (
    rawText: string,
    collab: AuditorCollaboratorData,
    sourceLabel: string,
    fallbackReport: StructuredAuditReport
  ): StructuredAuditReport => {
    try {
      const cleaned = rawText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      const jsonSlice =
        firstBrace !== -1 && lastBrace !== -1 ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned;
      const parsed = JSON.parse(jsonSlice);

      const parsedQuestions: StructuredQuestion[] = Array.isArray(parsed.questionsToAsk)
        ? parsed.questionsToAsk.map((q: any, idx: number) => {
            if (typeof q === 'string') {
              return { topic: `Pregunta de Control #${idx + 1}`, question: cleanMarkdownSymbols(q) };
            }
            return {
              topic: cleanMarkdownSymbols(q?.topic || `Pregunta de Control #${idx + 1}`),
              question: cleanMarkdownSymbols(q?.question || ''),
            };
          }).filter((q: StructuredQuestion) => q.question.length > 0)
        : fallbackReport.questionsToAsk;

      return {
        sourceLabel,
        isLiveAi: true,
        credibilityScore:
          typeof parsed.credibilityScore === 'number'
            ? Math.max(0, Math.min(100, Math.round(parsed.credibilityScore)))
            : fallbackReport.credibilityScore,
        verdictStatus:
          parsed.verdictStatus === 'ok' || parsed.verdictStatus === 'warning' || parsed.verdictStatus === 'danger'
            ? parsed.verdictStatus
            : fallbackReport.verdictStatus,
        verdictTitle: cleanMarkdownSymbols(parsed.verdictTitle || fallbackReport.verdictTitle),
        shortExecutiveSummary: cleanMarkdownSymbols(
          parsed.shortExecutiveSummary || fallbackReport.shortExecutiveSummary
        ),
        managementRecommendation: cleanMarkdownSymbols(
          parsed.managementRecommendation || fallbackReport.managementRecommendation
        ),
        reportedHours: collab.totalTimesheetHours,
        declaredTaskHours: collab.explicitTaskHoursSum,
        estimatedRealHours:
          typeof parsed.estimatedRealHours === 'number'
            ? +parsed.estimatedRealHours.toFixed(2)
            : fallbackReport.estimatedRealHours,
        inflatedOrMissingHours:
          typeof parsed.inflatedOrMissingHours === 'number'
            ? +parsed.inflatedOrMissingHours.toFixed(2)
            : fallbackReport.inflatedOrMissingHours,
        repetitionSummary: cleanMarkdownSymbols(parsed.repetitionSummary || fallbackReport.repetitionSummary),
        repetitionBullets: Array.isArray(parsed.repetitionBullets)
          ? parsed.repetitionBullets.map((b: any) => cleanMarkdownSymbols(String(b)))
          : fallbackReport.repetitionBullets,
        taskEvaluations:
          Array.isArray(parsed.taskEvaluations) && parsed.taskEvaluations.length > 0
            ? parsed.taskEvaluations.map((te: any) => ({
                title: cleanMarkdownSymbols(te.title || 'Tarea'),
                dateStr: te.dateStr || '',
                projectOrClient: cleanMarkdownSymbols(te.projectOrClient || 'General'),
                reportedHours: Number(te.reportedHours || 0),
                shouldTakeHours: Number(te.shouldTakeHours || 0),
                status: te.status === 'ok' || te.status === 'warning' || te.status === 'danger' ? te.status : 'warning',
                statusLabel: cleanMarkdownSymbols(te.statusLabel || 'Revisar'),
                shortNote: cleanMarkdownSymbols(te.shortNote || ''),
              }))
            : fallbackReport.taskEvaluations,
        questionsToAsk: parsedQuestions.length > 0 ? parsedQuestions : fallbackReport.questionsToAsk,
      };
    } catch {
      return {
        ...fallbackReport,
        sourceLabel,
        isLiveAi: true,
      };
    }
  };

  // ── LLAMADA EN VIVO A CLAUDE, CHATGPT O GEMINI ──
  const handleRunLiveAi = async (collab: AuditorCollaboratorData) => {
    const key = apiKeys[activeProvider];
    if (!key) {
      setKeyInput('');
      setShowKeyConfig(true);
      toast('Conecta tu API Key de ' + activeProvider.toUpperCase() + ' arriba.', {
        icon: '🔌',
      });
      return;
    }

    const prompt = buildStructuredJsonPrompt(collab);
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
            const sonnets = fetchedIds.filter((id) => id.includes('sonnet'));
            const others = fetchedIds.filter((id) => !id.includes('sonnet'));
            candidateModels = [...sonnets, ...others];
          }
        } catch {
          // fallback
        }

        [
          'claude-sonnet-4-5-20250929',
          'claude-sonnet-4-20250514',
          'claude-3-7-sonnet-20250219',
          'claude-3-5-haiku-20241022',
          'claude-3-haiku-20240307',
        ].forEach((m) => {
          if (!candidateModels.includes(m)) candidateModels.push(m);
        });

        let lastError = 'No se pudo completar la llamada a Claude API';
        for (const modelId of candidateModels) {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: claudeHeaders,
            body: JSON.stringify({
              model: modelId,
              max_tokens: 3500,
              temperature: 0.1,
              messages: [{ role: 'user', content: prompt }],
            }),
          });
          const data = await res.json();
          if (res.ok) {
            responseText = data?.content?.[0]?.text || '';
            modelUsed = modelId;
            break;
          } else {
            const errType = data?.error?.type || '';
            const errMsg = data?.error?.message || '';
            lastError = errMsg || `Error HTTP ${res.status}`;
            if (errType === 'not_found_error' || errMsg.toLowerCase().includes('model')) {
              continue;
            } else {
              throw new Error(lastError);
            }
          }
        }
        if (!responseText) throw new Error(lastError);
      } else if (activeProvider === 'gemini') {
        const geminiCandidates = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest'];
        let lastError = 'Error en Gemini API';

        for (const modelId of geminiCandidates) {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(key)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
              }),
            }
          );
          const data = await res.json();
          if (res.ok) {
            responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            modelUsed = modelId;
            break;
          } else {
            lastError = data?.error?.message || `Error HTTP ${res.status}`;
            if (res.status === 404 || lastError.toLowerCase().includes('not found')) continue;
            throw new Error(lastError);
          }
        }
        if (!responseText) throw new Error(lastError);
      } else if (activeProvider === 'chatgpt') {
        const openAiCandidates = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'];
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
              temperature: 0.1,
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: 'Responde siempre en JSON válido, claro y profesional.' },
                { role: 'user', content: prompt },
              ],
            }),
          });
          const data = await res.json();
          if (res.ok) {
            responseText = data?.choices?.[0]?.message?.content || '';
            modelUsed = modelId;
            break;
          } else {
            lastError = data?.error?.message || `Error HTTP ${res.status}`;
            if (lastError.toLowerCase().includes('model') || res.status === 404) continue;
            throw new Error(lastError);
          }
        }
        if (!responseText) throw new Error(lastError);
      }

      const fallback = defaultStructuredReports[collab.userId];
      const structured = parseAiJsonToReport(
        responseText,
        collab,
        `${activeProvider.toUpperCase()} • ${modelUsed}`,
        fallback
      );

      setLiveAiReports((prev) => ({
        ...prev,
        [collab.userId]: structured,
      }));
      toast.success(`Informe ejecutivo generado con ${activeProvider.toUpperCase()}`);
    } catch (err: any) {
      toast.error(`Error con ${activeProvider.toUpperCase()}: ${err.message}`, { duration: 6000 });
    } finally {
      setRunningUserId(null);
    }
  };

  const handleOpenInWebAccount = async (collab: AuditorCollaboratorData, provider: AiProvider) => {
    const prompt = buildHumanReadablePrompt(collab);
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // ignore
    }
    const urls: Record<AiProvider, string> = {
      claude: 'https://claude.ai/new',
      chatgpt: 'https://chatgpt.com/',
      gemini: 'https://gemini.google.com/app',
    };
    toast.success(`Datos copiados. Pega (Ctrl+V) en ${provider.toUpperCase()}.`);
    window.open(urls[provider], '_blank', 'noopener,noreferrer');
  };

  const handleCopyFullExecutiveReport = (collab: AuditorCollaboratorData, report: StructuredAuditReport) => {
    const lines = [
      `INFORME EJECUTIVO DE AUDITORÍA — ${collab.userName.toUpperCase()} (${periodLabel})`,
      `Estado: ${report.verdictTitle} (Índice de Credibilidad: ${report.credibilityScore}%)`,
      `Horas Jornada: ${report.reportedHours}h | Horas en Tareas: ${report.declaredTaskHours}h | Tiempo Real Estimado IA: ${report.estimatedRealHours}h | Sin Sustento: ${report.inflatedOrMissingHours}h`,
      ``,
      `1. RESUMEN EJECUTIVO:`,
      report.shortExecutiveSummary,
      `Recomendación: ${report.managementRecommendation}`,
      ``,
      `2. PREGUNTAS PARA EL COLABORADOR:`,
      ...report.questionsToAsk.map((q, i) => `   ${i + 1}. [${q.topic}] ${q.question}`),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Informe ejecutivo copiado al portapapeles');
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* ── BARRA DE CONFIGURACIÓN DE MOTOR DE IA (SOBRIA Y CORPORATIVA) ── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Auditoría Ejecutiva de Productividad & Tiempos (IA)
              </h2>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                Formato Corporativo
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Resumen gerencial corto, evaluación de tiempos reales por tarea y guion de preguntas de control.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {(
              [
                { id: 'claude' as const, label: 'Claude' },
                { id: 'chatgpt' as const, label: 'ChatGPT' },
                { id: 'gemini' as const, label: 'Gemini' },
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    isSel ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{prov.label}</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${hasKey ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setKeyInput(apiKeys[activeProvider] || '');
              setShowKeyConfig(!showKeyConfig);
            }}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer flex items-center gap-1.5"
          >
            <KeyRound className="w-3.5 h-3.5" />
            {apiKeys[activeProvider] ? `API ${activeProvider.toUpperCase()} Conectada` : 'Configurar API Key'}
          </button>
        </div>
      </div>

      {showKeyConfig && (
        <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 animate-fadeIn">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={`Pegar API Key de ${activeProvider.toUpperCase()}...`}
            className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-indigo-400"
          />
          <button
            type="button"
            onClick={() => handleSaveApiKey(activeProvider, keyInput)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
          >
            Guardar Key
          </button>
          <button
            type="button"
            onClick={() => setShowKeyConfig(false)}
            className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* ── EXPEDIENTE PROFESIONAL DE AUDITORÍA POR COLABORADOR ── */}
      {activeCollaborators.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <Sparkles className="w-7 h-7 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">
            Selecciona uno o más colaboradores en la barra superior para visualizar su Informe de Auditoría
          </h3>
        </div>
      ) : (
        <div className="space-y-6">
          {activeCollaborators.map((collab) => {
            const report = liveAiReports[collab.userId] || defaultStructuredReports[collab.userId];
            if (!report) return null;
            const isRunning = runningUserId === collab.userId;

            return (
              <div
                key={collab.userId}
                className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden border-t-4 border-t-slate-900"
              >
                {/* ── CABECERA DEL DOCUMENTO EJECUTIVO ── */}
                <div className="px-6 py-5 bg-slate-50/70 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-900 text-white font-black text-lg flex items-center justify-center shrink-0">
                      {collab.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          INFORME DE AUDITORÍA OPERATIVA
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-[11px] font-semibold text-slate-600">
                          {periodLabel}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {report.sourceLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">
                          {collab.userName}
                        </h3>
                        <span
                          className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border ${
                            report.verdictStatus === 'danger'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : report.verdictStatus === 'warning'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {report.verdictTitle} ({report.credibilityScore}% Credibilidad)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones del Informe */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => handleRunLiveAi(collab)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                    >
                      {isRunning ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}
                      {isRunning
                        ? `Auditando con ${activeProvider.toUpperCase()}...`
                        : `Actualizar Dictamen con ${activeProvider === 'claude' ? 'Claude' : activeProvider === 'chatgpt' ? 'ChatGPT' : 'Gemini'}`}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyFullExecutiveReport(collab, report)}
                      className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      Copiar Informe
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenInWebAccount(collab, activeProvider)}
                      className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                      title="Abrir en cuenta web"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* ── CUERPO DEL INFORME (4 SECCIONES NUMERADAS Y LIMPIAS) ── */}
                <div className="p-6 space-y-6">
                  {/* SECCIÓN 01: RESUMEN EJECUTIVO CORTO Y KPIS DE AUDITORÍA */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <span className="text-[11px] font-black text-white bg-slate-900 px-2 py-0.5 rounded">
                        01
                      </span>
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-600" />
                        Resumen Ejecutivo de Auditoría
                      </h4>
                    </div>

                    {/* 4 Indicadores Sobrios */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Horas Reportadas (Planilla)
                        </span>
                        <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                          {report.reportedHours} hrs
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Pago neto: ${collab.netPay.toFixed(2)}
                        </span>
                      </div>

                      <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Horas Declaradas en Tareas
                        </span>
                        <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                          {report.declaredTaskHours} hrs
                        </span>
                        <span className="text-[11px] text-slate-500">
                          En {collab.tasksCount} {collab.tasksCount === 1 ? 'registro' : 'registros'}
                        </span>
                      </div>

                      <div className="bg-indigo-50/40 border border-indigo-200 rounded-xl p-3.5">
                        <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">
                          Tiempo Real Estimado (IA)
                        </span>
                        <span className="text-2xl font-black text-indigo-950 font-mono mt-1 block">
                          {report.estimatedRealHours} hrs
                        </span>
                        <span className="text-[11px] text-indigo-700">
                          Según complejidad técnica
                        </span>
                      </div>

                      <div
                        className={`rounded-xl p-3.5 border ${
                          report.inflatedOrMissingHours > 0
                            ? 'bg-rose-50/50 border-rose-200'
                            : 'bg-emerald-50/50 border-emerald-200'
                        }`}
                      >
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider block ${
                            report.inflatedOrMissingHours > 0 ? 'text-rose-800' : 'text-emerald-800'
                          }`}
                        >
                          Horas sin Sustento / Desviación
                        </span>
                        <span
                          className={`text-2xl font-black font-mono mt-1 block ${
                            report.inflatedOrMissingHours > 0 ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {report.inflatedOrMissingHours} hrs
                        </span>
                        <span
                          className={`text-[11px] font-semibold ${
                            report.inflatedOrMissingHours > 0 ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {report.inflatedOrMissingHours > 0
                            ? `Requiere justificación ($${(report.inflatedOrMissingHours * collab.hourlyRate).toFixed(2)})`
                            : 'Sin desviación detectada'}
                        </span>
                      </div>
                    </div>

                    {/* Cuadro de Síntesis Ejecutiva Corta y Clara */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 text-xs">
                        <div className="lg:col-span-8 space-y-1">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                            Conclusión del Análisis
                          </span>
                          <p className="text-sm font-medium text-slate-900 leading-relaxed">
                            {report.shortExecutiveSummary}
                          </p>
                        </div>
                        <div className="lg:col-span-4 lg:border-l lg:border-slate-200 lg:pl-4 space-y-1">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 block">
                            Acción Recomendada
                          </span>
                          <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                            {report.managementRecommendation}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECCIÓN 02: PREGUNTAS QUE DEBES HACERLE AL COLABORADOR */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-white bg-indigo-600 px-2 py-0.5 rounded">
                          02
                        </span>
                        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                          Preguntas Directas para Realizar al Colaborador
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const text = report.questionsToAsk
                            .map((q, i) => `${i + 1}. ${q.question}`)
                            .join('\n\n');
                          navigator.clipboard.writeText(text);
                          toast.success('Preguntas copiadas al portapapeles');
                        }}
                        className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg border border-indigo-200 flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <Copy className="w-3 h-3" />
                        Copiar todas las preguntas
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {report.questionsToAsk.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-white border border-slate-200 border-l-4 border-l-indigo-600 rounded-xl p-3.5 flex flex-col justify-between gap-3 shadow-2xs"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
                                Pregunta 0{idx + 1} • {item.topic}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(item.question);
                                  toast.success(`Pregunta 0${idx + 1} copiada`);
                                }}
                                className="text-[10px] font-bold text-slate-400 hover:text-slate-800 cursor-pointer"
                              >
                                Copiar
                              </button>
                            </div>
                            <p className="text-xs text-slate-800 font-medium leading-relaxed">
                              “{item.question}”
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SECCIÓN 03: DETECTOR DE REPETICIÓN Y PATRONES */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-white bg-slate-900 px-2 py-0.5 rounded">
                          03
                        </span>
                        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Repeat className="w-3.5 h-3.5 text-slate-600" />
                          Control de Tareas Repetitivas o Descripciones Genéricas
                        </h4>
                      </div>
                      <span className="text-xs font-medium text-slate-500">
                        {report.repetitionSummary}
                      </span>
                    </div>

                    {report.repetitionBullets.length === 0 ? (
                      <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-medium flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        No se detectaron tareas duplicadas ni descripciones genéricas en este período.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {report.repetitionBullets.map((bullet, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 flex items-start gap-2.5"
                          >
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{bullet}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* SECCIÓN 04: MATRIZ DE EVALUACIÓN DE TIEMPOS TAREA POR TAREA */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <span className="text-[11px] font-black text-white bg-slate-900 px-2 py-0.5 rounded">
                        04
                      </span>
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <ClipboardCheck className="w-3.5 h-3.5 text-slate-600" />
                        Desglose Técnico por Tarea (Tiempo Reportado vs. Tiempo Estimado IA)
                      </h4>
                    </div>

                    {report.taskEvaluations.length === 0 ? (
                      <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800 font-medium">
                        El colaborador reportó {report.reportedHours} horas en planilla sin vincular ninguna tarea o ticket.
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              <th className="py-2.5 px-3 w-10 text-center">#</th>
                              <th className="py-2.5 px-3">Tarea / Entregable</th>
                              <th className="py-2.5 px-3 text-center">Fecha</th>
                              <th className="py-2.5 px-3 text-center">Reportó</th>
                              <th className="py-2.5 px-3 text-center">Estimado IA</th>
                              <th className="py-2.5 px-3 text-center">Dictamen</th>
                              <th className="py-2.5 px-3">Observación Técnica</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {report.taskEvaluations.map((item, i) => (
                              <tr key={i} className="hover:bg-slate-50/70">
                                <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400 font-bold">
                                  {String(i + 1).padStart(2, '0')}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-slate-900">{item.title}</div>
                                  <div className="text-[10px] text-slate-500 font-medium">
                                    {item.projectOrClient}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600">
                                  {item.dateStr}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                                  {item.reportedHours}h
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-extrabold text-indigo-700">
                                  {item.shouldTakeHours}h
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-md border ${
                                      item.status === 'danger'
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : item.status === 'warning'
                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    }`}
                                  >
                                    {item.statusLabel}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 text-xs">
                                  {item.shortNote}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-800">
                              <td colSpan={3} className="py-2.5 px-3 text-right uppercase text-[10px] tracking-wider text-slate-500">
                                Balance Total de Tareas Auditadas:
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-slate-900">
                                {report.declaredTaskHours}h
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-indigo-700">
                                {report.estimatedRealHours}h
                              </td>
                              <td colSpan={2} className="py-2.5 px-3 text-slate-600 text-[11px]">
                                Jornada cobrada: <strong>{report.reportedHours}h</strong> •{' '}
                                {report.inflatedOrMissingHours > 0 ? (
                                  <span className="text-rose-700 font-bold">
                                    Diferencia sin sustento: {report.inflatedOrMissingHours}h
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 font-bold">
                                    Tiempos conciliados correctamente
                                  </span>
                                )}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
