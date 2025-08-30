/**
 * Interpretador para executar código Sythm compilado com suporte a multitrack.
 */
import {
  ASTNode,
  ProgramNode,
  NoteNode,
  RestNode,
  SlowNode,
  FastNode,
  CommentNode,
  ChordNode,
  LoopNode,
  GroupNode,
  InstrumentNode,
  TrackNode,
  PatternNode,
  PatternReferenceNode,
} from './ast'
import { SythmAudioEngine } from './audio-engine'
import { MultiTrackScheduler } from './multitrack-scheduler'
import { TrackManager } from './track-manager'
import type { InstrumentType } from '@/types/instruments'
import type {
  PatternDefinition,
  MultiTrackState,
} from '@/types/multitrack'

export interface InterpreterOptions {
  onNotePlay?: (note: string, duration: number) => void
  onChordPlay?: (notes: string[], duration: number) => void
  onRest?: (duration: number) => void
  onSpeedChange?: (modifier: number) => void
  onInstrumentChange?: (instrument: InstrumentType) => void
  onTrackEvent?: (trackId: string, event: any) => void
  onError?: (error: Error, node: ASTNode) => void
  onComplete?: () => void
}

export class SythmInterpreter {
  private engine: SythmAudioEngine
  private scheduler: MultiTrackScheduler
  private trackManager: TrackManager
  private options: InterpreterOptions

  // Estado para execução sequencial (modo legado)
  private currentTime: number = 0
  private isRunning: boolean = false
  private totalDuration: number = 0

  // Estado para multitrack
  private patterns: Map<string, PatternDefinition> = new Map()
  private isMultiTrackMode: boolean = false

  constructor(engine: SythmAudioEngine, options: InterpreterOptions = {}) {
    this.engine = engine
    this.options = options
    this.scheduler = new MultiTrackScheduler(engine)
    this.trackManager = new TrackManager(this.patterns)

    // Configura callbacks do scheduler
    this.scheduler.onEventPlayed = (trackId, event) => {
      this.options.onTrackEvent?.(trackId, event)

      // Callbacks legados para compatibilidade
      if (event.type === 'note' && event.data.note) {
        this.options.onNotePlay?.(event.data.note, event.duration)
      } else if (event.type === 'chord' && event.data.notes) {
        this.options.onChordPlay?.(event.data.notes, event.duration)
      } else if (event.type === 'rest') {
        this.options.onRest?.(event.duration)
      } else if (
        event.type === 'instrument_change' &&
        event.data.instrument
      ) {
        this.options.onInstrumentChange?.(event.data.instrument)
      }
    }

    this.scheduler.onComplete = () => {
      this.isRunning = false
      this.options.onComplete?.()
    }
  }

  /**
   * Executa um programa Sythm.
   */
  async execute(program: ProgramNode): Promise<void> {
    if (this.isRunning) {
      throw new Error('Interpreter is already running')
    }

    this.isRunning = true
    this.currentTime = 0
    this.totalDuration = 0
    this.patterns.clear()

    // Reseta velocidade e instrumento para normal no início
    this.engine.setNormalSpeed()
    this.engine.setCurrentInstrument('default')

    try {
      await this.engine.initialize()

      // Primeira passada: identifica modo de execução e coleta patterns
      this.isMultiTrackMode = this.detectMultiTrackMode(program)
      this.collectPatterns(program)

      if (this.isMultiTrackMode) {
        await this.executeMultiTrack(program)
      } else {
        await this.executeSequential(program)
      }
    } catch (error) {
      this.isRunning = false
      throw error
    }
  }

  /**
   * Para a execução.
   */
  stop(): void {
    this.isRunning = false
    if (this.isMultiTrackMode) {
      this.scheduler.stop()
    } else {
      this.engine.stop()
    }
    this.currentTime = 0
    this.totalDuration = 0
  }

  /**
   * Detecta se o programa usa tracks (modo multitrack).
   */
  private detectMultiTrackMode(program: ProgramNode): boolean {
    return program.body.some((node) => node.type === 'Track')
  }

  /**
   * Coleta todas as definições de patterns.
   */
  private collectPatterns(program: ProgramNode): void {
    program.body.forEach((node) => {
      if (node.type === 'Pattern') {
        const patternNode = node as PatternNode
        const pattern: PatternDefinition = {
          id: patternNode.name,
          name: patternNode.name,
          body: patternNode.body,
          duration: this.calculatePatternDuration(patternNode.body),
        }
        this.patterns.set(pattern.name, pattern)
      }
    })
    // Atualiza patterns no track manager
    this.trackManager.updatePatterns(this.patterns)
  }

