// Domain Entities & Value Objects
export * from './domain/entities/Token.js';
export * from './domain/entities/Ast.js';
export * from './domain/entities/ExecutionPlan.js';
export * from './domain/value-objects/NoteFrequency.js';
export * from './domain/value-objects/ChordParser.js';

// Application Ports & Use Cases
export * from './application/ports/ILexer.js';
export * from './application/ports/IParser.js';
export * from './application/ports/IExecutionPlanner.js';
export * from './application/use-cases/CompileSythmCodeUseCase.js';

// Infrastructure Implementations
export * from './infrastructure/compiler/CobolStyleLexer.js';
export * from './infrastructure/compiler/CobolStyleParser.js';
export * from './infrastructure/compiler/TimelineExecutionPlanner.js';
export * from './infrastructure/presets/DefaultPresets.js';

import { CompileSythmCodeUseCase } from './application/use-cases/CompileSythmCodeUseCase.js';
import type { CompilationResult } from './domain/entities/ExecutionPlan.js';
import { CobolStyleLexer } from './infrastructure/compiler/CobolStyleLexer.js';
import { CobolStyleParser } from './infrastructure/compiler/CobolStyleParser.js';
import { TimelineExecutionPlanner } from './infrastructure/compiler/TimelineExecutionPlanner.js';

export function createSythmCompiler(): CompileSythmCodeUseCase {
  return new CompileSythmCodeUseCase(
    new CobolStyleLexer(),
    new CobolStyleParser(),
    new TimelineExecutionPlanner(),
  );
}

export function compileSythmCode(source: string): CompilationResult {
  return createSythmCompiler().execute(source);
}
