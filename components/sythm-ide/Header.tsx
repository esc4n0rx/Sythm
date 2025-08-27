'use client'

import { Button } from '@/components/ui/button'
import { Play, Square, HelpCircle } from 'lucide-react'

interface HeaderProps {
  isPlaying: boolean
  bpm: number
  onNew: () => void
  onSave: () => void
  onExecute: () => void
  onStop: () => void
  onHelp: () => void
}

export function Header({
  isPlaying,
  bpm,
  onNew,
  onSave,
  onExecute,
  onStop,
  onHelp,
}: HeaderProps) {
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
      <div className="text-sm text-muted-foreground">BPM: {bpm}</div>
    </header>
  )
}