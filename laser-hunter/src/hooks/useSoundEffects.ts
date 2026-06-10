import { useCallback, useRef } from 'react'

type SoundKind = 'slice' | 'deflect' | 'success' | 'grow' | 'combo' | 'crack'

export function useSoundEffects(muted = false) {
  const ctxRef = useRef<AudioContext | null>(null)

  const getCtx = () => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext()
    }
    return ctxRef.current
  }

  const tone = useCallback(
    (
      freq: number,
      duration: number,
      type: OscillatorType,
      gain = 0.08,
      startOffset = 0,
    ) => {
      try {
        const ctx = getCtx()
        if (ctx.state === 'suspended') void ctx.resume()
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = type
        osc.frequency.value = freq
        g.gain.value = gain
        osc.connect(g)
        g.connect(ctx.destination)
        const t = ctx.currentTime + startOffset
        g.gain.setValueAtTime(gain, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + duration)
        osc.start(t)
        osc.stop(t + duration)
      } catch {
        // audio unavailable
      }
    },
    [],
  )

  const play = useCallback(
    (kind: SoundKind) => {
      if (muted) return
      switch (kind) {
        case 'slice':
          tone(880, 0.1, 'sawtooth', 0.06)
          tone(1320, 0.07, 'square', 0.045, 0.02)
          break
        case 'crack':
          tone(95, 0.09, 'sawtooth', 0.11)
          tone(180, 0.07, 'square', 0.07, 0.01)
          tone(2400, 0.05, 'triangle', 0.04, 0.02)
          break
        case 'deflect':
          tone(220, 0.16, 'square', 0.1)
          tone(165, 0.2, 'triangle', 0.08, 0.04)
          break
        case 'success':
          tone(523, 0.12, 'sine', 0.07, 0)
          tone(659, 0.12, 'sine', 0.065, 0.08)
          tone(784, 0.14, 'sine', 0.06, 0.16)
          tone(1047, 0.22, 'sine', 0.05, 0.24)
          break
        case 'combo':
          tone(784, 0.1, 'sine', 0.06, 0)
          tone(988, 0.1, 'sine', 0.055, 0.06)
          tone(1175, 0.14, 'sine', 0.05, 0.12)
          tone(1568, 0.2, 'triangle', 0.045, 0.2)
          break
        case 'grow':
          tone(110, 0.28, 'sawtooth', 0.07)
          tone(85, 0.32, 'square', 0.05, 0.06)
          break
      }
    },
    [tone, muted],
  )

  /** 몬스터 발소리 — intensity(0~1)가 클수록 크고 묵직하게 */
  const stomp = useCallback(
    (intensity: number) => {
      if (muted) return
      const k = Math.max(0, Math.min(1, intensity))
      tone(52 + 30 * k, 0.11, 'sine', 0.02 + 0.07 * k)
      tone(38, 0.15, 'triangle', 0.012 + 0.05 * k, 0.012)
    },
    [tone, muted],
  )

  return { play, stomp }
}
