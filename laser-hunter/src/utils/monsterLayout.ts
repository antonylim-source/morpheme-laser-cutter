import {
  CANVAS_WIDTH,
  MONSTER_APPROACH_MIN_SCALE,
  WORD_LETTER_SPACING,
  WORD_Y_POSITION,
  gameConfig,
} from '../constants/gameConfig'
import type { CompoundWord } from '../types/game.types'
import {
  estimateWordTextWidth,
  getVisualBoundaryOffsetX,
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
  /** fail 누적에 따른 단어·판정 스케일 (1 = 기본) */
  textFailScale: number
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

const TEXT_FAIL_GROW_MS = 520
const WORD_POP_MS = 450

/** 단어 등장 pop 애니메이션 스케일 (1 = 최종 크기) */
export function getWordPopScale(popStartMs: number, reduceMotion: boolean): number {
  if (reduceMotion || popStartMs <= 0) return 1
  const popAge = performance.now() - popStartMs
  if (popAge < 0 || popAge >= WORD_POP_MS) return 1
  const t = popAge / WORD_POP_MS
  return t < 0.55 ? 0.35 + (t / 0.55) * 0.8 : 1.15 - ((t - 0.55) / 0.45) * 0.15
}

/** fail 직후 몬스터·단어가 함께 커지는 보간 스케일 */
export function getAnimatedTextFailScale(
  failCount: number,
  growStartMs: number,
  reduceMotion: boolean,
): number {
  const target = getFailScale(failCount)
  if (failCount <= 0) return 1
  if (reduceMotion) return target
  if (growStartMs <= 0) return target

  const age = performance.now() - growStartMs
  if (age >= TEXT_FAIL_GROW_MS) return target

  const from = getFailScale(failCount - 1)
  const t = age / TEXT_FAIL_GROW_MS
  const ease = 1 - Math.pow(1 - t, 3)
  return from + (target - from) * ease
}

export function getMonsterSpeedPxPerSec(failCount: number): number {
  return gameConfig.monsterBaseSpeed * (1 + failCount * (gameConfig.monsterSpeedUpOnFail - 1))
}

export function computeMonsterLayout(
  word: CompoundWord,
  approachProgress: number,
  failCount: number,
  textMetrics?: WordTextMetrics,
  textFailScale: number = getFailScale(failCount),
  textVisualScale: number = textFailScale,
): MonsterLayoutSnapshot {
  const len = Math.max(1, word.full.length)
  const progress = Math.max(0, Math.min(1, approachProgress))
  const canvasWordWidth = textMetrics?.totalWidth ?? estimateWordTextWidth(len)
  const monsterX = MONSTER_CENTER_X
  const totalScale = getApproachScale(progress) * getFailScale(failCount)
  const scaledWordWidth = canvasWordWidth * textVisualScale
  const wordStartX = monsterX - scaledWordWidth / 2
  const gapAdjust = word.boundaryIndex > 0 ? WORD_LETTER_SPACING / 2 : 0
  const boundaryOffset = textMetrics
    ? getVisualBoundaryOffsetX(textMetrics, word.boundaryIndex, len)
    : (word.boundaryIndex / len) * canvasWordWidth - gapAdjust
  const boundaryPixelX = wordStartX + boundaryOffset * textVisualScale

  return {
    monsterX,
    wordStartX,
    canvasWordWidth,
    boundaryPixelX,
    boundaryX01: boundaryPixelX / CANVAS_WIDTH,
    approachProgress: progress,
    totalScale,
    textFailScale,
  }
}
