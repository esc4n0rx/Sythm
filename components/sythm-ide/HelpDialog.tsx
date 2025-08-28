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
          <DialogTitle>Ajuda - Linguagem Sythm</DialogTitle>
          <DialogDescription>Guia completo de referência para programação musical</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
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
            <h3 className="font-semibold mb-3 text-primary">🎹 Acordes (Novas Features)</h3>
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
              
              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Acordes Comuns:</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div><strong>Dó maior:</strong> <code className="bg-background px-1 rounded">[C4 E4 G4]</code></div>
                  <div><strong>Ré maior:</strong> <code className="bg-background px-1 rounded">[D4 F#4 A4]</code></div>
                  <div><strong>Mi maior:</strong> <code className="bg-background px-1 rounded">[E4 G#4 B4]</code></div>
                  <div><strong>Fá maior:</strong> <code className="bg-background px-1 rounded">[F4 A4 C5]</code></div>
                  <div><strong>Sol maior:</strong> <code className="bg-background px-1 rounded">[G4 B4 D5]</code></div>
                  <div><strong>Lá maior:</strong> <code className="bg-background px-1 rounded">[A4 C#5 E5]</code></div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-primary">🔄 Loops e Repetições (Novas Features)</h3>
            <div className="text-sm space-y-2">
              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Loop Estruturado:</h4>
                <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
{`loop 3 {
  C4
  E4
  G4
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

              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Loops Aninhados:</h4>
                <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
{`loop 2 {
  C4
  loop 3 {
    E4 0.5
    G4 0.5
  }
  rest
}`}
                </pre>
                <p className="mt-2 text-xs text-muted-foreground">Loops podem conter outros loops para estruturas complexas</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-primary">🎼 Notas e Oitavas</h3>
            <div className="text-sm space-y-2">
              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Notas Disponíveis:</h4>
                <div className="grid grid-cols-6 gap-2 text-center">
                  <div><code className="bg-background px-1 py-0.5 rounded">C</code></div>
                  <div><code className="bg-background px-1 py-0.5 rounded">C#/Db</code></div>
                  <div><code className="bg-background px-1 py-0.5 rounded">D</code></div>
                  <div><code className="bg-background px-1 py-0.5 rounded">D#/Eb</code></div>
                  <div><code className="bg-background px-1 py-0.5 rounded">E</code></div>
                  <div><code className="bg-background px-1 py-0.5 rounded">F</code></div>
                  <div><code className="bg-background px-1 py-0.5 rounded">F#/Gb</code></div>
                  <div><code className="bg-background px-1 py-0.5 rounded">G</code></div>
                  <div><code className="bg-background px-1 py-0.5 rounded">G#/Ab</code></div>
                  <div><code className="bg-background px-1 py-0.5 rounded">A</code></div>
                  <div><code className="bg-background px-1 py-0.5 rounded">A#/Bb</code></div>
                  <div><code className="bg-background px-1 py-0.5 rounded">B</code></div>
                </div>
              </div>
              
              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Oitavas Sugeridas:</h4>
                <div className="space-y-1">
                  <div><strong>Grave:</strong> C2, C3 (notas baixas)</div>
                  <div><strong>Médio:</strong> C4, C5 (notas centrais) - <em>mais usado</em></div>
                  <div><strong>Agudo:</strong> C6, C7 (notas altas)</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-primary">⏰ Sistema de Tempo</h3>
            <div className="text-sm bg-muted p-3 rounded space-y-2">
              <div><strong>Beat padrão:</strong> 1 beat = duração básica de uma nota</div>
              <div><strong>BPM:</strong> Controla quantos beats por minuto (ajustável no cabeçalho)</div>
              <div><strong>Modificadores de tempo:</strong></div>
              <ul className="ml-4 space-y-1">
                <li><code>slow</code> - Reduz velocidade pela metade (0.5x)</li>
                <li><code>fast</code> - Aumenta velocidade em 50% (1.5x)</li>
                <li>Os modificadores afetam todas as notas que vêm depois</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-primary">💡 Exemplos Práticos</h3>
            <div className="space-y-4 text-sm">
              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Progressão de Acordes:</h4>
                <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
{`// Progressão I-V-vi-IV em Dó maior
[C4 E4 G4] 2
[G4 B4 D5] 2
[A4 C5 E5] 2
[F4 A4 C5] 2`}
                </pre>
              </div>
              
              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Ritmo com Loops:</h4>
                <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
{`// Padrão rítmico repetitivo
loop 4 {
  [C4 E4] 0.5
  rest 0.5
  [C4 E4] 0.5
  [G4 B4] 1
}`}
                </pre>
              </div>
              
              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Melodia com Acompanhamento:</h4>
                <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
{`// Acorde de base + melodia
[C4 E4 G4] 4

// Melodia por cima
loop 2 {
  (C5 D5 E5 F5) * 1
  rest 1
}`}
                </pre>
              </div>

              <div className="bg-muted p-3 rounded">
                <h4 className="font-medium mb-2">Variações de Tempo com Estruturas:</h4>
                <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
{`// Começa normal
(C4 D4 E4) * 1

// Seção lenta com acordes
slow
loop 2 {
  [C4 E4 G4] 2
  [F4 A4 C5] 2
}

// Seção rápida com melodia
fast
(C5 B4 A4 G4 F4 E4 D4 C4) * 2`}
                </pre>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-primary">⌨️ Controles da IDE</h3>
            <div className="text-sm bg-muted p-3 rounded space-y-2">
              <div><strong>Executar:</strong> Reproduz seu código musical</div>
              <div><strong>Parar:</strong> Interrompe a reprodução</div>
              <div><strong>BPM:</strong> Ajuste a velocidade global (60-200)</div>
              <div><strong>Sidebar:</strong> Clique nos componentes para adicioná-los ao código</div>
              <div><strong>Comentários:</strong> Use <code>//</code> para adicionar comentários</div>
              <div><strong>Estruturas:</strong> Use chaves <code>{}</code> para loops e colchetes <code>[]</code> para acordes</div>
              <div><strong>Multiplicação:</strong> Use parênteses <code>()</code> seguidos de <code>*</code> para repetir grupos</div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-primary">🚀 Dicas Avançadas</h3>
            <div className="text-sm bg-muted p-3 rounded space-y-2">
              <div><strong>Combinar Estruturas:</strong> Use loops dentro de grupos e vice-versa</div>
              <div><strong>Acordes Variados:</strong> Experimente diferentes inversões e extensões</div>
              <div><strong>Ritmos Complexos:</strong> Combine durações fracionárias com loops</div>
              <div><strong>Dinâmica:</strong> Alterne entre <code>slow</code> e <code>fast</code> para criar contraste</div>
              <div><strong>Pausas Estratégicas:</strong> Use <code>rest</code> para criar respiração musical</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}