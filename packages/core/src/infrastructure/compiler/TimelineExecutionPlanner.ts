import type { IExecutionPlanner, PlannerResult } from '../../application/ports/IExecutionPlanner.js';
import type {
  ArpDirection,
  AudioEffectsConfig,
  AutomationParam,
  ChooseOneStatementNode,
  DivisionKind,
  DrumType,
  NumericParamValue,
  PatternStatementNode,
  ProgramNode,
  SectionStatementNode,
  StatementNode,
  VisualizerMode,
  WaveformType,
} from '../../domain/entities/Ast.js';
import type {
  CompilationDiagnostic,
  ConsoleLogEntry,
  ControlBinding,
  ControlDescriptor,
  ControlTargetParam,
  EventAutomationRamp,
  ExecutionPlan,
  HumanizeConfig,
  ScheduledAudioEvent,
  TrackSummary,
} from '../../domain/entities/ExecutionPlan.js';
import { NoteFrequency } from '../../domain/value-objects/NoteFrequency.js';

const MAX_EVENTS = 2000;
const MAX_PERFORM_DEPTH = 16;
const DEFAULT_BPM = 120;
const DEFAULT_WAVEFORM: WaveformType = 'sawtooth';
const DEFAULT_VOLUME = 0.25;

const DEFAULT_EFFECTS: AudioEffectsConfig = {
  filter: {
    mode: 'off',
    frequencyHz: 2000,
    q: 1,
  },
  delay: {
    mix: 0,
    timeSec: 0.35,
    feedback: 0.35,
  },
  reverbMix: 0,
  envelope: {
    attackSec: 0.015,
    decaySec: 0.08,
    sustainLevel: 0.8,
    releaseSec: 0.06,
  },
  detuneCents: 0,
  pan: 0,
};

function cloneEffects(effects: AudioEffectsConfig): AudioEffectsConfig {
  return {
    filter: { ...effects.filter },
    delay: { ...effects.delay },
    reverbMix: effects.reverbMix,
    envelope: { ...effects.envelope },
    detuneCents: effects.detuneCents,
    pan: effects.pan,
    lfo: effects.lfo ? { ...effects.lfo } : undefined,
    sweep: effects.sweep ? { ...effects.sweep } : undefined,
  };
}

function buildEuclideanPattern(pulses: number, steps: number): boolean[] {
  if (steps <= 0) return [];
  const clampedPulses = Math.max(0, Math.min(steps, pulses));
  if (clampedPulses === 0) return Array<boolean>(steps).fill(false);
  if (clampedPulses === steps) return Array<boolean>(steps).fill(true);

  let counts: number[][] = [];
  let remainders: number[][] = [];

  for (let i = 0; i < clampedPulses; i += 1) {
    counts.push([1]);
  }
  for (let i = 0; i < steps - clampedPulses; i += 1) {
    remainders.push([0]);
  }

  while (remainders.length > 1) {
    const minLen = Math.min(counts.length, remainders.length);
    const nextCounts: number[][] = [];
    for (let i = 0; i < minLen; i += 1) {
      nextCounts.push([...counts[i], ...remainders[i]]);
    }
    const leftover =
      counts.length > remainders.length ? counts.slice(minLen) : remainders.slice(minLen);
    counts = nextCounts;
    remainders = leftover;
  }

  const pattern: number[] = [];
  for (const group of counts) pattern.push(...group);
  for (const group of remainders) pattern.push(...group);
  return pattern.map((bit) => bit === 1);
}

function buildArpSequence(notes: string[], direction: ArpDirection): string[] {
  if (notes.length <= 1) return [...notes];
  if (direction === 'down') return [...notes].reverse();
  if (direction === 'up-down') {
    return [...notes, ...notes.slice(1, -1).reverse()];
  }
  return [...notes];
}

const DIVISION_ORDER: Record<DivisionKind, number> = {
  HEADER: 0,
  CONFIG: 1,
  PLAY: 2,
};

interface ActiveRamp {
  param: AutomationParam;
  startValue: number;
  endValue: number;
  startBeat: number;
  durationBeats: number;
}

interface TrackCursor {
  trackName: string;
  bpm: number;
  waveform: WaveformType;
  volume: number;
  transposeSemitones: number;
  swingPercent: number;
  humanize?: HumanizeConfig;
  pendingProbability?: number;
  activeRamps: ActiveRamp[];
  effects: AudioEffectsConfig;
  controlRefs: Partial<Record<ControlTargetParam, string>>;
  currentBeat: number;
  currentTimeSec: number;
  eventCount: number;
  hasDrums: boolean;
}

interface MutableControlDescriptor {
  name: string;
  label: string;
  kind: 'declared' | 'inline';
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  declarationLine: number;
  usageLines: Set<number>;
  bindings: ControlBinding[];
}

interface PlannerContext {
  metadata: {
    programId?: string;
    title?: string;
    author?: string;
  };
  sections: Map<string, SectionStatementNode>;
  controls: Map<string, MutableControlDescriptor>;
  visualizerMode: VisualizerMode;
  scale?: string;
  callStack: string[];
  baseCursor: TrackCursor;
  trackSummaries: Map<string, TrackSummary>;
  eventCounter: number;
  events: ScheduledAudioEvent[];
  logs: ConsoleLogEntry[];
  diagnostics: CompilationDiagnostic[];
}

