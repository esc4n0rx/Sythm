import { type CompilationDiagnostic, ChordParser, NoteFrequency } from '@sythm/core';

export type HighlightTokenKind =
  | 'comment'
  | 'string'
  | 'division'
  | 'keyword'
  | 'waveform'
  | 'drum'
  | 'note'
  | 'number'
  | 'punctuation'
  | 'plain';

export interface HighlightSegment {
  readonly text: string;
  readonly kind: HighlightTokenKind;
}

export type AutocompleteKind =
  | 'division'
  | 'command'
  | 'keyword'
  | 'note'
  | 'drum'
  | 'waveform'
  | 'snippet';

export interface AutocompleteItem {
  readonly label: string;
  readonly insertText: string;
  readonly kind: AutocompleteKind;
  readonly detail: string;
}

export interface AutocompleteResult {
  readonly prefix: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly lineIndex: number;
  readonly columnIndex: number;
  readonly items: AutocompleteItem[];
}

export interface AutocompleteContext {
  readonly definedSections?: readonly string[];
  readonly sampleNames?: readonly string[];
}

export interface HoverDoc {
  readonly title: string;
  readonly syntax: string;
  readonly description: string;
}

export interface QuickFixAction {
  readonly label: string;
  readonly newLineText: string;
}

const DIVISION_WORDS = new Set([
  'HEADER',
  'IDENTIFICATION',
  'CONFIG',
  'ENVIRONMENT',
  'PLAY',
  'PROCEDURE',
  'PROCEDURES',
  'PATTERNS',
  'TRACK',
  'END-TRACK',
  'DIVISION',
  'SECTION',
  'END-SECTION',
  'PROGRAM-ID',
  'TITLE',
  'AUTHOR',
]);

const KEYWORD_WORDS = new Set([
  'TEMPO',
  'BPM',
  'WAVE',
  'INSTRUMENT',
  'VOLUME',
  'IS',
  'TO',
  'AT',
  'SET',
  'NOTE',
  'NOTES',
  'CHORD',
  'DRUM',
  'DRUMS',
  'SAMPLE',
  'SPEED',
  'OFFSET',
  'FOR',
  'BEAT',
  'BEATS',
  'REST',
  'REPEAT',
  'TIMES',
  'END-REPEAT',
  'PERFORM',
  'PRINT',
  'DISPLAY',
  'FILTER',
  'LOWPASS',
  'HIGHPASS',
  'BANDPASS',
  'HZ',
  'Q',
  'OFF',
  'DELAY',
  'FEEDBACK',
  'TIME',
  'SEC',
  'SECONDS',
  'PERCENT',
  'REVERB',
  'ENVELOPE',
  'ATTACK',
  'DECAY',
  'SUSTAIN',
  'RELEASE',
  'DETUNE',
  'CENTS',
  'CONTROL',
  'SLIDER',
  'DEFINE',
  'FROM',
  'DEFAULT',
  'STEP',
  'VISUALIZER',
  'SCOPE',
  'SPECTRUM',
  'PIANOROLL',
  'ALL',
  'ON',
  'CHORDS',
  'ARPEGGIATE',
  'ARP',
  'UP',
  'DOWN',
  'UP-DOWN',
  'TRANSPOSE',
  'SEMITONE',
  'SEMITONES',
  'SCALE',
  'MAJOR',
  'MINOR',
  'DORIAN',
  'PHRYGIAN',
  'PENTATONIC',
  'EUCLIDEAN',
  'IN',
  'PAN',
  'LEFT',
  'RIGHT',
  'CENTER',
  'LFO',
  'RATE',
  'DEPTH',
  'SWEEP',
  'OVER',
  'MAYBE',
  'CHOOSE',
  'ONE',
  'OF',
  'HUMANIZE',
  'MS',
  'VELOCITY',
  'RAMP',
  'AUTOMATE',
  'PATTERN',
  'SWING',
]);

const WAVEFORM_WORDS = new Set([
  'SINE',
  'SQUARE',
  'SAW',
  'SAWTOOTH',
  'TRIANGLE',
  'FM-KEYS',
  'ACID-BASS',
  'PLUCK',
  'SUB-808',
  'PAD-WARM',
]);

