import { NoteFrequency } from './NoteFrequency.js';

const ROOT_SEMITONES: Record<string, number> = {
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

const CHORD_INTERVALS: Record<string, readonly number[]> = {
  '': [0, 4, 7],
  maj: [0, 4, 7],
  m: [0, 3, 7],
  min: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  min7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  aug: [0, 4, 8],
  '5': [0, 7],
  '9': [0, 4, 7, 10, 14],
  m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  add9: [0, 4, 7, 14],
};

// Note: quality ordered longest-first so 'maj7' matches before 'maj', 'dim7' before 'dim', etc.
const CHORD_REGEX =
  /^([A-Ga-g])([#bB]?)(maj9|maj7|maj|min7|min|dim7|dim|add9|sus2|sus4|m9|m7|m|aug|9|7|5)?([0-8])?$/;

export const SCALE_INTERVALS: Record<string, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
};

export class ChordParser {
  static isChordSymbol(raw: string, allowDominant7WithSingleDigit = true): boolean {
    const trimmed = raw.trim();
    const match = CHORD_REGEX.exec(trimmed);
    if (!match) {
      return false;
    }

    const quality = match[3]?.toLowerCase() ?? '';
    const octave = match[4];

    if (quality) {
      return quality in CHORD_INTERVALS;
    }

    // Bare root like 'C', 'F#', 'Bb' is always a major triad chord
    if (!octave) {
      return true;
    }

    // e.g. 'G7', 'C7' when explicitly parsing in chord context vs note 'C4'
    return allowDominant7WithSingleDigit && octave === '7';
  }

  static parseChord(symbol: string, defaultOctave = 4): string[] {
    const trimmed = symbol.trim();
    const match = CHORD_REGEX.exec(trimmed);
    if (!match) {
      throw new Error(
        `Cifra de acorde inválida "${symbol}". Exemplos válidos: Am, Am7, Fmaj7, C, G7, Dsus4.`,
      );
    }

    const rootLetter = match[1].toUpperCase();
    const rawAccidental = match[2];
    const accidental = rawAccidental === '#' ? '#' : rawAccidental.toUpperCase();
    const rawQuality = match[3]?.toLowerCase() ?? '';
    const rawOctave = match[4];

    // Treat 'G7', 'C7' (no explicit suffix, trailing '7') as dominant 7th chord
    const quality = !rawQuality && rawOctave === '7' ? '7' : rawQuality;
    const octave =
      !rawQuality && rawOctave === '7'
        ? defaultOctave
        : rawOctave
          ? Number.parseInt(rawOctave, 10)
          : defaultOctave;

    const rootKey = `${rootLetter}${accidental}`;
    const rootSemitone = ROOT_SEMITONES[rootKey];
    if (rootSemitone === undefined) {
      throw new Error(`Tônica inválida no acorde "${symbol}".`);
    }

    const intervals = CHORD_INTERVALS[quality];
    if (!intervals) {
      throw new Error(`Qualidade de acorde não suportada em "${symbol}".`);
    }

    const rootMidi = (octave + 1) * 12 + rootSemitone;
    return intervals.map((offset) => NoteFrequency.midiToCanonical(rootMidi + offset));
  }

  static parseScaleNotes(rootRaw: string, mode: string, octave = 4): string[] {
    const rootKey = rootRaw.trim().toUpperCase();
    const semitone = ROOT_SEMITONES[rootKey];
    const intervals = SCALE_INTERVALS[mode.toLowerCase()];
    if (semitone === undefined || !intervals) {
      return [];
    }
    const baseMidi = (octave + 1) * 12 + semitone;
    return intervals.map((offset) => NoteFrequency.midiToCanonical(baseMidi + offset));
  }
}
