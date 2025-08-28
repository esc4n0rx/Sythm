export const MUSICAL_KEYWORDS = [
    // Comandos básicos
    'rest',
    'slow', 
    'fast',
    'loop',
    // Instrumentos
    'bass', 'kick', 'snare', 'hihat', 'lead', 'pad',
    // Notas naturais
    'C', 'D', 'E', 'F', 'G', 'A', 'B',
    // Acidentes
    'C#', 'Db', 'D#', 'Eb', 'F#', 'Gb', 'G#', 'Ab', 'A#', 'Bb'
  ]
  
  export const DEFAULT_CODE = `// Welcome to Sythm - Musical Programming Language with Instruments!
  
  // Select instruments with @instrumentName
  @lead
  C4
  D4
  E4
  F4
  
  // Switch to bass for low-end
  @bass
  C2 2
  
  // Add durations (in beats):
  @lead
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
  
  // Play chords with different instruments:
  @pad
  [C4 E4 G4] 2
  [F4 A4 C5] 2
  
  // Use drum sounds:
  @kick
  C4 rest C4 rest
  
  @snare
  rest C4 rest C4
  
  @hihat
  (C4 0.5) * 8
  
  // Combine instruments with loops:
  @bass
  loop 2 {
    C2 2
    F2 2
  }
  
  // Group notes with multiplication:
  @lead
  (C5 D5 E5) * 2`
  
  export const NEW_COMPOSITION_CODE = `// New Sythm composition with Instruments
  // Available instruments:
  //   @default - basic synthesizer
  //   @bass - deep bass synthesizer  
  //   @lead - lead synthesizer for melodies
  //   @pad - atmospheric pad sounds
  //   @kick - electronic kick drum
  //   @snare - electronic snare drum
  //   @hihat - electronic hi-hat
  //
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
  //   @bass        - switch to bass instrument
  //   C4           - play C4 for 1 beat (default)
  //   [C4 E4 G4]   - play C major chord
  //   loop 2 { C4 D4 } - repeat C4 D4 twice
  //   (C4 rest) * 3    - repeat C4 + pause 3 times
  //   D4 2         - play D4 for 2 beats
  //   rest 0.5     - silence for half beat
  //   slow         - switch to slower tempo
  //   fast         - switch to faster tempo
  
  @lead
  C4
  D4
  E4
  F4
  
  @bass
  [C4 E4 G4]`