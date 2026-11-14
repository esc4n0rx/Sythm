import type { IParser, ParserResult } from '../../application/ports/IParser.js';
import type {
  ArpDirection,
  DivisionKind,
  DivisionNode,
  DrumType,
  FilterMode,
  InlineSliderValue,
  NumericParamValue,
  PlayChordEntry,
  ProgramNode,
  ScaleMode,
  StatementNode,
  VisualizerMode,
  WaveformType,
} from '../../domain/entities/Ast.js';
import type { CompilationDiagnostic } from '../../domain/entities/ExecutionPlan.js';
import { type Token, TokenType } from '../../domain/entities/Token.js';
import { ChordParser } from '../../domain/value-objects/ChordParser.js';

const DIVISION_KIND_MAP: Partial<Record<TokenType, DivisionKind>> = {
  HEADER: 'HEADER',
  IDENTIFICATION: 'HEADER',
  CONFIG: 'CONFIG',
  ENVIRONMENT: 'CONFIG',
  PLAY: 'PLAY',
  PROCEDURE: 'PLAY',
  PROCEDURES: 'PLAY',
  PATTERNS: 'PLAY',
  TRACK: 'PLAY',
};

const WAVEFORM_MAP: Partial<Record<TokenType, WaveformType>> = {
  SINE: 'sine',
  SQUARE: 'square',
  SAW: 'sawtooth',
  SAWTOOTH: 'sawtooth',
  TRIANGLE: 'triangle',
  FM_KEYS: 'fm-keys',
  ACID_BASS: 'acid-bass',
  PLUCK: 'pluck',
  SUB_808: 'sub-808',
  PAD_WARM: 'pad-warm',
};

const FILTER_MODE_MAP: Partial<Record<TokenType, FilterMode>> = {
  LOWPASS: 'lowpass',
  HIGHPASS: 'highpass',
  BANDPASS: 'bandpass',
};

const SCALE_MODE_MAP: Partial<Record<TokenType, ScaleMode>> = {
  MAJOR: 'major',
  MINOR: 'minor',
  DORIAN: 'dorian',
  PHRYGIAN: 'phrygian',
  PENTATONIC: 'pentatonic',
};

const STATEMENT_START_TOKENS = new Set<TokenType>([
  TokenType.PROGRAM_ID,
  TokenType.TITLE,
  TokenType.AUTHOR,
  TokenType.CONTROL,
  TokenType.SLIDER,
  TokenType.DEFINE,
  TokenType.SET,
  TokenType.TEMPO,
  TokenType.WAVE,
  TokenType.INSTRUMENT,
  TokenType.VOLUME,
  TokenType.VISUALIZER,
  TokenType.FILTER,
  TokenType.DELAY,
  TokenType.REVERB,
  TokenType.ENVELOPE,
  TokenType.ATTACK,
  TokenType.DECAY,
  TokenType.SUSTAIN,
  TokenType.RELEASE,
  TokenType.DETUNE,
  TokenType.PAN,
  TokenType.LFO,
  TokenType.SWEEP,
  TokenType.TRANSPOSE,
  TokenType.SCALE,
  TokenType.PLAY,
  TokenType.ARPEGGIATE,
  TokenType.ARP,
  TokenType.REST,
  TokenType.REPEAT,
  TokenType.TRACK,
  TokenType.SECTION,
  TokenType.PERFORM,
  TokenType.PRINT,
  TokenType.DISPLAY,
]);

export class CobolStyleParser implements IParser {
  private tokens: Token[] = [];
  private current = 0;
  private diagnostics: CompilationDiagnostic[] = [];

  parse(tokens: Token[]): ParserResult {
    this.tokens = tokens;
    this.current = 0;
    this.diagnostics = [];

    const divisions: DivisionNode[] = [];
    const looseStatements: StatementNode[] = [];

    while (!this.isAtEnd()) {
      if (this.check(TokenType.DOT)) {
        this.advance();
        continue;
      }

      if (this.isDivisionStart()) {
        const division = this.parseDivision();
        if (division) {
          divisions.push(division);
        }
        continue;
      }

      const stmt = this.parseStatement();
      if (stmt) {
        looseStatements.push(stmt);
      }
    }

    const ast: ProgramNode = {
      kind: 'Program',
      divisions,
      statements: looseStatements,
    };

    return {
      ast,
      diagnostics: this.diagnostics,
    };
  }

  private isDivisionStart(): boolean {
    const first = this.peek().type;
    const second = this.peekNext().type;
    if (!(first in DIVISION_KIND_MAP)) {
      return false;
    }
    if (second === TokenType.DIVISION) {
      return true;
    }
    // Note: TRACK SECTION. is a division header, whereas TRACK BASS SECTION. is a Track statement
    return first !== TokenType.TRACK && second === TokenType.SECTION;
  }

  private isTrackStart(): boolean {
    return this.peek().type === TokenType.TRACK && !this.isDivisionStart();
  }

  private isSectionStart(): boolean {
    if (this.isDivisionStart()) {
      return false;
    }
    const first = this.peek().type;
    const second = this.peekNext().type;
    if (first === TokenType.SECTION) {
      return true;
    }
    return first === TokenType.IDENTIFIER && second === TokenType.SECTION;
  }

  private parseDivision(): DivisionNode | null {
    const headToken = this.advance();
    const kindToken = this.advance(); // DIVISION or SECTION
    const divisionType = DIVISION_KIND_MAP[headToken.type] ?? 'PLAY';
    const name = `${headToken.lexeme.toUpperCase()} ${kindToken.lexeme.toUpperCase()}`;

    if (!this.match(TokenType.DOT)) {
      this.reportError(
        headToken,
        `Esperado ponto final "." após "${name}".`,
      );
    }

    const statements: StatementNode[] = [];
    while (!this.isAtEnd() && !this.isDivisionStart()) {
      if (this.check(TokenType.DOT)) {
        this.advance();
        continue;
      }
      const stmt = this.parseStatement();
      if (stmt) {
        statements.push(stmt);
      }
    }

    return {
      kind: 'Division',
      divisionType,
      name,
      statements,
      line: headToken.line,
      column: headToken.column,
    };
  }

