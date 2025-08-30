'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Music, Layers, Repeat, Volume2, Clock, Headphones } from 'lucide-react'

interface HelpDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function HelpDialog({ isOpen, onClose }: HelpDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="w-5 h-5 text-primary" />
            Guia da Linguagem Sythm
          </DialogTitle>
          <DialogDescription>
            Aprenda a criar música com a linguagem Sythm
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <Tabs defaultValue="basics" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basics">Básico</TabsTrigger>
              <TabsTrigger value="multitrack">
                <Layers className="w-4 h-4 mr-1" />
                Multitrack
              </TabsTrigger>
              <TabsTrigger value="patterns">
                <Repeat className="w-4 h-4 mr-1" />
                Patterns
              </TabsTrigger>
              <TabsTrigger value="examples">Exemplos</TabsTrigger>
            </TabsList>

            <TabsContent value="basics" className="mt-6 space-y-6">
              <div>
                <h3 className="font-semibold mb-3 text-primary">🎵 Notas Musicais</h3>
                <div className="text-sm space-y-2">
                  <div className="bg-muted p-3 rounded">
                    <h4 className="font-medium mb-2">Sintaxe Básica:</h4>
                    <div className="space-y-1">
                      <div><code className="bg-background px-2 py-1 rounded">C4</code> - Nota Dó na 4ª oitava</div>
                      <div><code className="bg-background px-2 py-1 rounded">F#5</code> - Nota Fá sustenido na 5ª oitava</div>
                      <div><code className="bg-background px-2 py-1 rounded">Bb3</code> - Nota Si bemol na 3ª oitava</div>
                      <div><code className="bg-background px-2 py-1 rounded">C4 2</code> - Nota Dó por 2 beats</div>
                      <div><code className="bg-background px-2 py-1 rounded">D4 0.5</code> - Nota Ré por meio beat</div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 text-primary">🎹 Acordes</h3>
                <div className="text-sm space-y-2">
                  <div className="bg-muted p-3 rounded">
                    <h4 className="font-medium mb-2">Múltiplas notas simultâneas:</h4>
                    <div className="space-y-1">
                      <div><code className="bg-background px-2 py-1 rounded">[C4 E4 G4]</code> - Acorde de Dó maior</div>
                      <div><code className="bg-background px-2 py-1 rounded">[C4 E4 G4] 2</code> - Acorde por 2 beats</div>
                      <div><code className="bg-background px-2 py-1 rounded">[F4 A4 C5]</code> - Acorde de Fá maior</div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 text-primary">🎛️ Instrumentos</h3>
                <div className="text-sm space-y-2">
                  <div className="bg-muted p-3 rounded">
                    <h4 className="font-medium mb-2">Seleção de Instrumentos:</h4>
                    <div className="space-y-1">
                      <div><code className="bg-background px-2 py-1 rounded">@bass</code> - Sintetizador de baixo</div>
                      <div><code className="bg-background px-2 py-1 rounded">@kick</code> - Bumbo eletrônico</div>
                      <div><code className="bg-background px-2 py-1 rounded">@lead</code> - Sintetizador lead</div>
                      <div><code className="bg-background px-2 py-1 rounded">@pad</code> - Sons atmosféricos</div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 text-primary">⏱️ Controles de Tempo</h3>
                <div className="text-sm space-y-2">
                  <div className="bg-muted p-3 rounded">
                    <div className="space-y-1">
                      <div><code className="bg-background px-2 py-1 rounded">rest</code> - Pausa de 1 beat</div>
                      <div><code className="bg-background px-2 py-1 rounded">rest 2</code> - Pausa de 2 beats</div>
                      <div><code className="bg-background px-2 py-1 rounded">slow</code> - Diminui velocidade</div>
                      <div><code className="bg-background px-2 py-1 rounded">fast</code> - Aumenta velocidade</div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="multitrack" className="mt-6 space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 p-4 rounded-lg border">
                <h3 className="font-semibold mb-2 text-primary flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Sistema Multitrack
                  <Badge variant="secondary" className="ml-2">Novo!</Badge>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Crie múltiplas tracks que tocam simultaneamente, sincronizadas em um clock global.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-3 text-primary">🎚️ Definindo Tracks</h3>
                <div className="text-sm space-y-2">
                  <div className="bg-muted p-3 rounded">
                    <h4 className="font-medium mb-2">Sintaxe de Track:</h4>
                    <pre className="bg-background p-3 rounded text-xs overflow-x-auto">
{`track nomeDoTrack {
  @instrumento
  # comandos da track...
  C4 1
  D4 1
  [C4 E4] 2
}`}
                    </pre>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Cada track é independente mas sincronizada no tempo global
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 text-primary">🎵 Exemplo Multitrack Básico</h3>
                <div className="text-sm space-y-2">
                  <div className="bg-muted p-3 rounded">
                    <pre className="bg-background p-3 rounded text-xs overflow-x-auto">
{`# Track de bateria
track drums {
  @kick
  loop 4 {
    C4 1      # Kick no tempo 1
    rest 1    # Silêncio no tempo 2  
    C4 1      # Kick no tempo 3
    rest 1    # Silêncio no tempo 4
  }
}

# Track de baixo
track bass {
  @bass
  loop 2 {
    C2 2      # Nota grave longa
    G2 2      # Quinta acima
  }
}

# Track de melodia
track melody {
  @lead  
  loop 4 {
    C4 0.5 D4 0.5 E4 1
  }
}`}
                    </pre>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 text-primary">🎛️ Controles de Track</h3>
                <div className="text-sm space-y-2">
                  <div className="bg-muted p-3 rounded">
                    <h4 className="font-medium mb-2">Interface de Mixer:</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-muted-foreground" />
                        <span><strong>Mute/Unmute:</strong> Silencia tracks individuais</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Headphones className="w-4 h-4 text-muted-foreground" />
                        <span><strong>Solo:</strong> Toca apenas a track selecionada</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-muted-foreground" />
                        <span><strong>Volume:</strong> Controle individual de volume (0-150%)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="patterns" className="mt-6 space-y-6">
              <div className="bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-950/30 dark:to-teal-950/30 p-4 rounded-lg border">
                <h3 className="font-semibold mb-2 text-primary flex items-center gap-2">
                  <Repeat className="w-4 h-4" />
                  Sistema de Patterns
                  <Badge variant="secondary" className="ml-2">Novo!</Badge>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Defina sequências musicais reutilizáveis e use em múltiplas tracks.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-3 text-primary">📋 Definindo Patterns</h3>
                <div className="text-sm space-y-2">
                  <div className="bg-muted p-3 rounded">
                    <h4 className="font-medium mb-2">Sintaxe de Pattern:</h4>
                    <pre className="bg-background p-3 rounded text-xs overflow-x-auto">
{`pattern nomeDoPattern = {
  # sequência musical...
  C4 1
  D4 0.5
  E4 0.5
  rest 1
}`}
                    </pre>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Patterns são blocos de música que podem ser reutilizados
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 text-primary">🔄 Usando Patterns</h3>
                <div className="text-sm space-y-2">
                  <div className="bg-muted p-3 rounded">
                    <h4 className="font-medium mb-2">Exemplo Completo:</h4>
                    <pre className="bg-background p-3 rounded text-xs overflow-x-auto">
{`# Define patterns reutilizáveis
pattern kickPattern = {
  C4 1 rest 1 C4 1 rest 1
}

pattern snarePattern = {
  rest 1 C4 1 rest 1 C4 1  
}

pattern bassline = {
  C2 1 C2 1 G2 2
}

# Usa patterns nas tracks
track drums {
  @kick
  loop 4 kickPattern
}

track snare {
  @snare  
  loop 4 snarePattern
}

track bass {
  @bass
  loop 2 bassline
}`}
                    </pre>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 text-primary">💡 Vantagens dos Patterns</h3>
                <div className="text-sm space-y-2">
                  <div className="bg-muted p-3 rounded">
                    <div className="space-y-2">
                      <div>✅ <strong>Reutilização:</strong> Use o mesmo pattern em várias tracks</div>
                      <div>✅ <strong>Manutenção:</strong> Altere o pattern uma vez, afeta todas as uses</div>
                      <div>✅ <strong>Organização:</strong> Mantenha o código limpo e estruturado</div>
                      <div>✅ <strong>Composição:</strong> Combine patterns para criar músicas complexas</div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="examples" className="mt-6 space-y-6">
              <div>
                <h3 className="font-semibold mb-3 text-primary">🎼 Música Completa Multitrack</h3>
                <div className="text-sm space-y-2">
                  <div className="bg-muted p-3 rounded">
                    <h4 className="font-medium mb-2">"Electronic Groove" - Exemplo Avançado:</h4>
                    <pre className="bg-background p-2 rounded text-xs overflow-x-auto max-h-96">
{`# === PATTERNS REUTILIZÁVEIS ===
pattern mainBeat = {
  C4 1       # Kick forte
  rest 0.5   # Pausa curta
  C4 0.5     # Kick fraco
  rest 1     # Pausa longa
}

pattern snareHit = {
  rest 1     # Silêncio no primeiro tempo
  C4 1       # Snare no segundo tempo
  rest 1     # Silêncio no terceiro
  C4 1       # Snare no quarto
}

pattern hihatGroove = {
  (C4 0.25) * 4  # Hi-hats rápidos
  (C4 0.25) * 4  # Continuação
}

pattern basslineMain = {
  C2 1       # Fundamental
  rest 0.5   # Respiração
  C2 0.5     # Repetição
  G2 1       # Quinta
  rest 1     # Pausa
}

pattern basslineBridge = {
  A2 2       # Acorde menor
  F2 2       # Resolução
}

pattern leadMelody = {
  C5 0.5 D5 0.5 E5 1
  F5 0.5 E5 0.5 D5 1
}

pattern leadHarmony = {
  rest 1
  [E5 G5] 0.5 [F5 A5] 0.5
  [G5 B5] 2
}

pattern padChords = {
  [C4 E4 G4] 4    # Dó maior longo
  [A3 C4 E4] 4    # Lá menor longo
}

# === TRACKS PRINCIPAIS ===
track kickDrum {
  @kick
  loop 8 mainBeat
}

track snareDrum {
  @snare
  loop 8 snareHit  
}

track hiHats {
  @hihat
  loop 16 hihatGroove
}

track bassLine {
  @bass
  # Seção A (4x)
  loop 4 basslineMain
  # Seção B (2x) 
  loop 2 basslineBridge
  # Volta Seção A (2x)
  loop 2 basslineMain
}

track leadGuitar {
  @lead
  # Introdução (2x)
  loop 2 leadMelody
  # Variação (2x)  
  loop 2 leadHarmony
  # Solo final (4x)
  loop 4 leadMelody
}

track atmosphericPad {
  @pad
  slow    # Mais devagar para atmosfera
  loop 2 padChords
  fast    # Volta velocidade normal
}`}
                    </pre>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 text-primary">🎵 Outros Exemplos</h3>
                <div className="text-sm space-y-4">
                  <div className="bg-muted p-3 rounded">
                    <h4 className="font-medium mb-2">Rock Básico:</h4>
                    <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
{`track rockDrums {
  @kick
  loop 4 { C4 1 rest 1 C4 0.5 rest 0.5 C4 1 }
}

track rockBass {
  @bass
  loop 4 { E2 1 E2 1 G2 1 E2 1 }
}

track rockGuitar {
  @lead
  loop 2 { [E4 G4 B4] 2 [D4 F#4 A4] 2 }
}`}
                    </pre>
                  </div>

                  <div className="bg-muted p-3 rounded">
                    <h4 className="font-medium mb-2">Ambient/Chillout:</h4>
                    <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
{`track ambientPad {
  @pad
  slow
  [C4 E4 G4 B4] 8
  [A3 C4 E4 G4] 8
}

track subtleMelody {
  @lead
  slow
  C6 1 rest 2 E6 1
  rest 2 G6 2 rest 2
}

track deepBass {
  @bass
  C1 16    # Nota muito grave e longa
}`}
                    </pre>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg">
                <h4 className="font-medium mb-2 text-primary">💡 Dicas para Composição:</h4>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <div>• Use diferentes instrumentos para cada track</div>
                  <div>• Varie as durações para criar ritmo interessante</div>
                  <div>• Combine patterns para estruturar sua música</div>
                  <div>• Use controles mute/solo para testar tracks individuais</div>
                  <div>• Experimente com volumes diferentes para criar dinâmica</div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}