const DRUM_WORDS = new Set([
  'KICK',
  'SNARE',
  'HIHAT',
  'HI-HAT',
  'OPEN-HIHAT',
  'OHAT',
  'CLAP',
  'TOM',
  'RIM',
  'COWBELL',
  'CRASH',
  'PERC',
]);

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isAlpha(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

function isWordChar(ch: string): boolean {
  return isAlpha(ch) || isDigit(ch) || ch === '-';
}

/**
 * Tokenizes a single line while preserving every character 1:1 (including whitespace)
 * so the highlighted <pre> overlay aligns identically with the <textarea>.
 */
export function tokenizeLineForHighlight(line: string): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  let i = 0;
  let seenNonWhitespace = false;
  const len = line.length;

  const push = (text: string, kind: HighlightTokenKind) => {
    if (!text) return;
    const prev = segments[segments.length - 1];
    if (prev && prev.kind === kind) {
      segments[segments.length - 1] = { text: prev.text + text, kind };
    } else {
      segments.push({ text, kind });
    }
  };

  while (i < len) {
    const ch = line[i];

    if (ch === ' ' || ch === '\t' || ch === '\r') {
      let end = i + 1;
      while (end < len && (line[end] === ' ' || line[end] === '\t' || line[end] === '\r')) {
        end += 1;
      }
      push(line.slice(i, end), 'plain');
      i = end;
      continue;
    }

    // Comments: *>, --, #, or * as first non-whitespace char on the line
    if (
      (ch === '*' && line[i + 1] === '>') ||
      (ch === '-' && line[i + 1] === '-') ||
      ch === '#' ||
      (ch === '*' && !seenNonWhitespace)
    ) {
      push(line.slice(i), 'comment');
      break;
    }

    seenNonWhitespace = true;

    // Strings
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let end = i + 1;
      while (end < len) {
        if (line[end] === '\\' && end + 1 < len) {
          end += 2;
          continue;
        }
        if (line[end] === quote) {
          end += 1;
          break;
        }
        end += 1;
      }
      push(line.slice(i, end), 'string');
      i = end;
      continue;
    }

    // Numbers (including negative sign followed by digit)
    if (isDigit(ch) || (ch === '-' && isDigit(line[i + 1] ?? ''))) {
      let end = ch === '-' ? i + 2 : i + 1;
      while (end < len && isDigit(line[end])) {
        end += 1;
      }
      if (line[end] === '.' && isDigit(line[end + 1] ?? '')) {
        end += 1;
        while (end < len && isDigit(line[end])) {
          end += 1;
        }
      }
      push(line.slice(i, end), 'number');
      i = end;
      continue;
    }

    // Words, keywords, divisions, notes, and chord symbols
    if (isAlpha(ch)) {
      let end = i + 1;
      while (end < len && isWordChar(line[end])) {
        end += 1;
      }
      if (end - i === 1 && 'ABCDEFGabcdefg'.includes(line[i]) && line[end] === '#') {
        end += 1;
        while (end < len && isWordChar(line[end])) {
          end += 1;
        }
      }

      const word = line.slice(i, end);
      const upper = word.toUpperCase();

      if (DIVISION_WORDS.has(upper)) {
        push(word, 'division');
      } else if (WAVEFORM_WORDS.has(upper)) {
        push(word, 'waveform');
      } else if (DRUM_WORDS.has(upper)) {
        push(word, 'drum');
      } else if (KEYWORD_WORDS.has(upper)) {
        push(word, 'keyword');
      } else if (NoteFrequency.isValidNote(word) || ChordParser.isChordSymbol(word, false)) {
        push(word, 'note');
      } else {
        push(word, 'plain');
      }

      i = end;
      continue;
    }

    if (ch === '.' || ch === ',') {
      push(ch, 'punctuation');
      i += 1;
      continue;
    }

    push(ch, 'plain');
    i += 1;
  }

  return segments;
}

const COMMON_NOTES: AutocompleteItem[] = [
  'C4',
  'D4',
  'E4',
  'F4',
  'G4',
  'A4',
  'B4',
  'C5',
  'C3',
  'A3',
  'F3',
  'G3',
  'F#4',
  'Bb3',
  'Eb4',
  'C2',
  'G2',
].map((note) => {
  const parsed = NoteFrequency.parse(note);
  return {
    label: note,
    insertText: note,
    kind: 'note',
    detail: `Nota ${parsed.canonical} (${parsed.frequencyHz} Hz)`,
  };
});

const WAVEFORM_ITEMS: AutocompleteItem[] = [
  { label: 'SAW', insertText: 'SAW.', kind: 'waveform', detail: 'Onda Dente de Serra (rica em harmônicos)' },
  { label: 'SINE', insertText: 'SINE.', kind: 'waveform', detail: 'Onda Senoidal (som puro e suave)' },
  { label: 'SQUARE', insertText: 'SQUARE.', kind: 'waveform', detail: 'Onda Quadrada (estilo synth/retro)' },
  { label: 'TRIANGLE', insertText: 'TRIANGLE.', kind: 'waveform', detail: 'Onda Triangular (quente e macia)' },
  { label: 'FM-KEYS', insertText: 'FM-KEYS.', kind: 'waveform', detail: 'Piano elétrico / sinos FM 2-operadores' },
  { label: 'ACID-BASS', insertText: 'ACID-BASS.', kind: 'waveform', detail: 'Baixo ácido 303 com filtro ressonante' },
  { label: 'PLUCK', insertText: 'PLUCK.', kind: 'waveform', detail: 'Synth dedilhado com ataque rápido' },
  { label: 'SUB-808', insertText: 'SUB-808.', kind: 'waveform', detail: 'Subgrave profundo com punch 808' },
  { label: 'PAD-WARM', insertText: 'PAD-WARM.', kind: 'waveform', detail: 'Pad analógico multi-detune aveludado' },
  { label: 'SAWTOOTH', insertText: 'SAWTOOTH.', kind: 'waveform', detail: 'Alias para SAW' },
];

const DRUM_ITEMS: AutocompleteItem[] = [
  { label: 'KICK', insertText: 'KICK', kind: 'drum', detail: 'Bumbo grave sintetizado' },
  { label: 'SNARE', insertText: 'SNARE', kind: 'drum', detail: 'Caixa com ruído e corpo' },
  { label: 'HIHAT', insertText: 'HIHAT', kind: 'drum', detail: 'Chimbal fechado agudo' },
  { label: 'OPEN-HIHAT', insertText: 'OPEN-HIHAT', kind: 'drum', detail: 'Chimbal aberto longo' },
  { label: 'CLAP', insertText: 'CLAP', kind: 'drum', detail: 'Palma eletrônica' },
  { label: 'TOM', insertText: 'TOM', kind: 'drum', detail: 'Tambor médio tonal' },
  { label: 'RIM', insertText: 'RIM', kind: 'drum', detail: 'Aro de caixa 808 estalado' },
  { label: 'COWBELL', insertText: 'COWBELL', kind: 'drum', detail: 'Cowbell metálico dual-square 808' },
  { label: 'CRASH', insertText: 'CRASH', kind: 'drum', detail: 'Prato crash brilhante com cauda longa' },
  { label: 'PERC', insertText: 'PERC', kind: 'drum', detail: 'Percussão FM estilo conga/woodblock' },
];