  private parseStatement(): StatementNode | null {
    const token = this.peek();

    try {
      if (
        token.type === TokenType.PROGRAM_ID ||
        token.type === TokenType.TITLE ||
        token.type === TokenType.AUTHOR
      ) {
        return this.parseMetadataStatement();
      }

      if (
        token.type === TokenType.CONTROL ||
        token.type === TokenType.DEFINE ||
        token.type === TokenType.SLIDER
      ) {
        return this.parseControlDeclarationStatement();
      }

      if (token.type === TokenType.SET) {
        this.advance();
        return this.parseConfigAfterOptionalSet(token);
      }

      if (
        token.type === TokenType.TEMPO ||
        token.type === TokenType.WAVE ||
        token.type === TokenType.INSTRUMENT ||
        token.type === TokenType.VOLUME ||
        token.type === TokenType.VISUALIZER ||
        token.type === TokenType.FILTER ||
        token.type === TokenType.DELAY ||
        token.type === TokenType.REVERB ||
        token.type === TokenType.ENVELOPE ||
        token.type === TokenType.ATTACK ||
        token.type === TokenType.DECAY ||
        token.type === TokenType.SUSTAIN ||
        token.type === TokenType.RELEASE ||
        token.type === TokenType.DETUNE ||
        token.type === TokenType.PAN ||
        token.type === TokenType.LFO ||
        token.type === TokenType.SWEEP ||
        token.type === TokenType.TRANSPOSE ||
        token.type === TokenType.SCALE
      ) {
        return this.parseConfigAfterOptionalSet(token);
      }

      if (this.isSectionStart()) {
        return this.parseSectionStatement();
      }

      if (token.type === TokenType.PERFORM) {
        return this.parsePerformStatement();
      }

      if (token.type === TokenType.PLAY) {
        return this.parsePlayStatement();
      }

      if (token.type === TokenType.ARPEGGIATE || token.type === TokenType.ARP) {
        return this.parseArpeggiateStatement();
      }

      if (token.type === TokenType.REST) {
        return this.parseRestStatement();
      }

      if (token.type === TokenType.REPEAT) {
        return this.parseRepeatStatement();
      }

      if (token.type === TokenType.TRACK) {
        return this.parseTrackStatement();
      }

      if (token.type === TokenType.PRINT || token.type === TokenType.DISPLAY) {
        return this.parsePrintStatement();
      }

      this.reportError(
        token,
        `Comando desconhecido ou inesperado "${token.lexeme || token.type}".`,
      );
      this.synchronize();
      return null;
    } catch {
      this.synchronize();
      return null;
    }
  }

  private parseMetadataStatement(): StatementNode {
    const keyToken = this.advance();
    const key = keyToken.lexeme.toUpperCase();

    if (keyToken.type === TokenType.PROGRAM_ID) {
      // Accepts: PROGRAM-ID. MY-TRACK. or PROGRAM-ID IS "My Track".
      this.match(TokenType.DOT);
      this.match(TokenType.IS);
    } else {
      this.match(TokenType.IS);
    }

    let value = '';
    if (this.check(TokenType.STRING)) {
      const strToken = this.advance();
      value = String(strToken.literal ?? strToken.lexeme);
    } else if (this.check(TokenType.IDENTIFIER) || this.check(TokenType.NUMBER)) {
      const valToken = this.advance();
      value = valToken.lexeme;
    } else {
      this.reportError(
        this.peek(),
        `Esperado texto ou identificador para "${key}".`,
      );
      throw new Error('ParseError');
    }

    this.expectSentenceEnd(keyToken);

    return {
      kind: 'MetadataStatement',
      key,
      value,
      line: keyToken.line,
      column: keyToken.column,
    };
  }

  private parseControlDeclarationStatement(): StatementNode {
    const originToken = this.advance(); // CONTROL, DEFINE, or SLIDER
    if (originToken.type === TokenType.DEFINE) {
      this.match(TokenType.CONTROL, TokenType.SLIDER);
    }

    const nameToken = this.peek();
    if (nameToken.type !== TokenType.IDENTIFIER && nameToken.type !== TokenType.STRING) {
      this.reportError(
        nameToken,
        'Esperado nome do controle (ex: CONTROL VOL-BASS IS SLIDER 65 FROM 0 TO 100.).',
      );
      throw new Error('ParseError');
    }

    this.advance();
    const controlName =
      nameToken.type === TokenType.STRING
        ? String(nameToken.literal ?? nameToken.lexeme).toUpperCase()
        : nameToken.lexeme.toUpperCase();

    this.match(TokenType.IS, TokenType.TO);
    this.match(TokenType.SLIDER);

    const spec = this.parseSliderSpec(originToken);
    // Optional trailing unit keyword (e.g. HZ, BPM, PERCENT, CENTS, SEC)
    this.match(
      TokenType.PERCENT,
      TokenType.HZ,
      TokenType.BPM,
      TokenType.CENTS,
      TokenType.SEC,
    );
    this.expectSentenceEnd(originToken);

    return {
      kind: 'ControlStatement',
      name: controlName,
      defaultValue: spec.defaultValue,
      min: spec.min,
      max: spec.max,
      step: spec.step,
      line: originToken.line,
      column: originToken.column,
    };
  }

  private parseSliderSpec(
    originToken: Token,
    suggestedMin?: number,
    suggestedMax?: number,
    suggestedStep?: number,
  ): InlineSliderValue {
    let defaultValue: number | undefined;
    let min: number | undefined;
    let max: number | undefined;
    let step: number | undefined;

    if (this.check(TokenType.NUMBER) && typeof this.peek().literal === 'number') {
      defaultValue = Number(this.advance().literal);
    }

    while (
      this.check(TokenType.FROM) ||
      this.check(TokenType.DEFAULT) ||
      this.check(TokenType.STEP)
    ) {
      if (this.match(TokenType.FROM)) {
        const minToken = this.consumeNumber('Esperado valor mínimo numérico após FROM.');
        if (!this.match(TokenType.TO)) {
          this.reportError(
            this.peek(),
            'Esperado palavra-chave TO após o valor mínimo (ex: FROM 0 TO 100).',
          );
          throw new Error('ParseError');
        }
        const maxToken = this.consumeNumber('Esperado valor máximo numérico após TO.');
        min = Number(minToken.literal);
        max = Number(maxToken.literal);
      } else if (this.match(TokenType.DEFAULT)) {
        this.match(TokenType.IS, TokenType.TO);
        const defToken = this.consumeNumber('Esperado valor numérico padrão após DEFAULT.');
        defaultValue = Number(defToken.literal);
      } else if (this.match(TokenType.STEP)) {
        this.match(TokenType.IS, TokenType.TO);
        const stepToken = this.consumeNumber('Esperado incremento numérico após STEP.');
        step = Number(stepToken.literal);
      }
    }

    if (defaultValue === undefined && (min === undefined || max === undefined)) {
      this.reportError(
        this.peek(),
        'Esperado valor inicial ou faixa FROM <min> TO <max> para o SLIDER.',
      );
      throw new Error('ParseError');
    }

    if (min === undefined || max === undefined) {
      const def = defaultValue!;
      if (suggestedMin !== undefined && suggestedMax !== undefined) {
        if (suggestedMin === 0 && suggestedMax === 100 && def > 0 && def <= 1) {
          min = 0;
          max = 1;
        } else {
          min = Math.min(suggestedMin, def);
          max = Math.max(suggestedMax, def);
        }
      } else {
        min = Math.min(0, def);
        max = def > 0 && def <= 1 ? 1 : def <= 100 ? 100 : Math.ceil(def * 2);
      }
    }

    if (min > max) {
      const swap = min;
      min = max;
      max = swap;
    }

    if (min === max) {
      max = min + 1;
    }

    const resolvedDefault =
      defaultValue === undefined
        ? Math.round(((min + max) / 2) * 100) / 100
        : Math.min(max, Math.max(min, defaultValue));

    const resolvedStep =
      step && step > 0
        ? step
        : suggestedStep && min === suggestedMin && max === suggestedMax
          ? suggestedStep
          : this.inferSliderStep(min, max, resolvedDefault);

    return {
      kind: 'inlineSlider',
      defaultValue: resolvedDefault,
      min,
      max,
      step: resolvedStep,
      line: originToken.line,
    };
  }

