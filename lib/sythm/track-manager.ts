/**
 * Gerenciador de Tracks Individuais
 * Converte AST de uma track em eventos de áudio
 */

import type { ASTNode, NoteNode, ChordNode, RestNode, LoopNode, GroupNode, InstrumentNode } from './ast';
import type { TrackEvent, TrackState, PatternDefinition } from '@/types/multitrack';
import type { InstrumentType } from '@/types/instruments';

export class TrackManager {
  private currentTime: number = 0;
  private currentInstrument: InstrumentType = 'default';
  private patterns: Map<string, PatternDefinition>;

  constructor(patterns: Map<string, PatternDefinition> = new Map()) {
    this.patterns = patterns;
  }

  /**
   * Converte AST de uma track em eventos de áudio
   */
  convertTrackToEvents(
    trackId: string,
    body: ASTNode[],
    defaultInstrument: InstrumentType = 'default'
  ): TrackEvent[] {
    this.currentTime = 0;
    this.currentInstrument = defaultInstrument;
    
    const events: TrackEvent[] = [];
    
    for (const node of body) {
      const nodeEvents = this.convertNodeToEvents(node);
      events.push(...nodeEvents);
    }

    return events;
  }

  /**
   * Converte um nó AST individual em eventos
   */
  private convertNodeToEvents(node: ASTNode): TrackEvent[] {
    const events: TrackEvent[] = [];

    switch (node.type) {
      case 'Note':
        events.push(...this.convertNoteNode(node as NoteNode));
        break;

      case 'Chord':
        events.push(...this.convertChordNode(node as ChordNode));
        break;

      case 'Rest':
        events.push(...this.convertRestNode(node as RestNode));
        break;

      case 'Instrument':
        events.push(...this.convertInstrumentNode(node as InstrumentNode));
        break;

      case 'Loop':
        events.push(...this.convertLoopNode(node as LoopNode));
        break;

      case 'Group':
        events.push(...this.convertGroupNode(node as GroupNode));
        break;

      case 'Pattern':
        events.push(...this.convertPatternNode(node as any)); // PatternNode será criado
        break;

      // Comandos de velocidade não são eventos, mas afetariam o tempo global
      case 'Slow':
      case 'Fast':
        // Estes seriam tratados pelo interpretador global
        break;

      default:
        console.warn(`Unknown node type in track: ${node.type}`);
    }

    return events;
  }

  /**
   * Converte nota em evento
   */
  private convertNoteNode(node: NoteNode): TrackEvent[] {
    const duration = node.duration || 1;
    
    const event: TrackEvent = {
      type: 'note',
      timeOffset: this.currentTime,
      duration,
      data: { note: node.note }
    };

    this.currentTime += duration;
    return [event];
  }

  /**
   * Converte acorde em evento
   */
  private convertChordNode(node: ChordNode): TrackEvent[] {
    const duration = node.duration || 1;
    
    const event: TrackEvent = {
      type: 'chord',
      timeOffset: this.currentTime,
      duration,
      data: { notes: node.notes }
    };

    this.currentTime += duration;
    return [event];
  }

  /**
   * Converte pausa em evento
   */
  private convertRestNode(node: RestNode): TrackEvent[] {
    const duration = node.duration || 1;
    
    const event: TrackEvent = {
      type: 'rest',
      timeOffset: this.currentTime,
      duration,
      data: {}
    };

    this.currentTime += duration;
    return [event];
  }

  /**
   * Converte mudança de instrumento em evento
   */
  private convertInstrumentNode(node: InstrumentNode): TrackEvent[] {
    this.currentInstrument = node.instrument as InstrumentType;
    
    const event: TrackEvent = {
      type: 'instrument_change',
      timeOffset: this.currentTime,
      duration: 0, // Instantâneo
      data: { instrument: this.currentInstrument }
    };

    return [event];
  }

  /**
   * Converte loop em eventos
   */
  private convertLoopNode(node: LoopNode): TrackEvent[] {
    const events: TrackEvent[] = [];
    
    for (let i = 0; i < node.iterations; i++) {
      for (const bodyNode of node.body) {
        const nodeEvents = this.convertNodeToEvents(bodyNode);
        events.push(...nodeEvents);
      }
    }

    return events;
  }

  /**
   * Converte grupo em eventos
   */
  private convertGroupNode(node: GroupNode): TrackEvent[] {
    const events: TrackEvent[] = [];
    const multiplier = node.multiplier || 1;
    
    for (let i = 0; i < multiplier; i++) {
      const startTime = this.currentTime;
      
      for (const bodyNode of node.body) {
        const nodeEvents = this.convertNodeToEvents(bodyNode);
        events.push(...nodeEvents);
      }
    }

    return events;
  }

  /**
   * Converte pattern nomeado em eventos
   */
  private convertPatternNode(node: { type: 'Pattern', name: string }): TrackEvent[] {
    const pattern = this.patterns.get(node.name);
    if (!pattern) {
      console.warn(`Pattern not found: ${node.name}`);
      return [];
    }

    const events: TrackEvent[] = [];
    
    for (const bodyNode of pattern.body) {
      const nodeEvents = this.convertNodeToEvents(bodyNode);
      events.push(...nodeEvents);
    }

    return events;
  }

  /**
   * Cria uma nova track
   */
  createTrack(
    id: string,
    name: string,
    body: ASTNode[],
    instrument: InstrumentType = 'default',
    volume: number = 1.0
  ): TrackState {
    const events = this.convertTrackToEvents(id, body, instrument);
    
    return {
      id,
      name,
      events,
      instrument,
      volume,
      isMuted: false,
      isSoloed: false,
      isActive: true
    };
  }

  /**
   * Atualiza patterns disponíveis
   */
  updatePatterns(patterns: Map<string, PatternDefinition>): void {
    this.patterns = patterns;
  }
}