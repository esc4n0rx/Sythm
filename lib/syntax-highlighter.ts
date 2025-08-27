export interface HighlightedPart {
    text: string
    type: 'keyword' | 'note' | 'number' | 'command' | 'comment' | 'default'
  }
  
  export function tokenizeCode(line: string): HighlightedPart[] {
    // Regex para diferentes tipos de tokens
    const tokenRegex = /(\/\/.*$|rest|slow|fast|\b[A-G][#b]?\d+\b|\b\d+\.?\d*\b|\S+)/g
    
    const parts = line.split(tokenRegex).filter(part => part !== '')
    
    return parts.map((part) => {
      // Comentários
      if (/^\/\/.*$/.test(part)) {
        return { text: part, type: 'comment' as const }
      }
      
      // Comandos de controle
      if (/^(rest|slow|fast)$/.test(part)) {
        return { text: part, type: 'command' as const }
      }
      
      // Notas musicais (ex: C4, F#5, Bb3)
      if (/^[A-G][#b]?\d+$/.test(part)) {
        return { text: part, type: 'note' as const }
      }
      
      // Números (durações)
      if (/^\d+\.?\d*$/.test(part)) {
        return { text: part, type: 'number' as const }
      }
      
      return { text: part, type: 'default' as const }
    })
  }
  
  export function getColorForType(type: HighlightedPart['type']): React.CSSProperties {
    const styles: Record<HighlightedPart['type'], React.CSSProperties> = {
      note: { color: '#60a5fa', fontWeight: 600 }, // Azul para notas
      command: { color: '#f59e0b', fontWeight: 600 }, // Laranja para comandos
      number: { color: '#10b981' }, // Verde para números
      comment: { color: '#6b7280', fontStyle: 'italic' }, // Cinza para comentários
      keyword: { color: '#8b5cf6', fontWeight: 600 }, // Roxo para palavras-chave
      default: { color: '#e5e7eb' }, // Cor padrão
    }
    return styles[type]
  }