import type { CompilationDiagnostic } from '../domain/entities/ExecutionPlan.js';
import { type Token, TokenType } from '../domain/entities/Token.js';
import { CobolStyleLexer } from '../infrastructure/compiler/CobolStyleLexer.js';
import {
  type CopyResolver,
  MAX_COPY_DEPTH,
  parseCopyLine,
} from '../infrastructure/compiler/CopyPreprocessor.js';

/** Intervalo em offsets de caractere do texto-fonte (`end` exclusivo). */
export interface TextRange {
  readonly start: number;
  readonly end: number;
}

export type SymbolKind = 'section' | 'control' | 'track';

export interface SymbolOccurrence {
  /** Nome normalizado (MAIÚSCULAS, sem aspas). */
  readonly name: string;
  readonly kind: SymbolKind;
  readonly role: 'definition' | 'reference';
  /** Range do token do nome (inclui as aspas se o nome estiver entre aspas). */
  readonly range: TextRange;
  readonly quoted: boolean;
  /** Arquivo (nome canônico) onde o símbolo foi declarado, quando vem de um `COPY`. `range`/`line` valem nesse arquivo. */
  readonly file?: string;
  /** Linha (1-based) do token. */
  readonly line: number;
  readonly column: number;
}

export interface ControlSpec {
  readonly defaultValue?: number;
  readonly min?: number;
  readonly max?: number;
}

export interface SymbolInfo {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly definitions: SymbolOccurrence[];
  readonly references: SymbolOccurrence[];
  readonly spec?: ControlSpec;
}

export type LanguageDiagnosticCode =
  | 'undefined-section'
  | 'undefined-control'
  | 'duplicate-section'
  | 'duplicate-control'
  | 'unresolved-copy';

/** Diagnóstico semântico do serviço de linguagem (compatível com `CompilationDiagnostic`). */
export interface LanguageDiagnostic extends CompilationDiagnostic {
  readonly code: LanguageDiagnosticCode;
  readonly range: TextRange;
  /** Nomes parecidos já declarados ("quis dizer..."). */
  readonly suggestions?: readonly string[];
  /** Nome (normalizado) ao qual o diagnóstico se refere. */
  readonly symbolName: string;
}

/** Contexto do projeto para resolver `COPY` (arquivos disponíveis para inclusão). */
export interface LanguageContext {
  readonly resolveCopy?: CopyResolver;
  /** Nome do arquivo analisado (para detectar COPY circular de si mesmo). */
  readonly rootName?: string;
  /** Nomes de arquivos disponíveis, para sugerir correções de COPY inexistente. */
  readonly copyCandidates?: readonly string[];
}

export interface CopyReference {
  /** Nome como escrito (sem aspas). */
  readonly name: string;
  /** Range do nome (inclui as aspas, se houver). */
  readonly range: TextRange;
  readonly line: number;
  readonly quoted: boolean;
  /** Nome canônico do arquivo, se resolvido. */
  readonly resolved: string | null;
  /** Quantidade de linhas do arquivo resolvido. */
  readonly lineCount: number;
  /** Símbolos que o arquivo (e seus COPY aninhados) declara. */
  readonly sections: readonly string[];
  readonly controls: readonly string[];
}

export interface DocumentModel {
  readonly source: string;
  readonly lineStarts: readonly number[];
  readonly tokens: readonly Token[];
  /** Todas as ocorrências (definições e referências) em ordem de aparição. */
  readonly occurrences: readonly SymbolOccurrence[];
  readonly sections: ReadonlyMap<string, SymbolInfo>;
  readonly controls: ReadonlyMap<string, SymbolInfo>;
  readonly tracks: ReadonlyMap<string, SymbolInfo>;
  readonly diagnostics: readonly LanguageDiagnostic[];
  /** Diagnósticos léxicos (ex.: string não terminada). */
  readonly lexDiagnostics: readonly CompilationDiagnostic[];
  /** Instruções `COPY` do documento. */
  readonly copies: readonly CopyReference[];
}