const GENERAL_ITEMS: AutocompleteItem[] = [
  { label: 'HEADER DIVISION.', insertText: 'HEADER DIVISION.', kind: 'division', detail: 'Seção de metadados da faixa' },
  { label: 'CONFIG DIVISION.', insertText: 'CONFIG DIVISION.', kind: 'division', detail: 'Seção de BPM, onda e efeitos globais' },
  { label: 'PROCEDURES DIVISION.', insertText: 'PROCEDURES DIVISION.', kind: 'division', detail: 'Seção de sub-rotinas reutilizáveis' },
  { label: 'PLAY DIVISION.', insertText: 'PLAY DIVISION.', kind: 'division', detail: 'Seção principal de notas e tracks' },
  {
    label: 'SECTION ... END-SECTION.',
    insertText: 'SECTION REFRAO.\n  PLAY NOTES C4 E4 G4 FOR 0.5 BEATS.\nEND-SECTION.',
    kind: 'snippet',
    detail: 'Sub-rotina reutilizável COBOL-style',
  },
  { label: 'PERFORM ... 2 TIMES.', insertText: 'PERFORM REFRAO 2 TIMES.', kind: 'command', detail: 'Chama uma SECTION definida' },
  {
    label: 'TRACK ... END-TRACK.',
    insertText: 'TRACK DRUMS.\n  PLAY DRUMS KICK HIHAT SNARE HIHAT FOR 0.5 BEATS.\nEND-TRACK.',
    kind: 'snippet',
    detail: 'Bloco paralelo de track musical',
  },
  { label: 'END-TRACK.', insertText: 'END-TRACK.', kind: 'division', detail: 'Fecha bloco TRACK' },
  { label: 'END-SECTION.', insertText: 'END-SECTION.', kind: 'division', detail: 'Fecha bloco SECTION' },
  { label: 'FILTER IS LOWPASS ... HZ.', insertText: 'FILTER IS LOWPASS 900 HZ Q 2.', kind: 'command', detail: 'Filtro passa-baixa/alta/banda' },
  { label: 'DELAY IS ... PERCENT.', insertText: 'DELAY IS 30 PERCENT TIME 0.3 SEC FEEDBACK 40 PERCENT.', kind: 'command', detail: 'Eco estéreo Web Audio' },
  { label: 'REVERB IS ... PERCENT.', insertText: 'REVERB IS 35 PERCENT.', kind: 'command', detail: 'Ambiência procedural ConvolverNode' },
  { label: 'ENVELOPE ATTACK ...', insertText: 'ENVELOPE ATTACK 0.05 SEC DECAY 0.1 SEC SUSTAIN 70 PERCENT RELEASE 0.2 SEC.', kind: 'command', detail: 'Curva ADSR da nota' },
  { label: 'DETUNE IS ... CENTS.', insertText: 'DETUNE IS 12 CENTS.', kind: 'command', detail: 'Unísono desafinado (chorus synth)' },
  { label: 'PROGRAM-ID.', insertText: 'PROGRAM-ID. MY-TRACK.', kind: 'division', detail: 'Define o identificador do programa' },
  { label: 'TITLE IS', insertText: 'TITLE IS "Minha Faixa".', kind: 'division', detail: 'Define o título da composição' },
  { label: 'AUTHOR IS', insertText: 'AUTHOR IS "Sythm Studio".', kind: 'division', detail: 'Define o autor da faixa' },
  { label: 'TEMPO IS ... BPM.', insertText: 'TEMPO IS 120 BPM.', kind: 'command', detail: 'Define o andamento em BPM' },
  { label: 'WAVE IS ...', insertText: 'WAVE IS SAW.', kind: 'command', detail: 'Define a forma de onda do sintetizador' },
  { label: 'VOLUME IS ...', insertText: 'VOLUME IS 75.', kind: 'command', detail: 'Define o volume (0 a 100)' },
  {
    label: 'CONTROL ... IS SLIDER ...',
    insertText: 'CONTROL VOL-BASS IS SLIDER 75 FROM 0 TO 100.',
    kind: 'command',
    detail: 'Cria variável com slider interativo em tempo real',
  },
  {
    label: 'VOLUME IS SLIDER ...',
    insertText: 'VOLUME IS SLIDER 75 FROM 0 TO 100.',
    kind: 'command',
    detail: 'Slider inline direto para volume da track',
  },
  { label: 'PLAY NOTE', insertText: 'PLAY NOTE C4 FOR 1 BEAT.', kind: 'command', detail: 'Toca uma nota individual' },
  { label: 'PLAY NOTES', insertText: 'PLAY NOTES C4 E4 G4 FOR 0.5 BEATS.', kind: 'command', detail: 'Toca sequência de notas' },
  { label: 'PLAY CHORD', insertText: 'PLAY CHORD Am7 FOR 2 BEATS.', kind: 'command', detail: 'Toca um acorde por cifra ou notas' },
  { label: 'PLAY CHORDS', insertText: 'PLAY CHORDS Am7 Fmaj7 Cmaj7 G7 FOR 1 BEAT.', kind: 'command', detail: 'Toca progressão de acordes cifrados' },
  { label: 'ARPEGGIATE', insertText: 'ARPEGGIATE Am7 UP-DOWN FOR 0.25 BEATS.', kind: 'command', detail: 'Arpeja acorde ou notas (UP/DOWN/UP-DOWN)' },
  { label: 'PLAY EUCLIDEAN', insertText: 'PLAY EUCLIDEAN KICK 3 IN 8 FOR 0.25 BEATS.', kind: 'command', detail: 'Ritmo euclidiano Bjorklund (pulsos IN passos)' },
  { label: 'PLAY DRUM', insertText: 'PLAY DRUM KICK FOR 0.5 BEATS.', kind: 'command', detail: 'Toca uma peça de bateria' },
  { label: 'PLAY DRUMS', insertText: 'PLAY DRUMS KICK HIHAT SNARE HIHAT FOR 0.5 BEATS.', kind: 'command', detail: 'Toca sequência de bateria' },
  { label: 'PLAY SAMPLE', insertText: 'PLAY SAMPLE "demo-rave-loop.wav" RATE 1.0 FOR 8 BEATS.', kind: 'command', detail: 'Reproduz áudio externo .mp3/.wav sincronizado' },
  { label: 'VISUALIZER IS ALL.', insertText: 'VISUALIZER IS ALL.', kind: 'command', detail: 'Ativa visualizador (SCOPE, SPECTRUM, PIANOROLL, ALL, OFF)' },
  { label: 'SCALE IS C MINOR.', insertText: 'SCALE IS C MINOR.', kind: 'command', detail: 'Declara escala musical da composição' },
  { label: 'TRANSPOSE', insertText: 'TRANSPOSE UP 2 SEMITONES.', kind: 'command', detail: 'Transpõe notas da track por semitons' },
  { label: 'PAN IS LEFT/RIGHT', insertText: 'PAN IS LEFT 35 PERCENT.', kind: 'command', detail: 'Balanço estéreo L/R ou SLIDER -100..100' },
  { label: 'LFO IS ON', insertText: 'LFO IS ON RATE 3 HZ DEPTH 500 HZ.', kind: 'command', detail: 'Modulação cíclica LFO no filtro' },
  { label: 'SWEEP FROM ... TO ...', insertText: 'SWEEP FROM 300 TO 2800 OVER 4 BEATS.', kind: 'command', detail: 'Varredura automática do filtro' },
  { label: 'REST FOR', insertText: 'REST FOR 1 BEAT.', kind: 'command', detail: 'Pausa musical em beats' },
  {
    label: 'REPEAT ... END-REPEAT.',
    insertText: 'REPEAT 2 TIMES\n  PLAY NOTE C4 FOR 0.5 BEATS.\nEND-REPEAT.',
    kind: 'snippet',
    detail: 'Bloco de repetição COBOL-style',
  },
  { label: 'END-REPEAT.', insertText: 'END-REPEAT.', kind: 'keyword', detail: 'Fecha bloco REPEAT' },
  { label: 'PRINT "..."', insertText: 'PRINT "Mensagem".', kind: 'command', detail: 'Imprime mensagem no Console' },
  { label: 'DISPLAY "..."', insertText: 'DISPLAY "Mensagem".', kind: 'command', detail: 'Alias de PRINT' },
  { label: 'SET TEMPO TO', insertText: 'SET TEMPO TO 120 BPM.', kind: 'keyword', detail: 'Sintaxe alternativa de TEMPO' },
  { label: 'SET WAVE TO', insertText: 'SET WAVE TO SAW.', kind: 'keyword', detail: 'Sintaxe alternativa de WAVE' },
  { label: 'FOR 1 BEAT.', insertText: 'FOR 1 BEAT.', kind: 'keyword', detail: 'Duração de 1 beat' },
  { label: 'FOR 0.5 BEATS.', insertText: 'FOR 0.5 BEATS.', kind: 'keyword', detail: 'Duração de meio beat' },
  ...DRUM_ITEMS,
  ...COMMON_NOTES,
];

