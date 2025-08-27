'use client'

import { useState, useEffect, useCallback } from 'react'
import { SythmLexer } from '@/lib/sythm/lexer'
import { SythmParser, SythmParseError } from '@/lib/sythm/parser'
import { SythmAudioEngine } from '@/lib/sythm/audio-engine'
import { SythmInterpreter } from '@/lib/sythm/interpreter'
import type { AudioContextType } from '@/types/sythm'

export function useAudioContext() {
  const [audioContext, setAudioContext] = useState<AudioContextType>({
    context: null,
    isPlaying: false,
    bpm: 120,
  })

  const [currentExecutingLine, setCurrentExecutingLine] = useState<number>(-1)

  const [engine] = useState(() => new SythmAudioEngine({ baseBeatsPerMinute: 120 }))
  const [interpreter] = useState(() => new SythmInterpreter(engine, {
    onNotePlay: (note, duration) => {
      console.log(`Playing note: ${note} for ${duration} beats`)
    },
    onRest: (duration) => {
      console.log(`Rest for ${duration} beats`)
    },
    onSpeedChange: (modifier) => {
      console.log(`Speed changed: ${modifier}x`)
    },
    onError: (error, node) => {
      console.error('Interpreter error:', error, node)
      setCurrentExecutingLine(-1) // Limpa indicador em caso de erro
    },
    onComplete: () => {
      setAudioContext(prev => ({ ...prev, isPlaying: false }))
      setCurrentExecutingLine(-1)
      console.log('Composition completed')
    },
    onLineExecute: (line) => {
      setCurrentExecutingLine(line)
      console.log(`Executing line: ${line}`) // Debug
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
      setCurrentExecutingLine(-1)

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
      setCurrentExecutingLine(-1)
      
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
    setCurrentExecutingLine(-1)
  }, [interpreter, engine])

  /**
   * Atualiza BPM
   */
  const updateBPM = useCallback((newBpm: number) => {
    engine.updateConfig({ baseBeatsPerMinute: newBpm })
    setAudioContext(prev => ({ ...prev, bpm: newBpm }))
  }, [engine])

  return {
    audioContext,
    currentExecutingLine,
    executeCode,
    stopExecution,
    updateBPM,
    getState: () => interpreter.getState()
  }
}