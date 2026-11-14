import { AlertCircle, Sparkles, Wrench } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CompilationDiagnostic, ControlDescriptor } from '@sythm/core';
import { ControlSlider } from './ControlSlider';
import {
  type AutocompleteItem,
  type AutocompleteKind,
  type AutocompleteResult,
  type HighlightTokenKind,
  type HoverDoc,
  getAutocompleteSuggestions,
  getHoverDoc,
  getQuickFixForDiagnostic,
  tokenizeLineForHighlight,
} from './sythmEditorLanguage';

interface CodeEditorProps {
  filename: string;
  code: string;
  activeLines: ReadonlySet<number>;
  diagnostics: CompilationDiagnostic[];
  controls: ControlDescriptor[];
  controlValues: Readonly<Record<string, number>>;
  definedSections?: readonly string[];
  sampleNames?: readonly string[];
  fontSize?: number;
  showLineNumbers?: boolean;
  enableAutocomplete?: boolean;
  showInlineSliders?: boolean;
  onChange: (newCode: string) => void;
  onControlChange: (control: ControlDescriptor, newValue: number) => void;
  onCursorChange?: (offset: number) => void;
  onRunShortcut: () => void;
}

const TOKEN_COLOR_CLASS: Record<HighlightTokenKind, string> = {
  comment: 'sythm-tok-comment',
  string: 'sythm-tok-string',
  division: 'sythm-tok-division',
  keyword: 'sythm-tok-keyword',
  waveform: 'sythm-tok-waveform',
  drum: 'sythm-tok-drum',
  note: 'sythm-tok-note',
  number: 'sythm-tok-number',
  punctuation: 'sythm-tok-punctuation',
  plain: 'sythm-tok-plain',
};

const AUTOCOMPLETE_BADGE: Record<AutocompleteKind, { label: string; className: string }> = {
  division: { label: 'DIV', className: 'bg-[#ff7ab2]/20 text-[#ff7ab2]' },
  command: { label: 'CMD', className: 'bg-[#b281eb]/20 text-[#d0a8ff]' },
  keyword: { label: 'KW', className: 'bg-[#0a84ff]/20 text-[#70c4ff]' },
  note: { label: 'NOTE', className: 'bg-[#ffd60a]/20 text-[#ffd60a]' },
  drum: { label: 'DRUM', className: 'bg-[#ff9f0a]/20 text-[#ff9f0a]' },
  waveform: { label: 'WAVE', className: 'bg-[#6bdfff]/20 text-[#6bdfff]' },
  snippet: { label: 'SNIP', className: 'bg-[#30d158]/20 text-[#6ee787]' },
};

