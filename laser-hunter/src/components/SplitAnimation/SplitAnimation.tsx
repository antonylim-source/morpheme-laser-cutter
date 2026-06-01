import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'
import type { CompoundWord, GameState, MorphemeEffect } from '../../types/game.types'

type Props = {
  word: CompoundWord
  status: GameState['status']
  failCount: number
}

export function SplitAnimation({ word, status, failCount }: Props) {
  const reduce = useReducedMotion() ?? false

  const text = word.full.toUpperCase()
  const cut = clampInt(word.boundaryIndex, 0, text.length)
  const leftText = text.slice(0, cut)
  const rightText = text.slice(cut)

  const sparkles = useMemo(() => {
    return Array.from({ length: 16 }).map((_, i) => ({
      id: i,
      dx: (Math.random() - 0.5) * 180,
      dy: -40 - Math.random() * 140,
      s: 0.6 + Math.random() * 0.9,
      d: 0.45 + Math.random() * 0.25,
    }))
  }, [word.id, status])

  const isSuccess = status === 'success'
  const isFail = status === 'fail'

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <AnimatePresence>
        {isFail ? (
          <motion.div
            key={`fail-${word.id}-${failCount}`}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{
              opacity: reduce ? 0.2 : 0.4,
              x: reduce ? 0 : [0, -12, 12, -8, 8, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.4 : 0.55 }}
            style={{
              background:
                'radial-gradient(60% 50% at 50% 35%, rgba(244,63,94,0.5), rgba(251,146,60,0.15), rgba(0,0,0,0))',
            }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isSuccess ? (
          <motion.div
            key={`success-${word.id}`}
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.3 : 0.45 }}
          >
            <div className="relative">
              {!reduce ? (
                <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2">
                  {sparkles.map((p) => (
                    <motion.span
                      key={p.id}
                      className="absolute block h-1.5 w-1.5 rounded-full bg-yellow-300"
                      initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                      animate={{ opacity: [0, 1, 0], x: p.dx, y: p.dy, scale: [0.6, p.s, 0.2] }}
                      transition={{ duration: p.d, ease: 'easeOut' }}
                      style={{ boxShadow: '0 0 14px rgba(250, 204, 21, 0.9)' }}
                    />
                  ))}
                </div>
              ) : null}

              <motion.div
                className="mb-2 text-center text-sm font-bold tracking-widest text-cyan-300"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                Slice! {word.morpheme1}! {word.morpheme2}! → {word.full}
              </motion.div>

              <div className="flex items-center justify-center gap-4">
                <motion.div
                  className="rounded-2xl border-2 border-emerald-400/50 bg-slate-950/80 px-5 py-3 text-3xl font-black tracking-wider text-emerald-100 shadow-[0_0_30px_rgba(52,211,153,0.25)] backdrop-blur"
                  initial={{ x: 0, rotate: 0 }}
                  animate={{ x: reduce ? -28 : -90, rotate: reduce ? 0 : -4 }}
                  transition={{ duration: reduce ? 0.35 : 0.6, ease: 'easeOut' }}
                >
                  {leftText || '\u00A0'}
                </motion.div>

                <motion.div
                  className="text-2xl font-bold text-yellow-300"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  |
                </motion.div>

                <motion.div
                  className="rounded-2xl border-2 border-emerald-400/50 bg-slate-950/80 px-5 py-3 text-3xl font-black tracking-wider text-emerald-100 shadow-[0_0_30px_rgba(52,211,153,0.25)] backdrop-blur"
                  initial={{ x: 0, rotate: 0 }}
                  animate={{ x: reduce ? 28 : 90, rotate: reduce ? 0 : 4 }}
                  transition={{ duration: reduce ? 0.35 : 0.6, ease: 'easeOut' }}
                >
                  {rightText || '\u00A0'}
                </motion.div>
              </div>

              <div className="mt-5 flex items-center justify-center gap-8">
                <MorphemeImage
                  src={word.image1}
                  label={word.morpheme1}
                  effect={word.effect1 ?? 'none'}
                  reduce={reduce}
                  delay={0.12}
                />
                <MorphemeImage
                  src={word.image2}
                  label={word.morpheme2}
                  effect={word.effect2 ?? 'none'}
                  reduce={reduce}
                  delay={0.2}
                />
              </div>

              <motion.div
                className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-12 text-4xl font-extrabold text-yellow-300"
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: reduce ? -10 : -32, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0.35 : 0.65, ease: 'easeOut' }}
                style={{ textShadow: '0 0 22px rgba(250, 204, 21, 0.7)' }}
              >
                +100
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function MorphemeImage({
  src,
  label,
  effect,
  reduce,
  delay,
}: {
  src: string
  label: string
  effect: MorphemeEffect
  reduce: boolean
  delay: number
}) {
  const spinAnim = reduce ? {} : { rotate: 360 }
  const shakeAnim = reduce ? {} : { x: [0, -6, 6, -5, 5, -3, 3, 0], y: [0, 2, -2, 2, -2, 1, -1, 0] }
  const pulseAnim = reduce ? {} : { scale: [1, 1.12, 1] }

  const effectAnim =
    effect === 'spin'
      ? spinAnim
      : effect === 'shake'
        ? shakeAnim
        : effect === 'pulse'
          ? pulseAnim
          : {}

  const effectTransition =
    effect === 'spin'
      ? { duration: 2.2, repeat: Infinity, ease: 'linear' as const, delay }
      : effect === 'shake'
        ? { duration: 0.55, repeat: Infinity, repeatDelay: 0.35, delay }
        : effect === 'pulse'
          ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' as const, delay }
          : { duration: 0.55, delay }

  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      initial={{ opacity: 0, scale: 0.85, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: reduce ? 0.25 : 0.55, delay, ease: 'easeOut' }}
    >
      <motion.div
        className="relative h-24 w-24 overflow-hidden rounded-2xl border-2 border-yellow-400/40 bg-slate-900/80 shadow-lg"
        animate={effectAnim}
        transition={effectTransition}
        style={{ boxShadow: '0 0 28px rgba(250, 204, 21, 0.2)' }}
      >
        <img src={src} alt={label} className="h-full w-full object-contain p-2" />
        {effect === 'shake' ? (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-2xl border border-rose-400/30"
            animate={reduce ? {} : { opacity: [0.2, 0.7, 0.2] }}
            transition={{ duration: 0.4, repeat: Infinity }}
          />
        ) : null}
      </motion.div>
      <div className="text-sm font-bold tracking-wide text-yellow-100">{label}</div>
    </motion.div>
  )
}

function clampInt(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}
