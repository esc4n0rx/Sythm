'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { tokenizeCode, getColorForType } from '@/lib/syntax-highlighter'

interface CodeEditorProps {
  code: string
  onChange: (code: string) => void
  currentExecutingLine?: number
}

export function CodeEditor({ code, onChange, currentExecutingLine = -1 }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  // Calcula o número total de linhas
  const lines = code.split('\n')
  const lineCount = lines.length

  // Sincroniza o scroll entre textarea, highlight overlay e line numbers
  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement
    const newScrollTop = target.scrollTop
    const newScrollLeft = target.scrollLeft
    
    setScrollTop(newScrollTop)
    setScrollLeft(newScrollLeft)

    // Sincroniza o scroll do overlay de highlight
    if (highlightRef.current) {
      highlightRef.current.scrollTop = newScrollTop
      highlightRef.current.scrollLeft = newScrollLeft
    }

    // Sincroniza o scroll vertical dos números de linha
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = newScrollTop
    }
  }, [])

  // Sincroniza scroll quando o código muda externamente
  useEffect(() => {
    if (textareaRef.current && highlightRef.current && lineNumbersRef.current) {
      const scrollTop = textareaRef.current.scrollTop
      const scrollLeft = textareaRef.current.scrollLeft
      
      highlightRef.current.scrollTop = scrollTop
      highlightRef.current.scrollLeft = scrollLeft
      lineNumbersRef.current.scrollTop = scrollTop
    }
  }, [code])

  const renderHighlightedCode = () => {
    return lines.map((line, lineIndex) => {
      const actualLineNumber = lineIndex + 1
      const isExecuting = currentExecutingLine === actualLineNumber
      
      return (
        <div 
          key={lineIndex} 
          className={`min-h-[1.5rem] leading-6 relative ${
            isExecuting ? 'bg-primary/20 rounded-sm' : ''
          }`}
        >
          {/* Indicador de execução */}
          {isExecuting && (
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-sm" />
          )}
          
          <div className={isExecuting ? 'pl-2' : ''}>
            {line === '' ? (
              // Linha vazia precisa ter altura para manter alinhamento
              <span className="opacity-0">.</span>
            ) : (
              tokenizeCode(line).map((part, partIndex) => (
                <span key={partIndex} style={getColorForType(part.type)}>
                  {part.text}
                </span>
              ))
            )}
          </div>
        </div>
      )
    })
  }

  const renderLineNumbers = () => {
    return Array.from({ length: lineCount }, (_, i) => {
      const lineNumber = i + 1
      const isExecuting = currentExecutingLine === lineNumber
      
      return (
        <div
          key={lineNumber}
          className={`h-6 leading-6 text-right pr-2 select-none text-sm font-mono relative ${
            isExecuting 
              ? 'text-primary font-bold bg-primary/10' 
              : 'text-muted-foreground/60'
          }`}
        >
          {/* Indicador visual na numeração */}
          {isExecuting && (
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-primary" />
          )}
          {lineNumber}
        </div>
      )
    })
  }

  return (
    <div className="flex-1 p-4">
      <div className="h-full bg-card rounded-lg border border-border overflow-hidden flex">
        {/* Line Numbers */}
        <div className="bg-sidebar border-r border-border">
          <div
            ref={lineNumbersRef}
            className="overflow-hidden h-full w-12 py-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div className="text-sm">
              {renderLineNumbers()}
            </div>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 relative overflow-hidden">
          {/* Syntax Highlighting Overlay */}
          <div
            ref={highlightRef}
            className="absolute inset-0 p-4 pointer-events-none font-mono text-sm leading-6 whitespace-pre-wrap overflow-auto"
            style={{
              color: '#e2e8f0',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {renderHighlightedCode()}
          </div>

          {/* Invisible Textarea for Input */}
          <Textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            className="absolute inset-0 h-full w-full bg-transparent border-0 resize-none font-mono text-sm leading-6 p-4 focus:ring-0 overflow-auto"
            placeholder="// Start coding your music here..."
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            style={{
              color: 'transparent',
              caretColor: '#ffffff',
              background: 'transparent',
            }}
          />
        </div>
      </div>
    </div>
  )
}