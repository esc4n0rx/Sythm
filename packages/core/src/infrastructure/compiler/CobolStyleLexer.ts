import type { ILexer, LexerResult } from '../../application/ports/ILexer.js';
import type { DrumType } from '../../domain/entities/Ast.js';
import type { CompilationDiagnostic } from '../../domain/entities/ExecutionPlan.js';
import { type Token, TokenType } from '../../domain/entities/Token.js';
import { NoteFrequency } from '../../domain/value-objects/NoteFrequency.js';

const KEYWORDS: Record<string, TokenType> = {
  HEADER: TokenType.HEADER,
  IDENTIFICATION: TokenType.IDENTIFICATION,
  CONFIG: TokenType.CONFIG,
  ENVIRONMENT: TokenType.ENVIRONMENT,
  PLAY: TokenType.PLAY,
  PROCEDURE: TokenType.PROCEDURE,
  PROCEDURES: TokenType.PROCEDURES,
  PATTERNS: TokenType.PATTERNS,
  TRACK: TokenType.TRACK,
  'END-TRACK': TokenType.END_TRACK,
  DIVISION: TokenType.DIVISION,
  SECTION: TokenType.SECTION,
  'END-SECTION': TokenType.END_SECTION,
  PERFORM: TokenType.PERFORM,

  'PROGRAM-ID': TokenType.PROGRAM_ID,
  TITLE: TokenType.TITLE,
  AUTHOR: TokenType.AUTHOR,

  TEMPO: TokenType.TEMPO,
  BPM: TokenType.BPM,
  WAVE: TokenType.WAVE,
  INSTRUMENT: TokenType.INSTRUMENT,
  VOLUME: TokenType.VOLUME,
  IS: TokenType.IS,
  TO: TokenType.TO,
  SET: TokenType.SET,
  NOTE: TokenType.NOTE,
  NOTES: TokenType.NOTES,
  CHORD: TokenType.CHORD,
  DRUM: TokenType.DRUM,
  DRUMS: TokenType.DRUMS,
  SAMPLE: TokenType.SAMPLE,
  SPEED: TokenType.SPEED,
  OFFSET: TokenType.OFFSET,
  FOR: TokenType.FOR,
  BEAT: TokenType.BEAT,
  BEATS: TokenType.BEATS,
  REST: TokenType.REST,
  REPEAT: TokenType.REPEAT,
  TIMES: TokenType.TIMES,
  'END-REPEAT': TokenType.END_REPEAT,
  PRINT: TokenType.PRINT,
  DISPLAY: TokenType.DISPLAY,

  SINE: TokenType.SINE,
  SQUARE: TokenType.SQUARE,
  SAW: TokenType.SAW,
  SAWTOOTH: TokenType.SAWTOOTH,
  TRIANGLE: TokenType.TRIANGLE,

  FILTER: TokenType.FILTER,
  LOWPASS: TokenType.LOWPASS,
  HIGHPASS: TokenType.HIGHPASS,
  BANDPASS: TokenType.BANDPASS,
  HZ: TokenType.HZ,
  AT: TokenType.AT,
  Q: TokenType.Q,
  OFF: TokenType.OFF,
  ON: TokenType.ON,
  DELAY: TokenType.DELAY,
  FEEDBACK: TokenType.FEEDBACK,
  TIME: TokenType.TIME,
  SEC: TokenType.SEC,
  SECONDS: TokenType.SEC,
  PERCENT: TokenType.PERCENT,
  REVERB: TokenType.REVERB,
  ENVELOPE: TokenType.ENVELOPE,
  ATTACK: TokenType.ATTACK,
  DECAY: TokenType.DECAY,
  SUSTAIN: TokenType.SUSTAIN,
  RELEASE: TokenType.RELEASE,
  DETUNE: TokenType.DETUNE,
  CENTS: TokenType.CENTS,

  CONTROL: TokenType.CONTROL,
  SLIDER: TokenType.SLIDER,
  DEFINE: TokenType.DEFINE,
  FROM: TokenType.FROM,
  DEFAULT: TokenType.DEFAULT,
  STEP: TokenType.STEP,

  VISUALIZER: TokenType.VISUALIZER,
  SCOPE: TokenType.SCOPE,
  SPECTRUM: TokenType.SPECTRUM,
  PIANOROLL: TokenType.PIANOROLL,
  ALL: TokenType.ALL,

  CHORDS: TokenType.CHORDS,
  ARPEGGIATE: TokenType.ARPEGGIATE,
  ARP: TokenType.ARP,
  UP: TokenType.UP,
  DOWN: TokenType.DOWN,
  'UP-DOWN': TokenType.UP_DOWN,
  TRANSPOSE: TokenType.TRANSPOSE,
  SEMITONE: TokenType.SEMITONE,
  SEMITONES: TokenType.SEMITONES,
  SCALE: TokenType.SCALE,
  MAJOR: TokenType.MAJOR,
  MINOR: TokenType.MINOR,
  DORIAN: TokenType.DORIAN,
  PHRYGIAN: TokenType.PHRYGIAN,
  PENTATONIC: TokenType.PENTATONIC,

  EUCLIDEAN: TokenType.EUCLIDEAN,
  IN: TokenType.IN,
  PAN: TokenType.PAN,
  LEFT: TokenType.LEFT,
  RIGHT: TokenType.RIGHT,
  CENTER: TokenType.CENTER,
  LFO: TokenType.LFO,
  RATE: TokenType.RATE,
  DEPTH: TokenType.DEPTH,
  SWEEP: TokenType.SWEEP,
  OVER: TokenType.OVER,

  'FM-KEYS': TokenType.FM_KEYS,
  'ACID-BASS': TokenType.ACID_BASS,
  PLUCK: TokenType.PLUCK,
  'SUB-808': TokenType.SUB_808,
  'PAD-WARM': TokenType.PAD_WARM,
};

