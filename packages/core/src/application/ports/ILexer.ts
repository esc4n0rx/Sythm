import type { CompilationDiagnostic } from '../../domain/entities/ExecutionPlan.js';
import type { Token } from '../../domain/entities/Token.js';

export interface LexerResult {
  readonly tokens: Token[];
  readonly diagnostics: CompilationDiagnostic[];
}

export interface ILexer {
  tokenize(source: string): LexerResult;
}