  /**
   * Calcula a duração de um pattern ou corpo de um nó.
   */
  private calculatePatternDuration(body: ASTNode[]): number {
    let duration = 0
    for (const node of body) {
      switch (node.type) {
        case 'Note':
        case 'Chord':
        case 'Rest':
          duration += (node as NoteNode | ChordNode | RestNode).duration || 1
          break
        case 'Loop': {
          const loopNode = node as LoopNode
          const loopBodyDuration = this.calculatePatternDuration(loopNode.body)
          duration += loopBodyDuration * loopNode.iterations
          break
        }
        case 'Group': {
          const groupNode = node as GroupNode
          const groupBodyDuration = this.calculatePatternDuration(groupNode.body)
          duration += groupBodyDuration * (groupNode.multiplier || 1)
          break
        }
      }
    }
    return duration
  }

  /**
   * Executa o programa em modo multitrack.
   */
  private async executeMultiTrack(program: ProgramNode): Promise<void> {
    await this.scheduler.initialize(this.engine.getState().context!)

    // Processa todas as tracks
    program.body.forEach((node) => {
      if (node.type === 'Track') {
        this.processTrack(node as TrackNode)
      }
    })

    // Inicia a reprodução
    this.scheduler.start()
  }

  /**
   * Processa uma track individual e a adiciona ao scheduler.
   */
  private processTrack(trackNode: TrackNode): void {
    try {
      // Identifica o instrumento padrão da track recursivamente
      const findInstrument = (nodes: ASTNode[]): InstrumentType => {
        for (const node of nodes) {
          if (node.type === 'Instrument') {
            return (node as InstrumentNode).instrument as InstrumentType
          } else if (node.type === 'Loop' || node.type === 'Group') {
            const found = findInstrument((node as LoopNode | GroupNode).body)
            if (found !== 'default') return found
          }
        }
        return 'default'
      }

      const defaultInstrument = findInstrument(trackNode.body)

      // Cria a track usando o track manager
      const track = this.trackManager.createTrack(
        trackNode.name,
        trackNode.name,
        trackNode.body,
        defaultInstrument,
      )

      // Adiciona a track ao scheduler
      this.scheduler.addTrack(track)
    } catch (error) {
      this.options.onError?.(error as Error, trackNode)
      console.error(`Error processing track ${trackNode.name}:`, error)
    }
  }

  /**
   * Executa o programa em modo sequencial (legado).
   */
  private async executeSequential(program: ProgramNode): Promise<void> {
    for (const node of program.body) {
      if (!this.isRunning) break // Parou durante a execução

      // Pula definições de patterns em modo sequencial
      if (node.type === 'Pattern') {
        continue
      }
      await this.executeNode(node)
    }

    // Aguarda um pouco mais para garantir que todas as notas terminaram
    const finalWaitTime = Math.max(this.totalDuration * 1000, 1000)
    setTimeout(() => {
      if (this.isRunning) {
        this.isRunning = false
        this.options.onComplete?.()
      }
    }, finalWaitTime)
  }

  /**
   * Pausa a execução por um tempo determinado.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Executa um nó individual do AST (modo sequencial).
   */
  private async executeNode(node: ASTNode): Promise<void> {
    try {
      switch (node.type) {
        case 'Note':
          await this.executeNote(node as NoteNode)
          break
        case 'Rest':
          await this.executeRest(node as RestNode)
          break
        case 'Slow':
          await this.executeSlow(node as SlowNode)
          break
        case 'Fast':
          await this.executeFast(node as FastNode)
          break
        case 'Comment':
          await this.sleep(100) // Pequena pausa para visualização
          break
        case 'Chord':
          await this.executeChord(node as ChordNode)
          break
        case 'Loop':
          await this.executeLoop(node as LoopNode)
          break
        case 'Group':
          await this.executeGroup(node as GroupNode)
          break
        case 'Instrument':
          await this.executeInstrument(node as InstrumentNode)
          break
        case 'PatternReference':
          await this.executePatternReference(node as PatternReferenceNode)
          break
        default:
          console.warn(`Unknown node type: ${node.type}`)
      }
    } catch (error) {
      this.options.onError?.(error as Error, node)
      throw error
    }
  }

  /**
   * Executa uma referência a um pattern (modo sequencial).
   */
  private async executePatternReference(
    node: PatternReferenceNode,
  ): Promise<void> {
    const pattern = this.patterns.get(node.name)
    if (!pattern) {
      throw new Error(`Pattern not found: ${node.name}`)
    }
    for (const patternNode of pattern.body) {
      if (!this.isRunning) break
      await this.executeNode(patternNode)
    }
  }

