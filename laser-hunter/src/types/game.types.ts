export type MorphemeEffect = 'none' | 'spin' | 'shake' | 'pulse'

export interface CompoundWord {
  id: string
  /** 전체 합성어 (예: "raincoat") */
  full: string
  /** 첫 번째 어근 (예: "rain") */
  morpheme1: string
  /** 두 번째 어근 (예: "coat") */
  morpheme2: string
  /** 전체 글자 중 경계 위치 (0-based) */
  boundaryIndex: number
  /** morpheme1 이미지 경로 */
  image1: string
  /** morpheme2 이미지 경로 */
  image2: string
  /** 합성어 전체 이미지 경로 */
  combinedImage: string
  /** morpheme1 성공 연출 */
  effect1?: MorphemeEffect
  /** morpheme2 성공 연출 */
  effect2?: MorphemeEffect
}

export interface GameState {
  status: 'idle' | 'playing' | 'success' | 'fail' | 'hint'
  currentWord: CompoundWord
  score: number
  /** 0,1,2,3 → 힌트 단계 결정 */
  failCount: number
  timeElapsed: number
  wordIndex: number
}

export interface TouchGesture {
  startX: number
  startY: number
  endX: number
  endY: number
  currentX: number
  currentY: number
  isActive: boolean
}

export type AgeMode = 'young' | 'standard' | 'advanced'

export interface BoundaryCheckResult {
  isCorrect: boolean
  /** 허용 오차 픽셀 */
  tolerance: number
  /** 실제 오차 픽셀 */
  diff: number
  /** 계산된 경계선 픽셀 X 좌표 */
  boundaryPixelX: number
}

// --- internal PoC helper types (kept small & compatible) ---
export type CutResult =
  | { ok: true; boundaryIndex: number; attemptedIndex: number }
  | { ok: false; boundaryIndex: number; attemptedIndex: number }

export type GameConfig = {
  stageWidth: number
  stageHeight: number
  wordFontSize: number
  wordPaddingX: number
  allowedIndexError: number
  monsterBaseSpeed: number
  monsterSpeedUpOnFail: number
  monsterScaleUpOnFail: number
  resultHoldMs: number
}