function extractDeclaredControls(code: string): AutocompleteItem[] {
  const regex = /^\s*(?:DEFINE\s+(?:(?:CONTROL|SLIDER)\s+)?)?(?:CONTROL|SLIDER)\s+([A-Za-z][A-Za-z0-9_-]*)/gim;
  const found = new Map<string, AutocompleteItem>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(code)) !== null) {
    const name = match[1].toUpperCase();
    if (!found.has(name)) {
      found.set(name, {
        label: name,
        insertText: name,
        kind: 'keyword',
        detail: `Variável CONTROL (${name})`,
      });
    }
  }
  return Array.from(found.values());
}

function getContextItems(
  lineBeforeWord: string,
  declaredControls: AutocompleteItem[],
): AutocompleteItem[] {
  const upperLine = lineBeforeWord.trim().toUpperCase();

  if (/\b(?:VOLUME|TEMPO|REVERB|DELAY|DETUNE|PAN)\s+(?:IS|TO)\s*$/.test(upperLine)) {
    if (/\bPAN\s+(?:IS|TO)\s*$/.test(upperLine)) {
      return [
        ...declaredControls,
        { label: 'LEFT 45 PERCENT.', insertText: 'LEFT 45 PERCENT.', kind: 'keyword', detail: 'Pan para a esquerda' },
        { label: 'RIGHT 45 PERCENT.', insertText: 'RIGHT 45 PERCENT.', kind: 'keyword', detail: 'Pan para a direita' },
        { label: 'CENTER.', insertText: 'CENTER.', kind: 'keyword', detail: 'Pan centralizado (0)' },
        { label: 'SLIDER 0 FROM -100 TO 100.', insertText: 'SLIDER 0 FROM -100 TO 100.', kind: 'command', detail: 'Slider estéreo L/R em tempo real' },
      ];
    }
    return [
      ...declaredControls,
      { label: 'SLIDER 75 FROM 0 TO 100', insertText: 'SLIDER 75 FROM 0 TO 100.', kind: 'command', detail: 'Cria slider inline direto no parâmetro' },
      { label: 'OFF.', insertText: 'OFF.', kind: 'keyword', detail: 'Desativa efeito (DELAY/REVERB/DETUNE)' },
    ];
  }

  if (/\bVISUALIZER\s+(?:IS|TO)?\s*$/.test(upperLine)) {
    return [
      { label: 'ALL.', insertText: 'ALL.', kind: 'keyword', detail: 'Exibe Oscilloscope, FFT e Piano Roll' },
      { label: 'SCOPE.', insertText: 'SCOPE.', kind: 'keyword', detail: 'Exibe apenas osciloscópio' },
      { label: 'SPECTRUM.', insertText: 'SPECTRUM.', kind: 'keyword', detail: 'Exibe apenas espectro de frequências' },
      { label: 'PIANOROLL.', insertText: 'PIANOROLL.', kind: 'keyword', detail: 'Exibe apenas piano roll e beats' },
      { label: 'OFF.', insertText: 'OFF.', kind: 'keyword', detail: 'Minimiza visualizador' },
    ];
  }

  if (/\bSCALE\s+(?:IS|TO)\s+[A-G][#B]?\s*$/.test(upperLine)) {
    return [
      { label: 'MINOR.', insertText: 'MINOR.', kind: 'keyword', detail: 'Escala menor natural' },
      { label: 'MAJOR.', insertText: 'MAJOR.', kind: 'keyword', detail: 'Escala maior' },
      { label: 'DORIAN.', insertText: 'DORIAN.', kind: 'keyword', detail: 'Modo dórico' },
      { label: 'PHRYGIAN.', insertText: 'PHRYGIAN.', kind: 'keyword', detail: 'Modo frígio' },
      { label: 'PENTATONIC.', insertText: 'PENTATONIC.', kind: 'keyword', detail: 'Escala pentatônica menor' },
    ];
  }

  if (/\bFILTER\s+(?:IS|TO)\s+(?:LOWPASS|HIGHPASS|BANDPASS)\s*$/.test(upperLine)) {
    return [
      ...declaredControls,
      { label: 'SLIDER 900 FROM 80 TO 4000 HZ.', insertText: 'SLIDER 900 FROM 80 TO 4000 HZ.', kind: 'command', detail: 'Slider inline de frequência cutoff' },
    ];
  }

  if (/\b(?:Q|TIME|FEEDBACK)\s*(?:IS|TO)?\s*$/.test(upperLine)) {
    return [
      ...declaredControls,
      { label: 'SLIDER 2 FROM 0.5 TO 10', insertText: 'SLIDER 2 FROM 0.5 TO 10.', kind: 'command', detail: 'Slider inline para Q/Time/Feedback' },
    ];
  }

  if (/\bCONTROL\s+[A-Z0-9_-]+\s*(?:IS)?\s*$/.test(upperLine)) {
    return [
      { label: 'IS SLIDER 75 FROM 0 TO 100.', insertText: 'IS SLIDER 75 FROM 0 TO 100.', kind: 'command', detail: 'Slider de 0 a 100' },
      { label: 'IS SLIDER 520 FROM 80 TO 4000.', insertText: 'IS SLIDER 520 FROM 80 TO 4000.', kind: 'command', detail: 'Slider de frequência (Hz)' },
    ];
  }

  if (/\bPLAY\s*$/.test(upperLine)) {
    return [
      { label: 'NOTE', insertText: 'NOTE C4 FOR 1 BEAT.', kind: 'command', detail: 'Toca uma nota musical' },
      { label: 'NOTES', insertText: 'NOTES C4 E4 G4 FOR 0.5 BEATS.', kind: 'command', detail: 'Toca notas em sequência' },
      { label: 'CHORD', insertText: 'CHORD Am7 FOR 2 BEATS.', kind: 'command', detail: 'Toca um acorde por cifra ou notas' },
      { label: 'CHORDS', insertText: 'CHORDS Am7 Fmaj7 Cmaj7 G7 FOR 1 BEAT.', kind: 'command', detail: 'Toca progressão cifrada' },
      { label: 'EUCLIDEAN', insertText: 'EUCLIDEAN KICK 3 IN 8 FOR 0.25 BEATS.', kind: 'command', detail: 'Ritmo euclidiano Bjorklund' },
      { label: 'DRUM', insertText: 'DRUM KICK FOR 0.5 BEATS.', kind: 'command', detail: 'Toca uma peça de bateria' },
      { label: 'DRUMS', insertText: 'DRUMS KICK HIHAT SNARE HIHAT FOR 0.5 BEATS.', kind: 'command', detail: 'Toca sequência de bateria' },
      { label: 'DIVISION.', insertText: 'DIVISION.', kind: 'division', detail: 'Cabeçalho PLAY DIVISION.' },
    ];
  }

  if (/\b(?:DRUM|DRUMS|EUCLIDEAN)\b(?:\s+(?:KICK|SNARE|HIHAT|HI-HAT|OPEN-HIHAT|OHAT|CLAP|TOM|RIM|COWBELL|CRASH|PERC)(?:\s*,)?)*\s*$/.test(upperLine)) {
    return [
      ...DRUM_ITEMS,
      { label: 'FOR 0.5 BEATS.', insertText: 'FOR 0.5 BEATS.', kind: 'keyword', detail: 'Duração de meio beat' },
      { label: 'FOR 0.25 BEATS.', insertText: 'FOR 0.25 BEATS.', kind: 'keyword', detail: 'Semínima / semicolcheia (0.25 beats)' },
      { label: 'FOR 1 BEAT.', insertText: 'FOR 1 BEAT.', kind: 'keyword', detail: 'Duração de 1 beat' },
    ];
  }

  if (/\b(?:NOTE|NOTES|CHORD)\b(?:\s+[A-Ga-g][#bB]?[0-8](?:\s*,)?)*\s*$/.test(upperLine)) {
    return [
      ...COMMON_NOTES,
      { label: 'FOR 1 BEAT.', insertText: 'FOR 1 BEAT.', kind: 'keyword', detail: 'Duração de 1 beat' },
      { label: 'FOR 0.5 BEATS.', insertText: 'FOR 0.5 BEATS.', kind: 'keyword', detail: 'Duração de 0.5 beats' },
      { label: 'FOR 2 BEATS.', insertText: 'FOR 2 BEATS.', kind: 'keyword', detail: 'Duração de 2 beats' },
    ];
  }

  if (/\b(?:WAVE|INSTRUMENT)\s+(?:IS|TO)\s*$/.test(upperLine)) {
    return WAVEFORM_ITEMS;
  }

  if (/\b(?:WAVE|INSTRUMENT)\s*$/.test(upperLine)) {
    return [
      { label: 'IS SAW.', insertText: 'IS SAW.', kind: 'waveform', detail: 'Define onda SAW' },
      { label: 'IS SINE.', insertText: 'IS SINE.', kind: 'waveform', detail: 'Define onda SINE' },
      { label: 'IS SQUARE.', insertText: 'IS SQUARE.', kind: 'waveform', detail: 'Define onda SQUARE' },
      { label: 'IS TRIANGLE.', insertText: 'IS TRIANGLE.', kind: 'waveform', detail: 'Define onda TRIANGLE' },
    ];
  }

  if (/\bTEMPO\s*$/.test(upperLine)) {
    return [
      { label: 'IS 120 BPM.', insertText: 'IS 120 BPM.', kind: 'command', detail: 'Define 120 BPM' },
      { label: 'IS 128 BPM.', insertText: 'IS 128 BPM.', kind: 'command', detail: 'Define 128 BPM' },
      { label: 'IS 92 BPM.', insertText: 'IS 92 BPM.', kind: 'command', detail: 'Define 92 BPM' },
    ];
  }

  if (/\bTEMPO\s+(?:IS|TO)\s+\d+(?:\.\d+)?\s*$/.test(upperLine)) {
    return [{ label: 'BPM.', insertText: 'BPM.', kind: 'keyword', detail: 'Unidade batidas por minuto' }];
  }

  if (/\bFILTER\s+(?:IS|TO)\s*$/.test(upperLine)) {
    return [
      { label: 'LOWPASS 900 HZ Q 2.', insertText: 'LOWPASS 900 HZ Q 2.', kind: 'command', detail: 'Corta frequências agudas' },
      { label: 'HIGHPASS 450 HZ.', insertText: 'HIGHPASS 450 HZ.', kind: 'command', detail: 'Corta frequências graves' },
      { label: 'BANDPASS 1200 HZ Q 3.', insertText: 'BANDPASS 1200 HZ Q 3.', kind: 'command', detail: 'Isola faixa média de frequência' },
      { label: 'OFF.', insertText: 'OFF.', kind: 'keyword', detail: 'Desativa filtro' },
    ];
  }

  if (/\bDELAY\s*$/.test(upperLine)) {
    return [
      { label: 'IS 30 PERCENT TIME 0.3 SEC FEEDBACK 40 PERCENT.', insertText: 'IS 30 PERCENT TIME 0.3 SEC FEEDBACK 40 PERCENT.', kind: 'command', detail: 'Configura eco estéreo' },
      { label: 'IS OFF.', insertText: 'IS OFF.', kind: 'keyword', detail: 'Desativa delay' },
    ];
  }

  if (/\bREVERB\s*$/.test(upperLine)) {
    return [
      { label: 'IS 35 PERCENT.', insertText: 'IS 35 PERCENT.', kind: 'command', detail: 'Adiciona ambiência procedural' },
      { label: 'IS OFF.', insertText: 'IS OFF.', kind: 'keyword', detail: 'Desativa reverb' },
    ];
  }

  if (/\bDETUNE\s*$/.test(upperLine)) {
    return [
      { label: 'IS 12 CENTS.', insertText: 'IS 12 CENTS.', kind: 'command', detail: 'Adiciona espessura unison' },
      { label: 'IS OFF.', insertText: 'IS OFF.', kind: 'keyword', detail: 'Desativa detune' },
    ];
  }

  return GENERAL_ITEMS;
}

function extractDeclaredSections(code: string): string[] {
  const seen = new Set<string>();
  const regex = /^\s*(?:([A-Za-z0-9_-]+)\s+SECTION|SECTION\s+([A-Za-z0-9_-]+))\s*\./gim;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(code)) !== null) {
    const raw = (match[1] ?? match[2] ?? '').toUpperCase();
    if (raw && raw !== 'PROCEDURES' && raw !== 'PROCEDURE' && raw !== 'PATTERNS') {
      seen.add(raw);
    }
  }
  return Array.from(seen);
}

const COMMON_CHORD_ITEMS: AutocompleteItem[] = [
  { label: 'Cmaj7', insertText: 'Cmaj7', kind: 'note', detail: 'Acorde Dó maior com 7ª maior' },
  { label: 'Am7', insertText: 'Am7', kind: 'note', detail: 'Acorde Lá menor com 7ª' },
  { label: 'Fmaj7', insertText: 'Fmaj7', kind: 'note', detail: 'Acorde Fá maior com 7ª maior' },
  { label: 'G7', insertText: 'G7', kind: 'note', detail: 'Acorde Sol dominante' },
  { label: 'Dm7', insertText: 'Dm7', kind: 'note', detail: 'Acorde Ré menor com 7ª' },
  { label: 'Em7', insertText: 'Em7', kind: 'note', detail: 'Acorde Mi menor com 7ª' },
  { label: 'F#m7', insertText: 'F#m7', kind: 'note', detail: 'Acorde Fá# menor com 7ª' },
  { label: 'Bb', insertText: 'Bb', kind: 'note', detail: 'Acorde Si bemol maior' },
];

const PHASE1_GENERAL_ITEMS: AutocompleteItem[] = [
  { label: 'MAYBE 50 PERCENT PLAY ...', insertText: 'MAYBE 50 PERCENT PLAY DRUM KICK FOR 1 BEAT.', kind: 'snippet', detail: 'Execução probabilística (0–100%)' },
  { label: 'CHOOSE ONE OF (...)', insertText: 'PLAY CHOOSE ONE OF (C4, E4, G4, B4) FOR 0.5 BEATS.', kind: 'snippet', detail: 'Sorteia uma nota ou tambor por ciclo' },
  { label: 'PATTERN KICK IS "..."', insertText: 'PATTERN KICK IS "x... x... x..x ....".', kind: 'snippet', detail: 'Step sequencer inline (x, X, o, .)' },
  { label: 'RAMP FILTER FROM ...', insertText: 'RAMP FILTER FROM 200 TO 4000 OVER 8 BEATS.', kind: 'snippet', detail: 'Automação temporal de parâmetro' },
  { label: 'HUMANIZE 12 MS.', insertText: 'HUMANIZE 12 MS VELOCITY 15 PERCENT.', kind: 'command', detail: 'Micro-variação de tempo e dinâmica' },
  { label: 'SWING IS 55 PERCENT.', insertText: 'SWING IS 55 PERCENT.', kind: 'command', detail: 'Groove / atraso nos contratempos' },
];

export function getAutocompleteSuggestions(
  code: string,
  cursorIndex: number,
  forceOpen: boolean,
  extraContext?: AutocompleteContext,
): AutocompleteResult | null {
  const beforeCursor = code.slice(0, cursorIndex);
  const lastNewline = beforeCursor.lastIndexOf('\n');
  const lineIndex = beforeCursor.split('\n').length - 1;
  const currentLineBeforeCursor = beforeCursor.slice(lastNewline + 1);

  // Do not trigger inside comments or unclosed strings
  const trimmedLine = currentLineBeforeCursor.trimStart();
  if (
    trimmedLine.startsWith('*>') ||
    trimmedLine.startsWith('--') ||
    trimmedLine.startsWith('*')
  ) {
    return null;
  }

  const wordMatch = /([A-Za-z0-9#_-]+)$/.exec(currentLineBeforeCursor);
  const prefix = wordMatch ? wordMatch[1] : '';
  const startOffset = cursorIndex - prefix.length;
  const lineBeforeWord = currentLineBeforeCursor.slice(0, currentLineBeforeCursor.length - prefix.length);

  if (!forceOpen && prefix.length === 0) {
    return null;
  }

  const declaredControls = extractDeclaredControls(code);
  const sectionNames = Array.from(
    new Set([...(extraContext?.definedSections ?? []), ...extractDeclaredSections(code)]),
  );
  const sectionItems: AutocompleteItem[] = sectionNames.map((name) => ({
    label: name,
    insertText: `${name}.`,
    kind: 'snippet',
    detail: 'SECTION declarada no código',
  }));
  const sampleItems: AutocompleteItem[] = (extraContext?.sampleNames ?? []).map((name) => ({
    label: `"${name}"`,
    insertText: `"${name}" FOR 8 BEATS.`,
    kind: 'snippet',
    detail: 'Sample salvo no IndexedDB',
  }));

  const upperBeforeWord = lineBeforeWord.toUpperCase();
  let contextItems: AutocompleteItem[];
  if (/\bPERFORM\s*$/.test(upperBeforeWord) && sectionItems.length > 0) {
    contextItems = sectionItems;
  } else if (/\bPLAY\s+SAMPLE\s*$/.test(upperBeforeWord) && sampleItems.length > 0) {
    contextItems = sampleItems;
  } else if (/\bPLAY\s+CHORD(?:S)?\s*$/.test(upperBeforeWord) || /\bARPEGGIATE\s*$/.test(upperBeforeWord)) {
    contextItems = COMMON_CHORD_ITEMS;
  } else {
    contextItems = getContextItems(lineBeforeWord, declaredControls);
  }

  const upperPrefix = prefix.toUpperCase();
  const searchableGeneral = [
    ...declaredControls,
    ...sectionItems,
    ...sampleItems,
    ...PHASE1_GENERAL_ITEMS,
    ...COMMON_CHORD_ITEMS,
    ...GENERAL_ITEMS,
  ];

  const filtered = prefix
    ? contextItems.filter(
        (item) =>
          item.label.toUpperCase().startsWith(upperPrefix) ||
          item.insertText.toUpperCase().startsWith(upperPrefix),
      )
    : contextItems;

  // Fallback to general items if context-specific filter matched nothing
  const finalItems =
    filtered.length > 0 || !prefix
      ? filtered
      : searchableGeneral.filter(
          (item) =>
            item.label.toUpperCase().startsWith(upperPrefix) ||
            item.insertText.toUpperCase().startsWith(upperPrefix),
        );

  // Avoid showing popup when the typed word already matches the only suggestion verbatim
  if (
    !forceOpen &&
    finalItems.length === 1 &&
    finalItems[0].insertText.toUpperCase() === upperPrefix
  ) {
    return null;
  }

  if (finalItems.length === 0) {
    return null;
  }

  return {
    prefix,
    startOffset,
    endOffset: cursorIndex,
    lineIndex,
    columnIndex: currentLineBeforeCursor.length,
    items: finalItems.slice(0, 10),
  };
}

const HOVER_DOCS: Record<string, HoverDoc> = {
  PERFORM: {
    title: 'PERFORM',
    syntax: 'PERFORM <SECTION> [<N> TIMES].',
    description: 'Executa uma sub-rotina declarada na PROCEDURES DIVISION.',
  },
  ARPEGGIATE: {
    title: 'ARPEGGIATE',
    syntax: 'ARPEGGIATE <ACORDE> UP | DOWN | UP-DOWN FOR <N> BEATS.',
    description: 'Quebra um acorde ou lista de notas em sequência arpejada.',
  },
  EUCLIDEAN: {
    title: 'PLAY EUCLIDEAN',
    syntax: 'PLAY EUCLIDEAN <DRUM|NOTA> <PULSOS> IN <PASSOS> FOR <N> BEATS.',
    description: 'Gera ritmo euclidiano (algoritmo de Bjorklund) distribuindo pulsos uniformemente.',
  },
  MAYBE: {
    title: 'MAYBE',
    syntax: 'MAYBE <0..100> PERCENT <COMANDO>.',
    description: 'Executa o comando de forma probabilística a cada ciclo do loop.',
  },
  CHOOSE: {
    title: 'CHOOSE ONE OF',
    syntax: 'PLAY CHOOSE ONE OF (C4, E4, G4) FOR <N> BEATS.',
    description: 'Escolhe aleatoriamente uma nota ou tambor da lista a cada ciclo.',
  },
  PATTERN: {
    title: 'PATTERN',
    syntax: 'PATTERN <DRUM|NOTA> IS "x..x..x." [STEP <N> BEATS | FOR <N> BEATS].',
    description: 'Step sequencer inline: x = normal, X/* = acento, o = ghost, ./- = pausa.',
  },
  RAMP: {
    title: 'RAMP / AUTOMATE',
    syntax: 'RAMP <FILTER|VOLUME|PAN|REVERB|DELAY|TEMPO> FROM <A> TO <B> OVER <N> BEATS.',
    description: 'Automatiza um parâmetro continuamente ao longo de N beats.',
  },
  AUTOMATE: {
    title: 'AUTOMATE / RAMP',
    syntax: 'AUTOMATE <PARAM> FROM <A> TO <B> OVER <N> BEATS.',
    description: 'Alias para RAMP: cria curva temporal de automação.',
  },
  HUMANIZE: {
    title: 'HUMANIZE',
    syntax: 'HUMANIZE <N> MS [VELOCITY <%> PERCENT]. | HUMANIZE OFF.',
    description: 'Adiciona micro-variações orgânicas de tempo e volume.',
  },
  SWING: {
    title: 'SWING',
    syntax: 'SWING IS <0..100> PERCENT. | SWING OFF.',
    description: 'Atrasa os contratempos para criar groove/balanço.',
  },
  CONTROL: {
    title: 'CONTROL (Slider)',
    syntax: 'CONTROL <NOME> IS SLIDER <DEF> FROM <MIN> TO <MAX>.',
    description: 'Cria um slider interativo em tempo real no editor e no Track Mixer.',
  },
  SAMPLE: {
    title: 'PLAY SAMPLE',
    syntax: 'PLAY SAMPLE "<arquivo>" [RATE <N>] [OFFSET <S> SEC] FOR <N> BEATS.',
    description: 'Toca um áudio importado do IndexedDB sincronizado com os efeitos da track.',
  },
};

export function getHoverDoc(word: string): HoverDoc | null {
  const key = word.trim().toUpperCase();
  if (!key) return null;
  return HOVER_DOCS[key] ?? null;
}

export function getQuickFixForDiagnostic(
  diag: CompilationDiagnostic,
  lineText: string,
): QuickFixAction | null {
  const msg = diag.message.toLowerCase();
  const trimmed = lineText.trimEnd();

  if (
    (msg.includes('ponto final') || msg.includes('esperado "."') || msg.includes('"."')) &&
    trimmed.length > 0 &&
    !trimmed.endsWith('.')
  ) {
    return {
      label: 'Adicionar "." no final da linha',
      newLineText: `${trimmed}.`,
    };
  }

  if (msg.includes('end-track')) {
    return {
      label: 'Adicionar "END-TRACK."',
      newLineText: `${lineText}\n  END-TRACK.`,
    };
  }

  if (msg.includes('end-repeat')) {
    return {
      label: 'Adicionar "END-REPEAT."',
      newLineText: `${lineText}\n  END-REPEAT.`,
    };
  }

  if (msg.includes('end-section')) {
    return {
      label: 'Adicionar "END-SECTION."',
      newLineText: `${lineText}\n  END-SECTION.`,
    };
  }

  return null;
}
