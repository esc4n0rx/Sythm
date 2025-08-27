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
    
    // Literais
    NUMBER = 'NUMBER',   // 1, 2.5, 0.25, etc.
    
    // Símbolos
    LPAREN = 'LPAREN',   // (
    RPAREN = 'RPAREN',   // )
    
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
      const tokens: Token[] = [];
      
      while (!this.isAtEnd()) {
        const token = this.nextToken();
        if (token) {
          tokens.push(token);
        }
      }
      
      tokens.push({
        type: TokenType.EOF,
        value: '',
        line: this.line,
        column: this.column
      });
      
      return tokens;
    }
  
    /**
     * Obtém o próximo token
     */
    private nextToken(): Token | null {
      this.skipWhitespace();
      
      if (this.isAtEnd()) {
        return null;
      }
      
      const start = this.position;
      const startLine = this.line;
      const startColumn = this.column;
      
      const char = this.advance();
      
      switch (char) {
        case '(':
          return this.makeToken(TokenType.LPAREN, char, startLine, startColumn);
        case ')':
          return this.makeToken(TokenType.RPAREN, char, startLine, startColumn);
        case '\n':
          this.line++;
          this.column = 1;
          return this.makeToken(TokenType.NEWLINE, '\\n', startLine, startColumn);
        case '/':
          if (this.peek() === '/') {
            return this.scanComment(startLine, startColumn);
          }
          break;
      }
      
      // Números
      if (this.isDigit(char)) {
        this.position = start; // Volta para reprocessar
        this.column = startColumn;
        return this.scanNumber(startLine, startColumn);
      }
      
      // Identificadores/Palavras-chave
      if (this.isAlpha(char)) {
        this.position = start; // Volta para reprocessar
        this.column = startColumn;
        return this.scanIdentifier(startLine, startColumn);
      }
      
      // Token desconhecido
      return this.makeToken(TokenType.UNKNOWN, char, startLine, startColumn);
    }
  
    /**
     * Escaneia um número (inteiro ou decimal)
     */
    private scanNumber(line: number, column: number): Token {
      const start = this.position;
      
      // Parte inteira
      while (this.isDigit(this.peek())) {
        this.advance();
      }
      
      // Parte decimal
      if (this.peek() === '.' && this.isDigit(this.peekNext())) {
        this.advance(); // consome o '.'
        while (this.isDigit(this.peek())) {
          this.advance();
        }
      }
      
      const value = this.source.substring(start, this.position);
      return this.makeToken(TokenType.NUMBER, value, line, column);
    }
  
    /**
     * Escaneia identificadores e palavras-chave
     */
    private scanIdentifier(line: number, column: number): Token {
      const start = this.position;
      
      // Primeira parte: letra
      while (this.isAlphaNumeric(this.peek())) {
        this.advance();
      }
      
      // Para notas musicais, verifica se tem # ou b
      if (this.peek() === '#' || this.peek() === 'b') {
        this.advance();
      }
      
      // Para notas musicais, verifica se tem número da oitava
      if (this.isDigit(this.peek())) {
        while (this.isDigit(this.peek())) {
          this.advance();
        }
      }
      
      const value = this.source.substring(start, this.position);
      const type = this.getIdentifierType(value);
      
      return this.makeToken(type, value, line, column);
    }
  
    /**
     * Escaneia comentários
     */
    private scanComment(line: number, column: number): Token {
      this.advance(); // consome o segundo '/'
      const start = this.position;
      
      while (this.peek() !== '\n' && !this.isAtEnd()) {
        this.advance();
      }
      
      const content = this.source.substring(start, this.position).trim();
      return this.makeToken(TokenType.COMMENT, content, line, column);
    }
  
    /**
     * Determina o tipo de um identificador
     */
    private getIdentifierType(value: string): TokenType {
      switch (value.toLowerCase()) {
        case 'rest': return TokenType.REST;
        case 'slow': return TokenType.SLOW;
        case 'fast': return TokenType.FAST;
        default:
          // Verifica se é uma nota musical (ex: C4, F#5, Bb3)
          if (/^[A-G][#b]?\d+$/.test(value)) {
            return TokenType.NOTE;
          }
          return TokenType.UNKNOWN;
      }
    }
  
    /**
     * Pula espaços em branco (exceto \n)
     */
    private skipWhitespace(): void {
      while (true) {
        const char = this.peek();
        if (char === ' ' || char === '\r' || char === '\t') {
          this.advance();
        } else {
          break;
        }
      }
    }
  
    /**
     * Utilitários de caractere
     */
    private isAtEnd(): boolean {
      return this.position >= this.source.length;
    }
  
    private advance(): string {
      if (this.isAtEnd()) return '\0';
      this.column++;
      return this.source.charAt(this.position++);
    }
  
    private peek(): string {
      if (this.isAtEnd()) return '\0';
      return this.source.charAt(this.position);
    }
  
    private peekNext(): string {
      if (this.position + 1 >= this.source.length) return '\0';
      return this.source.charAt(this.position + 1);
    }
  
    private isDigit(char: string): boolean {
      return char >= '0' && char <= '9';
    }
  
    private isAlpha(char: string): boolean {
      return (char >= 'a' && char <= 'z') || 
             (char >= 'A' && char <= 'Z') || 
             char === '_';
    }
  
    private isAlphaNumeric(char: string): boolean {
      return this.isAlpha(char) || this.isDigit(char);
    }
  
    private makeToken(type: TokenType, value: string, line: number, column: number): Token {
      return { type, value, line, column };
    }
  }