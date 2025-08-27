/**
 * Definições do Abstract Syntax Tree (AST) para a linguagem Sythm
 */

export type ASTNode = 
  | NoteNode 
  | RestNode 
  | SlowNode 
  | FastNode 
  | CommentNode
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
  })
};