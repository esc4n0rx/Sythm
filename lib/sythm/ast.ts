/**
 * AST (Abstract Syntax Tree) para a linguagem Sythm
 */

/**
 * Tipos base para o AST
 */
export interface BaseNode {
  line?: number
  column?: number
}

export type ASTNode =
  | ProgramNode
  | NoteNode
  | RestNode
  | SlowNode
  | FastNode
  | CommentNode
  | ChordNode
  | LoopNode
  | GroupNode
  | InstrumentNode
  | TrackNode
  | PatternNode
  | PatternReferenceNode

/**
 * Nó raiz do programa
 */
export interface ProgramNode extends BaseNode {
  type: 'Program'
  body: ASTNode[]
}

/**
 * Nó de nota musical
 */
export interface NoteNode extends BaseNode {
  type: 'Note'
  note: string // ex: "C4", "F#5", "Bb3"
  duration?: number // duração em beats (ex: 1, 0.5, 2)
}

/**
 * Nó de pausa
 */
export interface RestNode extends BaseNode {
  type: 'Rest'
  duration?: number // duração em beats
}

/**
 * Nó de comando slow
 */
export interface SlowNode extends BaseNode {
  type: 'Slow'
}

/**
 * Nó de comando fast
 */
export interface FastNode extends BaseNode {
  type: 'Fast'
}

/**
 * Nó de comentário
 */
export interface CommentNode extends BaseNode {
  type: 'Comment'
  content: string
}

/**
 * Nó de acorde
 */
export interface ChordNode extends BaseNode {
  type: 'Chord'
  notes: string[] // array de notas, ex: ["C4", "E4", "G4"]
  duration?: number
}

/**
 * Nó de loop
 */
export interface LoopNode extends BaseNode {
  type: 'Loop'
  iterations: number // quantas vezes repetir
  body: ASTNode[] // comandos dentro do loop (pode conter PatternReferenceNode)
}

/**
 * Nó de grupo com multiplicador
 */
export interface GroupNode extends BaseNode {
  type: 'Group'
  body: ASTNode[] // comandos dentro do grupo
  multiplier?: number // quantas vezes repetir o grupo
}

/**
 * Nó de instrumento
 */
export interface InstrumentNode extends BaseNode {
  type: 'Instrument'
  instrument: string // nome do instrumento (ex: "kick", "snare", "lead")
}

/**
 * Nó de track (multitrack)
 */
export interface TrackNode extends BaseNode {
  type: 'Track'
  name: string // nome da track
  body: ASTNode[] // comandos da track
}

/**
 * Nó de pattern (template reutilizável)
 */
export interface PatternNode extends BaseNode {
  type: 'Pattern'
  name: string // nome do pattern
  body: ASTNode[] // comandos do pattern
}

/**
 * Nó de referência a pattern
 */
export interface PatternReferenceNode extends BaseNode {
  type: 'PatternReference'
  name: string // nome do pattern a ser referenciado
}

/**
 * Utilitário para criar nós AST.
 */
export const createNode = {
  program: (body: ASTNode[]): ProgramNode => ({
    type: 'Program',
    body,
  }),

  note: (
    note: string,
    duration?: number,
    line?: number,
    column?: number,
  ): NoteNode => ({
    type: 'Note',
    note,
    duration,
    line,
    column,
  }),

  rest: (duration?: number, line?: number, column?: number): RestNode => ({
    type: 'Rest',
    duration,
    line,
    column,
  }),

  slow: (line?: number, column?: number): SlowNode => ({
    type: 'Slow',
    line,
    column,
  }),

  fast: (line?: number, column?: number): FastNode => ({
    type: 'Fast',
    line,
    column,
  }),

  comment: (
    content: string,
    line?: number,
    column?: number,
  ): CommentNode => ({
    type: 'Comment',
    content,
    line,
    column,
  }),

  chord: (
    notes: string[],
    duration?: number,
    line?: number,
    column?: number,
  ): ChordNode => ({
    type: 'Chord',
    notes,
    duration,
    line,
    column,
  }),

  loop: (
    iterations: number,
    body: ASTNode[],
    line?: number,
    column?: number,
  ): LoopNode => ({
    type: 'Loop',
    iterations,
    body,
    line,
    column,
  }),

  group: (
    body: ASTNode[],
    multiplier?: number,
    line?: number,
    column?: number,
  ): GroupNode => ({
    type: 'Group',
    body,
    multiplier,
    line,
    column,
  }),

  instrument: (
    instrument: string,
    line?: number,
    column?: number,
  ): InstrumentNode => ({
    type: 'Instrument',
    instrument,
    line,
    column,
  }),

  track: (
    name: string,
    body: ASTNode[],
    line?: number,
    column?: number,
  ): TrackNode => ({
    type: 'Track',
    name,
    body,
    line,
    column,
  }),

  pattern: (
    name: string,
    body: ASTNode[],
    line?: number,
    column?: number,
  ): PatternNode => ({
    type: 'Pattern',
    name,
    body,
    line,
    column,
  }),

  patternReference: (
    name: string,
    line?: number,
    column?: number,
  ): PatternReferenceNode => ({
    type: 'PatternReference',
    name,
    line,
    column,
  }),
}