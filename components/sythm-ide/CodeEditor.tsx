'use client'

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { tokenizeCode, getColorForType } from '@/lib/syntax-highlighter'

interface CodeEditorProps {
  code: string
  onChange: (code: string) => void
}

export function CodeEditor({ code, onChange }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [scrollTop, setScrollTop] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  // Configuração otimizada para performance
  const LINE_HEIGHT = 24 // 1.5rem

  // Calcula o número total de linhas
  const lines = useMemo(() => code.split('\n'), [code])
  const lineCount = lines.length

  // Sincronização melhorada do scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement
    const newScrollTop = target.scrollTop
    const newScrollLeft = target.scrollLeft
    
    setScrollTop(newScrollTop)
    setScrollLeft(newScrollLeft)

    // Sincronização mais robusta
    requestAnimationFrame(() => {
      if (highlightRef.current) {
        highlightRef.current.scrollTop = newScrollTop
        highlightRef.current.scrollLeft = newScrollLeft
      }

      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = newScrollTop
      }
    })
  }, [])

  // Sincronização quando código muda externamente
  useEffect(() => {
    if (textareaRef.current && highlightRef.current && lineNumbersRef.current) {
      const currentScrollTop = textareaRef.current.scrollTop
      const currentScrollLeft = textareaRef.current.scrollLeft
      
      highlightRef.current.scrollTop = currentScrollTop
      highlightRef.current.scrollLeft = currentScrollLeft
      lineNumbersRef.current.scrollTop = currentScrollTop
    }
  }, [code])

  // Renderização normal do código destacado
  const renderHighlightedCode = () => {
    return lines.map((line, lineIndex) => (
      <div 
        key={lineIndex} 
        className="min-h-[1.5rem] leading-6 relative"
        style={{ height: LINE_HEIGHT }}
      >
        <div>
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
    ))
  }

  // Renderização normal dos números de linha
  const renderLineNumbers = () => {
    return Array.from({ length: lineCount }, (_, i) => {
      const lineNumber = i + 1
      
      return (
        <div
          key={lineNumber}
          className="h-6 leading-6 text-right pr-2 select-none text-sm font-mono text-muted-foreground/60"
          style={{ height: LINE_HEIGHT }}
        >
          {lineNumber}
        </div>
      )
    })
  }

  return (
    <div className="flex-1 p-4">
      <style jsx>{`
        .hide-scrollbar-line-numbers {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .hide-scrollbar-line-numbers::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar-highlight {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .hide-scrollbar-highlight::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      
      <div 
        ref={containerRef}
        className="h-full bg-card rounded-lg border border-border overflow-hidden flex"
      >
        {/* Line Numbers */}
        <div className="bg-sidebar border-r border-border">
          <div
            ref={lineNumbersRef}
            className="overflow-hidden h-full w-12 py-4 hide-scrollbar-line-numbers"
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
            className="absolute inset-0 p-4 pointer-events-none font-mono text-sm leading-6 whitespace-pre-wrap overflow-auto hide-scrollbar-highlight"
            style={{
              color: '#e2e8f0'
            }}
          >
            <div className="font-mono text-sm leading-6 whitespace-pre-wrap">
              {renderHighlightedCode()}
            </div>
          </div>

          {/* Input Textarea com scroll VISÍVEL */}
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
              lineHeight: `${LINE_HEIGHT}px`,
              // IMPORTANTE: Não ocultar scrollbar do textarea principal
              scrollbarWidth: 'thin',
              scrollbarColor: '#4a5568 transparent'
            }}
          />
        </div>
      </div>
    </div>
  )
}