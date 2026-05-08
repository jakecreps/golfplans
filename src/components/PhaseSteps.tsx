'use client';

import { useRouter } from 'next/navigation';
import { Phase } from '@/lib/types';

const STEPS: { phase: Phase; label: string }[] = [
  { phase: 'collecting', label: '1 Preferences' },
  { phase: 'voting',     label: '2 Voting' },
  { phase: 'results',    label: '3 Results' },
];

const ORDER: Phase[] = ['collecting', 'voting', 'results'];

interface Props {
  currentPhase: Phase;
  planId: string;
  token?: string | null;
}

export default function PhaseSteps({ currentPhase, planId, token }: Props) {
  const router = useRouter();
  const currentIdx = ORDER.indexOf(currentPhase);

  function handleClick(phase: Phase) {
    const idx = ORDER.indexOf(phase);
    if (idx >= currentIdx) return; // can't jump to future or re-click current
    if (phase === 'collecting') {
      if (token) router.push(`/plans/${planId}/manage/${token}`);
      else router.push(`/${planId}`);
    } else {
      router.push(`/plans/${planId}/summary${token ? `?token=${token}` : ''}`);
    }
  }

  // From the manage page, let completed/current phases navigate forward to summary
  function handleManageClick(phase: Phase) {
    const idx = ORDER.indexOf(phase);
    if (idx > currentIdx) return; // future — locked
    if (phase === 'collecting') return; // already on manage page
    router.push(`/plans/${planId}/summary${token ? `?token=${token}` : ''}`);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {STEPS.map((step, i) => {
        const idx = ORDER.indexOf(step.phase);
        const isActive = step.phase === currentPhase;
        const isCompleted = idx < currentIdx;
        const isFuture = idx > currentIdx;

        return (
          <div key={step.phase} className="flex items-center gap-2">
            {i > 0 && <div className="h-px w-5 bg-gray-300 flex-shrink-0" />}
            <button
              onClick={() => handleClick(step.phase)}
              disabled={isActive || isFuture}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                isActive
                  ? 'bg-green-600 text-white shadow-sm'
                  : isCompleted
                    ? 'bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer'
                    : 'bg-gray-100 text-gray-400 cursor-default'
              }`}
            >
              {step.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Variant for the manage page where forward navigation (to summary) is also allowed
export function ManagePhaseSteps({ currentPhase, planId, token }: Props) {
  const router = useRouter();
  const currentIdx = ORDER.indexOf(currentPhase);

  function handleClick(phase: Phase) {
    const idx = ORDER.indexOf(phase);
    if (idx > currentIdx) return; // future — locked
    if (phase === 'collecting') return; // already on manage page
    router.push(`/plans/${planId}/summary${token ? `?token=${token}` : ''}`);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {STEPS.map((step, i) => {
        const idx = ORDER.indexOf(step.phase);
        const isActive = step.phase === currentPhase;
        const isCompleted = idx < currentIdx;
        const isFuture = idx > currentIdx;
        const isClickable = !isFuture && idx > 0; // collecting = already here; others = navigate to summary

        return (
          <div key={step.phase} className="flex items-center gap-2">
            {i > 0 && <div className="h-px w-5 bg-gray-300 flex-shrink-0" />}
            <button
              onClick={() => handleClick(step.phase)}
              disabled={!isClickable}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                isActive
                  ? 'bg-green-600 text-white shadow-sm'
                  : isCompleted
                    ? 'bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer'
                    : isFuture
                      ? 'bg-gray-100 text-gray-400 cursor-default'
                      : 'bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer'
              }`}
            >
              {step.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
