import { describe, expect, it } from 'vitest';
import {
  CobolStyleLexer,
  DEFAULT_PRESETS,
  NoteFrequency,
  TokenType,
  compileSythmCode,
} from '../src/index.js';

describe('NoteFrequency', () => {
  it('calculates A4 as 440 Hz and C4 as 261.63 Hz', () => {
    expect(NoteFrequency.parse('A4').frequencyHz).toBe(440);
    expect(NoteFrequency.parse('C4').frequencyHz).toBe(261.63);
  });

  it('supports sharps and flats case-insensitively', () => {
    const fSharp = NoteFrequency.parse('f#3');
    const gFlat = NoteFrequency.parse('Gb3');
    expect(fSharp.frequencyHz).toBe(gFlat.frequencyHz);
    expect(fSharp.canonical).toBe('F#3');
    expect(gFlat.canonical).toBe('Gb3');
  });

  it('rejects invalid notes', () => {
    expect(NoteFrequency.isValidNote('H4')).toBe(false);
    expect(() => NoteFrequency.parse('Z9')).toThrow();
  });
});

describe('CobolStyleLexer', () => {
  it('tokenizes COBOL divisions, sharp notes, numbers with trailing dots, and ignores comments', () => {
    const source = `
      *> Comment line
      CONFIG DIVISION.
        TEMPO IS 120 BPM.
        PLAY NOTE F#4 FOR 0.5 BEATS.
    `;
    const lexer = new CobolStyleLexer();
    const result = lexer.tokenize(source);

    expect(result.diagnostics).toHaveLength(0);
    expect(result.tokens.map((t) => t.type)).toEqual([
      TokenType.CONFIG,
      TokenType.DIVISION,
      TokenType.DOT,
      TokenType.TEMPO,
      TokenType.IS,
      TokenType.NUMBER,
      TokenType.BPM,
      TokenType.DOT,
      TokenType.PLAY,
      TokenType.NOTE,
      TokenType.NOTE_LITERAL,
      TokenType.FOR,
      TokenType.NUMBER,
      TokenType.BEATS,
      TokenType.DOT,
      TokenType.EOF,
    ]);
    expect(result.tokens.find((t) => t.type === TokenType.NOTE_LITERAL)?.literal).toBe('F#4');
  });

  it('reports unterminated string diagnostics', () => {
    const lexer = new CobolStyleLexer();
    const result = lexer.tokenize('PRINT "Sem fechar.');
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].severity).toBe('error');
  });
});

