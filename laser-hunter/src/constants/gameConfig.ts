import type { AgeMode, GameConfig } from '../types/game.types'
import { STAGE_HEIGHT, STAGE_WIDTH } from './stageConfig'

export const AGE_TOLERANCE: Record<AgeMode, number> = {
  young: 20,
  standard: 18,
  advanced: 12,
}

/** @deprecated use gameConfig.monsterBaseSpeed (px/sec) */
export const BOULDER_SPEED = {
  easy: 2,
  normal: 3,
  hard: 5,
} as const

/** 멀리 있을 때 몬스터 최소 스케일 (원근 접근) */
export const MONSTER_APPROACH_MIN_SCALE = 0.3

export const HINT_THRESHOLDS = [1, 2, 3] as const

export const CANVAS_WIDTH = STAGE_WIDTH
export const CANVAS_HEIGHT = STAGE_HEIGHT
export const WORD_FONT_SIZE = 58
/** 글자 사이 추가 간격(px) — measureText 기준 */
export const WORD_LETTER_SPACING = 8
/** 몬스터·단어 수직 중심 (상·하 UI 오버레이 고려) */
export const WORD_Y_POSITION = 400

/** 이 접근도 이상에서 단어 표시·슬래시 판정 활성 */
export const WORD_REVEAL_APPROACH = 0.95

export function getWordRevealAlpha(approachProgress: number): number {
  const p = Math.max(0, Math.min(1, approachProgress))
  if (p < WORD_REVEAL_APPROACH) return 0
  const span = 1 - WORD_REVEAL_APPROACH
  if (span <= 0) return 1
  return Math.min(1, (p - WORD_REVEAL_APPROACH) / span)
}

export function isWordSlashable(approachProgress: number): boolean {
  return approachProgress >= WORD_REVEAL_APPROACH
}

// 기존 PoC 코드 호환용(추후 Canvas 상수 기반으로 정리 가능)
export const gameConfig: GameConfig = {
  stageWidth: CANVAS_WIDTH,
  stageHeight: CANVAS_HEIGHT,
  wordFontSize: WORD_FONT_SIZE,
  wordPaddingX: 24,
  allowedIndexError: 0,
  monsterBaseSpeed: 220, // px/sec
  monsterSpeedUpOnFail: 1.35,
  monsterScaleUpOnFail: 1.5,
  resultHoldMs: 900,
}

