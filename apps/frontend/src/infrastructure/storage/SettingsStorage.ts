export type VisualizerDefaultMode = 'ALL' | 'SCOPE' | 'SPECTRUM' | 'PIANOROLL' | 'OFF';

export interface SythmThemeColors {
  bgWindow: string;
  bgSidebar: string;
  bgToolbar: string;
  bgEditor: string;
  bgLcd: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  synDivision: string;
  synKeyword: string;
  synWaveform: string;
  synDrum: string;
  synNote: string;
  synNumber: string;
  synString: string;
  synComment: string;
}

export type ThemePresetId =
  | 'xcode-dark'
  | 'vscode-dark-plus'
  | 'dracula'
  | 'monokai-pro'
  | 'cyberpunk-neon'
  | 'github-dark'
  | 'solarized-ocean'
  | 'custom';

export interface SythmThemePreset {
  id: Exclude<ThemePresetId, 'custom'>;
  name: string;
  description: string;
  badge: string;
  colors: SythmThemeColors;
}

export interface SythmSettings {
  activeThemeId: ThemePresetId;
  customThemeColors: SythmThemeColors;
  editorFontSize: number;
  showLineNumbers: boolean;
  enableAutocomplete: boolean;
  showInlineSliders: boolean;
  masterVolumePercent: number;
  defaultVisualizerMode: VisualizerDefaultMode;
}

const STORAGE_KEY = 'sythm.settings.v1';

export const XCODE_DEFAULT_COLORS: SythmThemeColors = {
  bgWindow: '#1e1f22',
  bgSidebar: '#25262a',
  bgToolbar: '#2b2c31',
  bgEditor: '#1b1c1f',
  bgLcd: '#16171a',
  border: '#3d3f45',
  textPrimary: '#f2f2f7',
  textSecondary: '#aeaeb2',
  accent: '#0a84ff',
  synDivision: '#ff7ab2',
  synKeyword: '#b281eb',
  synWaveform: '#6bdfff',
  synDrum: '#ff9f0a',
  synNote: '#ffd60a',
  synNumber: '#d0bf69',
  synString: '#fc6a5d',
  synComment: '#7f8c98',
};

