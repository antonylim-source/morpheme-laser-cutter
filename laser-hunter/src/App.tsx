import { GameCanvas } from './components/GameCanvas'
import { GameOverScreen } from './components/GameOverScreen'
import { HintOverlay } from './components/HintOverlay'
import { ScoreBoard } from './components/ScoreBoard'
import { StartScreen } from './components/StartScreen'
import { SplitAnimation } from './components/SplitAnimation'
import { CANVAS_WIDTH, WORD_FONT_SIZE } from './constants/gameConfig'
import { useBoundaryCheck } from './hooks/useBoundaryCheck'
import { useGameState } from './hooks/useGameState'
import { useSoundEffects } from './hooks/useSoundEffects'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgeMode, BoundaryCheckResult } from './types/game.types'
import { wordList } from './data/wordList'
import type { MonsterLayoutSnapshot } from './utils/monsterLayout'

function App() {
  const game = useGameState()
  const state = game.state
  const { checkBoundary } = useBoundaryCheck()
  const { play: playSound } = useSoundEffects()
  const prevStatusRef = useRef(state.status)

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
    const approxCharW = WORD_FONT_SIZE * 0.62
    const canvasWordWidth = Math.max(360, Math.min(680, len * approxCharW))
    const wordStartX = (CANVAS_WIDTH - canvasWordWidth) / 2
    const boundaryPixelX = (state.currentWord.boundaryIndex / len) * canvasWordWidth + wordStartX
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

  // sound effects on status change
  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = state.status
    if (prev === state.status) return
    if (state.status === 'success') playSound('success')
    if (state.status === 'fail') {
      playSound('deflect')
      if (state.failCount > 0) playSound('grow')
    }
  }, [state.status, state.failCount, playSound])

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
        }
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
    <div className="min-h-screen w-full bg-slate-900 text-white">
      {/* fixed top scoreboard */}
      <div className="fixed left-0 right-0 top-0 z-50 border-b border-slate-800/70 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold tracking-widest text-slate-400">POLY M.A.P.S.</div>
            <div className="hidden text-xs text-slate-500 sm:block">Laser Hunter POC</div>
          </div>
          <div className="flex items-center gap-3">
            <ScoreBoard score={state.score} streak={streak} misses={state.failCount} />
            <div className="text-xs text-slate-300">
              <span className="text-slate-500">LEVEL</span>{' '}
              <span className="font-semibold">{Math.min(3, state.failCount || 1)}</span>
            </div>
            <div className="text-xs text-slate-300">
              <span className="text-slate-500">🔥</span> x{Math.max(1, streak)}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto flex min-h-screen max-w-[1100px] flex-col px-4 pb-6 pt-16">
        <div className="flex flex-col items-center justify-center py-6">
          <div className="text-center text-4xl font-black tracking-[0.14em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-yellow-300 to-fuchsia-400 drop-shadow-[0_0_18px_rgba(250,204,21,0.35)]">
            ⚡ LASER HUNTER
          </div>
          <div className="mt-2 text-center text-sm text-slate-300">
            Morpheme Laser Cutter · Slash the compound word boundary!
          </div>
        </div>

        <main className="relative flex-1 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow">
          <GameCanvas
            word={state.currentWord}
            gameStatus={gameOver ? 'idle' : state.status}
            failCount={state.failCount}
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
              playSound('slice')
              const result = checkBoundary(
                touchX,
                state.currentWord,
                layout.wordStartX,
                layout.canvasWordWidth,
                ageMode,
              )
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

        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="text-center text-xs text-slate-400">
            Progress: <span className="font-semibold text-slate-200">{wordsDone}</span>/10 · Keys:
            <span className="ml-2 font-mono text-slate-300">SPACE</span>(demo hit)
            <span className="ml-2 font-mono text-slate-300">H</span>(hint)
            <span className="ml-2 font-mono text-slate-300">R</span>(reset)
            {import.meta.env.DEV ? (
              <>
                <span className="ml-2 font-mono text-slate-300">?</span>(dev overlay)
              </>
            ) : null}
          </div>

          {/* difficulty selector (maps to age tolerance) */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-xs text-slate-200">
            <SelectorButton active={ageMode === 'young'} onClick={() => setAgeMode('young')} label="Easy" />
            <SelectorButton active={ageMode === 'standard'} onClick={() => setAgeMode('standard')} label="Normal" />
            <SelectorButton active={ageMode === 'advanced'} onClick={() => setAgeMode('advanced')} label="Hard" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

function SelectorButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-lg px-3 py-1.5 font-semibold',
        active ? 'bg-yellow-300 text-slate-900' : 'bg-slate-900 text-slate-200 hover:bg-slate-800',
      ].join(' ')}
    >
      {label}
    </button>
  )
}
