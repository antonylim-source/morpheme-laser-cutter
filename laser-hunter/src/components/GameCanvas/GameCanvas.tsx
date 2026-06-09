import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  WORD_FONT_SIZE,
  WORD_Y_POSITION,
  AGE_TOLERANCE,
  gameConfig,
  getWordRevealAlpha,
  isWordSlashable,
} from '../../constants/gameConfig'
import type { AgeMode, CompoundWord, GameState } from '../../types/game.types'
import {
  APPROACH_EQUIV_DISTANCE_PX,
  computeMonsterLayout,
  getAnimatedTextFailScale,
  getMonsterSpeedPxPerSec,
  getMonsterVisualCenterY,
  type MonsterLayoutSnapshot,
} from '../../utils/monsterLayout'
import {
  WORD_FONT_FAMILY,
  applyWordFont,
  getBoundaryOffsetX,
  measureWordText,
  type WordTextMetrics,
} from '../../utils/wordTextMetrics'

type Props = {
  word: CompoundWord
  gameStatus: GameState['status']
  failCount: number
  streak?: number
  ageMode?: AgeMode
  loading?: boolean
  devOverlay?: boolean
  onSlashAttempt: (touchX: number, layout: MonsterLayoutSnapshot) => void
  onLayoutSnapshot?: (layout: MonsterLayoutSnapshot) => void
}

type TrailPoint = { x: number; y: number; t: number }

const MAX_CANVAS_DPR = 2
const MAX_TRAIL_POINTS = 48
const TRAIL_LIFE_MS = 1200
const TRAIL_MIN_DIST_SQ = 6 * 6

type DeflectState = {
  x: number
  y: number
  angle: number
  startMs: number
}

