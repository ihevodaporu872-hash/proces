interface ProgressCellProps {
  total: number
  delivered: number
  used: number
}

export default function ProgressCell({ total, delivered, used }: ProgressCellProps) {
  if (total <= 0) return <span className="text-xs text-gray-400">—</span>

  const pctUsed = Math.min(Math.round((used / total) * 100), 100)
  const pctDelivered = Math.min(Math.round((delivered / total) * 100), 100)
  const pctDeliveredOnly = Math.max(pctDelivered - pctUsed, 0)

  return (
    <div className="min-w-[180px]">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-6 bg-gray-200 rounded overflow-hidden relative flex">
          {pctUsed > 0 && (
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${pctUsed}%` }}
            />
          )}
          {pctDeliveredOnly > 0 && (
            <div
              className="h-full bg-blue-400 transition-all duration-300"
              style={{ width: `${pctDeliveredOnly}%` }}
            />
          )}
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
            {used} / {delivered} / {total}
          </span>
        </div>
      </div>
      <div className="flex gap-3 mt-1 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" />
          исп.
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-blue-400" />
          пост.
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-gray-200" />
          остаток
        </span>
      </div>
    </div>
  )
}