export class TimelineExecutionPlanner implements IExecutionPlanner {
  buildPlan(ast: ProgramNode): PlannerResult {
    const context: PlannerContext = {
      metadata: {},
      sections: new Map<string, SectionStatementNode>(),
      controls: new Map<string, MutableControlDescriptor>(),
      visualizerMode: 'all',
      callStack: [],
      baseCursor: {
        trackName: 'MAIN',
        bpm: DEFAULT_BPM,
        waveform: DEFAULT_WAVEFORM,
        volume: DEFAULT_VOLUME,
        transposeSemitones: 0,
        swingPercent: 0,
        activeRamps: [],
        effects: cloneEffects(DEFAULT_EFFECTS),
        controlRefs: {},
        currentBeat: 0,
        currentTimeSec: 0,
        eventCount: 0,
        hasDrums: false,
      },
      trackSummaries: new Map<string, TrackSummary>(),
      eventCounter: 0,
      events: [],
      logs: [],
      diagnostics: [],
    };

    const orderedDivisions = [...ast.divisions].sort(
      (a, b) => DIVISION_ORDER[a.divisionType] - DIVISION_ORDER[b.divisionType],
    );

    // Pre-collect reusable SECTION and CONTROL definitions
    for (const division of orderedDivisions) {
      this.collectDefinitions(division.statements, context);
    }
    this.collectDefinitions(ast.statements, context);

    let capturedInitialConfig = false;
    let initialBpm = DEFAULT_BPM;
    let initialWaveform: WaveformType = DEFAULT_WAVEFORM;

    for (const division of orderedDivisions) {
      this.processStatements(division.statements, context.baseCursor, context);
      if (division.divisionType === 'CONFIG' && !capturedInitialConfig) {
        initialBpm = context.baseCursor.bpm;
        initialWaveform = context.baseCursor.waveform;
        capturedInitialConfig = true;
      }
    }

    if (ast.statements.length > 0) {
      this.processStatements(ast.statements, context.baseCursor, context);
    }

    if (context.baseCursor.eventCount > 0) {
      this.recordTrackSummary(context.baseCursor, context);
    }

    if (!capturedInitialConfig) {
      initialBpm = context.events[0]?.bpm ?? context.baseCursor.bpm;
      initialWaveform = context.events[0]?.waveform ?? context.baseCursor.waveform;
    }

    const sortedEvents = [...context.events].sort(
      (a, b) => a.startTimeSec - b.startTimeSec || a.line - b.line,
    );
    const sortedLogs = [...context.logs].sort(
      (a, b) => a.timestampOffsetSec - b.timestampOffsetSec,
    );

    const tracks = Array.from(context.trackSummaries.values());
    const totalBeats =
      tracks.length > 0
        ? Math.max(...tracks.map((t) => t.totalBeats))
        : Math.round(context.baseCursor.currentBeat * 1000) / 1000;
    const totalDurationSec =
      tracks.length > 0
        ? Math.max(...tracks.map((t) => t.totalDurationSec))
        : Math.round(context.baseCursor.currentTimeSec * 1000) / 1000;

    const controls: ControlDescriptor[] = Array.from(context.controls.values()).map((ctrl) => ({
      name: ctrl.name,
      label: ctrl.label,
      kind: ctrl.kind,
      defaultValue: ctrl.defaultValue,
      min: ctrl.min,
      max: ctrl.max,
      step: ctrl.step,
      unit: ctrl.unit,
      declarationLine: ctrl.declarationLine,
      usageLines: Array.from(ctrl.usageLines).sort((a, b) => a - b),
      bindings: ctrl.bindings,
    }));

    const plan: ExecutionPlan = {
      metadata: context.metadata,
      initialBpm,
      initialWaveform,
      visualizerMode: context.visualizerMode,
      scale: context.scale,
      totalBeats,
      totalDurationSec,
      definedSections: Array.from(context.sections.keys()),
      controls,
      tracks,
      events: sortedEvents,
      logs: sortedLogs,
    };

    return {
      plan,
      diagnostics: context.diagnostics,
    };
  }

  private collectDefinitions(statements: StatementNode[], context: PlannerContext): void {
    for (const stmt of statements) {
      if (stmt.kind === 'SectionStatement') {
        context.sections.set(stmt.name.toUpperCase(), stmt);
        this.collectDefinitions(stmt.statements, context);
      } else if (stmt.kind === 'ControlStatement') {
        context.controls.set(stmt.name.toUpperCase(), {
          name: stmt.name.toUpperCase(),
          label: stmt.name.toUpperCase(),
          kind: 'declared',
          defaultValue: stmt.defaultValue,
          min: stmt.min,
          max: stmt.max,
          step: stmt.step,
          unit: '',
          declarationLine: stmt.line,
          usageLines: new Set<number>(),
          bindings: [],
        });
      } else if (stmt.kind === 'TrackStatement') {
        this.collectDefinitions(stmt.statements, context);
      } else if (stmt.kind === 'RepeatStatement') {
        this.collectDefinitions(stmt.body, context);
      }
    }
  }

