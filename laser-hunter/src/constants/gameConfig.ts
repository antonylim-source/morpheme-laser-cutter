import type { AgeMode, GameConfig } from '../types/game.types'

export const AGE_TOLERANCE: Record<AgeMode, number> = {
  young: 20,
  standard: 12,
  advanced: 8,
}

/** @deprecated use gameConfig.monsterBaseSpeed (px/sec) */
export const BOULDER_SPEED = {
  easy: 2,
  normal: 3,
  hard: 5,
} as const

export const MONSTER_APPROACH_MIN_SCALE = 0.58

export const HINT_THRESHOLDS = [1, 2, 3] as const

export const CANVAS_WIDTH = 800
export const CANVAS_HEIGHT = 600
export const WORD_FONT_SIZE = 48
export const WORD_Y_POSITION = 300

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

