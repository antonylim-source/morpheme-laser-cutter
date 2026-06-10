import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useRef } from 'react'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  WORD_FONT_SIZE,
  WORD_Y_POSITION,
  AGE_TOLERANCE,
  gameConfig,
  getMonsterImagePath,
  getWordRevealAlpha,
  isWordSlashable,
} from '../../constants/gameConfig'
import { publicAsset } from '../../utils/publicAsset'
import type { AgeMode, CompoundWord, GameState } from '../../types/game.types'
import {
  APPROACH_EQUIV_DISTANCE_PX,
  computeMonsterLayout,
  getAnimatedTextFailScale,
  getMonsterSpeedPxPerSec,
  getMonsterVisualCenterY,
  getWordPopScale,
  type MonsterLayoutSnapshot,
} from '../../utils/monsterLayout'
import {
  WORD_FONT_FAMILY,
  applyWordFont,
  measureWordText,
  type WordTextMetrics,
} from '../../utils/wordTextMetrics'

type Props = {
  word: CompoundWord
  gameStatus: GameState['status']
  failCount: number
  combo?: number
  ageMode?: AgeMode
  loading?: boolean
  devOverlay?: boolean
  /** 완료한 단어 수 — 진행될수록 몬스터 접근 속도가 빨라짐 */
  wordsDone?: number
  onSlashAttempt: (touchX: number, layout: MonsterLayoutSnapshot) => void
  onLayoutSnapshot?: (layout: MonsterLayoutSnapshot) => void
  /** 몬스터 발걸음 박자마다 호출 (인자: 접근도 0~1) — 발소리 연출용 */
  onMonsterStep?: (approachProgress: number) => void
}

type TrailPoint = { x: number; y: number; t: number }

const MAX_CANVAS_DPR = 2
/** fail 성장 후에도 몬스터가 스테이지(캔버스) 좌우로 잘리지 않게 하는 폭 상한 */
const MONSTER_MAX_WIDTH = CANVAS_WIDTH - 40
const MAX_TRAIL_POINTS = 48
const TRAIL_LIFE_MS = 1200
const TRAIL_MIN_DIST_SQ = 6 * 6
const SUCCESS_SPLIT_MS = 850
const SUCCESS_SPLIT_OFFSET_PX = 220
const SUCCESS_SPLIT_ROTATE_DEG = 12
/** 분열 반쪽이 위로 떴다가 떨어지는 포물선: 315t² − 275t (t=0.44에서 −60px, t=1에서 +40px) */
const SUCCESS_SPLIT_ARC_A = 315
const SUCCESS_SPLIT_ARC_B = 275
const DEBRIS_GRAVITY = 980
const DEBRIS_GRAVITY_BURST_MS = 100
const DEBRIS_GRAVITY_BURST_MUL = 0.35
const DEBRIS_VY_DRAG_FREE_MS = 150
const DEBRIS_DRAG_X = 0.993
const DEBRIS_DRAG_Y = 0.992
const DEBRIS_BOUNCE = 0.5
const DEBRIS_FADE_AFTER = 0.78
const DEBRIS_WAVE_DELAYS_MS = [0, 120, 250, 420, 580]
const DEBRIS_WAVE_KINDS: DebrisKind[] = ['chunk', 'medium', 'medium', 'dust', 'dust']
const DEBRIS_WAVE_COUNTS = { normal: [26, 24, 22, 17, 22], reduce: [11, 11, 11, 10, 12] }
const HIT_STOP_MS = 110
const FAIL_HIT_STOP_MS = 50
const SUCCESS_SHOCKWAVE_MS = 380
const DEFLECT_BEAM_MS = 480
const DEFLECT_SPARK_MS = 280
const FAIL_FLASH_MS = 220
const MISS_DEBRIS_COUNT = { normal: 10, reduce: 5 } as const

const STONE_PALETTE = [
  { fill: '#a8a29e', stroke: '#57534e', highlight: '#d6d3d1' },
  { fill: '#d6d3d1', stroke: '#78716c', highlight: '#f5f5f4' },
  { fill: '#9ca3af', stroke: '#4b5563', highlight: '#cbd5e1' },
  { fill: '#c4b5a5', stroke: '#6b5c4c', highlight: '#e7ddd0' },
  { fill: '#e7e5e4', stroke: '#a8a29e', highlight: '#fafaf9' },
  { fill: '#b8a898', stroke: '#5c4f42', highlight: '#ddd0c0' },
] as const

type DebrisKind = 'chunk' | 'medium' | 'dust'

type DebrisFragment = {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  rotSpeed: number
  size: number
  verts: [number, number][]
  fill: string
  stroke: string
  highlight: string
  bornAt: number
  lifeMs: number
  kind: DebrisKind
  floorY: number
  bouncesLeft: number
}

type DustPuff = {
  x: number
  y: number
  bornAt: number
  lifeMs: number
  maxRadius: number
  driftX: number
  driftY: number
}

type StarConfetti = {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  rotSpeed: number
  size: number
  color: string
  bornAt: number
  lifeMs: number
}

const STAR_CONFETTI_COLORS = [
  '#fde047',
  '#f472b6',
  '#38bdf8',
  '#4ade80',
  '#fb923c',
  '#a78bfa',
] as const

type DebrisWaveState = {
  cutX: number
  yTop: number
  yBottom: number
  floorY: number
  yCenter: number
  reduceMotion: boolean
  startMs: number
  wavesSpawned: number
  countMul: number
}

type SuccessJuiceSnapshot = {
  cutX: number
  yCenter: number
  startMs: number
}

type FailJuiceSnapshot = {
  x: number
  y: number
  startMs: number
}

type DeflectSegment = {
  x1: number
  y1: number
  x2: number
  y2: number
}

type MonsterBodyRect = {
  x: number
  y: number
  w: number
  h: number
  xCenter: number
  yCenter: number
  depthAlpha: number
  totalScale: number
}

type DeflectState = {
  x: number
  y: number
  angle: number
  startMs: number
  segments: DeflectSegment[]
}

