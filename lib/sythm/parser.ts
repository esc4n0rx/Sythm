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

      // Loop
      if (this.check(TokenType.LOOP)) {
        return this.parseLoop();
      }

      // Acorde [C4 E4 G4]
      if (this.check(TokenType.LBRACKET)) {
        return this.parseChord();
      }

      // Grupo (C4 D4) * 2
      if (this.check(TokenType.LPAREN)) {
        return this.parseGroup();
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
    
    // Se não estamos dentro de um grupo, consome newline
    if (!this.isInsideGroup()) {
      this.consumeNewlineOrEOF();
    }
    
    return createNode.rest(duration, token.line, token.column);
  }

  /**
   * Parse do comando loop
   */
  private parseLoop(): ASTNode {
    const loopToken = this.advance(); // consome 'loop'
    
    // Espera número de iterações
    if (!this.check(TokenType.NUMBER)) {
      throw new SythmParseError(
        'Expected number after "loop"',
        this.peek().line,
        this.peek().column,
        this.peek()
      );
    }
    
    const iterationsToken = this.advance();
    const iterations = parseInt(iterationsToken.value);
    
    // Espera '{'
    if (!this.check(TokenType.LBRACE)) {
      throw new SythmParseError(
        'Expected "{" after loop iterations',
        this.peek().line,
        this.peek().column,
        this.peek()
      );
    }
    
    this.advance(); // consome '{'
    
    // Parse do corpo do loop
    const body: ASTNode[] = [];
    
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      // Pula newlines dentro do loop
      if (this.check(TokenType.NEWLINE)) {
        this.advance();
        continue;
      }
      
      const stmt = this.parseStatement();
      if (stmt) {
        body.push(stmt);
      }
    }
    
    // Espera '}'
    if (!this.check(TokenType.RBRACE)) {
      throw new SythmParseError(
        'Expected "}" to close loop',
        this.peek().line,
        this.peek().column,
        this.peek()
      );
    }
    
    this.advance(); // consome '}'
    this.consumeNewlineOrEOF();
    
    return createNode.loop(iterations, body, loopToken.line, loopToken.column);
  }

  /**
   * Parse de acorde [C4 E4 G4]
   */
  private parseChord(): ASTNode {
    const bracketToken = this.advance(); // consome '['
    const notes: string[] = [];
    
    // Parse das notas dentro do acorde
    while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
      if (this.check(TokenType.NOTE)) {
        const noteToken = this.advance();
        notes.push(noteToken.value);
      } else {
        throw new SythmParseError(
          'Expected note in chord',
          this.peek().line,
          this.peek().column,
          this.peek()
        );
      }
    }
    
    if (notes.length === 0) {
      throw new SythmParseError(
        'Chord cannot be empty',
        bracketToken.line,
        bracketToken.column,
        bracketToken
      );
    }
    
    // Espera ']'
    if (!this.check(TokenType.RBRACKET)) {
      throw new SythmParseError(
        'Expected "]" to close chord',
        this.peek().line,
        this.peek().column,
        this.peek()
      );
    }
    
    this.advance(); // consome ']'
    
    // Verifica se tem duração especificada
    let duration: number | undefined;
    if (this.check(TokenType.NUMBER)) {
      const durationToken = this.advance();
      duration = parseFloat(durationToken.value);
    }
    
    // Se não estamos dentro de um grupo, consome newline
    if (!this.isInsideGroup()) {
      this.consumeNewlineOrEOF();
    }
    
    return createNode.chord(notes, duration, bracketToken.line, bracketToken.column);
  }

  /**
   * Parse de grupo (C4 D4) * 2
   */
  private parseGroup(): ASTNode {
    const parenToken = this.advance(); // consome '('
    const body: ASTNode[] = [];
    
    // Parse dos elementos dentro do grupo
    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      // Pula espaços em branco, mas não newlines (podem ser significativos)
      if (this.check(TokenType.NEWLINE)) {
        this.advance();
        continue;
      }
      
      // Parse de diferentes tipos de elementos
      let element: ASTNode | null = null;
      
      if (this.check(TokenType.NOTE)) {
        element = this.parseNoteInGroup();
      } else if (this.check(TokenType.REST)) {
        element = this.parseRestInGroup();
      } else if (this.check(TokenType.LBRACKET)) {
        element = this.parseChordInGroup();
      } else if (this.check(TokenType.SLOW)) {
        element = this.parseSlow();
      } else if (this.check(TokenType.FAST)) {
        element = this.parseFast();
      } else {
        throw new SythmParseError(
          'Expected note, chord, rest, slow, or fast in group',
          this.peek().line,
          this.peek().column,
          this.peek()
        );
      }
      
      if (element) {
        body.push(element);
      }
    }
    
    if (body.length === 0) {
      throw new SythmParseError(
        'Group cannot be empty',
        parenToken.line,
        parenToken.column,
        parenToken
      );
    }
    
    // Espera ')'
    if (!this.check(TokenType.RPAREN)) {
      throw new SythmParseError(
        'Expected ")" to close group',
        this.peek().line,
        this.peek().column,
        this.peek()
      );
    }
    
    this.advance(); // consome ')'
    
    // Verifica se tem multiplicador
    let multiplier: number | undefined;
    if (this.check(TokenType.ASTERISK)) {
      this.advance(); // consome '*'
      
      if (!this.check(TokenType.NUMBER)) {
        throw new SythmParseError(
          'Expected number after "*"',
          this.peek().line,
          this.peek().column,
          this.peek()
        );
      }
      
      const multiplierToken = this.advance();
      multiplier = parseInt(multiplierToken.value);
    }
    
    this.consumeNewlineOrEOF();
    return createNode.group(body, multiplier, parenToken.line, parenToken.column);
  }

  /**
   * Parse de nota dentro de grupo (não consome newline)
   */
  private parseNoteInGroup(): ASTNode {
    const token = this.advance();
    let duration: number | undefined;
    
    // Verifica se tem duração especificada
    if (this.check(TokenType.NUMBER)) {
      const durationToken = this.advance();
      duration = parseFloat(durationToken.value);
    }
    
    return createNode.note(token.value, duration, token.line, token.column);
  }

  /**
   * Parse de rest dentro de grupo (não consome newline)
   */
  private parseRestInGroup(): ASTNode {
    const token = this.advance();
    let duration: number | undefined;
    
    // Verifica se tem duração especificada
    if (this.check(TokenType.NUMBER)) {
      const durationToken = this.advance();
      duration = parseFloat(durationToken.value);
    }
    
    return createNode.rest(duration, token.line, token.column);
  }

  /**
   * Parse de acorde dentro de grupo (não consome newline)
   */
  private parseChordInGroup(): ASTNode {
    const bracketToken = this.advance(); // consome '['
    const notes: string[] = [];
    
    // Parse das notas dentro do acorde
    while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
      if (this.check(TokenType.NOTE)) {
        const noteToken = this.advance();
        notes.push(noteToken.value);
      } else {
        throw new SythmParseError(
          'Expected note in chord',
          this.peek().line,
          this.peek().column,
          this.peek()
        );
      }
    }
    
    if (notes.length === 0) {
      throw new SythmParseError(
        'Chord cannot be empty',
        bracketToken.line,
        bracketToken.column,
        bracketToken
      );
    }
    
    // Espera ']'
    if (!this.check(TokenType.RBRACKET)) {
      throw new SythmParseError(
        'Expected "]" to close chord',
        this.peek().line,
        this.peek().column,
        this.peek()
      );
    }
    
    this.advance(); // consome ']'
    
    // Verifica se tem duração especificada
    let duration: number | undefined;
    if (this.check(TokenType.NUMBER)) {
      const durationToken = this.advance();
      duration = parseFloat(durationToken.value);
    }
    
    return createNode.chord(notes, duration, bracketToken.line, bracketToken.column);
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
    
    // Se não estamos dentro de um grupo, consome newline
    if (!this.isInsideGroup()) {
      this.consumeNewlineOrEOF();
    }
    
    return createNode.note(token.value, duration, token.line, token.column);
  }

  /**
   * Verifica se estamos analisando dentro de um grupo ou estrutura
   */
  private isInsideGroup(): boolean {
    // Olha à frente para ver se há tokens que indicam continuação na mesma linha
    return this.checkAny([
      TokenType.RPAREN,     // Fechamento de grupo
      TokenType.RBRACKET,   // Fechamento de acorde
      TokenType.RBRACE,     // Fechamento de loop
      TokenType.ASTERISK,   // Multiplicador
      TokenType.NOTE,       // Outra nota na sequência
      TokenType.REST,       // Rest na sequência
      TokenType.LBRACKET,   // Início de acorde
      TokenType.NUMBER      // Possível duração
    ]);
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
           token.type === TokenType.LOOP ||
           token.type === TokenType.LBRACKET ||
           token.type === TokenType.LPAREN ||
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

  private checkAny(types: TokenType[]): boolean {
    return types.some(type => this.check(type));
  }
}