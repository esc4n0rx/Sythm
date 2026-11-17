import type { CompilationDiagnostic } from '../domain/entities/ExecutionPlan.js';
import { TokenType } from '../domain/entities/Token.js';
import { ChordParser } from '../domain/value-objects/ChordParser.js';
import { NoteFrequency } from '../domain/value-objects/NoteFrequency.js';
import { CobolStyleLexer } from '../infrastructure/compiler/CobolStyleLexer.js';
import {
  type DocumentModel,
  type LanguageContext,
  type LanguageDiagnostic,
  type SymbolInfo,
  type SymbolKind,
  type SymbolOccurrence,
  type TextRange,
  analyzeDocument,
  findCopyAt,
  findOccurrenceAt,
  findTokenAt,
  getSymbolInfo,
  offsetAt,
  positionAt,
} from './analyzer.js';
import { getKeywordDoc } from './keywordDocs.js';

export interface TextEdit {
  readonly range: TextRange;
  readonly newText: string;
}

/** Aplica edições (sem sobreposição) a um texto. */
export function applyEdits(source: string, edits: readonly TextEdit[]): string {
  return [...edits]
    .sort((a, b) => b.range.start - a.range.start)
    .reduce((text, e) => text.slice(0, e.range.start) + e.newText + text.slice(e.range.end), source);
}

// ---------------------------------------------------------------------------
// Definição, referências e símbolos
// ---------------------------------------------------------------------------

export interface DefinitionResult {
  readonly name: string;
  readonly kind: SymbolKind | 'file';
  /** Range do nome na declaração (no arquivo `file`, se informado). */
  readonly range: TextRange;
  readonly line: number;
  /** Arquivo do projeto onde fica a declaração (símbolos vindos de `COPY`, ou o próprio arquivo do COPY). */
  readonly file?: string;
}

/** Go-to-definition: de um `PERFORM X` ou uso de CONTROL para a sua declaração. */
export function getDefinition(model: DocumentModel, offset: number): DefinitionResult | null {
  const copy = findCopyAt(model, offset);
  if (copy) {
    return copy.resolved
      ? { name: copy.resolved, kind: 'file', file: copy.resolved, range: { start: 0, end: 0 }, line: 1 }
      : null;
  }
  const occ = findOccurrenceAt(model, offset);
  if (!occ) return null;
  const def = getSymbolInfo(model, occ)?.definitions[0];
  if (!def) return null;
  return { name: def.name, kind: def.kind, range: def.range, line: def.line, file: def.file };
}

export function getReferences(
  model: DocumentModel,
  offset: number,
  includeDeclaration = true,
): SymbolOccurrence[] {
  const occ = findOccurrenceAt(model, offset);
  if (!occ) return [];
  const info = getSymbolInfo(model, occ);
  if (!info) return [];
  // Offsets de declarações externas (COPY) pertencem a outro arquivo: vão por último, sem misturar na ordenação.
  const local = [...(includeDeclaration ? info.definitions.filter((d) => !d.file) : []), ...info.references].sort(
    (a, b) => a.range.start - b.range.start,
  );
  return [...local, ...(includeDeclaration ? info.definitions.filter((d) => d.file) : [])];
}

export interface DocumentSymbol {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly range: TextRange;
  readonly line: number;
  readonly detail: string;
}

/** Outline do documento: SECTIONs, CONTROLs e TRACKs declarados, em ordem. */
export function getDocumentSymbols(model: DocumentModel): DocumentSymbol[] {
  const out: DocumentSymbol[] = [];
  for (const occ of model.occurrences) {
    if (occ.role !== 'definition') continue;
    const info = getSymbolInfo(model, occ)!;
    out.push({
      name: occ.name,
      kind: occ.kind,
      range: occ.range,
      line: occ.line,
      detail: describeSymbol(info),
    });
  }
  return out;
}

