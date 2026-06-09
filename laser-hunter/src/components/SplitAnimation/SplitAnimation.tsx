import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { CompoundWord, GameState, MorphemeEffect } from '../../types/game.types'

type Props = {
  word: CompoundWord
  status: GameState['status']
  failCount: number
}

export function SplitAnimation({ word, status, failCount }: Props) {
  const reduce = useReducedMotion() ?? false

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
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.3 : 0.45 }}
          >
            <motion.div
              className="pointer-events-none absolute left-1/2 top-[14%] -translate-x-1/2 text-3xl font-extrabold text-yellow-300/90"
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: reduce ? -4 : -14, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: reduce ? 0.2 : 0.12, duration: reduce ? 0.35 : 0.5, ease: 'easeOut' }}
              style={{ textShadow: '0 0 18px rgba(250, 204, 21, 0.55)' }}
            >
              +100
            </motion.div>

            <motion.div
              className="absolute inset-x-0 bottom-[4.5rem] flex justify-center px-3 pb-2"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0.55 : 0.95, duration: reduce ? 0.3 : 0.5 }}
            >
              <div className="bubble-panel w-full max-w-lg bg-slate-950/90 px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md">
                <motion.div
                  className="font-display mb-3 text-center text-sm font-extrabold leading-snug text-white sm:text-base"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduce ? 0.6 : 1.02 }}
                >
                  <span className="text-cyan-300">Slice!</span>
                  <span className="mx-1.5 text-white/50">→</span>
                  <span className="rounded-lg bg-white/15 px-2 py-0.5 tracking-wide text-amber-200">
                    {word.full}
                  </span>
                </motion.div>

                <div className="flex items-end justify-center gap-3 sm:gap-5">
                  <MorphemeImage
                    src={word.image1}
                    label={word.morpheme1}
                    effect={word.effect1 ?? 'none'}
                    reduce={reduce}
                    delay={reduce ? 0.65 : 1.08}
                  />
                  <span
                    aria-hidden
                    className="font-display mb-11 text-2xl font-extrabold text-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] sm:mb-12 sm:text-3xl"
                  >
                    +
                  </span>
                  <MorphemeImage
                    src={word.image2}
                    label={word.morpheme2}
                    effect={word.effect2 ?? 'none'}
                    reduce={reduce}
                    delay={reduce ? 0.72 : 1.16}
                  />
                </div>
              </div>
            </motion.div>
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
      className="flex w-[7.25rem] flex-col items-center gap-2 sm:w-[8rem]"
      initial={{ opacity: 0, scale: 0.88, y: 14 }}
      animate={{ opacity: 1, scale: reduce ? 1 : [0.88, 1.06, 1], y: 0 }}
      transition={{ duration: reduce ? 0.25 : 0.55, delay, ease: 'easeOut' }}
    >
      <motion.div
        className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border-[3px] border-white bg-gradient-to-b from-white to-amber-50 shadow-[inset_0_2px_10px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.25)] sm:h-32 sm:w-32"
        animate={effectAnim}
        transition={effectTransition}
      >
        <img
          src={src}
          alt=""
          aria-hidden
          className="h-[80%] w-[80%] object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.18)]"
        />
        {effect === 'shake' ? (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-rose-400/40"
            animate={reduce ? {} : { opacity: [0.2, 0.7, 0.2] }}
            transition={{ duration: 0.4, repeat: Infinity }}
          />
        ) : null}
      </motion.div>
      <div className="font-display w-full rounded-xl border-2 border-white/90 bg-slate-800 px-2 py-1.5 text-center text-sm font-extrabold leading-tight tracking-wide text-white shadow-[0_3px_0_rgba(0,0,0,0.2)] sm:text-base">
        {label}
      </div>
    </motion.div>
  )
}