  private inferSliderStep(min: number, max: number, defaultValue: number): number {
    const hasDecimal = (value: number): boolean => Math.abs(value - Math.round(value)) > 1e-9;
    const span = Math.abs(max - min);
    if (span <= 2) return 0.01;
    if (span <= 25 && (hasDecimal(defaultValue) || hasDecimal(min) || hasDecimal(max))) {
      return 0.1;
    }
    if (hasDecimal(defaultValue)) return 0.1;
    return 1;
  }

  private parseConfigAfterOptionalSet(originToken: Token): StatementNode {
    const target = this.peek();

    if (target.type === TokenType.TEMPO) {
      this.advance();
      this.match(TokenType.IS, TokenType.TO);
      const bpm = this.consumeNumericOrControl(
        'Esperado valor numérico de BPM, SLIDER ou CONTROL após TEMPO.',
        40,
        240,
        1,
      );
      this.match(TokenType.BPM);
      this.expectSentenceEnd(originToken);
      return {
        kind: 'TempoStatement',
        bpm: bpm.value,
        bpmControl: bpm.control,
        line: originToken.line,
        column: originToken.column,
      };
    }

    if (target.type === TokenType.WAVE || target.type === TokenType.INSTRUMENT) {
      this.advance();
      this.match(TokenType.IS, TokenType.TO);
      const waveToken = this.peek();
      const waveform = WAVEFORM_MAP[waveToken.type];
      if (!waveform) {
        this.reportError(
          waveToken,
          `Forma de onda inválida "${waveToken.lexeme}". Use SINE, SQUARE, SAW ou TRIANGLE.`,
        );
        throw new Error('ParseError');
      }
      this.advance();
      this.expectSentenceEnd(originToken);
      return {
        kind: 'WaveStatement',
        waveform,
        line: originToken.line,
        column: originToken.column,
      };
    }

    if (target.type === TokenType.VOLUME) {
      this.advance();
      this.match(TokenType.IS, TokenType.TO);
      const vol = this.consumeNumericOrControl(
        'Esperado valor numérico (0 a 100), SLIDER ou CONTROL após VOLUME.',
        0,
        100,
        1,
      );
      this.match(TokenType.PERCENT);
      this.expectSentenceEnd(originToken);
      return {
        kind: 'VolumeStatement',
        volume: vol.value,
        volumeControl: vol.control,
        line: originToken.line,
        column: originToken.column,
      };
    }

    if (target.type === TokenType.FILTER) {
      return this.parseFilterStatement(originToken);
    }

    if (target.type === TokenType.DELAY) {
      return this.parseDelayStatement(originToken);
    }

    if (target.type === TokenType.REVERB) {
      return this.parseReverbStatement(originToken);
    }

    if (
      target.type === TokenType.ENVELOPE ||
      target.type === TokenType.ATTACK ||
      target.type === TokenType.DECAY ||
      target.type === TokenType.SUSTAIN ||
      target.type === TokenType.RELEASE
    ) {
      return this.parseEnvelopeStatement(originToken);
    }

    if (target.type === TokenType.DETUNE) {
      return this.parseDetuneStatement(originToken);
    }

    if (target.type === TokenType.VISUALIZER) {
      return this.parseVisualizerStatement(originToken);
    }

    if (target.type === TokenType.TRANSPOSE) {
      return this.parseTransposeStatement(originToken);
    }

    if (target.type === TokenType.SCALE) {
      return this.parseScaleStatement(originToken);
    }

    if (target.type === TokenType.PAN) {
      return this.parsePanStatement(originToken);
    }

    if (target.type === TokenType.LFO) {
      return this.parseLfoStatement(originToken);
    }

    if (target.type === TokenType.SWEEP) {
      return this.parseSweepStatement(originToken);
    }

    this.reportError(
      target,
      `Comando de configuração inesperado "${target.lexeme}" após SET.`,
    );
    throw new Error('ParseError');
  }

  private parseFilterStatement(originToken: Token): StatementNode {
    this.advance(); // FILTER
    this.match(TokenType.IS, TokenType.TO);

    if (this.match(TokenType.OFF)) {
      this.expectSentenceEnd(originToken);
      return {
        kind: 'FilterStatement',
        mode: 'off',
        frequencyHz: 20000,
        q: 1,
        line: originToken.line,
        column: originToken.column,
      };
    }

    const modeToken = this.peek();
    const mode = FILTER_MODE_MAP[modeToken.type];
    if (!mode) {
      this.reportError(
        modeToken,
        `Modo de filtro inválido "${modeToken.lexeme}". Use LOWPASS, HIGHPASS, BANDPASS ou OFF.`,
      );
      throw new Error('ParseError');
    }
    this.advance();

    this.match(TokenType.AT, TokenType.IS, TokenType.TO);
    const freq = this.consumeNumericOrControl(
      'Esperada frequência em HZ, SLIDER ou CONTROL após modo do FILTER.',
      20,
      8000,
      1,
    );
    this.match(TokenType.HZ);

    let q = 1;
    let qControl: NumericParamValue | undefined;
    if (this.match(TokenType.Q)) {
      this.match(TokenType.IS, TokenType.TO);
      const qParam = this.consumeNumericOrControl(
        'Esperado valor numérico, SLIDER ou CONTROL de ressonância após Q.',
        0.1,
        20,
        0.1,
      );
      q = qParam.value;
      qControl = qParam.control;
    }

    this.expectSentenceEnd(originToken);
    return {
      kind: 'FilterStatement',
      mode,
      frequencyHz: freq.value,
      q,
      frequencyControl: freq.control,
      qControl,
      line: originToken.line,
      column: originToken.column,
    };
  }

  private parseDelayStatement(originToken: Token): StatementNode {
    this.advance(); // DELAY
    this.match(TokenType.IS, TokenType.TO);

    if (this.match(TokenType.OFF)) {
      this.expectSentenceEnd(originToken);
      return {
        kind: 'DelayStatement',
        mix: 0,
        line: originToken.line,
        column: originToken.column,
      };
    }

    const mixParam = this.consumePercentOrControl(
      'Esperado percentual, SLIDER ou CONTROL após DELAY.',
      100,
      1,
    );
    let timeSec: number | undefined;
    let timeControl: NumericParamValue | undefined;
    let feedback: number | undefined;
    let feedbackControl: NumericParamValue | undefined;

    while (this.check(TokenType.TIME) || this.check(TokenType.FEEDBACK)) {
      if (this.match(TokenType.TIME)) {
        this.match(TokenType.IS, TokenType.TO);
        const timeParam = this.consumeNumericOrControl(
          'Esperado tempo em segundos, SLIDER ou CONTROL após TIME.',
          0.02,
          2.0,
          0.01,
        );
        this.match(TokenType.SEC);
        timeSec = timeParam.value;
        timeControl = timeParam.control;
        continue;
      }
      if (this.match(TokenType.FEEDBACK)) {
        this.match(TokenType.IS, TokenType.TO);
        const fbParam = this.consumePercentOrControl(
          'Esperado valor de feedback, SLIDER ou CONTROL após FEEDBACK.',
          88,
          1,
        );
        feedback = fbParam.mix;
        feedbackControl = fbParam.control;
      }
    }

    this.expectSentenceEnd(originToken);
    return {
      kind: 'DelayStatement',
      mix: mixParam.mix,
      timeSec,
      feedback,
      mixControl: mixParam.control,
      timeControl,
      feedbackControl,
      line: originToken.line,
      column: originToken.column,
    };
  }

