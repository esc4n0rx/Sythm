/**
 * Mapeamento de notas musicais para frequências em Hz
 * Baseado na afinação padrão A4 = 440Hz
 */

export interface NoteInfo {
    frequency: number;
    octave: number;
    note: string;
  }
  
  // Mapa de notas base (sem oitava) para semitons relativos a C
  const noteToSemitone: Record<string, number> = {
    'C': 0,
    'C#': 1, 'Db': 1,
    'D': 2,
    'D#': 3, 'Eb': 3,
    'E': 4,
    'F': 5,
    'F#': 6, 'Gb': 6,
    'G': 7,
    'G#': 8, 'Ab': 8,
    'A': 9,
    'A#': 10, 'Bb': 10,
    'B': 11
  };
  
  /**
   * Calcula a frequência de uma nota baseada na notação musical
   * @param note - Nota no formato "C4", "F#5", "Bb3", etc.
   * @returns Frequência em Hz
   */
  export function getNoteFrequency(note: string): number {
    // Parse da nota (ex: "C#4" -> note="C#", octave=4)
    const match = note.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) {
      throw new Error(`Invalid note format: ${note}`);
    }
  
    const [, noteName, octaveStr] = match;
    const octave = parseInt(octaveStr);
    
    if (!(noteName in noteToSemitone)) {
      throw new Error(`Invalid note name: ${noteName}`);
    }
  
    // Calcula o número do semitom absoluto (C4 = 60 no padrão MIDI)
    const semitonesFromC0 = octave * 12 + noteToSemitone[noteName];
    
    // C4 é o 60º semitom, A4 (440Hz) é o 69º semitom
    const semitonesFromA4 = semitonesFromC0 - 69;
    
    // Cada semitom é uma razão de 2^(1/12)
    const frequency = 440 * Math.pow(2, semitonesFromA4 / 12);
    
    return Math.round(frequency * 100) / 100; // Arredonda para 2 casas decimais
  }
  
  /**
   * Lista de notas válidas para validação
   */
  export const VALID_NOTES = Object.keys(noteToSemitone);
  
  /**
   * Verifica se uma string representa uma nota válida
   */
  export function isValidNote(note: string): boolean {
    return /^[A-G][#b]?\d+$/.test(note);
  }
  
  /**
   * Extrai informações de uma nota
   */
  export function parseNote(note: string): NoteInfo {
    const match = note.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) {
      throw new Error(`Invalid note format: ${note}`);
    }
  
    const [, noteName, octaveStr] = match;
    const octave = parseInt(octaveStr);
    const frequency = getNoteFrequency(note);
  
    return {
      frequency,
      octave,
      note: noteName
    };
  }