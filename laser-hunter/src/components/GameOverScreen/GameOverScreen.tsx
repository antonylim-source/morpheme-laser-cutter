import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { UI_ICONS } from '../../constants/uiIcons'

const TOTAL_WORDS = 10

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
  const stars = Math.min(3, Math.max(0, Math.floor((wordsCompleted / TOTAL_WORDS) * 3)))
  const [displayScore, setDisplayScore] = useState(0)

  useEffect(() => {
    if (!visible) {
      setDisplayScore(0)
      return
    }
    if (reduce) {
      setDisplayScore(score)
      return
    }
    const start = performance.now()
    const duration = 900
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayScore(Math.round(score * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible, score, reduce])

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center bg-purple-900/55 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.2 : 0.35 }}
        >
          <motion.div
            className="bubble-panel w-[min(520px,92%)] bg-gradient-to-b from-fuchsia-400 to-purple-600 p-6 text-center"
            initial={{ y: 20, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, scale: 0.98, opacity: 0 }}
            transition={{ duration: reduce ? 0.2 : 0.45, ease: 'easeOut' }}
          >
            <motion.img
              src={UI_ICONS.party}
              alt=""
              aria-hidden
              className="mx-auto h-14 w-14 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)]"
              animate={reduce ? {} : { rotate: [-8, 8, -4, 0], scale: [0.8, 1.15, 1] }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
            <div className="font-display mt-2 text-3xl font-extrabold text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.2)]">
              대단해요!
            </div>
            <div className="mt-1 text-base font-semibold text-fuchsia-100">
              괴물 {wordsCompleted}마리 격파 완료!
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <motion.img
                  key={i}
                  src={UI_ICONS.star}
                  alt=""
                  aria-hidden
                  className={[
                    'h-10 w-10 object-contain',
                    i < stars ? '' : 'opacity-30 grayscale',
                  ].join(' ')}
                  initial={reduce ? false : { scale: 0.2, rotate: -30, opacity: 0 }}
                  animate={
                    i < stars
                      ? reduce
                        ? { scale: 1, rotate: 0, opacity: 1 }
                        : { scale: [0.2, 1.4, 1.05], rotate: [-30, 12, 0], opacity: 1 }
                      : { scale: 0.9, opacity: 0.3 }
                  }
                  transition={{
                    delay: reduce ? 0 : 0.25 + i * 0.18,
                    duration: reduce ? 0.2 : 0.5,
                    ease: [0.22, 1.2, 0.36, 1],
                  }}
                />
              ))}
            </div>

            <div className="bubble-panel mt-4 border-white/80 bg-white/20 px-4 py-3">
              <div className="text-sm font-bold text-white/80">총 점수</div>
              <motion.div
                className="font-display text-5xl font-extrabold text-yellow-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
                key={displayScore}
                initial={reduce ? false : { scale: 1.08 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                {displayScore}
              </motion.div>
            </div>

            <motion.button
              type="button"
              onClick={onPlayAgain}
              whileHover={reduce ? {} : { scale: 1.03 }}
              whileTap={reduce ? {} : { scale: 0.97 }}
              className="btn-bounce font-display mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border-[4px] border-white bg-gradient-to-b from-cyan-300 to-sky-500 px-4 py-4 text-xl font-extrabold text-white shadow-[0_6px_0_rgba(0,0,0,0.25)] transition-transform hover:brightness-105"
            >
              <img
                src={UI_ICONS.refresh}
                alt=""
                aria-hidden
                className="h-6 w-6 object-contain"
              />
              다시 도전!
            </motion.button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