export function GameCanvas({
  word,
  gameStatus,
  failCount,
  combo = 0,
  ageMode = 'standard',
  loading = false,
  devOverlay = false,
  wordsDone = 0,
  onSlashAttempt,
  onLayoutSnapshot,
  onMonsterStep,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // key 리마운트 방식은 <canvas>가 재생성되어 DPR 비트맵 설정이 날아가므로 controls로 흔듦
  const shakeControls = useAnimationControls()
  const reduceMotion = useReducedMotion() ?? false

  const approachRef = useRef(0)
  const layoutSnapshotRef = useRef<MonsterLayoutSnapshot>(
    computeMonsterLayout(word, 0, failCount),
  )
  const laserActiveRef = useRef(false)
  const laserXRef = useRef(0)
  const lastTouchXRef = useRef<number | null>(null)
  const gestureStartRef = useRef<{ x: number; y: number } | null>(null)
  const gestureCurrentRef = useRef<{ x: number; y: number } | null>(null)
  const trailRef = useRef<TrailPoint[]>([])
  const deflectRef = useRef<DeflectState | null>(null)
  const monsterImgRef = useRef<HTMLImageElement | null>(null)
  const prevStatusRef = useRef<GameState['status']>(gameStatus)
  const lastLayoutEmitRef = useRef(0)
  const canvasRectRef = useRef<DOMRect | null>(null)
  const textMetricsRef = useRef<WordTextMetrics | null>(null)
  const textMetricsWordIdRef = useRef('')
  const growPunchStartRef = useRef(0)
  const wordPopStartRef = useRef(0)
  const successFlashStartRef = useRef(0)
  const successSplitStartRef = useRef(0)
  const frozenSuccessLayoutRef = useRef<MonsterLayoutSnapshot | null>(null)
  const splitDebrisRef = useRef<DebrisFragment[]>([])
  const dustPuffsRef = useRef<DustPuff[]>([])
  const starConfettiRef = useRef<StarConfetti[]>([])
  const debrisWaveStateRef = useRef<DebrisWaveState | null>(null)
  const hitStopUntilRef = useRef(0)
  const failFrozenAtRef = useRef(0)
  const successJuiceRef = useRef<SuccessJuiceSnapshot | null>(null)
  const failJuiceRef = useRef<FailJuiceSnapshot | null>(null)
  const missDebrisRef = useRef<DebrisFragment[]>([])
  const prevWordVisibleRef = useRef(false)
  const prevFailCountRef = useRef(failCount)
  const lastStepMsRef = useRef(0)
  // 콜백을 ref로 들고 있어 rAF 루프 effect가 매 렌더마다 재시작되지 않게 함
  const onMonsterStepRef = useRef(onMonsterStep)
  useEffect(() => {
    onMonsterStepRef.current = onMonsterStep
  }, [onMonsterStep])

  const wordZone = useMemo(
    () => ({
      wordY: WORD_Y_POSITION,
      wordZoneTop: WORD_Y_POSITION - 100,
      wordZoneBottom: WORD_Y_POSITION + 100,
    }),
    [],
  )

  const failScale = useMemo(
    () => Math.pow(gameConfig.monsterScaleUpOnFail, failCount),
    [failCount],
  )

  useEffect(() => {
    void document.fonts.load(`700 ${WORD_FONT_SIZE}px ${WORD_FONT_FAMILY}`)
  }, [])

  useEffect(() => {
    approachRef.current = 0
    lastStepMsRef.current = 0
    deflectRef.current = null
    trailRef.current = []
    textMetricsRef.current = null
    textMetricsWordIdRef.current = ''
    growPunchStartRef.current = 0
    wordPopStartRef.current = 0
    prevWordVisibleRef.current = false
    frozenSuccessLayoutRef.current = null
    splitDebrisRef.current = []
    dustPuffsRef.current = []
    starConfettiRef.current = []
    debrisWaveStateRef.current = null
    hitStopUntilRef.current = 0
    failFrozenAtRef.current = 0
    successJuiceRef.current = null
    failJuiceRef.current = null
    missDebrisRef.current = []
    layoutSnapshotRef.current = computeMonsterLayout(word, 0, failCount)
  }, [word.id])

  useEffect(() => {
    if (failCount > prevFailCountRef.current) {
      growPunchStartRef.current = performance.now()
    }
    prevFailCountRef.current = failCount
  }, [failCount])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const updateRect = () => {
      canvasRectRef.current = canvas.getBoundingClientRect()
    }
    updateRect()
    const ro = new ResizeObserver(updateRect)
    ro.observe(container)
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, { passive: true })

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect)
    }
  }, [])

  useEffect(() => {
    // 티어 교체 시 깜빡임이 없도록, 새 이미지가 로드될 때까지 기존 이미지를 유지
    let cancelled = false
    const img = new Image()
    img.src = publicAsset(getMonsterImagePath(wordsDone))
    img.onload = () => {
      if (!cancelled) monsterImgRef.current = img
    }
    img.onerror = () => {
      if (!cancelled) monsterImgRef.current = null
    }
    return () => {
      cancelled = true
    }
  }, [wordsDone])

  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = gameStatus
    if (prev === gameStatus) return
    if (gameStatus === 'success') {
      const now = performance.now()
      successFlashStartRef.current = now
      successSplitStartRef.current = now
      const frozen = { ...layoutSnapshotRef.current }
      frozenSuccessLayoutRef.current = frozen
      const body = computeMonsterBodyRectStatic(
        frozen,
        monsterImgRef.current,
        wordZone.wordY,
      )
      const floorY = Math.min(CANVAS_HEIGHT - 52, body.y + body.h + 28)
      const countMul = 1 + Math.min(combo + 1, 4) * 0.05
      hitStopUntilRef.current = reduceMotion ? now : now + HIT_STOP_MS
      successJuiceRef.current = {
        cutX: frozen.boundaryPixelX,
        yCenter: body.yCenter,
        startMs: now,
      }
      debrisWaveStateRef.current = {
        cutX: frozen.boundaryPixelX,
        yTop: body.y - 12,
        yBottom: body.y + body.h + 12,
        floorY,
        yCenter: body.yCenter,
        reduceMotion,
        startMs: now,
        wavesSpawned: 0,
        countMul,
      }
      splitDebrisRef.current = []
      dustPuffsRef.current = []
      starConfettiRef.current = spawnStarConfetti(
        frozen.boundaryPixelX,
        body.yCenter,
        now,
        reduceMotion,
      )
      if (!reduceMotion) {
        void shakeControls.start({
          x: [0, -18, 18, -12, 12, 0],
          scale: [1, 1.07, 1],
          transition: { duration: 0.32, ease: 'easeOut' },
        })
      }
      return
    }
    if (prev === 'success') {
      frozenSuccessLayoutRef.current = null
      splitDebrisRef.current = []
      dustPuffsRef.current = []
      starConfettiRef.current = []
      debrisWaveStateRef.current = null
      hitStopUntilRef.current = 0
      failFrozenAtRef.current = 0
      successJuiceRef.current = null
      failJuiceRef.current = null
    }
    if (gameStatus !== 'fail') return

    const now = performance.now()
    const layout = layoutSnapshotRef.current
    const touchX = lastTouchXRef.current ?? layout.boundaryPixelX
    const reflectAngle = computeDeflectReflectAngle(
      trailRef.current,
      touchX,
      layout.boundaryPixelX,
    )
    const body = computeMonsterBodyRectStatic(
      layout,
      monsterImgRef.current,
      wordZone.wordY,
    )
    const floorY = Math.min(CANVAS_HEIGHT - 52, body.y + body.h + 28)

    failFrozenAtRef.current = now
    hitStopUntilRef.current = reduceMotion ? now : now + FAIL_HIT_STOP_MS
    failJuiceRef.current = { x: touchX, y: wordZone.wordY, startMs: now }
    missDebrisRef.current = spawnMissDebris(
      touchX,
      wordZone.wordY,
      floorY,
      now,
      reduceMotion,
    )
    deflectRef.current = {
      x: touchX,
      y: wordZone.wordY,
      angle: reflectAngle,
      startMs: now,
      segments: buildDeflectSegments(touchX, wordZone.wordY, reflectAngle),
    }
    approachRef.current = Math.max(0, approachRef.current - 0.07 - failCount * 0.025)
    if (!reduceMotion) {
      void shakeControls.start({
        x: [0, -8, 8, -5, 5, 0],
        scale: 1,
        transition: { duration: 0.38, ease: 'easeOut' },
      })
    }
  }, [gameStatus, failCount, wordZone.wordY, reduceMotion, combo, shakeControls])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const toCanvasXY = (clientX: number, clientY: number) => {
      const r = canvasRectRef.current ?? canvas.getBoundingClientRect()
      const sx = Math.max(1e-6, r.width / CANVAS_WIDTH)
      const sy = Math.max(1e-6, r.height / CANVAS_HEIGHT)
      const x = (clientX - r.left) / sx
      const y = (clientY - r.top) / sy
      return { x, y }
    }

    const pushTrailPoint = (x: number, y: number, now: number) => {
      const trail = trailRef.current
      const last = trail[trail.length - 1]
      if (last) {
        const dx = x - last.x
        const dy = y - last.y
        if (dx * dx + dy * dy < TRAIL_MIN_DIST_SQ) return
      }
      trail.push({ x, y, t: now })
      if (trail.length > MAX_TRAIL_POINTS) trail.shift()
    }

    const begin = (clientX: number, clientY: number) => {
      const p = toCanvasXY(clientX, clientY)
      gestureStartRef.current = p
      gestureCurrentRef.current = p
      laserActiveRef.current = true
      laserXRef.current = p.x
      lastTouchXRef.current = p.x
      trailRef.current = [{ x: p.x, y: p.y, t: performance.now() }]
    }

    const move = (clientX: number, clientY: number) => {
      if (!laserActiveRef.current) return
      const p = toCanvasXY(clientX, clientY)
      gestureCurrentRef.current = p
      laserXRef.current = p.x
      lastTouchXRef.current = p.x
      pushTrailPoint(p.x, p.y, performance.now())
    }

    const end = (clientX: number, clientY: number) => {
      if (!laserActiveRef.current) return
      const p = toCanvasXY(clientX, clientY)
      const start = gestureStartRef.current
      laserActiveRef.current = false
      gestureCurrentRef.current = p

      if (!start) return
      const dy = Math.abs(p.y - start.y)
      if (dy > 30 && isWordSlashable(approachRef.current)) {
        const slashX = getSlashXAtWordY(start, p, WORD_Y_POSITION)
        lastTouchXRef.current = slashX
        onSlashAttempt(slashX, layoutSnapshotRef.current)
      }
      gestureStartRef.current = null
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length < 1) return
      const t = e.touches[0]!
      begin(t.clientX, t.clientY)
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length < 1) return
      const t = e.touches[0]!
      move(t.clientX, t.clientY)
    }
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0]
      if (!t) return
      end(t.clientX, t.clientY)
    }

    let mouseDown = false
    const onMouseDown = (e: MouseEvent) => {
      mouseDown = true
      begin(e.clientX, e.clientY)
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!mouseDown) return
      move(e.clientX, e.clientY)
    }
    const onMouseUp = (e: MouseEvent) => {
      if (!mouseDown) return
      mouseDown = false
      end(e.clientX, e.clientY)
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: true })
    canvas.addEventListener('touchend', onTouchEnd)
    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onSlashAttempt])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 캔버스 엘리먼트가 새로 생겨도 비트맵 크기와 DPR 변환이 항상 일치하도록 여기서 함께 보장
    const dpr = Math.min(MAX_CANVAS_DPR, Math.max(1, Math.floor(window.devicePixelRatio || 1)))
    if (canvas.width !== CANVAS_WIDTH * dpr || canvas.height !== CANVAS_HEIGHT * dpr) {
      canvas.width = CANVAS_WIDTH * dpr
      canvas.height = CANVAS_HEIGHT * dpr
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    let raf = 0
    let lastFrameMs = performance.now()

    const drawBackground = (layout: MonsterLayoutSnapshot) => {
      ctx.save()
      const hg = ctx.createRadialGradient(
        layout.monsterX,
        wordZone.wordY,
        40,
        layout.monsterX,
        wordZone.wordY,
        280 + layout.approachProgress * 80,
      )
      hg.addColorStop(0, `rgba(250, 204, 21, ${0.04 + layout.approachProgress * 0.06})`)
      hg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = hg
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      ctx.restore()
    }

    const getMonsterBodyRect = (
      layout: MonsterLayoutSnapshot,
      xCenter = layout.monsterX,
      bobPhase = layout.approachProgress,
    ): MonsterBodyRect => {
      const growAge = performance.now() - growPunchStartRef.current
      let growMul = 1
      if (!reduceMotion && growAge >= 0 && growAge < 420) {
        const t = growAge / 420
        growMul = 1 + 0.18 * Math.sin(t * Math.PI)
      }

      const totalScale = layout.totalScale * growMul
      const monsterImg = monsterImgRef.current
      const aspect =
        monsterImg?.complete && monsterImg.naturalWidth > 0
          ? monsterImg.naturalHeight / monsterImg.naturalWidth
          : 0.62

      const baseW = Math.min(672, Math.max(360, (layout.canvasWordWidth + 180) * 1.2))
      // fail 성장(×1.5^n)·grow punch가 겹쳐도 몬스터가 스테이지 밖으로 잘리지 않도록 폭 상한
      const w = Math.min(MONSTER_MAX_WIDTH, baseW * totalScale)
      const h = w * aspect
      const bob = reduceMotion ? 0 : Math.sin(performance.now() / 260) * 5 * bobPhase
      const yCenter = getMonsterVisualCenterY(layout.approachProgress, wordZone.wordY) + bob
      const x = xCenter - w / 2
      const y = yCenter - h / 2
      const depthAlpha = 0.5 + 0.5 * layout.approachProgress

      return { x, y, w, h, xCenter, yCenter, depthAlpha, totalScale }
    }

    const drawMonsterBody = (layout: MonsterLayoutSnapshot, xCenter = layout.monsterX) => {
      const { x, y, w, h, xCenter: cx, yCenter, depthAlpha, totalScale } = getMonsterBodyRect(
        layout,
        xCenter,
      )
      const monsterImg = monsterImgRef.current

      ctx.save()

      // 발밑 그림자 — 접근할수록 커지고 진해져 접지감을 줌
      {
        const p = layout.approachProgress
        const shadowY = Math.min(CANVAS_HEIGHT - 24, y + h - 6)
        const rx = w * 0.46
        ctx.save()
        ctx.translate(cx, shadowY)
        ctx.scale(1, 0.2)
        const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
        sg.addColorStop(0, `rgba(15, 23, 42, ${0.34 + 0.26 * p})`)
        sg.addColorStop(0.65, `rgba(15, 23, 42, ${0.18 + 0.14 * p})`)
        sg.addColorStop(1, 'rgba(15, 23, 42, 0)')
        ctx.fillStyle = sg
        ctx.beginPath()
        ctx.arc(0, 0, rx, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      if (failCount > 0) {
        const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 180)
        ctx.save()
        const fg = ctx.createRadialGradient(cx, yCenter, h * 0.22, cx, yCenter, w * 0.62)
        fg.addColorStop(0, `rgba(251, 146, 60, ${0.22 * pulse})`)
        fg.addColorStop(0.55, `rgba(239, 68, 68, ${0.16 * pulse})`)
        fg.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = fg
        ctx.fillRect(x - 60, y - 60, w + 120, h + 120)
        ctx.restore()
      }

      if (monsterImg?.complete && monsterImg.naturalWidth > 0) {
        ctx.save()
        ctx.globalAlpha = depthAlpha
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(monsterImg, x, y, w, h)
        ctx.restore()
      } else {
        // fallback (이미지 로딩 실패 시 최소한의 실루엣)
        ctx.save()
        roundRect(ctx, x, y, w, h, 22 * totalScale)
        ctx.fillStyle = 'rgba(148, 163, 184, 0.16)'
        ctx.fill()
        ctx.restore()
      }

      ctx.restore()
    }

    const drawWordOnMonster = (layout: MonsterLayoutSnapshot, textMetrics: WordTextMetrics) => {
      const text = word.full.toUpperCase()
      ctx.save()
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'

      const len = Math.max(1, text.length)
      const totalW = textMetrics.totalWidth
      const baseX0 = layout.monsterX - totalW / 2
      const y = wordZone.wordY
      const heated = failCount > 0
      const textAlpha = getWordRevealAlpha(layout.approachProgress)
      if (textAlpha <= 0) {
        ctx.restore()
        return
      }

      const popScale = getWordPopScale(wordPopStartRef.current, reduceMotion)
      const textFailScale = layout.textFailScale
      const combinedScale = popScale * textFailScale

      ctx.save()
      ctx.translate(layout.monsterX, y)
      ctx.scale(combinedScale, combinedScale)
      ctx.translate(-layout.monsterX, -y)

      const padW = totalW + 56
      const padH = WORD_FONT_SIZE + 40
      const padX = baseX0 - 28
      const padY = y - padH / 2

      if (heated) {
        drawTextFlames(ctx, padX, padY, padW, padH, failCount, performance.now(), textAlpha, 'behind')
      }

      ctx.save()
      ctx.globalAlpha = textAlpha
      roundRect(ctx, padX, padY, padW, padH, 18)
      ctx.fillStyle = heated ? 'rgba(69, 26, 3, 0.55)' : 'rgba(212, 196, 232, 0.28)'
      ctx.fill()
      ctx.strokeStyle = heated ? 'rgba(251, 146, 60, 0.35)' : 'rgba(107, 76, 154, 0.35)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()

      ctx.save()
      ctx.globalAlpha = textAlpha
      for (let i = 0; i < len; i++) {
        const ch = text[i]!
        const cx = baseX0 + (textMetrics.charLeftOffsets[i] ?? 0)
        drawExtrudedChar(ctx, ch, cx, y, WORD_FONT_SIZE, heated, failCount)
      }
      ctx.restore()

      if (heated) {
        drawTextFlames(ctx, padX, padY, padW, padH, failCount, performance.now(), textAlpha, 'front')
      }

      ctx.restore()

      // 경계선은 판정(boundaryPixelX)과 동일 좌표 — popScale 변환 밖에서 그림
      ctx.save()
      ctx.globalAlpha = textAlpha
      const boundaryX = layout.boundaryPixelX

      if (gameStatus !== 'success') {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'
        ctx.setLineDash([6, 6])
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(boundaryX + 0.5, wordZone.wordZoneTop)
        ctx.lineTo(boundaryX + 0.5, wordZone.wordZoneBottom)
        ctx.stroke()
        ctx.setLineDash([])
      }

      if (gameStatus === 'fail' && failCount >= 1) {
        const alpha = failCount >= 2 ? 0.55 + 0.45 * Math.sin(performance.now() / 120) : 0.6
        ctx.strokeStyle = `rgba(250, 204, 21, ${alpha.toFixed(3)})`
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(boundaryX + 0.5, wordZone.wordZoneTop + 8)
        ctx.lineTo(boundaryX + 0.5, wordZone.wordZoneBottom - 8)
        ctx.stroke()
      }

      if (gameStatus === 'hint') {
        ctx.fillStyle = 'rgba(34, 211, 238, 0.9)'
        ctx.font = `18px ui-sans-serif, system-ui, Segoe UI, Roboto, Arial`
        ctx.textAlign = 'center'
        ctx.fillText(
          `${word.morpheme1} | ${word.morpheme2}`,
          layout.monsterX,
          wordZone.wordZoneBottom + 22,
        )
      }

      ctx.restore()

      ctx.restore()
    }

    const drawMonster = (layout: MonsterLayoutSnapshot, textMetrics: WordTextMetrics) => {
      drawMonsterBody(layout)
      drawWordOnMonster(layout, textMetrics)
    }

    const drawSplitMonster = (
      layout: MonsterLayoutSnapshot,
      textMetrics: WordTextMetrics,
      now: number,
    ) => {
      const body = getMonsterBodyRect(layout, layout.monsterX, 1)
      const { x, y, w, h, yCenter, depthAlpha } = body
      const cutX = layout.boundaryPixelX
      const cutLocal = Math.max(0.02, Math.min(0.98, (cutX - x) / w))

      const splitAge = now - successSplitStartRef.current
      const t = Math.min(1, splitAge / SUCCESS_SPLIT_MS)
      const ease = 1 - Math.pow(1 - t, 3)
      const offset = (reduceMotion ? 48 : SUCCESS_SPLIT_OFFSET_PX) * ease
      const rotRad = (reduceMotion ? 0 : SUCCESS_SPLIT_ROTATE_DEG) * ease * (Math.PI / 180)
      // 반쪽이 위로 떴다가 아래로 떨어지는 포물선 (선형 t 기준 — 중력 느낌)
      const arcY = reduceMotion ? 0 : SUCCESS_SPLIT_ARC_A * t * t - SUCCESS_SPLIT_ARC_B * t

      const monsterImg = monsterImgRef.current
      if (monsterImg?.complete && monsterImg.naturalWidth > 0) {
        const nw = monsterImg.naturalWidth
        const nh = monsterImg.naturalHeight
        const cutSrc = cutLocal * nw
        const leftSrcW = cutSrc
        const rightSrcW = nw - cutSrc
        const leftDestW = cutLocal * w
        const rightDestW = w - leftDestW
        const leftX = x - offset
        const rightX = cutX + offset

        ctx.save()
        ctx.globalAlpha = depthAlpha
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.translate(cutX, yCenter + arcY)
        ctx.rotate(-rotRad)
        ctx.translate(-cutX, -yCenter)
        ctx.drawImage(monsterImg, 0, 0, leftSrcW, nh, leftX, y, leftDestW, h)
        ctx.restore()

        ctx.save()
        ctx.globalAlpha = depthAlpha
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.translate(cutX, yCenter + arcY)
        ctx.rotate(rotRad)
        ctx.translate(-cutX, -yCenter)
        ctx.drawImage(monsterImg, cutSrc, 0, rightSrcW, nh, rightX, y, rightDestW, h)
        ctx.restore()
      } else {
        ctx.save()
        roundRect(ctx, x - offset, y + arcY, w * cutLocal, h, 22 * layout.totalScale)
        ctx.fillStyle = 'rgba(148, 163, 184, 0.2)'
        ctx.fill()
        roundRect(ctx, cutX + offset, y + arcY, w * (1 - cutLocal), h, 22 * layout.totalScale)
        ctx.fill()
        ctx.restore()
      }

      drawSplitWordHalves(layout, textMetrics, cutX, offset, rotRad, yCenter, arcY)
    }

    const drawSplitWordHalves = (
      layout: MonsterLayoutSnapshot,
      textMetrics: WordTextMetrics,
      cutX: number,
      offset: number,
      rotRad: number,
      yCenter: number,
      arcY = 0,
    ) => {
      const text = word.full.toUpperCase()
      const cutIdx = clampInt(word.boundaryIndex, 0, text.length)
      const len = Math.max(1, text.length)
      const y = wordZone.wordY
      const combinedScale = layout.textFailScale
      const totalW = textMetrics.totalWidth
      const baseX0 = layout.monsterX - totalW / 2
      const padH = WORD_FONT_SIZE + 40
      const padY = y - padH / 2
      ctx.save()
      ctx.translate(layout.monsterX, y)
      ctx.scale(combinedScale, combinedScale)
      ctx.translate(-layout.monsterX, -y)

      const cutLocalX = layout.monsterX + (cutX - layout.monsterX) / Math.max(1e-6, combinedScale)
      const yCenterLocal = y + (yCenter - y) / combinedScale
      const offsetLocal = offset / combinedScale
      const arcYLocal = arcY / combinedScale

      const applyHalfTransform = (side: 'left' | 'right') => {
        const dir = side === 'left' ? -1 : 1
        ctx.translate(dir * offsetLocal, arcYLocal)
        ctx.translate(cutLocalX, yCenterLocal)
        ctx.rotate(dir * rotRad)
        ctx.translate(-cutLocalX, -yCenterLocal)
      }

      if (cutIdx > 0) {
        ctx.save()
        applyHalfTransform('left')
        const leftPadX = baseX0 - 28
        const leftPadW = Math.max(40, cutLocalX - leftPadX + 12)
        roundRect(ctx, leftPadX, padY, leftPadW, padH, 18)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)'
        ctx.lineWidth = 2
        ctx.stroke()
        for (let i = 0; i < cutIdx; i++) {
          const ch = text[i]!
          const cx = baseX0 + (textMetrics.charLeftOffsets[i] ?? 0)
          drawExtrudedChar(ctx, ch, cx, y, WORD_FONT_SIZE, false, 0)
        }
        ctx.restore()
      }

      if (cutIdx < len) {
        ctx.save()
        applyHalfTransform('right')
        const rightPadX = cutLocalX - 12
        const rightPadW = Math.max(40, baseX0 + totalW + 28 - rightPadX)
        roundRect(ctx, rightPadX, padY, rightPadW, padH, 18)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)'
        ctx.lineWidth = 2
        ctx.stroke()
        for (let i = cutIdx; i < len; i++) {
          const ch = text[i]!
          const cx = baseX0 + (textMetrics.charLeftOffsets[i] ?? 0)
          drawExtrudedChar(ctx, ch, cx, y, WORD_FONT_SIZE, false, 0)
        }
        ctx.restore()
      }

      ctx.restore()
    }

    const drawSkeleton = () => {
      ctx.save()
      roundRect(ctx, CANVAS_WIDTH / 2 - 240, wordZone.wordY - 46, 480, 92, 22)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.16)'
      ctx.fill()
      roundRect(ctx, CANVAS_WIDTH / 2 - 160, wordZone.wordY - 16, 320, 34, 12)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.22)'
      ctx.fill()
      ctx.restore()
    }

    const drawNeonLaser = () => {
      const now = performance.now()
      const trail = trailRef.current
      let prune = 0
      while (prune < trail.length && now - trail[prune]!.t >= TRAIL_LIFE_MS) prune++
      if (prune > 0) trail.splice(0, prune)

      if (trail.length < 2) return

      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalCompositeOperation = 'lighter'

      const hotCombo = combo >= 3
      const warmCombo = combo >= 2

      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1]!
        const b = trail[i]!
        const life = Math.max(0, 1 - (now - b.t) / TRAIL_LIFE_MS)
        if (life <= 0) continue
        const progress = i / (trail.length - 1)
        const coreW = 2 + 7 * (1 - progress) * life

        const glowR = hotCombo ? 56 : warmCombo ? 168 : 168
        const glowG = hotCombo ? 189 : warmCombo ? 85 : 85
        const glowB = hotCombo ? 248 : warmCombo ? 247 : 247
        const coreR = hotCombo ? 253 : warmCombo ? 251 : 250
        const coreG = hotCombo ? 224 : warmCombo ? 191 : 204
        const coreB = hotCombo ? 71 : warmCombo ? 36 : 21

        ctx.strokeStyle = `rgba(${glowR}, ${glowG}, ${glowB}, ${0.14 * life})`
        ctx.lineWidth = coreW + 8
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()

        ctx.strokeStyle = `rgba(${coreR}, ${coreG}, ${coreB}, ${(hotCombo ? 0.78 : 0.62) * life})`
        ctx.lineWidth = coreW
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()

        ctx.strokeStyle = `rgba(255, 255, 255, ${(hotCombo ? 0.42 : 0.28) * life})`
        ctx.lineWidth = Math.max(1.5, coreW * 0.35)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }

      ctx.restore()
    }

    const drawDeflection = () => {
      const d = deflectRef.current
      if (!d) return
      const age = performance.now() - d.startMs
      if (age > DEFLECT_BEAM_MS) {
        deflectRef.current = null
        return
      }

      const t = age / DEFLECT_BEAM_MS
      const alpha = 1 - t * t
      const pathLen = d.segments.reduce(
        (sum, seg) => sum + Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1),
        0,
      )
      const travel = Math.min(pathLen, (70 + t * 420) * (1 - t * 0.12))

      drawDeflectImpactSpark(ctx, d.x, d.y, age, reduceMotion)
      drawDeflectBeamAlongPath(
        ctx,
        d.segments,
        travel,
        alpha,
        reduceMotion ? 3 : 5 + (1 - t) * 4,
      )
    }

    const drawInstruction = (layout: MonsterLayoutSnapshot) => {
      ctx.save()
      ctx.font = `18px ui-sans-serif, system-ui, Segoe UI, Roboto, Arial`
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const msg =
        failCount > 0
          ? `Monster grew x${failScale.toFixed(1)}! Find the boundary!`
          : layout.approachProgress < 0.45
            ? 'A monster is approaching… slash the morpheme boundary!'
            : 'Slash the morpheme boundary!'
      ctx.fillText(msg, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 110)
      ctx.restore()
    }

    const frame = (now: number) => {
      const deltaMs = Math.min(48, now - lastFrameMs)
      lastFrameMs = now
      const hitStopped = !reduceMotion && now < hitStopUntilRef.current
      const deltaSec = hitStopped ? 0 : deltaMs / 1000
      const effectNow = hitStopped
        ? gameStatus === 'success'
          ? successSplitStartRef.current
          : failFrozenAtRef.current || now
        : now
      const speed = getMonsterSpeedPxPerSec(failCount, wordsDone)

      if (gameStatus === 'playing') {
        approachRef.current += (speed / APPROACH_EQUIV_DISTANCE_PX) * deltaSec
        approachRef.current = Math.min(1, approachRef.current)

        // 발걸음 박자 — 가까워질수록 간격이 짧아짐 (발소리 연출)
        const p = approachRef.current
        if (!loading && p > 0.04 && p < 0.96) {
          const stepIntervalMs = 680 - 380 * p
          if (now - lastStepMsRef.current >= stepIntervalMs) {
            lastStepMsRef.current = now
            onMonsterStepRef.current?.(p)
          }
        }
      }

      if (textMetricsWordIdRef.current !== word.id || !textMetricsRef.current) {
        textMetricsRef.current = measureWordText(ctx, word.full)
        textMetricsWordIdRef.current = word.id
      }
      const textMetrics = textMetricsRef.current
      const textFailScale = getAnimatedTextFailScale(
        failCount,
        growPunchStartRef.current,
        reduceMotion,
      )
      const textVisualScale = getWordPopScale(wordPopStartRef.current, reduceMotion) * textFailScale
      const layout = computeMonsterLayout(
        word,
        approachRef.current,
        failCount,
        textMetrics,
        textFailScale,
        textVisualScale,
      )
      layoutSnapshotRef.current = layout

      const wordVisible = getWordRevealAlpha(layout.approachProgress) > 0
      if (wordVisible && !prevWordVisibleRef.current) {
        wordPopStartRef.current = now
      }
      prevWordVisibleRef.current = wordVisible

      if (onLayoutSnapshot && now - lastLayoutEmitRef.current > 120) {
        lastLayoutEmitRef.current = now
        onLayoutSnapshot(layout)
      }

      const drawLayout =
        gameStatus === 'success' && frozenSuccessLayoutRef.current
          ? frozenSuccessLayoutRef.current
          : layout

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      drawBackground(drawLayout)

      if (loading) {
        drawSkeleton()
      } else if (gameStatus === 'success') {
        tickDebrisWaves(debrisWaveStateRef, splitDebrisRef, dustPuffsRef, effectNow)
        drawSplitMonster(drawLayout, textMetrics, effectNow)
        updateSplitDebris(splitDebrisRef.current, deltaSec, effectNow)
        drawDustPuffs(ctx, dustPuffsRef.current, effectNow)
        drawSplitDebris(ctx, splitDebrisRef.current, effectNow)
        updateStarConfetti(starConfettiRef.current, deltaSec)
        drawStarConfetti(ctx, starConfettiRef.current, effectNow)
      } else {
        drawMonster(layout, textMetrics)
      }

      if (missDebrisRef.current.length > 0) {
        updateSplitDebris(missDebrisRef.current, deltaSec, effectNow)
        drawSplitDebris(ctx, missDebrisRef.current, effectNow)
        missDebrisRef.current = missDebrisRef.current.filter(
          (p) => effectNow - p.bornAt < p.lifeMs,
        )
      }

      drawNeonLaser()
      drawDeflection()
      drawFailJuiceEffects(ctx, failJuiceRef.current, now, reduceMotion)
      drawSuccessJuiceEffects(ctx, successJuiceRef.current, now, reduceMotion)
      if (gameStatus !== 'success') {
        drawInstruction(layout)
      }

      if (import.meta.env.DEV && devOverlay) {
        const tol = AGE_TOLERANCE[ageMode]
        const touchX = lastTouchXRef.current
        ctx.save()
        ctx.fillStyle = 'rgba(34, 197, 94, 0.12)'
        ctx.fillRect(layout.boundaryPixelX - tol, 0, tol * 2, CANVAS_HEIGHT)
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(layout.boundaryPixelX + 0.5, 0)
        ctx.lineTo(layout.boundaryPixelX + 0.5, CANVAS_HEIGHT)
        ctx.stroke()
        if (touchX != null) {
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)'
          ctx.beginPath()
          ctx.moveTo(touchX + 0.5, 0)
          ctx.lineTo(touchX + 0.5, CANVAS_HEIGHT)
          ctx.stroke()
        }
        ctx.fillStyle = 'rgba(226, 232, 240, 0.9)'
        ctx.font = '12px ui-monospace, monospace'
        ctx.textBaseline = 'top'
        ctx.fillText(
          `approach=${(layout.approachProgress * 100).toFixed(0)}% scale=${layout.totalScale.toFixed(2)} speed=${speed.toFixed(0)}px/s`,
          10,
          10,
        )
        ctx.restore()
      }

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [
    word,
    gameStatus,
    failCount,
    loading,
    devOverlay,
    ageMode,
    failScale,
    wordZone,
    onLayoutSnapshot,
    combo,
    reduceMotion,
    wordsDone,
  ])

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <motion.div className="h-full w-full" animate={shakeControls}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block h-full w-full touch-none select-none"
          aria-label="Laser Hunter Game Canvas"
        />
      </motion.div>
    </div>
  )
}

