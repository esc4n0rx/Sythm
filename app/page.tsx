'use client'

import { useState } from 'react'
import { Header } from '@/components/sythm-ide/Header'
import { CodeEditor } from '@/components/sythm-ide/CodeEditor'
import { ComponentsSidebar } from '@/components/sythm-ide/ComponentsSidebar'
import { SaveDialog } from '@/components/sythm-ide/SaveDialog'
import { UnsavedChangesDialog } from '@/components/sythm-ide/UnsavedChangesDialog'
import { HelpDialog } from '@/components/sythm-ide/HelpDialog'
import { useAudioContext } from '@/hooks/use-audio-context'
import { DEFAULT_CODE, NEW_COMPOSITION_CODE } from '@/lib/audio-utils'

export default function SythmIDE() {
  const [code, setCode] = useState(DEFAULT_CODE)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showHelpDialog, setShowHelpDialog] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)

  const { audioContext, executeCode, stopExecution } = useAudioContext()

  const handleNew = () => {
    if (code.trim() && code !== DEFAULT_CODE) {
      setShowUnsavedDialog(true)
    } else {
      setCode(NEW_COMPOSITION_CODE)
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

  const confirmNew = () => {
    setCode(NEW_COMPOSITION_CODE)
    setShowUnsavedDialog(false)
  }

  const handleAddComponent = (component: string) => {
    setCode((prevCode) => prevCode + component)
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground font-mono">
      <Header
        isPlaying={audioContext.isPlaying}
        bpm={audioContext.bpm}
        onNew={handleNew}
        onSave={() => setShowSaveDialog(true)}
        onExecute={() => executeCode(code)}
        onStop={stopExecution}
        onHelp={() => setShowHelpDialog(true)}
      />

      <div className="flex-1 flex">
        <CodeEditor code={code} onChange={setCode} />
        <ComponentsSidebar onAddComponent={handleAddComponent} />
      </div>

      <SaveDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={handleSave}
      />

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onConfirm={confirmNew}
      />

      <HelpDialog open={showHelpDialog} onOpenChange={setShowHelpDialog} />
    </div>
  )
}