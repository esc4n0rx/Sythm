export type InstrumentType = 
  | 'bass'
  | 'kick'
  | 'snare' 
  | 'hihat'
  | 'lead'
  | 'pad'
  | 'default';

export interface InstrumentConfig {
  type: InstrumentType;
  volume: number;
  // Parâmetros específicos por instrumento
  [key: string]: any;
}

export interface EnvelopeParams {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface FilterParams {
  type: BiquadFilterType;
  frequency: number;
  Q: number;
}

export interface OscillatorParams {
  type: OscillatorType;
  detune?: number;
}