  private parseReverbStatement(originToken: Token): StatementNode {
    this.advance(); // REVERB
    this.match(TokenType.IS, TokenType.TO);

    if (this.match(TokenType.OFF)) {
      this.expectSentenceEnd(originToken);
      return {
        kind: 'ReverbStatement',
        mix: 0,
        line: originToken.line,
        column: originToken.column,
      };
    }

    const mixParam = this.consumePercentOrControl(
      'Esperado percentual, SLIDER ou CONTROL após REVERB.',
      100,
      1,
    );
    this.expectSentenceEnd(originToken);
    return {
      kind: 'ReverbStatement',
      mix: mixParam.mix,
      mixControl: mixParam.control,
      line: originToken.line,
      column: originToken.column,
    };
  }

  private parseEnvelopeStatement(originToken: Token): StatementNode {
    let attackSec: number | undefined;
    let decaySec: number | undefined;
    let sustainLevel: number | undefined;
    let releaseSec: number | undefined;

    if (this.match(TokenType.ENVELOPE)) {
      this.match(TokenType.IS, TokenType.TO);
    }

    let matchedAny = false;
    while (
      this.check(TokenType.ATTACK) ||
      this.check(TokenType.DECAY) ||
      this.check(TokenType.SUSTAIN) ||
      this.check(TokenType.RELEASE)
    ) {
      matchedAny = true;
      if (this.match(TokenType.ATTACK)) {
        this.match(TokenType.IS, TokenType.TO);
        const val = this.consumeNumber('Esperado tempo em segundos após ATTACK.');
        this.match(TokenType.SEC);
        attackSec = Number(val.literal);
      } else if (this.match(TokenType.DECAY)) {
        this.match(TokenType.IS, TokenType.TO);
        const val = this.consumeNumber('Esperado tempo em segundos após DECAY.');
        this.match(TokenType.SEC);
        decaySec = Number(val.literal);
      } else if (this.match(TokenType.SUSTAIN)) {
        this.match(TokenType.IS, TokenType.TO);
        sustainLevel = this.consumePercentOrUnit('Esperado nível após SUSTAIN.');
      } else if (this.match(TokenType.RELEASE)) {
        this.match(TokenType.IS, TokenType.TO);
        const val = this.consumeNumber('Esperado tempo em segundos após RELEASE.');
        this.match(TokenType.SEC);
        releaseSec = Number(val.literal);
      }
    }

    if (!matchedAny) {
      this.reportError(
        this.peek(),
        'Esperado ATTACK, DECAY, SUSTAIN ou RELEASE na definição de ENVELOPE.',
      );
      throw new Error('ParseError');
    }

    this.expectSentenceEnd(originToken);
    return {
      kind: 'EnvelopeStatement',
      attackSec,
      decaySec,
      sustainLevel,
      releaseSec,
      line: originToken.line,
      column: originToken.column,
    };
  }

  private parseDetuneStatement(originToken: Token): StatementNode {
    this.advance(); // DETUNE
    this.match(TokenType.IS, TokenType.TO);

    if (this.match(TokenType.OFF)) {
      this.expectSentenceEnd(originToken);
      return {
        kind: 'DetuneStatement',
        cents: 0,
        line: originToken.line,
        column: originToken.column,
      };
    }

    const centsParam = this.consumeNumericOrControl(
      'Esperado valor em cents, SLIDER ou CONTROL após DETUNE.',
      0,
      100,
      1,
    );
    this.match(TokenType.CENTS);
    this.expectSentenceEnd(originToken);
    return {
      kind: 'DetuneStatement',
      cents: centsParam.value,
      centsControl: centsParam.control,
      line: originToken.line,
      column: originToken.column,
    };
  }

  private parseVisualizerStatement(originToken: Token): StatementNode {
    this.advance(); // VISUALIZER
    this.match(TokenType.IS, TokenType.TO);

    let mode: VisualizerMode | null = null;
    if (this.match(TokenType.SCOPE)) mode = 'scope';
    else if (this.match(TokenType.SPECTRUM)) mode = 'spectrum';
    else if (this.match(TokenType.PIANOROLL)) mode = 'pianoroll';
    else if (this.match(TokenType.ALL)) mode = 'all';
    else if (this.match(TokenType.OFF)) mode = 'off';

    if (!mode) {
      const badToken = this.peek();
      this.reportError(
        badToken,
        `Modo de VISUALIZER inválido "${badToken.lexeme}". Use SCOPE, SPECTRUM, PIANOROLL, ALL ou OFF.`,
      );
      throw new Error('ParseError');
    }

    this.expectSentenceEnd(originToken);
    return {
      kind: 'VisualizerStatement',
      mode,
      line: originToken.line,
      column: originToken.column,
    };
  }

  private parseTransposeStatement(originToken: Token): StatementNode {
    this.advance(); // TRANSPOSE
    this.match(TokenType.IS, TokenType.TO);

    let sign = 1;
    if (this.match(TokenType.UP)) {
      sign = 1;
    } else if (this.match(TokenType.DOWN)) {
      sign = -1;
    }

    const numToken = this.consumeNumber(
      'Esperado número de semitons após TRANSPOSE (ex: TRANSPOSE 2. ou TRANSPOSE DOWN 3 SEMITONES.).',
    );
    this.match(TokenType.SEMITONE, TokenType.SEMITONES);
    this.expectSentenceEnd(originToken);

    const semitones = Math.trunc(Number(numToken.literal)) * sign;
    return {
      kind: 'TransposeStatement',
      semitones,
      line: originToken.line,
      column: originToken.column,
    };
  }

