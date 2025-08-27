'use client'

import { useState, useEffect } from 'react'
import type { AudioContextType } from '@/types/sythm'

export function useAudioContext() {
  const [audioContext, setAudioContext] = useState<AudioContextType>({
    context: null,
    isPlaying: false,
    bpm: 120,
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)()
      setAudioContext((prev) => ({ ...prev, context }))
    }
  }, [])

  const playNote = (frequency: number, duration = 0.5) => {
    if (!audioContext.context) return

    const oscillator = audioContext.context.createOscillator()
    const gainNode = audioContext.context.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.context.destination)

    oscillator.frequency.setValueAtTime(frequency, audioContext.context.currentTime)
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, audioContext.context.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.context.currentTime + duration)

    oscillator.start(audioContext.context.currentTime)
    oscillator.stop(audioContext.context.currentTime + duration)
  }

  const executeCode = (code: string) => {
    if (!audioContext.context) return

    setAudioContext((prev) => ({ ...prev, isPlaying: true }))

    const lines = code.split('\n').filter((line) => line.trim() && !line.trim().startsWith('//'))

    lines.forEach((line, index) => {
      setTimeout(() => {
        if (line.includes('note("C4"') || line.includes('note("A4"')) {
          playNote(440) // A4
        } else if (line.includes('bass(')) {
          playNote(130) // C3
        } else if (line.includes('synth(')) {
          playNote(523) // C5
        }
      }, index * 500)
    })

    setTimeout(
      () => {
        setAudioContext((prev) => ({ ...prev, isPlaying: false }))
      },
      lines.length * 500 + 1000,
    )
  }

  const stopExecution = () => {
    setAudioContext((prev) => ({ ...prev, isPlaying: false }))
  }

  return {
    audioContext,
    playNote,
    executeCode,
    stopExecution,
  }
}