describe('compileSythmCode (Parser + TimelineExecutionPlanner)', () => {
  it('compiles all default presets cleanly without errors', () => {
    for (const preset of DEFAULT_PRESETS) {
      const result = compileSythmCode(preset.code);
      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
      expect(result.plan).not.toBeNull();
      expect(result.plan!.events.length).toBeGreaterThan(0);
    }
  });

  it('expands REPEAT blocks, PLAY NOTES, PLAY CHORD, REST and PRINT in exact beat timing', () => {
    const code = `
      HEADER DIVISION.
        PROGRAM-ID. TEST-TRACK.
        TITLE IS "Unit Test".

      CONFIG DIVISION.
        TEMPO IS 120 BPM.
        WAVE IS SINE.

      PLAY DIVISION.
        PRINT "Start".
        REPEAT 2 TIMES
          PLAY NOTES C4 E4 FOR 0.5 BEATS.
        END-REPEAT.
        PLAY CHORD C4 E4 G4 FOR 1 BEAT.
        REST FOR 1 BEAT.
    `;

    const result = compileSythmCode(code);
    expect(result.success).toBe(true);
    expect(result.plan?.metadata.programId).toBe('TEST-TRACK');
    expect(result.plan?.metadata.title).toBe('Unit Test');
    expect(result.plan?.initialBpm).toBe(120);
    expect(result.plan?.initialWaveform).toBe('sine');
    // 2 * (0.5 + 0.5) + 1 (chord) + 1 (rest) = 4 beats -> at 120 BPM = 2 seconds
    expect(result.plan?.totalBeats).toBe(4);
    expect(result.plan?.totalDurationSec).toBe(2);
    expect(result.plan?.events).toHaveLength(6);
    expect(result.plan?.events[4].type).toBe('chord');
    expect(result.plan?.events[4].frequencies).toEqual([261.63, 329.63, 392]);
    expect(result.plan?.events[5].type).toBe('rest');
    expect(result.plan?.logs).toHaveLength(1);
    expect(result.plan?.logs[0].message).toBe('[MAIN] Start');
  });

  it('compiles parallel TRACK blocks with and without END-TRACK and synthesizes DRUM/DRUMS events', () => {
    const code = `
      CONFIG DIVISION.
        TEMPO IS 120 BPM.
        WAVE IS SAW.

      PLAY DIVISION.
        TRACK DRUMS.
          PLAY DRUMS KICK HIHAT SNARE OPEN-HIHAT CLAP TOM FOR 0.5 BEATS.
        END-TRACK.

        TRACK BASS.
          WAVE IS SQUARE.
          PLAY NOTES C2 G2 FOR 1 BEAT.

        TRACK LEAD.
          PLAY CHORD C4 E4 G4 FOR 4 BEATS.
    `;

    const result = compileSythmCode(code);
    expect(result.success).toBe(true);
    expect(result.plan?.tracks).toHaveLength(3);
    expect(result.plan?.tracks.map((t) => t.name)).toEqual(['DRUMS', 'BASS', 'LEAD']);
    expect(result.plan?.tracks[0].hasDrums).toBe(true);
    // Max track duration is LEAD with 4 beats -> 2 sec at 120 BPM
    expect(result.plan?.totalBeats).toBe(4);
    expect(result.plan?.totalDurationSec).toBe(2);

    const firstByTrack = {
      DRUMS: result.plan?.events.find((e) => e.trackName === 'DRUMS'),
      BASS: result.plan?.events.find((e) => e.trackName === 'BASS'),
      LEAD: result.plan?.events.find((e) => e.trackName === 'LEAD'),
    };
    expect(firstByTrack.DRUMS?.startBeat).toBe(0);
    expect(firstByTrack.DRUMS?.type).toBe('drum');
    expect(firstByTrack.DRUMS?.drum).toBe('kick');
    expect(firstByTrack.BASS?.startBeat).toBe(0);
    expect(firstByTrack.BASS?.waveform).toBe('square');
    expect(firstByTrack.LEAD?.startBeat).toBe(0);
    expect(firstByTrack.LEAD?.waveform).toBe('sawtooth');
  });

  it('supports single PLAY DRUM command', () => {
    const result = compileSythmCode('PLAY DRUM CLAP FOR 0.5 BEATS.');
    expect(result.success).toBe(true);
    expect(result.plan?.events).toHaveLength(1);
    expect(result.plan?.events[0].type).toBe('drum');
    expect(result.plan?.events[0].drum).toBe('clap');
  });

  it('compiles COBOL SECTION definitions and PERFORM calls across tracks (Task 3)', () => {
    const code = `
      PROCEDURES DIVISION.
        SECTION MOTIF.
          PLAY NOTES C4 E4 FOR 0.5 BEATS.
        END-SECTION.

        BASS-GROOVE SECTION.
          PLAY NOTES C2 G2 FOR 1 BEAT.

      PLAY DIVISION.
        TRACK LEAD.
          PERFORM MOTIF 2 TIMES.
        END-TRACK.

        TRACK BASS.
          PERFORM BASS-GROOVE.
        END-TRACK.
    `;

    const result = compileSythmCode(code);
    expect(result.success).toBe(true);
    expect(result.plan?.definedSections).toEqual(['MOTIF', 'BASS-GROOVE']);
    const leadEvents = result.plan?.events.filter((e) => e.trackName === 'LEAD') ?? [];
    const bassEvents = result.plan?.events.filter((e) => e.trackName === 'BASS') ?? [];
    expect(leadEvents).toHaveLength(4);
    expect(bassEvents).toHaveLength(2);
    expect(result.plan?.totalBeats).toBe(2);
  });

  it('reports error when PERFORM calls undefined section or circular recursion', () => {
    const missing = compileSythmCode('PERFORM INEXISTENTE.');
    expect(missing.success).toBe(false);
    expect(missing.diagnostics[0].message).toContain('INEXISTENTE');

    const recursive = compileSythmCode(`
      SECTION LOOP-A.
        PERFORM LOOP-A.
      END-SECTION.
      PERFORM LOOP-A.
    `);
    expect(recursive.success).toBe(false);
    expect(recursive.diagnostics[0].message).toContain('Recursão');
  });

  it('compiles Web Audio effects and envelopes globally and per-track (Task 4)', () => {
    const code = `
      CONFIG DIVISION.
        TEMPO IS 120 BPM.
        FILTER IS LOWPASS 1400 HZ Q 2.
        DELAY IS 25 PERCENT TIME 0.4 SEC FEEDBACK 35 PERCENT.
        REVERB IS 30%.
        ENVELOPE ATTACK 0.05 SEC DECAY 0.1 SEC SUSTAIN 70 PERCENT RELEASE 0.2 SEC.
        DETUNE IS 10 CENTS.

      PLAY DIVISION.
        TRACK PAD.
          PLAY CHORD C4 E4 G4 FOR 2 BEATS.
        END-TRACK.

        TRACK LEAD.
          FILTER IS HIGHPASS 500 HZ.
          DELAY IS OFF.
          DETUNE IS OFF.
          ATTACK IS 0.01 SEC.
          PLAY NOTE C5 FOR 1 BEAT.
        END-TRACK.
    `;

    const result = compileSythmCode(code);
    expect(result.success).toBe(true);
    const padEvent = result.plan?.events.find((e) => e.trackName === 'PAD');
    const leadEvent = result.plan?.events.find((e) => e.trackName === 'LEAD');

    expect(padEvent?.effects.filter).toEqual({ mode: 'lowpass', frequencyHz: 1400, q: 2 });
    expect(padEvent?.effects.delay).toEqual({ mix: 0.25, timeSec: 0.4, feedback: 0.35 });
    expect(padEvent?.effects.reverbMix).toBe(0.3);
    expect(padEvent?.effects.envelope).toEqual({
      attackSec: 0.05,
      decaySec: 0.1,
      sustainLevel: 0.7,
      releaseSec: 0.2,
    });
    expect(padEvent?.effects.detuneCents).toBe(10);

    expect(leadEvent?.effects.filter).toEqual({ mode: 'highpass', frequencyHz: 500, q: 1 });
    expect(leadEvent?.effects.delay.mix).toBe(0);
    expect(leadEvent?.effects.reverbMix).toBe(0.3); // inherited from CONFIG DIVISION
    expect(leadEvent?.effects.envelope.attackSec).toBe(0.01);
    expect(leadEvent?.effects.detuneCents).toBe(0);
  });

  it('compiles declared CONTROL variables, inline SLIDER controls, and binds them to tracks (Task 5)', () => {
    const code = `
      CONFIG DIVISION.
        CONTROL MASTER-BPM IS SLIDER 128 FROM 60 TO 180.
        CONTROL VOL-BASS IS SLIDER 70 FROM 0 TO 100.
        CONTROL CUTOFF-BASS IS SLIDER 600 FROM 80 TO 4000.
        CONTROL REV-PAD IS SLIDER 45 FROM 0 TO 100.
        TEMPO IS MASTER-BPM BPM.

      PLAY DIVISION.
        TRACK BASS.
          VOLUME IS VOL-BASS.
          FILTER IS LOWPASS CUTOFF-BASS HZ Q SLIDER 2.5 FROM 0.5 TO 10.
          DETUNE IS SLIDER 12 FROM 0 TO 50 CENTS.
          PLAY NOTE A2 FOR 1 BEAT.
        END-TRACK.

        TRACK PAD.
          DELAY IS SLIDER 30 FROM 0 TO 100 PERCENT TIME 0.25 SEC FEEDBACK 40 PERCENT.
          REVERB IS REV-PAD PERCENT.
          PLAY CHORD A3 C4 E4 FOR 1 BEAT.
        END-TRACK.
    `;

    const result = compileSythmCode(code);
    expect(result.success).toBe(true);
    expect(result.plan?.initialBpm).toBe(128);
    expect(result.plan?.controls.length).toBe(7);

    const bassVolCtrl = result.plan?.controls.find((c) => c.name === 'VOL-BASS');
    expect(bassVolCtrl?.kind).toBe('declared');
    expect(bassVolCtrl?.defaultValue).toBe(70);
    expect(bassVolCtrl?.min).toBe(0);
    expect(bassVolCtrl?.max).toBe(100);
    expect(bassVolCtrl?.unit).toBe('%');
    expect(bassVolCtrl?.bindings[0]).toMatchObject({ trackName: 'BASS', param: 'volume' });

    const bassEvent = result.plan?.events.find((e) => e.trackName === 'BASS');
    const padEvent = result.plan?.events.find((e) => e.trackName === 'PAD');
    expect(bassEvent?.bpm).toBe(128);
    expect(bassEvent?.volume).toBeCloseTo(0.28, 3);
    expect(bassEvent?.effects.filter.frequencyHz).toBe(600);
    expect(bassEvent?.effects.filter.q).toBe(2.5);
    expect(bassEvent?.effects.detuneCents).toBe(12);
    expect(bassEvent?.controlRefs?.volume).toBe('VOL-BASS');
    expect(bassEvent?.controlRefs?.filterFrequencyHz).toBe('CUTOFF-BASS');

    expect(padEvent?.effects.delay.mix).toBeCloseTo(0.3, 3);
    expect(padEvent?.effects.reverbMix).toBeCloseTo(0.45, 3);
    expect(padEvent?.controlRefs?.reverbMix).toBe('REV-PAD');
  });

  it('reports diagnostic error when referencing an undeclared CONTROL variable', () => {
    const code = `
      PLAY DIVISION.
        TRACK BASS.
          VOLUME IS INEXISTENTE-CTRL.
          PLAY NOTE C2 FOR 1 BEAT.
        END-TRACK.
    `;
    const result = compileSythmCode(code);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.message.includes('INEXISTENTE-CTRL'))).toBe(true);
  });

  it('reports syntax errors with line numbers when period or END-REPEAT is missing', () => {
    const badCode = `
      PLAY DIVISION.
        PLAY NOTE C4 FOR 1 BEAT
        REPEAT 2 TIMES
          PLAY NOTE D4.
    `;
    const result = compileSythmCode(badCode);
    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(2);
    expect(result.plan).toBeNull();
  });

  it('compiles VISUALIZER mode, chords, ARPEGGIATE, TRANSPOSE, and SCALE (Tasks 6 & 7)', () => {
    const code = `
      CONFIG DIVISION.
        VISUALIZER IS PIANOROLL.
        SCALE IS F# DORIAN.
        TEMPO IS 120 BPM.

      PLAY DIVISION.
        PLAY CHORD Am7 FOR 2 BEATS.
        PLAY CHORDS Cmaj7 G7 FOR 1 BEAT.
        ARPEGGIATE C4 E4 G4 UP-DOWN FOR 0.25 BEATS.
        TRANSPOSE UP 2 SEMITONES.
        PLAY NOTE C4 FOR 1 BEAT.
        TRANSPOSE DOWN 3 SEMITONES.
        PLAY NOTE C4 FOR 1 BEAT.
    `;
    const result = compileSythmCode(code);
    expect(result.success).toBe(true);
    expect(result.plan?.visualizerMode).toBe('pianoroll');
    expect(result.plan?.scale).toBe('F# DORIAN');

    const events = result.plan?.events ?? [];
    // Am7 -> A4, C5, E5, G5
    expect(events[0].type).toBe('chord');
    expect(events[0].notes).toEqual(['A4', 'C5', 'E5', 'G5']);
    // Cmaj7 -> C4 E4 G4 B4, G7 -> G4 B4 D5 F5
    expect(events[1].notes).toEqual(['C4', 'E4', 'G4', 'B4']);
    expect(events[2].notes).toEqual(['G4', 'B4', 'D5', 'F5']);
    // ARPEGGIATE C4 E4 G4 UP-DOWN -> C4, E4, G4, E4 (4 events)
    expect(events.slice(3, 7).map((e) => e.notes[0])).toEqual(['C4', 'E4', 'G4', 'E4']);
    // TRANSPOSE +2 -> D4, TRANSPOSE -3 -> A3
    expect(events[7].notes).toEqual(['D4']);
    expect(events[8].notes).toEqual(['A3']);
  });

  it('generates Bjorklund Euclidean patterns, PAN controls, LFO/SWEEP, and extended instruments/drums (Tasks 8 & 9)', () => {
    const code = `
      CONFIG DIVISION.
        CONTROL MASTER-PAN IS SLIDER -50 FROM -100 TO 100.

      PLAY DIVISION.
        TRACK EUCLID.
          PAN IS RIGHT 40 PERCENT.
          PLAY EUCLIDEAN KICK 3 IN 8 FOR 0.25 BEATS.
          PLAY DRUMS RIM COWBELL CRASH PERC FOR 0.5 BEATS.
        END-TRACK.

        TRACK SYNTH.
          WAVE IS ACID-BASS.
          PAN IS MASTER-PAN.
          LFO IS ON RATE 4 HZ DEPTH 500 HZ.
          SWEEP FROM 300 TO 2400 OVER 2 BEATS.
          PLAY EUCLIDEAN C3 2 IN 4 FOR 0.5 BEATS.
        END-TRACK.

        TRACK KEYS.
          WAVE IS FM-KEYS.
          PLAY NOTE C4 FOR 1 BEAT.
          WAVE IS PAD-WARM.
          PLAY NOTE E4 FOR 1 BEAT.
          WAVE IS PLUCK.
          PLAY NOTE G4 FOR 1 BEAT.
          WAVE IS SUB-808.
          PLAY NOTE C2 FOR 1 BEAT.
        END-TRACK.
    `;
    const result = compileSythmCode(code);
    expect(result.success).toBe(true);

    const euclidEvents = (result.plan?.events ?? []).filter((e) => e.trackName === 'EUCLID');
    // First 8 steps: E(3, 8) -> [hit, rest, rest, hit, rest, rest, hit, rest]
    expect(euclidEvents.slice(0, 8).map((e) => e.type)).toEqual([
      'drum',
      'rest',
      'rest',
      'drum',
      'rest',
      'rest',
      'drum',
      'rest',
    ]);
    expect(euclidEvents.slice(8).map((e) => e.drum)).toEqual(['rim', 'cowbell', 'crash', 'perc']);
    expect(euclidEvents[0].effects.pan).toBeCloseTo(0.4, 3);

    const synthEvents = (result.plan?.events ?? []).filter((e) => e.trackName === 'SYNTH');
    expect(synthEvents.map((e) => e.type)).toEqual(['note', 'rest', 'note', 'rest']);
    expect(synthEvents[0].waveform).toBe('acid-bass');
    expect(synthEvents[0].effects.pan).toBeCloseTo(-0.5, 3);
    expect(synthEvents[0].controlRefs?.pan).toBe('MASTER-PAN');
    expect(synthEvents[0].effects.filter.mode).toBe('lowpass');
    expect(synthEvents[0].effects.lfo).toEqual({ rateHz: 4, depthHz: 500 });
    expect(synthEvents[0].effects.sweep).toEqual({ startHz: 300, endHz: 2400, durationBeats: 2 });

    const keysEvents = (result.plan?.events ?? []).filter((e) => e.trackName === 'KEYS');
    expect(keysEvents.map((e) => e.waveform)).toEqual(['fm-keys', 'pad-warm', 'pluck', 'sub-808']);
  });

  it('compiles PLAY SAMPLE with RATE, OFFSET SEC and FOR BEATS', () => {
    const code = `
      CONFIG DIVISION.
        TEMPO IS 120 BPM.

      PLAY DIVISION.
        TRACK VOCAL-SAMPLE.
          VOLUME IS 80.
          FILTER IS LOWPASS 1800 HZ Q 2.
          PLAY SAMPLE "vocal.mp3" RATE 1.2 OFFSET 0.5 SEC FOR 8 BEATS.
        END-TRACK.
    `;
    const result = compileSythmCode(code);
    expect(result.success).toBe(true);
    const events = result.plan?.events ?? [];
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('sample');
    expect(events[0].sampleName).toBe('vocal.mp3');
    expect(events[0].sampleRate).toBeCloseTo(1.2, 3);
    expect(events[0].sampleOffsetSec).toBeCloseTo(0.5, 3);
    expect(events[0].durationBeats).toBe(8);
    expect(events[0].durationSec).toBeCloseTo(4, 3);
  });
});
