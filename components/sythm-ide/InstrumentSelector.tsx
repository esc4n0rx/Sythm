'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Music, Volume2, Drum, Headphones } from 'lucide-react'
import type { InstrumentType } from '@/types/instruments'

const INSTRUMENT_CATEGORIES = {
  synths: {
    title: 'Sintetizadores',
    icon: Music,
    instruments: ['default', 'bass', 'lead', 'pad'] as InstrumentType[]
  },
  drums: {
    title: 'Percussão',
    icon: Drum,
    instruments: ['kick', 'snare', 'hihat'] as InstrumentType[]
  }
}

const INSTRUMENT_INFO = {
  default: { name: 'Padrão', description: 'Som sintetizado básico', color: 'text-blue-400' },
  bass: { name: 'Bass', description: 'Baixo profundo e encorpado', color: 'text-purple-400' },
  lead: { name: 'Lead', description: 'Melodias principais e solos', color: 'text-yellow-400' },
  pad: { name: 'Pad', description: 'Texturas atmosféricas', color: 'text-green-400' },
  kick: { name: 'Kick', description: 'Bumbo eletrônico', color: 'text-red-400' },
  snare: { name: 'Snare', description: 'Caixa eletrônica', color: 'text-orange-400' },
  hihat: { name: 'Hi-Hat', description: 'Chimbal eletrônico', color: 'text-cyan-400' },
}

interface InstrumentSelectorProps {
  currentInstrument: InstrumentType
  onInstrumentChange: (instrument: InstrumentType) => void
  onAddToCode: (code: string) => void
}

export function InstrumentSelector({
  currentInstrument,
  onInstrumentChange,
  onAddToCode
}: InstrumentSelectorProps) {
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentType>(currentInstrument)

  const handleInstrumentSelect = (instrument: InstrumentType) => {
    setSelectedInstrument(instrument)
    onInstrumentChange(instrument)
  }

  const addInstrumentToCode = (instrument: InstrumentType) => {
    onAddToCode(`\n@${instrument}`)
  }

  const renderInstrumentButton = (instrument: InstrumentType) => {
    const info = INSTRUMENT_INFO[instrument]
    const isActive = selectedInstrument === instrument
    
    return (
      <div key={instrument} className="flex items-center gap-2">
        <Button
          variant={isActive ? "default" : "outline"}
          size="sm"
          onClick={() => handleInstrumentSelect(instrument)}
          className={`flex-1 justify-start ${isActive ? '' : 'hover:bg-accent'}`}
        >
          <span className={`w-2 h-2 rounded-full mr-2 ${info.color.replace('text-', 'bg-')}`} />
          {info.name}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => addInstrumentToCode(instrument)}
          className="px-2"
          title={`Adicionar @${instrument} ao código`}
        >
          +
        </Button>
      </div>
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-primary" />
          Seletor de Instrumentos
        </CardTitle>
        <CardDescription className="text-xs">
          Escolha o instrumento para as próximas notas
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-4">
        {/* Seletor rápido */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Instrumento Atual:
          </label>
          <Select 
            value={selectedInstrument} 
            onValueChange={(value) => handleInstrumentSelect(value as InstrumentType)}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(INSTRUMENT_INFO).map(([key, info]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${info.color.replace('text-', 'bg-')}`} />
                    {info.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Categorias de instrumentos */}
        {Object.entries(INSTRUMENT_CATEGORIES).map(([categoryKey, category]) => (
          <div key={categoryKey} className="space-y-2">
            <div className="flex items-center gap-2">
              <category.icon className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                {category.title}
              </span>
            </div>
            <div className="space-y-1">
              {category.instruments.map(renderInstrumentButton)}
            </div>
          </div>
        ))}

        {/* Informações do instrumento selecionado */}
        <div className="p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${INSTRUMENT_INFO[selectedInstrument].color.replace('text-', 'bg-')}`} />
            <span className="text-sm font-medium">
              {INSTRUMENT_INFO[selectedInstrument].name}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {INSTRUMENT_INFO[selectedInstrument].description}
          </p>
        </div>

        {/* Dica de uso */}
        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          💡 <strong>Dica:</strong> Use <code className="bg-background px-1 rounded">@{selectedInstrument}</code> no seu código para trocar de instrumento.
        </div>
      </CardContent>
    </Card>
  )
}