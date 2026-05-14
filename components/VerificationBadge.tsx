import type { ConfidenceLevel, VerificationStatus } from '@/lib/types';

const CONFIDENCE_CONFIG: Record<ConfidenceLevel, { label: string; className: string }> = {
  high: { label: 'High', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  medium: { label: 'Medium', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  low: { label: 'Low', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  unknown: { label: 'Unknown', className: 'bg-stone-100 text-stone-600 border-stone-200' },
};

const STATUS_CONFIG: Record<VerificationStatus, { label: string; className: string; symbol: string }> = {
  candidate: { label: 'Candidate', className: 'bg-sky-100 text-sky-800 border-sky-200', symbol: '◦' },
  needs_review: { label: 'Needs Review', className: 'bg-amber-100 text-amber-800 border-amber-200', symbol: '?' },
  checked: { label: 'Checked', className: 'bg-blue-100 text-blue-800 border-blue-200', symbol: '✓' },
  approved_public: { label: 'Approved', className: 'bg-emerald-100 text-emerald-800 border-emerald-200', symbol: '✓' },
  approved_private: { label: 'Private', className: 'bg-purple-100 text-purple-800 border-purple-200', symbol: '🔒' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800 border-red-200', symbol: '✗' },
  duplicate: { label: 'Duplicate', className: 'bg-stone-100 text-stone-600 border-stone-200', symbol: '≡' },
};

interface VerificationBadgeProps {
  confidence: ConfidenceLevel;
  status: VerificationStatus;
  compact?: boolean;
}

export default function VerificationBadge({ confidence, status, compact = false }: VerificationBadgeProps) {
  const c = CONFIDENCE_CONFIG[confidence] ?? CONFIDENCE_CONFIG.unknown;
  const s = STATUS_CONFIG[status] ?? STATUS_CONFIG.candidate;

  if (compact) {
    return (
      <span className="inline-flex gap-1 items-center">
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border ${c.className}`}>
          {c.label}
        </span>
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border ${s.className}`}>
          {s.symbol} {s.label}
        </span>
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${c.className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" aria-hidden="true" />
        Confidence: {c.label}
      </span>
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${s.className}`}>
        <span aria-hidden="true">{s.symbol}</span>
        {s.label}
      </span>
    </div>
  );
}
