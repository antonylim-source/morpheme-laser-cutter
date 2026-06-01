export function ScoreBoard({
  score,
  streak,
  misses,
}: {
  score: number
  streak: number
  misses: number
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-300">
      <Stat label="SCORE" value={score} />
      <div className="h-4 w-px bg-zinc-800" />
      <Stat label="STREAK" value={streak} />
      <div className="h-4 w-px bg-zinc-800" />
      <Stat label="MISS" value={misses} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <div className="text-[10px] font-semibold tracking-widest text-zinc-500">
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums text-zinc-200">
        {value}
      </div>
    </div>
  )
}

