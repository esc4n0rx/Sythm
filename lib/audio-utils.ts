export const MUSICAL_KEYWORDS = [
    // Comandos básicos
    'rest',
    'slow', 
    'fast',
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
  F4`
  
  export const NEW_COMPOSITION_CODE = `// New Sythm composition
  // Available commands:
  //   Notes: C4, D#5, Bb3, etc. (with optional duration)
  //   rest [duration] - pause/silence  
  //   slow - make subsequent notes slower
  //   fast - make subsequent notes faster
  //
  // Examples:
  //   C4        - play C4 for 1 beat (default)
  //   D4 2      - play D4 for 2 beats
  //   rest 0.5  - silence for half beat
  //   slow      - switch to slower tempo
  //   fast      - switch to faster tempo
  
  C4
  D4
  E4
  F4`