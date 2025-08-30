'use client'

import { useState, useEffect, useCallback } from 'react'
import { SythmLexer } from '@/lib/sythm/lexer'
import { SythmParser, SythmParseError } from '@/lib/sythm/parser'
import { SythmAudioEngine } from '@/lib/sythm/audio-engine'
import { SythmInterpreter } from '@/lib/sythm/interpreter'
import type { AudioContextType } from '@/types/sythm'
import type { InstrumentType } from '@/types/instruments'
import type { MultiTrackState } from '@/types/multitrack'

/**
 * Hook customizado para gerenciar todo o ciclo de vida de áudio do Sythm.
 * Encapsula o AudioEngine, Interpreter e o estado do React.
 */
export function useAudioContext() {
  const [audioContext, setAudioContext] = useState<AudioContextType>({
    context: null,
    isPlaying: false,
    bpm: 120,
  })
  const [currentInstrument, setCurrentInstrument] =
    useState<InstrumentType>('default')
  const [multiTrackState, setMultiTrackState] = useState<MultiTrackState | null>(
    null,
  )
  const [isMultiTrackMode, setIsMultiTrackMode] = useState(false)

  // Inicializa o engine e o interpretador de forma lazy para evitar recriações
  const [engine] = useState(
    () => new SythmAudioEngine({ baseBeatsPerMinute: 120 }),
  )

  const [interpreter] = useState(
    () =>
      new SythmInterpreter(engine, {
        onNotePlay: (note, duration) => {
          console.log(`Playing note: ${note} for ${duration} beats`)
        },
        onChordPlay: (notes, duration) => {
          console.log(`Playing chord: [${notes.join(' ')}] for ${duration} beats`)
        },
        onRest: (duration) => {
          console.log(`Rest for ${duration} beats`)
        },
        onSpeedChange: (modifier) => {
          console.log(`Speed changed: ${modifier}x`)
        },
        onInstrumentChange: (instrument) => {
          console.log(`Instrument changed to: ${instrument}`)
          setCurrentInstrument(instrument)
        },
        onTrackEvent: (trackId, event) => {
          // console.log(`Track ${trackId} event:`, event);
          updateMultiTrackState() // Atualiza estado multitrack em tempo real
        },
        onError: (error, node) => {
          console.error('Interpreter error:', error, node)
        },
        onComplete: () => {
          setAudioContext((prev) => ({ ...prev, isPlaying: false }))
          console.log('Composition completed')
        },
      }),
  )

  useEffect(() => {
    // Inicializa o AudioContext de forma segura no cliente
    if (typeof window !== 'undefined') {
      const context = new (window.AudioContext ||
        (window as any).webkitAudioContext)()
      setAudioContext((prev) => ({ ...prev, context }))
    }

    // Função de cleanup para parar a execução e liberar recursos ao desmontar
    return () => {
      stopExecution()
      engine.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Atualiza o estado do React com as informações mais recentes do modo multitrack.
   */
  const updateMultiTrackState = useCallback(() => {
    const state = interpreter.getState()
    if (state.isMultiTrack && state.multiTrackState) {
      setMultiTrackState(state.multiTrackState)
      setIsMultiTrackMode(true)
    } else {
      setMultiTrackState(null)
      setIsMultiTrackMode(false)
    }
  }, [interpreter])

  /**
   * Processa e executa uma string de código Sythm.
   */
  const executeCode = useCallback(
    async (code: string) => {
      try {
        setAudioContext((prev) => ({ ...prev, isPlaying: true }))

        const lexer = new SythmLexer(code)
        const tokens = lexer.tokenize()

        const parser = new SythmParser(tokens)
        const ast = parser.parse()

        await interpreter.execute(ast)

        updateMultiTrackState()
      } catch (error) {
        setAudioContext((prev) => ({ ...prev, isPlaying: false }))
        if (error instanceof SythmParseError) {
          console.error(`Parse Error: ${error.message}`)
          alert(`Erro de sintaxe: ${error.message}`)
        } else {
          console.error('Execution error:', error)
          alert(`Erro de execução: ${(error as Error).message}`)
        }
      }
    },
    [interpreter, updateMultiTrackState],
  )

  /**
   * Para qualquer execução de áudio em andamento.
   */
  const stopExecution = useCallback(() => {
    interpreter.stop()
    engine.stop()
    setAudioContext((prev) => ({ ...prev, isPlaying: false }))
    updateMultiTrackState()
  }, [interpreter, engine, updateMultiTrackState])

  /**
   * Atualiza o BPM (batidas por minuto) no engine.
   */
  const updateBPM = useCallback(
    (newBpm: number) => {
      engine.updateConfig({ baseBeatsPerMinute: newBpm })
      setAudioContext((prev) => ({ ...prev, bpm: newBpm }))
    },
    [engine],
  )

  /**
   * Altera o instrumento atual manualmente.
   */
  const changeInstrument = useCallback(
    (instrument: InstrumentType) => {
      engine.setCurrentInstrument(instrument)
      setCurrentInstrument(instrument)
    },
    [engine],
  )

  // --- Controles Multitrack ---
  const muteTrack = useCallback(
    (trackId: string) => {
      interpreter.muteTrack(trackId)
      updateMultiTrackState()
    },
    [interpreter, updateMultiTrackState],
  )

  const unmuteTrack = useCallback(
    (trackId: string) => {
      interpreter.unmuteTrack(trackId)
      updateMultiTrackState()
    },
    [interpreter, updateMultiTrackState],
  )

  const soloTrack = useCallback(
    (trackId: string) => {
      interpreter.soloTrack(trackId)
      updateMultiTrackState()
    },
    [interpreter, updateMultiTrackState],
  )

  const unsoloTrack = useCallback(
    (trackId: string) => {
      interpreter.unsoloTrack(trackId)
      updateMultiTrackState()
    },
    [interpreter, updateMultiTrackState],
  )

  const setTrackVolume = useCallback(
    (trackId: string, volume: number) => {
      interpreter.setTrackVolume(trackId, volume)
      updateMultiTrackState()
    },
    [interpreter, updateMultiTrackState],
  )

  return {
    audioContext,
    currentInstrument,
    multiTrackState,
    isMultiTrackMode,
    executeCode,
    stopExecution,
    updateBPM,
    changeInstrument,
    muteTrack,
    unmuteTrack,
    soloTrack,
    unsoloTrack,
    setTrackVolume,
    getState: () => interpreter.getState(),
    getAvailableInstruments: () => engine.getAvailableInstruments(),
  }
}