function describeSymbol(info: SymbolInfo): string {
  const uses = info.references.length;
  const usage = `${uses} uso${uses === 1 ? '' : 's'}`;
  if (info.kind === 'control') {
    const s = info.spec;
    const range = s && s.min !== undefined && s.max !== undefined ? ` ${s.min}–${s.max}` : '';
    return `slider${s?.defaultValue !== undefined ? ` (${s.defaultValue})` : ''}${range} · ${usage}`;
  }
  return info.kind === 'section' ? usage : 'track';
}

// ---------------------------------------------------------------------------
// Rename
// ---------------------------------------------------------------------------

export interface PrepareRenameResult {
  readonly range: TextRange;
  readonly placeholder: string;
  readonly kind: SymbolKind;
}

export function prepareRename(model: DocumentModel, offset: number): PrepareRenameResult | null {
  const occ = findOccurrenceAt(model, offset);
  if (!occ || occ.kind === 'track') return null;
  const info = getSymbolInfo(model, occ);
  // Só renomeia símbolos que possuem declaração: evita editar referências soltas.
  if (!info || info.definitions.length === 0) return null;
  // Declarado em outro arquivo (COPY): renomear aqui deixaria o projeto inconsistente.
  if (info.definitions.some((d) => d.file)) return null;
  return { range: occ.range, placeholder: occ.name, kind: occ.kind };
}

export type RenameResult =
  | { readonly ok: true; readonly edits: TextEdit[] }
  | { readonly ok: false; readonly error: string };

/** Verifica se `name` é um identificador válido e livre (não reservado, não é nota/acorde). */
export function validateSymbolName(name: string): string | null {
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) {
    return 'Use letras, números, "_" e "-", começando por uma letra.';
  }
  const { tokens } = new CobolStyleLexer().tokenize(name);
  if (tokens.length !== 2 || tokens[0]!.type !== TokenType.IDENTIFIER || ChordParser.isChordSymbol(name)) {
    return `"${name}" é uma palavra reservada, nota ou acorde e não pode ser usada como nome.`;
  }
  return null;
}

export function renameSymbol(model: DocumentModel, offset: number, newName: string): RenameResult {
  const target = prepareRename(model, offset);
  if (!target) return { ok: false, error: 'Nada para renomear nesta posição.' };
  const name = newName.trim();
  const invalid = validateSymbolName(name);
  if (invalid) return { ok: false, error: invalid };

  const registry = target.kind === 'section' ? model.sections : model.controls;
  const upper = name.toUpperCase();
  if (upper !== target.placeholder && registry.has(upper)) {
    return { ok: false, error: `Já existe ${target.kind === 'section' ? 'uma SECTION' : 'um CONTROL'} chamado "${upper}".` };
  }

  const occ = findOccurrenceAt(model, offset)!;
  const info = getSymbolInfo(model, occ)!;
  const edits: TextEdit[] = [...info.definitions, ...info.references].map((o) => ({
    range: o.range,
    newText: o.quoted ? `"${name}"` : name,
  }));
  return { ok: true, edits };
}

// ---------------------------------------------------------------------------
// Hover
// ---------------------------------------------------------------------------

export interface HoverInfo {
  readonly range: TextRange;
  readonly title: string;
  readonly syntax: string;
  readonly description: string;
}