/** Parâmetros que aceitam um CONTROL como valor: `VOLUME IS <CONTROL>.` */
const CONTROL_PARAM_TOKENS = new Set<TokenType>([
  TokenType.VOLUME,
  TokenType.TEMPO,
  TokenType.REVERB,
  TokenType.DELAY,
  TokenType.DETUNE,
  TokenType.PAN,
]);

const NAME_TOKEN_TYPES = new Set<TokenType>([
  TokenType.IDENTIFIER,
  TokenType.STRING,
  TokenType.NUMBER,
]);

function computeLineStarts(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return starts;
}

export function offsetAt(model: Pick<DocumentModel, 'lineStarts'>, line: number, column: number): number {
  const base = model.lineStarts[Math.max(0, Math.min(line, model.lineStarts.length) - 1)] ?? 0;
  return base + Math.max(0, column - 1);
}

/** Converte offset em posição 1-based. */
export function positionAt(
  model: Pick<DocumentModel, 'lineStarts'>,
  offset: number,
): { line: number; column: number } {
  let lo = 0;
  let hi = model.lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (model.lineStarts[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: offset - model.lineStarts[lo]! + 1 };
}

function normalizeName(token: Token): string {
  return token.type === TokenType.STRING
    ? String(token.literal ?? token.lexeme.replace(/^"|"$/g, '')).toUpperCase()
    : token.lexeme.toUpperCase();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/** Até 3 nomes parecidos com `name` (distância de edição pequena ou prefixo comum). */
export function suggestSimilar(name: string, candidates: Iterable<string>): string[] {
  const target = name.toUpperCase();
  const maxDistance = Math.max(2, Math.floor(target.length / 3));
  // Comparação sem diferenciar maiúsculas; devolve o candidato como foi informado.
  return [...candidates]
    .map((c) => ({ c, u: c.toUpperCase(), d: levenshtein(target, c.toUpperCase()) }))
    .filter(({ u, d }) => u !== target && (d <= maxDistance || u.startsWith(target) || target.startsWith(u)))
    .sort((x, y) => x.d - y.d || x.c.localeCompare(y.c))
    .slice(0, 3)
    .map(({ c }) => c);
}

function parseControlSpec(tokens: readonly Token[], from: number): ControlSpec {
  let defaultValue: number | undefined;
  let min: number | undefined;
  let max: number | undefined;
  for (let i = from; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.type === TokenType.DOT || t.type === TokenType.EOF) break;
    const next = tokens[i + 1];
    const num = next && next.type === TokenType.NUMBER ? Number(next.literal) : undefined;
    if (num === undefined || Number.isNaN(num)) continue;
    if (t.type === TokenType.SLIDER || t.type === TokenType.DEFAULT) defaultValue = num;
    else if (t.type === TokenType.FROM) min = num;
    else if (t.type === TokenType.TO) max = num;
  }
  return { defaultValue, min, max };
}

interface MutableInfo {
  name: string;
  kind: SymbolKind;
  definitions: SymbolOccurrence[];
  references: SymbolOccurrence[];
  spec?: ControlSpec;
}

let lastModel: DocumentModel | null = null;
let lastContext: LanguageContext | undefined;

/** Analisa o documento. O último resultado fica em cache (o editor chama a cada tecla). */
export function analyzeDocument(source: string, context?: LanguageContext): DocumentModel {
  if (lastModel && lastModel.source === source && lastContext === context) return lastModel;
  lastModel = analyzeInternal(source, context, context?.rootName ? [context.rootName] : [], 0);
  lastContext = context;
  return lastModel;
}

function analyzeInternal(
  source: string,
  context: LanguageContext | undefined,
  stack: readonly string[],
  depth: number,
): DocumentModel {

  const lexResult = new CobolStyleLexer().tokenize(source);
  const tokens = lexResult.tokens;
  const lineStarts = computeLineStarts(source);
  const base = { lineStarts };

  // Instruções COPY (uma por linha) e arquivos que elas resolvem.
  const copyLines = new Set<number>();
  const copies: CopyReference[] = [];
  const subModels: Array<{ file: string; model: DocumentModel }> = [];
  source.split('\n').forEach((raw, idx) => {
    const line = raw.replace(/\r$/, '');
    const stmt = parseCopyLine(line);
    if (!stmt) return;
    copyLines.add(idx + 1);
    const quoted = /^\s*COPY\s+"/i.test(line);
    const nameStart = quoted
      ? line.indexOf('"', stmt.indent.length)
      : line.toUpperCase().indexOf('COPY', stmt.indent.length) + 4 + (/^\s*COPY(\s+)/i.exec(line)?.[1]?.length ?? 1);
    const length = quoted ? stmt.name.length + 2 : stmt.name.length;
    const start = lineStarts[idx]! + nameStart;
    const target = context?.resolveCopy ? context.resolveCopy(stmt.name) : null;
    let sections: string[] = [];
    let controlsDeclared: string[] = [];
    let lineCount = 0;
    if (target) {
      lineCount = target.code.split('\n').length;
      const sub =
        stack.includes(target.name) || depth >= MAX_COPY_DEPTH
          ? null
          : analyzeInternal(target.code, context, [...stack, target.name], depth + 1);
      if (sub) subModels.push({ file: target.name, model: sub });
      sections = sub ? [...sub.sections.values()].filter((x) => x.definitions.length > 0).map((x) => x.name) : [];
      controlsDeclared = sub
        ? [...sub.controls.values()].filter((x) => x.definitions.length > 0).map((x) => x.name)
        : [];
    }
    copies.push({
      name: stmt.name,
      range: { start, end: start + length },
      line: idx + 1,
      quoted,
      resolved: target?.name ?? null,
      lineCount,
      sections,
      controls: controlsDeclared,
    });
  });

  const occurrences: SymbolOccurrence[] = [];
  const consumed = new Set<number>();
  const sections = new Map<string, MutableInfo>();
  const controls = new Map<string, MutableInfo>();
  const tracks = new Map<string, MutableInfo>();
  const registry: Record<SymbolKind, Map<string, MutableInfo>> = {
    section: sections,
    control: controls,
    track: tracks,
  };

  const add = (
    index: number,
    kind: SymbolKind,
    role: 'definition' | 'reference',
    spec?: ControlSpec,
  ): SymbolOccurrence => {
    const token = tokens[index]!;
    const start = offsetAt(base, token.line, token.column);
    const occ: SymbolOccurrence = {
      name: normalizeName(token),
      kind,
      role,
      range: { start, end: start + token.lexeme.length },
      quoted: token.type === TokenType.STRING,
      line: token.line,
      column: token.column,
    };
    occurrences.push(occ);
    consumed.add(index);
    const map = registry[kind];
    let info = map.get(occ.name);
    if (!info) {
      info = { name: occ.name, kind, definitions: [], references: [] };
      map.set(occ.name, info);
    }
    (role === 'definition' ? info.definitions : info.references).push(occ);
    if (spec && !info.spec) info.spec = spec;
    return occ;
  };

  const isStatementStart = (i: number): boolean => i === 0 || tokens[i - 1]!.type === TokenType.DOT;
  const isNameToken = (i: number): boolean => {
    const t = tokens[i];
    return !!t && NAME_TOKEN_TYPES.has(t.type) && !consumed.has(i);
  };

  // Passada 1: seções, PERFORM, tracks e declarações de CONTROL.
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (copyLines.has(t.line)) {
      consumed.add(i);
      continue;
    }
    switch (t.type) {
      case TokenType.SECTION: {
        const prev = i - 1;
        const next = i + 1;
        const prefixForm =
          prev >= 0 &&
          isNameToken(prev) &&
          tokens[next]?.type === TokenType.DOT &&
          (prev === 0 || tokens[prev - 1]!.type === TokenType.DOT);
        if (prefixForm) add(prev, 'section', 'definition');
        else if (isNameToken(next)) add(next, 'section', 'definition');
        break;
      }
      case TokenType.PERFORM:
        if (isNameToken(i + 1)) add(i + 1, 'section', 'reference');
        break;
      case TokenType.TRACK: {
        // Nomes de track podem coincidir com palavras-chave (ex.: TRACK DRUMS.).
        const nameTok = tokens[i + 1];
        if (nameTok && !consumed.has(i + 1) && /^[\p{L}\p{N}"]/u.test(nameTok.lexeme)) add(i + 1, 'track', 'definition');
        break;
      }
      case TokenType.CONTROL:
      case TokenType.SLIDER:
      case TokenType.DEFINE: {
        if (!isStatementStart(i)) break;
        let j = i + 1;
        if (t.type === TokenType.DEFINE && (tokens[j]?.type === TokenType.CONTROL || tokens[j]?.type === TokenType.SLIDER)) {
          j++;
        }
        const nameType = tokens[j]?.type;
        if (nameType === TokenType.IDENTIFIER || nameType === TokenType.STRING) {
          add(j, 'control', 'definition', parseControlSpec(tokens, j + 1));
        }
        break;
      }
      default:
        break;
    }
  }

  // Símbolos declarados em arquivos incluídos (ficam depois das declarações locais).
  const addExternal = (
    occ: SymbolOccurrence,
    kind: 'section' | 'control',
    file: string,
    spec?: ControlSpec,
  ) => {
    const map = registry[kind];
    let info = map.get(occ.name);
    if (!info) {
      info = { name: occ.name, kind, definitions: [], references: [] };
      map.set(occ.name, info);
    }
    info.definitions.push(occ.file ? occ : { ...occ, file });
    if (spec && !info.spec) info.spec = spec;
  };
  for (const { file, model: sub } of subModels) {
    for (const info of sub.sections.values()) {
      for (const d of info.definitions) addExternal(d, 'section', file);
    }
    for (const info of sub.controls.values()) {
      for (const d of info.definitions) addExternal(d, 'control', file, info.spec);
    }
  }
  // Com COPY não resolvido (ou sem projeto), não dá para afirmar que um nome é indefinido.
  const incompleteCopies = copies.some((c) => !c.resolved);

  // Passada 2: referências a controles (identificadores com o nome de um CONTROL declarado).
  const undefinedControlRefs: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (consumed.has(i)) continue;
    if (t.type === TokenType.IDENTIFIER && controls.has(t.lexeme.toUpperCase())) {
      add(i, 'control', 'reference');
    }
  }
  // Identificadores em posições onde só um CONTROL faz sentido: `VOLUME IS <x>.` e `FILTER IS LOWPASS <x> HZ`.
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    let candidate = -1;
    if (CONTROL_PARAM_TOKENS.has(t.type) && (tokens[i + 1]?.type === TokenType.IS || tokens[i + 1]?.type === TokenType.TO)) {
      candidate = i + 2;
    } else if (t.type === TokenType.FILTER && tokens[i + 1]?.type === TokenType.IS) {
      const kind = tokens[i + 2]?.type;
      if (kind === TokenType.LOWPASS || kind === TokenType.HIGHPASS || kind === TokenType.BANDPASS) candidate = i + 3;
    }
    const c = tokens[candidate];
    if (c && c.type === TokenType.IDENTIFIER && !consumed.has(candidate) && !controls.has(c.lexeme.toUpperCase())) {
      undefinedControlRefs.push(candidate);
    }
  }

  // Diagnósticos semânticos.
  const diagnostics: LanguageDiagnostic[] = [];
  for (const occ of occurrences) {
    if (
      !incompleteCopies &&
      occ.kind === 'section' &&
      occ.role === 'reference' &&
      !sections.get(occ.name)?.definitions.length
    ) {
      diagnostics.push({
        severity: 'error',
        code: 'undefined-section',
        message: `Seção "${occ.name}" não encontrada para PERFORM.`,
        line: occ.line,
        column: occ.column,
        lexeme: occ.name,
        range: occ.range,
        symbolName: occ.name,
        suggestions: suggestSimilar(
          occ.name,
          [...sections.values()].filter((s) => s.definitions.length > 0).map((s) => s.name),
        ),
      });
    }
  }
  for (const [kind, map] of [
    ['section', sections],
    ['control', controls],
  ] as const) {
    const label = kind === 'section' ? 'Seção' : 'CONTROL';
    const code = kind === 'section' ? 'duplicate-section' : 'duplicate-control';
    for (const info of map.values()) {
      const local = info.definitions.filter((d) => !d.file);
      const ext = info.definitions.filter((d) => d.file);
      for (const dup of local.slice(1)) {
        diagnostics.push({
          severity: 'warning',
          code,
          message: `${label} "${info.name}" já foi declarado na linha ${local[0]!.line}.`,
          line: dup.line,
          column: dup.column,
          lexeme: info.name,
          range: dup.range,
          symbolName: info.name,
        });
      }
      if (local.length > 0 && ext.length > 0) {
        diagnostics.push({
          severity: 'warning',
          code,
          message: `${label} "${info.name}" também é declarado em "${ext[0]!.file}" (COPY).`,
          line: local[0]!.line,
          column: local[0]!.column,
          lexeme: info.name,
          range: local[0]!.range,
          symbolName: info.name,
        });
      }
    }
  }
  for (const idx of incompleteCopies ? [] : undefinedControlRefs) {
    const token = tokens[idx]!;
    const name = token.lexeme.toUpperCase();
    const start = offsetAt(base, token.line, token.column);
    diagnostics.push({
      severity: 'error',
      code: 'undefined-control',
      message: `Controle ou variável "${name}" não foi declarado.`,
      line: token.line,
      column: token.column,
      lexeme: name,
      range: { start, end: start + token.lexeme.length },
      symbolName: name,
      suggestions: suggestSimilar(name, controls.keys()),
    });
  }
  if (context?.resolveCopy) {
    for (const copy of copies) {
      if (copy.resolved) continue;
      const wanted = copy.name.replace(/\.sythm$/i, '');
      diagnostics.push({
        severity: 'error',
        code: 'unresolved-copy',
        message: `COPY "${copy.name}": arquivo não encontrado no projeto.`,
        line: copy.line,
        column: copy.range.start - lineStarts[copy.line - 1]! + 1,
        lexeme: copy.name,
        range: copy.range,
        symbolName: copy.name,
        suggestions: suggestSimilar(
          wanted,
          (context.copyCandidates ?? []).map((c) => c.replace(/\.sythm$/i, '')),
        ).map((c) => `${c}.sythm`),
      });
    }
  }
  diagnostics.sort((a, b) => a.range.start - b.range.start);

  const freeze = (map: Map<string, MutableInfo>): ReadonlyMap<string, SymbolInfo> => map;
  return {
    source,
    lineStarts,
    tokens,
    occurrences: [...occurrences].sort((a, b) => a.range.start - b.range.start),
    sections: freeze(sections),
    controls: freeze(controls),
    tracks: freeze(tracks),
    diagnostics,
    lexDiagnostics: lexResult.diagnostics,
    copies,
  };
}