export function GameCanvas({
  word,
  gameStatus,
  failCount,
  streak = 0,
  ageMode = 'standard',
  loading = false,
  devOverlay = false,
  onSlashAttempt,
  onLayoutSnapshot,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [shakeKey, setShakeKey] = useState(0)
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
  const shieldFlashRef = useRef(0)
  const monsterImgRef = useRef<HTMLImageElement | null>(null)
  const prevStatusRef = useRef<GameState['status']>(gameStatus)
  const lastLayoutEmitRef = useRef(0)
  const canvasRectRef = useRef<DOMRect | null>(null)
  const textMetricsRef = useRef<WordTextMetrics | null>(null)
  const textMetricsWordIdRef = useRef('')
  const growPunchStartRef = useRef(0)
  const wordPopStartRef = useRef(0)
  const successFlashStartRef = useRef(0)
  const prevWordVisibleRef = useRef(false)
  const prevFailCountRef = useRef(failCount)

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
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(MAX_CANVAS_DPR, Math.max(1, Math.floor(window.devicePixelRatio || 1)))
    canvas.width = CANVAS_WIDTH * dpr
    canvas.height = CANVAS_HEIGHT * dpr
  }, [])

  useEffect(() => {
    void document.fonts.load(`700 ${WORD_FONT_SIZE}px ${WORD_FONT_FAMILY}`)
  }, [])

  useEffect(() => {
    approachRef.current = 0
    deflectRef.current = null
    shieldFlashRef.current = 0
    trailRef.current = []
    textMetricsRef.current = null
    textMetricsWordIdRef.current = ''
    growPunchStartRef.current = 0
    wordPopStartRef.current = 0
    prevWordVisibleRef.current = false
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
    const img = new Image()
    // Vite base 경로(예: GitHub Pages 서브패스)를 반영
    img.src = `${import.meta.env.BASE_URL}images/monster.png`
    img.onload = () => {
      monsterImgRef.current = img
    }
    img.onerror = () => {
      monsterImgRef.current = null
    }
    return () => {
      monsterImgRef.current = null
    }
  }, [])

  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = gameStatus
    if (prev === gameStatus) return
    if (gameStatus === 'success') {
      successFlashStartRef.current = performance.now()
      return
    }
    if (gameStatus !== 'fail') return

    const layout = layoutSnapshotRef.current
    const touchX = lastTouchXRef.current ?? layout.boundaryPixelX
    deflectRef.current = {
      x: touchX,
      y: wordZone.wordY,
      angle: (Math.random() > 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.5),
      startMs: performance.now(),
    }
    shieldFlashRef.current = performance.now()
    approachRef.current = Math.max(0, approachRef.current - 0.07 - failCount * 0.025)
    if (!reduceMotion) setShakeKey((k) => k + 1)
  }, [gameStatus, failCount, wordZone.wordY, reduceMotion])

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
        onSlashAttempt(p.x, layoutSnapshotRef.current)
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

    const dpr = Math.min(MAX_CANVAS_DPR, Math.max(1, Math.floor(window.devicePixelRatio || 1)))
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

    const drawMonsterBody = (layout: MonsterLayoutSnapshot, xCenter = layout.monsterX) => {
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

      // 몬스터 이미지는 approach/fail 스케일 적용. 단어는 textFailScale로 동기화.
      const baseW = Math.min(560, Math.max(300, layout.canvasWordWidth + 180))
      const w = baseW * totalScale
      const h = w * aspect
      const bob =
        reduceMotion ? 0 : Math.sin(performance.now() / 260) * 5 * layout.approachProgress
      const yCenter = getMonsterVisualCenterY(layout.approachProgress, wordZone.wordY) + bob
      const x = xCenter - w / 2
      const y = yCenter - h / 2
      const depthAlpha = 0.5 + 0.5 * layout.approachProgress

      ctx.save()

      if (failCount > 0) {
        const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 180)
        ctx.save()
        const fg = ctx.createRadialGradient(xCenter, yCenter, h * 0.22, xCenter, yCenter, w * 0.62)
        fg.addColorStop(0, `rgba(251, 146, 60, ${0.22 * pulse})`)
        fg.addColorStop(0.55, `rgba(239, 68, 68, ${0.16 * pulse})`)
        fg.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = fg
        ctx.fillRect(x - 60, y - 60, w + 120, h + 120)
        ctx.restore()
      }

      const shieldAge = performance.now() - shieldFlashRef.current
      if (shieldAge < 450) {
        const shieldAlpha = 1 - shieldAge / 450
        ctx.save()
        roundRect(ctx, x - 8, y - 8, w + 16, h + 16, 26 * totalScale)
        ctx.strokeStyle = `rgba(148, 163, 184, ${shieldAlpha * 0.95})`
        ctx.lineWidth = 4 + shieldAlpha * 4
        ctx.shadowColor = '#e2e8f0'
        ctx.shadowBlur = 18 * shieldAlpha
        ctx.stroke()
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

      const popAge = performance.now() - wordPopStartRef.current
      let popScale = 1
      if (!reduceMotion && popAge >= 0 && popAge < 450) {
        const t = popAge / 450
        popScale = t < 0.55 ? 0.35 + (t / 0.55) * 0.8 : 1.15 - ((t - 0.55) / 0.45) * 0.15
      }

      const textFailScale = layout.textFailScale
      const combinedScale = popScale * textFailScale
      const boundaryOffset = getBoundaryOffsetX(textMetrics, word.boundaryIndex, len)
      const baseBoundaryX = baseX0 + boundaryOffset

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
      ctx.fillStyle = heated ? 'rgba(69, 26, 3, 0.55)' : 'rgba(0, 0, 0, 0.52)'
      ctx.fill()
      ctx.strokeStyle = heated ? 'rgba(251, 146, 60, 0.35)' : 'rgba(255, 255, 255, 0.12)'
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

      ctx.save()
      ctx.globalAlpha = textAlpha

      if (gameStatus !== 'success') {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'
        ctx.setLineDash([6, 6])
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(baseBoundaryX + 0.5, y - 100)
        ctx.lineTo(baseBoundaryX + 0.5, y + 100)
        ctx.stroke()
        ctx.setLineDash([])
      }

      if (gameStatus === 'fail' && failCount >= 1) {
        const alpha = failCount >= 2 ? 0.55 + 0.45 * Math.sin(performance.now() / 120) : 0.6
        ctx.strokeStyle = `rgba(250, 204, 21, ${alpha.toFixed(3)})`
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(baseBoundaryX + 0.5, y - 92)
        ctx.lineTo(baseBoundaryX + 0.5, y + 92)
        ctx.stroke()
      }

      if (gameStatus === 'hint') {
        ctx.fillStyle = 'rgba(34, 211, 238, 0.9)'
        ctx.font = `18px ui-sans-serif, system-ui, Segoe UI, Roboto, Arial`
        ctx.textAlign = 'center'
        ctx.fillText(
          `${word.morpheme1} | ${word.morpheme2}`,
          layout.monsterX,
          y + 122,
        )
      }

      ctx.restore()
      ctx.restore()

      ctx.restore()
    }

    const drawMonster = (layout: MonsterLayoutSnapshot, textMetrics: WordTextMetrics) => {
      drawMonsterBody(layout)
      drawWordOnMonster(layout, textMetrics)
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

      const hotStreak = streak >= 3
      const warmStreak = streak >= 2

      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1]!
        const b = trail[i]!
        const life = Math.max(0, 1 - (now - b.t) / TRAIL_LIFE_MS)
        if (life <= 0) continue
        const progress = i / (trail.length - 1)
        const coreW = 2 + 7 * (1 - progress) * life

        const glowR = hotStreak ? 56 : warmStreak ? 168 : 168
        const glowG = hotStreak ? 189 : warmStreak ? 85 : 85
        const glowB = hotStreak ? 248 : warmStreak ? 247 : 247
        const coreR = hotStreak ? 253 : warmStreak ? 251 : 250
        const coreG = hotStreak ? 224 : warmStreak ? 191 : 204
        const coreB = hotStreak ? 71 : warmStreak ? 36 : 21

        ctx.strokeStyle = `rgba(${glowR}, ${glowG}, ${glowB}, ${0.14 * life})`
        ctx.lineWidth = coreW + 8
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()

        ctx.strokeStyle = `rgba(${coreR}, ${coreG}, ${coreB}, ${(hotStreak ? 0.78 : 0.62) * life})`
        ctx.lineWidth = coreW
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()

        ctx.strokeStyle = `rgba(255, 255, 255, ${(hotStreak ? 0.42 : 0.28) * life})`
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
      if (age > 500) {
        deflectRef.current = null
        return
      }

      const t = age / 500
      const len = 80 + t * 120
      const x2 = d.x + Math.cos(d.angle) * len
      const y2 = d.y + Math.sin(d.angle) * len * 0.6 - t * 40

      ctx.save()
      ctx.lineCap = 'round'
      ctx.strokeStyle = `rgba(250, 204, 21, ${(1 - t).toFixed(3)})`
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(d.x, d.y)
      ctx.lineTo(x2, y2)
      ctx.stroke()

      ctx.fillStyle = `rgba(226, 232, 240, ${(1 - t).toFixed(3)})`
      for (let i = 0; i < 6; i++) {
        const ang = d.angle + (i - 3) * 0.35
        const r = 8 + t * 30
        ctx.beginPath()
        ctx.arc(d.x + Math.cos(ang) * r, d.y + Math.sin(ang) * r * 0.5, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    const drawSuccessFlash = () => {
      const age = performance.now() - successFlashStartRef.current
      if (age < 0 || age > 220) return
      const alpha = 0.38 * (1 - age / 220)
      ctx.save()
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      ctx.restore()
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
      const deltaSec = deltaMs / 1000
      const speed = getMonsterSpeedPxPerSec(failCount)

      if (gameStatus === 'playing') {
        approachRef.current += (speed / APPROACH_EQUIV_DISTANCE_PX) * deltaSec
        approachRef.current = Math.min(1, approachRef.current)
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
      const layout = computeMonsterLayout(
        word,
        approachRef.current,
        failCount,
        textMetrics,
        textFailScale,
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

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      drawBackground(layout)

      if (loading) {
        drawSkeleton()
      } else if (gameStatus !== 'success') {
        drawMonster(layout, textMetrics)
      }

      drawNeonLaser()
      drawDeflection()
      drawSuccessFlash()
      drawInstruction(layout)

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
    streak,
    reduceMotion,
  ])

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <motion.div
        key={shakeKey}
        className="h-full w-full"
        animate={
          reduceMotion || shakeKey === 0
            ? { x: 0 }
            : { x: [0, -8, 8, -5, 5, 0] }
        }
        transition={{ duration: 0.38, ease: 'easeOut' }}
      >
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

  const depth = 5
  const heatPulse = heated ? 0.85 + 0.15 * Math.sin(performance.now() / 140 + x * 0.02) : 1

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.fillText(ch, x + depth + 2, y + depth + 3)

  for (let d = depth; d >= 1; d--) {
    const t = d / depth
    if (heated) {
      const boost = 1 + failCount * 0.08
      const r = Math.round((120 + t * 55) * boost * heatPulse)
      const g = Math.round((18 + t * 18) * (1 - failCount * 0.06))
      const b = Math.round(4 + t * 4)
      ctx.fillStyle = `rgb(${Math.min(255, r)}, ${g}, ${b})`
    } else {
      const shade = Math.round(18 + t * 38)
      ctx.fillStyle = `rgb(${shade}, ${shade + 6}, ${shade + 14})`
    }
    ctx.fillText(ch, x + d, y + d)
  }

  ctx.lineWidth = 10
  ctx.strokeStyle = heated ? '#7f1d1d' : '#000000'
  ctx.strokeText(ch, x, y)

  ctx.lineWidth = 2.5
  ctx.strokeStyle = heated ? 'rgba(254, 202, 202, 0.95)' : 'rgba(255, 255, 255, 0.9)'
  ctx.strokeText(ch, x, y)

  const face = ctx.createLinearGradient(x, y - fontSize * 0.48, x, y + fontSize * 0.32)
  if (heated) {
    face.addColorStop(0, '#fff7ed')
    face.addColorStop(0.4, '#fed7aa')
    face.addColorStop(0.75, '#fdba74')
    face.addColorStop(1, '#f97316')
  } else {
    face.addColorStop(0, '#ffffff')
    face.addColorStop(0.6, '#ffffff')
    face.addColorStop(1, '#f8fafc')
  }
  ctx.fillStyle = face
  ctx.fillText(ch, x, y)

  ctx.fillStyle = heated ? 'rgba(255, 237, 213, 0.45)' : 'rgba(255, 255, 255, 0.38)'
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
