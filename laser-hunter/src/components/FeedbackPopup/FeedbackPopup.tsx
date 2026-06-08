import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

export type FeedbackKind = 'slice' | 'great' | 'super' | 'oops' | 'boom'

const MESSAGES: Record<FeedbackKind, { text: string; emoji: string; className: string }> = {
  slice: { text: 'SLICE!', emoji: '⚡', className: 'from-cyan-300 to-yellow-300' },
  great: { text: 'GREAT!', emoji: '🌟', className: 'from-lime-300 to-emerald-400' },
  super: { text: 'SUPER!', emoji: '🔥', className: 'from-orange-300 to-rose-400' },
  oops: { text: 'Oops!', emoji: '💥', className: 'from-rose-300 to-orange-400' },
  boom: { text: 'BOOM!', emoji: '👹', className: 'from-red-400 to-amber-400' },
}

export function FeedbackPopup({
  kind,
  triggerKey,
}: {
  kind: FeedbackKind | null
  triggerKey: number
}) {
  const reduce = useReducedMotion() ?? false
  const msg = kind ? MESSAGES[kind] : null

  return (
    <div className="pointer-events-none absolute inset-0 z-[45] flex items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        {msg ? (
          <motion.div
            key={`${kind}-${triggerKey}`}
            className="relative flex flex-col items-center"
            initial={{ opacity: 0, scale: reduce ? 1 : 0.2, y: reduce ? 0 : 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: reduce ? 1 : 1.25, y: reduce ? 0 : -40 }}
            transition={{ duration: reduce ? 0.2 : 0.42, ease: [0.22, 1.2, 0.36, 1] }}
          >
            <motion.span
              className="text-6xl"
              animate={reduce ? {} : { rotate: [-8, 8, -4, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5 }}
            >
              {msg.emoji}
            </motion.span>
            <div
              className={[
                'font-display mt-1 bg-gradient-to-b bg-clip-text text-6xl font-extrabold text-transparent drop-shadow-[0_4px_0_rgba(0,0,0,0.25)]',
                msg.className,
              ].join(' ')}
              style={{ WebkitTextStroke: '2px rgba(255,255,255,0.85)' }}
            >
              {msg.text}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
