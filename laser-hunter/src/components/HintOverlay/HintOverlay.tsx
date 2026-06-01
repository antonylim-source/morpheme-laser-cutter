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
            {/* Level 1: orange glow border around entire word zone */}
            {level >= 1 ? (
              <motion.div
                className="absolute left-[10%] top-[33%] h-[22%] w-[80%] rounded-3xl border-2 border-orange-400/60"
                animate={
                  reduce
                    ? { opacity: 0.75 }
                    : { opacity: [0.35, 0.8, 0.35] }
                }
                transition={{ duration: 0.65, repeat: reduce ? 0 : Infinity, ease: 'easeInOut' }}
                style={{ boxShadow: '0 0 28px rgba(251, 146, 60, 0.25)' }}
              />
            ) : null}

            {/* Level 2: flashing yellow dots at boundary position */}
            {level >= 2 ? (
              <motion.div
                className="absolute top-[33%] h-[22%] w-6 -translate-x-1/2"
                style={{ left: `${boundaryX01 * 100}%` }}
                animate={reduce ? { opacity: 0.9 } : { opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 0.45, repeat: reduce ? 0 : Infinity, ease: 'easeInOut' }}
              >
                <div className="absolute left-1/2 top-2 h-2 w-2 -translate-x-1/2 rounded-full bg-yellow-300 shadow-[0_0_18px_rgba(250,204,21,0.75)]" />
                <div className="absolute left-1/2 bottom-2 h-2 w-2 -translate-x-1/2 rounded-full bg-yellow-300 shadow-[0_0_18px_rgba(250,204,21,0.75)]" />
              </motion.div>
            ) : null}

            {/* Level 3: boundary line fully visible + "| ← here" text indicator */}
            {level >= 3 ? (
              <div className="absolute inset-0">
                <div
                  className="absolute top-[33%] h-[22%] w-px bg-emerald-300/90 shadow-[0_0_22px_rgba(52,211,153,0.55)]"
                  style={{ left: `${boundaryX01 * 100}%` }}
                />
                <div
                  className="absolute top-[55%] -translate-x-1/2 rounded-full bg-emerald-950/70 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-400/40"
                  style={{ left: `${boundaryX01 * 100}%` }}
                >
                  | ← here
                </div>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Modal overlay for start / hint only (success/fail use canvas + SplitAnimation) */}
      <AnimatePresence>
        {state.status === 'idle' || state.status === 'hint' ? (
          <motion.div
            className="absolute inset-0 z-40 flex items-center justify-center bg-zinc-950/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-[min(520px,92%)] rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 text-center shadow-xl backdrop-blur"
              initial={{ y: 12, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 8, scale: 0.99, opacity: 0 }}
              transition={{ duration: reduce ? 0.25 : 0.45 }}
            >
              <div className="text-sm font-semibold text-zinc-200">
                {state.status === 'hint' ? '정답 힌트' : '준비'}
              </div>

              <div className="mt-2 text-2xl font-extrabold tracking-wide text-zinc-100">
                {state.currentWord.full.toUpperCase()}
              </div>

              <div className="mt-2 text-sm text-zinc-400">
                목표: <span className="font-semibold text-zinc-200">{state.currentWord.morpheme1}</span>
                <span className="mx-2 text-zinc-600">|</span>
                <span className="font-semibold text-zinc-200">{state.currentWord.morpheme2}</span>
              </div>

              {state.status === 'hint' ? (
                <div className="mt-3 text-sm">
                  <div className="font-semibold text-cyan-300">정답 힌트</div>
                  <div className="mt-1 text-sm text-zinc-300">
                    {state.currentWord.morpheme1}
                    <span className="mx-2 text-zinc-500">|</span>
                    {state.currentWord.morpheme2}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={onStart}
                  className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 active:bg-violet-700"
                >
                  {state.status === 'hint' ? '다음' : '시작'}
                </button>
                <div className="text-xs text-zinc-500">화면을 위에서 아래로 베어주세요</div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}

