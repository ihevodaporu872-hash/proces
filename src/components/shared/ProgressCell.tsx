interface ProgressCellProps {
  current: number
  total: number
  unit?: string
  label?: string
}

function getBarColor(percent: number): string {
  if (percent <= 0) return 'bg-gray-300'
  if (percent < 25) return 'bg-red-500'
  if (percent < 50) return 'bg-orange-500'
  if (percent < 75) return 'bg-yellow-500'
  if (percent < 100) return 'bg-blue-500'
  return 'bg-emerald-500'
}

export default function ProgressCell({ current, total, unit, label }: ProgressCellProps) {
  const percent = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0

  return (
    <div className="min-w-[140px]">
      {label && (
        <div className="text-[10px] text-gray-400 mb-0.5">{label}</div>
      )}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
          <div
            className={`h-full rounded-full transition-all duration-300 ${getBarColor(percent)}`}
            style={{ width: `${percent}%` }}
          />
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-gray-700 mix-blend-multiply">
            {current}{unit ? ` ${unit}` : ''} / {total}{unit ? ` ${unit}` : ''}
          </span>
        </div>
        <span className="text-xs font-medium text-gray-500 w-9 text-right">{percent}%</span>
      </div>
    </div>
  )
}
