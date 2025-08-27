"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Play, Square, HelpCircle, Music, Drum, Zap } from "lucide-react"

interface AudioContextType {
  context: AudioContext | null
  isPlaying: boolean
  bpm: number
}

const MUSICAL_KEYWORDS = [
  "bass",
  "drums",
  "synth",
  "note",
  "chord",
  "melody",
  "rhythm",
  "beat",
  "C",
  "D",
  "E",
  "F",
  "G",
  "A",
  "B",
  "C#",
  "D#",
  "F#",
  "G#",
  "A#",
]

const COMPONENTS = [
  {
    title: "Notes",
    description: "Basic note generation and sequencing",
    icon: Music,
    subcomponents: ["note()", "chord()", "scale()"],
  },
  {
    title: "Bass",
    description: "Low-frequency bass lines and patterns",
    icon: Music,
    subcomponents: ["bass()", "bassline()", "subbass()"],
  },
  {
    title: "Drums",
    description: "Percussion and rhythm patterns",
    icon: Drum,
    subcomponents: ["kick()", "snare()", "hihat()", "pattern()"],
  },
  {
    title: "Synth",
    description: "Synthesizer sounds and effects",
    icon: Zap,
    subcomponents: ["synth()", "lead()", "pad()", "arp()"],
  },
  {
    title: "FX",
    description: "Audio effects and processing",
    icon: Zap,
    subcomponents: ["reverb()", "delay()", "filter()", "distortion()"],
  },
]

