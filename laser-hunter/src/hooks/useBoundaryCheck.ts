import { AGE_TOLERANCE } from '../constants/gameConfig'
import type { AgeMode, BoundaryCheckResult } from '../types/game.types'

export function useBoundaryCheck() {
  function checkBoundary(
    touchX: number,
    boundaryPixelX: number,
    ageMode: AgeMode,
  ): BoundaryCheckResult {
    const tolerance = AGE_TOLERANCE[ageMode]
    const diff = Math.abs(touchX - boundaryPixelX)
    return {
      isCorrect: diff <= tolerance,
      diff,
      tolerance,
      boundaryPixelX,
    }
  }

  return { checkBoundary }
}

