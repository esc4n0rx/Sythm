/**
 * Parser (Analisador Sintático) para a linguagem Sythm
 */

import { Token, TokenType } from './lexer';
import { ASTNode, ProgramNode, createNode } from './ast';

export class SythmParseError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number,
    public token?: Token
  ) {
    super(`Parse error at line ${line}, column ${column}: ${message}`);
    this.name = 'SythmParseError';
  }
}

export class SythmParser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * Faz o parsing completo do código
   */
  parse(): ProgramNode {
    const statements: ASTNode[] = [];
    
    while (!this.isAtEnd()) {
      // Pula newlines vazios
      if (this.check(TokenType.NEWLINE)) {
        this.advance();
        continue;
      }
      
      const stmt = this.parseStatement();
      if (stmt) {
        statements.push(stmt);
      }
    }
    
    return createNode.program(statements);
  }

  /**
   * Faz parsing de uma declaração/comando
   */
  private parseStatement(): ASTNode | null {
    try {
      // Comentários
      if (this.check(TokenType.COMMENT)) {
        return this.parseComment();
      }
      
      // Comandos de tempo
      if (this.check(TokenType.SLOW)) {
        return this.parseSlow();
      }
      
      if (this.check(TokenType.FAST)) {
        return this.parseFast();
      }
      
      // Rest (pausa)
      if (this.check(TokenType.REST)) {
        return this.parseRest();
      }
      
      // Notas musicais
      if (this.check(TokenType.NOTE)) {
        return this.parseNote();
      }
      
      // Token inesperado
      if (!this.check(TokenType.EOF)) {
        const token = this.peek();
        throw new SythmParseError(
          `Unexpected token: ${token.value}`,
          token.line,
          token.column,
          token
        );
      }
      
      return null;
    } catch (error) {
      // Em caso de erro, tenta se recuperar pulando até a próxima linha
      this.synchronize();
      throw error;
    }
  }

  /**
   * Parse de comentário
   */
  private parseComment(): ASTNode {
    const token = this.advance();
    this.consumeNewlineOrEOF();
    return createNode.comment(token.value, token.line, token.column);
  }

  /**
   * Parse do comando slow
   */
  private parseSlow(): ASTNode {
    const token = this.advance();
    this.consumeNewlineOrEOF();
    return createNode.slow(token.line, token.column);
  }

  /**
   * Parse do comando fast
   */
  private parseFast(): ASTNode {
    const token = this.advance();
    this.consumeNewlineOrEOF();
    return createNode.fast(token.line, token.column);
  }

  /**
   * Parse do comando rest
   */
  private parseRest(): ASTNode {
    const token = this.advance();
    let duration: number | undefined;
    
    // Verifica se tem duração especificada
    if (this.check(TokenType.NUMBER)) {
      const durationToken = this.advance();
      duration = parseFloat(durationToken.value);
    }
    
    this.consumeNewlineOrEOF();
    return createNode.rest(duration, token.line, token.column);
  }

  /**
   * Parse de nota musical
   */
  private parseNote(): ASTNode {
    const token = this.advance();
    let duration: number | undefined;
    
    // Verifica se tem duração especificada
    if (this.check(TokenType.NUMBER)) {
      const durationToken = this.advance();
      duration = parseFloat(durationToken.value);
    }
    
    this.consumeNewlineOrEOF();
    return createNode.note(token.value, duration, token.line, token.column);
  }

  /**
   * Consome newline ou EOF - VERSÃO MAIS FLEXÍVEL
   */
  private consumeNewlineOrEOF(): void {
    if (this.check(TokenType.NEWLINE)) {
      this.advance();
    } else if (this.check(TokenType.EOF)) {
      // EOF é válido, não precisa consumir
      return;
    } else {
      // Verifica se o próximo token é um comando válido
      // Se for, assume quebra de linha implícita
      const nextToken = this.peek();
      if (this.isValidStatementStart(nextToken)) {
        return; // Permite statements consecutivos sem newline explícito
      }
      
      throw new SythmParseError(
        'Expected newline or end of file',
        nextToken.line,
        nextToken.column,
        nextToken
      );
    }
  }

  /**
   * Verifica se um token pode iniciar uma nova declaração
   */
  private isValidStatementStart(token: Token): boolean {
    return token.type === TokenType.NOTE ||
           token.type === TokenType.REST ||
           token.type === TokenType.SLOW ||
           token.type === TokenType.FAST ||
           token.type === TokenType.COMMENT ||
           token.type === TokenType.EOF;
  }

  /**
   * Recuperação de erro - pula até a próxima linha ou comando válido
   */
  private synchronize(): void {
    while (!this.isAtEnd()) {
      const current = this.peek();
      
      // Se encontrou newline ou início de comando válido, para
      if (current.type === TokenType.NEWLINE || this.isValidStatementStart(current)) {
        return;
      }
      
      this.advance();
    }
  }

  /**
   * Utilitários do parser
   */
  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.previous();
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }
}