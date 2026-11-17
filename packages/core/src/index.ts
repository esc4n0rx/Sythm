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
export * from './infrastructure/compiler/CopyPreprocessor.js';
export * from './infrastructure/presets/DefaultPresets.js';

// Language Service (autocomplete de símbolos, hover, definição, rename, quick-fixes)
export * from './language-service/analyzer.js';
export * from './language-service/features.js';
export * from './language-service/keywordDocs.js';

import { CompileSythmCodeUseCase } from './application/use-cases/CompileSythmCodeUseCase.js';
import type { CompilationResult } from './domain/entities/ExecutionPlan.js';
import { CobolStyleLexer } from './infrastructure/compiler/CobolStyleLexer.js';
import { CobolStyleParser } from './infrastructure/compiler/CobolStyleParser.js';
import {
  type CopyResolver,
  expandCopies,
  hasCopyStatements,
  remapCompilationResult,
} from './infrastructure/compiler/CopyPreprocessor.js';
import { TimelineExecutionPlanner } from './infrastructure/compiler/TimelineExecutionPlanner.js';

export function createSythmCompiler(): CompileSythmCodeUseCase {
  return new CompileSythmCodeUseCase(
    new CobolStyleLexer(),
    new CobolStyleParser(),
    new TimelineExecutionPlanner(),
  );
}

export interface CompileOptions {
  /** Resolve `COPY "arquivo".` (ex.: arquivos do projeto). Sem ele, qualquer COPY vira erro. */
  readonly resolveCopy?: CopyResolver;
  /** Nome do arquivo sendo compilado (para detectar COPY circular de si mesmo). */
  readonly rootName?: string;
}

export function compileSythmCode(source: string, options: CompileOptions = {}): CompilationResult {
  const compiler = createSythmCompiler();
  if (!hasCopyStatements(source)) return compiler.execute(source);
  const expansion = expandCopies(source, options.resolveCopy, options.rootName);
  return remapCompilationResult(compiler.execute(expansion.text), expansion);
}