  private processStatements(
    statements: StatementNode[],
    cursor: TrackCursor,
    context: PlannerContext,
  ): void {
    for (const stmt of statements) {
      if (context.events.length >= MAX_EVENTS) {
        context.diagnostics.push({
          severity: 'error',
          message: `Limite máximo de ${MAX_EVENTS} eventos musicais excedido.`,
          line: stmt.line,
          column: stmt.column,
        });
        return;
      }

      switch (stmt.kind) {
        case 'ControlStatement': {
          // Pre-collected in collectDefinitions
          break;
        }

        case 'MetadataStatement': {
          if (stmt.key === 'PROGRAM-ID') context.metadata.programId = stmt.value;
          if (stmt.key === 'TITLE') context.metadata.title = stmt.value;
          if (stmt.key === 'AUTHOR') context.metadata.author = stmt.value;
          break;
        }

        case 'TempoStatement': {
          const resolved = this.resolveNumericParam(
            stmt.bpm,
            stmt.bpmControl,
            'tempo',
            'BPM',
            'Tempo',
            false,
            stmt.line,
            stmt.column,
            cursor,
            context,
          );
          if (resolved.value < 20 || resolved.value > 400) {
            context.diagnostics.push({
              severity: 'error',
              message: `TEMPO inválido (${resolved.value} BPM). Use um valor entre 20 e 400 BPM.`,
              line: stmt.line,
              column: stmt.column,
            });
            break;
          }
          cursor.bpm = resolved.value;
          break;
        }

        case 'WaveStatement': {
          cursor.waveform = stmt.waveform;
          break;
        }

        case 'VolumeStatement': {
          const resolved = this.resolveNumericParam(
            stmt.volume,
            stmt.volumeControl,
            'volume',
            '%',
            'Volume',
            true,
            stmt.line,
            stmt.column,
            cursor,
            context,
          );
          if (resolved.value < 0 || resolved.value > 100) {
            context.diagnostics.push({
              severity: 'error',
              message: `VOLUME inválido (${resolved.value}). Use 0..1 ou 0..100.`,
              line: stmt.line,
              column: stmt.column,
            });
            break;
          }
          cursor.volume = Math.max(0, Math.min(1, resolved.normalized)) * 0.4;
          break;
        }

        case 'FilterStatement': {
          if (stmt.mode === 'off') {
            delete cursor.controlRefs.filterFrequencyHz;
            delete cursor.controlRefs.filterQ;
            cursor.effects = {
              ...cursor.effects,
              filter: {
                mode: 'off',
                frequencyHz: stmt.frequencyHz,
                q: stmt.q,
              },
            };
            break;
          }

          const freqResolved = this.resolveNumericParam(
            stmt.frequencyHz,
            stmt.frequencyControl,
            'filterFrequencyHz',
            'Hz',
            'Cutoff',
            false,
            stmt.line,
            stmt.column,
            cursor,
            context,
          );
          const qResolved = this.resolveNumericParam(
            stmt.q,
            stmt.qControl,
            'filterQ',
            'Q',
            'Q',
            false,
            stmt.line,
            stmt.column,
            cursor,
            context,
          );

          if (freqResolved.value < 20 || freqResolved.value > 20000) {
            context.diagnostics.push({
              severity: 'error',
              message: `Frequência de FILTER inválida (${freqResolved.value} Hz). Use entre 20 e 20000 Hz.`,
              line: stmt.line,
              column: stmt.column,
            });
            break;
          }
          cursor.effects = {
            ...cursor.effects,
            filter: {
              mode: stmt.mode,
              frequencyHz: freqResolved.value,
              q: Math.max(0.1, Math.min(20, qResolved.value)),
            },
          };
          break;
        }

        case 'DelayStatement': {
          const mixResolved = stmt.mixControl
            ? this.resolveNumericParam(
                stmt.mix,
                stmt.mixControl,
                'delayMix',
                '%',
                'Delay',
                true,
                stmt.line,
                stmt.column,
                cursor,
                context,
              )
            : (() => {
                delete cursor.controlRefs.delayMix;
                return { value: stmt.mix, normalized: stmt.mix };
              })();

          let nextTimeSec = cursor.effects.delay.timeSec;
          if (stmt.timeSec !== undefined || stmt.timeControl !== undefined) {
            const timeResolved = this.resolveNumericParam(
              stmt.timeSec ?? cursor.effects.delay.timeSec,
              stmt.timeControl,
              'delayTimeSec',
              's',
              'Delay Time',
              false,
              stmt.line,
              stmt.column,
              cursor,
              context,
            );
            nextTimeSec = timeResolved.value;
          }

          let nextFeedback = cursor.effects.delay.feedback;
          if (stmt.feedback !== undefined || stmt.feedbackControl !== undefined) {
            if (stmt.feedbackControl) {
              const fbResolved = this.resolveNumericParam(
                stmt.feedback ?? cursor.effects.delay.feedback,
                stmt.feedbackControl,
                'delayFeedback',
                '%',
                'Feedback',
                true,
                stmt.line,
                stmt.column,
                cursor,
                context,
              );
              nextFeedback = fbResolved.normalized;
            } else {
              delete cursor.controlRefs.delayFeedback;
              nextFeedback = stmt.feedback ?? cursor.effects.delay.feedback;
            }
          }

          if (mixResolved.normalized < 0 || mixResolved.normalized > 1) {
            context.diagnostics.push({
              severity: 'error',
              message: 'Nível de DELAY deve estar entre 0% e 100%.',
              line: stmt.line,
              column: stmt.column,
            });
            break;
          }
          cursor.effects = {
            ...cursor.effects,
            delay: {
              mix: mixResolved.normalized,
              timeSec: Math.max(0.02, Math.min(2.0, nextTimeSec)),
              feedback: Math.max(0, Math.min(0.88, nextFeedback)),
            },
          };
          break;
        }

        case 'ReverbStatement': {
          const mixResolved = stmt.mixControl
            ? this.resolveNumericParam(
                stmt.mix,
                stmt.mixControl,
                'reverbMix',
                '%',
                'Reverb',
                true,
                stmt.line,
                stmt.column,
                cursor,
                context,
              )
            : (() => {
                delete cursor.controlRefs.reverbMix;
                return { value: stmt.mix, normalized: stmt.mix };
              })();

          if (mixResolved.normalized < 0 || mixResolved.normalized > 1) {
            context.diagnostics.push({
              severity: 'error',
              message: 'Nível de REVERB deve estar entre 0% e 100%.',
              line: stmt.line,
              column: stmt.column,
            });
            break;
          }
          cursor.effects = {
            ...cursor.effects,
            reverbMix: mixResolved.normalized,
          };
          break;
        }

        case 'EnvelopeStatement': {
          cursor.effects = {
            ...cursor.effects,
            envelope: {
              attackSec: Math.max(0.002, Math.min(4, stmt.attackSec ?? cursor.effects.envelope.attackSec)),
              decaySec: Math.max(0.005, Math.min(4, stmt.decaySec ?? cursor.effects.envelope.decaySec)),
              sustainLevel: Math.max(
                0.01,
                Math.min(1, stmt.sustainLevel ?? cursor.effects.envelope.sustainLevel),
              ),
              releaseSec: Math.max(0.01, Math.min(5, stmt.releaseSec ?? cursor.effects.envelope.releaseSec)),
            },
          };
          break;
        }

        case 'DetuneStatement': {
          const centsResolved = this.resolveNumericParam(
            stmt.cents,
            stmt.centsControl,
            'detuneCents',
            'cents',
            'Detune',
            false,
            stmt.line,
            stmt.column,
            cursor,
            context,
          );
          if (centsResolved.value < 0 || centsResolved.value > 100) {
            context.diagnostics.push({
              severity: 'error',
              message: `DETUNE inválido (${centsResolved.value} cents). Use entre 0 e 100 cents.`,
              line: stmt.line,
              column: stmt.column,
            });
            break;
          }
          cursor.effects = {
            ...cursor.effects,
            detuneCents: centsResolved.value,
          };
          break;
        }

        case 'VisualizerStatement': {
          context.visualizerMode = stmt.mode;
          break;
        }

        case 'TransposeStatement': {
          cursor.transposeSemitones = stmt.semitones;
          break;
        }

        case 'ScaleStatement': {
          context.scale = `${stmt.root} ${stmt.mode.toUpperCase()}`;
          context.logs.push({
            timestampOffsetSec: Math.round(cursor.currentTimeSec * 1000) / 1000,
            beat: Math.round(cursor.currentBeat * 1000) / 1000,
            level: 'info',
            message: `Escala definida: ${context.scale} (${stmt.notes.join(' ')})`,
            line: stmt.line,
          });
          break;
        }

        case 'PanStatement': {
          const panResolved = this.resolveNumericParam(
            stmt.pan,
            stmt.panControl,
            'pan',
            '%',
            'Pan',
            true,
            stmt.line,
            stmt.column,
            cursor,
            context,
          );
          cursor.effects = {
            ...cursor.effects,
            pan: Math.max(-1, Math.min(1, panResolved.normalized)),
          };
          break;
        }

        case 'LfoStatement': {
          if (stmt.mode === 'off') {
            cursor.effects = {
              ...cursor.effects,
              lfo: undefined,
            };
            break;
          }
          cursor.effects = {
            ...cursor.effects,
            filter:
              cursor.effects.filter.mode === 'off'
                ? { ...cursor.effects.filter, mode: 'lowpass' }
                : cursor.effects.filter,
            lfo: {
              rateHz: stmt.rateHz,
              depthHz: stmt.depthHz,
            },
          };
          break;
        }

        case 'SweepStatement': {
          if (stmt.mode === 'off') {
            cursor.effects = {
              ...cursor.effects,
              sweep: undefined,
            };
            break;
          }
          cursor.effects = {
            ...cursor.effects,
            filter:
              cursor.effects.filter.mode === 'off'
                ? {
                    ...cursor.effects.filter,
                    mode: 'lowpass',
                    frequencyHz: stmt.startHz,
                  }
                : cursor.effects.filter,
            sweep: {
              startHz: stmt.startHz,
              endHz: stmt.endHz,
              durationBeats: stmt.durationBeats,
            },
          };
          break;
        }

        case 'SectionStatement': {
          // Definition only; executed when invoked via PERFORM
          break;
        }

        case 'PerformStatement': {
          const targetKey = stmt.sectionName.toUpperCase();
          const section = context.sections.get(targetKey);
          if (!section) {
            context.diagnostics.push({
              severity: 'error',
              message: `Seção "${stmt.sectionName}" não encontrada para PERFORM.`,
              line: stmt.line,
              column: stmt.column,
            });
            break;
          }

          if (context.callStack.includes(targetKey)) {
            context.diagnostics.push({
              severity: 'error',
              message: `Recursão circular detectada ao chamar PERFORM "${stmt.sectionName}".`,
              line: stmt.line,
              column: stmt.column,
            });
            break;
          }

          if (context.callStack.length >= MAX_PERFORM_DEPTH) {
            context.diagnostics.push({
              severity: 'error',
              message: `Profundidade máxima de PERFORM (${MAX_PERFORM_DEPTH}) excedida.`,
              line: stmt.line,
              column: stmt.column,
            });
            break;
          }

          context.callStack.push(targetKey);
          try {
            for (let i = 0; i < stmt.times; i += 1) {
              if (context.events.length >= MAX_EVENTS) break;
              this.processStatements(section.statements, cursor, context);
            }
          } finally {
            context.callStack.pop();
          }
          break;
        }

        case 'TrackStatement': {
          const trackCursor: TrackCursor = {
            trackName: stmt.name.toUpperCase(),
            bpm: cursor.bpm,
            waveform: cursor.waveform,
            volume: cursor.volume,
            transposeSemitones: cursor.transposeSemitones,
            swingPercent: cursor.swingPercent,
            humanize: cursor.humanize ? { ...cursor.humanize } : undefined,
            pendingProbability: cursor.pendingProbability,
            activeRamps: [],
            effects: cloneEffects(cursor.effects),
            controlRefs: { ...cursor.controlRefs },
            currentBeat: 0,
            currentTimeSec: 0,
            eventCount: 0,
            hasDrums: false,
          };
          this.processStatements(stmt.statements, trackCursor, context);
          this.recordTrackSummary(trackCursor, context);
          break;
        }

        case 'HumanizeStatement': {
          cursor.humanize =
            stmt.mode === 'off'
              ? undefined
              : {
                  timingMs: stmt.timingMs,
                  velocityPercent: stmt.velocityPercent,
                };
          break;
        }

        case 'SwingStatement': {
          cursor.swingPercent = Math.max(0, Math.min(100, stmt.percent));
          break;
        }

        case 'RampStatement': {
          const valid = this.validateRampRange(stmt.param, stmt.startValue, stmt.endValue, stmt.line, stmt.column, context);
          if (!valid) break;
          cursor.activeRamps = cursor.activeRamps.filter((r) => r.param !== stmt.param);
          cursor.activeRamps.push({
            param: stmt.param,
            startValue: stmt.startValue,
            endValue: stmt.endValue,
            startBeat: cursor.currentBeat,
            durationBeats: stmt.durationBeats,
          });
          break;
        }

        case 'MaybeStatement': {
          const prevProb = cursor.pendingProbability;
          cursor.pendingProbability =
            prevProb !== undefined
              ? (prevProb * stmt.probabilityPercent) / 100
              : stmt.probabilityPercent;
          this.processStatements([stmt.statement], cursor, context);
          cursor.pendingProbability = prevProb;
          break;
        }

        case 'ChooseOneStatement': {
          this.scheduleChooseOneEvent(stmt, cursor, context);
          break;
        }

        case 'PatternStatement': {
          this.schedulePatternEvents(stmt, cursor, context);
          break;
        }

        case 'PlayNoteStatement': {
          this.scheduleNoteEvent('note', [stmt.note], stmt.beats, stmt.line, stmt.column, cursor, context);
          break;
        }

        case 'PlayNotesStatement': {
          for (const note of stmt.notes) {
            if (context.events.length >= MAX_EVENTS) break;
            this.scheduleNoteEvent('note', [note], stmt.beatsPerNote, stmt.line, stmt.column, cursor, context);
          }
          break;
        }

        case 'PlayChordStatement': {
          this.scheduleNoteEvent('chord', stmt.notes, stmt.beats, stmt.line, stmt.column, cursor, context);
          break;
        }

        case 'PlayChordsStatement': {
          for (const entry of stmt.chords) {
            if (context.events.length >= MAX_EVENTS) break;
            this.scheduleNoteEvent('chord', entry.notes, stmt.beatsPerChord, stmt.line, stmt.column, cursor, context);
          }
          break;
        }

        case 'ArpeggiateStatement': {
          const sequence = buildArpSequence(stmt.notes, stmt.direction);
          for (const note of sequence) {
            if (context.events.length >= MAX_EVENTS) break;
            this.scheduleNoteEvent('note', [note], stmt.beatsPerStep, stmt.line, stmt.column, cursor, context);
          }
          break;
        }

        case 'PlayEuclideanStatement': {
          const pattern = buildEuclideanPattern(stmt.pulses, stmt.steps);
          for (const hit of pattern) {
            if (context.events.length >= MAX_EVENTS) break;
            if (hit) {
              if (stmt.targetKind === 'drum' && stmt.drum) {
                this.scheduleDrumEvent(stmt.drum, stmt.beatsPerStep, stmt.line, stmt.column, cursor, context);
              } else if (stmt.targetKind === 'note' && stmt.note) {
                this.scheduleNoteEvent('note', [stmt.note], stmt.beatsPerStep, stmt.line, stmt.column, cursor, context);
              }
            } else {
              this.scheduleRest(stmt.beatsPerStep, stmt.line, stmt.column, cursor, context);
            }
          }
          break;
        }

        case 'PlayDrumStatement': {
          this.scheduleDrumEvent(stmt.drum, stmt.beats, stmt.line, stmt.column, cursor, context);
          break;
        }

        case 'PlayDrumsStatement': {
          for (const drum of stmt.drums) {
            if (context.events.length >= MAX_EVENTS) break;
            this.scheduleDrumEvent(drum, stmt.beatsPerHit, stmt.line, stmt.column, cursor, context);
          }
          break;
        }

        case 'PlaySampleStatement': {
          this.scheduleSampleEvent(
            stmt.sampleName,
            stmt.beats,
            stmt.rate,
            stmt.offsetSec,
            stmt.line,
            stmt.column,
            cursor,
            context,
          );
          break;
        }

        case 'RestStatement': {
          this.scheduleRest(stmt.beats, stmt.line, stmt.column, cursor, context);
          break;
        }

        case 'RepeatStatement': {
          for (let i = 0; i < stmt.times; i += 1) {
            if (context.events.length >= MAX_EVENTS) break;
            this.processStatements(stmt.body, cursor, context);
          }
          break;
        }

        case 'PrintStatement': {
          context.logs.push({
            timestampOffsetSec: Math.round(cursor.currentTimeSec * 1000) / 1000,
            beat: Math.round(cursor.currentBeat * 1000) / 1000,
            level: 'print',
            message: `[${cursor.trackName}] ${stmt.message}`,
            line: stmt.line,
          });
          break;
        }
      }
    }
  }

