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

  // const [currentExecutingLine, setCurrentExecutingLine] = useState<number>(-1)  // COMENTAR ESTA LINHA

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
      // setCurrentExecutingLine(-1)  // COMENTAR ESTA LINHA
    },
    onComplete: () => {
      setAudioContext(prev => ({ ...prev, isPlaying: false }))
      // setCurrentExecutingLine(-1)  // COMENTAR ESTA LINHA
      console.log('Composition completed')
    },
    // COMENTAR ESTE BLOCO INTEIRO
    /*
    onLineExecute: (line) => {
      setCurrentExecutingLine(line)
      console.log(`Executing line: ${line}`)
    }
    */
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
      // setCurrentExecutingLine(-1)  // COMENTAR ESTA LINHA

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
      // setCurrentExecutingLine(-1)  // COMENTAR ESTA LINHA
      
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
    // setCurrentExecutingLine(-1)  // COMENTAR ESTA LINHA
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
    // currentExecutingLine,  // COMENTAR ESTA LINHA
    executeCode,
    stopExecution,
    updateBPM,
    getState: () => interpreter.getState()
  }
}