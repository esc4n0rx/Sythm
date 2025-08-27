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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ajuda - Sythm IDE</DialogTitle>
          <DialogDescription>Guia de referência para programação musical</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div>
            <h3 className="font-semibold mb-2">Comandos Básicos</h3>
            <div className="space-y-2 text-sm">
              <div>
                <code className="bg-muted px-2 py-1 rounded">note("C4", 1)</code> - Toca a nota C4 por 1 tempo
              </div>
              <div>
                <code className="bg-muted px-2 py-1 rounded">bass("C2", 4)</code> - Toca baixo C2 por 4 tempos
              </div>
              <div>
                <code className="bg-muted px-2 py-1 rounded">drums("kick", 1, 3)</code> - Kick nos tempos 1 e 3
              </div>
              <div>
                <code className="bg-muted px-2 py-1 rounded">synth("C4 E4 G4", 2)</code> - Acorde Dó maior por 2
                tempos
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Notas Musicais</h3>
            <p className="text-sm text-muted-foreground">
              Use notação padrão: C, D, E, F, G, A, B com oitavas (C4, A4, etc.) Sustenidos: C#, D#, F#, G#, A#
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Controles</h3>
            <div className="space-y-1 text-sm">
              <div>
                <strong>Novo:</strong> Cria nova composição
              </div>
              <div>
                <strong>Salvar:</strong> Salva como arquivo .sythm
              </div>
              <div>
                <strong>Executar:</strong> Reproduz o código musical
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}