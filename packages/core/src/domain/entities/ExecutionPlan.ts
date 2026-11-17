import type {
  AudioEffectsConfig,
  AutomationParam,
  DrumType,
  ProgramNode,
  VisualizerMode,
  WaveformType,
} from './Ast.js';
import type { Token } from './Token.js';

export interface EventAutomationRamp {
  readonly param: Exclude<AutomationParam, 'tempo'>;
  readonly fromValue: number;
  readonly toValue: number;
  readonly durationSec: number;
}

export interface HumanizeConfig {
  readonly timingMs: number;
  readonly velocityPercent: number;
}

export type ControlTargetParam =
  | 'volume'
  | 'tempo'
  | 'filterFrequencyHz'
  | 'filterQ'
  | 'delayMix'
  | 'delayTimeSec'
  | 'delayFeedback'
  | 'reverbMix'
  | 'detuneCents'
  | 'pan';

export interface ControlBinding {
  readonly trackName: string;
  readonly param: ControlTargetParam;
  readonly line: number;
}

export interface ControlDescriptor {
  readonly name: string;
  readonly label: string;
  readonly kind: 'declared' | 'inline';
  readonly defaultValue: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: string;
  readonly declarationLine: number;
  /** Arquivo incluído por `COPY` que declara este controle (`declarationLine` aponta para o COPY). */
  readonly sourceFile?: string;
  readonly usageLines: number[];
  readonly bindings: ControlBinding[];
}

export interface ScheduledAudioEvent {
  readonly id: string;
  readonly trackName: string;
  readonly type: 'note' | 'chord' | 'drum' | 'sample' | 'rest';
  readonly notes: string[];
  readonly frequencies: number[];
  readonly drum?: DrumType;
  readonly sampleName?: string;
  readonly sampleRate?: number;
  readonly sampleOffsetSec?: number;
  readonly startBeat: number;
  readonly durationBeats: number;
  readonly startTimeSec: number;
  readonly durationSec: number;
  readonly bpm: number;
  readonly waveform: WaveformType;
  readonly volume: number;
  readonly effects: AudioEffectsConfig;
  readonly controlRefs?: Partial<Record<ControlTargetParam, string>>;
  readonly probability?: number;
  readonly noteChoices?: string[];
  readonly frequencyChoices?: number[];
  readonly drumChoices?: DrumType[];
  readonly humanize?: HumanizeConfig;
  readonly ramps?: EventAutomationRamp[];
  readonly line: number;
}

export interface TrackSummary {
  readonly name: string;
  readonly eventCount: number;
  readonly totalBeats: number;
  readonly totalDurationSec: number;
  readonly waveform: WaveformType;
  readonly volume: number;
  readonly hasDrums: boolean;
  readonly effects: AudioEffectsConfig;
}

export interface ConsoleLogEntry {
  readonly timestampOffsetSec: number;
  readonly beat: number;
  readonly level: 'info' | 'print' | 'warn' | 'error';
  readonly message: string;
  readonly line?: number;
}

export interface CompilationDiagnostic {
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly line: number;
  readonly column: number;
  readonly lexeme?: string;
}

export interface ProgramMetadata {
  readonly programId?: string;
  readonly title?: string;
  readonly author?: string;
}

export interface ExecutionPlan {
  readonly metadata: ProgramMetadata;
  readonly initialBpm: number;
  readonly initialWaveform: WaveformType;
  readonly visualizerMode: VisualizerMode;
  readonly scale?: string;
  readonly totalBeats: number;
  readonly totalDurationSec: number;
  readonly definedSections: string[];
  readonly controls: ControlDescriptor[];
  readonly tracks: TrackSummary[];
  readonly events: ScheduledAudioEvent[];
  readonly logs: ConsoleLogEntry[];
}

export interface CompilationResult {
  readonly success: boolean;
  readonly tokens: Token[];
  readonly ast: ProgramNode | null;
  readonly plan: ExecutionPlan | null;
  readonly diagnostics: CompilationDiagnostic[];
}
