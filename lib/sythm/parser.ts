/**
 * Parser (Analisador Sintático) para a linguagem Sythm
 */

import { Token, TokenType } from './lexer';
import { ASTNode, ProgramNode, TrackNode, PatternNode, createNode } from './ast';

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
      
      // Pattern definition
      if (this.check(TokenType.PATTERN)) {
        return this.parsePattern();
      }
      
      // Track definition
      if (this.check(TokenType.TRACK)) {
        return this.parseTrack();
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

      // Instrumento
      if (this.check(TokenType.INSTRUMENT)) {
        return this.parseInstrument();
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

      // Referência a pattern
      if (this.check(TokenType.IDENTIFIER)) {
        return this.parsePatternReference();
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
   * Parse de definição de pattern
   */
  private parsePattern(): PatternNode {
    const patternToken = this.advance(); // consome 'pattern'
    
    // Espera nome do pattern
    if (!this.check(TokenType.IDENTIFIER)) {
      throw new SythmParseError(
        'Expected pattern name after "pattern"',
        this.peek().line,
        this.peek().column,
        this.peek()
      );
    }
    
    const nameToken = this.advance();
    const patternName = nameToken.value;
    
    // Espera '='
    if (!this.check(TokenType.EQUALS)) {
      throw new SythmParseError(
        'Expected "=" after pattern name',
        this.peek().line,
        this.peek().column,
        this.peek()
      );
    }
    
    this.advance(); // consome '='
    
    // Espera '{'
    if (!this.check(TokenType.LBRACE)) {
      throw new SythmParseError(
        'Expected "{" after pattern declaration',
        this.peek().line,
        this.peek().column,
        this.peek()
      );
    }
    
    this.advance(); // consome '{'
    
    // Parse do corpo do pattern
    const body: ASTNode[] = [];
    
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      // Pula newlines dentro do pattern
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
        'Expected "}" to close pattern',
        this.peek().line,
        this.peek().column,
        this.peek()
      );
    }
    
    this.advance(); // consome '}'
    this.consumeNewlineOrEOF();
    
    return createNode.pattern(patternName, body, patternToken.line, patternToken.column);
  }

  /**
   * Parse de definição de track
   */
  private parseTrack(): TrackNode {
    const trackToken = this.advance(); // consome 'track'
    
    // Espera nome da track
    if (!this.check(TokenType.IDENTIFIER)) {
      throw new SythmParseError(
        'Expected track name after "track"',
        this.peek().line,
        this.peek().column,
        this.peek()
      );
    }
    
    const nameToken = this.advance();
    const trackName = nameToken.value;
    
    // Espera '{'
    if (!this.check(TokenType.LBRACE)) {
      throw new SythmParseError(
        'Expected "{" after track name',
        this.peek().line,
        this.peek().column,
        this.peek()
      );
    }
    
    this.advance(); // consome '{'
    
    // Parse do corpo da track
    const body: ASTNode[] = [];
    
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      // Pula newlines dentro da track
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
        'Expected "}" to close track',
        this.peek().line,
        this.peek().column,
        this.peek()
      );
    }
    
    this.advance(); // consome '}'
    this.consumeNewlineOrEOF();
    
    return createNode.track(trackName, body, trackToken.line, trackToken.column);
  }

  /**
   * Parse de referência a pattern
   */
  private parsePatternReference(): ASTNode {
    const identifierToken = this.advance();
    
    // Se não estamos dentro de um grupo, consome newline
    if (!this.isInsideGroup()) {
      this.consumeNewlineOrEOF();
    }
    
    // Usa o factory method do createNode para consistência
    return createNode.patternReference(identifierToken.value, identifierToken.line, identifierToken.column);
  }

  /**
   * Parse de instrumento
   */
  private parseInstrument(): ASTNode {
    const token = this.advance();
    const instrumentName = token.value.substring(1); // Remove o '@'
    
    this.consumeNewlineOrEOF();
    return createNode.instrument(instrumentName, token.line, token.column);
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
   * Parse do comando loop - VERSÃO CORRIGIDA
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
    
    // Verifica se é um bloco { ... } ou uma referência a pattern
    if (this.check(TokenType.LBRACE)) {
      // Sintaxe: loop N { ... }
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
      
    } else if (this.check(TokenType.IDENTIFIER)) {
      // Sintaxe: loop N patternName
      const patternRef = this.parsePatternReference();
      
      // Cria um loop com a referência ao pattern no body
      return createNode.loop(iterations, [patternRef], loopToken.line, loopToken.column);
      
    } else {
      // Erro: esperava { ou pattern name
      throw new SythmParseError(
        'Expected "{" or pattern name after loop iterations',
        this.peek().line,
        this.peek().column,
        this.peek()
      );
    }
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
      } else if (this.check(TokenType.INSTRUMENT)) {
        element = this.parseInstrument();
      } else if (this.check(TokenType.IDENTIFIER)) {
        element = this.parsePatternReference();
      } else {
        throw new SythmParseError(
          'Expected note, chord, rest, slow, fast, instrument, or pattern in group',
          this.peek().line,
          this.peek().column,
          this.peek()
        );
      }
      
      if (element) {
        body.push(element);
      }
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
    
    // Se não estamos dentro de um grupo, consome newline
    if (!this.isInsideGroup()) {
      this.consumeNewlineOrEOF();
    }
    
    return createNode.group(body, multiplier, parenToken.line, parenToken.column);
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
   * Parse de nota dentro de um grupo (não consome newline automaticamente)
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
   * Parse de rest dentro de um grupo (não consome newline automaticamente)
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
   * Parse de acorde dentro de um grupo (não consome newline automaticamente)
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
   * Verifica se estamos analisando dentro de um grupo ou estrutura
   */
  private isInsideGroup(): boolean {
    // Olha à frente para ver se há tokens que indicam continuação na mesma linha
    return this.checkAny([
      TokenType.RPAREN,     // Fechamento de grupo
      TokenType.RBRACKET,   // Fechamento de acorde
      TokenType.RBRACE,     // Fechamento de loop/track/pattern
      TokenType.ASTERISK,   // Multiplicador
      TokenType.NOTE,       // Outra nota na sequência
      TokenType.REST,       // Rest na sequência
      TokenType.LBRACKET,   // Início de acorde
      TokenType.NUMBER,     // Possível duração
      TokenType.INSTRUMENT, // Instrumento na sequência
      TokenType.IDENTIFIER  // Referência de pattern
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
           token.type === TokenType.TRACK ||
           token.type === TokenType.PATTERN ||
           token.type === TokenType.LBRACKET ||
           token.type === TokenType.LPAREN ||
           token.type === TokenType.COMMENT ||
           token.type === TokenType.INSTRUMENT ||
           token.type === TokenType.IDENTIFIER ||
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