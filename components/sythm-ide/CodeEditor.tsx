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
  const [viewportHeight, setViewportHeight] = useState(0)

  // Configuração do virtual scroll
  const LINE_HEIGHT = 24 // 1.5rem
  const BUFFER_LINES = 10 // Linhas extras para suavizar o scroll

  // Calcula o número total de linhas
  const lines = useMemo(() => code.split('\n'), [code])
  const lineCount = lines.length

  // Calcula quais linhas estão visíveis
  const visibleRange = useMemo(() => {
    if (viewportHeight === 0) {
      return { start: 0, end: Math.min(50, lineCount) }
    }

    const visibleLines = Math.ceil(viewportHeight / LINE_HEIGHT)
    const startLine = Math.floor(scrollTop / LINE_HEIGHT)
    
    const start = Math.max(0, startLine - BUFFER_LINES)
    const end = Math.min(lineCount, startLine + visibleLines + BUFFER_LINES * 2)
    
    return { start, end }
  }, [scrollTop, viewportHeight, lineCount])

  // Observador de redimensionamento para calcular altura do viewport
  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setViewportHeight(entry.contentRect.height)
      }
    })

    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

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

  // Renderização virtualizada do código destacado
  const renderHighlightedCode = () => {
    const totalHeight = lineCount * LINE_HEIGHT
    const offsetTop = visibleRange.start * LINE_HEIGHT
    
    const visibleLines = lines.slice(visibleRange.start, visibleRange.end)
    
    return (
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetTop}px)` }}>
          {visibleLines.map((line, index) => {
            const lineIndex = visibleRange.start + index
            
            return (
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
            )
          })}
        </div>
      </div>
    )
  }

  // Renderização virtualizada dos números de linha
  const renderLineNumbers = () => {
    const totalHeight = lineCount * LINE_HEIGHT
    const offsetTop = visibleRange.start * LINE_HEIGHT
    
    return (
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetTop}px)` }}>
          {Array.from({ length: visibleRange.end - visibleRange.start }, (_, i) => {
            const lineNumber = visibleRange.start + i + 1
            
            return (
              <div
                key={lineNumber}
                className="h-6 leading-6 text-right pr-2 select-none text-sm font-mono text-muted-foreground/60"
                style={{ height: LINE_HEIGHT }}
              >
                {lineNumber}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4">
      <style jsx>{`
        .hide-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
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
            className="overflow-hidden h-full w-12 py-4 hide-scrollbar"
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
            className="absolute inset-0 p-4 pointer-events-none font-mono text-sm leading-6 whitespace-pre-wrap overflow-auto hide-scrollbar"
            style={{
              color: '#e2e8f0'
            }}
          >
            {renderHighlightedCode()}
          </div>

          {/* Input Textarea */}
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
              lineHeight: `${LINE_HEIGHT}px`
            }}
          />
        </div>
      </div>
    </div>
  )
}