  private resolveNumericParam(
    fallbackLiteral: number,
    controlParam: NumericParamValue | undefined,
    paramType: ControlTargetParam,
    unit: string,
    paramLabel: string,
    isPercent: boolean,
    line: number,
    column: number,
    cursor: TrackCursor,
    context: PlannerContext,
  ): { value: number; normalized: number } {
    if (!controlParam || controlParam.kind === 'literal') {
      delete cursor.controlRefs[paramType];
      const normalized = isPercent && fallbackLiteral > 1 ? fallbackLiteral / 100 : fallbackLiteral;
      return { value: fallbackLiteral, normalized };
    }

    if (controlParam.kind === 'controlRef') {
      const descriptor = context.controls.get(controlParam.controlName);
      if (!descriptor) {
        context.diagnostics.push({
          severity: 'error',
          message: `Controle ou variável "${controlParam.controlName}" não foi declarado.`,
          line,
          column,
          lexeme: controlParam.controlName,
        });
        return { value: fallbackLiteral, normalized: fallbackLiteral };
      }

      if (!descriptor.unit && unit) {
        descriptor.unit = unit;
      }
      descriptor.usageLines.add(line);
      const alreadyBound = descriptor.bindings.some(
        (b) => b.trackName === cursor.trackName && b.param === paramType && b.line === line,
      );
      if (!alreadyBound) {
        descriptor.bindings.push({
          trackName: cursor.trackName,
          param: paramType,
          line,
        });
      }
      cursor.controlRefs[paramType] = descriptor.name;

      const normalized =
        isPercent && (descriptor.max > 1 || Math.abs(descriptor.min) > 1)
          ? descriptor.defaultValue / 100
          : descriptor.defaultValue;
      return { value: descriptor.defaultValue, normalized };
    }

    const inlineName = `${cursor.trackName}-${paramType.toUpperCase()}-L${line}`;
    let descriptor = context.controls.get(inlineName);
    if (!descriptor) {
      descriptor = {
        name: inlineName,
        label: `${cursor.trackName} ${paramLabel}`,
        kind: 'inline',
        defaultValue: controlParam.defaultValue,
        min: controlParam.min,
        max: controlParam.max,
        step: controlParam.step,
        unit,
        declarationLine: line,
        usageLines: new Set<number>([line]),
        bindings: [{ trackName: cursor.trackName, param: paramType, line }],
      };
      context.controls.set(inlineName, descriptor);
    }
    cursor.controlRefs[paramType] = descriptor.name;

    const normalized =
      isPercent && (descriptor.max > 1 || Math.abs(descriptor.min) > 1)
        ? descriptor.defaultValue / 100
        : descriptor.defaultValue;
    return { value: descriptor.defaultValue, normalized };
  }

