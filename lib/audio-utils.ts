export const MUSICAL_KEYWORDS = [
    // Comandos básicos
    'rest',
    'slow', 
    'fast',
    'loop',
    // Notas naturais
    'C', 'D', 'E', 'F', 'G', 'A', 'B',
    // Acidentes
    'C#', 'Db', 'D#', 'Eb', 'F#', 'Gb', 'G#', 'Ab', 'A#', 'Bb'
  ]
  
  export const DEFAULT_CODE = `// Welcome to Sythm - Musical Programming Language
  // Play some basic notes:
  C4
  D4
  E4
  F4
  
  // Add durations (in beats):
  G4 2
  A4 0.5
  B4 0.5
  
  // Use rests (pauses):
  rest
  C5
  
  // Control tempo:
  slow
  C4
  D4
  fast
  E4
  F4
  
  // NEW: Play chords (multiple notes together):
  [C4 E4 G4] 2
  [F4 A4 C5] 2
  
  // NEW: Use loops for repetition:
  loop 3 {
    C5 0.5
    D5 0.5
  }
  
  // NEW: Group notes with multiplication:
  (C4 D4 E4) * 2`
  
  export const NEW_COMPOSITION_CODE = `// New Sythm composition
  // Available commands:
  //   Notes: C4, D#5, Bb3, etc. (with optional duration)
  //   Chords: [C4 E4 G4], [F4 A4 C5] 2, etc.
  //   Loops: loop 3 { ... }
  //   Groups: (C4 D4) * 2
  //   rest [duration] - pause/silence  
  //   slow - make subsequent notes slower
  //   fast - make subsequent notes faster
  //
  // Examples:
  //   C4        - play C4 for 1 beat (default)
  //   [C4 E4 G4] - play C major chord
  //   loop 2 { C4 D4 } - repeat C4 D4 twice
  //   (C4 rest) * 3 - repeat C4 + pause 3 times
  //   D4 2      - play D4 for 2 beats
  //   rest 0.5  - silence for half beat
  //   slow      - switch to slower tempo
  //   fast      - switch to faster tempo
  
  C4
  D4
  E4
  F4
  [C4 E4 G4]`