import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { AgeMode } from '../../types/game.types'
import { UI_ICONS } from '../../constants/uiIcons'
import { publicAsset } from '../../utils/publicAsset'

const AGE_OPTIONS: Record<AgeMode, { icon: string; label: string; hint: string }> = {
  young: { icon: UI_ICONS.chick, label: 'Easy', hint: 'Wide slice' },
  standard: { icon: UI_ICONS.lightning, label: 'Normal', hint: 'Standard' },
  advanced: { icon: UI_ICONS.fire, label: 'Hard', hint: 'Precise' },
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
          role="dialog"
          aria-modal="true"
          aria-labelledby="start-screen-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.2 : 0.35 }}
        >
          <motion.div
            className="bubble-panel w-[min(520px,92%)] bg-gradient-to-b from-sky-400 to-blue-500 p-6 text-center sm:p-7"
            initial={{ y: 20, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, scale: 0.98, opacity: 0 }}
            transition={{ duration: reduce ? 0.2 : 0.45, ease: 'easeOut' }}
          >
            <img
              src={publicAsset('images/title_log.png')}
              alt="Morpheme Laser Cutter"
              className="mx-auto h-24 w-auto object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)] sm:h-28"
            />
            <p
              id="start-screen-title"
              className="mt-3 text-lg font-bold leading-snug text-white drop-shadow-sm sm:text-xl"
            >
              Slice compound word monsters with your laser!
            </p>

            <div className="bubble-panel mt-4 flex items-start gap-3 border-amber-200/80 bg-gradient-to-r from-amber-100 to-yellow-100 px-5 py-3 text-left text-base font-bold leading-relaxed text-amber-900">
              <img
                src={UI_ICONS.target}
                alt=""
                aria-hidden
                className="mt-0.5 h-7 w-7 shrink-0 object-contain"
              />
              <span>
                Slice the{' '}
                <span className="text-lg font-extrabold text-orange-600">middle</span> of the word —
                wrong cuts make the monster bigger!
              </span>
            </div>

            <div className="mt-5">
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/70">
                Pick your level
              </p>
              <div className="mt-2.5 flex flex-wrap items-stretch justify-center gap-2.5">
                {(['young', 'standard', 'advanced'] as AgeMode[]).map((mode) => {
                  const { icon, label, hint } = AGE_OPTIONS[mode]
                  const active = ageMode === mode
                  return (
                    <motion.button
                      key={mode}
                      type="button"
                      onClick={() => setAgeMode(mode)}
                      aria-pressed={active}
                      whileTap={reduce ? {} : { scale: 0.95 }}
                      className={[
                        'flex min-w-[108px] flex-col items-center rounded-2xl border-[3px] px-3 py-3 transition-transform',
                        active
                          ? 'scale-105 border-white bg-yellow-300 text-amber-900 shadow-[0_4px_0_rgba(0,0,0,0.2)]'
                          : 'border-white/60 bg-white/25 text-white hover:bg-white/40',
                      ].join(' ')}
                    >
                      <span className="flex items-center gap-1.5 text-base font-extrabold">
                        <img
                          src={icon}
                          alt=""
                          aria-hidden
                          className="h-6 w-6 object-contain"
                        />
                        {label}
                      </span>
                      <span
                        className={[
                          'mt-1 text-xs font-medium',
                          active ? 'text-amber-800/80' : 'text-white/60',
                        ].join(' ')}
                      >
                        {hint}
                      </span>
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
                'btn-bounce font-display mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl border-[4px] border-white px-4 py-5 text-2xl font-extrabold tracking-wide shadow-[0_6px_0_rgba(0,0,0,0.25)] transition-transform',
                loading
                  ? 'cursor-not-allowed bg-slate-300 text-slate-500'
                  : 'bg-gradient-to-b from-lime-300 to-green-500 text-white hover:brightness-105 active:brightness-95',
              ].join(' ')}
            >
              <img
                src={loading ? UI_ICONS.hourglass : UI_ICONS.rocket}
                alt=""
                aria-hidden
                className="h-7 w-7 object-contain"
              />
              {loading ? 'Loading…' : 'Start!'}
            </motion.button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
