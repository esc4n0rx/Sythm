export type WaveformType =
  | 'sine'
  | 'square'
  | 'sawtooth'
  | 'triangle'
  | 'fm-keys'
  | 'acid-bass'
  | 'pluck'
  | 'sub-808'
  | 'pad-warm';

export type DrumType =
  | 'kick'
  | 'snare'
  | 'hihat'
  | 'open-hihat'
  | 'clap'
  | 'tom'
  | 'rim'
  | 'cowbell'
  | 'crash'
  | 'perc';

export type DivisionKind = 'HEADER' | 'CONFIG' | 'PLAY';

export type FilterMode = 'off' | 'lowpass' | 'highpass' | 'bandpass';

export type VisualizerMode = 'scope' | 'spectrum' | 'pianoroll' | 'all' | 'off';

export type ArpDirection = 'up' | 'down' | 'up-down';

export type ScaleMode = 'major' | 'minor' | 'dorian' | 'phrygian' | 'pentatonic';

export type AutomationParam = 'filter' | 'volume' | 'pan' | 'reverb' | 'delay' | 'tempo';

export interface FilterSettings {
  readonly mode: FilterMode;
  readonly frequencyHz: number;
  readonly q: number;
}

export interface DelaySettings {
  readonly mix: number;
  readonly timeSec: number;
  readonly feedback: number;
}

export interface EnvelopeSettings {
  readonly attackSec: number;
  readonly decaySec: number;
  readonly sustainLevel: number;
  readonly releaseSec: number;
}

export interface LfoSettings {
  readonly rateHz: number;
  readonly depthHz: number;
}

export interface SweepSettings {
  readonly startHz: number;
  readonly endHz: number;
  readonly durationBeats?: number;
}

export interface AudioEffectsConfig {
  readonly filter: FilterSettings;
  readonly delay: DelaySettings;
  readonly reverbMix: number;
  readonly envelope: EnvelopeSettings;
  readonly detuneCents: number;
  readonly pan: number;
  readonly lfo?: LfoSettings;
  readonly sweep?: SweepSettings;
}

export interface NumericLiteralValue {
  readonly kind: 'literal';
  readonly value: number;
}

export interface ControlReferenceValue {
  readonly kind: 'controlRef';
  readonly controlName: string;
}

export interface InlineSliderValue {
  readonly kind: 'inlineSlider';
  readonly defaultValue: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly line: number;
}

export type NumericParamValue =
  | NumericLiteralValue
  | ControlReferenceValue
  | InlineSliderValue;

export interface ControlStatementNode {
  readonly kind: 'ControlStatement';
  readonly name: string;
  readonly defaultValue: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly line: number;
  readonly column: number;
}

export interface MetadataStatementNode {
  readonly kind: 'MetadataStatement';
  readonly key: string;
  readonly value: string;
  readonly line: number;
  readonly column: number;
}

export interface TempoStatementNode {
  readonly kind: 'TempoStatement';
  readonly bpm: number;
  readonly bpmControl?: NumericParamValue;
  readonly line: number;
  readonly column: number;
}

export interface WaveStatementNode {
  readonly kind: 'WaveStatement';
  readonly waveform: WaveformType;
  readonly line: number;
  readonly column: number;
}

export interface VolumeStatementNode {
  readonly kind: 'VolumeStatement';
  readonly volume: number;
  readonly volumeControl?: NumericParamValue;
  readonly line: number;
  readonly column: number;
}

export interface PlayNoteStatementNode {
  readonly kind: 'PlayNoteStatement';
  readonly note: string;
  readonly beats: number;
  readonly line: number;
  readonly column: number;
}

export interface PlayNotesStatementNode {
  readonly kind: 'PlayNotesStatement';
  readonly notes: string[];
  readonly beatsPerNote: number;
  readonly line: number;
  readonly column: number;
}

export interface PlayChordStatementNode {
  readonly kind: 'PlayChordStatement';
  readonly notes: string[];
  readonly symbol?: string;
  readonly beats: number;
  readonly line: number;
  readonly column: number;
}

