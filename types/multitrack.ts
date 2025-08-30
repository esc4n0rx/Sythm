import type { ASTNode } from '@/lib/sythm/ast';
import type { InstrumentType } from './instruments';

export interface TrackEvent {
  type: 'note' | 'chord' | 'rest' | 'instrument_change';
  timeOffset: number; // tempo absoluto em beats desde o início
  duration: number;
  data: {
    notes?: string[];
    note?: string;
    instrument?: InstrumentType;
  };
}

export interface TrackState {
  id: string;
  name: string;
  events: TrackEvent[];
  instrument: InstrumentType;
  volume: number;
  isMuted: boolean;
  isSoloed: boolean;
  isActive: boolean;
}

export interface PatternDefinition {
  id: string;
  name: string;
  body: ASTNode[];
  duration: number; // duração total em beats
}

export interface SchedulerEvent {
  trackId: string;
  event: TrackEvent;
  absoluteTime: number; // tempo no AudioContext
  scheduled: boolean;
}

export interface MultiTrackState {
  tracks: Map<string, TrackState>;
  patterns: Map<string, PatternDefinition>;
  currentTime: number;
  totalDuration: number;
  globalTempo: number;
  isPlaying: boolean;
  scheduledEvents: SchedulerEvent[];
}