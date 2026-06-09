import { useEffect, useRef } from 'react'

export function ScoreBoard({
  score,
  combo,
  misses,
}: {
  score: number
  combo: number
  misses: number
}) {
  const prevScoreRef = useRef(score)
  const scorePopRef = useRef(false)

  useEffect(() => {
    if (score !== prevScoreRef.current) {
      scorePopRef.current = true
      prevScoreRef.current = score
      const t = window.setTimeout(() => {
        scorePopRef.current = false
      }, 500)
      return () => window.clearTimeout(t)
    }
  }, [score])

  return (
    <div className="flex items-center gap-2">
      <Badge
        emoji="⭐"
        label="Score"
        value={score}
        color="from-amber-300 to-yellow-400"
        pop={scorePopRef.current}
      />
      <Badge
        emoji="🔥"
        label="Combo"
        value={combo}
        color="from-orange-400 to-red-400"
        highlight={combo >= 2}
      />
      <Badge emoji="💥" label="Miss" value={misses} color="from-pink-400 to-rose-400" />
    </div>
  )
}

function Badge({
  emoji,
  label,
  value,
  color,
  highlight = false,
  pop = false,
}: {
  emoji: string
  label: string
  value: number
  color: string
  highlight?: boolean
  pop?: boolean
}) {
  return (
    <div
      className={[
        'bubble-panel flex min-w-[72px] flex-col items-center bg-gradient-to-b px-3 py-1.5',
        color,
        highlight ? 'animate-wiggle' : '',
      ].join(' ')}
    >
      <span className="text-lg leading-none">{emoji}</span>
      <span className="text-[10px] font-bold text-white/90 drop-shadow-sm">{label}</span>
      <span
        key={pop ? `pop-${value}` : value}
        className={[
          'text-base font-extrabold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]',
          pop ? 'animate-score-pop' : '',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  )
}
