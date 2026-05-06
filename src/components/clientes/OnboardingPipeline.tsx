import type { ClientPipelineStage } from '../../types/clients';
import { CheckCircle2, Clock } from 'lucide-react';
import { format, differenceInDays, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  stages: ClientPipelineStage[];
  currentStageId: string | null;
  completedStageIds?: string[];
  stageHistory?: { stage_id: string; entered_at: string; exited_at: string | null }[];
  compact?: boolean;
}

export default function OnboardingPipeline({ stages, currentStageId, completedStageIds = [], stageHistory = [], compact = false }: Props) {
  const sorted = [...stages].sort((a, b) => a.orden - b.orden);

  return (
    <div className="flex items-start gap-0 w-full">
      {sorted.map((stage, idx) => {
        const isDone = completedStageIds.includes(stage.id);
        const isCurrent = stage.id === currentStageId && !isDone;
        const isLast = idx === sorted.length - 1;

        return (
          <div key={stage.id} className="flex items-start flex-1 min-w-0">
            {/* Step node + label */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className={`flex items-center justify-center rounded-full transition-all ${
                compact ? 'w-5 h-5' : 'w-7 h-7'
              } ${
                isDone
                  ? 'bg-emerald-500'
                  : isCurrent
                  ? 'bg-[#4449AA] ring-2 ring-[#4449AA]/30 ring-offset-1'
                  : 'bg-gray-200'
              }`}>
                {isDone && <CheckCircle2 className={compact ? 'w-2.5 h-2.5 text-white' : 'w-4 h-4 text-white'} />}
                {isCurrent && <div className={`rounded-full bg-white ${compact ? 'w-1.5 h-1.5' : 'w-2 h-2'}`} />}
              </div>

              <span className={`text-center leading-tight font-semibold ${
                compact ? 'text-[10px] max-w-[52px]' : 'text-[10px] max-w-[60px]'
              } ${
                isDone ? 'text-emerald-600' : isCurrent ? 'text-[#4449AA]' : 'text-gray-400'
              }`}>
                {stage.nombre}
              </span>

              {/* Date / Duration metrics */}
              {(() => {
                const historyRecord = stageHistory.find(h => h.stage_id === stage.id);
                if (!historyRecord) return null;

                if (isCurrent && historyRecord.entered_at) {
                  // How long has it been here?
                  const enteredDate = new Date(historyRecord.entered_at);
                  const days = differenceInDays(new Date(), enteredDate);
                  const hours = differenceInHours(new Date(), enteredDate);
                  
                  let durationText = `${days} d`;
                  if (days === 0) {
                     durationText = hours > 0 ? `${hours} h` : '< 1 h';
                  }

                  return (
                    <div className="flex items-center gap-0.5 mt-0.5 text-[9px] font-black text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-full" title={`Ingresó el: ${format(enteredDate, 'dd MMM', { locale: es })}`}>
                      <Clock className="w-2.5 h-2.5" />
                      {durationText}
                    </div>
                  );
                }

                if (isDone && historyRecord.exited_at) {
                  // Show the date it was completed
                  const exitedDate = new Date(historyRecord.exited_at);
                  return (
                    <div className="mt-0.5 text-[8.5px] font-bold text-gray-400 tracking-tight uppercase">
                      {format(exitedDate, 'dd MMM', { locale: es })}
                    </div>
                  );
                }

                return null;
              })()}
            </div>

            {/* Connector line aligned to dot top */}
            {!isLast && (
              <div className={`flex-1 mx-0.5 rounded-full mt-2 ${compact ? 'h-px' : 'h-0.5'} ${
                isDone ? 'bg-emerald-400' : 'bg-gray-200'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
