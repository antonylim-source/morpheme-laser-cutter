import { useCallback, useEffect, useRef } from 'react'
import { publicAsset } from '../utils/publicAsset'

const BGM_VOLUME = 0.3

/** 배경음악 재생 훅 — 자동재생 정책 때문에 play()는 사용자 제스처 안에서 호출해야 함 */
export function useBgm() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mutedRef = useRef(false)

  const getAudio = () => {
    if (!audioRef.current) {
      const audio = new Audio(publicAsset('audio/bgm.mp3'))
      audio.loop = true
      audio.volume = BGM_VOLUME
      audio.preload = 'auto'
      audio.muted = mutedRef.current
      audioRef.current = audio
    }
    return audioRef.current
  }

  const play = useCallback(() => {
    // 자동재생 차단 등 재생 실패는 조용히 무시
    void getAudio()
      .play()
      .catch(() => {})
  }, [])

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const setMuted = useCallback((muted: boolean) => {
    mutedRef.current = muted
    if (audioRef.current) audioRef.current.muted = muted
  }, [])

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  return { play, pause, setMuted }
}
