'use client'

import { useState } from 'react'
import { Header } from '@/components/sythm-ide/Header'
import { CodeEditor } from '@/components/sythm-ide/CodeEditor'
import { ComponentsSidebar } from '@/components/sythm-ide/ComponentsSidebar'
import { TrackMixer } from '@/components/sythm-ide/TrackMixer'
import { SaveDialog } from '@/components/sythm-ide/SaveDialog'
import { OpenDialog } from '@/components/sythm-ide/OpenDialog'
import { UnsavedChangesDialog } from '@/components/sythm-ide/UnsavedChangesDialog'
import { HelpDialog } from '@/components/sythm-ide/HelpDialog'
import { useAudioContext } from '@/hooks/use-audio-context'
import { DEFAULT_CODE, NEW_COMPOSITION_CODE } from '@/lib/audio-utils'
import type { InstrumentType } from '@/types/instruments'

// Código exemplo para multitrack
const MULTITRACK_EXAMPLE = `# Exemplo de Sequencer Multitrack
# Define patterns reutilizáveis
pattern beat = {
  kick 1
  rest 1
  snare 1
  rest 1
}

pattern bassline = {
  C2 1
  rest 1
  G2 1
  rest 1
}

# Define tracks independentes
track drums {
  @kick
  loop 4 beat
}

track bass {
  @bass
  loop 4 bassline
}

track lead {
  @lead
  loop 2 {
    C4 0.5 D4 0.5 E4 1
    F4 0.5 G4 0.5 A4 1
  }
}`

export default function SythmIDE() {
  const [code, setCode] = useState(DEFAULT_CODE)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showOpenDialog, setShowOpenDialog] = useState(false)
  const [showHelpDialog, setShowHelpDialog] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingAction, setPendingAction] = useState<'new' | 'open' | null>(null)
  const [pendingFileData, setPendingFileData] = useState<{fileName: string, content: string} | null>(null)

  const { 
    audioContext, 
    currentInstrument, 
    multiTrackState,
    isMultiTrackMode,
    executeCode, 
    stopExecution, 
    updateBPM, 
    changeInstrument,
    muteTrack,
    unmuteTrack,
    soloTrack,
    unsoloTrack,
    setTrackVolume,
    getState 
  } = useAudioContext()

  const hasUnsavedChanges = (currentCode: string) => {
    return currentCode.trim() && currentCode !== DEFAULT_CODE && currentCode !== NEW_COMPOSITION_CODE && currentCode !== MULTITRACK_EXAMPLE
  }

  const handleNew = () => {
    if (hasUnsavedChanges(code)) {
      setPendingAction('new')
      setShowUnsavedDialog(true)
    } else {
      setCode(NEW_COMPOSITION_CODE)
    }
  }

  const handleMultiTrackExample = () => {
    if (hasUnsavedChanges(code)) {
      alert('Salve suas alterações antes de carregar o exemplo')
      return
    }
    setCode(MULTITRACK_EXAMPLE)
  }

  const handleOpen = () => {
    if (hasUnsavedChanges(code)) {
      setPendingAction('open')
      setShowUnsavedDialog(true)
    } else {
      setShowOpenDialog(true)
    }
  }

  const handleFileLoad = (fileName: string, content: string) => {
    if (hasUnsavedChanges(code)) {
      setPendingFileData({ fileName, content })
      setShowUnsavedDialog(true)
    } else {
      setCode(content)
    }
    setShowOpenDialog(false)
  }

  const handleUnsavedConfirm = (action: 'save' | 'discard') => {
    if (action === 'save') {
      setShowSaveDialog(true)
      setShowUnsavedDialog(false)
      return
    }

    // Discard changes
    setShowUnsavedDialog(false)
    
    if (pendingAction === 'new') {
      setCode(NEW_COMPOSITION_CODE)
    } else if (pendingAction === 'open') {
      setShowOpenDialog(true)
    } else if (pendingFileData) {
      setCode(pendingFileData.content)
      setPendingFileData(null)
    }
    
    setPendingAction(null)
  }

  const handleAddComponent = (component: string) => {
    const newCode = code + (code.endsWith('\n') || !code ? '' : '\n') + component
    setCode(newCode)
  }

  // Função para executar o código
  const handleExecute = async () => {
    try {
      await executeCode(code)
    } catch (error) {
      console.error('Erro ao executar código:', error)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header
        onNew={handleNew}
        onOpen={handleOpen}
        onSave={() => setShowSaveDialog(true)}
        onHelp={() => setShowHelpDialog(true)}
        isPlaying={audioContext.isPlaying}
        bpm={audioContext.bpm}
        onExecute={handleExecute} // Corrigido: era onPlay antes
        onStop={stopExecution}
        onBPMChange={updateBPM}
      />
      
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <CodeEditor
            code={code}
            onChange={setCode}
          />
        </div>
        
        <div className="w-80 bg-card border-l border-border overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Mixer multitrack */}
            {isMultiTrackMode && (
              <TrackMixer
                multiTrackState={multiTrackState}
                isPlaying={audioContext.isPlaying}
                onPlay={handleExecute} // Corrigido: usar handleExecute
                onStop={stopExecution}
                onTrackMute={muteTrack}
                onTrackUnmute={unmuteTrack}
                onTrackSolo={soloTrack}
                onTrackUnsolo={unsoloTrack}
                onTrackVolumeChange={setTrackVolume}
                onReset={() => {
                  stopExecution()
                  // Aqui poderia resetar estados das tracks
                }}
              />
            )}
            
            {/* Sidebar de componentes */}
            <ComponentsSidebar
              onAddComponent={handleAddComponent}
              currentInstrument={currentInstrument}
              onInstrumentChange={changeInstrument}
            />
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <SaveDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        code={code}
      />

      <OpenDialog
        isOpen={showOpenDialog}
        onClose={() => setShowOpenDialog(false)}
        onFileLoad={handleFileLoad}
      />

      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        onClose={() => setShowUnsavedDialog(false)}
        onConfirm={handleUnsavedConfirm}
      />

      <HelpDialog
        isOpen={showHelpDialog}
        onClose={() => setShowHelpDialog(false)}
      />
    </div>
  )
}