export default function SythmIDE() {
  const [code, setCode] = useState(`// Welcome to Sythm - Musical Code Editor
bass("C2", 4)
drums("kick", 1, 3)
synth("C4 E4 G4", 2)
note("A4", 0.5)  // Quarter note A4`)

  const [fileName, setFileName] = useState("")
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showHelpDialog, setShowHelpDialog] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [audioContext, setAudioContext] = useState<AudioContextType>({
    context: null,
    isPlaying: false,
    bpm: 120,
  })

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Initialize Web Audio Context
    if (typeof window !== "undefined") {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)()
      setAudioContext((prev) => ({ ...prev, context }))
    }
  }, [])

  const highlightSyntax = (text: string) => {
    return text
  }

  const playNote = (frequency: number, duration = 0.5) => {
    if (!audioContext.context) return

    const oscillator = audioContext.context.createOscillator()
    const gainNode = audioContext.context.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.context.destination)

    oscillator.frequency.setValueAtTime(frequency, audioContext.context.currentTime)
    oscillator.type = "sine"

    gainNode.gain.setValueAtTime(0.3, audioContext.context.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.context.currentTime + duration)

    oscillator.start(audioContext.context.currentTime)
    oscillator.stop(audioContext.context.currentTime + duration)
  }

  const executeCode = () => {
    if (!audioContext.context) return

    setAudioContext((prev) => ({ ...prev, isPlaying: true }))

    // Simple code execution - play some basic notes
    const lines = code.split("\n").filter((line) => line.trim() && !line.trim().startsWith("//"))

    lines.forEach((line, index) => {
      setTimeout(() => {
        if (line.includes('note("C4"') || line.includes('note("A4"')) {
          playNote(440) // A4
        } else if (line.includes("bass(")) {
          playNote(130) // C3
        } else if (line.includes("synth(")) {
          playNote(523) // C5
        }
      }, index * 500)
    })

    setTimeout(
      () => {
        setAudioContext((prev) => ({ ...prev, isPlaying: false }))
      },
      lines.length * 500 + 1000,
    )
  }

  const stopExecution = () => {
    setAudioContext((prev) => ({ ...prev, isPlaying: false }))
  }

  const handleNew = () => {
    if (
      code.trim() &&
      code !==
        `// Welcome to Sythm - Musical Code Editor
bass("C2", 4)
drums("kick", 1, 3)
synth("C4 E4 G4", 2)
note("A4", 0.5)`
    ) {
      setShowUnsavedDialog(true)
    } else {
      setCode(`// New Sythm composition
`)
    }
  }

  const handleSave = () => {
    if (!fileName.trim()) {
      setShowSaveDialog(true)
      return
    }

    const blob = new Blob([code], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${fileName}.sythm`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setShowSaveDialog(false)
  }

  const confirmNew = () => {
    setCode(`// New Sythm composition
// Start creating your musical code here:

`)
    setShowUnsavedDialog(false)
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground font-mono">
      {/* Header */}
      <header className="bg-sidebar border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-primary">Sythm</h1>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleNew}>
              Novo
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowSaveDialog(true)}>
              Salvar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={audioContext.isPlaying ? stopExecution : executeCode}
              className="flex items-center gap-2"
            >
              {audioContext.isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {audioContext.isPlaying ? "Parar" : "Executar"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowHelpDialog(true)}>
              <HelpCircle className="w-4 h-4 mr-2" />
              Ajuda
            </Button>
          </nav>
        </div>
        <div className="text-sm text-muted-foreground">BPM: {audioContext.bpm}</div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Code Editor */}
        <div className="flex-1 p-4">
          <div className="h-full bg-card rounded-lg border border-border overflow-hidden">
            <div className="h-full relative">
              <Textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-full w-full bg-transparent border-0 resize-none font-mono text-sm leading-6 p-4 focus:ring-0"
                placeholder="// Start coding your music here..."
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                style={{
                  background: "transparent",
                  color: "transparent",
                  caretColor: "#ffffff",
                }}
              />
              <div
                className="absolute inset-0 p-4 pointer-events-none font-mono text-sm leading-6 whitespace-pre-wrap text-foreground"
                style={{
                  background: "transparent",
                  color: "#e2e8f0", // Default text color
                }}
              >
                {code.split("\n").map((line, index) => (
                  <div key={index} className="leading-6">
                    {line
                      .split(
                        /(\b(?:bass|drums|synth|note|chord|melody|rhythm|beat|C|D|E|F|G|A|B|C#|D#|F#|G#|A#)\b|"[^"]*"|\b\d+\.?\d*\b|\/\/.*$)/g,
                      )
                      .map((part, partIndex) => {
                        if (
                          /\b(?:bass|drums|synth|note|chord|melody|rhythm|beat|C|D|E|F|G|A|B|C#|D#|F#|G#|A#)\b/.test(
                            part,
                          )
                        ) {
                          return (
                            <span key={partIndex} style={{ color: "#60a5fa", fontWeight: 600 }}>
                              {part}
                            </span>
                          )
                        } else if (/^"[^"]*"$/.test(part)) {
                          return (
                            <span key={partIndex} style={{ color: "#4ade80" }}>
                              {part}
                            </span>
                          )
                        } else if (/^\b\d+\.?\d*\b$/.test(part)) {
                          return (
                            <span key={partIndex} style={{ color: "#facc15" }}>
                              {part}
                            </span>
                          )
                        } else if (/^\/\/.*$/.test(part)) {
                          return (
                            <span key={partIndex} style={{ color: "#6b7280", fontStyle: "italic" }}>
                              {part}
                            </span>
                          )
                        }
                        return <span key={partIndex}>{part}</span>
                      })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Components */}
        <div className="w-80 p-4 bg-sidebar border-l border-border">
          <h2 className="text-lg font-semibold mb-4 text-sidebar-foreground">Componentes</h2>
          <div className="space-y-3">
            {COMPONENTS.map((component, index) => (
              <Card key={index} className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <component.icon className="w-4 h-4 text-primary" />
                    {component.title}
                  </CardTitle>
                  <CardDescription className="text-xs">{component.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-1">
                    {component.subcomponents.map((sub, subIndex) => (
                      <code
                        key={subIndex}
                        className="text-xs bg-muted px-2 py-1 rounded text-primary cursor-pointer hover:bg-accent"
                        onClick={() => {
                          const newCode = code + "\n" + sub
                          setCode(newCode)
                        }}
                      >
                        {sub}
                      </code>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Composição</DialogTitle>
            <DialogDescription>Digite um nome para sua composição musical.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="filename">Nome do arquivo</Label>
              <Input
                id="filename"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="minha-composicao"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Dialog */}
      <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterações não salvas</DialogTitle>
            <DialogDescription>Você tem alterações não salvas. Deseja continuar sem salvar?</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowUnsavedDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmNew}>Continuar sem salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Help Dialog */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
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
    </div>
  )
}
