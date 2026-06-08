import confetti from 'canvas-confetti'

export function fireSuccessConfetti(reduceMotion = false) {
  if (reduceMotion) return

  const burst = (particleCount: number, spread: number, scalar = 1) => {
    void confetti({
      particleCount,
      spread,
      startVelocity: 42,
      scalar,
      origin: { x: 0.5, y: 0.48 },
      colors: ['#fde047', '#f472b6', '#38bdf8', '#4ade80', '#c084fc', '#fb923c'],
      ticks: 220,
      disableForReducedMotion: true,
    })
  }

  burst(100, 68)
  window.setTimeout(() => burst(55, 110, 0.9), 140)
  window.setTimeout(() => burst(35, 55, 1.1), 280)
}
