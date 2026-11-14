import { DEFAULT_PRESETS } from '@sythm/core';

export interface SythmProjectFile {
  readonly id: string;
  readonly folderId: string;
  readonly name: string;
  readonly title: string;
  readonly code: string;
  readonly isFactoryPreset: boolean;
  readonly presetId?: string;
  readonly updatedAt: number;
}

export interface SythmProjectFolder {
  readonly id: string;
  readonly name: string;
  readonly isExpanded: boolean;
  readonly isSystem?: boolean;
}

export interface SythmWorkspaceState {
  readonly folders: SythmProjectFolder[];
  readonly files: SythmProjectFile[];
  readonly activeFileId: string;
}

const STORAGE_KEY = 'sythm.workspace.v1';

const FOLDER_STUDIO_SUITES = 'folder-studio-suites';
const FOLDER_SYNTH_HARMONY = 'folder-synth-harmony';
const FOLDER_USER_PROJECTS = 'folder-user-projects';

const SUITE_PRESET_IDS = new Set([
  'cyberpunk-suite',
  'euclidean-acid-909',
  'full-synthwave-band',
]);

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function normalizeSythmFilename(rawName: string): string {
  const trimmed = rawName.trim();
  if (!trimmed) return 'untitled.sythm';
  const cleaned = trimmed.replace(/[\\/:*?"<>|]/g, '-');
  return cleaned.toLowerCase().endsWith('.sythm') ? cleaned : `${cleaned}.sythm`;
}

export function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.sythm$/i, '')
    .replace(/^\d+-/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim() || 'Untitled';
}

export function createDefaultWorkspaceState(): SythmWorkspaceState {
  const now = Date.now();
  const folders: SythmProjectFolder[] = [
    {
      id: FOLDER_STUDIO_SUITES,
      name: 'Studio Suites',
      isExpanded: true,
      isSystem: true,
    },
    {
      id: FOLDER_SYNTH_HARMONY,
      name: 'Synth & Harmony',
      isExpanded: true,
      isSystem: true,
    },
    {
      id: FOLDER_USER_PROJECTS,
      name: 'Meus Projetos',
      isExpanded: true,
      isSystem: true,
    },
  ];

  const files: SythmProjectFile[] = DEFAULT_PRESETS.map((preset) => ({
    id: `preset-${preset.id}`,
    folderId: SUITE_PRESET_IDS.has(preset.id) ? FOLDER_STUDIO_SUITES : FOLDER_SYNTH_HARMONY,
    name: preset.filename,
    title: preset.title,
    code: preset.code,
    isFactoryPreset: true,
    presetId: preset.id,
    updatedAt: now,
  }));

  files.push({
    id: 'user-starter-groove',
    folderId: FOLDER_USER_PROJECTS,
    name: 'meu-primeiro-beat.sythm',
    title: 'Meu Primeiro Beat',
    code: `HEADER DIVISION.
  PROGRAM-ID. MEU-PRIMEIRO-BEAT.
  TITLE IS "Meu Primeiro Beat".

CONFIG DIVISION.
  CONTROL GROOVE-VOL IS SLIDER 75 FROM 0 TO 100.
  TEMPO IS 116 BPM.
  VISUALIZER IS ALL.

PLAY DIVISION.
  TRACK DRUMS.
    VOLUME IS GROOVE-VOL.
    PLAY EUCLIDEAN KICK 3 IN 8 FOR 0.25 BEATS.
    PLAY EUCLIDEAN RIM 5 IN 16 FOR 0.25 BEATS.
  END-TRACK.

  TRACK KEYS.
    WAVE IS FM-KEYS.
    VOLUME IS 65.
    REVERB IS 25 PERCENT.
    PLAY CHORDS Am7 Fmaj7 Cmaj7 G7 FOR 1 BEAT.
  END-TRACK.
`,
    isFactoryPreset: false,
    updatedAt: now,
  });

  return {
    folders,
    files,
    activeFileId: files[0].id,
  };
}

export function loadWorkspaceState(): SythmWorkspaceState {
  const fallback = createDefaultWorkspaceState();
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveWorkspaceState(fallback);
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<SythmWorkspaceState>;
    if (
      !parsed ||
      !Array.isArray(parsed.folders) ||
      !Array.isArray(parsed.files) ||
      parsed.folders.length === 0 ||
      parsed.files.length === 0
    ) {
      saveWorkspaceState(fallback);
      return fallback;
    }

    const validFolderIds = new Set(parsed.folders.map((f) => f.id));
    const files = parsed.files.filter((f) => validFolderIds.has(f.folderId));
    if (files.length === 0) {
      saveWorkspaceState(fallback);
      return fallback;
    }

    const activeFileExists = files.some((f) => f.id === parsed.activeFileId);
    return {
      folders: parsed.folders,
      files,
      activeFileId: activeFileExists ? parsed.activeFileId! : files[0].id,
    };
  } catch {
    return fallback;
  }
}

