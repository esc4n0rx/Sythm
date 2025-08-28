'use client'

import { useState, useEffect, useCallback } from 'react'
import { SythmLexer } from '@/lib/sythm/lexer'
import { SythmParser, SythmParseError } from '@/lib/sythm/parser'
import { SythmAudioEngine } from '@/lib/sythm/audio-engine'
import { SythmInterpreter } from '@/lib/sythm/interpreter'
import type { AudioContextType } from '@/types/sythm'
import type { InstrumentType } from '@/types/instruments'

export function useAudioContext() {
  const [audioContext, setAudioContext] = useState<AudioContextType>({
    context: null,
    isPlaying: false,
    bpm: 120,
  })

  const [currentInstrument, setCurrentInstrument] = useState<InstrumentType>('default')

  const [engine] = useState(() => new SythmAudioEngine({ baseBeatsPerMinute: 120 }))
  const [interpreter] = useState(() => new SythmInterpreter(engine, {
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
    onError: (error, node) => {
      console.error('Interpreter error:', error, node)
    },
    onComplete: () => {
      setAudioContext(prev => ({ ...prev, isPlaying: false }))
      console.log('Composition completed')
    }
  }))

  useEffect(() => {
    // Inicializa o contexto quando o componente monta
    if (typeof window !== 'undefined') {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)()
      setAudioContext(prev => ({ ...prev, context }))
    }

    // Cleanup
    return () => {
      stopExecution()
      engine.dispose()
    }
  }, [])

  /**
   * Executa código Sythm
   */
  const executeCode = useCallback(async (code: string) => {
    try {
      setAudioContext(prev => ({ ...prev, isPlaying: true }))

      // Fase 1: Lexical Analysis (Tokenização)
      const lexer = new SythmLexer(code)
      const tokens = lexer.tokenize()
      console.log('Tokens:', tokens)

      // Fase 2: Syntax Analysis (Parsing)
      const parser = new SythmParser(tokens)
      const ast = parser.parse()
      console.log('AST:', ast)

      // Fase 3: Execution (Interpretação)
      await interpreter.execute(ast)

    } catch (error) {
      setAudioContext(prev => ({ ...prev, isPlaying: false }))
      
      if (error instanceof SythmParseError) {
        console.error(`Parse Error: ${error.message}`)
        alert(`Erro de sintaxe: ${error.message}`)
      } else {
        console.error('Execution error:', error)
        alert(`Erro de execução: ${(error as Error).message}`)
      }
    }
  }, [interpreter])

  /**
   * Para a execução
   */
  const stopExecution = useCallback(() => {
    interpreter.stop()
    engine.stop()
    setAudioContext(prev => ({ ...prev, isPlaying: false }))
  }, [interpreter, engine])

  /**
   * Atualiza BPM
   */
  const updateBPM = useCallback((newBpm: number) => {
    engine.updateConfig({ baseBeatsPerMinute: newBpm })
    setAudioContext(prev => ({ ...prev, bpm: newBpm }))
  }, [engine])

  /**
   * Muda instrumento atual manualmente
   */
  const changeInstrument = useCallback((instrument: InstrumentType) => {
    engine.setCurrentInstrument(instrument)
    setCurrentInstrument(instrument)
  }, [engine])

  return {
    audioContext,
    currentInstrument,
    executeCode,
    stopExecution,
    updateBPM,
    changeInstrument,
    getState: () => interpreter.getState(),
    getAvailableInstruments: () => engine.getAvailableInstruments()
  }
}