import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type CompilationDiagnostic,
  type ControlDescriptor,
  type ExecutionPlan,
  type ProgramNode,
  type ScheduledAudioEvent,
  type Token,
  type VisualizerMode,
  type WaveformType,
  compileSythmCode,
} from '@sythm/core';
import { checkBackendHealth, compileWithBackendOrFallback } from './infrastructure/api/CompilerClient';
import { createProjectCopyContext } from './infrastructure/storage/copyResolver';
import {
  type AuthUser,
  fetchCloudWorkspace,
  fetchCurrentUser,
  getStoredUser,
  saveCloudWorkspace,
} from './infrastructure/api/AuthClient';
import { AuthProfileModal } from './presentation/components/AuthProfileModal';
import { PianoRollModal } from './presentation/components/PianoRollModal';
import {
  type AudioSampleItem,
  buildSampleBufferMap,
  createDemoBreakbeatSample,
  deletePersistedSample,
  importAudioFile,
  loadPersistedSamples,
} from './infrastructure/audio/AudioSampleStore';
import { exportExecutionPlanToWav, triggerWavDownload } from './infrastructure/audio/WavExporter';
import { WebAudioEngine } from './infrastructure/audio/WebAudioEngine';
import {
  type SythmProjectFile,
  type SythmWorkspaceState,
  createFileInFolder,
  createFolder,
  decodeCodeFromHash,
  deleteFile,
  deleteFolder,
  duplicateFile,
  encodeCodeToHash,
  importSharedCodeIntoWorkspace,
  loadWorkspaceState,
  renameFile,
  renameFolder,
  resetFactoryPresets,
  saveWorkspaceState,
  toggleFolderExpanded,
  updateFileCode,
} from './infrastructure/storage/ProjectStorage';
import {
  type SythmSettings,
  type VisualizerDefaultMode,
  applyThemeToDocument,
  loadSettings,
  saveSettings,
} from './infrastructure/storage/SettingsStorage';
import { AudioVisualizerBar } from './presentation/components/AudioVisualizerBar';
import { AudioImportModal } from './presentation/components/AudioImportModal';
import { CodeEditor } from './presentation/components/CodeEditor';
import { DebugArea, type DebugTab, type IdeConsoleLine } from './presentation/components/DebugArea';
import { ProjectNavigator } from './presentation/components/ProjectNavigator';
import { SettingsModal } from './presentation/components/SettingsModal';
import { SythmTutorialModal } from './presentation/components/SythmTutorialModal';
import { TrackMixerBar } from './presentation/components/TrackMixerBar';
import { type IdeStatus, XcodeToolbar } from './presentation/components/XcodeToolbar';
import { updateControlValueInCode } from './presentation/components/controlCodeSync';

function formatNow(): string {
  const now = new Date();
  return now.toLocaleTimeString('pt-BR', { hour12: false });
}