const DRUM_LITERALS: Record<string, DrumType> = {
  KICK: 'kick',
  SNARE: 'snare',
  HIHAT: 'hihat',
  'HI-HAT': 'hihat',
  'OPEN-HIHAT': 'open-hihat',
  OHAT: 'open-hihat',
  CLAP: 'clap',
  TOM: 'tom',
  RIM: 'rim',
  COWBELL: 'cowbell',
  CRASH: 'crash',
  PERC: 'perc',
};

export class CobolStyleLexer implements ILexer {
  tokenize(source: string): LexerResult {
    const tokens: Token[] = [];
    const diagnostics: CompilationDiagnostic[] = [];

    let index = 0;
    let line = 1;
    let column = 1;
    let lineHasTokens = false;

    const length = source.length;

    const peek = (offset = 0): string => {
      return index + offset < length ? source[index + offset] : '\0';
    };

    const advance = (): string => {
      const ch = source[index];
      index += 1;
      if (ch === '\n') {
        line += 1;
        column = 1;
        lineHasTokens = false;
      } else {
        column += 1;
      }
      return ch;
    };

    const skipLineComment = (): void => {
      while (index < length && peek() !== '\n') {
        advance();
      }
    };

    const isDigit = (ch: string): boolean => ch >= '0' && ch <= '9';
    const isAlpha = (ch: string): boolean =>
      (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
    const isWordChar = (ch: string): boolean => isAlpha(ch) || isDigit(ch) || ch === '-';

    while (index < length) {
      const ch = peek();

      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        advance();
        continue;
      }

      // Comments: *>, --, #, or * at start of line
      if (
        (ch === '*' && peek(1) === '>') ||
        (ch === '-' && peek(1) === '-') ||
        ch === '#' ||
        (ch === '*' && !lineHasTokens)
      ) {
        skipLineComment();
        continue;
      }

      const startLine = line;
      const startColumn = column;

      if (ch === '.') {
        advance();
        tokens.push({
          type: TokenType.DOT,
          lexeme: '.',
          line: startLine,
          column: startColumn,
        });
        lineHasTokens = true;
        continue;
      }

      if (ch === ',') {
        advance();
        tokens.push({
          type: TokenType.COMMA,
          lexeme: ',',
          line: startLine,
          column: startColumn,
        });
        lineHasTokens = true;
        continue;
      }

      if (ch === '%') {
        advance();
        tokens.push({
          type: TokenType.PERCENT,
          lexeme: '%',
          line: startLine,
          column: startColumn,
        });
        lineHasTokens = true;
        continue;
      }

      if (ch === '"' || ch === "'") {
        const quote = advance();
        let value = '';
        let closed = false;

        while (index < length) {
          const current = peek();
          if (current === '\n') {
            break;
          }
          if (current === '\\' && peek(1) !== '\0' && peek(1) !== '\n') {
            advance();
            value += advance();
            continue;
          }
          if (current === quote) {
            advance();
            closed = true;
            break;
          }
          value += advance();
        }

        if (!closed) {
          diagnostics.push({
            severity: 'error',
            message: 'String não fechada antes do fim da linha.',
            line: startLine,
            column: startColumn,
            lexeme: value,
          });
        }

        tokens.push({
          type: TokenType.STRING,
          lexeme: `${quote}${value}${closed ? quote : ''}`,
          literal: value,
          line: startLine,
          column: startColumn,
        });
        lineHasTokens = true;
        continue;
      }

      if (isDigit(ch) || (ch === '-' && isDigit(peek(1)))) {
        let numText = '';
        if (ch === '-') {
          numText += advance();
        }
        while (isDigit(peek())) {
          numText += advance();
        }
        // Only consume '.' as decimal separator if followed by a digit (so '120.' remains NUMBER + DOT)
        if (peek() === '.' && isDigit(peek(1))) {
          numText += advance();
          while (isDigit(peek())) {
            numText += advance();
          }
        }

        tokens.push({
          type: TokenType.NUMBER,
          lexeme: numText,
          literal: Number.parseFloat(numText),
          line: startLine,
          column: startColumn,
        });
        lineHasTokens = true;
        continue;
      }

      if (isAlpha(ch)) {
        let word = '';
        while (isWordChar(peek())) {
          word += advance();
        }

        // Allow sharp notes/chords like F#3, F#, C#maj7, F#m7 without treating '#' as a comment
        if (
          word.length === 1 &&
          'ABCDEFGabcdefg'.includes(word) &&
          peek() === '#'
        ) {
          word += advance(); // '#'
          while (isWordChar(peek())) {
            word += advance();
          }
        }

        const upper = word.toUpperCase();
        const keywordType = KEYWORDS[upper];
        const drumLiteral = DRUM_LITERALS[upper];

        if (keywordType) {
          tokens.push({
            type: keywordType,
            lexeme: word,
            line: startLine,
            column: startColumn,
          });
        } else if (drumLiteral) {
          tokens.push({
            type: TokenType.DRUM_LITERAL,
            lexeme: word,
            literal: drumLiteral,
            line: startLine,
            column: startColumn,
          });
        } else if (NoteFrequency.isValidNote(word)) {
          const parsed = NoteFrequency.parse(word);
          tokens.push({
            type: TokenType.NOTE_LITERAL,
            lexeme: word,
            literal: parsed.canonical,
            line: startLine,
            column: startColumn,
          });
        } else {
          tokens.push({
            type: TokenType.IDENTIFIER,
            lexeme: word,
            literal: word,
            line: startLine,
            column: startColumn,
          });
        }

        lineHasTokens = true;
        continue;
      }

      const badChar = advance();
      diagnostics.push({
        severity: 'error',
        message: `Caractere inesperado "${badChar}".`,
        line: startLine,
        column: startColumn,
        lexeme: badChar,
      });
      lineHasTokens = true;
    }

    tokens.push({
      type: TokenType.EOF,
      lexeme: '',
      line,
      column,
    });

    return { tokens, diagnostics };
  }
}
