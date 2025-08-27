'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Play, Square, HelpCircle } from 'lucide-react'
import { useState } from 'react'

interface HeaderProps {
  isPlaying: boolean
  bpm: number
  onNew: () => void
  onSave: () => void
  onExecute: () => void
  onStop: () => void
  onHelp: () => void
  onBPMChange?: (bpm: number) => void
}

export function Header({
  isPlaying,
  bpm,
  onNew,
  onSave,
  onExecute,
  onStop,
  onHelp,
  onBPMChange,
}: HeaderProps) {
  const [bpmInput, setBpmInput] = useState(bpm.toString())

  const handleBPMSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newBpm = parseInt(bpmInput)
    if (newBpm >= 60 && newBpm <= 200 && onBPMChange) {
      onBPMChange(newBpm)
    } else {
      setBpmInput(bpm.toString()) // Reverte se inválido
    }
  }

  return (
    <header className="bg-sidebar border-b border-border px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-bold text-primary">Sythm</h1>
        <nav className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onNew}>
            Novo
          </Button>
          <Button variant="ghost" size="sm" onClick={onSave}>
            Salvar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={isPlaying ? onStop : onExecute}
            className="flex items-center gap-2"
          >
            {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? 'Parar' : 'Executar'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onHelp}>
            <HelpCircle className="w-4 h-4 mr-2" />
            Ajuda
          </Button>
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">BPM:</span>
        <form onSubmit={handleBPMSubmit}>
          <Input
            type="number"
            value={bpmInput}
            onChange={(e) => setBpmInput(e.target.value)}
            onBlur={handleBPMSubmit}
            className="w-20 h-8 text-center"
            min="60"
            max="200"
          />
        </form>
      </div>
    </header>
  )
}