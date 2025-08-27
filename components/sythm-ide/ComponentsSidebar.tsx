'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Music, Drum, Zap } from 'lucide-react'
import type { Component } from '@/types/sythm'

const COMPONENTS: Component[] = [
  {
    title: 'Notes',
    description: 'Basic note generation and sequencing',
    icon: Music,
    subcomponents: ['note()', 'chord()', 'scale()'],
  },
  {
    title: 'Bass',
    description: 'Low-frequency bass lines and patterns',
    icon: Music,
    subcomponents: ['bass()', 'bassline()', 'subbass()'],
  },
  {
    title: 'Drums',
    description: 'Percussion and rhythm patterns',
    icon: Drum,
    subcomponents: ['kick()', 'snare()', 'hihat()', 'pattern()'],
  },
  {
    title: 'Synth',
    description: 'Synthesizer sounds and effects',
    icon: Zap,
    subcomponents: ['synth()', 'lead()', 'pad()', 'arp()'],
  },
  {
    title: 'FX',
    description: 'Audio effects and processing',
    icon: Zap,
    subcomponents: ['reverb()', 'delay()', 'filter()', 'distortion()'],
  },
]

interface ComponentsSidebarProps {
  onAddComponent: (component: string) => void
}

export function ComponentsSidebar({ onAddComponent }: ComponentsSidebarProps) {
  return (
    <div className="w-80 p-4 bg-sidebar border-l border-border">
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
                    className="text-xs bg-muted px-2 py-1 rounded text-primary cursor-pointer hover:bg-accent"
                    onClick={() => onAddComponent('\n' + sub)}
                  >
                    {sub}
                  </code>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}