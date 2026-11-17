import type {
  CompilationDiagnostic,
  CompilationResult,
  ControlDescriptor,
  ExecutionPlan,
} from '../../domain/entities/ExecutionPlan.js';

/** Arquivo resolvido por um `COPY`. `name` é o nome canônico (usado em mensagens e para detectar ciclos). */
export interface CopySource {
  readonly name: string;
  readonly code: string;
}

/** Resolve o nome citado em `COPY "nome".` para o conteúdo do arquivo, ou `null` se não existir. */
export type CopyResolver = (name: string) => CopySource | null;

export const MAX_COPY_DEPTH = 8;
export const MAX_EXPANDED_LINES = 20_000;

/** `COPY "arquivo.sythm".` ou `COPY arquivo.` sozinho na linha (comentário `*>` opcional no final). */
const COPY_LINE = /^(\s*)COPY\s+(?:"([^"\r\n]+)"|([A-Za-z0-9_-]+))\s*\.\s*(?:\*>.*)?$/i;

export interface CopyStatement {
  /** Nome como escrito no código (sem aspas). */
  readonly name: string;
  readonly indent: string;
}

/** Interpreta uma linha como `COPY`, ou devolve `null`. */
export function parseCopyLine(line: string): CopyStatement | null {
  const m = COPY_LINE.exec(line);
  if (!m) return null;
  return { name: (m[2] ?? m[3])!.trim(), indent: m[1] ?? '' };
}

export function hasCopyStatements(source: string): boolean {
  return /^\s*COPY\s/im.test(source) && source.split('\n').some((l) => COPY_LINE.test(l.replace(/\r$/, '')));
}

interface LineOrigin {
  /** `null` = arquivo principal. */
  readonly file: string | null;
  /** Linha (1-based) no arquivo de origem. */
  readonly line: number;
  /** Linha (1-based) do `COPY` de nível mais alto no arquivo principal. */
  readonly anchorLine: number;
}

export interface CopyExpansion {
  /** Texto com os `COPY` substituídos pelo conteúdo dos arquivos. */
  readonly text: string;
  /** Origem de cada linha de `text` (índice 0 = linha 1). */
  readonly origins: readonly LineOrigin[];
  /** Erros de resolução (arquivo inexistente, ciclo, limites). Posições no arquivo principal. */
  readonly diagnostics: CompilationDiagnostic[];
  /** Nomes canônicos de todos os arquivos incluídos. */
  readonly files: readonly string[];
  readonly hasCopy: boolean;
}

/**
 * Expande os `COPY` do `source`. Sem `resolve`, cada `COPY` vira um erro e a linha é
 * substituída por uma linha vazia (as demais linhas mantêm a numeração).
 */