export function getHover(model: DocumentModel, offset: number): HoverInfo | null {
  const copy = findCopyAt(model, offset);
  if (copy) {
    const parts = [
      copy.sections.length ? `SECTION: ${copy.sections.join(', ')}` : null,
      copy.controls.length ? `CONTROL: ${copy.controls.join(', ')}` : null,
    ].filter(Boolean);
    return {
      range: copy.range,
      title: `COPY ${copy.resolved ?? copy.name}`,
      syntax: `COPY "${copy.name}".`,
      description: copy.resolved
        ? `Inclui ${copy.lineCount} linha${copy.lineCount === 1 ? '' : 's'} de ${copy.resolved}.${parts.length ? ` Declara — ${parts.join(' · ')}.` : ''} F12 abre o arquivo.`
        : 'Arquivo não encontrado no projeto.',
    };
  }
  const occ = findOccurrenceAt(model, offset);
  if (occ) {
    const info = getSymbolInfo(model, occ);
    if (info && info.definitions.length > 0) {
      const def = info.definitions[0]!;
      const uses = info.references.length;
      const where = `${def.file ? `Declarado em "${def.file}" (linha ${def.line}, via COPY)` : `Declarado na linha ${def.line}`} · ${uses} uso${uses === 1 ? '' : 's'}.`;
      if (info.kind === 'section') {
        return {
          range: occ.range,
          title: `SECTION ${info.name}`,
          syntax: `PERFORM ${info.name} [<N> TIMES].`,
          description: where,
        };
      }
      if (info.kind === 'control') {
        const s = info.spec;
        const parts = [
          s?.defaultValue !== undefined ? `padrão ${s.defaultValue}` : null,
          s?.min !== undefined && s?.max !== undefined ? `de ${s.min} a ${s.max}` : null,
        ].filter(Boolean);
        return {
          range: occ.range,
          title: `CONTROL ${info.name}`,
          syntax: `CONTROL ${info.name} IS SLIDER ${s?.defaultValue ?? '<padrão>'} FROM ${s?.min ?? '<min>'} TO ${s?.max ?? '<max>'}.`,
          description: `${parts.length ? `Slider ${parts.join(', ')}. ` : ''}${where}`,
        };
      }
    }
    if (info?.kind === 'track') {
      return { range: occ.range, title: `TRACK ${info.name}`, syntax: `TRACK ${info.name}.`, description: 'Faixa executada em paralelo com as demais.' };
    }
  }

  const hit = findTokenAt(model, offset);
  if (!hit) return null;
  const { token, range } = hit;

  if (token.type === TokenType.NOTE_LITERAL) {
    try {
      const note = NoteFrequency.parse(token.lexeme);
      const midi = NoteFrequency.parseToMidi(token.lexeme);
      return {
        range,
        title: `Nota ${token.lexeme}`,
        syntax: `PLAY NOTE ${token.lexeme} FOR 1 BEATS.`,
        description: `${note.frequencyHz.toFixed(2)} Hz · MIDI ${midi}.`,
      };
    } catch {
      return null;
    }
  }

  if (token.type === TokenType.IDENTIFIER && ChordParser.isChordSymbol(token.lexeme)) {
    try {
      const notes = ChordParser.parseChord(token.lexeme);
      return {
        range,
        title: `Acorde ${token.lexeme}`,
        syntax: `PLAY CHORD ${token.lexeme} FOR 2 BEATS.`,
        description: `Notas: ${notes.join(' ')}.`,
      };
    } catch {
      return null;
    }
  }

  if (token.type === TokenType.DRUM_LITERAL) {
    return {
      range,
      title: `Tambor ${token.lexeme.toUpperCase()}`,
      syntax: `PLAY DRUM ${token.lexeme.toUpperCase()} FOR 0.5 BEATS.`,
      description: 'Peça da bateria sintetizada.',
    };
  }

  if (token.type !== TokenType.IDENTIFIER && token.type !== TokenType.STRING && token.type !== TokenType.NUMBER) {
    const doc = getKeywordDoc(token.lexeme);
    if (doc) return { range, ...doc };
  }
  // COPY não é palavra reservada do lexer: aparece como identificador no começo da linha.
  if (token.type === TokenType.IDENTIFIER && token.lexeme.toUpperCase() === 'COPY' && model.copies.some((c) => c.line === token.line)) {
    return { range, ...getKeywordDoc('COPY')! };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Code actions (quick fixes)
// ---------------------------------------------------------------------------

export interface CodeAction {
  readonly title: string;
  readonly edits: TextEdit[];
  /** Ação preferida para "corrigir tudo"/atalho. */
  readonly preferred?: boolean;
}

function lineBounds(model: DocumentModel, line: number): TextRange {
  const start = model.lineStarts[Math.max(0, Math.min(line, model.lineStarts.length) - 1)] ?? 0;
  const nextStart = model.lineStarts[line];
  const raw = model.source.slice(start, nextStart ?? model.source.length);
  const end = start + raw.replace(/\r?\n$/, '').length;
  return { start, end };
}

/** Início da linha do primeiro par `<primeiro> <segundo>` (ex.: `PLAY DIVISION`) no começo de instrução. */
function findDivisionLine(model: DocumentModel, first: TokenType): { start: number; end: number } | null {
  const t = model.tokens;
  for (let i = 0; i < t.length - 1; i++) {
    if (t[i]!.type === first && t[i + 1]!.type === TokenType.DIVISION && (i === 0 || t[i - 1]!.type === TokenType.DOT)) {
      return lineBounds(model, t[i]!.line);
    }
  }
  return null;
}

function createSectionAction(model: DocumentModel, name: string): CodeAction {
  const body = `  ${name} SECTION.\n    REST FOR 1 BEAT.\n  END-SECTION.\n`;
  const procedures = findDivisionLine(model, TokenType.PROCEDURES);
  const play = findDivisionLine(model, TokenType.PLAY);
  let edit: TextEdit;
  if (procedures && play && play.start > procedures.start) {
    edit = { range: { start: play.start, end: play.start }, newText: `${body}\n` };
  } else if (play) {
    edit = { range: { start: play.start, end: play.start }, newText: `PROCEDURES DIVISION.\n${body}\n` };
  } else {
    const sep = model.source.endsWith('\n') || model.source.length === 0 ? '' : '\n';
    const at = model.source.length;
    edit = { range: { start: at, end: at }, newText: `${sep}\nPROCEDURES DIVISION.\n${body}` };
  }
  return { title: `Criar SECTION "${name}"`, edits: [edit] };
}

function createControlAction(model: DocumentModel, name: string): CodeAction {
  const decl = `  CONTROL ${name} IS SLIDER 50 FROM 0 TO 100.\n`;
  const config = findDivisionLine(model, TokenType.CONFIG);
  let edit: TextEdit;
  if (config) {
    const at = Math.min(model.source.length, config.end + (model.source[config.end] === '\r' ? 2 : 1));
    const needsNewline = model.source[config.end] === undefined;
    edit = { range: { start: at, end: at }, newText: needsNewline ? `\n${decl}` : decl };
  } else {
    const before = findDivisionLine(model, TokenType.PROCEDURES) ?? findDivisionLine(model, TokenType.PLAY);
    const at = before ? before.start : 0;
    edit = { range: { start: at, end: at }, newText: `CONFIG DIVISION.\n${decl}\n` };
  }
  return { title: `Declarar CONTROL "${name}"`, edits: [edit] };
}

const BLOCK_OPENERS = new Set<TokenType>([TokenType.REPEAT, TokenType.TRACK, TokenType.SECTION]);

function syntaxFixes(model: DocumentModel, diag: CompilationDiagnostic): CodeAction[] {
  const msg = diag.message.toLowerCase();
  const tokens = model.tokens;
  // O diagnóstico aponta para o token onde o parser percebeu o problema (geralmente o seguinte ao erro).
  const idx = tokens.findIndex((t) => t.line === diag.line && t.column === diag.column);
  const at = idx >= 0 ? tokens[idx]! : null;
  // Diagnóstico desatualizado (o texto mudou desde a compilação): não arrisca editar no lugar errado.
  if (!at || (diag.lexeme && at.lexeme.toUpperCase() !== diag.lexeme.toUpperCase())) return [];

  if (msg.includes('ponto final') || msg.includes('esperado "."')) {
    // Insere "." logo após o último token antes do ponto onde o erro foi detectado.
    const prev = idx > 0 ? tokens[idx - 1]! : null;
    if (prev && prev.type !== TokenType.DOT) {
      const end = offsetAt(model, prev.line, prev.column) + prev.lexeme.length;
      return [{ title: 'Adicionar "." no final do comando', edits: [{ range: { start: end, end }, newText: '.' }], preferred: true }];
    }
    return [];
  }

  for (const closer of ['END-TRACK', 'END-REPEAT', 'END-SECTION']) {
    if (!msg.includes(closer.toLowerCase())) continue;
    // O erro também é reportado no token que abriu o bloco: só corrigimos no ponto onde o fecho deveria estar.
    if (at && BLOCK_OPENERS.has(at.type)) return [];
    const bounds = lineBounds(model, diag.line);
    const lineText = model.source.slice(bounds.start, bounds.end);
    const indent = /^\s*/.exec(lineText)?.[0] ?? '';
    const firstOnLine = at ? lineText.slice(0, at.column - 1).trim() === '' : false;
    const edit: TextEdit = firstOnLine
      ? { range: { start: bounds.start, end: bounds.start }, newText: `${indent}${closer}.
` }
      : { range: { start: bounds.end, end: bounds.end }, newText: `
  ${closer}.` };
    return [{ title: `Adicionar "${closer}."`, edits: [edit], preferred: true }];
  }
  return [];
}

/** Ações de correção para um diagnóstico (do compilador ou do serviço de linguagem). */
export function getCodeActions(
  model: DocumentModel,
  diag: CompilationDiagnostic | LanguageDiagnostic,
): CodeAction[] {
  const code = (diag as Partial<LanguageDiagnostic>).code;
  if (code === 'undefined-section' || code === 'undefined-control') {
    const d = diag as LanguageDiagnostic;
    const actions: CodeAction[] = (d.suggestions ?? []).map((s, i) => ({
      title: `Trocar por "${s}"`,
      edits: [{ range: d.range, newText: s }],
      preferred: i === 0,
    }));
    actions.push(code === 'undefined-section' ? createSectionAction(model, d.symbolName) : createControlAction(model, d.symbolName));
    return actions;
  }
  if (code === 'unresolved-copy') {
    const d = diag as LanguageDiagnostic;
    const copy = model.copies.find((c) => c.line === d.line);
    return (d.suggestions ?? []).map((name, i) => ({
      title: `Trocar por "${name}"`,
      edits: [{ range: d.range, newText: copy?.quoted === false ? name.replace(/\.sythm$/i, '') : `"${name}"` }],
      preferred: i === 0,
    }));
  }
  if (code === 'duplicate-section' || code === 'duplicate-control') {
    const d = diag as LanguageDiagnostic;
    return [
      {
        title: `Renomear para "${d.symbolName}-2"`,
        edits: [{ range: d.range, newText: `${d.symbolName}-2` }],
      },
    ];
  }
  return syntaxFixes(model, diag);
}

// ---------------------------------------------------------------------------
// Diagnósticos combinados
// ---------------------------------------------------------------------------

const COPY_NOT_FOUND = /^COPY "[^"]*": (arquivo não encontrado|nenhum projeto)/;
const COVERED_BY_SEMANTIC = /n[ãa]o encontrada para PERFORM|n[ãa]o foi declarado/i;

/**
 * Junta os diagnósticos do compilador com os semânticos do serviço de linguagem,
 * descartando os do compilador que o serviço já cobre (mesma linha), para não duplicar.
 */
export function mergeDiagnostics(
  source: string,
  compilerDiagnostics: readonly CompilationDiagnostic[],
  context?: LanguageContext,
): Array<CompilationDiagnostic | LanguageDiagnostic> {
  const model = analyzeDocument(source, context);
  const semanticLines = new Set(
    model.diagnostics.filter((d) => d.code === 'undefined-section' || d.code === 'undefined-control').map((d) => d.line),
  );
  const copyLines = new Set(model.diagnostics.filter((d) => d.code === 'unresolved-copy').map((d) => d.line));
  const kept = compilerDiagnostics.filter(
    (d) =>
      !(COVERED_BY_SEMANTIC.test(d.message) && semanticLines.has(d.line)) &&
      !(COPY_NOT_FOUND.test(d.message) && copyLines.has(d.line)),
  );
  return [...kept, ...model.diagnostics];
}

/** Nomes declarados para autocomplete (`PERFORM <...>`, valores de parâmetros). */
export function getDeclaredNames(
  source: string,
  context?: LanguageContext,
): { sections: string[]; controls: string[] } {
  const model = analyzeDocument(source, context);
  const declared = (m: ReadonlyMap<string, SymbolInfo>) => [...m.values()].filter((s) => s.definitions.length > 0).map((s) => s.name);
  return { sections: declared(model.sections), controls: declared(model.controls) };
}

export { offsetAt, positionAt };
