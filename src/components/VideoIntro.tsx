import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'

type Props = {
  onDone: () => void
}

export function VideoIntro({ onDone }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [started, setStarted] = useState(false)
  const [skipped, setSkipped] = useState(false)

  useEffect(() => {
    const skipPref = localStorage.getItem('dhruva_skip_intro')
    if (skipPref === 'true') {
      setSkipped(true)
      return
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || skipped) return

    const handleEnded = () => onDone()
    const handlePlaying = () => setStarted(true)
    const handleCanPlay = () => {
      // Video is ready to play — start immediately without fade delay
      video.play().catch(() => {})
    }

    video.addEventListener('ended', handleEnded)
    video.addEventListener('playing', handlePlaying)
    video.addEventListener('canplay', handleCanPlay)

    return () => {
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('playing', handlePlaying)
      video.removeEventListener('canplay', handleCanPlay)
    }
  }, [skipped, onDone])

  const handleSkip = () => {
    localStorage.setItem('dhruva_skip_intro', 'true')
    setSkipped(true)
    onDone()
  }

  if (skipped) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <video
        ref={videoRef}
        src="/intro.mp4"
        className={cn(
          'w-full h-full object-cover transition-opacity duration-700',
          started ? 'opacity-100' : 'opacity-0',
        )}
        muted
        playsInline
        preload="auto"
      />

      {/* Skip button */}
      <button
        onClick={handleSkip}
        className="absolute bottom-8 right-8 flex items-center gap-2 rounded-sm bg-white/10 backdrop-blur-md px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-white/50"
      >
        Skip intro
        <span className="text-xs opacity-75">(Press Esc)</span>
      </button>

      <EscKeyHandler onEscape={handleSkip} />
    </div>
  )
}

function EscKeyHandler({ onEscape }: { onEscape: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onEscape])
  return null
}
