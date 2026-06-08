import {
  CANVAS_WIDTH,
  MONSTER_APPROACH_MIN_SCALE,
  WORD_Y_POSITION,
  gameConfig,
} from '../constants/gameConfig'
import type { CompoundWord } from '../types/game.types'
import {
  estimateWordTextWidth,
  getBoundaryOffsetX,
  type WordTextMetrics,
} from './wordTextMetrics'

export const MONSTER_CENTER_X = CANVAS_WIDTH / 2

/** 기존 가로 돌진과 비슷한 접근 시간(약 4초)을 위한 등가 거리 */
export const APPROACH_EQUIV_DISTANCE_PX = 920

/** @deprecated depth 접근 방식 — 호환용 */
export const MONSTER_SPAWN_X = CANVAS_WIDTH + 280
/** @deprecated depth 접근 방식 — 호환용 */
export const MONSTER_TARGET_X = MONSTER_CENTER_X

export type MonsterLayoutSnapshot = {
  monsterX: number
  wordStartX: number
  canvasWordWidth: number
  boundaryPixelX: number
  boundaryX01: number
  approachProgress: number
  totalScale: number
}

/** @deprecated use estimateWordTextWidth or measureWordText */
export function getCanvasWordWidth(wordLength: number): number {
  return estimateWordTextWidth(wordLength)
}

/** 0 = 멀리, 1 = 플레이어 앞 */
export function getApproachScale(progress: number): number {
  const t = Math.max(0, Math.min(1, progress))
  const min = MONSTER_APPROACH_MIN_SCALE
  return min + (1 - min) * Math.pow(t, 0.88)
}

/** 멀 때 위(지평선) → 가까울수록 단어 위치 쪽으로 이동 */
export function getMonsterVisualCenterY(
  progress: number,
  targetWordY: number = WORD_Y_POSITION,
): number {
  const t = Math.pow(Math.max(0, Math.min(1, progress)), 0.85)
  const farY = targetWordY - 115
  const nearY = targetWordY + 14
  return farY + (nearY - farY) * t
}

export function getFailScale(failCount: number): number {
  return Math.pow(gameConfig.monsterScaleUpOnFail, failCount)
}

export function getMonsterSpeedPxPerSec(failCount: number): number {
  return gameConfig.monsterBaseSpeed * (1 + failCount * (gameConfig.monsterSpeedUpOnFail - 1))
}

export function computeMonsterLayout(
  word: CompoundWord,
  approachProgress: number,
  failCount: number,
  textMetrics?: WordTextMetrics,
): MonsterLayoutSnapshot {
  const len = Math.max(1, word.full.length)
  const progress = Math.max(0, Math.min(1, approachProgress))
  const canvasWordWidth = textMetrics?.totalWidth ?? estimateWordTextWidth(len)
  const monsterX = MONSTER_CENTER_X
  const totalScale = getApproachScale(progress) * getFailScale(failCount)
  const wordStartX = monsterX - canvasWordWidth / 2
  const boundaryOffset = textMetrics
    ? getBoundaryOffsetX(textMetrics, word.boundaryIndex, len)
    : (word.boundaryIndex / len) * canvasWordWidth
  const boundaryPixelX = wordStartX + boundaryOffset

  return {
    monsterX,
    wordStartX,
    canvasWordWidth,
    boundaryPixelX,
    boundaryX01: boundaryPixelX / CANVAS_WIDTH,
    approachProgress: progress,
    totalScale,
  }
}
