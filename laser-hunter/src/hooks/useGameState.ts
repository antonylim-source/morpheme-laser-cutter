import { useMemo, useReducer } from 'react'
import { HINT_THRESHOLDS } from '../constants/gameConfig'
import { wordList } from '../data/wordList'
import type { BoundaryCheckResult, CompoundWord, GameState } from '../types/game.types'

export type GameAction =
  | { type: 'START_GAME'; payload: { word: CompoundWord } }
  | { type: 'ATTEMPT_CUT'; payload: { touchX: number; result: BoundaryCheckResult } }
  | { type: 'NEXT_WORD' }
  | { type: 'RESUME_PLAYING' }
  | { type: 'RESET_GAME' }

export type UseGameStateApi = {
  state: GameState
  dispatch: React.Dispatch<GameAction>
  startGame: (word?: CompoundWord) => void
  attemptCut: (touchX: number, result: BoundaryCheckResult) => void
  nextWord: () => void
  resumePlaying: () => void
  resetGame: () => void
}

const initialState: GameState = {
  status: 'idle',
  currentWord: wordList[0]!,
  score: 0,
  failCount: 0,
  timeElapsed: 0,
  wordIndex: 0,
}

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      return {
        ...state,
        status: 'playing',
        currentWord: action.payload.word,
      }
    }
    case 'ATTEMPT_CUT': {
      const { result } = action.payload

      if (result.isCorrect) {
        return {
          ...state,
          status: 'success',
          score: state.score + 100,
          failCount: 0,
        }
      }

      const nextFail = Math.min(3, state.failCount + 1)
      return {
        ...state,
        failCount: nextFail,
        status: nextFail >= 3 ? 'hint' : 'fail',
      }
    }
    case 'NEXT_WORD': {
      const nextIndex = (state.wordIndex + 1) % wordList.length
      return {
        ...state,
        wordIndex: nextIndex,
        currentWord: wordList[nextIndex]!,
        status: 'playing',
        failCount: 0,
      }
    }
    case 'RESUME_PLAYING': {
      return { ...state, status: 'playing' }
    }
    case 'RESET_GAME': {
      return { ...initialState }
    }
    default: {
      return state
    }
  }
}

export function useGameState(): UseGameStateApi {
  const [state, dispatch] = useReducer(reducer, initialState)

  const api = useMemo<UseGameStateApi>(() => {
    return {
      state,
      dispatch,
      startGame: (word) => {
        dispatch({ type: 'START_GAME', payload: { word: word ?? state.currentWord } })
      },
      attemptCut: (touchX, result) => {
        dispatch({ type: 'ATTEMPT_CUT', payload: { touchX, result } })
      },
      nextWord: () => dispatch({ type: 'NEXT_WORD' }),
      resumePlaying: () => dispatch({ type: 'RESUME_PLAYING' }),
      resetGame: () => dispatch({ type: 'RESET_GAME' }),
    }
  }, [state])

  // hint 단계(1/2/3)은 failCount로 UI에서 직접 판단 가능.
  // 참고: HINT_THRESHOLDS = [1,2,3]
  void HINT_THRESHOLDS

  return api
}

