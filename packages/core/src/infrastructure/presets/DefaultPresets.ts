export interface SythmPreset {
  readonly id: string;
  readonly filename: string;
  readonly title: string;
  readonly description: string;
  readonly code: string;
}

export const DEFAULT_PRESETS: SythmPreset[] = [
  {
    id: 'cyberpunk-suite',
    filename: '01-cyberpunk-suite.sythm',
    title: 'Cyberpunk Suite (Controls + FX)',
    description: 'Controles interativos (Sliders), sub-rotinas SECTION/PERFORM, Multi-Tracks e efeitos Web Audio.',
    code: `*> Sythm Tasks 3, 4 & 5 — Sliders em Tempo Real + SECTION/PERFORM + FX
HEADER DIVISION.
  PROGRAM-ID. CYBERPUNK-SUITE.
  TITLE IS "Midnight Neon Protocol".
  AUTHOR IS "Sythm Studio".

CONFIG DIVISION.
  TEMPO IS 120 BPM.
  WAVE IS SAW.
  VOLUME IS 75.
  REVERB IS 20 PERCENT.

  CONTROL VOL-DRUMS IS SLIDER 80 FROM 0 TO 100.
  CONTROL VOL-BASS IS SLIDER 75 FROM 0 TO 100.
  CONTROL CUTOFF-BASS IS SLIDER 520 FROM 80 TO 4000.
  CONTROL REV-PAD IS SLIDER 55 FROM 0 TO 100.

PROCEDURES DIVISION.
  SECTION DRUM-GROOVE.
    PLAY DRUMS KICK HIHAT SNARE HIHAT FOR 0.5 BEATS.
    PLAY DRUMS KICK HIHAT SNARE OPEN-HIHAT FOR 0.5 BEATS.
  END-SECTION.

  BASS-LINE SECTION.
    PLAY NOTES A1 A1 C2 A1 FOR 0.5 BEATS.
    PLAY NOTES F1 F1 G1 G1 FOR 0.5 BEATS.
  END-SECTION.

  ARP-MOTIF SECTION.
    PLAY NOTES A4 C5 E5 A5 FOR 0.25 BEATS.
    PLAY NOTES E5 C5 A4 E4 FOR 0.25 BEATS.
  END-SECTION.

PLAY DIVISION.
  TRACK DRUMS.
    VOLUME IS VOL-DRUMS.
    PRINT "Bateria iniciada com controle VOL-DRUMS".
    PERFORM DRUM-GROOVE 2 TIMES.
  END-TRACK.

  TRACK BASS.
    WAVE IS SAW.
    VOLUME IS VOL-BASS.
    FILTER IS LOWPASS CUTOFF-BASS HZ Q 3.5.
    DETUNE IS 8 CENTS.
    ENVELOPE ATTACK 0.01 SEC DECAY 0.12 SEC SUSTAIN 65 PERCENT RELEASE 0.08 SEC.
    PERFORM BASS-LINE 2 TIMES.
  END-TRACK.

  TRACK ARP.
    WAVE IS SQUARE.
    VOLUME IS 50.
    FILTER IS LOWPASS 1800 HZ Q 2.
    DELAY IS 35 PERCENT TIME 0.25 SEC FEEDBACK 40 PERCENT.
    REVERB IS 35 PERCENT.
    PERFORM ARP-MOTIF 4 TIMES.
  END-TRACK.

  TRACK PAD.
    WAVE IS TRIANGLE.
    VOLUME IS 55.
    DETUNE IS 14 CENTS.
    REVERB IS REV-PAD PERCENT.
    ENVELOPE ATTACK 0.25 SEC DECAY 0.2 SEC SUSTAIN 80 PERCENT RELEASE 0.35 SEC.
    PLAY CHORD A3 C4 E4 FOR 4 BEATS.
    PLAY CHORD F3 A3 C4 FOR 4 BEATS.
  END-TRACK.
`,
  },
  {
    id: 'full-synthwave-band',
    filename: '02-full-synthwave-band.sythm',
    title: 'Synthwave Multi-Track',
    description: 'Bateria, baixo e lead tocando em paralelo com Mute/Solo.',
    code: `*> Sythm Task 2 — Multi-Tracks em Paralelo + Bateria Sintetizada
HEADER DIVISION.
  PROGRAM-ID. SYNTHWAVE-BAND.
  TITLE IS "Neon Drive 1984".
  AUTHOR IS "Sythm Studio".

CONFIG DIVISION.
  TEMPO IS 118 BPM.
  WAVE IS SAW.
  VOLUME IS 75.

PLAY DIVISION.
  TRACK DRUMS.
    PRINT "Bateria iniciada".
    REPEAT 2 TIMES
      PLAY DRUMS KICK HIHAT SNARE HIHAT FOR 0.5 BEATS.
      PLAY DRUMS KICK HIHAT SNARE OPEN-HIHAT FOR 0.5 BEATS.
    END-REPEAT.
  END-TRACK.

  TRACK BASS.
    WAVE IS SQUARE.
    VOLUME IS 65.
    REPEAT 2 TIMES
      PLAY NOTES A2 A2 C3 A2 FOR 0.5 BEATS.
      PLAY NOTES F2 F2 G2 G2 FOR 0.5 BEATS.
    END-REPEAT.
  END-TRACK.

  TRACK LEAD.
    WAVE IS SAW.
    VOLUME IS 60.
    PLAY CHORD A3 C4 E4 FOR 2 BEATS.
    PLAY NOTES E4 G4 A4 C5 FOR 0.5 BEATS.
    PLAY CHORD F3 A3 C4 FOR 2 BEATS.
    PLAY NOTES G4 E4 D4 C4 FOR 0.5 BEATS.
  END-TRACK.
`,
  },
  {
    id: 'classic-synth',
    filename: '03-classic-synth.sythm',
    title: 'Classic Synth Lead',
    description: 'Estrutura clássica em divisões COBOL com melodia e repetição.',
    code: `*> Sythm Language — Phase 1 (COBOL-Inspired Live Coding)
HEADER DIVISION.
  PROGRAM-ID. CLASSIC-SYNTH.
  TITLE IS "Midnight Arpeggio".
  AUTHOR IS "Sythm Studio".

CONFIG DIVISION.
  TEMPO IS 124 BPM.
  WAVE IS SAW.
  VOLUME IS 70.

PLAY DIVISION.
  PRINT "Iniciando Midnight Arpeggio a 124 BPM".
  REPEAT 2 TIMES
    PLAY NOTES C4 E4 G4 B4 FOR 0.5 BEATS.
    PLAY NOTE C5 FOR 1 BEAT.
    REST FOR 0.5 BEATS.
    PLAY NOTES B4 G4 E4 D4 FOR 0.5 BEATS.
  END-REPEAT.
  PLAY CHORD C4 E4 G4 B4 FOR 2 BEATS.
  PRINT "Ciclo concluído com sucesso".
`,
  },
  {
    id: 'chords-harmony',
    filename: '04-chords-harmony.sythm',
    title: 'Ambient Chords',
    description: 'Progressão harmônica com acordes e pausas usando onda triangular.',
    code: `HEADER DIVISION.
  PROGRAM-ID. AMBIENT-CHORDS.
  TITLE IS "Warm Pad Progression".

CONFIG DIVISION.
  SET TEMPO TO 92 BPM.
  SET WAVE TO TRIANGLE.
  SET VOLUME TO 80.

PLAY DIVISION.
  PRINT "Tocando progressão I - vi - IV - V".
  PLAY CHORD C4 E4 G4 FOR 2 BEATS.
  PLAY CHORD A3 C4 E4 FOR 2 BEATS.
  PLAY CHORD F3 A3 C4 FOR 2 BEATS.
  PLAY CHORD G3 B3 D4 FOR 1.5 BEATS.
  REST FOR 0.5 BEATS.
`,
  },
  {
    id: 'arpeggio-loop',
    filename: '05-bassline-pulse.sythm',
    title: 'Square Bassline',
    description: 'Linha de baixo pulsante com onda quadrada pronta para modo Loop.',
    code: `*> Modo direto sem divisões obrigatórias
TEMPO IS 132 BPM.
WAVE IS SQUARE.
VOLUME IS 65.

PRINT "Square Bassline Pulse — ative o Loop para tocar contínuo".
REPEAT 2 TIMES
  PLAY NOTES C2 C3 C2 G2 FOR 0.5 BEATS.
  PLAY NOTES Bb1 Bb2 F2 G2 FOR 0.5 BEATS.
END-REPEAT.
`,
  },
  {
    id: 'euclidean-acid-909',
    filename: '02-euclidean-acid-909.sythm',
    title: 'Euclidean Acid 909',
    description: 'Groove euclidiano polirrítmico com ACID-BASS, SWEEP, LFO e novos tambores.',
    code: `HEADER DIVISION.
  PROGRAM-ID. EUCLIDEAN-ACID-909.
  TITLE IS "Euclidean Acid 909".

CONFIG DIVISION.
  CONTROL ACID-CUTOFF IS SLIDER 950 FROM 150 TO 4500.
  TEMPO IS 128 BPM.
  SCALE IS C MINOR.
  VISUALIZER IS ALL.

PLAY DIVISION.
  TRACK DRUMS.
    VOLUME IS 80.
    PLAY EUCLIDEAN KICK 4 IN 16 FOR 0.25 BEATS.
    PLAY EUCLIDEAN RIM 5 IN 16 FOR 0.25 BEATS.
  END-TRACK.

  TRACK HATS-909.
    VOLUME IS 55.
    PAN IS RIGHT 35 PERCENT.
    PLAY DRUMS HIHAT PERC COWBELL PERC HIHAT OPEN-HIHAT PERC CRASH FOR 0.5 BEATS.
  END-TRACK.

  TRACK ACID.
    WAVE IS ACID-BASS.
    VOLUME IS 70.
    PAN IS LEFT 20 PERCENT.
    FILTER IS LOWPASS ACID-CUTOFF HZ Q 6.
    SWEEP FROM 320 TO 2800 OVER 4 BEATS.
    LFO IS ON RATE 3 HZ DEPTH 400 HZ.
    ARPEGGIATE Cm7 UP-DOWN FOR 0.25 BEATS.
    ARPEGGIATE Bbmaj7 UP FOR 0.25 BEATS.
  END-TRACK.

  TRACK SUB.
    WAVE IS SUB-808.
    VOLUME IS 75.
    PLAY NOTES C2 G1 C2 Eb2 FOR 1 BEAT.
  END-TRACK.
`,
  },
  {
    id: 'fm-jazz-chords',
    filename: '06-fm-jazz-chords.sythm',
    title: 'FM Keys & Chords',
    description: 'Progressão cifrada com FM-KEYS, PAD-WARM, PLUCK arpejado e pan estéreo.',
    code: `HEADER DIVISION.
  PROGRAM-ID. FM-JAZZ-CHORDS.
  TITLE IS "FM Keys & Chords".

CONFIG DIVISION.
  CONTROL PAD-PAN IS SLIDER 0 FROM -100 TO 100.
  TEMPO IS 104 BPM.
  SCALE IS A MINOR.
  VISUALIZER IS SPECTRUM.

PLAY DIVISION.
  TRACK KEYS.
    WAVE IS FM-KEYS.
    VOLUME IS 75.
    REVERB IS 32 PERCENT.
    PLAY CHORDS Am7 Fmaj7 Cmaj7 G7 FOR 1 BEAT.
  END-TRACK.

  TRACK ARP-PLUCK.
    WAVE IS PLUCK.
    VOLUME IS 65.
    PAN IS LEFT 30 PERCENT.
    DELAY IS 28 PERCENT TIME 0.28 SEC FEEDBACK 35 PERCENT.
    ARPEGGIATE Am7 UP-DOWN FOR 0.25 BEATS.
    TRANSPOSE UP 2 SEMITONES.
    ARPEGGIATE Cmaj7 DOWN FOR 0.25 BEATS.
  END-TRACK.

  TRACK WARM-PAD.
    WAVE IS PAD-WARM.
    VOLUME IS 50.
    PAN IS PAD-PAN.
    PLAY CHORD Am9 FOR 4 BEATS.
  END-TRACK.
`,
  },
];
