import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { UI_ICONS } from '../../constants/uiIcons'

export function ScoreBoard({
  score,
  combo,
  misses,
}: {
  score: number
  combo: number
  misses: number
}) {
  const reduce = useReducedMotion() ?? false
  const [scorePop, setScorePop] = useState(false)
  const [comboPop, setComboPop] = useState(false)
  const [missPop, setMissPop] = useState(false)
  const prevScoreRef = useRef(score)
  const prevComboRef = useRef(combo)
  const prevMissesRef = useRef(misses)

  useEffect(() => {
    if (score !== prevScoreRef.current) {
      setScorePop(true)
      prevScoreRef.current = score
      const t = window.setTimeout(() => setScorePop(false), 500)
      return () => window.clearTimeout(t)
    }
  }, [score])

  useEffect(() => {
    if (combo > prevComboRef.current && combo >= 1) {
      setComboPop(true)
      prevComboRef.current = combo
      const t = window.setTimeout(() => setComboPop(false), 450)
      return () => window.clearTimeout(t)
    }
    prevComboRef.current = combo
  }, [combo])

  useEffect(() => {
    if (misses > prevMissesRef.current) {
      setMissPop(true)
      prevMissesRef.current = misses
      const t = window.setTimeout(() => setMissPop(false), 420)
      return () => window.clearTimeout(t)
    }
    prevMissesRef.current = misses
  }, [misses])

  return (
    <div className="flex items-center gap-2">
      <Badge
        icon={UI_ICONS.star}
        label="Score"
        value={score}
        color="from-amber-300 to-yellow-400"
        pop={scorePop}
        reduce={reduce}
      />
      <Badge
        icon={UI_ICONS.fire}
        label="Combo"
        value={combo}
        color="from-orange-400 to-red-400"
        highlight={combo >= 2}
        pop={comboPop}
        reduce={reduce}
      />
      <Badge
        icon={UI_ICONS.explosion}
        label="Miss"
        value={misses}
        color="from-pink-400 to-rose-400"
        pop={missPop}
        reduce={reduce}
      />
    </div>
  )
}

function Badge({
  icon,
  label,
  value,
  color,
  highlight = false,
  pop = false,
  reduce = false,
}: {
  icon: string
  label: string
  value: number
  color: string
  highlight?: boolean
  pop?: boolean
  reduce?: boolean
}) {
  return (
    <motion.div
      className={[
        'bubble-panel flex min-w-[72px] flex-col items-center bg-gradient-to-b px-3 py-1.5',
        color,
        highlight && !pop ? 'animate-wiggle' : '',
      ].join(' ')}
      animate={
        pop && !reduce
          ? { scale: [1, 1.14, 1], y: [0, -4, 0] }
          : { scale: 1, y: 0 }
      }
      transition={{ duration: 0.42, ease: [0.22, 1.2, 0.36, 1] }}
    >
      <img
        src={icon}
        alt=""
        aria-hidden
        className="h-5 w-5 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
      />
      <span className="text-[10px] font-bold text-white/90 drop-shadow-sm">{label}</span>
      <motion.span
        key={value}
        className="text-base font-extrabold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
        initial={pop && !reduce ? { scale: 0.5, opacity: 0.4 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: reduce ? 0.15 : 0.35, ease: 'easeOut' }}
      >
        {value}
      </motion.span>
    </motion.div>
  )
}