export function expandCopies(
  source: string,
  resolve?: CopyResolver,
  /** Nome do arquivo que está sendo expandido: um COPY dele para si mesmo é circular. */
  rootName?: string,
): CopyExpansion {
  const diagnostics: CompilationDiagnostic[] = [];
  const files = new Set<string>();
  const out: string[] = [];
  const origins: LineOrigin[] = [];
  let hasCopy = false;

  const fail = (anchorLine: number, indent: string, message: string, lexeme: string) => {
    diagnostics.push({
      severity: 'error',
      message,
      line: anchorLine,
      column: indent.length + 1,
      lexeme,
    });
  };

  const emit = (
    text: string,
    file: string | null,
    stack: readonly string[],
    anchorLine: number,
  ): void => {
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNo = i + 1;
      const anchor = file === null ? lineNo : anchorLine;
      const copy = parseCopyLine(line);

      if (!copy) {
        out.push(line);
        origins.push({ file, line: lineNo, anchorLine: anchor });
        continue;
      }

      hasCopy = true;
      const where = file === null ? '' : `[${file}:${lineNo}] `;
      const blank = () => {
        out.push('');
        origins.push({ file, line: lineNo, anchorLine: anchor });
      };

      if (!resolve) {
        fail(anchor, copy.indent, `${where}COPY "${copy.name}": nenhum projeto disponível para resolver arquivos.`, 'COPY');
        blank();
        continue;
      }
      const target = resolve(copy.name);
      if (!target) {
        fail(anchor, copy.indent, `${where}COPY "${copy.name}": arquivo não encontrado no projeto.`, copy.name);
        blank();
        continue;
      }
      if (stack.includes(target.name)) {
        fail(anchor, copy.indent, `${where}COPY circular detectado: ${[...stack, target.name].join(' → ')}.`, copy.name);
        blank();
        continue;
      }
      if (stack.length >= MAX_COPY_DEPTH) {
        fail(anchor, copy.indent, `${where}Profundidade máxima de COPY (${MAX_COPY_DEPTH}) excedida.`, copy.name);
        blank();
        continue;
      }
      if (out.length >= MAX_EXPANDED_LINES) {
        fail(anchor, copy.indent, `${where}Limite de ${MAX_EXPANDED_LINES} linhas após expandir COPY excedido.`, copy.name);
        blank();
        continue;
      }
      files.add(target.name);
      emit(target.code, target.name, [...stack, target.name], anchor);
    }
  };

  emit(source, null, rootName ? [rootName] : [], 0);
  // Dedup: um mesmo COPY problemático dentro de laços de includes não deve repetir o erro.
  const unique = diagnostics.filter(
    (d, i) => diagnostics.findIndex((x) => x.line === d.line && x.message === d.message) === i,
  );
  return { text: out.join('\n'), origins, diagnostics: unique, files: [...files], hasCopy };
}

const PREFIX = /^\[[^\]]+:\d+\] /;

/**
 * Traduz as linhas de um resultado compilado sobre o texto expandido de volta para o
 * arquivo principal. Trechos vindos de arquivos incluídos apontam para a linha do `COPY`.
 * Tokens e AST permanecem nas coordenadas do texto expandido (usados só no painel de debug).
 */
export function remapCompilationResult(
  result: CompilationResult,
  expansion: CopyExpansion,
): CompilationResult {
  if (!expansion.hasCopy) return result;
  const { origins } = expansion;
  const originOf = (line: number): LineOrigin | undefined => origins[line - 1];
  const mapLine = (line: number): number => originOf(line)?.anchorLine ?? line;

  const diagnostics: CompilationDiagnostic[] = result.diagnostics.map((d) => {
    const o = originOf(d.line);
    if (!o) return d;
    if (o.file === null) return { ...d, line: o.line };
    return {
      ...d,
      message: PREFIX.test(d.message) ? d.message : `[${o.file}:${o.line}] ${d.message}`,
      line: o.anchorLine,
      column: 1,
    };
  });

  // Um COPY que não pôde ser resolvido é erro: o programa estaria incompleto.
  const copyFailed = expansion.diagnostics.some((d) => d.severity === 'error');
  const plan = copyFailed ? null : result.plan ? remapPlan(result.plan, mapLine, originOf) : result.plan;
  return {
    ...result,
    success: result.success && !copyFailed,
    plan,
    diagnostics: [...expansion.diagnostics, ...diagnostics],
  };
}

function remapPlan(
  plan: ExecutionPlan,
  mapLine: (line: number) => number,
  originOf: (line: number) => LineOrigin | undefined,
): ExecutionPlan {
  const controls: ControlDescriptor[] = plan.controls.map((c) => ({
    ...c,
    declarationLine: mapLine(c.declarationLine),
    sourceFile: originOf(c.declarationLine)?.file ?? undefined,
    usageLines: [...new Set(c.usageLines.map(mapLine))],
    bindings: c.bindings.map((b) => ({ ...b, line: mapLine(b.line) })),
  }));
  return {
    ...plan,
    events: plan.events.map((e) => ({ ...e, line: mapLine(e.line) })),
    logs: plan.logs.map((l) => (l.line === undefined ? l : { ...l, line: mapLine(l.line) })),
    controls,
  };
}
