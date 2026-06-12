export type MonsterSequenceConfig = {
  frameW: number
  frameH: number
  cols: number
  frameCount: number
  frameDurationMs: number
  /** 프레임 여백 보정 — 시퀀스 체감 크기 (기본 1) */
  renderScale?: number
  /** 프레임 내용 좌우 보정 (소스 프레임 px, destW에 비례 스케일) */
  offsetX?: number
}

/** Ludo.ai animation-sequence.json — 시트 경로별 스펙 */
export const MONSTER_SEQUENCE_BY_SHEET: Record<string, MonsterSequenceConfig> = {
  'images/monster_4-sequence.png': {
    frameW: 664,
    frameH: 385,
    cols: 6,
    frameCount: 36,
    frameDurationMs: 100,
  },
  'images/monster_1-sequence.png': {
    frameW: 648,
    frameH: 430,
    cols: 6,
    frameCount: 36,
    frameDurationMs: 100,
  },
  'images/monster_3-sequence.png': {
    frameW: 767,
    frameH: 476,
    cols: 6,
    frameCount: 36,
    frameDurationMs: 100,
    renderScale: 1.2,
  },
  'images/monster_2-sequence.png': {
    frameW: 693,
    frameH: 439,
    cols: 6,
    frameCount: 36,
    frameDurationMs: 100,
    offsetX: 40,
  },
}

export type SpriteFrameRect = { x: number; y: number; w: number; h: number }

export function getMonsterSequenceConfig(
  sheetPath: string | undefined,
): MonsterSequenceConfig | null {
  if (!sheetPath) return null
  return MONSTER_SEQUENCE_BY_SHEET[sheetPath] ?? null
}

export function getMonsterSequenceRenderScale(sheetPath: string | undefined): number {
  const cfg = getMonsterSequenceConfig(sheetPath)
  if (!cfg) return 1
  return cfg.renderScale ?? 1
}

export function getMonsterSequenceOffsetX(sheetPath: string | undefined): number {
  const cfg = getMonsterSequenceConfig(sheetPath)
  if (!cfg) return 0
  return cfg.offsetX ?? 0
}

export function getMonsterSequenceAspect(sheetPath: string | undefined): number | null {
  const cfg = getMonsterSequenceConfig(sheetPath)
  if (!cfg) return null
  return cfg.frameH / cfg.frameW
}

export function getMonsterSequenceFrameRect(
  index: number,
  sheetPath: string,
): SpriteFrameRect {
  const cfg = getMonsterSequenceConfig(sheetPath)
  if (!cfg) return { x: 0, y: 0, w: 0, h: 0 }

  const { frameW, frameH, cols, frameCount } = cfg
  const i = ((index % frameCount) + frameCount) % frameCount
  const col = i % cols
  const row = Math.floor(i / cols)
  return { x: col * frameW, y: row * frameH, w: frameW, h: frameH }
}

export function getMonsterSequenceFrameIndex(elapsedMs: number, sheetPath: string): number {
  const cfg = getMonsterSequenceConfig(sheetPath)
  if (!cfg) return 0

  const { frameCount, frameDurationMs } = cfg
  const loopMs = frameCount * frameDurationMs
  if (loopMs <= 0) return 0
  const t = ((elapsedMs % loopMs) + loopMs) % loopMs
  return Math.min(frameCount - 1, Math.floor(t / frameDurationMs))
}
