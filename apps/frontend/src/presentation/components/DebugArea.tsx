import {
  AlertCircle,
  Braces,
  CheckCircle2,
  ChevronRight,
  Code2,
  Info,
  Terminal,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type { ExecutionPlan, ProgramNode, StatementNode, Token } from '@sythm/core';

export type DebugTab = 'console' | 'tokens' | 'ast';

export interface IdeConsoleLine {
  id: string;
  timestamp: string;
  level: 'info' | 'print' | 'error' | 'audio';
  message: string;
  location?: string;
}

interface DebugAreaProps {
  activeTab: DebugTab;
  onTabChange: (tab: DebugTab) => void;
  consoleLines: IdeConsoleLine[];
  tokens: Token[];
  ast: ProgramNode | null;
  plan: ExecutionPlan | null;
  onClearConsole: () => void;
}

function StatementTreeItem({ stmt, depth = 0 }: { stmt: StatementNode; depth?: number }) {
  const paddingLeft = depth * 16;

  let summary = '';
  switch (stmt.kind) {
    case 'ControlStatement':
      summary = `CONTROL ${stmt.name} = SLIDER ${stmt.defaultValue} [${stmt.min}..${stmt.max}]`;
      break;
    case 'MetadataStatement':
      summary = `${stmt.key} = "${stmt.value}"`;
      break;
    case 'TempoStatement':
      summary = `TEMPO = ${stmt.bpm} BPM`;
      break;
    case 'WaveStatement':
      summary = `WAVE = ${stmt.waveform.toUpperCase()}`;
      break;
    case 'VolumeStatement':
      summary = `VOLUME = ${stmt.volume}`;
      break;
    case 'PlayNoteStatement':
      summary = `NOTE ${stmt.note} (${stmt.beats} beats)`;
      break;
    case 'PlayNotesStatement':
      summary = `NOTES [${stmt.notes.join(', ')}] (${stmt.beatsPerNote} beats cada)`;
      break;
    case 'PlayChordStatement':
      summary = `CHORD [${stmt.notes.join(', ')}] (${stmt.beats} beats)`;
      break;
    case 'PlayDrumStatement':
      summary = `DRUM ${stmt.drum.toUpperCase()} (${stmt.beats} beats)`;
      break;
    case 'PlayDrumsStatement':
      summary = `DRUMS [${stmt.drums.map((d) => d.toUpperCase()).join(', ')}] (${stmt.beatsPerHit} beats cada)`;
      break;
    case 'TrackStatement':
      summary = `TRACK ${stmt.name}`;
      break;
    case 'SectionStatement':
      summary = `SECTION ${stmt.name}`;
      break;
    case 'PerformStatement':
      summary = `PERFORM ${stmt.sectionName} (${stmt.times}x)`;
      break;
    case 'FilterStatement':
      summary =
        stmt.mode === 'off'
          ? 'FILTER OFF'
          : `FILTER ${stmt.mode.toUpperCase()} @ ${stmt.frequencyHz} Hz (Q=${stmt.q})`;
      break;
    case 'DelayStatement':
      summary =
        stmt.mix === 0
          ? 'DELAY OFF'
          : `DELAY ${Math.round(stmt.mix * 100)}%`;
      break;
    case 'ReverbStatement':
      summary =
        stmt.mix === 0
          ? 'REVERB OFF'
          : `REVERB ${Math.round(stmt.mix * 100)}%`;
      break;
    case 'EnvelopeStatement':
      summary = 'ENVELOPE ADSR';
      break;
    case 'DetuneStatement':
      summary = stmt.cents === 0 ? 'DETUNE OFF' : `DETUNE ${stmt.cents} cents`;
      break;
    case 'VisualizerStatement':
      summary = `VISUALIZER IS ${stmt.mode.toUpperCase()}`;
      break;
    case 'PlayChordsStatement':
      summary = `CHORDS [${stmt.chords.map((c) => c.symbol ?? c.notes.join('+')).join(', ')}] (${stmt.beatsPerChord} beats cada)`;
      break;
    case 'ArpeggiateStatement':
      summary = `ARPEGGIATE ${stmt.symbol ?? stmt.notes.join(' ')} ${stmt.direction.toUpperCase()} (${stmt.beatsPerStep} beats)`;
      break;
    case 'TransposeStatement':
      summary = `TRANSPOSE ${stmt.semitones >= 0 ? `+${stmt.semitones}` : stmt.semitones} SEMITONES`;
      break;
    case 'ScaleStatement':
      summary = `SCALE ${stmt.root} ${stmt.mode.toUpperCase()} [${stmt.notes.join(' ')}]`;
      break;
    case 'PlayEuclideanStatement':
      summary = `EUCLIDEAN ${(stmt.drum ?? stmt.note ?? '').toUpperCase()} ${stmt.pulses} IN ${stmt.steps} (${stmt.beatsPerStep} beats)`;
      break;
    case 'PanStatement':
      summary = stmt.panControl
        ? 'PAN = CONTROL/SLIDER'
        : `PAN ${stmt.pan === 0 ? 'CENTER' : `${Math.round(stmt.pan * 100)}%`}`;
      break;
    case 'LfoStatement':
      summary =
        stmt.mode === 'off'
          ? 'LFO OFF'
          : `LFO ${stmt.rateHz} Hz / DEPTH ${stmt.depthHz} Hz`;
      break;
    case 'SweepStatement':
      summary =
        stmt.mode === 'off'
          ? 'SWEEP OFF'
          : `SWEEP ${stmt.startHz} Hz -> ${stmt.endHz} Hz`;
      break;
    case 'RestStatement':
      summary = `REST (${stmt.beats} beats)`;
      break;
    case 'RepeatStatement':
      summary = `REPEAT ${stmt.times} TIMES`;
      break;
    case 'PrintStatement':
      summary = `PRINT "${stmt.message}"`;
      break;
  }

  return (
    <div>
      <div
        style={{ paddingLeft }}
        className="flex items-center gap-2 rounded px-2 py-1 font-mono-code text-xs text-[#e5e5ea] hover:bg-[#2c2d33]"
      >
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#64d2ff]" aria-hidden="true" />
        <span className="rounded bg-[#32343b] px-1.5 py-0.5 text-[10px] font-semibold text-[#70c4ff]">
          {stmt.kind}
        </span>
        <span>{summary}</span>
        <span className="ml-auto text-[11px] text-[#8e8e93]">L{stmt.line}</span>
      </div>

      {stmt.kind === 'RepeatStatement' &&
        stmt.body.map((child, idx) => (
          <StatementTreeItem key={`${child.kind}-${child.line}-${idx}`} stmt={child} depth={depth + 1} />
        ))}

      {stmt.kind === 'TrackStatement' &&
        stmt.statements.map((child, idx) => (
          <StatementTreeItem key={`${child.kind}-${child.line}-${idx}`} stmt={child} depth={depth + 1} />
        ))}

      {stmt.kind === 'SectionStatement' &&
        stmt.statements.map((child, idx) => (
          <StatementTreeItem key={`${child.kind}-${child.line}-${idx}`} stmt={child} depth={depth + 1} />
        ))}
    </div>
  );
}

export function DebugArea({
  activeTab,
  onTabChange,
  consoleLines,
  tokens,
  ast,
  plan,
  onClearConsole,
}: DebugAreaProps) {
  const [astViewMode, setAstViewMode] = useState<'tree' | 'json'>('tree');

  return (
    <section className="xcode-panel-border sythm-border sythm-bg-window flex h-72 shrink-0 flex-col border-t">
      {/* Xcode Debug Area Tab Header */}
      <div className="sythm-border sythm-bg-sidebar flex h-9 shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-1" role="tablist" aria-label="Debug Area">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'console'}
            onClick={() => onTabChange('console')}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-[#0a84ff] ${
              activeTab === 'console'
                ? 'bg-[#36383f] text-[#ffffff]'
                : 'text-[#aeaeb2] hover:bg-[#2f3137] hover:text-[#f2f2f7]'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Console / Output</span>
            <span className="rounded bg-[#16171a] px-1.5 py-0.2 text-[10px] text-[#aeaeb2]">
              {consoleLines.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tokens'}
            onClick={() => onTabChange('tokens')}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-[#0a84ff] ${
              activeTab === 'tokens'
                ? 'bg-[#36383f] text-[#ffffff]'
                : 'text-[#aeaeb2] hover:bg-[#2f3137] hover:text-[#f2f2f7]'
            }`}
          >
            <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Tokens (Lexer)</span>
            <span className="rounded bg-[#16171a] px-1.5 py-0.2 text-[10px] text-[#aeaeb2]">
              {tokens.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ast'}
            onClick={() => onTabChange('ast')}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-[#0a84ff] ${
              activeTab === 'ast'
                ? 'bg-[#36383f] text-[#ffffff]'
                : 'text-[#aeaeb2] hover:bg-[#2f3137] hover:text-[#f2f2f7]'
            }`}
          >
            <Braces className="h-3.5 w-3.5" aria-hidden="true" />
            <span>AST (Parser)</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'ast' && (
            <div className="flex items-center rounded border border-[#3d3f45] bg-[#16171a] p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setAstViewMode('tree')}
                className={`cursor-pointer rounded px-2 py-0.5 ${
                  astViewMode === 'tree' ? 'bg-[#36383f] text-white' : 'text-[#aeaeb2]'
                }`}
              >
                Árvore
              </button>
              <button
                type="button"
                onClick={() => setAstViewMode('json')}
                className={`cursor-pointer rounded px-2 py-0.5 ${
                  astViewMode === 'json' ? 'bg-[#36383f] text-white' : 'text-[#aeaeb2]'
                }`}
              >
                JSON / Plan
              </button>
            </div>
          )}

          {activeTab === 'console' && (
            <button
              type="button"
              onClick={onClearConsole}
              className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#3d3f45] bg-[#2c2d33] px-2 py-1 text-[11px] text-[#d1d1d6] hover:bg-[#383a42] focus-visible:outline-2 focus-visible:outline-[#0a84ff]"
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
              <span>Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="xcode-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {activeTab === 'console' && (
          <div className="space-y-1 font-mono-code text-xs">
            {consoleLines.length === 0 ? (
              <div className="text-[#8e8e93]">
                Nenhuma saída ainda. Clique em Play ou Compile para inspecionar a execução.
              </div>
            ) : (
              consoleLines.map((line) => (
                <div
                  key={line.id}
                  className={`flex items-start gap-2 rounded px-2 py-1 ${
                    line.level === 'error'
                      ? 'bg-[#ff453a]/12 text-[#ff8a80]'
                      : line.level === 'print'
                        ? 'bg-[#30d158]/10 text-[#8ce99a]'
                        : line.level === 'audio'
                          ? 'text-[#70c4ff]'
                          : 'text-[#d1d1d6]'
                  }`}
                >
                  <span className="shrink-0 text-[11px] text-[#8e8e93]">[{line.timestamp}]</span>
                  {line.level === 'error' ? (
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff6961]" aria-hidden="true" />
                  ) : line.level === 'print' ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#30d158]" aria-hidden="true" />
                  ) : (
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#64d2ff]" aria-hidden="true" />
                  )}
                  <span className="flex-1 break-words">{line.message}</span>
                  {line.location && (
                    <span className="shrink-0 rounded bg-[#2c2d33] px-1.5 py-0.5 text-[10px] text-[#aeaeb2]">
                      {line.location}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'tokens' && (
          <div className="overflow-x-auto">
            {tokens.length === 0 ? (
              <div className="font-mono-code text-xs text-[#8e8e93]">
                Execute Compile ou Play para gerar os tokens do Lexer.
              </div>
            ) : (
              <table className="w-full border-collapse text-left font-mono-code text-xs">
                <thead>
                  <tr className="border-b border-[#3d3f45] text-[11px] text-[#aeaeb2]">
                    <th className="py-1.5 pr-3 font-semibold">#</th>
                    <th className="py-1.5 pr-3 font-semibold">Posição</th>
                    <th className="py-1.5 pr-3 font-semibold">TokenType</th>
                    <th className="py-1.5 pr-3 font-semibold">Lexema</th>
                    <th className="py-1.5 font-semibold">Literal</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token, idx) => (
                    <tr
                      key={`${token.type}-${token.line}-${token.column}-${idx}`}
                      className="border-b border-[#2c2d33] hover:bg-[#26272c]"
                    >
                      <td className="py-1 pr-3 text-[#8e8e93]">{idx + 1}</td>
                      <td className="py-1 pr-3 text-[#aeaeb2]">
                        {token.line}:{token.column}
                      </td>
                      <td className="py-1 pr-3">
                        <span className="rounded bg-[#0a84ff]/15 px-1.5 py-0.5 text-[11px] text-[#70c4ff]">
                          {token.type}
                        </span>
                      </td>
                      <td className="py-1 pr-3 text-[#f2f2f7]">{token.lexeme || 'EOF'}</td>
                      <td className="py-1 text-[#8ce99a]">
                        {token.literal !== undefined ? String(token.literal) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'ast' && (
          <div>
            {!ast ? (
              <div className="font-mono-code text-xs text-[#8e8e93]">
                Execute Compile ou Play para visualizar a Árvore Sintática Abstrata (AST).
              </div>
            ) : astViewMode === 'tree' ? (
              <div className="space-y-2">
                {ast.divisions.map((div, idx) => (
                  <div
                    key={`${div.name}-${idx}`}
                    className="rounded-md border border-[#32343b] bg-[#232429] p-2"
                  >
                    <div className="mb-1 flex items-center justify-between font-mono-code text-xs font-semibold text-[#ffd60a]">
                      <span>
                        {div.name} ({div.divisionType})
                      </span>
                      <span className="text-[11px] font-normal text-[#8e8e93]">L{div.line}</span>
                    </div>
                    <div className="space-y-0.5">
                      {div.statements.map((stmt, sIdx) => (
                        <StatementTreeItem key={`${stmt.kind}-${sIdx}`} stmt={stmt} depth={1} />
                      ))}
                    </div>
                  </div>
                ))}

                {ast.statements.length > 0 && (
                  <div className="rounded-md border border-[#32343b] bg-[#232429] p-2">
                    <div className="mb-1 font-mono-code text-xs font-semibold text-[#70c4ff]">
                      TOP-LEVEL STATEMENTS
                    </div>
                    <div className="space-y-0.5">
                      {ast.statements.map((stmt, sIdx) => (
                        <StatementTreeItem key={`${stmt.kind}-${sIdx}`} stmt={stmt} depth={1} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <pre className="font-mono-code text-[11px] leading-5 text-[#d1d1d6]">
                {JSON.stringify({ ast, executionPlan: plan }, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