export function CodeEditor({
  filename,
  code,
  activeLines,
  diagnostics,
  controls,
  controlValues,
  definedSections,
  sampleNames,
  fontSize = 13,
  showLineNumbers = true,
  enableAutocomplete = true,
  showInlineSliders = true,
  onChange,
  onControlChange,
  onCursorChange,
  onRunShortcut,
}: CodeEditorProps) {
  const lineHeightPx = Math.round(fontSize * 1.85);
  const charWidthApproxPx = fontSize * 0.6;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const listboxId = useId();

  const [autocomplete, setAutocomplete] = useState<AutocompleteResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [scrollPos, setScrollPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [followPlayhead, setFollowPlayhead] = useState<boolean>(true);
  const [hoverDoc, setHoverDoc] = useState<{ doc: HoverDoc; top: number; left: number } | null>(null);

  const lines = useMemo(() => code.split('\n'), [code]);

  const highlightedLines = useMemo(
    () => lines.map((line) => tokenizeLineForHighlight(line)),
    [lines],
  );

  const controlsByLine = useMemo(() => {
    const map = new Map<number, ControlDescriptor[]>();
    const addToLine = (lineNumber: number, ctrl: ControlDescriptor) => {
      if (lineNumber < 1 || lineNumber > lines.length) return;
      const existing = map.get(lineNumber) ?? [];
      if (!existing.some((c) => c.name === ctrl.name)) {
        existing.push(ctrl);
        map.set(lineNumber, existing);
      }
    };

    for (const ctrl of controls) {
      addToLine(ctrl.declarationLine, ctrl);
      for (const usageLine of ctrl.usageLines) {
        addToLine(usageLine, ctrl);
      }
    }
    return map;
  }, [controls, lines.length]);

  const errorByLine = useMemo(() => {
    const map = new Map<number, CompilationDiagnostic[]>();
    for (const diag of diagnostics) {
      if (diag.severity === 'error') {
        const list = map.get(diag.line) ?? [];
        list.push(diag);
        map.set(diag.line, list);
      }
    }
    return map;
  }, [diagnostics]);

  useEffect(() => {
    setAutocomplete(null);
    setSelectedIndex(0);
    setHoverDoc(null);
  }, [filename]);

  // Playhead -> Editor auto-scroll synchronization
  useEffect(() => {
    if (!followPlayhead || activeLines.size === 0 || !textareaRef.current) return;
    const firstActiveLine = Math.min(...Array.from(activeLines));
    const ta = textareaRef.current;
    const targetTop = Math.max(0, (firstActiveLine - 1) * lineHeightPx + 12);
    const viewTop = ta.scrollTop;
    const viewBottom = viewTop + ta.clientHeight - lineHeightPx * 2;
    if (targetTop < viewTop + lineHeightPx || targetTop > viewBottom) {
      ta.scrollTo({
        top: Math.max(0, targetTop - ta.clientHeight * 0.35),
        behavior: 'smooth',
      });
    }
  }, [activeLines, followPlayhead, lineHeightPx]);

  const quickFixItem = useMemo(() => {
    for (const diag of diagnostics) {
      if (diag.severity !== 'error') continue;
      const lineIdx = diag.line - 1;
      if (lineIdx < 0 || lineIdx >= lines.length) continue;
      const fix = getQuickFixForDiagnostic(diag, lines[lineIdx]);
      if (fix) {
        return { diag, fix };
      }
    }
    return null;
  }, [diagnostics, lines]);

  const applyQuickFix = () => {
    if (!quickFixItem) return;
    const nextLines = [...lines];
    nextLines[quickFixItem.diag.line - 1] = quickFixItem.fix.newLineText;
    onChange(nextLines.join('\n'));
  };

  const syncScroll = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (gutterRef.current) {
      gutterRef.current.scrollTop = textarea.scrollTop;
    }
    if (highlightRef.current) {
      highlightRef.current.scrollTop = textarea.scrollTop;
      highlightRef.current.scrollLeft = textarea.scrollLeft;
    }
    setScrollPos({ top: textarea.scrollTop, left: textarea.scrollLeft });
  };

  const refreshAutocomplete = (nextCode: string, cursorIndex: number, forceOpen: boolean) => {
    if (!forceOpen && !enableAutocomplete) {
      setAutocomplete(null);
      return;
    }
    const result = getAutocompleteSuggestions(nextCode, cursorIndex, forceOpen, {
      definedSections,
      sampleNames,
    });
    setAutocomplete(result);
    setSelectedIndex(0);
  };

  const applySuggestion = (item: AutocompleteItem) => {
    if (!autocomplete || !textareaRef.current) return;

    const before = code.slice(0, autocomplete.startOffset);
    const after = code.slice(autocomplete.endOffset);
    const nextCode = `${before}${item.insertText}${after}`;
    const nextCursor = autocomplete.startOffset + item.insertText.length;

    onChange(nextCode);
    setAutocomplete(null);
    setSelectedIndex(0);

    window.requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = nextCursor;
        textareaRef.current.selectionEnd = nextCursor;
      }
    });
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextCode = event.target.value;
    const cursor = event.target.selectionStart ?? nextCode.length;
    onCursorChange?.(cursor);
    onChange(nextCode);
    refreshAutocomplete(nextCode, cursor, false);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLTextAreaElement>) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const rect = ta.getBoundingClientRect();
    const relX = event.clientX - rect.left + ta.scrollLeft - 16;
    const relY = event.clientY - rect.top + ta.scrollTop - 12;
    const lineIdx = Math.floor(relY / lineHeightPx);
    const colIdx = Math.floor(relX / charWidthApproxPx);
    if (lineIdx < 0 || lineIdx >= lines.length || colIdx < 0) {
      if (hoverDoc) setHoverDoc(null);
      return;
    }
    const lineText = lines[lineIdx];
    if (colIdx >= lineText.length) {
      if (hoverDoc) setHoverDoc(null);
      return;
    }
    const isWord = (c: string) => /[A-Za-z0-9_-]/.test(c);
    if (!isWord(lineText[colIdx])) {
      if (hoverDoc) setHoverDoc(null);
      return;
    }
    let start = colIdx;
    let end = colIdx;
    while (start > 0 && isWord(lineText[start - 1])) start -= 1;
    while (end < lineText.length && isWord(lineText[end])) end += 1;
    const word = lineText.slice(start, end);
    const doc = getHoverDoc(word);
    if (!doc) {
      if (hoverDoc) setHoverDoc(null);
      return;
    }
    const top = Math.max(8, (lineIdx + 1) * lineHeightPx + 14 - ta.scrollTop);
    const left = Math.max(16, Math.min(rect.width - 300, event.clientX - rect.left));
    setHoverDoc({ doc, top, left });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      setAutocomplete(null);
      onRunShortcut();
      return;
    }

    if (event.ctrlKey && event.code === 'Space') {
      event.preventDefault();
      const cursor = event.currentTarget.selectionStart ?? code.length;
      refreshAutocomplete(code, cursor, true);
      return;
    }

    if (autocomplete && autocomplete.items.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % autocomplete.items.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) =>
          (prev - 1 + autocomplete.items.length) % autocomplete.items.length,
        );
        return;
      }

      if (event.key === 'Tab' || event.key === 'Enter') {
        event.preventDefault();
        const chosen = autocomplete.items[selectedIndex] ?? autocomplete.items[0];
        if (chosen) {
          applySuggestion(chosen);
        }
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setAutocomplete(null);
        return;
      }
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      const target = event.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const updated = `${code.slice(0, start)}  ${code.slice(end)}`;
      onChange(updated);
      window.requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
        }
      });
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLTextAreaElement>) => {
    const snippet =
      event.dataTransfer.getData('application/x-sythm-component') ||
      event.dataTransfer.getData('text/plain');
    if (!snippet) return;
    event.preventDefault();

    const ta = textareaRef.current;
    const insertPos = ta ? (ta.selectionStart ?? code.length) : code.length;
    const needsNewline = insertPos > 0 && code[insertPos - 1] !== '\n';
    const insertion = `${needsNewline ? '\n' : ''}${snippet}`;
    const nextCode = `${code.slice(0, insertPos)}${insertion}${code.slice(insertPos)}`;
    const nextCursor = insertPos + insertion.length;
    onChange(nextCode);
    onCursorChange?.(nextCursor);
    window.requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = nextCursor;
        textareaRef.current.selectionEnd = nextCursor;
      }
    });
  };

  const popupTop = autocomplete
    ? Math.max(8, (autocomplete.lineIndex + 1) * lineHeightPx + 12 - scrollPos.top)
    : 0;
  const popupLeft = autocomplete
    ? Math.max(12, Math.min(420, autocomplete.columnIndex * charWidthApproxPx + 16 - scrollPos.left))
    : 0;

  return (
    <section className="sythm-bg-editor flex min-h-0 flex-1 flex-col">
      {/* Breadcrumb bar (Xcode Jump Bar) */}
      <div className="xcode-panel-border sythm-border sythm-bg-sidebar flex h-8 shrink-0 items-center justify-between border-b px-3 text-xs text-[var(--sythm-text-secondary)]">
        <div className="flex items-center gap-2">
          <span>Sythm</span>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-[var(--sythm-text-primary)]">{filename}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setFollowPlayhead((prev) => !prev)}
            title="Rolar editor automaticamente para acompanhar a linha em execução"
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition ${
              followPlayhead
                ? 'bg-[var(--sythm-accent)]/20 text-[var(--sythm-accent)]'
                : 'bg-[#2a2b30] text-[var(--sythm-text-secondary)] hover:text-white'
            }`}
          >
            <Sparkles className="h-3 w-3" />
            <span>Seguir Playhead</span>
          </button>
          <span className="text-[11px] opacity-80">
            Ctrl+Space Auto Complete · Ctrl+Enter Play
          </span>
        </div>
      </div>

      {/* Quick-Fix Banner for common syntax errors */}
      {quickFixItem && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#ff453a]/30 bg-[#ff453a]/10 px-3 py-1.5 text-xs text-[#ffb4ab]">
          <div className="flex min-w-0 items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[#ff6961]" />
            <span className="truncate">
              <strong className="font-mono-code">L{quickFixItem.diag.line}:</strong>{' '}
              {quickFixItem.diag.message}
            </span>
          </div>
          <button
            type="button"
            onClick={applyQuickFix}
            className="flex shrink-0 items-center gap-1 rounded bg-[#ff453a]/25 px-2.5 py-0.5 text-[11px] font-medium text-white transition hover:bg-[#ff453a]/40"
          >
            <Wrench className="h-3 w-3" />
            <span>Quick-Fix: {quickFixItem.fix.label}</span>
          </button>
        </div>
      )}

      {/* Editor Body */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Line Numbers Gutter */}
        {showLineNumbers && (
          <div
            ref={gutterRef}
            aria-hidden="true"
            style={{ lineHeight: `${lineHeightPx}px` }}
            className="sythm-border sythm-bg-editor w-14 shrink-0 overflow-hidden border-r py-3 text-right font-mono-code text-xs select-none"
          >
            {lines.map((_, idx) => {
              const lineNumber = idx + 1;
              const isActive = activeLines.has(lineNumber);
              const lineErrors = errorByLine.get(lineNumber);
              const hasError = Boolean(lineErrors && lineErrors.length > 0);

              return (
                <div
                  key={lineNumber}
                  style={{ height: `${lineHeightPx}px` }}
                  title={lineErrors?.map((d) => d.message).join('\n')}
                  className={`flex items-center justify-end gap-1 pr-2.5 ${
                    hasError
                      ? 'bg-[#ff453a]/15 text-[#ff8a80]'
                      : isActive
                        ? 'bg-[var(--sythm-accent)]/20 text-[var(--sythm-accent)] font-semibold'
                        : 'text-[var(--sythm-text-secondary)] opacity-60'
                  }`}
                >
                  {hasError && <AlertCircle className="h-3 w-3 shrink-0 text-[#ff6961]" />}
                  {!hasError && isActive && (
                    <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--sythm-accent)]" />
                  )}
                  <span>{lineNumber}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Highlighted Overlay + Transparent Textarea + Autocomplete Popover */}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <pre
            ref={highlightRef}
            aria-hidden="true"
            style={{ fontSize: `${fontSize}px`, lineHeight: `${lineHeightPx}px` }}
            className="sythm-syntax-layer pointer-events-none absolute inset-0 m-0 overflow-hidden px-4 py-3 font-mono-code whitespace-pre"
          >
            {highlightedLines.map((segments, lineIdx) => {
              const lineNumber = lineIdx + 1;
              const isActive = activeLines.has(lineNumber);
              const hasError = Boolean(errorByLine.get(lineNumber)?.length);

              return (
                <div
                  key={lineNumber}
                  style={{ minHeight: `${lineHeightPx}px` }}
                  className={
                    hasError
                      ? 'bg-[#ff453a]/12'
                      : isActive
                        ? 'border-l-2 border-[var(--sythm-accent)] bg-[var(--sythm-accent)]/15'
                        : ''
                  }
                >
                  {segments.length === 0 ? (
                    ' '
                  ) : (
                    segments.map((seg, segIdx) => (
                      <span key={segIdx} className={TOKEN_COLOR_CLASS[seg.kind]}>
                        {seg.text}
                      </span>
                    ))
                  )}
                </div>
              );
            })}
          </pre>

          <textarea
            ref={textareaRef}
            value={code}
            onChange={handleChange}
            onScroll={syncScroll}
            onKeyDown={handleKeyDown}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverDoc(null)}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes('application/x-sythm-component')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }
            }}
            onDrop={handleDrop}
            onSelect={(e) => onCursorChange?.(e.currentTarget.selectionStart ?? 0)}
            onClick={(e) => {
              onCursorChange?.(e.currentTarget.selectionStart ?? 0);
              setAutocomplete(null);
            }}
            onBlur={() => {
              // Small delay so mousedown/click on autocomplete item fires first
              window.setTimeout(() => setAutocomplete(null), 120);
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            aria-label="Editor de código Sythm"
            aria-autocomplete="list"
            aria-controls={autocomplete ? listboxId : undefined}
            aria-expanded={Boolean(autocomplete)}
            style={{ fontSize: `${fontSize}px`, lineHeight: `${lineHeightPx}px` }}
            className="xcode-scroll relative z-10 h-full w-full resize-none overflow-auto border-0 bg-transparent px-4 py-3 font-mono-code whitespace-pre text-transparent caret-[var(--sythm-text-primary)] outline-none selection:bg-[var(--sythm-accent)]/35"
          />

          {/* Inline Strudel-style Sliders anchored to control declaration & usage lines */}
          {showInlineSliders && controlsByLine.size > 0 && (
            <div
              aria-hidden={false}
              className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
            >
              {Array.from(controlsByLine.entries()).map(([lineNumber, lineControls]) => {
                const topPx = 12 + (lineNumber - 1) * lineHeightPx - scrollPos.top;
                const lineTextLength = (lines[lineNumber - 1] ?? '').trimEnd().length;
                const leftPx = Math.max(
                  20,
                  16 + lineTextLength * charWidthApproxPx + 14 - scrollPos.left,
                );

                return (
                  <div
                    key={`inline-ctrl-${lineNumber}`}
                    style={{ top: topPx, left: leftPx, height: `${lineHeightPx}px` }}
                    className="pointer-events-auto absolute flex items-center gap-1.5"
                  >
                    {lineControls.map((ctrl) => (
                      <ControlSlider
                        key={`${lineNumber}-${ctrl.name}`}
                        control={ctrl}
                        value={controlValues[ctrl.name] ?? ctrl.defaultValue}
                        compact
                        onChange={onControlChange}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* Hover Documentation Tooltip */}
          {hoverDoc && !autocomplete && (
            <div
              style={{ top: hoverDoc.top, left: hoverDoc.left }}
              className="pointer-events-none absolute z-30 w-72 rounded-lg border border-[#4a4d55] bg-[#1e1f23]/95 p-2.5 text-xs shadow-xl backdrop-blur"
            >
              <div className="font-mono-code text-[11px] font-bold text-[#64d2ff]">
                {hoverDoc.doc.title}
              </div>
              <div className="mt-1 rounded bg-[#141518] px-1.5 py-1 font-mono-code text-[10px] text-[#d0a8ff]">
                {hoverDoc.doc.syntax}
              </div>
              <p className="mt-1 text-[11px] leading-snug text-[#c7c7cc]">
                {hoverDoc.doc.description}
              </p>
            </div>
          )}

          {autocomplete && autocomplete.items.length > 0 && (
            <div
              id={listboxId}
              role="listbox"
              aria-label="Sugestões de código Sythm"
              style={{ top: popupTop, left: popupLeft }}
              className="xcode-panel-border absolute z-30 w-96 max-w-[calc(100%-24px)] overflow-hidden rounded-lg border border-[#4a4d55] bg-[#25262b] shadow-2xl"
            >
              <ul className="xcode-scroll max-h-56 overflow-y-auto py-1">
                {autocomplete.items.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  const badge = AUTOCOMPLETE_BADGE[item.kind];

                  return (
                    <li
                      key={`${item.kind}-${item.label}`}
                      role="option"
                      aria-selected={isSelected}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applySuggestion(item);
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-xs ${
                        isSelected
                          ? 'bg-[#0a84ff]/30 text-[#ffffff]'
                          : 'text-[#e5e5ea] hover:bg-[#32343b]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 font-mono-code text-[10px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                        <span className="truncate font-mono-code font-medium">{item.label}</span>
                      </div>
                      <span className="truncate text-[11px] text-[#aeaeb2]">{item.detail}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between border-t border-[#3d3f45] bg-[#1e1f23] px-3 py-1 text-[10px] text-[#8e8e93]">
                <span>↑↓ navegar · Tab/Enter inserir</span>
                <span>Esc fechar</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
