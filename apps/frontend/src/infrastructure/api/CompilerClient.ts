import {
  type CompilationResult,
  type CompileOptions,
  compileSythmCode,
  expandCopies,
  remapCompilationResult,
} from '@sythm/core';

export interface CompileResponse extends CompilationResult {
  source: 'backend' | 'local';
  durationMs: number;
}

/**
 * Compila no backend (com fallback local). Os `COPY` são expandidos aqui, no cliente, porque só o
 * navegador conhece os arquivos do projeto; o backend recebe o texto já expandido e o resultado
 * volta com as linhas traduzidas para o arquivo aberto.
 */
export async function compileWithBackendOrFallback(
  code: string,
  options: CompileOptions = {},
): Promise<CompileResponse> {
  const start = performance.now();
  const expansion = expandCopies(code, options.resolveCopy, options.rootName);
  const sourceText = expansion.hasCopy ? expansion.text : code;

  try {
    const response = await fetch('/api/compile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: sourceText }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const raw = (await response.json()) as CompilationResult & { durationMs?: number };
    const data = remapCompilationResult(raw, expansion);
    return {
      ...data,
      source: 'backend',
      durationMs: raw.durationMs ?? Math.round((performance.now() - start) * 100) / 100,
    };
  } catch {
    const localResult = compileSythmCode(code, options);
    return {
      ...localResult,
      source: 'local',
      durationMs: Math.round((performance.now() - start) * 100) / 100,
    };
  }
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch('/api/health');
    return response.ok;
  } catch {
    return false;
  }
}
