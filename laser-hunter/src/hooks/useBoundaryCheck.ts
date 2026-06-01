import { AGE_TOLERANCE } from '../constants/gameConfig'
import type { AgeMode, BoundaryCheckResult, CompoundWord } from '../types/game.types'

export function useBoundaryCheck() {
  /**
   * 터치/펜 좌표가 형태소 경계선(boundaryIndex)을 맞췄는지 픽셀 기반으로 판정합니다.
   *
   * 가정:
   * - 단어가 캔버스에 고정된 픽셀 폭(canvasWordWidth)로 렌더링됨
   * - 각 문자의 폭은 동일: canvasWordWidth / word.length
   */
  function checkBoundary(
    touchX: number,
    word: CompoundWord,
    wordStartX: number,
    canvasWordWidth: number,
    ageMode: AgeMode,
  ): BoundaryCheckResult {
    const len = Math.max(1, word.full.length)
    const boundaryPixelX = (word.boundaryIndex / len) * canvasWordWidth + wordStartX
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

