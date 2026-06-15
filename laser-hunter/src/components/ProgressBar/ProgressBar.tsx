import { UI_ICONS } from '../../constants/uiIcons'
import { publicAsset } from '../../utils/publicAsset'
import './ProgressBar.css'

type Props = {
  done: number
  total?: number
}

export function ProgressBar({ done, total = 10 }: Props) {
  const clampedDone = Math.max(0, Math.min(total, done))

  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-valuenow={clampedDone}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`Progress ${clampedDone} of ${total}`}
    >
      <img
        src={publicAsset('images/progress_area.png')}
        alt=""
        aria-hidden
        className="progress-bar__frame"
        draggable={false}
      />

      <div className="progress-bar__stars" aria-hidden>
        {Array.from({ length: total }, (_, i) => {
          const filled = i < clampedDone
          const justEarned = filled && i === clampedDone - 1
          return (
            <div key={i} className="progress-bar__star-slot">
              <img
                src={UI_ICONS.star}
                alt=""
                className={[
                  'progress-bar__star-img h-8 w-8 object-contain',
                  filled
                    ? [
                        'mix-blend-screen',
                        'drop-shadow-[0_0_10px_rgba(250,204,21,0.95)]',
                        'drop-shadow-[0_4px_14px_rgba(255,90,30,0.55)]',
                        'drop-shadow-[0_-2px_8px_rgba(56,189,248,0.3)]',
                      ].join(' ')
                    : 'opacity-30 grayscale brightness-75',
                  justEarned ? 'progress-bar__star-pop' : '',
                ].join(' ')}
              />
            </div>
          )
        })}
      </div>

      <span
        className="progress-bar__counter font-display text-lg font-extrabold tabular-nums text-[#f5e6c8] drop-shadow-[0_1px_0_#3d2814] drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)] drop-shadow-[0_0_10px_rgba(255,90,30,0.35)]"
        aria-hidden
      >
        {clampedDone}/{total}
      </span>
    </div>
  )
}
