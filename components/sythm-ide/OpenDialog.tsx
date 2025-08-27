'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FileText } from 'lucide-react'

interface OpenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoad: (fileName: string, content: string) => void
}

export function OpenDialog({ open, onOpenChange, onLoad }: OpenDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.name.endsWith('.sythm')) {
      setSelectedFile(file)
    } else {
      alert('Por favor, selecione um arquivo .sythm válido')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleLoad = async () => {
    if (!selectedFile) return

    setIsLoading(true)
    try {
      const content = await selectedFile.text()
      const fileName = selectedFile.name.replace('.sythm', '')
      onLoad(fileName, content)
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Erro ao carregar arquivo:', error)
      alert('Erro ao carregar o arquivo. Verifique se é um arquivo válido.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir Composição</DialogTitle>
          <DialogDescription>
            Selecione um arquivo .sythm para carregar sua composição musical.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="file-input">Arquivo .sythm</Label>
            <Input
              ref={fileInputRef}
              id="file-input"
              type="file"
              accept=".sythm"
              onChange={handleFileSelect}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
          </div>
          
          {selectedFile && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <FileText className="w-4 h-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button 
              onClick={handleLoad} 
              disabled={!selectedFile || isLoading}
            >
              {isLoading ? 'Carregando...' : 'Abrir'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}