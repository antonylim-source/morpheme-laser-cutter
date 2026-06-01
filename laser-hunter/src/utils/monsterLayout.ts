import {
  CANVAS_WIDTH,
  WORD_FONT_SIZE,
  gameConfig,
} from '../constants/gameConfig'
import type { CompoundWord } from '../types/game.types'

export const MONSTER_SPAWN_X = CANVAS_WIDTH + 280
export const MONSTER_TARGET_X = CANVAS_WIDTH / 2

export type MonsterLayoutSnapshot = {
  monsterX: number
  wordStartX: number
  canvasWordWidth: number
  boundaryPixelX: number
  boundaryX01: number
  approachProgress: number
  totalScale: number
}

export function getCanvasWordWidth(wordLength: number): number {
  const len = Math.max(1, wordLength)
  const approxCharW = WORD_FONT_SIZE * 0.62
  const naturalWordWidth = len * approxCharW
  return Math.max(360, Math.min(680, naturalWordWidth))
}

/** 0 = far (spawn), 1 = at player (center) */
export function getApproachProgress(monsterX: number): number {
  const span = MONSTER_SPAWN_X - MONSTER_TARGET_X
  if (span <= 0) return 1
  return Math.max(0, Math.min(1, 1 - (monsterX - MONSTER_TARGET_X) / span))
}

/** Smaller when far; full size at center */
export function getApproachScale(progress: number): number {
  const min = 0.58
  return min + (1 - min) * Math.pow(progress, 0.82)
}

export function getFailScale(failCount: number): number {
  return Math.pow(gameConfig.monsterScaleUpOnFail, failCount)
}

export function getMonsterSpeedPxPerSec(failCount: number): number {
  return gameConfig.monsterBaseSpeed * (1 + failCount * (gameConfig.monsterSpeedUpOnFail - 1))
}

export function computeMonsterLayout(
  word: CompoundWord,
  monsterX: number,
  failCount: number,
): MonsterLayoutSnapshot {
  const len = Math.max(1, word.full.length)
  const canvasWordWidth = getCanvasWordWidth(len)
  const approachProgress = getApproachProgress(monsterX)
  const totalScale = getApproachScale(approachProgress) * getFailScale(failCount)
  const scaledWordWidth = canvasWordWidth * totalScale
  const wordStartX = monsterX - scaledWordWidth / 2
  const boundaryPixelX = (word.boundaryIndex / len) * scaledWordWidth + wordStartX

  return {
    monsterX,
    wordStartX,
    canvasWordWidth: scaledWordWidth,
    boundaryPixelX,
    boundaryX01: boundaryPixelX / CANVAS_WIDTH,
    approachProgress,
    totalScale,
  }
}
