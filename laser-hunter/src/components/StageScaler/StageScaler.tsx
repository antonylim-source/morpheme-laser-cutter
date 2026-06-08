import { useEffect, useState, type ReactNode } from 'react'
import { STAGE_HEIGHT, STAGE_WIDTH } from '../../constants/stageConfig'

function computeStageScale(): number {
  return Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT)
}

export function StageScaler({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(computeStageScale)

  useEffect(() => {
    const onResize = () => setScale(computeStageScale())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div
      className="fixed left-1/2 top-0"
      style={{
        transform: `translateX(-50%) scale(${scale})`,
        transformOrigin: 'top center',
      }}
    >
      <div
        id="stage"
        className="relative overflow-hidden"
        style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
      >
        {children}
      </div>
    </div>
  )
}
