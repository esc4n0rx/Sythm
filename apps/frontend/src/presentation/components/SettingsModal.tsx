import {
  Check,
  Code2,
  Copy,
  Keyboard,
  Palette,
  RotateCcw,
  Settings,
  Sliders,
  Volume2,
  X,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  type SythmSettings,
  type SythmThemeColors,
  THEME_PRESETS,
  type VisualizerDefaultMode,
  XCODE_DEFAULT_COLORS,
  getActiveThemeColors,
} from '../../infrastructure/storage/SettingsStorage';

export interface SettingsModalProps {
  isOpen: boolean;
  settings: SythmSettings;
  onUpdateSettings: (next: SythmSettings) => void;
  onApplyVisualizerMode: (mode: VisualizerDefaultMode) => void;
  onClose: () => void;
}

type SettingsSectionId = 'themes' | 'editor' | 'audio' | 'shortcuts';

const SECTIONS: { id: SettingsSectionId; label: string; description: string; icon: typeof Palette }[] = [
  { id: 'themes', label: 'Temas & Cores', description: 'Estilos VS Code & custom', icon: Palette },
  { id: 'editor', label: 'Editor & Sintaxe', description: 'Fonte, linhas e ajuda', icon: Code2 },
  { id: 'audio', label: 'Áudio & Visualizador', description: 'Volume e visual padrão', icon: Sliders },
  { id: 'shortcuts', label: 'Atalhos & Sistema', description: 'Teclas e reset geral', icon: Keyboard },
];

const UI_COLOR_FIELDS: { key: keyof SythmThemeColors; label: string; hint: string }[] = [
  { key: 'bgWindow', label: 'Fundo da Janela', hint: 'Área externa e Debug Area' },
  { key: 'bgSidebar', label: 'Sidebar & Painéis', hint: 'Explorador lateral e barras' },
  { key: 'bgToolbar', label: 'Header / Toolbar', hint: 'Barra superior de transporte' },
  { key: 'bgEditor', label: 'Fundo do Editor', hint: 'Área de código Sythm' },
  { key: 'bgLcd', label: 'Visor LCD', hint: 'Display central de status' },
  { key: 'border', label: 'Bordas & Divisórias', hint: 'Linhas entre painéis' },
  { key: 'textPrimary', label: 'Texto Principal', hint: 'Títulos e texto padrão' },
  { key: 'textSecondary', label: 'Texto Secundário', hint: 'Subtítulos e metadados' },
  { key: 'accent', label: 'Cor de Destaque (Accent)', hint: 'Botões ativos e foco' },
];

const SYNTAX_COLOR_FIELDS: { key: keyof SythmThemeColors; label: string; sample: string }[] = [
  { key: 'synDivision', label: 'Divisões', sample: 'PLAY DIVISION.' },
  { key: 'synKeyword', label: 'Comandos & Keywords', sample: 'PLAY NOTE FOR BEATS' },
  { key: 'synWaveform', label: 'Instrumentos / Synths', sample: 'FM-KEYS SAW PAD-WARM' },
  { key: 'synDrum', label: 'Bateria / Percussion', sample: 'KICK SNARE HIHAT' },
  { key: 'synNote', label: 'Notas & Acordes', sample: 'C4 Am7 Dm9 F#4' },
  { key: 'synNumber', label: 'Números & BPM', sample: '120 0.5 16' },
  { key: 'synString', label: 'Strings & Nomes', sample: '"Synthwave Lead"' },
  { key: 'synComment', label: 'Comentários', sample: '*> Comentário Sythm' },
];

const VISUALIZER_MODES: { id: VisualizerDefaultMode; label: string; hint: string }[] = [
  { id: 'ALL', label: 'ALL', hint: 'Scope + Spectrum + Piano Roll' },
  { id: 'SCOPE', label: 'SCOPE', hint: 'Osciloscópio de onda' },
  { id: 'SPECTRUM', label: 'SPECTRUM', hint: 'Barras de frequência FFT' },
  { id: 'PIANOROLL', label: 'PIANO ROLL', hint: 'Sequência visual de notas' },
  { id: 'OFF', label: 'OFF', hint: 'Ocultar visualizadores' },
];

