import type { ProgramNode } from '../../domain/entities/Ast.js';
import type { CompilationDiagnostic, ExecutionPlan } from '../../domain/entities/ExecutionPlan.js';

export interface PlannerResult {
  readonly plan: ExecutionPlan | null;
  readonly diagnostics: CompilationDiagnostic[];
}

export interface IExecutionPlanner {
  buildPlan(ast: ProgramNode): PlannerResult;
}
