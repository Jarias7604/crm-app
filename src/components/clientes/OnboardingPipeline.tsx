import type { ClientPipelineStage } from '../../types/clients';
import { CheckCircle2 } from 'lucide-react';

interface Props {
  stages: ClientPipelineStage[];
  currentStageId: string | null;
  completedStageIds?: string[];
  compact?: boolean;
}

export default function OnboardingPipeline({ stages, currentStageId, completedStageIds = [], compact = false }: Props) {
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

              {/* Label — always visible, adapts size */}
              <span className={`text-center leading-tight font-semibold ${
                compact ? 'text-[10px] max-w-[52px]' : 'text-[10px] max-w-[60px]'
              } ${
                isDone ? 'text-emerald-600' : isCurrent ? 'text-[#4449AA]' : 'text-gray-400'
              }`}>
                {stage.nombre}
              </span>
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
