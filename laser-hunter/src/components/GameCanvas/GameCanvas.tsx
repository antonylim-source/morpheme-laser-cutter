import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  WORD_FONT_SIZE,
  WORD_Y_POSITION,
  AGE_TOLERANCE,
  gameConfig,
} from '../../constants/gameConfig'
import type { AgeMode, CompoundWord, GameState } from '../../types/game.types'
import {
  MONSTER_SPAWN_X,
  MONSTER_TARGET_X,
  computeMonsterLayout,
  getMonsterSpeedPxPerSec,
  type MonsterLayoutSnapshot,
} from '../../utils/monsterLayout'

type Props = {
  word: CompoundWord
  gameStatus: GameState['status']
  failCount: number
  ageMode?: AgeMode
  loading?: boolean
  devOverlay?: boolean
  onSlashAttempt: (touchX: number, layout: MonsterLayoutSnapshot) => void
  onLayoutSnapshot?: (layout: MonsterLayoutSnapshot) => void
}

type TrailPoint = { x: number; y: number; t: number }

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
  ageMode = 'standard',
  loading = false,
  devOverlay = false,
  onSlashAttempt,
  onLayoutSnapshot,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [scale, setScale] = useState(1)
  const [shakeKey, setShakeKey] = useState(0)
  const reduceMotion = useReducedMotion() ?? false

  const monsterXRef = useRef(MONSTER_SPAWN_X)
  const layoutSnapshotRef = useRef<MonsterLayoutSnapshot>(
    computeMonsterLayout(word, MONSTER_SPAWN_X, failCount),
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

  const wordZone = useMemo(
    () => ({
      wordY: WORD_Y_POSITION,
      wordZoneTop: 200,
      wordZoneBottom: 400,
    }),
    [],
  )

  const failScale = useMemo(
    () => Math.pow(gameConfig.monsterScaleUpOnFail, failCount),
    [failCount],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      const availableW = Math.max(1, r.width)
      const nextScale = Math.min(1, availableW / CANVAS_WIDTH)
      setScale(nextScale)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1))
    canvas.width = CANVAS_WIDTH * dpr
    canvas.height = CANVAS_HEIGHT * dpr
  }, [])

  useEffect(() => {
    monsterXRef.current = MONSTER_SPAWN_X
    deflectRef.current = null
    shieldFlashRef.current = 0
    trailRef.current = []
    layoutSnapshotRef.current = computeMonsterLayout(word, MONSTER_SPAWN_X, failCount)
  }, [word.id])

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
    monsterXRef.current = Math.min(MONSTER_SPAWN_X, monsterXRef.current + 36 + failCount * 14)
    if (!reduceMotion) setShakeKey((k) => k + 1)
  }, [gameStatus, failCount, wordZone.wordY, reduceMotion])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const toCanvasXY = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect()
      const sx = Math.max(1e-6, r.width / CANVAS_WIDTH)
      const sy = Math.max(1e-6, r.height / CANVAS_HEIGHT)
      const x = (clientX - r.left) / sx
      const y = (clientY - r.top) / sy
      return { x, y }
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
      const now = performance.now()
      trailRef.current.push({ x: p.x, y: p.y, t: now })
      // 더 부드러운 잔상(포인트 수 증가)
      if (trailRef.current.length > 140) trailRef.current.shift()
    }

    const end = (clientX: number, clientY: number) => {
      if (!laserActiveRef.current) return
      const p = toCanvasXY(clientX, clientY)
      const start = gestureStartRef.current
      laserActiveRef.current = false
      gestureCurrentRef.current = p

      if (!start) return
      const dy = Math.abs(p.y - start.y)
      if (dy > 30) {
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

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    let raf = 0
    let lastFrameMs = performance.now()

    const drawBackground = (layout: MonsterLayoutSnapshot) => {
      const parallax = (MONSTER_SPAWN_X - layout.monsterX) * 0.12

      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
      grad.addColorStop(0, '#0c1222')
      grad.addColorStop(0.55, '#111827')
      grad.addColorStop(1, '#1a0a0a')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      ctx.save()
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)'
      ctx.lineWidth = 1
      const gridOffset = parallax % 40
      for (let x = -40 + gridOffset; x <= CANVAS_WIDTH + 40; x += 40) {
        ctx.beginPath()
        ctx.moveTo(x + 0.5, 0)
        ctx.lineTo(x + 0.5, CANVAS_HEIGHT)
        ctx.stroke()
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += 40) {
        ctx.beginPath()
        ctx.moveTo(0, y + 0.5)
        ctx.lineTo(CANVAS_WIDTH, y + 0.5)
        ctx.stroke()
      }
      ctx.restore()

      ctx.save()
      const hg = ctx.createRadialGradient(
        layout.monsterX,
        wordZone.wordY,
        40,
        layout.monsterX,
        wordZone.wordY,
        280 + layout.approachProgress * 80,
      )
      hg.addColorStop(0, `rgba(250, 204, 21, ${0.06 + layout.approachProgress * 0.1})`)
      hg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = hg
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      ctx.restore()
    }

    const drawVignette = (layout: MonsterLayoutSnapshot) => {
      const intensity = 0.25 + layout.approachProgress * 0.45 + failCount * 0.08
      const vg = ctx.createRadialGradient(
        CANVAS_WIDTH / 2,
        wordZone.wordY,
        CANVAS_WIDTH * 0.22,
        CANVAS_WIDTH / 2,
        wordZone.wordY,
        CANVAS_WIDTH * 0.72,
      )
      vg.addColorStop(0, 'rgba(0,0,0,0)')
      vg.addColorStop(0.65, `rgba(40, 8, 8, ${intensity * 0.35})`)
      vg.addColorStop(1, `rgba(80, 10, 10, ${intensity})`)
      ctx.fillStyle = vg
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    }

    const drawMonsterBody = (layout: MonsterLayoutSnapshot, xCenter = layout.monsterX) => {
      const totalScale = layout.totalScale
      const monsterImg = monsterImgRef.current
      const aspect =
        monsterImg?.complete && monsterImg.naturalWidth > 0
          ? monsterImg.naturalHeight / monsterImg.naturalWidth
          : 0.62

      // 텍스트/판정은 고정 폭. 몬스터 이미지는 approach/fail 스케일만 적용.
      const baseW = Math.min(560, Math.max(300, layout.canvasWordWidth + 180))
      const w = baseW * totalScale
      const h = w * aspect
      const yCenter = wordZone.wordY + 22 * totalScale
      const x = xCenter - w / 2
      const y = yCenter - h / 2

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
        ctx.globalAlpha = 1
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

    const drawMotionTrail = (layout: MonsterLayoutSnapshot, speed: number) => {
      if (gameStatus !== 'playing' || speed < 40) return
      const ghostCount = 3
      for (let i = ghostCount; i >= 1; i--) {
        const offset = i * (8 + speed * 0.012)
        ctx.save()
        ctx.globalAlpha = 0.06 * (ghostCount - i + 1)
        drawMonsterBody(layout, layout.monsterX + offset)
        ctx.restore()
      }
    }

    const drawWordOnMonster = (layout: MonsterLayoutSnapshot) => {
      const text = word.full.toUpperCase()
      ctx.save()
      // 단어 텍스트는 고정 크기(몬스터 스케일의 영향 없음)
      ctx.font = `900 ${WORD_FONT_SIZE}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
      ctx.textBaseline = 'middle'

      const len = Math.max(1, text.length)
      const baseWordWidth = layout.canvasWordWidth
      const charW = baseWordWidth / len
      const x0 = layout.wordStartX
      const y = wordZone.wordY

      ctx.shadowColor = failCount > 0 ? 'rgba(251, 146, 60, 0.8)' : 'rgba(250, 204, 21, 0.4)'
      ctx.shadowBlur = 12 + failCount * 4 + layout.approachProgress * 8

      for (let i = 0; i < len; i++) {
        const ch = text[i]!
        ctx.fillStyle = failCount > 0 ? '#fef3c7' : '#ffffff'
        ctx.fillText(ch, x0 + i * charW + charW * 0.18, y)
      }

      if (gameStatus !== 'success') {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'
        ctx.setLineDash([6, 6])
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(layout.boundaryPixelX + 0.5, wordZone.wordZoneTop)
        ctx.lineTo(layout.boundaryPixelX + 0.5, wordZone.wordZoneBottom)
        ctx.stroke()
        ctx.setLineDash([])
      }

      if (gameStatus === 'fail' && failCount >= 1) {
        ctx.save()
        const alpha = failCount >= 2 ? 0.55 + 0.45 * Math.sin(performance.now() / 120) : 0.6
        ctx.strokeStyle = `rgba(250, 204, 21, ${alpha.toFixed(3)})`
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(layout.boundaryPixelX + 0.5, wordZone.wordZoneTop + 8)
        ctx.lineTo(layout.boundaryPixelX + 0.5, wordZone.wordZoneBottom - 8)
        ctx.stroke()
        ctx.restore()
      }

      if (gameStatus === 'hint') {
        ctx.save()
        ctx.fillStyle = 'rgba(34, 211, 238, 0.9)'
        ctx.font = `18px ui-sans-serif, system-ui, Segoe UI, Roboto, Arial`
        ctx.textAlign = 'center'
        ctx.fillText(
          `${word.morpheme1} | ${word.morpheme2}`,
          layout.monsterX,
          wordZone.wordZoneBottom + 22,
        )
        ctx.restore()
      }

      ctx.restore()
    }

    const drawMonster = (layout: MonsterLayoutSnapshot, speed: number) => {
      drawMotionTrail(layout, speed)
      drawMonsterBody(layout)
      drawWordOnMonster(layout)
    }

    const drawSkeleton = () => {
      ctx.save()
      roundRect(ctx, 160, wordZone.wordY - 46, 480, 92, 22)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.16)'
      ctx.fill()
      roundRect(ctx, 240, wordZone.wordY - 16, 320, 34, 12)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.22)'
      ctx.fill()
      ctx.restore()
    }

    const drawNeonLaser = () => {
      const now = performance.now()
      // 잔상 길이(시간) 증가
      const trailLifeMs = 1650
      trailRef.current = trailRef.current.filter((p) => now - p.t < trailLifeMs)

      const points = trailRef.current
      if (points.length >= 2) {
        const maxW = 12
        const minW = 2
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1]!
          const b = points[i]!
          const age = now - b.t
          const life = Math.max(0, 1 - age / trailLifeMs)
          const progress = i / (points.length - 1)
          const width = minW + (maxW - minW) * (1 - progress) * (0.55 + 0.45 * life)

          // Outer glow (purple)
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          ctx.lineCap = 'round'
          ctx.shadowColor = '#a855f7'
          ctx.shadowBlur = 26 * life
          ctx.strokeStyle = `rgba(168, 85, 247, ${(life * 0.16).toFixed(3)})`
          ctx.lineWidth = width + 6
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
          ctx.restore()

          // Neon core (gradient)
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          ctx.lineCap = 'round'
          const lg = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
          lg.addColorStop(0, `rgba(34, 211, 238, ${(life * 0.65).toFixed(3)})`)
          lg.addColorStop(0.5, `rgba(250, 204, 21, ${(life * 0.75).toFixed(3)})`)
          lg.addColorStop(1, `rgba(244, 114, 182, ${(life * 0.6).toFixed(3)})`)
          ctx.shadowColor = '#facc15'
          ctx.shadowBlur = 18 * life
          ctx.strokeStyle = lg
          ctx.lineWidth = width
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
          ctx.restore()

          // White hot highlight
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          ctx.lineCap = 'round'
          ctx.shadowColor = '#ffffff'
          ctx.shadowBlur = 10 * life
          ctx.strokeStyle = `rgba(255,255,255, ${(life * 0.35).toFixed(3)})`
          ctx.lineWidth = Math.max(1.5, width * 0.25)
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
          ctx.restore()
        }
      }
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
      ctx.shadowColor = '#fbbf24'
      ctx.shadowBlur = 16
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
      ctx.fillText(msg, CANVAS_WIDTH / 2, 550)
      ctx.restore()
    }

    const frame = (now: number) => {
      const deltaMs = Math.min(48, now - lastFrameMs)
      lastFrameMs = now
      const deltaSec = deltaMs / 1000
      const speed = getMonsterSpeedPxPerSec(failCount)

      if (gameStatus === 'playing') {
        monsterXRef.current -= speed * deltaSec
        monsterXRef.current = Math.max(MONSTER_TARGET_X, monsterXRef.current)
      }

      const layout = computeMonsterLayout(word, monsterXRef.current, failCount)
      layoutSnapshotRef.current = layout

      if (onLayoutSnapshot && now - lastLayoutEmitRef.current > 66) {
        lastLayoutEmitRef.current = now
        onLayoutSnapshot(layout)
      }

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      drawBackground(layout)
      drawVignette(layout)

      if (loading) {
        drawSkeleton()
      } else if (gameStatus !== 'success') {
        drawMonster(layout, speed)
      }

      drawNeonLaser()
      drawDeflection()
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
          `monsterX=${layout.monsterX.toFixed(1)} progress=${(layout.approachProgress * 100).toFixed(0)}% scale=${layout.totalScale.toFixed(2)} speed=${speed.toFixed(0)}px/s`,
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
  ])

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <div
        className="absolute left-1/2 top-0 origin-top"
        style={{
          transform: `translateX(-50%) scale(${scale})`,
          width: `${CANVAS_WIDTH}px`,
          height: `${CANVAS_HEIGHT}px`,
        }}
      >
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
            className="block touch-none select-none"
            aria-label="Laser Hunter Game Canvas"
          />
        </motion.div>
      </div>
    </div>
  )
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