  private cloneControlRefs(
    refs: Partial<Record<ControlTargetParam, string>>,
  ): Partial<Record<ControlTargetParam, string>> | undefined {
    const keys = Object.keys(refs);
    return keys.length > 0 ? { ...refs } : undefined;
  }

  private recordTrackSummary(cursor: TrackCursor, context: PlannerContext): void {
    const existing = context.trackSummaries.get(cursor.trackName);
    const totalBeats = Math.round(cursor.currentBeat * 1000) / 1000;
    const totalDurationSec = Math.round(cursor.currentTimeSec * 1000) / 1000;
    const volumePercent = Math.round((cursor.volume / 0.4) * 100);

    if (existing) {
      context.trackSummaries.set(cursor.trackName, {
        name: cursor.trackName,
        eventCount: existing.eventCount + cursor.eventCount,
        totalBeats: Math.max(existing.totalBeats, totalBeats),
        totalDurationSec: Math.max(existing.totalDurationSec, totalDurationSec),
        waveform: cursor.waveform,
        volume: volumePercent,
        hasDrums: existing.hasDrums || cursor.hasDrums,
        effects: cloneEffects(cursor.effects),
      });
      return;
    }

    context.trackSummaries.set(cursor.trackName, {
      name: cursor.trackName,
      eventCount: cursor.eventCount,
      totalBeats,
      totalDurationSec,
      waveform: cursor.waveform,
      volume: volumePercent,
      hasDrums: cursor.hasDrums,
      effects: cloneEffects(cursor.effects),
    });
  }

