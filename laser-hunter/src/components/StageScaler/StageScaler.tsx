import { useEffect, useState, type ReactNode } from 'react'
import { STAGE_HEIGHT, STAGE_WIDTH } from '../../constants/stageConfig'

function computeStageScale(): number {
  // 모바일에서 URL바·줌으로 innerWidth/innerHeight가 실제 가시 영역과 어긋나는 것 보정
  const vv = window.visualViewport
  const width = vv?.width ?? window.innerWidth
  const height = vv?.height ?? window.innerHeight
  return Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT)
}

export function StageScaler({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(computeStageScale)

  useEffect(() => {
    const onResize = () => setScale(computeStageScale())
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
    }
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