const SHORTCUTS_LIST: { keys: string; action: string }[] = [
  { keys: 'Ctrl / Cmd + Enter', action: 'Compilar e tocar música imediatamente' },
  { keys: 'Ctrl + Space', action: 'Abrir autocomplete contextual no editor' },
  { keys: 'Tab / Enter', action: 'Inserir sugestão selecionada do autocomplete' },
  { keys: 'Esc', action: 'Fechar autocomplete ou modal aberto' },
  { keys: '← / → (Tutorial)', action: 'Virar página no Sythm Tutorial' },
];

interface SettingToggleProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onToggle: (next: boolean) => void;
}

function SettingToggle({ id, label, description, checked, onToggle }: SettingToggleProps) {
  return (
    <div className="sythm-border flex items-center justify-between gap-4 rounded-lg border bg-[var(--sythm-bg-window)]/70 px-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-sm font-medium text-[var(--sythm-text-primary)]">
          {label}
        </label>
        <p className="mt-0.5 text-xs text-[var(--sythm-text-secondary)]">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onToggle(!checked)}
        className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sythm-accent)] ${
          checked
            ? 'border-[var(--sythm-accent)] bg-[var(--sythm-accent)] text-white'
            : 'sythm-border bg-[var(--sythm-bg-lcd)] text-[var(--sythm-text-secondary)]'
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${checked ? 'bg-white' : 'bg-[var(--sythm-text-secondary)] opacity-60'}`}
          aria-hidden="true"
        />
        <span>{checked ? 'Ativo' : 'Desativado'}</span>
      </button>
    </div>
  );
}

export function SettingsModal({
  isOpen,
  settings,
  onUpdateSettings,
  onApplyVisualizerMode,
  onClose,
}: SettingsModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('themes');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleBackdropFallbackClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if ('closedBy' in HTMLDialogElement.prototype) return;
    const dialog = dialogRef.current;
    if (!dialog || event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const clickedInside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!clickedInside) {
      dialog.close();
    }
  };

  const activeColors = getActiveThemeColors(settings);

  const handleSelectPreset = (presetId: (typeof THEME_PRESETS)[number]['id']) => {
    onUpdateSettings({
      ...settings,
      activeThemeId: presetId,
    });
  };

  const handleCopyActiveToCustom = () => {
    onUpdateSettings({
      ...settings,
      activeThemeId: 'custom',
      customThemeColors: { ...activeColors },
    });
  };

  const handleCustomColorChange = (key: keyof SythmThemeColors, hex: string) => {
    const baseColors =
      settings.activeThemeId === 'custom' ? settings.customThemeColors : activeColors;
    onUpdateSettings({
      ...settings,
      activeThemeId: 'custom',
      customThemeColors: {
        ...baseColors,
        [key]: hex.toLowerCase(),
      },
    });
  };

  const handleResetCustomTheme = () => {
    onUpdateSettings({
      ...settings,
      activeThemeId: 'xcode-dark',
      customThemeColors: { ...XCODE_DEFAULT_COLORS },
    });
  };

  const handleResetAll = () => {
    onUpdateSettings({
      ...DEFAULT_SETTINGS,
      customThemeColors: { ...XCODE_DEFAULT_COLORS },
    });
    onApplyVisualizerMode(DEFAULT_SETTINGS.defaultVisualizerMode);
  };

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as Record<string, string>)}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={handleBackdropFallbackClick}
      className="sythm-border sythm-bg-sidebar m-auto w-[min(960px,calc(100vw-2rem))] max-w-none overflow-hidden rounded-xl border p-0 text-[var(--sythm-text-primary)] shadow-2xl"
    >
      <div className="flex h-[min(700px,86vh)] flex-col">
        {/* Modal Header */}
        <header className="sythm-border sythm-bg-toolbar flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="sythm-border sythm-bg-lcd flex h-8 w-8 items-center justify-center rounded-lg border text-[var(--sythm-accent)]">
              <Settings className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="text-sm font-semibold text-[var(--sythm-text-primary)]">
                Configurações do Sythm Studio
              </h2>
              <p className="text-xs text-[var(--sythm-text-secondary)]">
                Personalize temas estilo VS Code, editor, sintaxe e motor de áudio
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Fechar configurações"
            className="sythm-border sythm-bg-lcd inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-[var(--sythm-text-primary)] transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sythm-accent)]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Fechar</span>
          </button>
        </header>

        {/* Body: Left Subsections + Right Detail View */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Subsections Sidebar */}
          <nav
            aria-label="Subseções de configuração"
            className="sythm-border sythm-bg-window flex shrink-0 gap-1 overflow-x-auto border-b p-3 md:w-60 md:flex-col md:border-r md:border-b-0"
          >
            {SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const active = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex shrink-0 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-[var(--sythm-accent)] ${
                    active
                      ? 'border-[var(--sythm-accent)] bg-[var(--sythm-accent)]/15 text-[var(--sythm-text-primary)]'
                      : 'border-transparent text-[var(--sythm-text-secondary)] hover:bg-[var(--sythm-bg-toolbar)]/60 hover:text-[var(--sythm-text-primary)]'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${active ? 'text-[var(--sythm-accent)]' : ''}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">{sec.label}</div>
                    <div className="hidden truncate text-[11px] opacity-75 md:block">
                      {sec.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Right Panel */}
          <div className="xcode-scroll min-h-0 flex-1 overflow-y-auto p-5">
            {activeSection === 'themes' && (
              <div className="space-y-6">
                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--sythm-text-primary)]">
                        Temas Predefinidos (VS Code Style)
                      </h3>
                      <p className="text-xs text-[var(--sythm-text-secondary)]">
                        Aplicados instantaneamente em toda a IDE e na coloração de sintaxe Sythm.
                      </p>
                    </div>
                    {settings.activeThemeId === 'custom' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--sythm-accent)] bg-[var(--sythm-accent)]/15 px-2.5 py-1 text-[11px] font-semibold text-[var(--sythm-accent)]">
                        <Palette className="h-3 w-3" aria-hidden="true" />
                        <span>Tema Personalizado Ativo</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {THEME_PRESETS.map((preset) => {
                      const isSelected = settings.activeThemeId === preset.id;
                      const c = preset.colors;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectPreset(preset.id)}
                          aria-pressed={isSelected}
                          className={`group flex cursor-pointer flex-col gap-2.5 rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-[var(--sythm-accent)] ${
                            isSelected
                              ? 'border-[var(--sythm-accent)] bg-[var(--sythm-accent)]/12 shadow-sm'
                              : 'sythm-border bg-[var(--sythm-bg-window)]/80 hover:border-[var(--sythm-text-secondary)]/60'
                          }`}
                        >
                          {/* Mini VS Code IDE Color Swatch Preview */}
                          <div
                            className="sythm-color-swatch overflow-hidden rounded-lg border"
                            style={{ backgroundColor: c.bgEditor, borderColor: c.border }}
                          >
                            <div
                              className="flex h-3.5 items-center justify-between px-2"
                              style={{ backgroundColor: c.bgToolbar }}
                            >
                              <div className="flex items-center gap-1">
                                <span
                                  className="h-1.5 w-4 rounded-full"
                                  style={{ backgroundColor: c.accent }}
                                />
                                <span
                                  className="h-1.5 w-2 rounded-full"
                                  style={{ backgroundColor: c.textSecondary }}
                                />
                              </div>
                              <span
                                className="h-1.5 w-6 rounded-full"
                                style={{ backgroundColor: c.bgLcd }}
                              />
                            </div>
                            <div className="flex h-11">
                              <div
                                className="w-1/4 border-r p-1.5"
                                style={{ backgroundColor: c.bgSidebar, borderColor: c.border }}
                              >
                                <div
                                  className="mb-1 h-1.5 w-4/5 rounded"
                                  style={{ backgroundColor: c.textSecondary }}
                                />
                                <div
                                  className="h-1.5 w-3/5 rounded opacity-60"
                                  style={{ backgroundColor: c.accent }}
                                />
                              </div>
                              <div className="flex flex-1 flex-col justify-center gap-1 px-2.5 font-mono-code text-[10px]">
                                <div className="flex items-center gap-1.5">
                                  <span style={{ color: c.synDivision }}>PLAY</span>
                                  <span style={{ color: c.synKeyword }}>NOTE</span>
                                  <span style={{ color: c.synNote }}>C4</span>
                                  <span style={{ color: c.synNumber }}>120</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span style={{ color: c.synWaveform }}>FM-KEYS</span>
                                  <span style={{ color: c.synDrum }}>KICK</span>
                                  <span style={{ color: c.synString }}>"Lead"</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-xs font-semibold text-[var(--sythm-text-primary)]">
                                  {preset.name}
                                </span>
                                <span className="sythm-border sythm-bg-lcd rounded border px-1.5 py-0.2 text-[10px] text-[var(--sythm-text-secondary)]">
                                  {preset.badge}
                                </span>
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--sythm-text-secondary)]">
                                {preset.description}
                              </p>
                            </div>
                            {isSelected && (
                              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--sythm-accent)] text-white">
                                <Check className="h-3 w-3" aria-hidden="true" />
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Theme Editor */}
                <div className="sythm-border rounded-xl border bg-[var(--sythm-bg-window)]/70 p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--sythm-text-primary)]">
                        Personalizar Cores do Tema (Custom Theme)
                      </h3>
                      <p className="text-xs text-[var(--sythm-text-secondary)]">
                        Ajuste qualquer cor para criar e salvar seu tema exclusivo automaticamente.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyActiveToCustom}
                        className="sythm-border sythm-bg-toolbar inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-[var(--sythm-text-primary)] transition hover:opacity-90"
                      >
                        <Copy className="h-3.5 w-3.5 text-[var(--sythm-accent)]" aria-hidden="true" />
                        <span>Copiar Tema Atual</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleResetCustomTheme}
                        className="sythm-border sythm-bg-lcd inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-[var(--sythm-text-secondary)] transition hover:text-[var(--sythm-text-primary)]"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Restaurar Xcode Dark</span>
                      </button>
                    </div>
                  </div>

                  {/* Live Syntax Preview */}
                  <div className="sythm-border sythm-bg-editor sythm-color-swatch mb-4 rounded-lg border p-3 font-mono-code text-xs leading-5">
                    <div className="sythm-tok-comment">*&gt; Preview ao vivo da sintaxe com as cores atuais</div>
                    <div>
                      <span className="sythm-tok-division">CONFIG DIVISION.</span>
                    </div>
                    <div>
                      {'  '}
                      <span className="sythm-tok-keyword">INSTRUMENT IS</span>{' '}
                      <span className="sythm-tok-waveform">FM-KEYS</span>
                      <span className="sythm-tok-punctuation">.</span>{' '}
                      <span className="sythm-tok-keyword">TEMPO IS</span>{' '}
                      <span className="sythm-tok-number">122</span>{' '}
                      <span className="sythm-tok-keyword">BPM</span>
                      <span className="sythm-tok-punctuation">.</span>
                    </div>
                    <div>
                      {'  '}
                      <span className="sythm-tok-keyword">TRACK</span>{' '}
                      <span className="sythm-tok-string">&quot;Neon Beat&quot;</span>
                      <span className="sythm-tok-punctuation">:</span>{' '}
                      <span className="sythm-tok-keyword">PLAY NOTE</span>{' '}
                      <span className="sythm-tok-note">C#4</span>{' '}
                      <span className="sythm-tok-punctuation">|</span>{' '}
                      <span className="sythm-tok-keyword">PLAY DRUM</span>{' '}
                      <span className="sythm-tok-drum">KICK</span>
                      <span className="sythm-tok-punctuation">.</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="mb-2 text-xs font-semibold tracking-wider text-[var(--sythm-text-secondary)] uppercase">
                        Interface da IDE
                      </h4>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {UI_COLOR_FIELDS.map((field) => {
                          const currentHex =
                            settings.activeThemeId === 'custom'
                              ? settings.customThemeColors[field.key]
                              : activeColors[field.key];
                          return (
                            <label
                              key={field.key}
                              className="sythm-border sythm-bg-sidebar flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-2"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-xs font-medium text-[var(--sythm-text-primary)]">
                                  {field.label}
                                </div>
                                <div className="truncate font-mono-code text-[10px] text-[var(--sythm-text-secondary)]">
                                  {currentHex.toUpperCase()} · {field.hint}
                                </div>
                              </div>
                              <input
                                type="color"
                                value={currentHex}
                                onChange={(e) => handleCustomColorChange(field.key, e.target.value)}
                                aria-label={`Selecionar cor para ${field.label}`}
                                className="sythm-color-swatch h-7 w-9 shrink-0 cursor-pointer rounded border border-white/15 bg-transparent p-0.5"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2 text-xs font-semibold tracking-wider text-[var(--sythm-text-secondary)] uppercase">
                        Cores de Sintaxe (Syntax Highlighting)
                      </h4>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {SYNTAX_COLOR_FIELDS.map((field) => {
                          const currentHex =
                            settings.activeThemeId === 'custom'
                              ? settings.customThemeColors[field.key]
                              : activeColors[field.key];
                          return (
                            <label
                              key={field.key}
                              className="sythm-border sythm-bg-sidebar flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-2"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-xs font-medium text-[var(--sythm-text-primary)]">
                                  {field.label}
                                </div>
                                <div
                                  className="sythm-color-swatch truncate font-mono-code text-[11px]"
                                  style={{ color: currentHex }}
                                >
                                  {field.sample}
                                </div>
                              </div>
                              <input
                                type="color"
                                value={currentHex}
                                onChange={(e) => handleCustomColorChange(field.key, e.target.value)}
                                aria-label={`Selecionar cor de sintaxe para ${field.label}`}
                                className="sythm-color-swatch h-7 w-9 shrink-0 cursor-pointer rounded border border-white/15 bg-transparent p-0.5"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'editor' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--sythm-text-primary)]">
                    Editor & Experiência de Código
                  </h3>
                  <p className="text-xs text-[var(--sythm-text-secondary)]">
                    Configure legibilidade, assistente de autocomplete e controles visuais inline.
                  </p>
                </div>

                {/* Font size control */}
                <div className="sythm-border rounded-lg border bg-[var(--sythm-bg-window)]/70 px-4 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-[var(--sythm-text-primary)]">
                        Tamanho da Fonte do Editor
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--sythm-text-secondary)]">
                        Ajusta o texto monoespaçado, altura das linhas e posicionamento dos sliders.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateSettings({
                            ...settings,
                            editorFontSize: Math.max(12, settings.editorFontSize - 1),
                          })
                        }
                        aria-label="Diminuir fonte do editor"
                        className="sythm-border sythm-bg-toolbar h-8 w-8 cursor-pointer rounded-md border text-sm font-bold text-[var(--sythm-text-primary)] hover:opacity-85"
                      >
                        -
                      </button>
                      <span className="sythm-border sythm-bg-lcd min-w-14 rounded-md border px-2.5 py-1 text-center font-mono-code text-xs font-semibold text-[var(--sythm-text-primary)]">
                        {settings.editorFontSize}px
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateSettings({
                            ...settings,
                            editorFontSize: Math.min(18, settings.editorFontSize + 1),
                          })
                        }
                        aria-label="Aumentar fonte do editor"
                        className="sythm-border sythm-bg-toolbar h-8 w-8 cursor-pointer rounded-md border text-sm font-bold text-[var(--sythm-text-primary)] hover:opacity-85"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <SettingToggle
                  id="setting-line-numbers"
                  label="Exibir Numeração de Linhas"
                  description="Mostra a régua lateral com números de linha e destaque da linha tocando."
                  checked={settings.showLineNumbers}
                  onToggle={(next) => onUpdateSettings({ ...settings, showLineNumbers: next })}
                />

                <SettingToggle
                  id="setting-autocomplete"
                  label="Autocomplete Automático ao Digitar"
                  description="Abre sugestões de comandos e notas automaticamente (Ctrl+Space sempre funciona)."
                  checked={settings.enableAutocomplete}
                  onToggle={(next) => onUpdateSettings({ ...settings, enableAutocomplete: next })}
                />

                <SettingToggle
                  id="setting-inline-sliders"
                  label="Sliders Interativos Inline no Código"
                  description="Renderiza controles CONTROL/SLIDER diretamente ao lado das linhas do editor."
                  checked={settings.showInlineSliders}
                  onToggle={(next) => onUpdateSettings({ ...settings, showInlineSliders: next })}
                />
              </div>
            )}

            {activeSection === 'audio' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--sythm-text-primary)]">
                    Áudio Master & Visualizador Padrão
                  </h3>
                  <p className="text-xs text-[var(--sythm-text-secondary)]">
                    Ajuste o ganho global do Web Audio Engine e a visualização preferida da bancada.
                  </p>
                </div>

                <div className="sythm-border rounded-lg border bg-[var(--sythm-bg-window)]/70 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-[var(--sythm-accent)]" aria-hidden="true" />
                      <label
                        htmlFor="setting-master-volume"
                        className="text-sm font-medium text-[var(--sythm-text-primary)]"
                      >
                        Volume Master Global
                      </label>
                    </div>
                    <span className="sythm-border sythm-bg-lcd rounded border px-2 py-0.5 font-mono-code text-xs font-semibold text-[var(--sythm-accent)]">
                      {settings.masterVolumePercent}%
                    </span>
                  </div>
                  <input
                    id="setting-master-volume"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={settings.masterVolumePercent}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        masterVolumePercent: Number(e.target.value),
                      })
                    }
                    className="sythm-slider"
                  />
                  <p className="mt-1 text-xs text-[var(--sythm-text-secondary)]">
                    Controla o ganho final de saída para os alto-falantes sem alterar os controles do código.
                  </p>
                </div>

                <div className="sythm-border rounded-lg border bg-[var(--sythm-bg-window)]/70 p-4">
                  <div className="mb-3">
                    <div className="text-sm font-medium text-[var(--sythm-text-primary)]">
                      Modo Padrão do Visualizador de Áudio
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--sythm-text-secondary)]">
                      Define qual painel gráfico aparece na IDE (arquivos podem sobrescrever com VISUALIZER IS ...).
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {VISUALIZER_MODES.map((m) => {
                      const active = settings.defaultVisualizerMode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            onUpdateSettings({ ...settings, defaultVisualizerMode: m.id });
                            onApplyVisualizerMode(m.id);
                          }}
                          aria-pressed={active}
                          className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition ${
                            active
                              ? 'border-[var(--sythm-accent)] bg-[var(--sythm-accent)]/15 text-[var(--sythm-text-primary)]'
                              : 'sythm-border sythm-bg-sidebar text-[var(--sythm-text-secondary)] hover:text-[var(--sythm-text-primary)]'
                          }`}
                        >
                          <div>
                            <div className="font-mono-code text-xs font-bold">{m.label}</div>
                            <div className="text-[11px] opacity-80">{m.hint}</div>
                          </div>
                          {active && (
                            <Check className="h-4 w-4 shrink-0 text-[var(--sythm-accent)]" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'shortcuts' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--sythm-text-primary)]">
                    Atalhos de Teclado
                  </h3>
                  <p className="text-xs text-[var(--sythm-text-secondary)]">
                    Comandos rápidos para programar música e navegar pelo estúdio sem tirar a mão do teclado.
                  </p>
                </div>

                <div className="sythm-border divide-y divide-[var(--sythm-border)] overflow-hidden rounded-lg border bg-[var(--sythm-bg-window)]/70">
                  {SHORTCUTS_LIST.map((item) => (
                    <div
                      key={item.keys}
                      className="flex items-center justify-between gap-4 px-4 py-2.5 text-xs"
                    >
                      <span className="text-[var(--sythm-text-primary)]">{item.action}</span>
                      <kbd className="sythm-border sythm-bg-lcd shrink-0 rounded border px-2 py-1 font-mono-code text-[11px] font-semibold text-[var(--sythm-accent)]">
                        {item.keys}
                      </kbd>
                    </div>
                  ))}
                </div>

                <div className="sythm-border flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-[var(--sythm-bg-window)]/70 p-4">
                  <div>
                    <div className="text-sm font-semibold text-[var(--sythm-text-primary)]">
                      Restaurar Todas as Configurações
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--sythm-text-secondary)]">
                      Volta ao tema Xcode Dark, fonte 13px, volume 85% e visualização completa (não apaga seus projetos).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="sythm-border sythm-bg-toolbar inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold text-[#ff6961] transition hover:bg-[#ff453a]/15"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Restaurar Padrões</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