  private scheduleNoteEvent(
    type: 'note' | 'chord',
    rawNotes: string[],
    beats: number,
    line: number,
    column: number,
    cursor: TrackCursor,
    context: PlannerContext,
  ): void {
    if (beats <= 0) {
      context.diagnostics.push({
        severity: 'error',
        message: `Duração em beats deve ser maior que zero (recebido ${beats}).`,
        line,
        column,
      });
      return;
    }

    const notes: string[] = [];
    const frequencies: number[] = [];

    for (const rawNote of rawNotes) {
      try {
        const effectiveNote =
          cursor.transposeSemitones !== 0
            ? NoteFrequency.transpose(rawNote, cursor.transposeSemitones)
            : rawNote;
        const parsed = NoteFrequency.parse(effectiveNote);
        notes.push(parsed.canonical);
        frequencies.push(parsed.frequencyHz);
      } catch (err) {
        context.diagnostics.push({
          severity: 'error',
          message: err instanceof Error ? err.message : `Nota inválida: ${rawNote}`,
          line,
          column,
        });
        return;
      }
    }

    const timing = this.computeEventTimingAndRamps(beats, cursor);
    const effects = this.applyRampEffectsDefaults(cloneEffects(cursor.effects), timing.ramps);

    context.eventCounter += 1;
    cursor.eventCount += 1;
    context.events.push({
      id: `evt-${context.eventCounter}`,
      trackName: cursor.trackName,
      type,
      notes,
      frequencies,
      startBeat: cursor.currentBeat,
      durationBeats: beats,
      startTimeSec: timing.startTimeSec,
      durationSec: timing.durationSec,
      bpm: timing.effectiveBpm,
      waveform: cursor.waveform,
      volume: cursor.volume,
      effects,
      controlRefs: this.cloneControlRefs(cursor.controlRefs),
      probability: cursor.pendingProbability,
      humanize: cursor.humanize ? { ...cursor.humanize } : undefined,
      ramps: timing.ramps.length > 0 ? timing.ramps : undefined,
      line,
    });

    this.advanceCursor(cursor, beats, timing.durationSec);
  }

  private scheduleDrumEvent(
    drum: DrumType,
    beats: number,
    line: number,
    column: number,
    cursor: TrackCursor,
    context: PlannerContext,
  ): void {
    if (beats <= 0) {
      context.diagnostics.push({
        severity: 'error',
        message: `Duração em beats deve ser maior que zero (recebido ${beats}).`,
        line,
        column,
      });
      return;
    }

    const timing = this.computeEventTimingAndRamps(beats, cursor);
    const effects = this.applyRampEffectsDefaults(cloneEffects(cursor.effects), timing.ramps);

    context.eventCounter += 1;
    cursor.eventCount += 1;
    cursor.hasDrums = true;
    context.events.push({
      id: `evt-${context.eventCounter}`,
      trackName: cursor.trackName,
      type: 'drum',
      notes: [drum.toUpperCase()],
      frequencies: [],
      drum,
      startBeat: cursor.currentBeat,
      durationBeats: beats,
      startTimeSec: timing.startTimeSec,
      durationSec: timing.durationSec,
      bpm: timing.effectiveBpm,
      waveform: cursor.waveform,
      volume: cursor.volume,
      effects,
      controlRefs: this.cloneControlRefs(cursor.controlRefs),
      probability: cursor.pendingProbability,
      humanize: cursor.humanize ? { ...cursor.humanize } : undefined,
      ramps: timing.ramps.length > 0 ? timing.ramps : undefined,
      line,
    });

    this.advanceCursor(cursor, beats, timing.durationSec);
  }

  private scheduleSampleEvent(
    sampleName: string,
    beats: number,
    rate: number,
    offsetSec: number,
    line: number,
    column: number,
    cursor: TrackCursor,
    context: PlannerContext,
  ): void {
    if (beats <= 0) {
      context.diagnostics.push({
        severity: 'error',
        message: `Duração em beats do PLAY SAMPLE deve ser maior que zero (recebido ${beats}).`,
        line,
        column,
      });
      return;
    }

    const timing = this.computeEventTimingAndRamps(beats, cursor);
    const effects = this.applyRampEffectsDefaults(cloneEffects(cursor.effects), timing.ramps);

    context.eventCounter += 1;
    cursor.eventCount += 1;
    context.events.push({
      id: `evt-${context.eventCounter}`,
      trackName: cursor.trackName,
      type: 'sample',
      notes: [sampleName],
      frequencies: [],
      sampleName,
      sampleRate: rate,
      sampleOffsetSec: offsetSec,
      startBeat: cursor.currentBeat,
      durationBeats: beats,
      startTimeSec: timing.startTimeSec,
      durationSec: timing.durationSec,
      bpm: timing.effectiveBpm,
      waveform: cursor.waveform,
      volume: cursor.volume,
      effects,
      controlRefs: this.cloneControlRefs(cursor.controlRefs),
      probability: cursor.pendingProbability,
      humanize: cursor.humanize ? { ...cursor.humanize } : undefined,
      ramps: timing.ramps.length > 0 ? timing.ramps : undefined,
      line,
    });

    this.advanceCursor(cursor, beats, timing.durationSec);
  }

