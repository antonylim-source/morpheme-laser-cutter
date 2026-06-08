import { WORD_FONT_SIZE, WORD_LETTER_SPACING } from '../constants/gameConfig'

export const WORD_FONT_FAMILY =
  '"Fredoka", "Verdana Bold", "Trebuchet MS", "Arial Black", sans-serif'

export type WordTextMetrics = {
  /** 단어 시작점 기준 각 글자 왼쪽 x 오프셋 */
  charLeftOffsets: number[]
  totalWidth: number
}

export function applyWordFont(ctx: CanvasRenderingContext2D, fontSize: number = WORD_FONT_SIZE) {
  ctx.font = `700 ${fontSize}px ${WORD_FONT_FAMILY}`
}

export function measureWordText(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number = WORD_FONT_SIZE,
  letterSpacing: number = WORD_LETTER_SPACING,
): WordTextMetrics {
  applyWordFont(ctx, fontSize)
  const upper = text.toUpperCase()
  const charLeftOffsets: number[] = []
  let x = 0

  for (let i = 0; i < upper.length; i++) {
    charLeftOffsets.push(x)
    x += ctx.measureText(upper[i]!).width + letterSpacing
  }

  const totalWidth = upper.length > 0 ? Math.max(0, x - letterSpacing) : 0
  return { charLeftOffsets, totalWidth }
}

/** canvas 없을 때 대략 폭 (폴백) */
export function estimateWordTextWidth(wordLength: number): number {
  const len = Math.max(1, wordLength)
  const avgCharW = WORD_FONT_SIZE * 0.58
  const natural = len * avgCharW + Math.max(0, len - 1) * WORD_LETTER_SPACING
  return Math.max(360, Math.min(920, natural))
}

export function getBoundaryOffsetX(
  metrics: WordTextMetrics,
  boundaryIndex: number,
  wordLength: number,
): number {
  const len = Math.max(1, wordLength)
  const idx = Math.max(0, Math.min(boundaryIndex, len))
  if (idx >= metrics.charLeftOffsets.length) return metrics.totalWidth
  return metrics.charLeftOffsets[idx]!
}
