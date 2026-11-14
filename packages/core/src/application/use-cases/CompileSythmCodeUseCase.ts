import type { CompilationDiagnostic, CompilationResult } from '../../domain/entities/ExecutionPlan.js';
import type { IExecutionPlanner } from '../ports/IExecutionPlanner.js';
import type { ILexer } from '../ports/ILexer.js';
import type { IParser } from '../ports/IParser.js';

export class CompileSythmCodeUseCase {
  constructor(
    private readonly lexer: ILexer,
    private readonly parser: IParser,
    private readonly planner: IExecutionPlanner,
  ) {}

  execute(source: string): CompilationResult {
    const diagnostics: CompilationDiagnostic[] = [];

    const lexResult = this.lexer.tokenize(source);
    diagnostics.push(...lexResult.diagnostics);

    const parseResult = this.parser.parse(lexResult.tokens);
    diagnostics.push(...parseResult.diagnostics);

    if (!parseResult.ast || parseResult.diagnostics.some((d) => d.severity === 'error')) {
      return {
        success: false,
        tokens: lexResult.tokens,
        ast: parseResult.ast,
        plan: null,
        diagnostics,
      };
    }

    const planResult = this.planner.buildPlan(parseResult.ast);
    diagnostics.push(...planResult.diagnostics);

    const hasError = diagnostics.some((d) => d.severity === 'error');
    return {
      success: !hasError && planResult.plan !== null,
      tokens: lexResult.tokens,
      ast: parseResult.ast,
      plan: hasError ? null : planResult.plan,
      diagnostics,
    };
  }
}
