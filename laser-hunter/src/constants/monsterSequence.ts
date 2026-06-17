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

/** Ludo.ai animation-sequence.json — 시트 경로별 스펙 (접근 75%, success 85% 리사이즈) */
export const MONSTER_SEQUENCE_BY_SHEET: Record<string, MonsterSequenceConfig> = {
  'images/monster_4-sequence.png': {
    frameW: 498,
    frameH: 289,
    cols: 6,
    frameCount: 36,
    frameDurationMs: 100,
  },
  'images/monster_1-sequence.png': {
    frameW: 486,
    frameH: 323,
    cols: 6,
    frameCount: 36,
    frameDurationMs: 100,
  },
  'images/monster_3-sequence.png': {
    frameW: 575,
    frameH: 357,
    cols: 6,
    frameCount: 36,
    frameDurationMs: 100,
    renderScale: 1.2,
  },
  'images/monster_2-sequence.png': {
    frameW: 520,
    frameH: 329,
    cols: 6,
    frameCount: 36,
    frameDurationMs: 100,
    offsetX: 30,
  },
  'images/monster_4_success.png': {
    frameW: 734,
    frameH: 408,
    cols: 6,
    frameCount: 36,
    frameDurationMs: 100,
    renderScale: 1.78,
  },
  'images/monster_1_success.png': {
    frameW: 734,
    frameH: 408,
    cols: 6,
    frameCount: 36,
    frameDurationMs: 100,
    renderScale: 1.78,
  },
  'images/monster_3_success.png': {
    frameW: 734,
    frameH: 408,
    cols: 6,
    frameCount: 36,
    frameDurationMs: 100,
    renderScale: 1.78,
  },
  'images/monster_2_success.png': {
    frameW: 734,
    frameH: 382,
    cols: 6,
    frameCount: 36,
    frameDurationMs: 100,
    renderScale: 1.78,
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

/** 0 → … → last → … → 0 ping-pong — 루프 점프 없이 자연스럽게 반복 */
export function getMonsterSequenceFrameIndex(elapsedMs: number, sheetPath: string): number {
  const cfg = getMonsterSequenceConfig(sheetPath)
  if (!cfg) return 0

  const { frameCount, frameDurationMs } = cfg
  if (frameCount <= 1 || frameDurationMs <= 0) return 0

  const cycleFrames = 2 * frameCount - 2
  const loopMs = cycleFrames * frameDurationMs
  const t = ((elapsedMs % loopMs) + loopMs) % loopMs
  const pos = Math.floor(t / frameDurationMs) % cycleFrames
  return pos < frameCount ? pos : cycleFrames - pos
}

/** 정답 시퀀스 — 0 → last 한 방향 재생 */
export function getMonsterSuccessFrameIndex(elapsedMs: number, sheetPath: string): number {
  const cfg = getMonsterSequenceConfig(sheetPath)
  if (!cfg) return 0
  const idx = Math.floor(Math.max(0, elapsedMs) / cfg.frameDurationMs)
  return Math.min(idx, cfg.frameCount - 1)
}

export function getMonsterSuccessDurationMs(sheetPath: string | undefined): number {
  const cfg = getMonsterSequenceConfig(sheetPath)
  if (!cfg) return 3000
  return cfg.frameCount * cfg.frameDurationMs
}

/** success 시퀀스 종료 후 SplitAnimation 카드 UI 등장 시간 */
export const SUCCESS_CARD_ENTRANCE_MS = 1800
/** 카드가 완전히 보인 뒤 유지 시간 */
export const SUCCESS_CARD_HOLD_MS = 2000

export function getSuccessHoldMs(successSequenceSheet: string | undefined): number {
  if (!successSequenceSheet) return 3000
  return (
    getMonsterSuccessDurationMs(successSequenceSheet) +
    SUCCESS_CARD_ENTRANCE_MS +
    SUCCESS_CARD_HOLD_MS
  )
}