export function App() {
  const [settings, setSettings] = useState<SythmSettings>(() => loadSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isAudioImportOpen, setIsAudioImportOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPianoRollOpen, setIsPianoRollOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => getStoredUser());
  const [samples, setSamples] = useState<AudioSampleItem[]>([]);

  const sampleBufferMap = useMemo(() => buildSampleBufferMap(samples), [samples]);

  const [workspace, setWorkspace] = useState<SythmWorkspaceState>(() => {
    const loaded = loadWorkspaceState();
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#code=')) {
      const sharedCode = decodeCodeFromHash(window.location.hash);
      if (sharedCode) {
        const imported = importSharedCodeIntoWorkspace(loaded, sharedCode);
        saveWorkspaceState(imported.state);
        return imported.state;
      }
    }
    return loaded;
  });

  useEffect(() => {
    if (!authUser) {
      saveWorkspaceState(workspace);
      return;
    }
    const timer = window.setTimeout(() => {
      void saveCloudWorkspace(workspace).catch(() => {
        // Fallback cache in localStorage if offline
        saveWorkspaceState(workspace);
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [workspace, authUser]);

  // Load cloud workspace on mount if already authenticated
  useEffect(() => {
    if (!authUser) return;
    void fetchCurrentUser().then((verified) => {
      if (!verified) {
        setAuthUser(null);
        return;
      }
      setAuthUser(verified);
      void fetchCloudWorkspace()
        .then((cloudWs) => {
          if (cloudWs && Array.isArray(cloudWs.files) && cloudWs.files.length > 0) {
            setWorkspace(cloudWs);
          } else {
            void saveCloudWorkspace(workspace);
          }
        })
        .catch(() => undefined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeFile = useMemo(
    () =>
      workspace.files.find((f) => f.id === workspace.activeFileId) ?? workspace.files[0],
    [workspace.activeFileId, workspace.files],
  );

  const activeFolder = useMemo(
    () => workspace.folders.find((f) => f.id === activeFile.folderId),
    [activeFile.folderId, workspace.folders],
  );

  const filename = activeFile.name;
  const code = activeFile.code;

  // COPY "arquivo". resolve entre os arquivos do projeto (ProjectStorage).
  const copyContext = useMemo(
    () => createProjectCopyContext(workspace.files, workspace.folders, activeFile),
    [workspace.files, workspace.folders, activeFile],
  );
  const copyContextRef = useRef(copyContext);
  copyContextRef.current = copyContext;
  const [revealRequest, setRevealRequest] = useState<{
    fileName: string;
    start: number;
    end: number;
    nonce: number;
  } | null>(null);

  const setCode = useCallback(
    (next: string | ((prev: string) => string)) => {
      setWorkspace((prev) => {
        const currentFile =
          prev.files.find((f) => f.id === prev.activeFileId) ?? prev.files[0];
        const nextCode =
          typeof next === 'function' ? next(currentFile.code) : next;
        if (nextCode === currentFile.code) return prev;
        return updateFileCode(prev, currentFile.id, nextCode);
      });
    },
    [],
  );

  const [visualizerModeOverride, setVisualizerModeOverride] =
    useState<VisualizerMode | null>(() =>
      settings.defaultVisualizerMode === 'ALL'
        ? null
        : (settings.defaultVisualizerMode.toLowerCase() as VisualizerMode),
    );
  const [isExportingWav, setIsExportingWav] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const [status, setStatus] = useState<IdeStatus>('ready');
  const [loopEnabled, setLoopEnabled] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);

  const [tokens, setTokens] = useState<Token[]>([]);
  const [ast, setAst] = useState<ProgramNode | null>(null);
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [diagnostics, setDiagnostics] = useState<CompilationDiagnostic[]>([]);

  const [bpm, setBpm] = useState<number>(120);
  const [waveform, setWaveform] = useState<WaveformType>('sawtooth');
  const [activeEventsMap, setActiveEventsMap] = useState<Map<string, ScheduledAudioEvent>>(
    () => new Map(),
  );
  const [activeEvent, setActiveEvent] = useState<ScheduledAudioEvent | null>(null);

  const [mutedTracks, setMutedTracks] = useState<Set<string>>(() => new Set());
  const [soloedTracks, setSoloedTracks] = useState<Set<string>>(() => new Set());
  const [controlValues, setControlValues] = useState<Record<string, number>>({});

  const livePreview = useMemo(() => compileSythmCode(code, copyContext), [code, copyContext]);
  const lastValidPreviewRef = useRef<{ tracks: ExecutionPlan['tracks']; controls: ControlDescriptor[] }>({
    tracks: [],
    controls: [],
  });

  if (livePreview.success && livePreview.plan) {
    lastValidPreviewRef.current = {
      tracks: livePreview.plan.tracks,
      controls: livePreview.plan.controls,
    };
  }

  const activeControls =
    livePreview.success && livePreview.plan
      ? livePreview.plan.controls
      : (plan?.controls ?? lastValidPreviewRef.current.controls);

  const mixerTracks =
    livePreview.success && livePreview.plan
      ? livePreview.plan.tracks
      : (plan?.tracks ?? lastValidPreviewRef.current.tracks);

  useEffect(() => {
    if (!livePreview.success || !livePreview.plan) return;
    const nextDefaults: Record<string, number> = {};
    for (const ctrl of livePreview.plan.controls) {
      nextDefaults[ctrl.name] = ctrl.defaultValue;
    }
    setControlValues(nextDefaults);
  }, [livePreview]);

  const [activeTab, setActiveTab] = useState<DebugTab>('console');
  const [consoleLines, setConsoleLines] = useState<IdeConsoleLine[]>([
    {
      id: 'init-1',
      timestamp: formatNow(),
      level: 'info',
      message: 'Sythm IDE pronta. Pressione Play ou Ctrl+Enter para compilar e tocar.',
    },
  ]);

  const audioEngineRef = useRef<WebAudioEngine | null>(null);
  const [audioEngine, setAudioEngine] = useState<WebAudioEngine | null>(null);
  const logSeqRef = useRef<number>(1);
  const codeRef = useRef<string>(code);
  codeRef.current = code;
  const lastLiveAudioCodeRef = useRef<string>('');
  const editorCursorRef = useRef<number>(0);

  const [isRecordingAutomation, setIsRecordingAutomation] = useState(false);
  const [recordedKeyframesCount, setRecordedKeyframesCount] = useState(0);
  const recordedAutomationRef = useRef<
    Array<{ control: ControlDescriptor; beat: number; value: number }>
  >([]);

  // Auto Quantized Hot-Swap while playing in LOOP mode
  useEffect(() => {
    if (!isPlaying || !loopEnabled) return;
    if (!livePreview.success || !livePreview.plan) return;
    if (code === lastLiveAudioCodeRef.current) return;

    const timer = window.setTimeout(() => {
      const engine = audioEngineRef.current;
      if (!engine || !engine.isPlaying() || !livePreview.plan) return;
      lastLiveAudioCodeRef.current = code;
      setPlan(livePreview.plan);
      setDiagnostics([]);
      setBpm(livePreview.plan.initialBpm);
      setWaveform(livePreview.plan.initialWaveform);
      engine.updatePlan(livePreview.plan);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [code, isPlaying, loopEnabled, livePreview]);

  useEffect(() => {
    saveSettings(settings);
    applyThemeToDocument(settings);
    audioEngine?.setMasterVolume(settings.masterVolumePercent);
  }, [settings, audioEngine]);

  useEffect(() => {
    audioEngine?.setSampleBuffers(sampleBufferMap);
  }, [audioEngine, sampleBufferMap]);

  useEffect(() => {
    void loadPersistedSamples().then((loaded) => {
      if (loaded.length > 0) {
        setSamples(loaded);
      }
    });
  }, []);

  const activeLines = useMemo(() => {
    const lines = new Set<number>();
    for (const evt of activeEventsMap.values()) {
      lines.add(evt.line);
    }
    return lines;
  }, [activeEventsMap]);

  const activeTracks = useMemo(() => {
    const tracks = new Set<string>();
    for (const evt of activeEventsMap.values()) {
      tracks.add(evt.trackName);
    }
    return tracks;
  }, [activeEventsMap]);

  const appendConsole = useCallback(
    (level: IdeConsoleLine['level'], message: string, location?: string) => {
      logSeqRef.current += 1;
      const entry: IdeConsoleLine = {
        id: `log-${logSeqRef.current}`,
        timestamp: formatNow(),
        level,
        message,
        location,
      };
      setConsoleLines((prev) => [...prev.slice(-199), entry]);
    },
    [],
  );

  useEffect(() => {
    const engine = new WebAudioEngine();
    audioEngineRef.current = engine;
    setAudioEngine(engine);

    void checkBackendHealth().then((ok) => {
      setBackendConnected(ok);
    });

    return () => {
      engine.dispose();
      audioEngineRef.current = null;
      setAudioEngine(null);
    };
  }, []);

  const handleStop = useCallback(() => {
    audioEngineRef.current?.stop();
    setIsPlaying(false);
    setActiveEventsMap(new Map());
    setActiveEvent(null);
    setStatus(diagnostics.some((d) => d.severity === 'error') ? 'error' : 'ready');
    appendConsole('info', 'Execução interrompida pelo usuário.');
  }, [appendConsole, diagnostics]);

  const handleToggleMute = useCallback(
    (trackName: string) => {
      setMutedTracks((prev) => {
        const next = new Set(prev);
        if (next.has(trackName)) {
          next.delete(trackName);
        } else {
          next.add(trackName);
        }
        audioEngineRef.current?.setTrackMix(next, soloedTracks);
        return next;
      });
    },
    [soloedTracks],
  );

  const handleToggleSolo = useCallback(
    (trackName: string) => {
      setSoloedTracks((prev) => {
        const next = new Set(prev);
        if (next.has(trackName)) {
          next.delete(trackName);
        } else {
          next.add(trackName);
        }
        audioEngineRef.current?.setTrackMix(mutedTracks, next);
        return next;
      });
    },
    [mutedTracks],
  );

  const runCompile = useCallback(
    async (playAfterCompile: boolean, codeOverride?: string) => {
      const targetCode = codeOverride ?? code;
      const result = await compileWithBackendOrFallback(targetCode, copyContextRef.current);
      setBackendConnected(result.source === 'backend');
      setTokens(result.tokens);
      setAst(result.ast);
      setPlan(result.plan);
      setDiagnostics(result.diagnostics);

      if (!result.success || !result.plan) {
        setStatus('error');
        for (const diag of result.diagnostics) {
          appendConsole('error', diag.message, `L${diag.line}:C${diag.column}`);
        }
        return;
      }

      const compiledPlan = result.plan;
      setBpm(compiledPlan.initialBpm);
      setWaveform(compiledPlan.initialWaveform);

      appendConsole(
        'info',
        `Compilado (${result.source}) em ${result.durationMs}ms — ${compiledPlan.tracks.length} track(s), ${result.tokens.length} tokens, ${compiledPlan.events.length} eventos (${compiledPlan.totalBeats} beats / ${compiledPlan.totalDurationSec}s).`,
      );

      if (!playAfterCompile) {
        for (const log of compiledPlan.logs) {
          appendConsole('print', log.message, log.line ? `L${log.line}` : undefined);
        }
        setStatus(isPlaying ? (loopEnabled ? 'looping' : 'playing') : 'ready');
        return;
      }

      const engine = audioEngineRef.current;
      if (!engine) return;

      if (engine.isPlaying() && loopEnabled) {
        lastLiveAudioCodeRef.current = targetCode;
        engine.updatePlan(compiledPlan);
        setStatus('looping');
        appendConsole('info', 'Live Reload: novo plano agendado para o próximo compasso.');
        return;
      }

      lastLiveAudioCodeRef.current = targetCode;
      setIsPlaying(true);
      setStatus(loopEnabled ? 'looping' : 'playing');
      setActiveEventsMap(new Map());

      await engine.start(compiledPlan, {
        loop: loopEnabled,
        mutedTracks,
        soloedTracks,
        onHotSwap: () => {
          appendConsole('info', 'Live Hot-Swap aplicado no compasso.');
        },
        onCycleStart: (cycle) => {
          setActiveEventsMap(new Map());
          if (cycle > 1) {
            appendConsole('info', `Loop ciclo #${cycle} iniciado.`);
          }
        },
        onEventStart: (event) => {
          setActiveEventsMap((prev) => {
            const next = new Map(prev);
            next.set(event.id, event);
            return next;
          });
          setActiveEvent(event);
          setBpm(event.bpm);
          setWaveform(event.waveform);

          if (event.type === 'drum') {
            appendConsole(
              'audio',
              `[${event.trackName}] DRUM ${event.notes.join(' ')} · ${event.durationBeats} beat(s)`,
              `L${event.line}`,
            );
          } else if (event.type === 'sample') {
            appendConsole(
              'audio',
              `[${event.trackName}] SAMPLE "${event.sampleName}" (rate ${event.sampleRate ?? 1}x) · ${event.durationBeats} beat(s)`,
              `L${event.line}`,
            );
          } else if (event.type !== 'rest') {
            appendConsole(
              'audio',
              `[${event.trackName}] ${event.type === 'chord' ? 'CHORD' : 'NOTE'} ${event.notes.join(' ')} (${event.frequencies.join(', ')} Hz) · ${event.durationBeats} beat(s)`,
              `L${event.line}`,
            );
          }
        },
        onEventEnd: (event) => {
          setActiveEventsMap((prev) => {
            if (!prev.has(event.id)) return prev;
            const next = new Map(prev);
            next.delete(event.id);
            return next;
          });
        },
        onLogTrigger: (log) => {
          appendConsole('print', log.message, log.line ? `L${log.line}` : undefined);
        },
        onComplete: () => {
          setIsPlaying(false);
          setActiveEventsMap(new Map());
          setActiveEvent(null);
          setStatus('ready');
          appendConsole('info', 'Execução finalizada.');
        },
      });
    },
    [appendConsole, code, isPlaying, loopEnabled, mutedTracks, soloedTracks],
  );

  const handleToggleLoop = useCallback(() => {
    setLoopEnabled((prev) => {
      const next = !prev;
      audioEngineRef.current?.setLoop(next);
      if (isPlaying) {
        setStatus(next ? 'looping' : 'playing');
      }
      appendConsole('info', `Modo Loop ${next ? 'ativado' : 'desativado'}.`);
      return next;
    });
  }, [appendConsole, isPlaying]);

  const resetPlaybackState = useCallback(() => {
    audioEngineRef.current?.stop();
    setIsPlaying(false);
    setActiveEventsMap(new Map());
    setActiveEvent(null);
    setMutedTracks(new Set());
    setSoloedTracks(new Set());
    audioEngineRef.current?.setTrackMix(new Set(), new Set());
    setDiagnostics([]);
    setPlan(null);
    setStatus('ready');
    setVisualizerModeOverride(null);
  }, []);

  const handleSelectFile = useCallback(
    (file: SythmProjectFile) => {
      resetPlaybackState();
      setWorkspace((prev) => ({ ...prev, activeFileId: file.id }));
      appendConsole('info', `Arquivo carregado: ${file.name}`);
    },
    [appendConsole, resetPlaybackState],
  );

  /** F12 / Ctrl+Clique em COPY ou em símbolo declarado num arquivo incluído: abre o arquivo e posiciona o cursor. */
  const handleOpenFileByName = useCallback(
    (fileName: string, range?: { start: number; end: number }) => {
      const target = workspace.files.find((f) => f.name.toLowerCase() === fileName.toLowerCase());
      if (!target) {
        appendConsole('error', `Arquivo "${fileName}" não encontrado no projeto.`);
        return;
      }
      handleSelectFile(target);
      if (range) {
        setRevealRequest({ fileName: target.name, start: range.start, end: range.end, nonce: Date.now() });
      }
    },
    [appendConsole, handleSelectFile, workspace.files],
  );

  const handleToggleFolder = useCallback((folderId: string) => {
    setWorkspace((prev) => toggleFolderExpanded(prev, folderId));
  }, []);

  const handleCreateFolder = useCallback(
    (name: string) => {
      setWorkspace((prev) => createFolder(prev, name));
      appendConsole('info', `Pasta criada: "${name}"`);
    },
    [appendConsole],
  );

  const handleRenameFolder = useCallback(
    (folderId: string, newName: string) => {
      setWorkspace((prev) => renameFolder(prev, folderId, newName));
      appendConsole('info', `Pasta renomeada para "${newName}".`);
    },
    [appendConsole],
  );

  const handleDeleteFolder = useCallback(
    (folderId: string) => {
      setWorkspace((prev) => deleteFolder(prev, folderId));
      appendConsole('info', 'Pasta removida do Project Navigator.');
    },
    [appendConsole],
  );

  const handleCreateFile = useCallback(
    (folderId: string, newName: string) => {
      resetPlaybackState();
      setWorkspace((prev) => {
        const res = createFileInFolder(prev, folderId, newName);
        return res.state;
      });
      appendConsole('info', `Arquivo criado: ${newName}`);
    },
    [appendConsole, resetPlaybackState],
  );

  const handleRenameFile = useCallback(
    (fileId: string, newName: string) => {
      setWorkspace((prev) => renameFile(prev, fileId, newName));
      appendConsole('info', `Arquivo renomeado para ${newName}.`);
    },
    [appendConsole],
  );

  const handleDuplicateFile = useCallback(
    (fileId: string) => {
      resetPlaybackState();
      setWorkspace((prev) => duplicateFile(prev, fileId)?.state ?? prev);
      appendConsole('info', 'Arquivo duplicado com sucesso.');
    },
    [appendConsole, resetPlaybackState],
  );

  const handleDeleteFile = useCallback(
    (fileId: string) => {
      resetPlaybackState();
      setWorkspace((prev) => deleteFile(prev, fileId));
      appendConsole('info', 'Arquivo removido.');
    },
    [appendConsole, resetPlaybackState],
  );

  const handleResetFactory = useCallback(() => {
    resetPlaybackState();
    setWorkspace((prev) => resetFactoryPresets(prev));
    appendConsole('info', 'Presets originais restaurados nas pastas padrão.');
  }, [appendConsole, resetPlaybackState]);

  const handleExportWav = useCallback(async () => {
    const compiled = compileSythmCode(codeRef.current, copyContextRef.current);
    if (!compiled.success || !compiled.plan) {
      setDiagnostics(compiled.diagnostics);
      setStatus('error');
      appendConsole('error', 'Não foi possível exportar .WAV: corrija os erros de compilação primeiro.');
      return;
    }

    setIsExportingWav(true);
    try {
      const overrideMap = new Map<string, number>(
        Object.entries(controlValues).map(([k, v]) => [k, v]),
      );
      const blob = await exportExecutionPlanToWav(compiled.plan, overrideMap, sampleBufferMap);
      triggerWavDownload(blob, filename);
      appendConsole('info', `Áudio renderizado offline e baixado em .WAV (${compiled.plan.totalDurationSec}s).`);
    } catch (error) {
      appendConsole(
        'error',
        `Erro ao exportar .WAV: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsExportingWav(false);
    }
  }, [appendConsole, controlValues, filename, sampleBufferMap]);

  const handleShareUrl = useCallback(() => {
    const hash = encodeCodeToHash(codeRef.current);
    const shareUrl = `${window.location.origin}${window.location.pathname}${hash}`;
    window.history.replaceState(null, '', hash);
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(shareUrl);
    }
    setShareCopied(true);
    appendConsole('info', 'Link compartilhável copiado para a área de transferência.');
    window.setTimeout(() => setShareCopied(false), 2200);
  }, [appendConsole]);

  const handleInsertSnippet = useCallback(
    (snippet: string) => {
      setCode((prev) => {
        const trimmedEnd = prev.endsWith('\n') ? prev : `${prev}\n`;
        return `${trimmedEnd}${snippet}\n`;
      });
    },
    [setCode],
  );

  const handleLoadTutorialExample = useCallback(
    (tutorialCode: string, title: string) => {
      audioEngineRef.current?.stop();
      setIsPlaying(false);
      setActiveEventsMap(new Map());
      setActiveEvent(null);
      setCode(tutorialCode);
      const compiled = compileSythmCode(tutorialCode);
      setTokens(compiled.tokens);
      setAst(compiled.ast);
      setPlan(compiled.plan);
      setDiagnostics(compiled.diagnostics);
      if (compiled.success && compiled.plan) {
        setBpm(compiled.plan.initialBpm);
        setWaveform(compiled.plan.initialWaveform);
        setStatus('ready');
      }
      appendConsole('info', `Exemplo carregado do Sythm Tutorial (${title}). Pressione Play para ouvir!`);
    },
    [appendConsole, setCode],
  );

  const handleApplyVisualizerDefault = useCallback((mode: VisualizerDefaultMode) => {
    setVisualizerModeOverride(mode.toLowerCase() as VisualizerMode);
  }, []);

  const handleImportAudioFiles = useCallback(
    async (fileList: FileList | File[]): Promise<AudioSampleItem | null> => {
      const filesArr = Array.from(fileList);
      let firstImported: AudioSampleItem | null = null;
      for (const file of filesArr) {
        const imported = await importAudioFile(file);
        if (!firstImported) firstImported = imported;
        setSamples((prev) => [imported, ...prev]);
        appendConsole(
          'info',
          `Áudio importado: "${imported.name}" (${imported.durationSec.toFixed(1)}s). Use PLAY SAMPLE "${imported.name}".`,
        );
      }
      return firstImported;
    },
    [appendConsole],
  );

  const handleCreateDemoSample = useCallback(async (): Promise<AudioSampleItem | null> => {
    const demo = await createDemoBreakbeatSample();
    setSamples((prev) => [demo, ...prev.filter((s) => s.name !== demo.name)]);
    appendConsole(
      'info',
      `Sample demo "${demo.name}" gerado (128 BPM). Use PLAY SAMPLE "${demo.name}".`,
    );
    return demo;
  }, [appendConsole]);

  const handleDeleteSample = useCallback(
    (sampleId: string) => {
      setSamples((prev) => prev.filter((s) => s.id !== sampleId));
      void deletePersistedSample(sampleId);
      appendConsole('info', 'Sample de áudio removido da biblioteca.');
    },
    [appendConsole],
  );

  const handleInsertSampleCommand = useCallback(
    (sampleName: string, beats: number) => {
      const safeName = sampleName.replace(/"/g, '');
      const snippet = `TRACK AUDIO-EXTERNO.\n  VOLUME IS 80.\n  PLAY SAMPLE "${safeName}" RATE 1.0 FOR ${beats} BEATS.\nEND-TRACK.`;
      handleInsertSnippet(snippet);
      appendConsole('info', `Comando PLAY SAMPLE "${safeName}" inserido no editor.`);
    },
    [appendConsole, handleInsertSnippet],
  );

  const handleLoadAudioProgram = useCallback(
    (generatedCode: string, title: string, andPlay: boolean) => {
      audioEngineRef.current?.stop();
      setIsPlaying(false);
      setActiveEventsMap(new Map());
      setActiveEvent(null);
      setCode(generatedCode);
      codeRef.current = generatedCode;
      appendConsole('info', `Programa gerado a partir de "${title}".`);
      void runCompile(andPlay, generatedCode);
    },
    [appendConsole, runCompile, setCode],
  );

  const handleControlChange = useCallback(
    (control: ControlDescriptor, newValue: number) => {
      setControlValues((prev) => ({ ...prev, [control.name]: newValue }));
      audioEngineRef.current?.setControlValue(control, newValue);

      if (control.bindings.some((b) => b.param === 'tempo')) {
        setBpm(Math.round(newValue));
      }

      const prevCode = codeRef.current;
      const nextCode = updateControlValueInCode(prevCode, control, newValue);
      if (nextCode !== prevCode) {
        codeRef.current = nextCode;
        setCode(nextCode);

        const updated = compileSythmCode(nextCode, copyContextRef.current);
        if (updated.success && updated.plan) {
          setPlan(updated.plan);
          setAst(updated.ast);
          setTokens(updated.tokens);
          audioEngineRef.current?.updatePlan(updated.plan);
        }
      }

      if (isRecordingAutomation) {
        const currentBeat = audioEngineRef.current?.getProgress().currentBeat ?? 0;
        recordedAutomationRef.current.push({
          control,
          beat: currentBeat,
          value: newValue,
        });
        setRecordedKeyframesCount(recordedAutomationRef.current.length);
      }
    },
    [isRecordingAutomation, setCode],
  );

  const handleInsertSnippetAtCursor = useCallback(
    (snippet: string) => {
      const current = codeRef.current;
      const pos = Math.max(0, Math.min(current.length, editorCursorRef.current || current.length));
      const needsNewlineBefore = pos > 0 && current[pos - 1] !== '\n';
      const insertion = `${needsNewlineBefore ? '\n' : ''}${snippet}`;
      const nextCode = `${current.slice(0, pos)}${insertion}${current.slice(pos)}`;
      editorCursorRef.current = pos + insertion.length;
      setCode(nextCode);
      appendConsole('info', `Piano Roll inseriu: ${snippet.trim()}`);
    },
    [appendConsole, setCode],
  );

  const handleToggleRecordAutomation = useCallback(() => {
    if (!isRecordingAutomation) {
      recordedAutomationRef.current = [];
      setRecordedKeyframesCount(0);
      setIsRecordingAutomation(true);
      appendConsole('info', 'REC Automação iniciado: mova os sliders para gravar keyframes.');
      return;
    }

    setIsRecordingAutomation(false);
    const entries = recordedAutomationRef.current;
    recordedAutomationRef.current = [];
    setRecordedKeyframesCount(0);

    if (entries.length < 2) {
      appendConsole('info', 'REC Automação parado (nenhum movimento suficiente gravado).');
      return;
    }

    const PARAM_TO_RAMP: Partial<Record<string, string>> = {
      filterFrequencyHz: 'FILTER',
      volume: 'VOLUME',
      pan: 'PAN',
      reverbMix: 'REVERB',
      delayMix: 'DELAY',
      tempo: 'TEMPO',
    };

    const byControl = new Map<string, typeof entries>();
    for (const entry of entries) {
      const list = byControl.get(entry.control.name) ?? [];
      list.push(entry);
      byControl.set(entry.control.name, list);
    }

    let updatedCode = codeRef.current;
    const generatedRamps: string[] = [];

    for (const [, list] of byControl.entries()) {
      if (list.length < 2) continue;
      const first = list[0];
      const last = list[list.length - 1];
      if (Math.abs(last.value - first.value) < 0.01) continue;

      const binding = first.control.bindings[0];
      if (!binding) continue;
      const rampParam = PARAM_TO_RAMP[binding.param];
      if (!rampParam) continue;

      const spanBeats = Math.max(1, Math.round((Math.abs(last.beat - first.beat) || 4) * 2) / 2);
      const fromVal = Math.round(first.value * 100) / 100;
      const toVal = Math.round(last.value * 100) / 100;
      const rampLine = `    RAMP ${rampParam} FROM ${fromVal} TO ${toVal} OVER ${spanBeats} BEATS.`;

      const trackRegex = new RegExp(`(TRACK\\s+${binding.trackName}\\s*\\.)`, 'i');
      if (trackRegex.test(updatedCode)) {
        updatedCode = updatedCode.replace(trackRegex, `$1\n${rampLine}`);
        generatedRamps.push(`[${binding.trackName}] ${rampLine.trim()}`);
      } else {
        updatedCode = `${updatedCode.trimEnd()}\n${rampLine.trim()}\n`;
        generatedRamps.push(rampLine.trim());
      }
    }

    if (generatedRamps.length > 0) {
      setCode(updatedCode);
      appendConsole('info', `Automação gravada e injetada: ${generatedRamps.join(' | ')}`);
    } else {
      appendConsole('info', 'REC Automação finalizado (sem variação de parâmetro vinculada).');
    }
  }, [appendConsole, isRecordingAutomation, setCode]);

  const handlePreviewSnippet = useCallback(
    async (snippet: string) => {
      const engine = audioEngineRef.current;
      if (!engine) return;
      const hasPlayDiv = /\bPLAY\s+DIVISION\b/i.test(snippet);
      const wrapped = hasPlayDiv
        ? snippet
        : `CONFIG DIVISION.\n  TEMPO IS 120 BPM.\nPLAY DIVISION.\n${snippet}`;
      const compiled = compileSythmCode(wrapped);
      if (!compiled.success || !compiled.plan || compiled.plan.events.length === 0) {
        appendConsole('error', 'Não foi possível gerar preview para este componente.');
        return;
      }
      setIsPlaying(true);
      setStatus('playing');
      await engine.start(compiled.plan, {
        loop: false,
        onComplete: () => {
          setIsPlaying(false);
          setStatus('ready');
          setActiveEventsMap(new Map());
        },
      });
    },
    [appendConsole],
  );

  const handleAuthenticated = useCallback(
    (user: AuthUser) => {
      setAuthUser(user);
      appendConsole('info', `Logado como @${user.username}. Sincronizando projetos...`);
      void fetchCloudWorkspace()
        .then((cloudWs) => {
          if (cloudWs && Array.isArray(cloudWs.files) && cloudWs.files.length > 0) {
            setWorkspace(cloudWs);
            appendConsole('info', 'Projetos carregados da sua conta.');
          } else {
            void saveCloudWorkspace(workspace);
            appendConsole('info', 'Workspace atual salvo na sua nova conta.');
          }
        })
        .catch(() => undefined);
    },
    [appendConsole, workspace],
  );

  const handleLogout = useCallback(() => {
    setAuthUser(null);
    setWorkspace(loadWorkspaceState());
    appendConsole('info', 'Logout realizado. Projetos voltaram ao armazenamento local.');
  }, [appendConsole]);

  const handleOpenSharedCode = useCallback(
    (title: string, sharedCode: string, fromUsername: string) => {
      setWorkspace((prev) => {
        const res = importSharedCodeIntoWorkspace(prev, sharedCode);
        return res.state;
      });
      appendConsole('info', `Código "${title}" de @${fromUsername} aberto no editor.`);
    },
    [appendConsole],
  );

  const visualizerPlan =
    livePreview.success && livePreview.plan ? livePreview.plan : plan;
  const activeTitle =
    plan?.metadata.title ||
    plan?.metadata.programId ||
    livePreview.plan?.metadata.title ||
    livePreview.plan?.metadata.programId ||
    activeFile.title ||
    filename;
  const scaleLabel = visualizerPlan?.scale;
  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;

  return (
    <div className="sythm-bg-window flex h-screen w-screen flex-col overflow-hidden text-[var(--sythm-text-primary)]">
      <XcodeToolbar
        status={status}
        loopEnabled={loopEnabled}
        isPlaying={isPlaying}
        activeTitle={activeTitle}
        activeFolderName={activeFolder?.name}
        scaleLabel={scaleLabel}
        bpm={bpm}
        waveform={waveform}
        activeEvent={activeEvent}
        backendConnected={backendConnected}
        errorCount={errorCount}
        isExportingWav={isExportingWav}
        shareCopied={shareCopied}
        onPlay={() => void runCompile(true)}
        onStop={handleStop}
        onBuildOnly={() => void runCompile(false)}
        onToggleLoop={handleToggleLoop}
        onExportWav={() => void handleExportWav()}
        onShareUrl={handleShareUrl}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAudioImport={() => setIsAudioImportOpen(true)}
        samplesCount={samples.length}
        authUser={authUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ProjectNavigator
          folders={workspace.folders}
          files={workspace.files}
          selectedFileId={activeFile.id}
          onSelectFile={handleSelectFile}
          onToggleFolder={handleToggleFolder}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onCreateFile={handleCreateFile}
          onRenameFile={handleRenameFile}
          onDuplicateFile={handleDuplicateFile}
          onDeleteFile={handleDeleteFile}
          onResetFactory={handleResetFactory}
          onOpenTutorial={() => setIsTutorialOpen(true)}
          onPreviewComponent={(snippet) => void handlePreviewSnippet(snippet)}
          onInsertComponent={handleInsertSnippetAtCursor}
        />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TrackMixerBar
            tracks={mixerTracks}
            controls={activeControls}
            controlValues={controlValues}
            activeTracks={activeTracks}
            mutedTracks={mutedTracks}
            soloedTracks={soloedTracks}
            isRecordingAutomation={isRecordingAutomation}
            recordedKeyframesCount={recordedKeyframesCount}
            onToggleRecordAutomation={handleToggleRecordAutomation}
            onToggleMute={handleToggleMute}
            onToggleSolo={handleToggleSolo}
            onControlChange={handleControlChange}
          />

          <AudioVisualizerBar
            audioEngine={audioEngine}
            plan={visualizerPlan}
            isPlaying={isPlaying}
            modeOverride={visualizerModeOverride}
            onModeChange={setVisualizerModeOverride}
            onOpenPianoRoll={() => setIsPianoRollOpen(true)}
          />

          <CodeEditor
            filename={filename}
            code={code}
            activeLines={activeLines}
            diagnostics={diagnostics}
            controls={activeControls}
            controlValues={controlValues}
            definedSections={visualizerPlan?.definedSections}
            languageContext={copyContext}
            onOpenFile={handleOpenFileByName}
            revealRequest={revealRequest}
            sampleNames={samples.map((s) => s.name)}
            fontSize={settings.editorFontSize}
            showLineNumbers={settings.showLineNumbers}
            enableAutocomplete={settings.enableAutocomplete}
            showInlineSliders={settings.showInlineSliders}
            onChange={setCode}
            onControlChange={handleControlChange}
            onCursorChange={(offset) => {
              editorCursorRef.current = offset;
            }}
            onRunShortcut={() => void runCompile(true)}
          />

          <DebugArea
            activeTab={activeTab}
            onTabChange={setActiveTab}
            consoleLines={consoleLines}
            tokens={tokens}
            ast={ast}
            plan={plan}
            onClearConsole={() => setConsoleLines([])}
          />
        </main>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onUpdateSettings={setSettings}
        onApplyVisualizerMode={handleApplyVisualizerDefault}
        onClose={() => setIsSettingsOpen(false)}
      />

      <SythmTutorialModal
        isOpen={isTutorialOpen}
        onInsertSnippet={handleInsertSnippet}
        onLoadFullExample={handleLoadTutorialExample}
        onClose={() => setIsTutorialOpen(false)}
      />

      <AudioImportModal
        isOpen={isAudioImportOpen}
        samples={samples}
        onImportFiles={handleImportAudioFiles}
        onCreateDemoSample={handleCreateDemoSample}
        onDeleteSample={handleDeleteSample}
        onInsertSampleCommand={handleInsertSampleCommand}
        onLoadGeneratedProgram={handleLoadAudioProgram}
        onClose={() => setIsAudioImportOpen(false)}
      />

      <AuthProfileModal
        isOpen={isAuthModalOpen}
        user={authUser}
        currentTitle={activeTitle}
        currentCode={code}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthenticated={handleAuthenticated}
        onLogout={handleLogout}
        onOpenSharedCode={handleOpenSharedCode}
        onPreviewCode={(sharedCode) => void handlePreviewSnippet(sharedCode)}
      />

      <PianoRollModal
        isOpen={isPianoRollOpen}
        audioEngine={audioEngine}
        plan={visualizerPlan}
        isPlaying={isPlaying}
        onInsertSnippet={handleInsertSnippetAtCursor}
        onClose={() => setIsPianoRollOpen(false)}
      />
    </div>
  );
}
