/**
 * Lexer (Analisador Léxico) para a linguagem Sythm
 */

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export enum TokenType {
  // Comandos
  NOTE = 'NOTE',      // C4, F#5, Bb3, etc.
  REST = 'REST',      // rest
  SLOW = 'SLOW',      // slow
  FAST = 'FAST',      // fast
  LOOP = 'LOOP',      // loop
  TRACK = 'TRACK',    // track
  PATTERN = 'PATTERN', // pattern
  INSTRUMENT = 'INSTRUMENT', // @bass, @kick, @lead, etc.
  
  // Literais
  NUMBER = 'NUMBER',   // 1, 2.5, 0.25, etc.
  IDENTIFIER = 'IDENTIFIER', // nomes de tracks e patterns
  
  // Símbolos
  LPAREN = 'LPAREN',   // (
  RPAREN = 'RPAREN',   // )
  LBRACKET = 'LBRACKET', // [
  RBRACKET = 'RBRACKET', // ]
  LBRACE = 'LBRACE',   // {
  RBRACE = 'RBRACE',   // }
  ASTERISK = 'ASTERISK', // *
  AT = 'AT',           // @
  EQUALS = 'EQUALS',   // =
  
  // Especiais
  NEWLINE = 'NEWLINE',
  COMMENT = 'COMMENT',
  EOF = 'EOF',
  UNKNOWN = 'UNKNOWN'
}

export class SythmLexer {
  private source: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(source: string) {
    this.source = source.trim(); // Remove espaços extras no final
  }

  /**
   * Tokeniza todo o código fonte
   */
  tokenize(): Token[] {
    const tokens: Token[]
    = [];  while (!this.isAtEnd()) {
      const token = this.nextToken();
      if (token) {
        tokens.push(token);
      }
    }  tokens.push({
      type: TokenType.EOF,
      value: '',
      line: this.line,
      column: this.column
    });  return tokens;
  }/**
   * Obtém o próximo token
   */
  private nextToken(): Token | null {
    this.skipWhitespace();  if (this.isAtEnd()) {
      return null;
    }  const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;  const char = this.advance();  switch (char) {
      case '(':
        return this.makeToken(TokenType.LPAREN, char, startLine, startColumn);
      case ')':
        return this.makeToken(TokenType.RPAREN, char, startLine, startColumn);
      case '[':
        return this.makeToken(TokenType.LBRACKET, char, startLine, startColumn);
      case ']':
        return this.makeToken(TokenType.RBRACKET, char, startLine, startColumn);
      case '{':
        return this.makeToken(TokenType.LBRACE, char, startLine, startColumn);
      case '}':
        return this.makeToken(TokenType.RBRACE, char, startLine, startColumn);
      case '*':
        return this.makeToken(TokenType.ASTERISK, char, startLine, startColumn);
      case '=':
        return this.makeToken(TokenType.EQUALS, char, startLine, startColumn);
      case '@':
        return this.instrumentToken(startLine, startColumn);
      case '\n':
        this.line++;
        this.column = 1;
        return this.makeToken(TokenType.NEWLINE, char, startLine, startColumn);
      case '#':
        return this.commentToken(startLine, startColumn);
      default:
        if (this.isDigit(char)) {
          return this.numberToken(start, startLine, startColumn);
        } else if (this.isAlpha(char)) {
          return this.identifierOrKeywordToken(start, startLine, startColumn);
        } else {
          return this.makeToken(TokenType.UNKNOWN, char, startLine, startColumn);
        }
    }
  }/**
   * Token de comentário
   */
  private commentToken(startLine: number, startColumn: number): Token {
    // Consome até o final da linha
    while (this.peek() !== '\n' && !this.isAtEnd()) {
      this.advance();
    }  const value = this.source.substring(startColumn - 1, this.position);
    return this.makeToken(TokenType.COMMENT, value, startLine, startColumn);
  }/**
   * Token de instrumento (@bass, @kick, etc.)
   */
  private instrumentToken(startLine: number, startColumn: number): Token {
    // Lê caracteres até encontrar espaço, newline ou fim
    while (this.isAlphaNumeric(this.peek()) && !this.isAtEnd()) {
      this.advance();
    }  const value = this.source.substring(startColumn - 1, this.position);
    return this.makeToken(TokenType.INSTRUMENT, value, startLine, startColumn);
  }/**
   * Token de número
   */
  private numberToken(start: number, startLine: number, startColumn: number): Token {
    this.position = start; // Volta para o início  // Consome dígitos antes do ponto decimal
    while (this.isDigit(this.peek())) {
      this.advance();
    }  // Se tem ponto decimal
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      this.advance(); // consome o '.'
      while (this.isDigit(this.peek())) {
        this.advance();
      }
    }  const value = this.source.substring(start, this.position);
    return this.makeToken(TokenType.NUMBER, value, startLine, startColumn);
  }/**
   * Token de identificador ou palavra-chave
   */
  private identifierOrKeywordToken(start: number, startLine: number, startColumn: number): Token {
    this.position = start; // Volta para o início  // Consome caracteres alfanuméricos e alguns símbolos musicais
    while (this.isAlphaNumeric(this.peek()) || this.peek() === '#' || this.peek() === 'b') {
      this.advance();
    }  const value = this.source.substring(start, this.position);
    const type = this.getIdentifierType(value);  return this.makeToken(type, value, startLine, startColumn);
  }/**
   * Determina o tipo de um identificador
   */
  private getIdentifierType(value: string): TokenType {
    // Palavras-chave
    switch (value.toLowerCase()) {
      case 'rest': return TokenType.REST;
      case 'slow': return TokenType.SLOW;
      case 'fast': return TokenType.FAST;
      case 'loop': return TokenType.LOOP;
      case 'track': return TokenType.TRACK;
      case 'pattern': return TokenType.PATTERN;
    }  // Se parece com nota musical (ex: C4, F#5, Bb3)
    if (this.isNotePattern(value)) {
      return TokenType.NOTE;
    }  // Senão é um identificador genérico (nome de track/pattern)
    return TokenType.IDENTIFIER;
  }/**
   * Verifica se uma string é uma nota musical
   */
  private isNotePattern(value: string): boolean {
    // Padrão: [A-G][#b]?[0-9]
    const noteRegex = /^[A-Ga-g][#b]?[0-9]$/;
    return noteRegex.test(value);
  }/**
   * Utilitários
   */
  private makeToken(type: TokenType, value: string, line: number, column: number): Token {
    return { type, value, line, column };
  }private isAtEnd(): boolean {
    return this.position >= this.source.length;
  }private advance(): string {
    const char = this.source.charAt(this.position++);
    this.column++;
    return char;
  }private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source.charAt(this.position);
  }private peekNext(): string {
    if (this.position + 1 >= this.source.length) return '\0';
    return this.source.charAt(this.position + 1);
  }private skipWhitespace(): void {
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === ' ' || char === '\t' || char === '\r') {
        this.advance();
      } else {
        break;
      }
    }
  }private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') ||
           (char >= 'A' && char <= 'Z') ||
           char === '_';
  }private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }
  }