export interface RestStatementNode {
  readonly kind: 'RestStatement';
  readonly beats: number;
  readonly line: number;
  readonly column: number;
}

export interface RepeatStatementNode {
  readonly kind: 'RepeatStatement';
  readonly times: number;
  readonly body: StatementNode[];
  readonly line: number;
  readonly column: number;
}

export interface PrintStatementNode {
  readonly kind: 'PrintStatement';
  readonly message: string;
  readonly line: number;
  readonly column: number;
}

export interface PlayDrumStatementNode {
  readonly kind: 'PlayDrumStatement';
  readonly drum: DrumType;
  readonly beats: number;
  readonly line: number;
  readonly column: number;
}

export interface PlayDrumsStatementNode {
  readonly kind: 'PlayDrumsStatement';
  readonly drums: DrumType[];
  readonly beatsPerHit: number;
  readonly line: number;
  readonly column: number;
}

export interface PlaySampleStatementNode {
  readonly kind: 'PlaySampleStatement';
  readonly sampleName: string;
  readonly beats: number;
  readonly rate: number;
  readonly offsetSec: number;
  readonly line: number;
  readonly column: number;
}

export interface TrackStatementNode {
  readonly kind: 'TrackStatement';
  readonly name: string;
  readonly statements: StatementNode[];
  readonly line: number;
  readonly column: number;
}

export interface SectionStatementNode {
  readonly kind: 'SectionStatement';
  readonly name: string;
  readonly statements: StatementNode[];
  readonly line: number;
  readonly column: number;
}

export interface PerformStatementNode {
  readonly kind: 'PerformStatement';
  readonly sectionName: string;
  readonly times: number;
  readonly line: number;
  readonly column: number;
}

export interface FilterStatementNode {
  readonly kind: 'FilterStatement';
  readonly mode: FilterMode;
  readonly frequencyHz: number;
  readonly q: number;
  readonly frequencyControl?: NumericParamValue;
  readonly qControl?: NumericParamValue;
  readonly line: number;
  readonly column: number;
}

export interface DelayStatementNode {
  readonly kind: 'DelayStatement';
  readonly mix: number;
  readonly timeSec?: number;
  readonly feedback?: number;
  readonly mixControl?: NumericParamValue;
  readonly timeControl?: NumericParamValue;
  readonly feedbackControl?: NumericParamValue;
  readonly line: number;
  readonly column: number;
}

export interface ReverbStatementNode {
  readonly kind: 'ReverbStatement';
  readonly mix: number;
  readonly mixControl?: NumericParamValue;
  readonly line: number;
  readonly column: number;
}

export interface EnvelopeStatementNode {
  readonly kind: 'EnvelopeStatement';
  readonly attackSec?: number;
  readonly decaySec?: number;
  readonly sustainLevel?: number;
  readonly releaseSec?: number;
  readonly line: number;
  readonly column: number;
}

export interface DetuneStatementNode {
  readonly kind: 'DetuneStatement';
  readonly cents: number;
  readonly centsControl?: NumericParamValue;
  readonly line: number;
  readonly column: number;
}

export interface VisualizerStatementNode {
  readonly kind: 'VisualizerStatement';
  readonly mode: VisualizerMode;
  readonly line: number;
  readonly column: number;
}

export interface PlayChordEntry {
  readonly symbol?: string;
  readonly notes: string[];
}

export interface PlayChordsStatementNode {
  readonly kind: 'PlayChordsStatement';
  readonly chords: PlayChordEntry[];
  readonly beatsPerChord: number;
  readonly line: number;
  readonly column: number;
}

export interface ArpeggiateStatementNode {
  readonly kind: 'ArpeggiateStatement';
  readonly notes: string[];
  readonly symbol?: string;
  readonly direction: ArpDirection;
  readonly beatsPerStep: number;
  readonly line: number;
  readonly column: number;
}

export interface TransposeStatementNode {
  readonly kind: 'TransposeStatement';
  readonly semitones: number;
  readonly line: number;
  readonly column: number;
}

export interface ScaleStatementNode {
  readonly kind: 'ScaleStatement';
  readonly root: string;
  readonly mode: ScaleMode;
  readonly notes: string[];
  readonly line: number;
  readonly column: number;
}

