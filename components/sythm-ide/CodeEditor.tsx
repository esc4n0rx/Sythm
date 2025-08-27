'use client'

import { useRef } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { tokenizeCode, getColorForType } from '@/lib/syntax-highlighter'

interface CodeEditorProps {
  code: string
  onChange: (code: string) => void
}

export function CodeEditor({ code, onChange }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const renderHighlightedCode = () => {
    return code.split('\n').map((line, lineIndex) => (
      <div key={lineIndex} className="leading-6">
        {tokenizeCode(line).map((part, partIndex) => (
          <span key={partIndex} style={getColorForType(part.type)}>
            {part.text}
          </span>
        ))}
      </div>
    ))
  }

  return (
    <div className="flex-1 p-4">
      <div className="h-full bg-card rounded-lg border border-border overflow-hidden">
        <div className="h-full relative">
          <Textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => onChange(e.target.value)}
            className="h-full w-full bg-transparent border-0 resize-none font-mono text-sm leading-6 p-4 focus:ring-0"
            placeholder="// Start coding your music here..."
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            style={{
              background: 'transparent',
              color: 'transparent',
              caretColor: '#ffffff',
            }}
          />
          <div
            className="absolute inset-0 p-4 pointer-events-none font-mono text-sm leading-6 whitespace-pre-wrap text-foreground"
            style={{
              background: 'transparent',
              color: '#e2e8f0',
            }}
          >
            {renderHighlightedCode()}
          </div>
        </div>
      </div>
    </div>
  )
}