const CHROMATIC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const SEMITONE_OFFSETS: Record<string, number> = {
  C: 0,
  'C#': 1,
  DB: 1,
  D: 2,
  'D#': 3,
  EB: 3,
  E: 4,
  F: 5,
  'F#': 6,
  GB: 6,
  G: 7,
  'G#': 8,
  AB: 8,
  A: 9,
  'A#': 10,
  BB: 10,
  B: 11,
};

const NOTE_REGEX = /^([A-Ga-g])([#bB]?)([0-8])$/;

export interface ParsedNote {
  readonly canonical: string;
  readonly midi: number;
  readonly frequencyHz: number;
}

export class NoteFrequency {
  static isValidNote(noteStr: string): boolean {
    return NOTE_REGEX.test(noteStr.trim());
  }

  static parse(noteStr: string): ParsedNote {
    const trimmed = noteStr.trim();
    const match = NOTE_REGEX.exec(trimmed);
    if (!match) {
      throw new Error(`Nota musical inválida: "${noteStr}". Esperado formato científico (ex: C4, F#3, Bb4).`);
    }

    const letter = match[1].toUpperCase();
    const rawAccidental = match[2];
    const accidental = rawAccidental === '#' ? '#' : rawAccidental.toUpperCase();
    const octave = Number.parseInt(match[3], 10);

    const pitchKey = `${letter}${accidental}`;
    const semitone = SEMITONE_OFFSETS[pitchKey];
    if (semitone === undefined) {
      throw new Error(`Acidente musical inválido na nota "${noteStr}".`);
    }

    const midi = (octave + 1) * 12 + semitone;
    const rawFreq = 440 * Math.pow(2, (midi - 69) / 12);
    const frequencyHz = Math.round(rawFreq * 100) / 100;
    const canonicalAccidental = rawAccidental === '#' ? '#' : rawAccidental.toLowerCase();

    return {
      canonical: `${letter}${canonicalAccidental}${octave}`,
      midi,
      frequencyHz,
    };
  }

  static midiToCanonical(midi: number): string {
    const clamped = Math.max(12, Math.min(108, Math.round(midi)));
    const octave = Math.floor(clamped / 12) - 1;
    const semitone = ((clamped % 12) + 12) % 12;
    return `${CHROMATIC_NAMES[semitone]}${octave}`;
  }

  static parseToMidi(noteStr: string): number {
    return NoteFrequency.parse(noteStr).midi;
  }

  static transpose(noteStr: string, semitones: number): string {
    const parsed = NoteFrequency.parse(noteStr);
    if (!semitones) {
      return parsed.canonical;
    }
    return NoteFrequency.midiToCanonical(parsed.midi + semitones);
  }
}
