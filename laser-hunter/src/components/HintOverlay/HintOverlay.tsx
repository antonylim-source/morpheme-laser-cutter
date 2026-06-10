import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { GameState } from '../../types/game.types'

export function HintOverlay({
  state,
  boundaryX01,
  onStart,
}: {
  state: GameState
  /** boundaryPixelX / CANVAS_WIDTH */
  boundaryX01: number
  onStart: () => void
}) {
  const reduce = useReducedMotion()
  const level = Math.min(3, Math.max(0, state.failCount))

  return (
    <>
      {/* In-game hint levels (non-blocking) */}
      <AnimatePresence>
        {state.status === 'playing' && level > 0 ? (
          <motion.div
            key={`hint-${state.currentWord.id}-${level}`}
            className="pointer-events-none absolute inset-0 z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.25 : 0.45 }}
          >
            {level >= 2 ? (
              <motion.div
                className="absolute top-[33%] h-[22%] w-8 -translate-x-1/2"
                style={{ left: `${boundaryX01 * 100}%` }}
                animate={reduce ? { opacity: 0.9 } : { opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 0.45, repeat: reduce ? 0 : Infinity, ease: 'easeInOut' }}
              >
                <div className="absolute left-1/2 top-1 h-3 w-3 -translate-x-1/2 rounded-full bg-yellow-300 shadow-[0_0_20px_rgba(250,204,21,0.9)]" />
                <div className="absolute bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-yellow-300 shadow-[0_0_20px_rgba(250,204,21,0.9)]" />
              </motion.div>
            ) : null}

            {level >= 3 ? (
              <div className="absolute inset-0">
                <div
                  className="absolute top-[33%] h-[22%] w-1 rounded-full bg-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.7)]"
                  style={{ left: `${boundaryX01 * 100}%` }}
                />
                <div
                  className="font-display absolute top-[55%] -translate-x-1/2 rounded-full border-[3px] border-white bg-emerald-500 px-4 py-1.5 text-sm font-extrabold text-white shadow-lg"
                  style={{ left: `${boundaryX01 * 100}%` }}
                >
                  ✂️ 여기를 베어요!
                </div>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Hint modal (3 misses) — start screen is handled by StartScreen */}
      <AnimatePresence>
        {state.status === 'hint' ? (
          <motion.div
            className="absolute inset-0 z-40 flex items-center justify-center bg-sky-900/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bubble-panel w-[min(500px,92%)] bg-gradient-to-b from-indigo-400 to-violet-500 p-5 text-center"
              initial={{ y: 12, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 8, scale: 0.99, opacity: 0 }}
              transition={{ duration: reduce ? 0.25 : 0.45 }}
            >
              <div className="text-3xl">💡</div>
              <div className="font-display mt-1 text-lg font-extrabold text-white">Answer Hint!</div>

              <div className="font-display mt-3 text-3xl font-extrabold tracking-wide text-yellow-200 drop-shadow-md">
                {state.currentWord.full.toUpperCase()}
              </div>

              <div className="mt-3 text-base font-semibold text-indigo-100">
                <span className="rounded-lg bg-white/25 px-2 py-0.5">{state.currentWord.morpheme1}</span>
                <span className="mx-2 text-white/60">+</span>
                <span className="rounded-lg bg-white/25 px-2 py-0.5">{state.currentWord.morpheme2}</span>
              </div>

              <div className="bubble-panel mt-3 border-cyan-200/80 bg-cyan-100/90 px-3 py-2 text-sm font-bold text-cyan-900">
                ✨ Split here: {state.currentWord.morpheme1} | {state.currentWord.morpheme2}
              </div>

              <button
                type="button"
                onClick={onStart}
                className="btn-bounce font-display mt-4 rounded-2xl border-[3px] border-white bg-gradient-to-b from-lime-300 to-green-500 px-8 py-2.5 text-lg font-extrabold text-white shadow-[0_4px_0_rgba(0,0,0,0.2)]"
              >
                Next Monster →
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
