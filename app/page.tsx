'use client'

import { useState } from 'react'
import { Header } from '@/components/sythm-ide/Header'
import { CodeEditor } from '@/components/sythm-ide/CodeEditor'
import { ComponentsSidebar } from '@/components/sythm-ide/ComponentsSidebar'
import { SaveDialog } from '@/components/sythm-ide/SaveDialog'
import { OpenDialog } from '@/components/sythm-ide/OpenDialog'
import { UnsavedChangesDialog } from '@/components/sythm-ide/UnsavedChangesDialog'
import { HelpDialog } from '@/components/sythm-ide/HelpDialog'
import { useAudioContext } from '@/hooks/use-audio-context'
import { DEFAULT_CODE, NEW_COMPOSITION_CODE } from '@/lib/audio-utils'

export default function SythmIDE() {
  const [code, setCode] = useState(DEFAULT_CODE)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showOpenDialog, setShowOpenDialog] = useState(false)
  const [showHelpDialog, setShowHelpDialog] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingAction, setPendingAction] = useState<'new' | 'open' | null>(null)
  const [pendingFileData, setPendingFileData] = useState<{fileName: string, content: string} | null>(null)

  const { audioContext, currentExecutingLine, executeCode, stopExecution, updateBPM, getState } = useAudioContext()

  const hasUnsavedChanges = (currentCode: string) => {
    return currentCode.trim() && currentCode !== DEFAULT_CODE && currentCode !== NEW_COMPOSITION_CODE
  }

  const handleNew = () => {
    if (hasUnsavedChanges(code)) {
      setPendingAction('new')
      setShowUnsavedDialog(true)
    } else {
      setCode(NEW_COMPOSITION_CODE)
    }
  }

  const handleOpen = () => {
    if (hasUnsavedChanges(code)) {
      setPendingAction('open')
      setShowUnsavedDialog(true)
    } else {
      setShowOpenDialog(true)
    }
  }

  const handleSave = (fileName: string) => {
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName}.sythm`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setShowSaveDialog(false)
  }

  const handleLoad = (fileName: string, content: string) => {
    if (hasUnsavedChanges(code)) {
      setPendingFileData({ fileName, content })
      setPendingAction('open')
      setShowOpenDialog(false)
      setShowUnsavedDialog(true)
    } else {
      setCode(content)
      setShowOpenDialog(false)
      console.log(`Arquivo ${fileName}.sythm carregado com sucesso`)
    }
  }

  const confirmUnsavedAction = () => {
    if (pendingAction === 'new') {
      setCode(NEW_COMPOSITION_CODE)
    } else if (pendingAction === 'open') {
      if (pendingFileData) {
        setCode(pendingFileData.content)
        console.log(`Arquivo ${pendingFileData.fileName}.sythm carregado com sucesso`)
        setPendingFileData(null)
      } else {
        setShowOpenDialog(true)
      }
    }
    
    setPendingAction(null)
    setShowUnsavedDialog(false)
  }

  const cancelUnsavedAction = () => {
    setPendingAction(null)
    setPendingFileData(null)
    setShowUnsavedDialog(false)
  }

  const handleAddComponent = (component: string) => {
    setCode((prevCode) => prevCode + component)
  }

  const handleExecute = () => {
    executeCode(code)
  }

  const handleBPMChange = (newBpm: number) => {
    updateBPM(newBpm)
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground font-mono">
      <Header
        isPlaying={audioContext.isPlaying}
        bpm={audioContext.bpm}
        onNew={handleNew}
        onOpen={handleOpen}
        onSave={() => setShowSaveDialog(true)}
        onExecute={handleExecute}
        onStop={stopExecution}
        onHelp={() => setShowHelpDialog(true)}
        onBPMChange={handleBPMChange}
      />

      <div className="flex-1 flex">
        <CodeEditor 
          code={code} 
          onChange={setCode} 
          currentExecutingLine={currentExecutingLine}
        />
        <ComponentsSidebar onAddComponent={handleAddComponent} />
      </div>

      <SaveDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={handleSave}
      />

      <OpenDialog
        open={showOpenDialog}
        onOpenChange={setShowOpenDialog}
        onLoad={handleLoad}
      />

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={cancelUnsavedAction}
        onConfirm={confirmUnsavedAction}
      />

      <HelpDialog open={showHelpDialog} onOpenChange={setShowHelpDialog} />
    </div>
  )
}