import type { ProgramNode } from '../../domain/entities/Ast.js';
import type { CompilationDiagnostic } from '../../domain/entities/ExecutionPlan.js';
import type { Token } from '../../domain/entities/Token.js';

export interface ParserResult {
  readonly ast: ProgramNode | null;
  readonly diagnostics: CompilationDiagnostic[];
}

export interface IParser {
  parse(tokens: Token[]): ParserResult;
}