  /**
   * Executa a seleção de um instrumento.
   */
  private async executeInstrument(node: InstrumentNode): Promise<void> {
    const instrumentType = node.instrument as InstrumentType
    const availableInstruments = this.engine.getAvailableInstruments()
    const isValid = availableInstruments.some(
      (inst) => inst.type === instrumentType,
    )

    if (!isValid) {
      throw new Error(`Unknown instrument: ${instrumentType}`)
    }

    this.engine.setCurrentInstrument(instrumentType)
    this.options.onInstrumentChange?.(instrumentType)
    await this.sleep(200)
  }

  /**
   * Executa uma nota musical.
   */
  private async executeNote(node: NoteNode): Promise<void> {
    const duration = node.duration ?? 1
    const beatDuration = this.engine.getBeatDuration()
    const realDurationMs = beatDuration * duration * 1000

    this.engine.playNote(node.note, duration, this.currentTime)
    this.options.onNotePlay?.(node.note, duration)

    await this.sleep(realDurationMs)

    this.currentTime += beatDuration * duration
    this.totalDuration = Math.max(this.totalDuration, this.currentTime)
  }

  /**
   * Executa um acorde.
   */
  private async executeChord(node: ChordNode): Promise<void> {
    const duration = node.duration ?? 1
    const beatDuration = this.engine.getBeatDuration()
    const realDurationMs = beatDuration * duration * 1000

    this.engine.playChord(node.notes, duration, this.currentTime)
    this.options.onChordPlay?.(node.notes, duration)

    await this.sleep(realDurationMs)

    this.currentTime += beatDuration * duration
    this.totalDuration = Math.max(this.totalDuration, this.currentTime)
  }

  /**
   * Executa um loop.
   */
  private async executeLoop(node: LoopNode): Promise<void> {
    for (let i = 0; i < node.iterations; i++) {
      if (!this.isRunning) break
      for (const bodyNode of node.body) {
        if (!this.isRunning) break
        await this.executeNode(bodyNode)
      }
    }
  }

  /**
   * Executa um grupo.
   */
  private async executeGroup(node: GroupNode): Promise<void> {
    const iterations = node.multiplier ?? 1
    for (let i = 0; i < iterations; i++) {
      if (!this.isRunning) break
      for (const bodyNode of node.body) {
        if (!this.isRunning) break
        await this.executeNode(bodyNode)
      }
    }
  }

  /**
   * Executa uma pausa.
   */
  private async executeRest(node: RestNode): Promise<void> {
    const duration = node.duration ?? 1
    const beatDuration = this.engine.getBeatDuration()
    const realDurationMs = beatDuration * duration * 1000

    this.engine.playRest(duration)
    this.options.onRest?.(duration)

    await this.sleep(realDurationMs)
    this.currentTime += beatDuration * duration
  }

  /**
   * Executa o comando `slow`.
   */
  private async executeSlow(node: SlowNode): Promise<void> {
    this.engine.setSlow()
    this.options.onSpeedChange?.(0.5)
    await this.sleep(200)
  }

  /**
   * Executa o comando `fast`.
   */
  private async executeFast(node: FastNode): Promise<void> {
    this.engine.setFast()
    this.options.onSpeedChange?.(1.5)
    await this.sleep(200)
  }

  // --- Controles Multitrack ---

  muteTrack(trackId: string): void {
    if (this.isMultiTrackMode) {
      this.scheduler.updateTrack(trackId, { isMuted: true })
    }
  }

  unmuteTrack(trackId: string): void {
    if (this.isMultiTrackMode) {
      this.scheduler.updateTrack(trackId, { isMuted: false })
    }
  }

  soloTrack(trackId: string): void {
    if (this.isMultiTrackMode) {
      this.scheduler.updateTrack(trackId, { isSoloed: true })
    }
  }

  unsoloTrack(trackId: string): void {
    if (this.isMultiTrackMode) {
      this.scheduler.updateTrack(trackId, { isSoloed: false })
    }
  }

  setTrackVolume(trackId: string, volume: number): void {
    if (this.isMultiTrackMode) {
      this.scheduler.updateTrack(trackId, { volume })
    }
  }

  /**
   * Obtém o estado atual do interpretador.
   */
  getState() {
    if (this.isMultiTrackMode) {
      return {
        isRunning: this.isRunning,
        isMultiTrack: true,
        multiTrackState: this.scheduler.getState(),
        engineState: this.engine.getState(),
      }
    } else {
      return {
        isRunning: this.isRunning,
        isMultiTrack: false,
        currentTime: this.currentTime,
        totalDuration: this.totalDuration,
        engineState: this.engine.getState(),
      }
    }
  }
}