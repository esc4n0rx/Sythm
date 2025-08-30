'use client'

import { useEffect, useState } from 'react'
import { Layers, Play, RotateCcw, Square } from 'lucide-react'

import type { MultiTrackState, TrackState } from '@/types/multitrack'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { TrackControl } from './TrackControl'

interface TrackMixerProps {
  /**
   * O estado global do multitrack, contendo todas as tracks e informações de playback.
   */
  multiTrackState?: MultiTrackState
  /**
   * Indica se a reprodução está ativa.
   */
  isPlaying: boolean
  /**
   * Função para iniciar a reprodução.
   */
  onPlay: () => void
  /**
   * Função para parar a reprodução.
   */
  onStop: () => void
  /**
   * Função para mutar uma track específica.
   */
  onTrackMute: (trackId: string) => void
  /**
   * Função para desmutar uma track específica.
   */
  onTrackUnmute: (trackId: string) => void
  /**
   * Função para solar uma track específica.
   */
  onTrackSolo: (trackId: string) => void
  /**
   * Função para remover o solo de uma track específica.
   */
  onTrackUnsolo: (trackId: string) => void
  /**
   * Função para alterar o volume de uma track específica.
   */
  onTrackVolumeChange: (trackId: string, volume: number) => void
  /**
   * Função para resetar o estado do mixer.
   */
  onReset: () => void
}

export function TrackMixer({
  multiTrackState,
  isPlaying,
  onPlay,
  onStop,
  onTrackMute,
  onTrackUnmute,
  onTrackSolo,
  onTrackUnsolo,
  onTrackVolumeChange,
  onReset,
}: TrackMixerProps) {
  const [tracks, setTracks] = useState<TrackState[]>([])

  useEffect(() => {
    if (multiTrackState?.tracks) {
      setTracks(Array.from(multiTrackState.tracks.values()))
    }
  }, [multiTrackState])

  // Estado de carregamento ou inicial, quando nenhuma track foi detectada.
  if (!multiTrackState || tracks.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            Track Mixer
          </CardTitle>
          <CardDescription className="text-xs">
            Use a sintaxe{' '}
            <code className="bg-muted px-1 rounded">track nome {'{{...}}'}</code>{' '}
            para ativar o modo multitrack.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground text-center py-8">
            Nenhuma track detectada
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calcula estados derivados a cada renderização para garantir consistência.
  const activeTracks = tracks.filter((track) => track.isActive)
  const mutedTracksCount = tracks.filter((track) => track.isMuted).length
  const soloedTracksCount = tracks.filter((track) => track.isSoloed).length

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Track Mixer
            </CardTitle>
            <CardDescription className="text-xs">
              {`${activeTracks.length} tracks ativas`}
              {mutedTracksCount > 0 && ` • ${mutedTracksCount} mutadas`}
              {soloedTracksCount > 0 && ` • ${soloedTracksCount} em solo`}
            </CardDescription>
          </div>

          {/* Controles globais */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              disabled={isPlaying}
              className="h-8 px-3"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
            <Button
              variant={isPlaying ? 'destructive' : 'default'}
              size="sm"
              onClick={isPlaying ? onStop : onPlay}
              className="h-8 px-3"
            >
              {isPlaying ? (
                <>
                  <Square className="w-3 h-3 mr-1" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 mr-1" />
                  Play
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Indicador de progresso global */}
        {isPlaying && multiTrackState.totalDuration > 0 && (
          <div className="mb-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progresso</span>
              <span>
                {Math.round(multiTrackState.currentTime)} /{' '}
                {Math.round(multiTrackState.totalDuration)} beats
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-100 ease-linear"
                style={{
                  width: `${Math.min(100, (multiTrackState.currentTime / multiTrackState.totalDuration) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        <Separator className="my-4" />

        {/* Lista de tracks */}
        <div className="space-y-3">
          {activeTracks.map((track) => (
            <TrackControl
              key={track.id}
              track={track}
              onMute={onTrackMute}
              onUnmute={onTrackUnmute}
              onSolo={onTrackSolo}
              onUnsolo={onTrackUnsolo}
              onVolumeChange={onTrackVolumeChange}
            />
          ))}
        </div>

        {/* Informações adicionais de Patterns */}
        {multiTrackState.patterns.size > 0 && (
          <>
            <Separator className="my-4" />
            <div className="text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Patterns disponíveis:</span>
                <span>{multiTrackState.patterns.size}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {Array.from(multiTrackState.patterns.keys()).map(
                  (patternName) => (
                    <code
                      key={patternName}
                      className="bg-muted px-1 rounded text-xs"
                    >
                      {patternName}
                    </code>
                  ),
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}