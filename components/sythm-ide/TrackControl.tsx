'use client'

import { useState } from 'react'
import { Headphones, Music, Volume2, VolumeX } from 'lucide-react'

import type { TrackState } from '@/types/multitrack'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'

/**
 * Mapeamento de instrumentos para cores de UI, para fácil identificação visual.
 */
const INSTRUMENT_COLORS = {
  default: 'bg-blue-500',
  bass: 'bg-purple-500',
  lead: 'bg-yellow-500',
  pad: 'bg-green-500',
  kick: 'bg-red-500',
  snare: 'bg-orange-500',
  hihat: 'bg-cyan-500',
} as const

interface TrackControlProps {
  /**
   * O objeto de estado completo da track.
   */
  track: TrackState
  /**
   * Função para mutar a track.
   */
  onMute: (trackId: string) => void
  /**
   * Função para desmutar a track.
   */
  onUnmute: (trackId: string) => void
  /**
   * Função para solar a track.
   */
  onSolo: (trackId: string) => void
  /**
   * Função para remover o solo da track.
   */
  onUnsolo: (trackId: string) => void
  /**
   * Função para alterar o volume da track.
   */
  onVolumeChange: (trackId: string, volume: number) => void
}

export function TrackControl({
  track,
  onMute,
  onUnmute,
  onSolo,
  onUnsolo,
  onVolumeChange,
}: TrackControlProps) {
  // O estado de volume local é mantido em 0-150 para o Slider,
  // enquanto o estado global 'track.volume' é 0-1.5.
  const [localVolume, setLocalVolume] = useState([track.volume * 100])

  const handleMuteToggle = () => {
    if (track.isMuted) {
      onUnmute(track.id)
    } else {
      onMute(track.id)
    }
  }

  const handleSoloToggle = () => {
    if (track.isSoloed) {
      onUnsolo(track.id)
    } else {
      onSolo(track.id)
    }
  }

  const handleVolumeChange = (value: number[]) => {
    const volume = value[0] / 100
    setLocalVolume(value)
    onVolumeChange(track.id, volume)
  }

  const instrumentColor =
    INSTRUMENT_COLORS[track.instrument as keyof typeof INSTRUMENT_COLORS] ||
    INSTRUMENT_COLORS.default

  return (
    <Card
      className={`bg-card border-border transition-all duration-200 ${
        track.isSoloed ? 'ring-2 ring-yellow-400' : ''
      } ${track.isMuted ? 'opacity-50' : ''}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${instrumentColor}`} />
            {track.name}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant={track.isSoloed ? 'default' : 'outline'}
              size="sm"
              onClick={handleSoloToggle}
              className="h-6 px-2 text-xs"
              title="Solo track"
            >
              S
            </Button>
            <Button
              variant={track.isMuted ? 'destructive' : 'outline'}
              size="sm"
              onClick={handleMuteToggle}
              className="h-6 px-2"
              title={track.isMuted ? 'Unmute' : 'Mute'}
            >
              {track.isMuted ? (
                <VolumeX className="w-3 h-3" />
              ) : (
                <Volume2 className="w-3 h-3" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Informações da track */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Music className="w-3 h-3" />
            <span>{track.instrument}</span>
          </div>
          <div className="flex items-center gap-1">
            <Headphones className="w-3 h-3" />
            <span>{track.events.length} events</span>
          </div>
        </div>

        {/* Controle de volume */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label className="text-muted-foreground">Volume</label>
            <span className="text-muted-foreground">
              {Math.round(localVolume[0])}%
            </span>
          </div>
          <Slider
            value={localVolume}
            onValueChange={handleVolumeChange}
            max={150}
            min={0}
            step={1}
            className="w-full"
          />
        </div>

        {/* Indicador de atividade */}
        <div className="flex items-center justify-center">
          <div
            className={`w-full h-1 rounded-full transition-all duration-300 ${
              track.isActive && !track.isMuted
                ? `${instrumentColor} animate-pulse`
                : 'bg-muted'
            }`}
          />
        </div>
      </CardContent>
    </Card>
  )
}