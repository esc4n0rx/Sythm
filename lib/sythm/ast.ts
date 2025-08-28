/**
 * Definições do Abstract Syntax Tree (AST) para a linguagem Sythm
 */

export type ASTNode = 
  | NoteNode 
  | RestNode 
  | SlowNode 
  | FastNode 
  | CommentNode
  | ChordNode
  | LoopNode
  | GroupNode
  | ProgramNode;

export interface BaseNode {
  type: string;
  line?: number;
  column?: number;
}

/**
 * Nó raiz do programa
 */
export interface ProgramNode extends BaseNode {
  type: 'Program';
  body: ASTNode[];
}

/**
 * Nó para tocar uma nota musical
 */
export interface NoteNode extends BaseNode {
  type: 'Note';
  note: string; // ex: "C4", "F#5"
  duration?: number; // duração em beats (opcional, padrão 1)
}

/**
 * Nó para pausa/silêncio
 */
export interface RestNode extends BaseNode {
  type: 'Rest';
  duration?: number; // duração em beats (opcional, padrão 1)
}

/**
 * Nó para diminuir o tempo (50% mais lento)
 */
export interface SlowNode extends BaseNode {
  type: 'Slow';
}

/**
 * Nó para aumentar o tempo (50% mais rápido)
 */
export interface FastNode extends BaseNode {
  type: 'Fast';
}

/**
 * Nó para comentários
 */
export interface CommentNode extends BaseNode {
  type: 'Comment';
  content: string;
}

/**
 * Nó para acordes (múltiplas notas simultâneas)
 */
export interface ChordNode extends BaseNode {
  type: 'Chord';
  notes: string[]; // ex: ["C4", "E4", "G4"]
  duration?: number; // duração em beats (opcional, padrão 1)
}

/**
 * Nó para loops/repetições
 */
export interface LoopNode extends BaseNode {
  type: 'Loop';
  iterations: number; // quantas vezes repetir
  body: ASTNode[]; // comandos a repetir
}

/**
 * Nó para agrupamento com multiplicação (C4 D4) * 2
 */
export interface GroupNode extends BaseNode {
  type: 'Group';
  body: ASTNode[]; // comandos agrupados
  multiplier?: number; // quantas vezes repetir (opcional)
}

/**
 * Utilitário para criar nós AST
 */
export const createNode = {
  program: (body: ASTNode[]): ProgramNode => ({
    type: 'Program',
    body
  }),
  
  note: (note: string, duration?: number, line?: number, column?: number): NoteNode => ({
    type: 'Note',
    note,
    duration,
    line,
    column
  }),
  
  rest: (duration?: number, line?: number, column?: number): RestNode => ({
    type: 'Rest',
    duration,
    line,
    column
  }),
  
  slow: (line?: number, column?: number): SlowNode => ({
    type: 'Slow',
    line,
    column
  }),
  
  fast: (line?: number, column?: number): FastNode => ({
    type: 'Fast',
    line,
    column
  }),
  
  comment: (content: string, line?: number, column?: number): CommentNode => ({
    type: 'Comment',
    content,
    line,
    column
  }),

  chord: (notes: string[], duration?: number, line?: number, column?: number): ChordNode => ({
    type: 'Chord',
    notes,
    duration,
    line,
    column
  }),

  loop: (iterations: number, body: ASTNode[], line?: number, column?: number): LoopNode => ({
    type: 'Loop',
    iterations,
    body,
    line,
    column
  }),

  group: (body: ASTNode[], multiplier?: number, line?: number, column?: number): GroupNode => ({
    type: 'Group',
    body,
    multiplier,
    line,
    column
  })
};