  private parseScaleStatement(originToken: Token): StatementNode {
    this.advance(); // SCALE
    this.match(TokenType.IS, TokenType.TO);

    const rootToken = this.peek();
    if (rootToken.type !== TokenType.IDENTIFIER && rootToken.type !== TokenType.NOTE_LITERAL) {
      this.reportError(
        rootToken,
        'Esperada tônica após SCALE (ex: SCALE IS C MINOR. ou SCALE IS F# DORIAN.).',
      );
      throw new Error('ParseError');
    }
    this.advance();

    const rootMatch = /^([A-Ga-g][#bB]?)([0-8])?$/.exec(rootToken.lexeme.trim());
    if (!rootMatch) {
      this.reportError(
        rootToken,
        `Tônica de escala inválida "${rootToken.lexeme}". Use C, C#, Db, D, Eb, F#, G, Bb, etc.`,
      );
      throw new Error('ParseError');
    }

    const rootKey = rootMatch[1].toUpperCase();
    const octave = rootMatch[2] ? Number.parseInt(rootMatch[2], 10) : 4;

    const modeToken = this.peek();
    const mode = SCALE_MODE_MAP[modeToken.type];
    if (!mode) {
      this.reportError(
        modeToken,
        `Modo de escala inválido "${modeToken.lexeme}". Use MAJOR, MINOR, DORIAN, PHRYGIAN ou PENTATONIC.`,
      );
      throw new Error('ParseError');
    }
    this.advance();

    const notes = ChordParser.parseScaleNotes(rootKey, mode, octave);
    if (notes.length === 0) {
      this.reportError(rootToken, `Tônica de escala não reconhecida "${rootToken.lexeme}".`);
      throw new Error('ParseError');
    }

    this.expectSentenceEnd(originToken);
    return {
      kind: 'ScaleStatement',
      root: rootKey,
      mode,
      notes,
      line: originToken.line,
      column: originToken.column,
    };
  }

  private normalizePanValue(raw: number, hasPercent: boolean, min = -100, max = 100): number {
    const usePercentScale =
      hasPercent || Math.abs(min) > 1 || Math.abs(max) > 1 || Math.abs(raw) > 1;
    const scaled = usePercentScale ? raw / 100 : raw;
    return Math.max(-1, Math.min(1, scaled));
  }

  private parsePanStatement(originToken: Token): StatementNode {
    this.advance(); // PAN
    this.match(TokenType.IS, TokenType.TO);

    if (this.match(TokenType.CENTER, TokenType.OFF)) {
      this.expectSentenceEnd(originToken);
      return {
        kind: 'PanStatement',
        pan: 0,
        line: originToken.line,
        column: originToken.column,
      };
    }

    if (this.match(TokenType.LEFT)) {
      let pan = -1;
      if (this.check(TokenType.NUMBER)) {
        const numToken = this.advance();
        const hasPercent = this.match(TokenType.PERCENT);
        pan = -this.normalizePanValue(Math.abs(Number(numToken.literal)), hasPercent);
      }
      this.expectSentenceEnd(originToken);
      return {
        kind: 'PanStatement',
        pan,
        line: originToken.line,
        column: originToken.column,
      };
    }

    if (this.match(TokenType.RIGHT)) {
      let pan = 1;
      if (this.check(TokenType.NUMBER)) {
        const numToken = this.advance();
        const hasPercent = this.match(TokenType.PERCENT);
        pan = this.normalizePanValue(Math.abs(Number(numToken.literal)), hasPercent);
      }
      this.expectSentenceEnd(originToken);
      return {
        kind: 'PanStatement',
        pan,
        line: originToken.line,
        column: originToken.column,
      };
    }

    const panParam = this.consumeNumericOrControl(
      'Esperado LEFT, RIGHT, CENTER, valor (-100 a 100), SLIDER ou CONTROL após PAN.',
      -100,
      100,
      1,
    );
    const hasPercent = this.match(TokenType.PERCENT);
    this.expectSentenceEnd(originToken);

    const min = panParam.control?.kind === 'inlineSlider' ? panParam.control.min : -100;
    const max = panParam.control?.kind === 'inlineSlider' ? panParam.control.max : 100;
    return {
      kind: 'PanStatement',
      pan: this.normalizePanValue(panParam.value, hasPercent, min, max),
      panControl: panParam.control,
      line: originToken.line,
      column: originToken.column,
    };
  }

  private parseLfoStatement(originToken: Token): StatementNode {
    this.advance(); // LFO
    this.match(TokenType.IS, TokenType.TO);

    if (this.match(TokenType.OFF)) {
      this.expectSentenceEnd(originToken);
      return {
        kind: 'LfoStatement',
        mode: 'off',
        rateHz: 0,
        depthHz: 0,
        line: originToken.line,
        column: originToken.column,
      };
    }

    this.match(TokenType.ON);
    let rateHz = 2;
    let depthHz = 600;

    while (this.check(TokenType.RATE) || this.check(TokenType.DEPTH)) {
      if (this.match(TokenType.RATE)) {
        this.match(TokenType.IS, TokenType.TO);
        const rateTok = this.consumeNumber('Esperado valor numérico de frequência em HZ após RATE.');
        rateHz = Math.max(0.05, Math.min(40, Number(rateTok.literal)));
        this.match(TokenType.HZ);
      } else if (this.match(TokenType.DEPTH)) {
        this.match(TokenType.IS, TokenType.TO);
        const depthTok = this.consumeNumber('Esperado valor numérico de profundidade em HZ após DEPTH.');
        depthHz = Math.max(0, Math.min(8000, Number(depthTok.literal)));
        this.match(TokenType.HZ);
      }
    }

    this.expectSentenceEnd(originToken);
    return {
      kind: 'LfoStatement',
      mode: 'on',
      rateHz,
      depthHz,
      line: originToken.line,
      column: originToken.column,
    };
  }

  private parseSweepStatement(originToken: Token): StatementNode {
    this.advance(); // SWEEP
    this.match(TokenType.IS, TokenType.TO);

    if (this.match(TokenType.OFF)) {
      this.expectSentenceEnd(originToken);
      return {
        kind: 'SweepStatement',
        mode: 'off',
        startHz: 400,
        endHz: 2400,
        line: originToken.line,
        column: originToken.column,
      };
    }

    this.match(TokenType.ON);
    this.match(TokenType.FROM);
    const startTok = this.consumeNumber(
      'Esperada frequência inicial em HZ após SWEEP (ex: SWEEP FROM 300 TO 2800 OVER 4 BEATS.).',
    );
    const startHz = Math.max(20, Math.min(18000, Number(startTok.literal)));
    this.match(TokenType.HZ);

    if (!this.match(TokenType.TO)) {
      this.reportError(
        this.peek(),
        'Esperado TO <freq> HZ após frequência inicial do SWEEP.',
      );
      throw new Error('ParseError');
    }

    const endTok = this.consumeNumber('Esperada frequência final em HZ após TO no SWEEP.');
    const endHz = Math.max(20, Math.min(18000, Number(endTok.literal)));
    this.match(TokenType.HZ);

    let durationBeats: number | undefined;
    if (this.match(TokenType.OVER, TokenType.FOR)) {
      const beatsTok = this.consumeNumber('Esperada duração em batidas após OVER/FOR no SWEEP.');
      durationBeats = Math.max(0.05, Number(beatsTok.literal));
      this.match(TokenType.BEAT, TokenType.BEATS);
    }

    this.expectSentenceEnd(originToken);
    return {
      kind: 'SweepStatement',
      mode: 'on',
      startHz,
      endHz,
      durationBeats,
      line: originToken.line,
      column: originToken.column,
    };
  }

  private consumeNumericOrControl(
    message: string,
    defaultMin: number,
    defaultMax: number,
    defaultStep?: number,
  ): { value: number; control?: NumericParamValue } {
    const token = this.peek();

    if (token.type === TokenType.NUMBER && typeof token.literal === 'number') {
      this.advance();
      return { value: Number(token.literal) };
    }

    if (token.type === TokenType.SLIDER) {
      const sliderToken = this.advance();
      const spec = this.parseSliderSpec(sliderToken, defaultMin, defaultMax, defaultStep);
      return {
        value: spec.defaultValue,
        control: spec,
      };
    }

    if (token.type === TokenType.IDENTIFIER) {
      this.advance();
      return {
        value: 0,
        control: {
          kind: 'controlRef',
          controlName: token.lexeme.toUpperCase(),
        },
      };
    }

    this.reportError(token, message);
    throw new Error('ParseError');
  }

  private consumePercentOrControl(
    message: string,
    defaultMax = 100,
    defaultStep = 1,
  ): { mix: number; control?: NumericParamValue } {
    const token = this.peek();

    if (token.type === TokenType.NUMBER && typeof token.literal === 'number') {
      this.advance();
      const raw = Number(token.literal);
      const hasPercent = this.match(TokenType.PERCENT);
      return { mix: hasPercent || raw > 1 ? raw / 100 : raw };
    }

    if (token.type === TokenType.SLIDER) {
      const sliderToken = this.advance();
      const spec = this.parseSliderSpec(sliderToken, 0, defaultMax, defaultStep);
      const hasPercent = this.match(TokenType.PERCENT);
      const mix =
        hasPercent || spec.max > 1 || spec.defaultValue > 1
          ? spec.defaultValue / 100
          : spec.defaultValue;
      return { mix, control: spec };
    }

    if (token.type === TokenType.IDENTIFIER) {
      this.advance();
      this.match(TokenType.PERCENT);
      return {
        mix: 0,
        control: {
          kind: 'controlRef',
          controlName: token.lexeme.toUpperCase(),
        },
      };
    }

    this.reportError(token, message);
    throw new Error('ParseError');
  }

  private consumePercentOrUnit(message: string): number {
    const token = this.consumeNumber(message);
    const raw = Number(token.literal);
    const hasPercent = this.match(TokenType.PERCENT);
    if (hasPercent || raw > 1) {
      return raw / 100;
    }
    return raw;
  }

  private parsePlayStatement(): StatementNode {
    const playToken = this.advance();

    if (this.match(TokenType.NOTE)) {
      const noteToken = this.consumeNote('Esperada nota musical após PLAY NOTE (ex: C4, F#3, Bb4).');
      const beats = this.parseOptionalForBeats(1);
      this.expectSentenceEnd(playToken);

      return {
        kind: 'PlayNoteStatement',
        note: String(noteToken.literal ?? noteToken.lexeme),
        beats,
        line: playToken.line,
        column: playToken.column,
      };
    }

    if (this.match(TokenType.NOTES)) {
      const notes = this.parseNoteList('PLAY NOTES');
      const beatsPerNote = this.parseOptionalForBeats(1);
      this.expectSentenceEnd(playToken);

      return {
        kind: 'PlayNotesStatement',
        notes,
        beatsPerNote,
        line: playToken.line,
        column: playToken.column,
      };
    }

    if (this.match(TokenType.CHORD)) {
      let symbol: string | undefined;
      let notes: string[];

      if (this.isSingleChordSymbolToken()) {
        const chordTok = this.advance();
        const parsed = this.parseChordSymbolOrError(chordTok);
        symbol = parsed.symbol;
        notes = parsed.notes;
      } else {
        notes = this.parseNoteList('PLAY CHORD');
      }

      const beats = this.parseOptionalForBeats(1);
      this.expectSentenceEnd(playToken);

      return {
        kind: 'PlayChordStatement',
        notes,
        symbol,
        beats,
        line: playToken.line,
        column: playToken.column,
      };
    }

    if (this.match(TokenType.CHORDS)) {
      const chords: PlayChordEntry[] = [];
      while (this.check(TokenType.IDENTIFIER) || this.check(TokenType.NOTE_LITERAL)) {
        const chordTok = this.advance();
        chords.push(this.parseChordSymbolOrError(chordTok));
        this.match(TokenType.COMMA);
      }

      if (chords.length === 0) {
        this.reportError(
          this.peek(),
          'Esperada ao menos uma cifra de acorde em PLAY CHORDS (ex: PLAY CHORDS Am7 Fmaj7 Cmaj7 G7 FOR 2 BEATS.).',
        );
        throw new Error('ParseError');
      }

      const beatsPerChord = this.parseOptionalForBeats(1);
      this.expectSentenceEnd(playToken);

      return {
        kind: 'PlayChordsStatement',
        chords,
        beatsPerChord,
        line: playToken.line,
        column: playToken.column,
      };
    }

    if (this.match(TokenType.EUCLIDEAN)) {
      let targetKind: 'drum' | 'note';
      let drum: DrumType | undefined;
      let note: string | undefined;

      if (this.check(TokenType.DRUM_LITERAL)) {
        const drumTok = this.advance();
        targetKind = 'drum';
        drum = (drumTok.literal as DrumType) ?? 'kick';
      } else if (this.check(TokenType.NOTE_LITERAL)) {
        const noteTok = this.advance();
        targetKind = 'note';
        note = String(noteTok.literal ?? noteTok.lexeme);
      } else {
        this.reportError(
          this.peek(),
          'Esperada peça de bateria (ex: KICK) ou nota (ex: C4) após PLAY EUCLIDEAN.',
        );
        throw new Error('ParseError');
      }

      const pulsesTok = this.consumeNumber(
        'Esperado número de pulsos após o alvo em PLAY EUCLIDEAN (ex: PLAY EUCLIDEAN KICK 3 IN 8.).',
      );
      if (!this.match(TokenType.IN)) {
        this.reportError(
          this.peek(),
          'Esperada palavra-chave IN após pulsos em PLAY EUCLIDEAN (ex: 3 IN 8).',
        );
        throw new Error('ParseError');
      }
      const stepsTok = this.consumeNumber(
        'Esperado número de passos após IN em PLAY EUCLIDEAN (ex: 3 IN 8).',
      );

      const pulses = Math.trunc(Number(pulsesTok.literal));
      const steps = Math.trunc(Number(stepsTok.literal));
      if (steps < 1 || steps > 64) {
        this.reportError(
          stepsTok,
          'O número de passos em PLAY EUCLIDEAN deve estar entre 1 e 64.',
        );
      }
      if (pulses < 0) {
        this.reportError(pulsesTok, 'O número de pulsos em PLAY EUCLIDEAN não pode ser negativo.');
      }

      const beatsPerStep = this.parseOptionalForBeats(0.25);
      this.expectSentenceEnd(playToken);

      return {
        kind: 'PlayEuclideanStatement',
        targetKind,
        drum,
        note,
        pulses: Math.max(0, pulses),
        steps: Math.max(1, Math.min(64, steps)),
        beatsPerStep,
        line: playToken.line,
        column: playToken.column,
      };
    }

    if (this.match(TokenType.DRUM)) {
      const drumToken = this.consumeDrum(
        'Esperada peça de bateria após PLAY DRUM (KICK, SNARE, HIHAT, OPEN-HIHAT, CLAP, TOM, RIM, COWBELL, CRASH ou PERC).',
      );
      const beats = this.parseOptionalForBeats(1);
      this.expectSentenceEnd(playToken);

      return {
        kind: 'PlayDrumStatement',
        drum: (drumToken.literal as DrumType) ?? 'kick',
        beats,
        line: playToken.line,
        column: playToken.column,
      };
    }

    if (this.match(TokenType.DRUMS)) {
      const drums = this.parseDrumList('PLAY DRUMS');
      const beatsPerHit = this.parseOptionalForBeats(1);
      this.expectSentenceEnd(playToken);

      return {
        kind: 'PlayDrumsStatement',
        drums,
        beatsPerHit,
        line: playToken.line,
        column: playToken.column,
      };
    }

    if (this.match(TokenType.SAMPLE)) {
      const nameToken = this.peek();
      if (nameToken.type !== TokenType.STRING && nameToken.type !== TokenType.IDENTIFIER) {
        this.reportError(
          nameToken,
          'Esperado nome do arquivo de áudio entre aspas após PLAY SAMPLE (ex: PLAY SAMPLE "vocal.mp3" FOR 8 BEATS.).',
        );
        throw new Error('ParseError');
      }
      this.advance();
      const sampleName = String(nameToken.literal ?? nameToken.lexeme).trim();
      if (!sampleName) {
        this.reportError(nameToken, 'Nome do sample de áudio não pode estar vazio.');
        throw new Error('ParseError');
      }

      let beats = 4;
      let rate = 1;
      let offsetSec = 0;

      while (!this.check(TokenType.DOT) && !this.isAtEnd()) {
        if (this.check(TokenType.FOR)) {
          beats = this.parseOptionalForBeats(4);
        } else if (this.match(TokenType.RATE, TokenType.SPEED)) {
          this.match(TokenType.IS, TokenType.TO);
          const rateTok = this.consumeNumber(
            'Esperado valor numérico de velocidade (ex: 1.0) após RATE/SPEED em PLAY SAMPLE.',
          );
          rate = Math.max(0.25, Math.min(4, Number(rateTok.literal)));
        } else if (this.match(TokenType.OFFSET)) {
          this.match(TokenType.IS, TokenType.TO);
          const offsetTok = this.consumeNumber(
            'Esperado valor numérico em segundos após OFFSET em PLAY SAMPLE.',
          );
          this.match(TokenType.SEC);
          offsetSec = Math.max(0, Number(offsetTok.literal));
        } else {
          this.reportError(
            this.peek(),
            `Token inesperado "${this.peek().lexeme}" em PLAY SAMPLE. Use FOR <N> BEATS, RATE <N> ou OFFSET <N> SEC.`,
          );
          throw new Error('ParseError');
        }
      }

      this.expectSentenceEnd(playToken);
      return {
        kind: 'PlaySampleStatement',
        sampleName,
        beats,
        rate,
        offsetSec,
        line: playToken.line,
        column: playToken.column,
      };
    }

    this.reportError(
      this.peek(),
      'Esperado NOTE, NOTES, CHORD, CHORDS, DRUM, DRUMS, SAMPLE ou EUCLIDEAN após PLAY.',
    );
    throw new Error('ParseError');
  }

  private isSingleChordSymbolToken(): boolean {
    return (
      this.check(TokenType.IDENTIFIER) ||
      (this.check(TokenType.NOTE_LITERAL) &&
        this.peekNext().type !== TokenType.NOTE_LITERAL &&
        this.peekNext().type !== TokenType.COMMA &&
        ChordParser.isChordSymbol(this.peek().lexeme, true))
    );
  }

  private parseChordSymbolOrError(token: Token): PlayChordEntry {
    try {
      const notes = ChordParser.parseChord(token.lexeme);
      return { symbol: token.lexeme, notes };
    } catch (error) {
      this.reportError(
        token,
        error instanceof Error
          ? error.message
          : `Cifra de acorde inválida "${token.lexeme}".`,
      );
      throw new Error('ParseError');
    }
  }

  private parseArpeggiateStatement(): StatementNode {
    const arpToken = this.advance(); // ARPEGGIATE / ARP
    let symbol: string | undefined;
    let notes: string[];

    if (this.isSingleChordSymbolToken()) {
      const chordTok = this.advance();
      const parsed = this.parseChordSymbolOrError(chordTok);
      symbol = parsed.symbol;
      notes = parsed.notes;
    } else if (this.check(TokenType.NOTE_LITERAL)) {
      notes = this.parseNoteList('ARPEGGIATE');
    } else {
      this.reportError(
        this.peek(),
        'Esperada cifra de acorde (ex: Am7) ou lista de notas (ex: C4 E4 G4) após ARPEGGIATE.',
      );
      throw new Error('ParseError');
    }

    let direction: ArpDirection = 'up';
    if (this.match(TokenType.UP)) {
      direction = 'up';
    } else if (this.match(TokenType.DOWN)) {
      direction = 'down';
    } else if (this.match(TokenType.UP_DOWN)) {
      direction = 'up-down';
    }

    const beatsPerStep = this.parseOptionalForBeats(0.25);
    this.expectSentenceEnd(arpToken);

    return {
      kind: 'ArpeggiateStatement',
      notes,
      symbol,
      direction,
      beatsPerStep,
      line: arpToken.line,
      column: arpToken.column,
    };
  }

  private parseDrumList(commandName: string): DrumType[] {
    const drums: DrumType[] = [];

    while (this.check(TokenType.DRUM_LITERAL)) {
      const token = this.advance();
      drums.push((token.literal as DrumType) ?? 'kick');
      this.match(TokenType.COMMA);
    }

    if (drums.length === 0) {
      this.reportError(
        this.peek(),
        `Esperada ao menos uma peça de bateria em ${commandName} (ex: KICK HIHAT SNARE HIHAT).`,
      );
      throw new Error('ParseError');
    }

    return drums;
  }

  private parseNoteList(commandName: string): string[] {
    const notes: string[] = [];

    while (this.check(TokenType.NOTE_LITERAL)) {
      const token = this.advance();
      notes.push(String(token.literal ?? token.lexeme));
      this.match(TokenType.COMMA);
    }

    if (notes.length === 0) {
      this.reportError(
        this.peek(),
        `Esperada ao menos uma nota musical em ${commandName} (ex: C4 E4 G4).`,
      );
      throw new Error('ParseError');
    }

    return notes;
  }

  private parseRestStatement(): StatementNode {
    const restToken = this.advance();
    const beats = this.parseOptionalForBeats(1);
    this.expectSentenceEnd(restToken);

    return {
      kind: 'RestStatement',
      beats,
      line: restToken.line,
      column: restToken.column,
    };
  }

  private parseRepeatStatement(): StatementNode {
    const repeatToken = this.advance();
    const countToken = this.consumeNumber('Esperado número de repetições após REPEAT.');
    const times = Math.floor(Number(countToken.literal));
    if (times < 1) {
      this.reportError(
        countToken,
        'O número de repetições em REPEAT deve ser pelo menos 1.',
      );
    }

    this.match(TokenType.TIMES);
    this.match(TokenType.DOT); // Optional period after REPEAT N TIMES

    const body: StatementNode[] = [];
    while (!this.isAtEnd() && !this.check(TokenType.END_REPEAT)) {
      if (this.check(TokenType.DOT)) {
        this.advance();
        continue;
      }
      if (
        this.isDivisionStart() ||
        this.check(TokenType.END_TRACK) ||
        this.isTrackStart() ||
        this.check(TokenType.END_SECTION) ||
        this.isSectionStart()
      ) {
        this.reportError(
          this.peek(),
          `Bloco REPEAT iniciado na linha ${repeatToken.line} não foi fechado com END-REPEAT.`,
        );
        break;
      }
      const inner = this.parseStatement();
      if (inner) {
        body.push(inner);
      }
    }

    if (!this.match(TokenType.END_REPEAT)) {
      this.reportError(
        repeatToken,
        `Esperado END-REPEAT para fechar o bloco REPEAT da linha ${repeatToken.line}.`,
      );
    } else {
      this.match(TokenType.DOT);
    }

    return {
      kind: 'RepeatStatement',
      times: Math.max(1, times),
      body,
      line: repeatToken.line,
      column: repeatToken.column,
    };
  }

  private parseTrackStatement(): StatementNode {
    const trackToken = this.advance(); // TRACK
    const nameToken = this.peek();

    if (
      nameToken.type === TokenType.EOF ||
      nameToken.type === TokenType.DOT ||
      nameToken.type === TokenType.COMMA ||
      nameToken.type === TokenType.PERCENT ||
      nameToken.type === TokenType.END_TRACK ||
      nameToken.type === TokenType.END_SECTION ||
      nameToken.type === TokenType.END_REPEAT
    ) {
      this.reportError(nameToken, 'Esperado nome da track após TRACK (ex: TRACK BASS.).');
      throw new Error('ParseError');
    }

    this.advance();
    const rawName =
      nameToken.type === TokenType.STRING
        ? String(nameToken.literal ?? nameToken.lexeme)
        : nameToken.lexeme;
    const trackName = rawName.toUpperCase();

    this.match(TokenType.SECTION);
    this.expectSentenceEnd(trackToken);

    const statements: StatementNode[] = [];
    while (
      !this.isAtEnd() &&
      !this.check(TokenType.END_TRACK) &&
      !this.isDivisionStart() &&
      !this.isTrackStart() &&
      !this.isSectionStart()
    ) {
      if (this.check(TokenType.DOT)) {
        this.advance();
        continue;
      }
      const inner = this.parseStatement();
      if (inner) {
        statements.push(inner);
      }
    }

    if (this.match(TokenType.END_TRACK)) {
      this.match(TokenType.DOT);
    }

    return {
      kind: 'TrackStatement',
      name: trackName,
      statements,
      line: trackToken.line,
      column: trackToken.column,
    };
  }

  private parseSectionStatement(): StatementNode {
    const startToken = this.peek();
    let sectionName = '';

    if (this.match(TokenType.SECTION)) {
      const nameToken = this.peek();
      if (
        nameToken.type !== TokenType.IDENTIFIER &&
        nameToken.type !== TokenType.STRING &&
        nameToken.type !== TokenType.NUMBER
      ) {
        this.reportError(nameToken, 'Esperado nome da seção após SECTION (ex: SECTION REFRAO.).');
        throw new Error('ParseError');
      }
      this.advance();
      sectionName =
        nameToken.type === TokenType.STRING
          ? String(nameToken.literal ?? nameToken.lexeme).toUpperCase()
          : nameToken.lexeme.toUpperCase();
    } else {
      const nameToken = this.advance(); // IDENTIFIER
      this.advance(); // SECTION
      sectionName = nameToken.lexeme.toUpperCase();
    }

    this.expectSentenceEnd(startToken);

    const statements: StatementNode[] = [];
    while (
      !this.isAtEnd() &&
      !this.check(TokenType.END_SECTION) &&
      !this.check(TokenType.END_TRACK) &&
      !this.isDivisionStart() &&
      !this.isTrackStart() &&
      !this.isSectionStart()
    ) {
      if (this.check(TokenType.DOT)) {
        this.advance();
        continue;
      }
      const inner = this.parseStatement();
      if (inner) {
        statements.push(inner);
      }
    }

    if (this.match(TokenType.END_SECTION)) {
      this.match(TokenType.DOT);
    }

    return {
      kind: 'SectionStatement',
      name: sectionName,
      statements,
      line: startToken.line,
      column: startToken.column,
    };
  }

  private parsePerformStatement(): StatementNode {
    const performToken = this.advance(); // PERFORM
    const nameToken = this.peek();
    if (nameToken.type !== TokenType.IDENTIFIER && nameToken.type !== TokenType.STRING) {
      this.reportError(nameToken, 'Esperado nome da seção após PERFORM (ex: PERFORM REFRAO 2 TIMES.).');
      throw new Error('ParseError');
    }

    this.advance();
    const sectionName =
      nameToken.type === TokenType.STRING
        ? String(nameToken.literal ?? nameToken.lexeme).toUpperCase()
        : nameToken.lexeme.toUpperCase();

    let times = 1;
    this.match(TokenType.FOR);
    if (this.check(TokenType.NUMBER)) {
      const countToken = this.advance();
      times = Math.floor(Number(countToken.literal));
      if (times < 1) {
        this.reportError(countToken, 'O número de repetições em PERFORM deve ser pelo menos 1.');
        times = 1;
      }
      this.match(TokenType.TIMES);
    }

    this.expectSentenceEnd(performToken);

    return {
      kind: 'PerformStatement',
      sectionName,
      times,
      line: performToken.line,
      column: performToken.column,
    };
  }

  private parsePrintStatement(): StatementNode {
    const printToken = this.advance();
    let message = '';

    if (this.check(TokenType.STRING)) {
      const strToken = this.advance();
      message = String(strToken.literal ?? strToken.lexeme);
    } else if (this.check(TokenType.NUMBER) || this.check(TokenType.IDENTIFIER) || this.check(TokenType.NOTE_LITERAL)) {
      const tok = this.advance();
      message = tok.lexeme;
    } else {
      this.reportError(
        this.peek(),
        `Esperada string entre aspas após ${printToken.lexeme.toUpperCase()}.`,
      );
      throw new Error('ParseError');
    }

    this.expectSentenceEnd(printToken);

    return {
      kind: 'PrintStatement',
      message,
      line: printToken.line,
      column: printToken.column,
    };
  }

  private parseOptionalForBeats(defaultBeats: number): number {
    if (!this.match(TokenType.FOR)) {
      return defaultBeats;
    }

    const numToken = this.consumeNumber('Esperado valor numérico de duração após FOR.');
    const value = Number(numToken.literal);
    this.match(TokenType.BEAT, TokenType.BEATS);
    return value;
  }

  private expectSentenceEnd(originToken: Token): void {
    if (this.match(TokenType.DOT)) {
      return;
    }

    const current = this.peek();
    this.reportError(
      current.type === TokenType.EOF ? originToken : current,
      `Esperado ponto final "." ao término do comando iniciado na linha ${originToken.line}.`,
    );
  }

  private consumeNumber(message: string): Token {
    const token = this.peek();
    if (token.type !== TokenType.NUMBER || typeof token.literal !== 'number') {
      this.reportError(token, message);
      throw new Error('ParseError');
    }
    return this.advance();
  }

  private consumeNote(message: string): Token {
    const token = this.peek();
    if (token.type !== TokenType.NOTE_LITERAL) {
      this.reportError(token, message);
      throw new Error('ParseError');
    }
    return this.advance();
  }

  private consumeDrum(message: string): Token {
    const token = this.peek();
    if (token.type !== TokenType.DRUM_LITERAL) {
      this.reportError(token, message);
      throw new Error('ParseError');
    }
    return this.advance();
  }

  private match(...types: TokenType[]): boolean {
    if (types.some((type) => this.check(type))) {
      this.advance();
      return true;
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current += 1;
    }
    return this.tokens[this.current - 1];
  }

  private peek(): Token {
    return this.tokens[this.current] ?? this.tokens[this.tokens.length - 1];
  }

  private peekNext(): Token {
    return this.tokens[this.current + 1] ?? this.tokens[this.tokens.length - 1];
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private reportError(token: Token, message: string): void {
    this.diagnostics.push({
      severity: 'error',
      message,
      line: token.line,
      column: token.column,
      lexeme: token.lexeme,
    });
  }

  private synchronize(): void {
    if (!this.isAtEnd()) {
      this.advance();
    }

    while (!this.isAtEnd()) {
      if (this.tokens[this.current - 1]?.type === TokenType.DOT) {
        return;
      }
      if (
        this.check(TokenType.END_REPEAT) ||
        this.check(TokenType.END_TRACK) ||
        this.check(TokenType.END_SECTION) ||
        this.isDivisionStart() ||
        STATEMENT_START_TOKENS.has(this.peek().type)
      ) {
        return;
      }
      this.advance();
    }
  }
}
