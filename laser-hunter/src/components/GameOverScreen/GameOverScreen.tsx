import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

export function GameOverScreen({
  visible,
  score,
  wordsCompleted,
  onPlayAgain,
}: {
  visible: boolean
  score: number
  wordsCompleted: number
  onPlayAgain: () => void
}) {
  const reduce = useReducedMotion() ?? false

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.2 : 0.35 }}
        >
          <motion.div
            className="w-[min(560px,92%)] rounded-2xl border border-slate-800 bg-slate-950/80 p-6 text-center shadow-xl"
            initial={{ y: 14, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 8, scale: 0.99, opacity: 0 }}
            transition={{ duration: reduce ? 0.2 : 0.45, ease: 'easeOut' }}
          >
            <div className="text-sm font-semibold tracking-widest text-slate-300">GAME OVER</div>
            <div className="mt-3 text-5xl font-extrabold text-yellow-300">{score}</div>
            <div className="mt-2 text-sm text-slate-400">{wordsCompleted} words completed</div>

            <button
              type="button"
              onClick={onPlayAgain}
              className="mt-6 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-extrabold tracking-wide text-white hover:bg-violet-500 active:bg-violet-700"
            >
              PLAY AGAIN
            </button>
            <div className="mt-3 text-xs text-slate-500">Shortcut: R</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

