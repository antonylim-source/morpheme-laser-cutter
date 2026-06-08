import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { AgeMode } from '../../types/game.types'

const AGE_LABELS: Record<AgeMode, { emoji: string; label: string }> = {
  young: { emoji: '🐣', label: 'Easy' },
  standard: { emoji: '⚡', label: 'Normal' },
  advanced: { emoji: '🔥', label: 'Hard' },
}

export function StartScreen({
  visible,
  ageMode,
  setAgeMode,
  loading,
  onStart,
}: {
  visible: boolean
  ageMode: AgeMode
  setAgeMode: (m: AgeMode) => void
  loading: boolean
  onStart: () => void
}) {
  const reduce = useReducedMotion() ?? false

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center bg-sky-900/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.2 : 0.35 }}
        >
          <motion.div
            className="bubble-panel w-[min(520px,92%)] bg-gradient-to-b from-sky-400 to-blue-500 p-6 text-center"
            initial={{ y: 20, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, scale: 0.98, opacity: 0 }}
            transition={{ duration: reduce ? 0.2 : 0.45, ease: 'easeOut' }}
          >
            <div className="animate-float text-6xl">👾</div>
            <div className="font-display mt-2 text-4xl font-extrabold text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.2)]">
              Laser Hunter
            </div>
            <div className="mt-2 text-base font-semibold text-sky-100">
              Slice compound word monsters with your laser!
            </div>

            <div className="bubble-panel mt-4 border-amber-200/80 bg-gradient-to-r from-amber-100 to-yellow-100 px-4 py-3 text-sm font-bold text-amber-900">
              🎯 Slice the <span className="text-orange-600">middle</span> of the word from top to bottom!
              <br />
              ❌ Wrong cuts make the monster bigger and faster!
            </div>

            <div className="mt-5">
              <div className="text-sm font-bold text-white/90">Pick your level</div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {(['young', 'standard', 'advanced'] as AgeMode[]).map((mode) => {
                  const { emoji, label } = AGE_LABELS[mode]
                  const active = ageMode === mode
                  return (
                    <motion.button
                      key={mode}
                      type="button"
                      onClick={() => setAgeMode(mode)}
                      whileTap={reduce ? {} : { scale: 0.95 }}
                      className={[
                        'rounded-2xl border-[3px] px-4 py-2 text-sm font-extrabold transition-transform',
                        active
                          ? 'border-white bg-yellow-300 text-amber-900 shadow-[0_4px_0_rgba(0,0,0,0.2)] scale-105'
                          : 'border-white/60 bg-white/25 text-white hover:bg-white/40',
                      ].join(' ')}
                    >
                      {emoji} {label}
                    </motion.button>
                  )
                })}
              </div>
            </div>

            <motion.button
              type="button"
              disabled={loading}
              onClick={onStart}
              whileHover={loading || reduce ? {} : { scale: 1.04 }}
              whileTap={loading ? {} : { scale: 0.97 }}
              className={[
                'btn-bounce font-display mt-6 w-full rounded-2xl border-[4px] border-white px-4 py-4 text-xl font-extrabold tracking-wide shadow-[0_6px_0_rgba(0,0,0,0.25)] transition-transform',
                loading
                  ? 'cursor-not-allowed bg-slate-300 text-slate-500'
                  : 'bg-gradient-to-b from-lime-300 to-green-500 text-white hover:brightness-105 active:brightness-95',
              ].join(' ')}
            >
              {loading ? '⏳ Loading…' : '🚀 Start!'}
            </motion.button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