export const THEME_PRESETS: SythmThemePreset[] = [
  {
    id: 'xcode-dark',
    name: 'Xcode Dark',
    description: 'Tema padrão inspirado no Xcode Studio com contraste equilibrado.',
    badge: 'Padrão',
    colors: XCODE_DEFAULT_COLORS,
  },
  {
    id: 'vscode-dark-plus',
    name: 'VS Code Dark+',
    description: 'O clássico azul-e-magenta do Visual Studio Code para longas sessões.',
    badge: 'VS Code',
    colors: {
      bgWindow: '#1e1e1e',
      bgSidebar: '#252526',
      bgToolbar: '#333333',
      bgEditor: '#1e1e1e',
      bgLcd: '#181818',
      border: '#3c3c3c',
      textPrimary: '#d4d4d4',
      textSecondary: '#9d9d9d',
      accent: '#007acc',
      synDivision: '#c586c0',
      synKeyword: '#569cd6',
      synWaveform: '#4ec9b0',
      synDrum: '#ce9178',
      synNote: '#dcdcaa',
      synNumber: '#b5cea8',
      synString: '#ce9178',
      synComment: '#6a9955',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula Official',
    description: 'Tons noturnos vibrantes em roxo, ciano e rosa neon.',
    badge: 'Popular',
    colors: {
      bgWindow: '#21222c',
      bgSidebar: '#282a36',
      bgToolbar: '#21222c',
      bgEditor: '#282a36',
      bgLcd: '#191a21',
      border: '#44475a',
      textPrimary: '#f8f8f2',
      textSecondary: '#b6bfd6',
      accent: '#bd93f9',
      synDivision: '#ff79c6',
      synKeyword: '#8be9fd',
      synWaveform: '#50fa7b',
      synDrum: '#ffb86c',
      synNote: '#f1fa8c',
      synNumber: '#bd93f9',
      synString: '#f1fa8c',
      synComment: '#7b88b8',
    },
  },
  {
    id: 'monokai-pro',
    name: 'Monokai Pro',
    description: 'Paleta quente estilo estúdio analógico com alto contraste.',
    badge: 'Pro',
    colors: {
      bgWindow: '#221f22',
      bgSidebar: '#2d2a2e',
      bgToolbar: '#221f22',
      bgEditor: '#2d2a2e',
      bgLcd: '#19181a',
      border: '#49464b',
      textPrimary: '#fcfcfa',
      textSecondary: '#c1c0c0',
      accent: '#ffd866',
      synDivision: '#ff6188',
      synKeyword: '#78dce8',
      synWaveform: '#a9dc76',
      synDrum: '#fc9867',
      synNote: '#ffd866',
      synNumber: '#ab9df2',
      synString: '#ffd866',
      synComment: '#939293',
    },
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    description: 'Synthwave elétrico em violeta profundo, ciano e magenta.',
    badge: 'Synthwave',
    colors: {
      bgWindow: '#130924',
      bgSidebar: '#1b0e33',
      bgToolbar: '#22123f',
      bgEditor: '#150b29',
      bgLcd: '#0d061a',
      border: '#432570',
      textPrimary: '#f4efff',
      textSecondary: '#b9a3e3',
      accent: '#00f0ff',
      synDivision: '#ff2a85',
      synKeyword: '#00f0ff',
      synWaveform: '#5efce8',
      synDrum: '#ff9900',
      synNote: '#ffe600',
      synNumber: '#b967ff',
      synString: '#ff71ce',
      synComment: '#9a7fc2',
    },
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark Dimmed',
    description: 'Superfícies suaves e leitura confortável para síntese prolongada.',
    badge: 'Clean',
    colors: {
      bgWindow: '#1c2128',
      bgSidebar: '#22272e',
      bgToolbar: '#2d333b',
      bgEditor: '#1c2128',
      bgLcd: '#161b22',
      border: '#444c56',
      textPrimary: '#cdd9e5',
      textSecondary: '#909dab',
      accent: '#539bf5',
      synDivision: '#f47067',
      synKeyword: '#dcbdfb',
      synWaveform: '#6cb6ff',
      synDrum: '#f69d50',
      synNote: '#8ddb8c',
      synNumber: '#6cb6ff',
      synString: '#96d0ff',
      synComment: '#768390',
    },
  },
  {
    id: 'solarized-ocean',
    name: 'Solarized Ocean',
    description: 'Azul oceânico preciso inspirado no Solarized Dark clássico.',
    badge: 'Clássico',
    colors: {
      bgWindow: '#00212b',
      bgSidebar: '#002b36',
      bgToolbar: '#073642',
      bgEditor: '#00242e',
      bgLcd: '#001b22',
      border: '#194b57',
      textPrimary: '#eee8d5',
      textSecondary: '#93a1a1',
      accent: '#268bd2',
      synDivision: '#d33682',
      synKeyword: '#859900',
      synWaveform: '#2aa198',
      synDrum: '#cb4b16',
      synNote: '#b58900',
      synNumber: '#6c71c4',
      synString: '#2aa198',
      synComment: '#839496',
    },
  },
];

export const DEFAULT_SETTINGS: SythmSettings = {
  activeThemeId: 'xcode-dark',
  customThemeColors: { ...XCODE_DEFAULT_COLORS },
  editorFontSize: 13,
  showLineNumbers: true,
  enableAutocomplete: true,
  showInlineSliders: true,
  masterVolumePercent: 85,
  defaultVisualizerMode: 'ALL',
};

function sanitizeHex(value: unknown, fallback: string): string {
  if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    return value.trim().toLowerCase();
  }
  return fallback;
}

function sanitizeThemeColors(raw: unknown, fallback: SythmThemeColors): SythmThemeColors {
  if (!raw || typeof raw !== 'object') {
    return { ...fallback };
  }
  const obj = raw as Partial<Record<keyof SythmThemeColors, unknown>>;
  return {
    bgWindow: sanitizeHex(obj.bgWindow, fallback.bgWindow),
    bgSidebar: sanitizeHex(obj.bgSidebar, fallback.bgSidebar),
    bgToolbar: sanitizeHex(obj.bgToolbar, fallback.bgToolbar),
    bgEditor: sanitizeHex(obj.bgEditor, fallback.bgEditor),
    bgLcd: sanitizeHex(obj.bgLcd, fallback.bgLcd),
    border: sanitizeHex(obj.border, fallback.border),
    textPrimary: sanitizeHex(obj.textPrimary, fallback.textPrimary),
    textSecondary: sanitizeHex(obj.textSecondary, fallback.textSecondary),
    accent: sanitizeHex(obj.accent, fallback.accent),
    synDivision: sanitizeHex(obj.synDivision, fallback.synDivision),
    synKeyword: sanitizeHex(obj.synKeyword, fallback.synKeyword),
    synWaveform: sanitizeHex(obj.synWaveform, fallback.synWaveform),
    synDrum: sanitizeHex(obj.synDrum, fallback.synDrum),
    synNote: sanitizeHex(obj.synNote, fallback.synNote),
    synNumber: sanitizeHex(obj.synNumber, fallback.synNumber),
    synString: sanitizeHex(obj.synString, fallback.synString),
    synComment: sanitizeHex(obj.synComment, fallback.synComment),
  };
}