function drawExtrudedChar(
  ctx: CanvasRenderingContext2D,
  ch: string,
  x: number,
  y: number,
  fontSize: number,
  heated: boolean,
  failCount = 0,
) {
  ctx.save()
  applyWordFont(ctx, fontSize)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2

  const depth = 10
  const heatPulse = heated ? 0.85 + 0.15 * Math.sin(performance.now() / 140 + x * 0.02) : 1

  // 부드러운 드롭 섀도
  ctx.fillStyle = heated ? 'rgba(127, 29, 29, 0.38)' : 'rgba(74, 45, 110, 0.34)'
  ctx.fillText(ch, x + depth + 5, y + depth + 6)

  // 3D 돌출 측면
  for (let d = depth; d >= 1; d--) {
    const t = d / depth
    if (heated) {
      const boost = 1 + failCount * 0.08
      const r = Math.round((140 + t * 40) * boost * heatPulse)
      const g = Math.round((22 + t * 12) * (1 - failCount * 0.05))
      const b = Math.round(8 + t * 6)
      ctx.fillStyle = `rgb(${Math.min(255, r)}, ${g}, ${b})`
    } else {
      const r = Math.round(107 - t * 44) // #6b4c9a → #3d2560
      const g = Math.round(76 - t * 34)
      const b = Math.round(154 - t * 70)
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
    }
    ctx.fillText(ch, x + d, y + d)
  }

  // 두꺼운 외곽선
  ctx.lineWidth = 10
  ctx.strokeStyle = heated ? '#7f1d1d' : '#3d2560'
  ctx.strokeText(ch, x, y)

  ctx.lineWidth = 2.5
  ctx.strokeStyle = heated ? 'rgba(254, 202, 202, 0.9)' : 'rgba(255, 255, 255, 0.85)'
  ctx.strokeText(ch, x, y)

  // 앞면 — 단색 (파닉스 가독성 우선)
  ctx.fillStyle = heated ? '#fff7ed' : '#ffffff'
  ctx.fillText(ch, x, y)

  // 상단 하이라이트
  ctx.fillStyle = heated ? 'rgba(255, 251, 235, 0.5)' : 'rgba(255, 255, 255, 0.42)'
  ctx.fillText(ch, x - 1, y - 2.5)

  ctx.restore()
}