export function saveWorkspaceState(state: SythmWorkspaceState): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors silently
  }
}

export function toggleFolderExpanded(
  state: SythmWorkspaceState,
  folderId: string,
): SythmWorkspaceState {
  return {
    ...state,
    folders: state.folders.map((folder) =>
      folder.id === folderId ? { ...folder, isExpanded: !folder.isExpanded } : folder,
    ),
  };
}

export function createFolder(state: SythmWorkspaceState, name: string): SythmWorkspaceState {
  const cleaned = name.trim();
  if (!cleaned) return state;
  const newFolder: SythmProjectFolder = {
    id: generateId('folder'),
    name: cleaned,
    isExpanded: true,
    isSystem: false,
  };
  return {
    ...state,
    folders: [...state.folders, newFolder],
  };
}

export function renameFolder(
  state: SythmWorkspaceState,
  folderId: string,
  name: string,
): SythmWorkspaceState {
  const cleaned = name.trim();
  if (!cleaned) return state;
  return {
    ...state,
    folders: state.folders.map((folder) =>
      folder.id === folderId ? { ...folder, name: cleaned } : folder,
    ),
  };
}

export function deleteFolder(state: SythmWorkspaceState, folderId: string): SythmWorkspaceState {
  const folder = state.folders.find((f) => f.id === folderId);
  if (!folder || folder.isSystem || state.folders.length <= 1) {
    return state;
  }

  const remainingFolders = state.folders.filter((f) => f.id !== folderId);
  const remainingFiles = state.files.filter((file) => file.folderId !== folderId);

  if (remainingFiles.length === 0) {
    return createDefaultWorkspaceState();
  }

  const activeStillExists = remainingFiles.some((f) => f.id === state.activeFileId);
  return {
    folders: remainingFolders,
    files: remainingFiles,
    activeFileId: activeStillExists ? state.activeFileId : remainingFiles[0].id,
  };
}

export function createFileInFolder(
  state: SythmWorkspaceState,
  folderId: string,
  rawName: string,
  initialCode?: string,
): { state: SythmWorkspaceState; createdFile: SythmProjectFile } {
  const targetFolderId = state.folders.some((f) => f.id === folderId)
    ? folderId
    : state.folders[state.folders.length - 1].id;
  const name = normalizeSythmFilename(rawName);
  const title = titleFromFilename(name);

  const code =
    initialCode ??
    `HEADER DIVISION.
  PROGRAM-ID. ${title.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}.
  TITLE IS "${title}".

CONFIG DIVISION.
  TEMPO IS 120 BPM.
  VISUALIZER IS ALL.

PLAY DIVISION.
  TRACK LEAD.
    WAVE IS FM-KEYS.
    VOLUME IS 70.
    PLAY CHORDS Am7 Fmaj7 Cmaj7 G7 FOR 1 BEAT.
  END-TRACK.
`;

  const createdFile: SythmProjectFile = {
    id: generateId('file'),
    folderId: targetFolderId,
    name,
    title,
    code,
    isFactoryPreset: false,
    updatedAt: Date.now(),
  };

  return {
    state: {
      folders: state.folders.map((f) =>
        f.id === targetFolderId ? { ...f, isExpanded: true } : f,
      ),
      files: [...state.files, createdFile],
      activeFileId: createdFile.id,
    },
    createdFile,
  };
}

