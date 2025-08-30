/**
 * Scheduler Global para Sequencer Multitrack.
 * Gerencia a sincronização de múltiplas tracks em paralelo.
 */

import type {
    TrackEvent,
    SchedulerEvent,
    MultiTrackState,
    TrackState,
  } from '@/types/multitrack'
  import type { SythmAudioEngine } from './audio-engine'
  
  export class MultiTrackScheduler {
    private audioContext: AudioContext | null = null
    private engine: SythmAudioEngine
    private state: MultiTrackState
    private schedulerIntervalId: number | null = null
    private scheduledNodes: Set<AudioNode> = new Set()
    private isRunning: boolean = false
  
    // Configurações do scheduler
    private readonly SCHEDULE_AHEAD_TIME = 0.1 // 100ms de antecipação
    private readonly SCHEDULER_INTERVAL = 25 // 25ms = 40fps
  
    constructor(engine: SythmAudioEngine) {
      this.engine = engine
      this.state = {
        tracks: new Map(),
        patterns: new Map(),
        currentTime: 0,
        totalDuration: 0,
        globalTempo: 120,
        isPlaying: false,
        scheduledEvents: [],
      }
    }
  
    // Callbacks para integração com UI
    public onEventPlayed?: (trackId: string, event: TrackEvent) => void
    public onComplete?: () => void
    public onError?: (error: Error, trackId: string, event: TrackEvent) => void
  
    /**
     * Inicializa o scheduler com o AudioContext.
     */
    async initialize(audioContext: AudioContext): Promise<void> {
      this.audioContext = audioContext
      await this.engine.initialize()
    }
  
    /**
     * Adiciona uma track ao scheduler.
     */
    addTrack(track: TrackState): void {
      this.state.tracks.set(track.id, { ...track })
      this.calculateTotalDuration()
    }
  
    /**
     * Remove uma track do scheduler.
     */
    removeTrack(trackId: string): void {
      this.state.tracks.delete(trackId)
      this.calculateTotalDuration()
    }
  
    /**
     * Atualiza as propriedades de uma track existente.
     */
    updateTrack(trackId: string, updates: Partial<TrackState>): void {
      const track = this.state.tracks.get(trackId)
      if (track) {
        this.state.tracks.set(trackId, { ...track, ...updates })
        this.calculateTotalDuration()
      }
    }
  
    /**
     * Inicia a reprodução de todas as tracks.
     */
    start(): void {
      if (this.isRunning || !this.audioContext) return
  
      this.isRunning = true
      this.state.isPlaying = true
      this.state.currentTime = 0
  
      // Pré-agenda todos os eventos
      this.scheduleAllEvents()
  
      // Inicia o loop do scheduler
      this.schedulerIntervalId = window.setInterval(() => {
        this.schedulerLoop()
      }, this.SCHEDULER_INTERVAL)
    }
  
    /**
     * Para completamente a reprodução e reseta o estado.
     */
    stop(): void {
      this.isRunning = false
      this.state.isPlaying = false
  
      if (this.schedulerIntervalId) {
        clearInterval(this.schedulerIntervalId)
        this.schedulerIntervalId = null
      }
  
      // Para todos os nós de áudio agendados para evitar sons residuais
      this.scheduledNodes.forEach((node) => {
        try {
          if ('stop' in node && typeof node.stop === 'function') {
            ;(node as OscillatorNode).stop()
          }
        } catch (error) {
          // Ignora erros de nós que já pararam ou foram desconectados
        }
      })
  
      this.scheduledNodes.clear()
      this.state.scheduledEvents = []
      this.state.currentTime = 0
    }
  
    /**
     * Pausa a reprodução no estado atual.
     */
    pause(): void {
      this.isRunning = false
      this.state.isPlaying = false
  
      if (this.schedulerIntervalId) {
        clearInterval(this.schedulerIntervalId)
        this.schedulerIntervalId = null
      }
    }
  
    /**
     * Resume a reprodução de onde parou.
     */
    resume(): void {
      if (!this.audioContext || this.isRunning) return
  
      this.isRunning = true
      this.state.isPlaying = true
  
      this.schedulerIntervalId = window.setInterval(() => {
        this.schedulerLoop()
      }, this.SCHEDULER_INTERVAL)
    }
  
    /**
     * Loop principal do scheduler, executado em intervalos regulares.
     */
    private schedulerLoop(): void {
      if (!this.audioContext || !this.isRunning) return
  
      const currentAudioTime = this.audioContext.currentTime
      const lookAheadTime = currentAudioTime + this.SCHEDULE_AHEAD_TIME
  
      // Atualiza o tempo de reprodução (em beats) para a UI
      this.updateCurrentTime(currentAudioTime)
  
      // Agenda eventos que estão dentro da janela de antecipação
      this.state.scheduledEvents.forEach((scheduledEvent) => {
        if (
          !scheduledEvent.scheduled &&
          scheduledEvent.absoluteTime <= lookAheadTime
        ) {
          this.scheduleEvent(scheduledEvent)
          scheduledEvent.scheduled = true
        }
      })
  
      // Verifica se a reprodução chegou ao fim
      if (this.state.currentTime >= this.state.totalDuration) {
        this.stop()
        this.onComplete?.()
      }
    }
  
    /**
     * Prepara todos os eventos das tracks ativas para serem agendados.
     */
    private scheduleAllEvents(): void {
      if (!this.audioContext) return
  
      const baseTime = this.audioContext.currentTime
      const secondsPerBeat = 60 / this.state.globalTempo
      this.state.scheduledEvents = []
  
      const hasSoloTracks = Array.from(this.state.tracks.values()).some(
        (t) => t.isSoloed,
      )
  
      this.state.tracks.forEach((track, trackId) => {
        if (!track.isActive || track.isMuted) return
        if (hasSoloTracks && !track.isSoloed) return // Respeita a lógica de "solo"
  
        track.events.forEach((event) => {
          const absoluteTime = baseTime + event.timeOffset * secondsPerBeat
  
          this.state.scheduledEvents.push({
            trackId,
            event,
            absoluteTime,
            scheduled: false,
          })
        })
      })
  
      // Ordena os eventos por tempo para processamento eficiente
      this.state.scheduledEvents.sort((a, b) => a.absoluteTime - b.absoluteTime)
    }
  
    /**
     * Agenda um evento específico para ser tocado pelo AudioEngine.
     */
    private scheduleEvent(scheduledEvent: SchedulerEvent): void {
      if (!this.audioContext) return
  
      const { trackId, event, absoluteTime } = scheduledEvent
      const track = this.state.tracks.get(trackId)
      if (!track) return
  
      const originalVolume = this.engine.getState().config.masterVolume
      try {
        // Define o instrumento e o volume específicos da track
        this.engine.setCurrentInstrument(track.instrument)
        this.engine.updateConfig({
          masterVolume: originalVolume * track.volume,
        })
  
        const delay = absoluteTime - this.audioContext.currentTime
  
        switch (event.type) {
          case 'note':
            if (event.data.note) {
              this.engine.playNote(event.data.note, event.duration, delay)
            }
            break
          case 'chord':
            if (event.data.notes && event.data.notes.length > 0) {
              this.engine.playChord(event.data.notes, event.duration, delay)
            }
            break
          case 'rest':
            // Pausas não produzem som, então não agendam nada no AudioEngine.
            break
          case 'instrument_change':
            if (event.data.instrument) {
              track.instrument = event.data.instrument
            }
            break
        }
  
        this.onEventPlayed?.(trackId, event)
      } catch (error) {
        console.error(`Error scheduling event for track ${trackId}:`, error)
        this.onError?.(error as Error, trackId, event)
      } finally {
        // Restaura o volume original para não afetar outras tracks
        this.engine.updateConfig({ masterVolume: originalVolume })
      }
    }
  
    /**
     * Atualiza o tempo atual (em beats) baseado no progresso do AudioContext.
     */
    private updateCurrentTime(audioTime: number): void {
      const startTime = this.getStartTime()
      if (startTime > 0) {
        const elapsedSeconds = audioTime - startTime
        const secondsPerBeat = 60 / this.state.globalTempo
        this.state.currentTime = elapsedSeconds / secondsPerBeat
      }
    }
  
    /**
     * Calcula a duração total da música baseada no evento que termina mais tarde.
     */
    private calculateTotalDuration(): void {
      let maxDuration = 0
      this.state.tracks.forEach((track) => {
        track.events.forEach((event) => {
          const eventEndTime = event.timeOffset + event.duration
          maxDuration = Math.max(maxDuration, eventEndTime)
        })
      })
      this.state.totalDuration = maxDuration
    }
  
    /**
     * Obtém o tempo de início absoluto da primeira nota agendada.
     */
    private getStartTime(): number {
      if (this.state.scheduledEvents.length === 0) {
        return this.audioContext?.currentTime || 0
      }
      return Math.min(...this.state.scheduledEvents.map((e) => e.absoluteTime))
    }
  
    /**
     * Retorna uma cópia segura do estado atual do scheduler.
     */
    getState(): MultiTrackState {
      return {
        tracks: new Map(this.state.tracks),
        patterns: new Map(this.state.patterns),
        currentTime: this.state.currentTime,
        totalDuration: this.state.totalDuration,
        globalTempo: this.state.globalTempo,
        isPlaying: this.state.isPlaying,
        scheduledEvents: [...this.state.scheduledEvents],
      }
    }
  
    /**
     * Atualiza o tempo global (BPM) e a configuração do engine.
     */
    setGlobalTempo(bpm: number): void {
      this.state.globalTempo = bpm
      this.engine.updateConfig({ baseBeatsPerMinute: bpm })
    }
  }