/** Ocorrência de símbolo sob o cursor (o fim do nome conta, para o cursor logo após a palavra). */
export function findOccurrenceAt(model: DocumentModel, offset: number): SymbolOccurrence | null {
  let touching: SymbolOccurrence | null = null;
  for (const occ of model.occurrences) {
    if (offset >= occ.range.start && offset < occ.range.end) return occ;
    if (offset === occ.range.end) touching = occ;
  }
  return touching;
}

/** Token sob o cursor (o fim do token conta). */
export function findTokenAt(model: DocumentModel, offset: number): { token: Token; range: TextRange } | null {
  let touching: { token: Token; range: TextRange } | null = null;
  for (const token of model.tokens) {
    if (token.type === TokenType.EOF) continue;
    const start = offsetAt(model, token.line, token.column);
    const range = { start, end: start + token.lexeme.length };
    if (offset >= range.start && offset < range.end) return { token, range };
    if (offset === range.end && token.type !== TokenType.DOT) touching = { token, range };
  }
  return touching;
}

export function getSymbolInfo(model: DocumentModel, occ: SymbolOccurrence): SymbolInfo | undefined {
  return (occ.kind === 'section' ? model.sections : occ.kind === 'control' ? model.controls : model.tracks).get(occ.name);
}

/** Referência de COPY sob o cursor. */
export function findCopyAt(model: DocumentModel, offset: number): CopyReference | null {
  return model.copies.find((c) => offset >= c.range.start && offset <= c.range.end) ?? null;
}