function drawTextFlames(
  ctx: CanvasRenderingContext2D,
  padX: number,
  padY: number,
  padW: number,
  padH: number,
  failCount: number,
  now: number,
  alpha: number,
  layer: 'behind' | 'front',
) {
  if (failCount <= 0 || alpha <= 0) return

  const intensity = 0.38 + failCount * 0.24
  const particleCount = layer === 'behind' ? 10 + failCount * 14 : 4 + failCount * 5

  if (layer === 'behind') {
    ctx.save()
    ctx.globalAlpha = alpha * intensity * 0.5
    const cx = padX + padW / 2
    const cy = padY + padH / 2
    const glowR = Math.max(padW, padH) * (0.58 + failCount * 0.14)
    const pulse = 0.75 + 0.25 * Math.sin(now / 160)
    const g = ctx.createRadialGradient(cx, cy, glowR * 0.08, cx, cy, glowR * pulse)
    g.addColorStop(0, `rgba(239, 68, 68, ${0.62 * intensity})`)
    g.addColorStop(0.4, `rgba(249, 115, 22, ${0.4 * intensity})`)
    g.addColorStop(0.75, `rgba(251, 191, 36, ${0.12 * intensity})`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(padX - glowR * 0.35, padY - glowR * 0.45, padW + glowR * 0.7, padH + glowR * 0.85)
    ctx.restore()
  }

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = alpha * intensity * (layer === 'front' ? 0.75 : 1)

  for (let i = 0; i < particleCount; i++) {
    const seed = i * 928371 + failCount * 131
    const bxNorm = ((seed * 1103515245 + 12345) >>> 0) / 4294967296
    const bx = padX + bxNorm * padW
    const phase = ((seed * 2654435761) >>> 0) / 4294967296
    const cycle = (now / (260 + (i % 6) * 35) + phase) % 1
    const rise = padH * (0.3 + cycle * 0.95)
    const fy = padY + padH - rise + Math.sin(now / 150 + i * 1.7) * (5 + failCount * 2.5)
    const fx = bx + Math.sin(now / 210 + phase * 8) * (11 + failCount * 5)
    const r = (2.4 + failCount * 2) * (1 - cycle * 0.55)
    if (r <= 0.25) continue

    const t = cycle
    const r255 = Math.round(220 + t * 35)
    const g255 = Math.round(40 + t * 200)
    const b255 = Math.round(20 + t * 20)
    const particleAlpha = (1 - t * 0.82) * (0.45 + 0.55 * Math.sin(now / 95 + i * 1.3))

    ctx.beginPath()
    ctx.ellipse(fx, fy, r * 0.85, r * 1.4, 0, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${r255}, ${g255}, ${b255}, ${Math.max(0, particleAlpha).toFixed(3)})`
    ctx.fill()
  }

  if (layer === 'front') {
    const tongueCount = 3 + failCount * 2
    for (let i = 0; i < tongueCount; i++) {
      const tx = padX + ((i + 0.5) / tongueCount) * padW
      const wobble = Math.sin(now / 85 + i * 2.1) * (7 + failCount * 2)
      const th = 16 + failCount * 9 + Math.sin(now / 110 + i) * 7
      ctx.beginPath()
      ctx.moveTo(tx - 9, padY + padH)
      ctx.quadraticCurveTo(tx + wobble, padY + padH - th * 0.72, tx, padY + padH - th)
      ctx.quadraticCurveTo(tx - wobble * 0.45, padY + padH - th * 0.48, tx + 9, padY + padH)
      ctx.fillStyle = `rgba(251, 146, 60, ${(0.38 + failCount * 0.1).toFixed(3)})`
      ctx.fill()
    }
  }

  ctx.restore()
}

/** 스와이프 궤적이 단어 높이(wordY)를 지나는 X — 대각선·드리프트 보정 */
function getSlashXAtWordY(
  start: { x: number; y: number },
  end: { x: number; y: number },
  wordY: number,
): number {
  const dy = end.y - start.y
  if (Math.abs(dy) < 1e-3) return end.x
  const t = (wordY - start.y) / dy
  if (t < 0) return start.x
  if (t > 1) return end.x
  return start.x + (end.x - start.x) * t
}

function clampInt(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}

function computeMonsterBodyRectStatic(
  layout: MonsterLayoutSnapshot,
  monsterImg: HTMLImageElement | null,
  wordY: number,
): MonsterBodyRect {
  const totalScale = layout.totalScale
  const aspect =
    monsterImg?.complete && monsterImg.naturalWidth > 0
      ? monsterImg.naturalHeight / monsterImg.naturalWidth
      : 0.62
  const baseW = Math.min(672, Math.max(360, (layout.canvasWordWidth + 180) * 1.2))
  const w = Math.min(MONSTER_MAX_WIDTH, baseW * totalScale)
  const h = w * aspect
  const yCenter = getMonsterVisualCenterY(layout.approachProgress, wordY)
  const x = layout.monsterX - w / 2
  const y = yCenter - h / 2
  const depthAlpha = 0.5 + 0.5 * layout.approachProgress
  return { x, y, w, h, xCenter: layout.monsterX, yCenter, depthAlpha, totalScale }
}

function buildDeflectSegments(
  x0: number,
  y0: number,
  angle: number,
  maxBounces = 2,
): DeflectSegment[] {
  const segments: DeflectSegment[] = []
  const margin = 12
  const segLen = 170
  let x = x0
  let y = y0
  let dir = angle

  for (let bounce = 0; bounce <= maxBounces; bounce++) {
    const tx = x + Math.cos(dir) * segLen
    const ty = y + Math.sin(dir) * segLen
    let hitWall: 'left' | 'right' | 'top' | 'bottom' | null = null
    let tHit = 1

    const consider = (t: number, wall: typeof hitWall) => {
      if (t > 0.001 && t <= 1 && t < tHit) {
        tHit = t
        hitWall = wall
      }
    }

    if (Math.abs(tx - x) > 1e-6) {
      if (tx < x) consider((margin - x) / (tx - x), 'left')
      if (tx > x) consider((CANVAS_WIDTH - margin - x) / (tx - x), 'right')
    }
    if (Math.abs(ty - y) > 1e-6) {
      if (ty < y) consider((margin - y) / (ty - y), 'top')
      if (ty > y) consider((CANVAS_HEIGHT - margin - y) / (ty - y), 'bottom')
    }

    const ex = x + (tx - x) * tHit
    const ey = y + (ty - y) * tHit
    segments.push({ x1: x, y1: y, x2: ex, y2: ey })

    if (!hitWall || bounce >= maxBounces) break

    x = ex
    y = ey
    if (hitWall === 'left' || hitWall === 'right') dir = Math.PI - dir
    else dir = -dir
  }

  return segments
}

function drawDeflectBeamAlongPath(
  ctx: CanvasRenderingContext2D,
  segments: DeflectSegment[],
  travelDist: number,
  alpha: number,
  coreW: number,
) {
  let remaining = travelDist
  for (const seg of segments) {
    const dx = seg.x2 - seg.x1
    const dy = seg.y2 - seg.y1
    const len = Math.hypot(dx, dy)
    if (len < 1e-6) continue
    if (remaining <= 0) break
    const drawLen = Math.min(remaining, len)
    const x2 = seg.x1 + (dx / len) * drawLen
    const y2 = seg.y1 + (dy / len) * drawLen
    strokeNeonBeamSegment(ctx, seg.x1, seg.y1, x2, y2, alpha, coreW)
    remaining -= len
  }
}

function spawnMissDebris(
  x: number,
  y: number,
  floorY: number,
  now: number,
  reduceMotion: boolean,
): DebrisFragment[] {
  const count = reduceMotion ? MISS_DEBRIS_COUNT.reduce : MISS_DEBRIS_COUNT.normal
  const pieces: DebrisFragment[] = []

  for (let i = 0; i < count; i++) {
    const seed = i + 1
    const side: -1 | 1 = i % 2 === 0 ? -1 : 1
    const kind: DebrisKind = i % 3 === 0 ? 'chunk' : 'medium'
    const angle =
      side < 0
        ? Math.PI * (0.62 + debrisRand(seed + 41) * 0.22)
        : Math.PI * (0.16 + debrisRand(seed + 41) * 0.2)
    const speed = (reduceMotion ? 260 : 380) + debrisRand(seed + 11) * (reduceMotion ? 160 : 260)
    const palette = STONE_PALETTE[seed % STONE_PALETTE.length]!
    const size =
      kind === 'chunk'
        ? (reduceMotion ? 6 : 8) + debrisRand(seed + 23) * (reduceMotion ? 4 : 7)
        : (reduceMotion ? 4 : 5.5) + debrisRand(seed + 23) * (reduceMotion ? 3 : 5)

    pieces.push({
      x: x + (debrisRand(seed + 7) - 0.5) * 14,
      y: y + (debrisRand(seed + 3) - 0.5) * 10,
      vx: Math.cos(angle) * speed + (debrisRand(seed + 17) - 0.5) * 24,
      vy: -Math.sin(angle) * speed * 1.25,
      rot: debrisRand(seed + 31) * Math.PI * 2,
      rotSpeed: side * (reduceMotion ? 4 : 8 + debrisRand(seed + 37) * 5),
      size,
      verts: makeDebrisVerts(seed, kind),
      fill: palette.fill,
      stroke: palette.stroke,
      highlight: palette.highlight,
      bornAt: now,
      lifeMs:
        (reduceMotion ? 900 : 1300) + debrisRand(seed + 29) * (reduceMotion ? 250 : 400),
      kind,
      floorY,
      bouncesLeft: reduceMotion ? 1 : 2,
    })
  }

  return pieces
}

function drawFailJuiceEffects(
  ctx: CanvasRenderingContext2D,
  juice: FailJuiceSnapshot | null,
  now: number,
  reduceMotion: boolean,
) {
  if (!juice) return
  const age = now - juice.startMs
  if (age < 0) return

  if (age < FAIL_FLASH_MS) {
    const t = age / FAIL_FLASH_MS
    const alpha = (1 - t) * (reduceMotion ? 0.22 : 0.38)
    const r = 40 + t * (reduceMotion ? 220 : 360)
    const g = ctx.createRadialGradient(juice.x, juice.y, 0, juice.x, juice.y, r)
    g.addColorStop(0, `rgba(255, 228, 196, ${alpha})`)
    g.addColorStop(0.35, `rgba(251, 146, 60, ${alpha * 0.65})`)
    g.addColorStop(0.7, `rgba(239, 68, 68, ${alpha * 0.22})`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.save()
    ctx.fillStyle = g
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    ctx.restore()
  }
}

function computeDeflectReflectAngle(
  trail: TrailPoint[],
  touchX: number,
  boundaryX: number,
): number {
  if (trail.length >= 2) {
    const last = trail[trail.length - 1]!
    const prev = trail[trail.length - 2]!
    const dx = last.x - prev.x
    const dy = last.y - prev.y
    if (dx * dx + dy * dy > 4) {
      return Math.PI - Math.atan2(dy, dx)
    }
  }
  const away = touchX >= boundaryX ? 1 : -1
  return away > 0 ? 0.25 + Math.random() * 0.55 : Math.PI - 0.25 - Math.random() * 0.55
}

function strokeNeonBeamSegment(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  alpha: number,
  coreW: number,
) {
  if (alpha <= 0) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalCompositeOperation = 'lighter'

  ctx.strokeStyle = `rgba(168, 85, 247, ${(0.14 * alpha).toFixed(3)})`
  ctx.lineWidth = coreW + 8
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()

  ctx.strokeStyle = `rgba(250, 204, 21, ${(0.62 * alpha).toFixed(3)})`
  ctx.lineWidth = coreW
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()

  ctx.strokeStyle = `rgba(255, 255, 255, ${(0.28 * alpha).toFixed(3)})`
  ctx.lineWidth = Math.max(1.5, coreW * 0.35)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()

  ctx.restore()
}

function drawDeflectImpactSpark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  age: number,
  reduceMotion: boolean,
) {
  if (age < 0 || age >= DEFLECT_SPARK_MS) return

  const t = age / DEFLECT_SPARK_MS
  const flashAlpha = (1 - t) * 0.42
  const r = 18 + t * 70
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, `rgba(255, 237, 213, ${flashAlpha})`)
  g.addColorStop(0.35, `rgba(251, 146, 60, ${flashAlpha * 0.75})`)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.save()
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  if (reduceMotion) return

  for (let ring = 0; ring < 2; ring++) {
    const rt = Math.max(0, (t - ring * 0.12) / (1 - ring * 0.12))
    if (rt <= 0 || rt > 1) continue
    const radius = 12 + rt * (48 + ring * 22)
    const alpha = (1 - rt) * (0.62 - ring * 0.18)
    ctx.save()
    ctx.strokeStyle = `rgba(249, 115, 22, ${alpha.toFixed(3)})`
    ctx.lineWidth = Math.max(1, 3.5 - ring * 0.8)
    ctx.shadowColor = '#fb923c'
    ctx.shadowBlur = 10 * alpha
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

function drawSuccessJuiceEffects(
  ctx: CanvasRenderingContext2D,
  juice: SuccessJuiceSnapshot | null,
  now: number,
  reduceMotion: boolean,
) {
  if (!juice) return
  const age = now - juice.startMs
  if (age < 0) return

  if (!reduceMotion && age < SUCCESS_SHOCKWAVE_MS) {
    const t = age / SUCCESS_SHOCKWAVE_MS
    for (let ring = 0; ring < 2; ring++) {
      const rt = Math.max(0, (t - ring * 0.14) / (1 - ring * 0.14))
      if (rt <= 0 || rt > 1) continue
      const radius = 36 + rt * (200 + ring * 70)
      const alpha = (1 - rt) * (0.58 - ring * 0.18)
      ctx.save()
      ctx.strokeStyle = `rgba(253, 224, 71, ${alpha.toFixed(3)})`
      ctx.lineWidth = Math.max(1, 4.5 - ring * 1.4)
      ctx.shadowColor = '#fde047'
      ctx.shadowBlur = 12 * alpha
      ctx.beginPath()
      ctx.arc(juice.cutX, juice.yCenter, radius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }

  if (age < 260) {
    const t = age / 260
    const alpha = (1 - t) * 0.48
    const r = 50 + t * 400
    const g = ctx.createRadialGradient(juice.cutX, juice.yCenter, 0, juice.cutX, juice.yCenter, r)
    g.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
    g.addColorStop(0.3, `rgba(253, 224, 71, ${alpha * 0.7})`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.save()
    ctx.fillStyle = g
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    ctx.restore()
  }
}

function debrisRand(seed: number): number {
  return ((seed * 1103515245 + 12345) >>> 0) / 4294967296
}

function spawnStarConfetti(
  x: number,
  y: number,
  now: number,
  reduceMotion: boolean,
): StarConfetti[] {
  const count = reduceMotion ? 10 : 28
  const stars: StarConfetti[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (debrisRand(i + 11) - 0.5) * 0.9
    const speed = 220 + debrisRand(i + 29) * 420
    stars.push({
      x: x + (debrisRand(i + 5) - 0.5) * 30,
      y: y + (debrisRand(i + 7) - 0.5) * 40,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 160,
      rot: debrisRand(i + 13) * Math.PI * 2,
      rotSpeed: (debrisRand(i + 17) - 0.5) * 10,
      size: 7 + debrisRand(i + 23) * 9,
      color: STAR_CONFETTI_COLORS[i % STAR_CONFETTI_COLORS.length]!,
      bornAt: now,
      lifeMs: 900 + debrisRand(i + 31) * 500,
    })
  }
  return stars
}

function updateStarConfetti(stars: StarConfetti[], deltaSec: number) {
  if (deltaSec <= 0) return
  const drag = Math.exp(-1.6 * deltaSec)
  for (const s of stars) {
    s.vy += 620 * deltaSec
    s.vx *= drag
    s.x += s.vx * deltaSec
    s.y += s.vy * deltaSec
    s.rot += s.rotSpeed * deltaSec
  }
}

function drawStarConfetti(ctx: CanvasRenderingContext2D, stars: StarConfetti[], now: number) {
  for (const s of stars) {
    const age = now - s.bornAt
    if (age < 0 || age >= s.lifeMs) continue
    const t = age / s.lifeMs
    const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(s.x, s.y)
    ctx.rotate(s.rot)
    ctx.fillStyle = s.color
    ctx.shadowColor = s.color
    ctx.shadowBlur = 8
    drawStarPath(ctx, s.size)
    ctx.fill()
    ctx.restore()
  }
}

function drawStarPath(ctx: CanvasRenderingContext2D, r: number) {
  const inner = r * 0.45
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : inner
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad)
    else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad)
  }
  ctx.closePath()
}

function makeDebrisVerts(seed: number, kind: DebrisKind): [number, number][] {
  if (kind === 'dust') {
    const a = debrisRand(seed) * Math.PI * 2
    return [
      [Math.cos(a) * 0.5, Math.sin(a) * 0.35],
      [Math.cos(a + 1.2) * 0.45, Math.sin(a + 1.2) * 0.4],
      [Math.cos(a + 2.4) * 0.4, Math.sin(a + 2.4) * 0.38],
    ]
  }
  const count = kind === 'chunk' ? 4 + (seed % 2) : 3 + (seed % 3)
  const verts: [number, number][] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + seed * 0.41
    const r = 0.4 + debrisRand(seed + i * 17) * 0.6
    verts.push([Math.cos(angle) * r, Math.sin(angle) * r])
  }
  return verts
}

function tickDebrisWaves(
  waveStateRef: { current: DebrisWaveState | null },
  debrisRef: { current: DebrisFragment[] },
  puffsRef: { current: DustPuff[] },
  now: number,
) {
  const ws = waveStateRef.current
  if (!ws) return

  const elapsed = now - ws.startMs
  while (ws.wavesSpawned < DEBRIS_WAVE_DELAYS_MS.length) {
    const delay = DEBRIS_WAVE_DELAYS_MS[ws.wavesSpawned]!
    if (elapsed < delay) break
    const waveIndex = ws.wavesSpawned
    debrisRef.current.push(...spawnDebrisWave(waveIndex, ws, now))
    if (waveIndex === 0 || waveIndex === 3) {
      puffsRef.current.push(...spawnDustPuffs(ws, now, waveIndex))
    }
    ws.wavesSpawned++
  }
}

function spawnDustPuffs(ws: DebrisWaveState, now: number, waveIndex: number): DustPuff[] {
  const count = ws.reduceMotion ? 6 : waveIndex === 0 ? 12 : 8
  const puffs: DustPuff[] = []
  const span = Math.max(40, ws.yBottom - ws.yTop)
  const driftScale = ws.reduceMotion ? 70 : waveIndex === 0 ? 160 : 120

  for (let i = 0; i < count; i++) {
    const side: -1 | 1 = i % 2 === 0 ? -1 : 1
    const y = ws.yTop + debrisRand(i + 91 + waveIndex * 17) * span
    puffs.push({
      x: ws.cutX + (debrisRand(i + 37) - 0.5) * 16,
      y,
      bornAt: now,
      lifeMs: ws.reduceMotion ? 720 : 1050,
      maxRadius: (ws.reduceMotion ? 22 : 32) + debrisRand(i + 53) * (ws.reduceMotion ? 18 : 28),
      driftX: side * (driftScale * 0.45 + debrisRand(i + 71) * driftScale * 0.55),
      driftY: -(ws.reduceMotion ? 50 : 90) - debrisRand(i + 83) * (ws.reduceMotion ? 55 : 95),
    })
  }
  return puffs
}

function spawnDebrisWave(
  waveIndex: number,
  ws: DebrisWaveState,
  now: number,
): DebrisFragment[] {
  const kind = DEBRIS_WAVE_KINDS[waveIndex] ?? 'dust'
  const counts = ws.reduceMotion ? DEBRIS_WAVE_COUNTS.reduce : DEBRIS_WAVE_COUNTS.normal
  const count = Math.round((counts[waveIndex] ?? 12) * ws.countMul)
  const span = Math.max(40, ws.yBottom - ws.yTop)
  const pieces: DebrisFragment[] = []

  for (let i = 0; i < count; i++) {
    const seed = waveIndex * 1000 + i + 1
    const side: -1 | 1 = i % 2 === 0 ? -1 : 1
    const y = ws.yTop + debrisRand(seed + 3) * span
    const x = ws.cutX + (debrisRand(seed + 7) - 0.5) * 12
    const speedMul = ws.reduceMotion ? 0.58 : 1
    const waveBoost = waveIndex === 0 ? 1.35 : waveIndex <= 2 ? 1.12 : 0.95
    const baseSpeed =
      kind === 'chunk' ? 420 + debrisRand(seed + 11) * 300
      : kind === 'medium' ? 350 + debrisRand(seed + 11) * 240
      : 250 + debrisRand(seed + 11) * 180
    const speed = baseSpeed * speedMul * waveBoost * (0.92 + debrisRand(seed + 13) * 0.18)
    const upwardBias = waveIndex === 0 ? 1.45 : waveIndex <= 2 ? 1.2 : 1.1
    const isVerticalBurst = waveIndex === 0 && i % 5 === 0

    let vx: number
    let vy: number
    if (isVerticalBurst) {
      const upSpeed = speed * (1.15 + debrisRand(seed + 59) * 0.3)
      vx = (debrisRand(seed + 61) - 0.5) * 45
      vy = -upSpeed * 1.55
    } else {
      const angle =
        side < 0
          ? Math.PI * (0.7 + debrisRand(seed + 41) * 0.18)
          : Math.PI * (0.11 + debrisRand(seed + 41) * 0.17)
      vx = Math.cos(angle) * speed + (debrisRand(seed + 17) - 0.5) * 28
      vy = -Math.sin(angle) * speed * upwardBias
    }
    const palette = STONE_PALETTE[(seed + waveIndex) % STONE_PALETTE.length]!
    const size =
      kind === 'chunk'
        ? (ws.reduceMotion ? 7 : 10) + debrisRand(seed + 23) * (ws.reduceMotion ? 5 : 9)
        : kind === 'medium'
          ? (ws.reduceMotion ? 4.5 : 6) + debrisRand(seed + 23) * (ws.reduceMotion ? 4 : 7)
          : (ws.reduceMotion ? 2 : 2.8) + debrisRand(seed + 23) * (ws.reduceMotion ? 2 : 4)
    const lifeMs =
      kind === 'chunk'
        ? (ws.reduceMotion ? 1400 : 2300) + debrisRand(seed + 29) * (ws.reduceMotion ? 300 : 450)
        : kind === 'medium'
          ? (ws.reduceMotion ? 1200 : 2100) + debrisRand(seed + 29) * (ws.reduceMotion ? 280 : 380)
          : (ws.reduceMotion ? 1000 : 1700) + debrisRand(seed + 29) * (ws.reduceMotion ? 240 : 320)

    pieces.push({
      x,
      y,
      vx,
      vy,
      rot: debrisRand(seed + 31) * Math.PI * 2,
      rotSpeed: side * (ws.reduceMotion ? 3 : 7 + debrisRand(seed + 37) * 6),
      size,
      verts: makeDebrisVerts(seed, kind),
      fill: palette.fill,
      stroke: palette.stroke,
      highlight: palette.highlight,
      bornAt: now,
      lifeMs,
      kind,
      floorY: ws.floorY,
      bouncesLeft: kind === 'dust' ? 0 : ws.reduceMotion ? 1 : 2,
    })
  }

  return pieces
}

function debrisAlpha(age: number, lifeMs: number): number {
  if (age < 0 || age >= lifeMs) return 0
  const t = age / lifeMs
  if (t < DEBRIS_FADE_AFTER) return 1
  return 1 - (t - DEBRIS_FADE_AFTER) / (1 - DEBRIS_FADE_AFTER)
}

function updateSplitDebris(pieces: DebrisFragment[], deltaSec: number, now: number) {
  const dragX = Math.pow(DEBRIS_DRAG_X, deltaSec * 60)
  const dragY = Math.pow(DEBRIS_DRAG_Y, deltaSec * 60)

  for (const p of pieces) {
    if (now < p.bornAt) continue
    const age = now - p.bornAt
    if (age >= p.lifeMs) continue

    const gravityMul = age < DEBRIS_GRAVITY_BURST_MS ? DEBRIS_GRAVITY_BURST_MUL : 1
    const vyDrag =
      age < DEBRIS_VY_DRAG_FREE_MS
        ? Math.pow(0.996, deltaSec * 60)
        : dragY

    p.vx *= dragX
    p.vy *= vyDrag
    p.vy += DEBRIS_GRAVITY * gravityMul * deltaSec
    p.x += p.vx * deltaSec
    p.y += p.vy * deltaSec
    p.rot += p.rotSpeed * deltaSec

    if (p.bouncesLeft > 0 && p.vy > 0 && p.y >= p.floorY) {
      p.y = p.floorY
      p.vy *= -DEBRIS_BOUNCE
      p.vx *= 0.72
      p.rotSpeed *= 0.65
      p.bouncesLeft--
    }
  }
}

function drawDustPuffs(ctx: CanvasRenderingContext2D, puffs: DustPuff[], now: number) {
  for (const puff of puffs) {
    const age = now - puff.bornAt
    if (age < 0 || age >= puff.lifeMs) continue

    const t = age / puff.lifeMs
    const alpha = (1 - t) * 0.38
    const radius = puff.maxRadius * (0.25 + t * 0.95)
    const x = puff.x + puff.driftX * t
    const y = puff.y + puff.driftY * t

    ctx.save()
    ctx.globalAlpha = alpha
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius)
    g.addColorStop(0, 'rgba(214, 211, 209, 0.55)')
    g.addColorStop(0.45, 'rgba(168, 162, 158, 0.28)')
    g.addColorStop(1, 'rgba(120, 113, 108, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function drawSplitDebris(ctx: CanvasRenderingContext2D, pieces: DebrisFragment[], now: number) {
  if (pieces.length === 0) return

  for (const p of pieces) {
    const age = now - p.bornAt
    const alpha = debrisAlpha(age, p.lifeMs)
    if (alpha <= 0) continue

    ctx.save()
    ctx.globalAlpha = alpha

    if (p.kind !== 'dust') {
      ctx.save()
      ctx.globalAlpha = alpha * 0.28
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
      ctx.beginPath()
      ctx.ellipse(p.x + 2, p.floorY + 3, p.size * 0.85, p.size * 0.28, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)

    if (p.kind === 'dust') {
      ctx.beginPath()
      ctx.arc(0, 0, p.size * 0.55, 0, Math.PI * 2)
      ctx.fillStyle = p.fill
      ctx.fill()
      ctx.restore()
      continue
    }

    ctx.beginPath()
    const first = p.verts[0]
    if (!first) {
      ctx.restore()
      continue
    }
    ctx.moveTo(first[0] * p.size, first[1] * p.size)
    for (let i = 1; i < p.verts.length; i++) {
      const v = p.verts[i]!
      ctx.lineTo(v[0] * p.size, v[1] * p.size)
    }
    ctx.closePath()

    const grad = ctx.createLinearGradient(-p.size, -p.size, p.size * 0.6, p.size * 0.8)
    grad.addColorStop(0, p.highlight)
    grad.addColorStop(0.55, p.fill)
    grad.addColorStop(1, p.stroke)
    ctx.fillStyle = grad
    ctx.fill()
    ctx.strokeStyle = p.stroke
    ctx.lineWidth = p.kind === 'chunk' ? 1.4 : 1.1
    ctx.stroke()

    ctx.restore()
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