  private scheduleRest(
    beats: number,
    line: number,
    column: number,
    cursor: TrackCursor,
    context: PlannerContext,
  ): void {
    if (beats <= 0) {
      context.diagnostics.push({
        severity: 'error',
        message: `Duração do REST deve ser maior que zero (recebido ${beats}).`,
        line,
        column,
      });
      return;
    }

    const timing = this.computeEventTimingAndRamps(beats, cursor);

    context.eventCounter += 1;
    cursor.eventCount += 1;
    context.events.push({
      id: `evt-${context.eventCounter}`,
      trackName: cursor.trackName,
      type: 'rest',
      notes: [],
      frequencies: [],
      startBeat: cursor.currentBeat,
      durationBeats: beats,
      startTimeSec: timing.startTimeSec,
      durationSec: timing.durationSec,
      bpm: timing.effectiveBpm,
      waveform: cursor.waveform,
      volume: 0,
      effects: cloneEffects(cursor.effects),
      controlRefs: this.cloneControlRefs(cursor.controlRefs),
      line,
    });

    this.advanceCursor(cursor, beats, timing.durationSec);
  }

  private validateRampRange(
    param: AutomationParam,
    startValue: number,
    endValue: number,
    line: number,
    column: number,
    context: PlannerContext,
  ): boolean {
    if (param === 'filter' && (startValue < 20 || startValue > 20000 || endValue < 20 || endValue > 20000)) {
      context.diagnostics.push({
        severity: 'error',
        message: 'RAMP FILTER deve usar frequências entre 20 e 20000 Hz.',
        line,
        column,
      });
      return false;
    }
    if (param === 'tempo' && (startValue < 20 || startValue > 400 || endValue < 20 || endValue > 400)) {
      context.diagnostics.push({
        severity: 'error',
        message: 'RAMP TEMPO deve usar valores entre 20 e 400 BPM.',
        line,
        column,
      });
      return false;
    }
    if ((param === 'volume' || param === 'reverb' || param === 'delay') && (startValue < 0 || startValue > 100 || endValue < 0 || endValue > 100)) {
      context.diagnostics.push({
        severity: 'error',
        message: `RAMP ${param.toUpperCase()} deve usar valores entre 0 e 100%.`,
        line,
        column,
      });
      return false;
    }
    if (param === 'pan' && (startValue < -100 || startValue > 100 || endValue < -100 || endValue > 100)) {
      context.diagnostics.push({
        severity: 'error',
        message: 'RAMP PAN deve usar valores entre -100 e 100.',
        line,
        column,
      });
      return false;
    }
    return true;
  }

  private computeEventTimingAndRamps(
    beats: number,
    cursor: TrackCursor,
  ): {
    effectiveBpm: number;
    startTimeSec: number;
    durationSec: number;
    ramps: EventAutomationRamp[];
  } {
    const startBeat = cursor.currentBeat;
    const endBeat = startBeat + beats;

    let effectiveBpm = cursor.bpm;
    const tempoRamp = cursor.activeRamps.find((r) => r.param === 'tempo');
    if (tempoRamp && startBeat < tempoRamp.startBeat + tempoRamp.durationBeats && endBeat > tempoRamp.startBeat) {
      const progress = Math.max(
        0,
        Math.min(1, (startBeat - tempoRamp.startBeat) / Math.max(0.0001, tempoRamp.durationBeats)),
      );
      effectiveBpm = Math.max(
        20,
        Math.min(400, tempoRamp.startValue + (tempoRamp.endValue - tempoRamp.startValue) * progress),
      );
    }

    const secondsPerBeat = 60 / effectiveBpm;
    const durationSec = beats * secondsPerBeat;

    let swingOffsetBeats = 0;
    if (cursor.swingPercent > 0) {
      const modHalf = startBeat % 0.5;
      const modWhole = startBeat % 1.0;
      if (Math.abs(modHalf - 0.25) < 0.025) {
        swingOffsetBeats = (cursor.swingPercent / 100) * 0.125;
      } else if (beats >= 0.45 && Math.abs(modWhole - 0.5) < 0.025) {
        swingOffsetBeats = (cursor.swingPercent / 100) * 0.1667;
      }
    }

    const startTimeSec = cursor.currentTimeSec + swingOffsetBeats * secondsPerBeat;
    const ramps: EventAutomationRamp[] = [];

    for (const ramp of cursor.activeRamps) {
      if (ramp.param === 'tempo') continue;
      const rampEnd = ramp.startBeat + ramp.durationBeats;
      if (startBeat < rampEnd && endBeat > ramp.startBeat) {
        const t0 = Math.max(0, Math.min(1, (startBeat - ramp.startBeat) / ramp.durationBeats));
        const t1 = Math.max(0, Math.min(1, (endBeat - ramp.startBeat) / ramp.durationBeats));
        ramps.push({
          param: ramp.param,
          fromValue: ramp.startValue + (ramp.endValue - ramp.startValue) * t0,
          toValue: ramp.startValue + (ramp.endValue - ramp.startValue) * t1,
          durationSec,
        });
      }
    }

    return {
      effectiveBpm,
      startTimeSec,
      durationSec,
      ramps,
    };
  }

