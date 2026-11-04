import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Repeat,
  KeyRound,
  ExternalLink,
  Copy,
  Zap,
  RefreshCw,
  HelpCircle,
  SearchCheck,
  Bot,
  CheckCircle2,
  AlertTriangle,
  MessageSquareWarning,
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

interface StructuredAuditReport {
  sourceLabel: string; // ej: 'Análisis Instantáneo' o 'Claude (claude-sonnet-4-6)'
  isLiveAi: boolean;
  credibilityScore: number;
  verdictStatus: 'ok' | 'warning' | 'danger';
  verdictTitle: string;
  shortExecutiveSummary: string;
  reportedHours: number;
  declaredTaskHours: number;
  estimatedRealHours: number;
  inflatedOrMissingHours: number;
  repetitionSummary: string;
  repetitionBullets: string[];
  taskEvaluations: StructuredTaskEval[];
  questionsToAsk: string[];
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
        ? `Cuenta / API Key de ${provider.toUpperCase()} conectada.`
        : `API Key de ${provider.toUpperCase()} eliminada.`
    );
  };

  // ── MOTOR BASE ORGANIZADO Y CLARO (SE REEMPLAZA POR EL REPORTE EN VIVO DE CLAUDE/CHATGPT/GEMINI AL PULSAR EL BOTÓN) ──
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

      // 1. Detectar repetición
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
          ? `Usa el término genérico "${word.toUpperCase()}" en ${info.count} tareas (${info.titles.join(', ')}) sin especificar qué problema técnico resolvió.`
          : `Repite el tema/cliente "${word.toUpperCase()}" ${info.count} veces (${info.titles.join(', ')}). Validar si dividió un mismo trabajo en varios tickets.`;
      });

      collab.timesheets.forEach((ts) => {
        const sLower = (ts.work_summary || '').toLowerCase();
        if (sLower.includes('descrita en el ticket') || sLower.includes('descripcion en ticket')) {
          repetitionBullets.push(
            `El ${ts.work_date} cobró ${ts.regular_hours + ts.overtime_hours}h poniendo solo "${ts.work_summary}", sin detallar entregables.`
          );
        }
      });

      const repetitionSummary =
        repetitionBullets.length > 0
          ? `Se detectaron ${repetitionBullets.length} patrones de títulos repetidos o genéricos.`
          : 'No se detectan tareas recicladas ni textos repetitivos en este período.';

      // 2. Evaluar tiempos por tarea
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
            statusLabel: '🔴 Relleno / Genérico',
            shortNote: 'Poner "jornada" o "tareas varias" no es una tarea real; no justifica tiempo.',
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
            statusLabel: '🟡 Reunión Larga',
            shortNote: 'Una reunión interna suele tomar 30 min (0.5h). Pedir acuerdos concretos.',
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
            statusLabel: '🟡 Sin Horas (0h)',
            shortNote: 'Registró el ticket sin indicar cuánto tiempo le tomó.',
          };
        }
        return {
          title: t.title,
          dateStr: t.dateStr,
          projectOrClient: t.projectOrClient,
          reportedHours: repHrs,
          shouldTakeHours: repHrs,
          status: 'ok',
          statusLabel: '🟢 Tiempo Razonable',
          shortNote: 'Tiempo acorde para este tipo de soporte o tarea.',
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
          ? 'Alerta: Horas sin Respaldo y Tickets Genéricos'
          : verdictStatus === 'warning'
          ? 'Observación: Revisar Detalle y Tiempos de Tareas'
          : 'Productividad Clara y Respaldada';

      // 3. Resumen corto y claro (máximo 2-3 líneas)
      const shortExecutiveSummary =
        inflatedOrMissingHours > 0
          ? `${collab.userName} reportó ${collab.totalTimesheetHours}h de jornada, pero sumando sus ${collab.tasksCount} tareas registradas solo respalda ${collab.explicitTaskHoursSum}h (y descontando tickets genéricos o reuniones largas equivale a ~${estimatedRealHours}h de trabajo real). Hay ${inflatedOrMissingHours}h que requieren explicación directa.`
          : `${collab.userName} reportó ${collab.totalTimesheetHours}h de jornada y respaldó ${collab.explicitTaskHoursSum}h distribuidas en ${collab.tasksCount} tareas con tiempos proporcionales.`;

      // 4. Preguntas cortas y directas para hacerle al colaborador
      const questionsToAsk: string[] = [];
      if (collab.unjustifiedHours > 0) {
        questionsToAsk.push(
          `¿Qué tareas específicas realizaste durante las ${collab.unjustifiedHours} horas que faltan entre las ${collab.totalTimesheetHours}h que reportaste en tu jornada y las ${collab.explicitTaskHoursSum}h que suman tus tickets?`
        );
      }
      const dangerTasks = taskEvaluations.filter((t) => t.status === 'danger');
      if (dangerTasks.length > 0) {
        questionsToAsk.push(
          `En el ticket "${dangerTasks[0].title}" pusiste ${dangerTasks[0].reportedHours}h con un título genérico: ¿qué problema técnico resolviste exactamente y a qué cliente se le entregó?`
        );
      }
      if (repeatedEntries.length > 0) {
        const [topWord, topInfo] = repeatedEntries[0];
        questionsToAsk.push(
          `Tienes ${topInfo.count} registros sobre "${topWord.toUpperCase()}" (${topInfo.titles.slice(0, 3).join(', ')}): ¿por qué se crearon varios tickets separados en lugar de cerrar el requerimiento en uno solo?`
        );
      }
      if (questionsToAsk.length === 0) {
        questionsToAsk.push(
          `Para los ${collab.tasksCount} tickets cerrados en este corte, ¿quedó documentada la solución técnica dentro de cada ticket para consulta del equipo?`
        );
      }

      result[collab.userId] = {
        sourceLabel: 'Motor Auditor Integrado',
        isLiveAi: false,
        credibilityScore,
        verdictStatus,
        verdictTitle,
        shortExecutiveSummary,
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

  // ── PROMPT ESTRUCTURADO EN JSON PARA QUE CLAUDE / CHATGPT / GEMINI ENTREGUEN UN REPORTE LIMPIO Y FÁCIL DE LEER ──
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

    return `Eres un Auditor Ejecutivo de Productividad. Analiza de forma MUY CLARA, CORTA, SIMPLE y DIRECTA el trabajo de ${collab.userName} (${periodLabel}: ${startDate} a ${endDate}).

DATOS:
- Horas cobradas en jornada: ${collab.totalTimesheetHours}h
- Horas sumadas en tareas/tickets: ${collab.explicitTaskHoursSum}h
- Horas sin justificar: ${collab.unjustifiedHours}h

JORNADAS:
${timesheetsText}

TAREAS / TICKETS:
${tasksText}

Responde ÚNICAMENTE con un objeto JSON válido (sin texto adicional fuera del JSON ni bloques markdown) con esta estructura exacta:
{
  "credibilityScore": 0-100,
  "verdictStatus": "ok" | "warning" | "danger",
  "verdictTitle": "Título corto de 4 a 7 palabras",
  "shortExecutiveSummary": "Resumen ejecutivo MUY CLARO y CORTO (máximo 3 líneas) explicando en lenguaje sencillo qué hizo, si las horas tienen sentido o si faltan horas por justificar.",
  "estimatedRealHours": numero_horas_reales_que_debio_tomar,
  "inflatedOrMissingHours": numero_horas_infladas_o_sin_justificar,
  "repetitionSummary": "1 frase corta diciendo si repite siempre lo mismo o si usa títulos genéricos.",
  "repetitionBullets": [
    "Punto corto y claro 1 sobre tareas repetidas o genéricas",
    "Punto corto y claro 2"
  ],
  "taskEvaluations": [
    {
      "title": "Nombre de la tarea",
      "dateStr": "YYYY-MM-DD",
      "projectOrClient": "Cliente o Proyecto",
      "reportedHours": 1,
      "shouldTakeHours": 0.5,
      "status": "ok" | "warning" | "danger",
      "statusLabel": "🟢 Justo | 🟡 Dudoso | 🔴 Inflado/Relleno",
      "shortNote": "Explicación de 1 sola línea muy fácil de entender de por qué debió tomar ese tiempo."
    }
  ],
  "questionsToAsk": [
    "Pregunta directa, corta y clara #1 para hacerle al colaborador en reunión",
    "Pregunta directa, corta y clara #2",
    "Pregunta directa, corta y clara #3"
  ]
}`;
  };

  // Prompt legible para cuando el usuario abre Claude.ai / ChatGPT / Gemini en otra pestaña
  const buildHumanReadablePrompt = (collab: AuditorCollaboratorData) => {
    const timesheetsText =
      collab.timesheets
        .map((ts) => `- ${ts.work_date}: ${ts.regular_hours + ts.overtime_hours}h ("${ts.work_summary}")`)
        .join('\n') || '- Sin jornadas';
    const tasksText =
      collab.tasks
        .map((t, i) => `${i + 1}. [${t.dateStr}] "${t.title}" (${t.projectOrClient}) -> ${t.hoursTaken ?? 0}h`)
        .join('\n') || '- Sin tareas';

    return `Analiza de forma MUY CORTA, ORGANIZADA y FÁCIL DE ENTENDER el trabajo de ${collab.userName} (${periodLabel}):
- Horas reportadas en jornada: ${collab.totalTimesheetHours}h
- Horas en tareas hechas: ${collab.explicitTaskHoursSum}h
-Jornadas:\n${timesheetsText}
-Tareas:\n${tasksText}

Por favor dame solo 4 bloques cortos y al grano:
1. RESUMEN CORTO (3 líneas): ¿Qué pasó realmente con sus horas y tareas?
2. ¿REPITE LO MISMO?: ¿Está reportando lo mismo o usando nombres genéricos?
3. TIEMPO QUE DEBIÓ TOMAR: Lista cada tarea con (Reportó Xh -> Debió tomar Yh) y 1 frase corta.
4. 3 PREGUNTAS DIRECTAS que debo hacerle hoy mismo para confrontarlo.`;
  };

  // Parsear la respuesta JSON de Claude / ChatGPT / Gemini de forma segura
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
        verdictTitle: parsed.verdictTitle || fallbackReport.verdictTitle,
        shortExecutiveSummary: parsed.shortExecutiveSummary || fallbackReport.shortExecutiveSummary,
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
        repetitionSummary: parsed.repetitionSummary || fallbackReport.repetitionSummary,
        repetitionBullets: Array.isArray(parsed.repetitionBullets)
          ? parsed.repetitionBullets
          : fallbackReport.repetitionBullets,
        taskEvaluations:
          Array.isArray(parsed.taskEvaluations) && parsed.taskEvaluations.length > 0
            ? parsed.taskEvaluations.map((te: any) => ({
                title: te.title || 'Tarea',
                dateStr: te.dateStr || '',
                projectOrClient: te.projectOrClient || 'General',
                reportedHours: Number(te.reportedHours || 0),
                shouldTakeHours: Number(te.shouldTakeHours || 0),
                status: te.status === 'ok' || te.status === 'warning' || te.status === 'danger' ? te.status : 'warning',
                statusLabel: te.statusLabel || '🟡 Revisar',
                shortNote: te.shortNote || '',
              }))
            : fallbackReport.taskEvaluations,
        questionsToAsk:
          Array.isArray(parsed.questionsToAsk) && parsed.questionsToAsk.length > 0
            ? parsed.questionsToAsk
            : fallbackReport.questionsToAsk,
      };
    } catch {
      // Si el modelo respondió texto libre, limpiamos cualquier símbolo markdown (#, **, |) y lo mostramos limpio en el resumen
      const cleanPlain = rawText
        .replace(/[#*|>`_~-]{2,}/g, '')
        .replace(/^#+\s*/gm, '')
        .trim()
        .slice(0, 600);
      return {
        ...fallbackReport,
        sourceLabel,
        isLiveAi: true,
        shortExecutiveSummary: cleanPlain || fallbackReport.shortExecutiveSummary,
      };
    }
  };

  // ── EJECUTAR ANÁLISIS EN VIVO CON CLAUDE, CHATGPT O GEMINI ──
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
              max_tokens: 1500,
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
                { role: 'system', content: 'Responde siempre en JSON válido, claro y conciso.' },
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
        `${activeProvider.toUpperCase()} (${modelUsed})`,
        fallback
      );

      setLiveAiReports((prev) => ({
        ...prev,
        [collab.userId]: structured,
      }));
      toast.success(`Reporte ejecutivo actualizado con ${activeProvider.toUpperCase()}`);
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
    toast.success(`Resumen copiado. Solo pega (Ctrl+V) en ${provider.toUpperCase()}.`);
    window.open(urls[provider], '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* ── 1. BARRA SUPERIOR MINIMALISTA DE CONEXIÓN IA ── */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-xs border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0 text-indigo-300">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white">
                Auditoría Ejecutiva IA — Resumen Claro, Tiempos Reales y Preguntas de Confrontación
              </h2>
              <p className="text-xs text-slate-400">
                Conecta Claude, ChatGPT o Gemini para obtener un diagnóstico limpio, directo y fácil de entender.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'claude' as const, label: '🟣 Claude' },
                { id: 'chatgpt' as const, label: '🟢 ChatGPT' },
                { id: 'gemini' as const, label: '🔵 Gemini' },
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border flex items-center gap-1.5 ${
                    isSel
                      ? 'bg-white text-slate-900 border-white'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <span>{prov.label}</span>
                  {hasKey && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setKeyInput(apiKeys[activeProvider] || '');
                setShowKeyConfig(!showKeyConfig);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {apiKeys[activeProvider] ? 'API Conectada ✓' : 'Conectar API Key'}
            </button>
          </div>
        </div>

        {showKeyConfig && (
          <div className="mt-3 pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={`Pega tu API Key de ${activeProvider.toUpperCase()}...`}
              className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-indigo-400"
            />
            <button
              type="button"
              onClick={() => handleSaveApiKey(activeProvider, keyInput)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setShowKeyConfig(false)}
              className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>

      {/* ── 2. REPORTE ORGANIZADO EN 4 BLOQUES CLAROS POR COLABORADOR ── */}
      {activeCollaborators.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
          <Sparkles className="w-8 h-8 text-indigo-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-900">
            Selecciona un colaborador arriba para ver su Resumen de Auditoría IA
          </h3>
        </div>
      ) : (
        <div className="space-y-5">
          {activeCollaborators.map((collab) => {
            const report = liveAiReports[collab.userId] || defaultStructuredReports[collab.userId];
            if (!report) return null;
            const isRunning = runningUserId === collab.userId;

            return (
              <div
                key={collab.userId}
                className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden"
              >
                {/* CABECERA LIMPIA DEL COLABORADOR */}
                <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl font-black text-base flex items-center justify-center shrink-0 text-white shadow-xs ${
                        report.verdictStatus === 'danger'
                          ? 'bg-rose-600'
                          : report.verdictStatus === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-emerald-600'
                      }`}
                    >
                      {report.credibilityScore}%
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-extrabold text-slate-900">
                          {collab.userName}
                        </h3>
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                            report.verdictStatus === 'danger'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : report.verdictStatus === 'warning'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {report.verdictTitle}
                        </span>
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                          ✨ {report.sourceLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Período: <strong>{periodLabel}</strong> • {collab.tasksCount} tareas evaluadas
                      </p>
                    </div>
                  </div>

                  {/* Botones de Acción IA */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => handleRunLiveAi(collab)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                    >
                      {isRunning ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}
                      {isRunning
                        ? `Analizando con ${activeProvider.toUpperCase()}...`
                        : `Generar Análisis Profundo con ${activeProvider === 'claude' ? 'Claude' : activeProvider === 'chatgpt' ? 'ChatGPT' : 'Gemini'}`}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenInWebAccount(collab, activeProvider)}
                      className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      title="Copia el resumen limpio y abre tu cuenta web"
                    >
                      <span>Abrir en Web</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* CUERPO ORGANIZADO EN 4 SECCIONES CLARAS Y FÁCILES DE LEER */}
                <div className="p-4 sm:p-5 space-y-5">
                  {/* ── PASO 1: RESUMEN EJECUTIVO CORTO Y CLARO + 3 NÚMEROS CLAVE ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                    {/* Resumen corto en lenguaje sencillo */}
                    <div
                      className={`lg:col-span-7 rounded-2xl p-4 border flex flex-col justify-between ${
                        report.verdictStatus === 'danger'
                          ? 'bg-rose-50/50 border-rose-200'
                          : report.verdictStatus === 'warning'
                          ? 'bg-amber-50/50 border-amber-200'
                          : 'bg-emerald-50/50 border-emerald-200'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                          1. Resumen Corto y Claro del Análisis
                        </span>
                        <p className="text-sm font-medium text-slate-900 leading-relaxed">
                          {report.shortExecutiveSummary}
                        </p>
                      </div>
                    </div>

                    {/* 3 Tarjetas de Números Clave al lado */}
                    <div className="lg:col-span-5 grid grid-cols-3 gap-2.5">
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">
                          Reportó Jornada
                        </span>
                        <span className="text-xl font-black text-slate-900 font-mono mt-1">
                          {report.reportedHours}h
                        </span>
                        <span className="text-[10px] text-slate-500 mt-0.5">
                          En tareas: {report.declaredTaskHours}h
                        </span>
                      </div>

                      <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-indigo-800 uppercase">
                          Debió Tomar (IA)
                        </span>
                        <span className="text-xl font-black text-indigo-950 font-mono mt-1">
                          ~{report.estimatedRealHours}h
                        </span>
                        <span className="text-[10px] text-indigo-700 mt-0.5">
                          Tiempo real justo
                        </span>
                      </div>

                      <div
                        className={`rounded-xl p-3 border flex flex-col justify-center ${
                          report.inflatedOrMissingHours > 0
                            ? 'bg-rose-50 border-rose-200'
                            : 'bg-emerald-50 border-emerald-200'
                        }`}
                      >
                        <span
                          className={`text-[10px] font-bold uppercase ${
                            report.inflatedOrMissingHours > 0 ? 'text-rose-800' : 'text-emerald-800'
                          }`}
                        >
                          Sin Sustento
                        </span>
                        <span
                          className={`text-xl font-black font-mono mt-1 ${
                            report.inflatedOrMissingHours > 0 ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {report.inflatedOrMissingHours}h
                        </span>
                        <span
                          className={`text-[10px] font-semibold mt-0.5 ${
                            report.inflatedOrMissingHours > 0 ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {report.inflatedOrMissingHours > 0 ? 'Falta justificar' : 'Todo cuadrado'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── PASO 2: PREGUNTAS QUE DEBES HACERLE AL COLABORADOR (DESTACADAS Y CLARAS) ── */}
                  <div className="bg-gradient-to-r from-amber-50/90 to-orange-50/50 border border-amber-300/90 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-black text-xs">
                          ?
                        </span>
                        <div>
                          <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                            2. Preguntas Directas para Hacerle a {collab.userName}
                          </h4>
                          <p className="text-[11px] text-slate-600">
                            Úsalas en tu reunión o envíaselas por mensaje para que justifique sus tiempos y entregables.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const text = report.questionsToAsk
                            .map((q, i) => `${i + 1}. ${q}`)
                            .join('\n\n');
                          navigator.clipboard.writeText(text);
                          toast.success('Preguntas copiadas al portapapeles');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copiar todas las preguntas
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {report.questionsToAsk.map((q, idx) => (
                        <div
                          key={idx}
                          className="bg-white border border-amber-200/90 rounded-xl p-3 flex items-start justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
                            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span>“{q}”</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(q);
                              toast.success(`Pregunta #${idx + 1} copiada`);
                            }}
                            className="text-[11px] font-bold text-slate-400 hover:text-slate-800 shrink-0 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer"
                            title="Copiar esta pregunta"
                          >
                            Copiar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── PASO 3: ¿ESTÁ REPORTANDO LO MISMO O TAREAS GENÉRICAS? ── */}
                  <div className="border border-slate-200 rounded-2xl p-4 space-y-2.5 bg-slate-50/40">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Repeat className="w-4 h-4 text-indigo-600" />
                        3. ¿Está reportando siempre lo mismo o el mismo problema?
                      </h4>
                      <span className="text-xs font-semibold text-slate-600">
                        {report.repetitionSummary}
                      </span>
                    </div>

                    {report.repetitionBullets.length === 0 ? (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs font-medium flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        No se encontraron tareas repetidas ni reciclaje del mismo problema en este período.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {report.repetitionBullets.map((bullet, idx) => (
                          <div
                            key={idx}
                            className="bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 flex items-start gap-2 shadow-2xs"
                          >
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <span className="leading-snug">{bullet}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── PASO 4: TABLA SIMPLE TAREA POR TAREA (¿DEBIÓ TOMAR MENOS TIEMPO?) ── */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <SearchCheck className="w-4 h-4 text-indigo-600" />
                      4. Tiempos por Tarea: ¿Cuánto reportó vs. cuánto debió tomar realmente?
                    </h4>

                    {report.taskEvaluations.length === 0 ? (
                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800 font-medium">
                        No registró ninguna tarea o ticket para respaldar sus {report.reportedHours}h de jornada.
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              <th className="py-2.5 px-3">Tarea / Ticket</th>
                              <th className="py-2.5 px-3 text-center">Reportó</th>
                              <th className="py-2.5 px-3 text-center">Debió Tomar (IA)</th>
                              <th className="py-2.5 px-3 text-center">Estado</th>
                              <th className="py-2.5 px-3">Observación Corta</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {report.taskEvaluations.map((item, i) => (
                              <tr key={i} className="hover:bg-slate-50/80">
                                <td className="py-2.5 px-3 font-bold text-slate-900">
                                  <div>{item.title}</div>
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    📅 {item.dateStr} • 📁 {item.projectOrClient}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                                  {item.reportedHours}h
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-extrabold text-indigo-700">
                                  {item.shouldTakeHours}h
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
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
                                <td className="py-2.5 px-3 text-slate-700 text-xs">
                                  {item.shortNote}
                                </td>
                              </tr>
                            ))}
                          </tbody>
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