export interface PlayEuclideanStatementNode {
  readonly kind: 'PlayEuclideanStatement';
  readonly targetKind: 'drum' | 'note';
  readonly drum?: DrumType;
  readonly note?: string;
  readonly pulses: number;
  readonly steps: number;
  readonly beatsPerStep: number;
  readonly line: number;
  readonly column: number;
}

export interface PanStatementNode {
  readonly kind: 'PanStatement';
  readonly pan: number;
  readonly panControl?: NumericParamValue;
  readonly line: number;
  readonly column: number;
}

export interface LfoStatementNode {
  readonly kind: 'LfoStatement';
  readonly mode: 'on' | 'off';
  readonly rateHz: number;
  readonly depthHz: number;
  readonly line: number;
  readonly column: number;
}

export interface SweepStatementNode {
  readonly kind: 'SweepStatement';
  readonly mode: 'on' | 'off';
  readonly startHz: number;
  readonly endHz: number;
  readonly durationBeats?: number;
  readonly line: number;
  readonly column: number;
}

export interface MaybeStatementNode {
  readonly kind: 'MaybeStatement';
  readonly probabilityPercent: number;
  readonly statement: StatementNode;
  readonly line: number;
  readonly column: number;
}

export interface ChooseOneStatementNode {
  readonly kind: 'ChooseOneStatement';
  readonly targetKind: 'note' | 'drum';
  readonly notes?: string[];
  readonly drums?: DrumType[];
  readonly beats: number;
  readonly line: number;
  readonly column: number;
}

export interface HumanizeStatementNode {
  readonly kind: 'HumanizeStatement';
  readonly mode: 'on' | 'off';
  readonly timingMs: number;
  readonly velocityPercent: number;
  readonly line: number;
  readonly column: number;
}

export interface RampStatementNode {
  readonly kind: 'RampStatement';
  readonly param: AutomationParam;
  readonly startValue: number;
  readonly endValue: number;
  readonly durationBeats: number;
  readonly line: number;
  readonly column: number;
}

export interface PatternStatementNode {
  readonly kind: 'PatternStatement';
  readonly targetKind: 'drum' | 'note';
  readonly drum?: DrumType;
  readonly note?: string;
  readonly pattern: string;
  readonly stepBeats: number;
  readonly totalBeats?: number;
  readonly line: number;
  readonly column: number;
}

export interface SwingStatementNode {
  readonly kind: 'SwingStatement';
  readonly percent: number;
  readonly line: number;
  readonly column: number;
}

export type StatementNode =
  | ControlStatementNode
  | MetadataStatementNode
  | TempoStatementNode
  | WaveStatementNode
  | VolumeStatementNode
  | VisualizerStatementNode
  | PlayNoteStatementNode
  | PlayNotesStatementNode
  | PlayChordStatementNode
  | PlayChordsStatementNode
  | ArpeggiateStatementNode
  | TransposeStatementNode
  | ScaleStatementNode
  | PlayEuclideanStatementNode
  | PlayDrumStatementNode
  | PlayDrumsStatementNode
  | PlaySampleStatementNode
  | RestStatementNode
  | RepeatStatementNode
  | TrackStatementNode
  | SectionStatementNode
  | PerformStatementNode
  | FilterStatementNode
  | DelayStatementNode
  | ReverbStatementNode
  | EnvelopeStatementNode
  | DetuneStatementNode
  | PanStatementNode
  | LfoStatementNode
  | SweepStatementNode
  | MaybeStatementNode
  | ChooseOneStatementNode
  | HumanizeStatementNode
  | RampStatementNode
  | PatternStatementNode
  | SwingStatementNode
  | PrintStatementNode;

export interface DivisionNode {
  readonly kind: 'Division';
  readonly divisionType: DivisionKind;
  readonly name: string;
  readonly statements: StatementNode[];
  readonly line: number;
  readonly column: number;
}

export interface ProgramNode {
  readonly kind: 'Program';
  readonly divisions: DivisionNode[];
  readonly statements: StatementNode[];
}
