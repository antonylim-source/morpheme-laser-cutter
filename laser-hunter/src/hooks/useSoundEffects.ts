import { useCallback, useRef } from 'react'

type SoundKind = 'slice' | 'deflect' | 'success' | 'grow'

export function useSoundEffects() {
  const ctxRef = useRef<AudioContext | null>(null)

  const getCtx = () => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext()
    }
    return ctxRef.current
  }

  const tone = useCallback((freq: number, duration: number, type: OscillatorType, gain = 0.08) => {
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
      const t = ctx.currentTime
      g.gain.setValueAtTime(gain, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + duration)
      osc.start(t)
      osc.stop(t + duration)
    } catch {
      // audio unavailable
    }
  }, [])

  const play = useCallback(
    (kind: SoundKind) => {
      switch (kind) {
        case 'slice':
          tone(880, 0.12, 'sawtooth', 0.06)
          tone(1320, 0.08, 'square', 0.04)
          break
        case 'deflect':
          tone(220, 0.18, 'square', 0.1)
          tone(180, 0.22, 'triangle', 0.07)
          break
        case 'success':
          tone(523, 0.1, 'sine', 0.07)
          tone(659, 0.1, 'sine', 0.06)
          tone(784, 0.18, 'sine', 0.05)
          break
        case 'grow':
          tone(120, 0.25, 'sawtooth', 0.05)
          break
      }
    },
    [tone],
  )

  return { play }
}