export function loadSettings(): SythmSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_SETTINGS, customThemeColors: { ...XCODE_DEFAULT_COLORS } };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS, customThemeColors: { ...XCODE_DEFAULT_COLORS } };
    }
    const parsed = JSON.parse(raw) as Partial<SythmSettings>;
    const validThemeIds = new Set<string>([...THEME_PRESETS.map((p) => p.id), 'custom']);
    const activeThemeId =
      typeof parsed.activeThemeId === 'string' && validThemeIds.has(parsed.activeThemeId)
        ? (parsed.activeThemeId as ThemePresetId)
        : DEFAULT_SETTINGS.activeThemeId;

    const fontSize =
      typeof parsed.editorFontSize === 'number' && Number.isFinite(parsed.editorFontSize)
        ? Math.min(18, Math.max(12, Math.round(parsed.editorFontSize)))
        : DEFAULT_SETTINGS.editorFontSize;

    const masterVol =
      typeof parsed.masterVolumePercent === 'number' && Number.isFinite(parsed.masterVolumePercent)
        ? Math.min(100, Math.max(0, Math.round(parsed.masterVolumePercent)))
        : DEFAULT_SETTINGS.masterVolumePercent;

    const validModes = new Set<VisualizerDefaultMode>(['ALL', 'SCOPE', 'SPECTRUM', 'PIANOROLL', 'OFF']);
    const defaultVisualizerMode =
      typeof parsed.defaultVisualizerMode === 'string' &&
      validModes.has(parsed.defaultVisualizerMode as VisualizerDefaultMode)
        ? (parsed.defaultVisualizerMode as VisualizerDefaultMode)
        : DEFAULT_SETTINGS.defaultVisualizerMode;

    return {
      activeThemeId,
      customThemeColors: sanitizeThemeColors(parsed.customThemeColors, XCODE_DEFAULT_COLORS),
      editorFontSize: fontSize,
      showLineNumbers:
        typeof parsed.showLineNumbers === 'boolean'
          ? parsed.showLineNumbers
          : DEFAULT_SETTINGS.showLineNumbers,
      enableAutocomplete:
        typeof parsed.enableAutocomplete === 'boolean'
          ? parsed.enableAutocomplete
          : DEFAULT_SETTINGS.enableAutocomplete,
      showInlineSliders:
        typeof parsed.showInlineSliders === 'boolean'
          ? parsed.showInlineSliders
          : DEFAULT_SETTINGS.showInlineSliders,
      masterVolumePercent: masterVol,
      defaultVisualizerMode,
    };
  } catch {
    return { ...DEFAULT_SETTINGS, customThemeColors: { ...XCODE_DEFAULT_COLORS } };
  }
}

export function saveSettings(settings: SythmSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

export function getActiveThemeColors(settings: SythmSettings): SythmThemeColors {
  if (settings.activeThemeId === 'custom') {
    return settings.customThemeColors;
  }
  const preset = THEME_PRESETS.find((p) => p.id === settings.activeThemeId);
  return preset ? preset.colors : XCODE_DEFAULT_COLORS;
}

export function applyThemeToDocument(settings: SythmSettings): void {
  if (typeof document === 'undefined') return;
  const colors = getActiveThemeColors(settings);
  const rootStyle = document.documentElement.style;

  rootStyle.setProperty('--sythm-bg-window', colors.bgWindow);
  rootStyle.setProperty('--sythm-bg-sidebar', colors.bgSidebar);
  rootStyle.setProperty('--sythm-bg-toolbar', colors.bgToolbar);
  rootStyle.setProperty('--sythm-bg-editor', colors.bgEditor);
  rootStyle.setProperty('--sythm-bg-lcd', colors.bgLcd);
  rootStyle.setProperty('--sythm-border', colors.border);
  rootStyle.setProperty('--sythm-text-primary', colors.textPrimary);
  rootStyle.setProperty('--sythm-text-secondary', colors.textSecondary);
  rootStyle.setProperty('--sythm-accent', colors.accent);
  rootStyle.setProperty('--sythm-scrollbar-track', colors.bgEditor);
  rootStyle.setProperty('--sythm-scrollbar-thumb', colors.border);

  rootStyle.setProperty('--sythm-syn-division', colors.synDivision);
  rootStyle.setProperty('--sythm-syn-keyword', colors.synKeyword);
  rootStyle.setProperty('--sythm-syn-waveform', colors.synWaveform);
  rootStyle.setProperty('--sythm-syn-drum', colors.synDrum);
  rootStyle.setProperty('--sythm-syn-note', colors.synNote);
  rootStyle.setProperty('--sythm-syn-number', colors.synNumber);
  rootStyle.setProperty('--sythm-syn-string', colors.synString);
  rootStyle.setProperty('--sythm-syn-comment', colors.synComment);
}
