import { type CompilationResult, compileSythmCode } from '@sythm/core';

export interface CompileResponse extends CompilationResult {
  source: 'backend' | 'local';
  durationMs: number;
}

export async function compileWithBackendOrFallback(code: string): Promise<CompileResponse> {
  const start = performance.now();

  try {
    const response = await fetch('/api/compile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as CompilationResult & { durationMs?: number };
    return {
      ...data,
      source: 'backend',
      durationMs: data.durationMs ?? Math.round((performance.now() - start) * 100) / 100,
    };
  } catch {
    const localResult = compileSythmCode(code);
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
