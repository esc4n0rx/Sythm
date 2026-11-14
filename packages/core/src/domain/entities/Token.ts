export enum TokenType {
  // Divisions & Sections
  HEADER = 'HEADER',
  IDENTIFICATION = 'IDENTIFICATION',
  CONFIG = 'CONFIG',
  ENVIRONMENT = 'ENVIRONMENT',
  PLAY = 'PLAY',
  PROCEDURE = 'PROCEDURE',
  PROCEDURES = 'PROCEDURES',
  PATTERNS = 'PATTERNS',
  TRACK = 'TRACK',
  END_TRACK = 'END_TRACK',
  DIVISION = 'DIVISION',
  SECTION = 'SECTION',
  END_SECTION = 'END_SECTION',
  PERFORM = 'PERFORM',

  // Metadata
  PROGRAM_ID = 'PROGRAM_ID',
  TITLE = 'TITLE',
  AUTHOR = 'AUTHOR',

  // Commands & Connectors
  TEMPO = 'TEMPO',
  BPM = 'BPM',
  WAVE = 'WAVE',
  INSTRUMENT = 'INSTRUMENT',
  VOLUME = 'VOLUME',
  IS = 'IS',
  TO = 'TO',
  SET = 'SET',
  NOTE = 'NOTE',
  NOTES = 'NOTES',
  CHORD = 'CHORD',
  DRUM = 'DRUM',
  DRUMS = 'DRUMS',
  SAMPLE = 'SAMPLE',
  SPEED = 'SPEED',
  OFFSET = 'OFFSET',
  FOR = 'FOR',
  BEAT = 'BEAT',
  BEATS = 'BEATS',
  REST = 'REST',
  REPEAT = 'REPEAT',
  TIMES = 'TIMES',
  END_REPEAT = 'END_REPEAT',
  PRINT = 'PRINT',
  DISPLAY = 'DISPLAY',

  // Waveforms
  SINE = 'SINE',
  SQUARE = 'SQUARE',
  SAW = 'SAW',
  SAWTOOTH = 'SAWTOOTH',
  TRIANGLE = 'TRIANGLE',

  // Effects & Timbre (Task 4)
  FILTER = 'FILTER',
  LOWPASS = 'LOWPASS',
  HIGHPASS = 'HIGHPASS',
  BANDPASS = 'BANDPASS',
  HZ = 'HZ',
  AT = 'AT',
  Q = 'Q',
  OFF = 'OFF',
  ON = 'ON',
  DELAY = 'DELAY',
  FEEDBACK = 'FEEDBACK',
  TIME = 'TIME',
  SEC = 'SEC',
  PERCENT = 'PERCENT',
  REVERB = 'REVERB',
  ENVELOPE = 'ENVELOPE',
  ATTACK = 'ATTACK',
  DECAY = 'DECAY',
  SUSTAIN = 'SUSTAIN',
  RELEASE = 'RELEASE',
  DETUNE = 'DETUNE',
  CENTS = 'CENTS',

  // Controls / Interactive Sliders (Task 5)
  CONTROL = 'CONTROL',
  SLIDER = 'SLIDER',
  DEFINE = 'DEFINE',
  FROM = 'FROM',
  DEFAULT = 'DEFAULT',
  STEP = 'STEP',

  // Visualizer (Task 6)
  VISUALIZER = 'VISUALIZER',
  SCOPE = 'SCOPE',
  SPECTRUM = 'SPECTRUM',
  PIANOROLL = 'PIANOROLL',
  ALL = 'ALL',

  // Harmony, Chords, Arpeggiator & Scales (Task 7)
  CHORDS = 'CHORDS',
  ARPEGGIATE = 'ARPEGGIATE',
  ARP = 'ARP',
  UP = 'UP',
  DOWN = 'DOWN',
  UP_DOWN = 'UP_DOWN',
  TRANSPOSE = 'TRANSPOSE',
  SEMITONE = 'SEMITONE',
  SEMITONES = 'SEMITONES',
  SCALE = 'SCALE',
  MAJOR = 'MAJOR',
  MINOR = 'MINOR',
  DORIAN = 'DORIAN',
  PHRYGIAN = 'PHRYGIAN',
  PENTATONIC = 'PENTATONIC',

  // Euclidean Rhythms, Stereo Panning & Filter Modulation (Task 8)
  EUCLIDEAN = 'EUCLIDEAN',
  IN = 'IN',
  PAN = 'PAN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  CENTER = 'CENTER',
  LFO = 'LFO',
  RATE = 'RATE',
  DEPTH = 'DEPTH',
  SWEEP = 'SWEEP',
  OVER = 'OVER',

  // Extended Synthesized Waveforms (Task 9)
  FM_KEYS = 'FM_KEYS',
  ACID_BASS = 'ACID_BASS',
  PLUCK = 'PLUCK',
  SUB_808 = 'SUB_808',
  PAD_WARM = 'PAD_WARM',

  // Literals & Punctuation
  NOTE_LITERAL = 'NOTE_LITERAL',
  DRUM_LITERAL = 'DRUM_LITERAL',
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  IDENTIFIER = 'IDENTIFIER',
  DOT = 'DOT',
  COMMA = 'COMMA',
  EOF = 'EOF',
}

export interface Token {
  readonly type: TokenType;
  readonly lexeme: string;
  readonly literal?: string | number;
  readonly line: number;
  readonly column: number;
}