export function updateFileCode(
  state: SythmWorkspaceState,
  fileId: string,
  code: string,
): SythmWorkspaceState {
  return {
    ...state,
    files: state.files.map((file) =>
      file.id === fileId ? { ...file, code, updatedAt: Date.now() } : file,
    ),
  };
}

export function renameFile(
  state: SythmWorkspaceState,
  fileId: string,
  newName: string,
): SythmWorkspaceState {
  const normalized = normalizeSythmFilename(newName);
  const newTitle = titleFromFilename(normalized);
  return {
    ...state,
    files: state.files.map((file) =>
      file.id === fileId
        ? { ...file, name: normalized, title: newTitle, updatedAt: Date.now() }
        : file,
    ),
  };
}

export function duplicateFile(
  state: SythmWorkspaceState,
  fileId: string,
): { state: SythmWorkspaceState; duplicatedFile: SythmProjectFile } | null {
  const source = state.files.find((f) => f.id === fileId);
  if (!source) return null;

  const baseName = source.name.replace(/\.sythm$/i, '');
  const copyName = `${baseName}-copy.sythm`;
  const targetFolderId = source.folderId;

  const duplicatedFile: SythmProjectFile = {
    id: generateId('file'),
    folderId: targetFolderId,
    name: copyName,
    title: `${source.title} (Copy)`,
    code: source.code,
    isFactoryPreset: false,
    updatedAt: Date.now(),
  };

  return {
    state: {
      folders: state.folders.map((f) =>
        f.id === targetFolderId ? { ...f, isExpanded: true } : f,
      ),
      files: [...state.files, duplicatedFile],
      activeFileId: duplicatedFile.id,
    },
    duplicatedFile,
  };
}

export function deleteFile(state: SythmWorkspaceState, fileId: string): SythmWorkspaceState {
  if (state.files.length <= 1) return state;
  const remaining = state.files.filter((f) => f.id !== fileId);
  if (remaining.length === 0) return state;
  return {
    ...state,
    files: remaining,
    activeFileId: state.activeFileId === fileId ? remaining[0].id : state.activeFileId,
  };
}

export function resetFactoryPresets(state: SythmWorkspaceState): SythmWorkspaceState {
  const factoryDefaults = createDefaultWorkspaceState();
  const userFolders = state.folders.filter((f) => !f.isSystem);
  const userFiles = state.files.filter((f) => !f.isFactoryPreset);
  const mergedFolders = [...factoryDefaults.folders, ...userFolders];
  const validFolderIds = new Set(mergedFolders.map((f) => f.id));
  const factoryFiles = factoryDefaults.files.filter((f) => f.isFactoryPreset);
  const cleanedUserFiles = userFiles.filter((f) => validFolderIds.has(f.folderId));
  const files = [...factoryFiles, ...cleanedUserFiles];
  return {
    folders: mergedFolders,
    files,
    activeFileId: files[0].id,
  };
}

export function importSharedCodeIntoWorkspace(
  state: SythmWorkspaceState,
  code: string,
): { state: SythmWorkspaceState; file: SythmProjectFile } {
  const titleMatch = /TITLE\s+IS\s+"([^"]+)"/i.exec(code);
  const rawTitle = titleMatch?.[1]?.trim() || 'Shared Track';
  const slug = rawTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const result = createFileInFolder(
    state,
    FOLDER_USER_PROJECTS,
    `${slug || 'shared-track'}.sythm`,
    code,
  );
  return {
    state: result.state,
    file: result.createdFile,
  };
}

export function encodeCodeToHash(code: string): string {
  const bytes = new TextEncoder().encode(code);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Url = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `#code=${base64Url}`;
}

export function decodeCodeFromHash(hash: string): string | null {
  if (!hash || !hash.startsWith('#code=')) return null;
  const encoded = hash.slice('#code='.length).trim();
  if (!encoded) return null;
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((encoded.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}
