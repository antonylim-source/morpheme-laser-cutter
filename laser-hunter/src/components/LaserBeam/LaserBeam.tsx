import { Line } from 'react-konva'
import type { TouchGesture } from '../../types/game.types'

export function LaserBeam({ gesture }: { gesture: TouchGesture }) {
  if (!gesture.isActive) return null
  const flat = [gesture.startX, gesture.startY, gesture.currentX, gesture.currentY]
  return (
    <>
      <Line points={flat} stroke="#a855f7" strokeWidth={14} lineCap="round" lineJoin="round" opacity={0.25} />
      <Line points={flat} stroke="#22d3ee" strokeWidth={6} lineCap="round" lineJoin="round" opacity={0.9} />
    </>
  )
}

