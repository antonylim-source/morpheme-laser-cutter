import { GameCanvas } from './components/GameCanvas'
import { FeedbackPopup, type FeedbackKind } from './components/FeedbackPopup'
import { GameOverScreen } from './components/GameOverScreen'
import { HintOverlay } from './components/HintOverlay'
import { ScoreBoard } from './components/ScoreBoard'
import { StartScreen } from './components/StartScreen'
import { SplitAnimation } from './components/SplitAnimation'
import { CANVAS_WIDTH, isWordSlashable } from './constants/gameConfig'
import { estimateWordTextWidth } from './utils/wordTextMetrics'
import { fireSuccessConfetti } from './utils/confetti'
import { useBoundaryCheck } from './hooks/useBoundaryCheck'
import { useGameState } from './hooks/useGameState'
import { useSoundEffects } from './hooks/useSoundEffects'
import { useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgeMode, BoundaryCheckResult } from './types/game.types'
import { wordList } from './data/wordList'
import type { MonsterLayoutSnapshot } from './utils/monsterLayout'
import { publicAsset } from './utils/publicAsset'

function App() {
  const game = useGameState()
  const state = game.state
  const { checkBoundary } = useBoundaryCheck()
  const { play: playSound } = useSoundEffects()
  const prevStatusRef = useRef(state.status)
  const reduceMotion = useReducedMotion() ?? false
  const [feedback, setFeedback] = useState<{ kind: FeedbackKind; key: number } | null>(null)

  const [ageMode, setAgeMode] = useState<AgeMode>('standard')
  const [wordsDone, setWordsDone] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [streak, setStreak] = useState(0)
  const [devOverlay, setDevOverlay] = useState(false)
  const [imagesLoading, setImagesLoading] = useState(false)
  const [imagesReady, setImagesReady] = useState(false)
  const nextTimerRef = useRef<number | null>(null)
  const monsterLayoutRef = useRef<MonsterLayoutSnapshot | null>(null)
  const [boundaryX01, setBoundaryX01] = useState(0.5)

  // fallback when canvas layout not yet emitted
  const wordLayout = useMemo(() => {
    const len = Math.max(1, state.currentWord.full.length)
    const canvasWordWidth = estimateWordTextWidth(len)
    const wordStartX = (CANVAS_WIDTH - canvasWordWidth) / 2
    const boundaryPixelX =
      wordStartX + (state.currentWord.boundaryIndex / len) * canvasWordWidth
    const boundaryX01 = boundaryPixelX / CANVAS_WIDTH
    return { len, canvasWordWidth, wordStartX, boundaryPixelX, boundaryX01 }
  }, [state.currentWord])

  // auto next word after 1.5s on result states
  useEffect(() => {
    if (nextTimerRef.current != null) window.clearTimeout(nextTimerRef.current)
    if (gameOver) return

    if (state.status === 'success' || state.status === 'hint') {
      nextTimerRef.current = window.setTimeout(() => {
        setWordsDone((n) => {
          const next = n + 1
          if (next >= 10) {
            setGameOver(true)
            return next
          }
          game.nextWord()
          return next
        })
      }, state.status === 'success' ? 1800 : 1500)
    }

    if (state.status === 'fail') {
      nextTimerRef.current = window.setTimeout(() => {
        game.resumePlaying()
      }, 900)
    }

    return () => {
      if (nextTimerRef.current != null) window.clearTimeout(nextTimerRef.current)
    }
  }, [state.status, game, gameOver])

  // streak tracking
  useEffect(() => {
    if (state.status === 'success') setStreak((s) => s + 1)
    if (state.status === 'fail' || state.status === 'hint') setStreak(0)
  }, [state.status])

  // sound + visual feedback on status change
  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = state.status
    if (prev === state.status) return

    if (state.status === 'success') {
      const nextStreak = streak + 1
      playSound(nextStreak >= 3 ? 'combo' : 'success')
      fireSuccessConfetti(reduceMotion)
      const kind: FeedbackKind =
        nextStreak >= 4 ? 'super' : nextStreak >= 2 ? 'great' : 'slice'
      setFeedback({ kind, key: Date.now() })
    }

    if (state.status === 'fail') {
      playSound('deflect')
      if (state.failCount > 0) playSound('grow')
      setFeedback({
        kind: state.failCount >= 2 ? 'boom' : 'oops',
        key: Date.now(),
      })
    }
  }, [state.status, state.failCount, streak, playSound, reduceMotion])

  useEffect(() => {
    if (!feedback) return
    const t = window.setTimeout(() => setFeedback(null), 900)
    return () => window.clearTimeout(t)
  }, [feedback])

  // keyboard support: SPACE / H / R
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && import.meta.env.DEV) {
        setDevOverlay((v) => !v)
        return
      }
      if (e.code === 'Space') {
        e.preventDefault()
        if (gameOver) return
        if (state.status !== 'playing') return
        const layout = monsterLayoutRef.current ?? {
          boundaryPixelX: wordLayout.boundaryPixelX,
          wordStartX: wordLayout.wordStartX,
          canvasWordWidth: wordLayout.canvasWordWidth,
          approachProgress: 1,
        }
        if (!isWordSlashable(layout.approachProgress ?? 0)) return
        const demoOk: BoundaryCheckResult = {
          isCorrect: true,
          tolerance: 0,
          diff: 0,
          boundaryPixelX: layout.boundaryPixelX,
        }
        game.attemptCut(layout.boundaryPixelX, demoOk)
        return
      }

      if (e.key.toLowerCase() === 'h') {
        if (gameOver) return
        if (state.status !== 'playing') return
        const bad: BoundaryCheckResult = {
          isCorrect: false,
          tolerance: 0,
          diff: 999,
          boundaryPixelX: wordLayout.boundaryPixelX,
        }
        game.attemptCut(0, bad)
        game.attemptCut(0, bad)
        game.attemptCut(0, bad)
        return
      }

      if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        if (nextTimerRef.current != null) window.clearTimeout(nextTimerRef.current)
        setWordsDone(0)
        setGameOver(false)
        setStreak(0)
        setDevOverlay(false)
        game.resetGame()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [game, gameOver, state.status, wordLayout.boundaryPixelX, wordLayout])

  const preloadImages = async () => {
    const paths = new Set<string>()
    for (const w of wordList) {
      paths.add(w.image1)
      paths.add(w.image2)
      paths.add(w.combinedImage)
    }
    const list = Array.from(paths).filter(Boolean)
    await Promise.all(
      list.map(
        (src) =>
          new Promise<void>((resolve) => {
            const img = new Image()
            img.onload = () => resolve()
            img.onerror = () => resolve()
            img.src = src
          }),
      ),
    )
  }

  const handleStartGame = async () => {
    if (imagesReady) {
      game.startGame()
      return
    }
    setImagesLoading(true)
    try {
      await preloadImages()
      setImagesReady(true)
      game.startGame()
    } finally {
      setImagesLoading(false)
    }
  }

  return (
    <div
      className="relative h-full w-full bg-cover bg-center bg-no-repeat text-white"
      style={{ backgroundImage: `url(${publicAsset('images/bg_img.png')})` }}
    >
      <main className="absolute inset-0 overflow-hidden">
          <FeedbackPopup kind={feedback?.kind ?? null} triggerKey={feedback?.key ?? 0} />
          <GameCanvas
            word={state.currentWord}
            gameStatus={gameOver ? 'idle' : state.status}
            failCount={state.failCount}
            streak={streak}
            ageMode={ageMode}
            loading={imagesLoading && !imagesReady}
            devOverlay={devOverlay}
            onLayoutSnapshot={(layout) => {
              monsterLayoutRef.current = layout
              setBoundaryX01(layout.boundaryX01)
            }}
            onSlashAttempt={(touchX, layout) => {
              if (gameOver) return
              if (state.status !== 'playing') return
              if (!isWordSlashable(layout.approachProgress)) return
              playSound('slice')
              const result = checkBoundary(touchX, layout.boundaryPixelX, ageMode)
              game.attemptCut(touchX, result)
            }}
          />
          <SplitAnimation word={state.currentWord} status={state.status} failCount={state.failCount} />
          <GameOverScreen
            visible={gameOver}
            score={state.score}
            wordsCompleted={wordsDone}
            onPlayAgain={() => {
              if (nextTimerRef.current != null) window.clearTimeout(nextTimerRef.current)
              setWordsDone(0)
              setGameOver(false)
              setStreak(0)
              game.resetGame()
            }}
          />
          <StartScreen
            visible={state.status === 'idle' && !gameOver}
            ageMode={ageMode}
            setAgeMode={setAgeMode}
            loading={imagesLoading}
            onStart={handleStartGame}
          />
          <HintOverlay
            state={state}
            boundaryX01={boundaryX01}
            onStart={() => {
              if (state.status === 'success' || state.status === 'fail' || state.status === 'hint') {
                game.nextWord()
                return
              }
              handleStartGame()
            }}
          />
      </main>

      <header className="pointer-events-none absolute left-0 right-0 top-0 z-50 flex h-[52px] items-center justify-between px-4">
        <img
          src={publicAsset('images/title_log.png')}
          alt="Morpheme Laser Cutter"
          className="h-14 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
        />
        <ScoreBoard score={state.score} streak={streak} misses={state.failCount} />
      </header>

      <div className="pointer-events-none absolute left-0 right-0 top-[52px] z-50 flex h-[48px] flex-col items-center justify-center">
        <div className="font-display text-center text-xl font-extrabold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]">
          🎯 Slice the middle of the word!
        </div>
        {streak >= 2 ? (
          <div className="animate-wiggle text-sm font-bold text-yellow-300 drop-shadow-md">
            🔥 {streak} in a row!
          </div>
        ) : null}
      </div>

      <footer className="absolute bottom-0 left-0 right-0 z-50 flex h-[56px] items-center justify-center px-4">
        <div className="bubble-panel flex items-center gap-3 bg-gradient-to-r from-sky-500/90 to-cyan-500/90 px-4 py-2">
          <span className="font-display text-sm font-extrabold text-white">🗺️ Progress</span>
          <ProgressStars done={wordsDone} total={10} />
          <span className="font-display text-sm font-bold text-yellow-200">
            {wordsDone}/{10}
          </span>
        </div>
      </footer>
    </div>
  )
}

export default App

function ProgressStars({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }, (_, i) => {
        const filled = i < done
        const justEarned = filled && i === done - 1
        return (
          <span
            key={i}
            className={[
              'text-lg',
              filled ? 'scale-110 drop-shadow-[0_0_6px_rgba(250,204,21,0.8)]' : 'opacity-35 grayscale',
              justEarned ? 'animate-pop-star' : '',
            ].join(' ')}
          >
            ⭐
          </span>
        )
      })}
    </div>
  )
}
