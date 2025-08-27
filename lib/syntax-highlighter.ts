export interface HighlightedPart {
    text: string
    type: 'keyword' | 'string' | 'number' | 'comment' | 'default'
  }
  
  export function tokenizeCode(line: string): HighlightedPart[] {
    const parts = line.split(
      /(\b(?:bass|drums|synth|note|chord|melody|rhythm|beat|C|D|E|F|G|A|B|C#|D#|F#|G#|A#)\b|"[^"]*"|\b\d+\.?\d*\b|\/\/.*$)/g,
    )
  
    return parts
      .filter(part => part !== '') // Remove empty strings
      .map((part) => {
        if (
          /\b(?:bass|drums|synth|note|chord|melody|rhythm|beat|C|D|E|F|G|A|B|C#|D#|F#|G#|A#)\b/.test(part)
        ) {
          return { text: part, type: 'keyword' as const }
        } else if (/^"[^"]*"$/.test(part)) {
          return { text: part, type: 'string' as const }
        } else if (/^\b\d+\.?\d*\b$/.test(part)) {
          return { text: part, type: 'number' as const }
        } else if (/^\/\/.*$/.test(part)) {
          return { text: part, type: 'comment' as const }
        }
        return { text: part, type: 'default' as const }
      })
  }
  
  export function getColorForType(type: HighlightedPart['type']): React.CSSProperties {
    const styles: Record<HighlightedPart['type'], React.CSSProperties> = {
      keyword: { color: '#60a5fa', fontWeight: 600 },
      string: { color: '#4ade80' },
      number: { color: '#facc15' },
      comment: { color: '#6b7280', fontStyle: 'italic' },
      default: {},
    }
    return styles[type]
  }