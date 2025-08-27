'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Music, Clock, Volume2, Pause } from 'lucide-react'
import type { Component } from '@/types/sythm'

const COMPONENTS: Component[] = [
  {
    title: 'Notas',
    description: 'Notas musicais básicas',
    icon: Music,
    subcomponents: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
  },
  {
    title: 'Acidentes',
    description: 'Notas com sustenidos e bemóis',
    icon: Music,
    subcomponents: ['C#4', 'D#4', 'F#4', 'G#4', 'A#4', 'Bb4', 'Db4'],
  },
  {
    title: 'Durações',
    description: 'Notas com durações específicas',
    icon: Clock,
    subcomponents: ['C4 0.5', 'D4 2', 'E4 1.5', 'F4 4'],
  },
  {
    title: 'Controles',
    description: 'Comandos de tempo e pausas',
    icon: Volume2,
    subcomponents: ['rest', 'rest 2', 'slow', 'fast'],
  },
  {
    title: 'Escalas',
    description: 'Sequências de notas pré-definidas',
    icon: Music,
    subcomponents: ['// Dó maior\nC4\nD4\nE4\nF4\nG4\nA4\nB4\nC5'],
  },
]

interface ComponentsSidebarProps {
  onAddComponent: (component: string) => void
}

export function ComponentsSidebar({ onAddComponent }: ComponentsSidebarProps) {
  return (
    <div className="w-80 p-4 bg-sidebar border-l border-border overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4 text-sidebar-foreground">Componentes</h2>
      <div className="space-y-3">
        {COMPONENTS.map((component, index) => (
          <Card key={index} className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <component.icon className="w-4 h-4 text-primary" />
                {component.title}
              </CardTitle>
              <CardDescription className="text-xs">{component.description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-1">
                {component.subcomponents.map((sub, subIndex) => (
                  <code
                    key={subIndex}
                    className="text-xs bg-muted px-2 py-1 rounded text-primary cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => onAddComponent('\n' + sub)}
                  >
                    {sub.includes('\n') ? sub.split('\n')[0] + '...' : sub}
                  </code>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="mt-6 p-3 bg-muted rounded-lg">
        <h3 className="text-sm font-medium mb-2">Sintaxe Básica:</h3>
        <div className="text-xs space-y-1 text-muted-foreground">
          <div><code>C4</code> - toca nota C na 4ª oitava</div>
          <div><code>C4 2</code> - toca C4 por 2 beats</div>
          <div><code>rest</code> - pausa de 1 beat</div>
          <div><code>slow</code> - deixa mais lento</div>
          <div><code>fast</code> - deixa mais rápido</div>
        </div>
      </div>
    </div>
  )
}