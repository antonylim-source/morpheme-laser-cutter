import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { AgeMode } from '../../types/game.types'
import { AGE_TOLERANCE } from '../../constants/gameConfig'

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
            <div className="text-3xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-yellow-300">
              ⚡ Laser Hunter
            </div>
            <div className="mt-2 text-sm text-slate-300">Morpheme Laser Cutter · Compound Word Training</div>
            <div className="mt-4 rounded-xl border border-orange-500/30 bg-orange-950/30 px-4 py-2 text-xs text-orange-200">
              Slice compound monsters before they reach you! Wrong cuts make them grow &amp; speed up.
            </div>

            <div className="mt-6">
              <div className="text-xs font-semibold tracking-widest text-slate-400">AGE MODE (tolerance)</div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <ModeButton
                  active={ageMode === 'young'}
                  label={`Young (±${AGE_TOLERANCE.young}px)`}
                  onClick={() => setAgeMode('young')}
                />
                <ModeButton
                  active={ageMode === 'standard'}
                  label={`Standard (±${AGE_TOLERANCE.standard}px)`}
                  onClick={() => setAgeMode('standard')}
                />
                <ModeButton
                  active={ageMode === 'advanced'}
                  label={`Advanced (±${AGE_TOLERANCE.advanced}px)`}
                  onClick={() => setAgeMode('advanced')}
                />
              </div>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={onStart}
              className={[
                'mt-6 w-full rounded-xl px-4 py-3 text-sm font-extrabold tracking-wide',
                loading
                  ? 'cursor-not-allowed bg-slate-800 text-slate-400'
                  : 'bg-violet-600 text-white hover:bg-violet-500 active:bg-violet-700',
              ].join(' ')}
            >
              {loading ? 'LOADING IMAGES…' : 'START GAME'}
            </button>

            <div className="mt-3 text-xs text-slate-500">
              Tip: SPACE(항상 성공) · H(힌트) · R(리셋)
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function ModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-xl border px-3 py-2 text-xs font-semibold',
        active
          ? 'border-yellow-300/50 bg-yellow-300 text-slate-900'
          : 'border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-800/60',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

