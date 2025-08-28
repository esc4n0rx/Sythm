'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface HelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajuda - Linguagem Sythm com Instrumentos</DialogTitle>
          <DialogDescription>Guia completo de referência para programação musical com instrumentos</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-3 text-primary">🎛️ Sistema de Instrumentos (NOVO!)</h3>
            <div className="space-y-3 text-sm">
              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Seleção de Instrumentos:</h4>
                <div className="space-y-1">
                  <div><code className="bg-background px-2 py-1 rounded">@default</code> - Sintetizador padrão</div>
                  <div><code className="bg-background px-2 py-1 rounded">@bass</code> - Baixo sintetizado profundo</div>
                  <div><code className="bg-background px-2 py-1 rounded">@lead</code> - Sintetizador lead para melodias</div>
                  <div><code className="bg-background px-2 py-1 rounded">@pad</code> - Sons atmosféricos e texturas</div>
                  <div><code className="bg-background px-2 py-1 rounded">@kick</code> - Bumbo eletrônico</div>
                  <div><code className="bg-background px-2 py-1 rounded">@snare</code> - Caixa eletrônica</div>
                  <div><code className="bg-background px-2 py-1 rounded">@hihat</code> - Chimbal eletrônico</div>
                </div>
              </div>
              
              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Como Usar:</h4>
                <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
{`// Seleciona instrumento bass
@bass
C2 2
F2 2

// Muda para lead synth
@lead
C5
D5
E5

// Volta para drums
@kick
C4 rest C4 rest`}
                </pre>
              </div>

              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Características dos Instrumentos:</h4>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div><strong>Bass:</strong> Sub-oscilador, filtro passa-baixas, distorção suave</div>
                  <div><strong>Lead:</strong> Portamento, vibrato, filter sweep automático</div>
                  <div><strong>Pad:</strong> Múltiplos osciladores, chorus, envelope longo</div>
                  <div><strong>Kick:</strong> Pitch envelope, corpo + click, filtros otimizados</div>
                  <div><strong>Snare:</strong> Componente tonal + ruído, envelope snappy</div>
                  <div><strong>Hi-Hat:</strong> Múltiplas frequências metálicas, aberto/fechado</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-primary">🎵 Comandos Básicos</h3>
            <div className="space-y-3 text-sm">
              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Notas Musicais:</h4>
                <div className="space-y-1">
                  <div><code className="bg-background px-2 py-1 rounded">C4</code> - Toca nota C na 4ª oitava por 1 beat</div>
                  <div><code className="bg-background px-2 py-1 rounded">F#5</code> - Toca F sustenido na 5ª oitava</div>
                  <div><code className="bg-background px-2 py-1 rounded">Bb3</code> - Toca B bemol na 3ª oitava</div>
                </div>
              </div>
              
              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Durações:</h4>
                <div className="space-y-1">
                  <div><code className="bg-background px-2 py-1 rounded">C4 2</code> - Toca C4 por 2 beats</div>
                  <div><code className="bg-background px-2 py-1 rounded">D4 0.5</code> - Toca D4 por meio beat</div>
                  <div><code className="bg-background px-2 py-1 rounded">E4 1.5</code> - Toca E4 por 1 beat e meio</div>
                </div>
              </div>
              
              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Pausas e Controles:</h4>
                <div className="space-y-1">
                  <div><code className="bg-background px-2 py-1 rounded">rest</code> - Pausa de 1 beat</div>
                  <div><code className="bg-background px-2 py-1 rounded">rest 2</code> - Pausa de 2 beats</div>
                  <div><code className="bg-background px-2 py-1 rounded">slow</code> - Torna todas as notas seguintes mais lentas</div>
                  <div><code className="bg-background px-2 py-1 rounded">fast</code> - Torna todas as notas seguintes mais rápidas</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-primary">🎹 Acordes</h3>
            <div className="text-sm space-y-2">
              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Sintaxe de Acordes:</h4>
                <div className="space-y-1">
                  <div><code className="bg-background px-2 py-1 rounded">[C4 E4 G4]</code> - Acorde de Dó maior (3 notas simultâneas)</div>
                  <div><code className="bg-background px-2 py-1 rounded">[C4 E4 G4] 2</code> - Acorde de Dó maior por 2 beats</div>
                  <div><code className="bg-background px-2 py-1 rounded">[F4 A4 C5]</code> - Acorde de Fá maior</div>
                  <div><code className="bg-background px-2 py-1 rounded">[D4 F#4 A4]</code> - Acorde de Ré maior</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-primary">🔄 Loops e Repetições</h3>
            <div className="text-sm space-y-2">
              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Loop Estruturado:</h4>
                <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
{`loop 3 {
  @kick
  C4
  rest
  C4
  rest
}`}
                </pre>
                <p className="mt-2 text-xs text-muted-foreground">Repete o bloco de comandos 3 vezes</p>
              </div>
              
              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Grupos com Multiplicação:</h4>
                <div className="space-y-2">
                  <div><code className="bg-background px-2 py-1 rounded">(C4 D4) * 3</code> - Repete C4 D4 três vezes</div>
                  <div><code className="bg-background px-2 py-1 rounded">(C4 rest E4) * 2</code> - Repete sequência com pausa</div>
                  <div><code className="bg-background px-2 py-1 rounded">([C4 E4 G4] rest) * 4</code> - Repete acorde + pausa</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-primary">🥁 Exemplos com Instrumentos</h3>
            <div className="space-y-4 text-sm">
              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Beat de Bateria:</h4>
                <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
{`// Pattern de bateria básico
@kick
loop 4 {
  C4 rest C4 rest
}

@snare  
loop 4 {
  rest C4 rest C4
}

@hihat
loop 4 {
  (C4 0.5) * 4
}`}
                </pre>
              </div>
              
              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Bass Line + Melody:</h4>
                <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
{`// Linha de baixo
@bass
loop 2 {
  C2 2
  F2 2
  G2 2
  C2 2
}

// Melodia por cima
@lead
loop 2 {
  C5 D5 E5 F5
  G5 F5 E5 D5
}`}
                </pre>
              </div>
              
              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Progressão com Pads:</h4>
                <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
{`// Progressão atmosférica
@pad
[C4 E4 G4] 4
[A3 C4 E4] 4
[F3 A3 C4] 4
[G3 B3 D4] 4

// Adiciona melodia sutil
@lead
slow
C6 0.5 E6 0.5 G6 1
A6 0.5 C6 0.5 E6 1`}
                </pre>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-primary">💡 Dicas para Instrumentos</h3>
            <div className="text-sm bg-muted p-3 rounded space-y-2">
              <div><strong>Bass:</strong> Use notas graves (C1-C3) para melhor resultado</div>
              <div><strong>Lead:</strong> Ideal para melodias e solos nas oitavas médias-altas (C4-C6)</div>
              <div><strong>Pad:</strong> Perfeito para acordes longos e atmosferas</div>
              <div><strong>Drums:</strong> Para kick/snare/hihat, a altura da nota não importa muito</div>
              <div><strong>Layering:</strong> Combine instrumentos para texturas ricas</div>
              <div><strong>Dinâmica:</strong> Use <code>slow</code>/<code>fast</code> com diferentes instrumentos</div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-primary">⌨️ Controles da IDE</h3>
            <div className="text-sm bg-muted p-3 rounded space-y-2">
              <div><strong>Executar:</strong> Reproduz seu código musical</div>
              <div><strong>Parar:</strong> Interrompe a reprodução</div>
              <div><strong>BPM:</strong> Ajuste a velocidade global (60-200)</div>
              <div><strong>Seletor de Instrumentos:</strong> Na sidebar, selecione instrumento atual</div>
              <div><strong>Botões "+":</strong> Clique para adicionar código de instrumento</div>
              <div><strong>Syntax Highlighting:</strong> Instrumentos aparecem em roxo sublinhado</div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-primary">🚀 Exemplo Completo</h3>
            <div className="text-sm">
              <pre className="bg-background p-3 rounded text-xs overflow-x-auto">
{`// Composição completa com múltiplos instrumentos
// Base rítmica
@kick
loop 8 {
  C4 rest C4 rest
}

@snare
loop 8 {
  rest C4 rest C4  
}

@hihat
loop 8 {
  (C4 0.25) * 4
}

// Base harmônica
@bass  
loop 2 {
  C2 2 F2 2
  G2 2 C2 2
}

@pad
[C4 E4 G4] 8
[F4 A4 C5] 8

// Melodia principal
@lead
C5 D5 E5 F5
G5 2 rest 2
F5 E5 D5 C5
C5 4

// Final com todos
@bass
C2 4`}
              </pre>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}