  private applyRampEffectsDefaults(
    effects: AudioEffectsConfig,
    ramps: EventAutomationRamp[],
  ): AudioEffectsConfig {
    let next = effects;
    for (const ramp of ramps) {
      if (ramp.param === 'filter') {
        next = {
          ...next,
          filter: {
            mode: next.filter.mode === 'off' ? 'lowpass' : next.filter.mode,
            frequencyHz: Math.max(20, Math.min(20000, ramp.fromValue)),
            q: next.filter.q,
          },
        };
      } else if (ramp.param === 'delay') {
        next = {
          ...next,
          delay: {
            ...next.delay,
            mix: Math.max(0.001, Math.min(1, ramp.fromValue / 100)),
          },
        };
      } else if (ramp.param === 'reverb') {
        next = {
          ...next,
          reverbMix: Math.max(0.001, Math.min(1, ramp.fromValue / 100)),
        };
      } else if (ramp.param === 'pan') {
        next = {
          ...next,
          pan: Math.max(-1, Math.min(1, ramp.fromValue / 100)),
        };
      }
    }
    return next;
  }

  private advanceCursor(cursor: TrackCursor, beats: number, durationSec: number): void {
    cursor.currentBeat += beats;
    cursor.currentTimeSec += durationSec;
    if (cursor.activeRamps.length > 0) {
      cursor.activeRamps = cursor.activeRamps.filter(
        (r) => r.startBeat + r.durationBeats > cursor.currentBeat + 0.0001,
      );
    }
  }

  private scheduleChooseOneEvent(
    stmt: ChooseOneStatementNode,
    cursor: TrackCursor,
    context: PlannerContext,
  ): void {
    if (stmt.beats <= 0) {
      context.diagnostics.push({
        severity: 'error',
        message: `Duração em CHOOSE ONE OF deve ser maior que zero (recebido ${stmt.beats}).`,
        line: stmt.line,
        column: stmt.column,
      });
      return;
    }

    const timing = this.computeEventTimingAndRamps(stmt.beats, cursor);
    const effects = this.applyRampEffectsDefaults(cloneEffects(cursor.effects), timing.ramps);

    if (stmt.targetKind === 'drum' && stmt.drums && stmt.drums.length > 0) {
      context.eventCounter += 1;
      cursor.eventCount += 1;
      cursor.hasDrums = true;
      const firstDrum = stmt.drums[0];
      context.events.push({
        id: `evt-${context.eventCounter}`,
        trackName: cursor.trackName,
        type: 'drum',
        notes: [firstDrum.toUpperCase()],
        frequencies: [],
        drum: firstDrum,
        drumChoices: stmt.drums,
        startBeat: cursor.currentBeat,
        durationBeats: stmt.beats,
        startTimeSec: timing.startTimeSec,
        durationSec: timing.durationSec,
        bpm: timing.effectiveBpm,
        waveform: cursor.waveform,
        volume: cursor.volume,
        effects,
        controlRefs: this.cloneControlRefs(cursor.controlRefs),
        probability: cursor.pendingProbability,
        humanize: cursor.humanize ? { ...cursor.humanize } : undefined,
        ramps: timing.ramps.length > 0 ? timing.ramps : undefined,
        line: stmt.line,
      });
      this.advanceCursor(cursor, stmt.beats, timing.durationSec);
      return;
    }

    const rawNotes = stmt.notes ?? [];
    const noteChoices: string[] = [];
    const frequencyChoices: number[] = [];

    for (const rawNote of rawNotes) {
      try {
        const effectiveNote =
          cursor.transposeSemitones !== 0
            ? NoteFrequency.transpose(rawNote, cursor.transposeSemitones)
            : rawNote;
        const parsed = NoteFrequency.parse(effectiveNote);
        noteChoices.push(parsed.canonical);
        frequencyChoices.push(parsed.frequencyHz);
      } catch (err) {
        context.diagnostics.push({
          severity: 'error',
          message: err instanceof Error ? err.message : `Nota inválida em CHOOSE ONE OF: ${rawNote}`,
          line: stmt.line,
          column: stmt.column,
        });
        return;
      }
    }

    if (noteChoices.length === 0) return;

    context.eventCounter += 1;
    cursor.eventCount += 1;
    context.events.push({
      id: `evt-${context.eventCounter}`,
      trackName: cursor.trackName,
      type: 'note',
      notes: [noteChoices[0]],
      frequencies: [frequencyChoices[0]],
      noteChoices,
      frequencyChoices,
      startBeat: cursor.currentBeat,
      durationBeats: stmt.beats,
      startTimeSec: timing.startTimeSec,
      durationSec: timing.durationSec,
      bpm: timing.effectiveBpm,
      waveform: cursor.waveform,
      volume: cursor.volume,
      effects,
      controlRefs: this.cloneControlRefs(cursor.controlRefs),
      probability: cursor.pendingProbability,
      humanize: cursor.humanize ? { ...cursor.humanize } : undefined,
      ramps: timing.ramps.length > 0 ? timing.ramps : undefined,
      line: stmt.line,
    });

    this.advanceCursor(cursor, stmt.beats, timing.durationSec);
  }

  private schedulePatternEvents(
    stmt: PatternStatementNode,
    cursor: TrackCursor,
    context: PlannerContext,
  ): void {
    const savedVolume = cursor.volume;
    for (const ch of stmt.pattern) {
      if (context.events.length >= MAX_EVENTS) break;

      if (ch === '.' || ch === '-' || ch === '_') {
        this.scheduleRest(stmt.stepBeats, stmt.line, stmt.column, cursor, context);
        continue;
      }

      let velScale = 1.0;
      if (ch === 'X' || ch === '*') {
        velScale = 1.25;
      } else if (ch === 'o') {
        velScale = 0.55;
      } else if (ch !== 'x') {
        this.scheduleRest(stmt.stepBeats, stmt.line, stmt.column, cursor, context);
        continue;
      }

      cursor.volume = Math.min(0.4, savedVolume * velScale);
      if (stmt.targetKind === 'drum' && stmt.drum) {
        this.scheduleDrumEvent(stmt.drum, stmt.stepBeats, stmt.line, stmt.column, cursor, context);
      } else if (stmt.targetKind === 'note' && stmt.note) {
        this.scheduleNoteEvent('note', [stmt.note], stmt.stepBeats, stmt.line, stmt.column, cursor, context);
      }
      cursor.volume = savedVolume;
    }
  }
}
