import { useState, useEffect, useRef } from 'react'
import { useConverter, STATUS } from './hooks/useConverter'
import { Header } from './components/Header'
import { DropZone } from './components/DropZone'
import { FileList } from './components/FileList'
import { ConversionOptions } from './components/ConversionOptions'
import { ConvertButton } from './components/ConvertButton'
import { HowItWorks } from './components/HowItWorks'
import { PdfPreview } from './components/PdfPreview'
import './index.css'
import styles from './App.module.css'

const DEFAULT_OPTIONS = {
  pageSize: 'a4',
  fontSize: 15,
  margin: 25,
  lineHeight: '1.3',
  includeCover: true,
  includeTOC: true,
  includeAnnotation: true,
}

export default function App() {
  const [options, setOptions] = useState(DEFAULT_OPTIONS)
  const [showPreview, setShowPreview] = useState(true) 
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)        // текущий файл в превью
  const [downloadedIds, setDownloadedIds] = useState(new Set())
  const prevReadyCount = useRef(0)

  const {
    items, isConverting,
    addFiles, removeItem, clearAll, convertAll,
    downloadItem, downloadAll, getReadyItems, blobsRef,
  } = useConverter()

  const handleConvert = () => {
    convertAll({ ...options, lineHeight: parseFloat(options.lineHeight) })
  }

  // Watch for newly READY items — auto-open preview or auto-download
  useEffect(() => {
    const readyItems = getReadyItems()
    const newReady = readyItems.length
    if (newReady === 0 || isConverting) return

    // Check if all pending are done (no more PARSING/GENERATING)
    const stillProcessing = items.some(
      i => i.status === STATUS.PARSING || i.status === STATUS.GENERATING
    )
    if (stillProcessing) return

    if (newReady > prevReadyCount.current) {
      prevReadyCount.current = newReady
      if (showPreview) {
        // Open preview at first undownloaded file
        const firstNew = readyItems.findIndex(it => !downloadedIds.has(it.id))
        setPreviewIndex(Math.max(0, firstNew))
        setPreviewOpen(true)
      } else {
        // Auto-download all newly ready files
        readyItems.forEach(it => {
          if (!downloadedIds.has(it.id)) {
            handleDownload(it.id)
          }
        })
      }
    }
  }, [items, isConverting, showPreview])

  // Reset counter when items cleared
  useEffect(() => {
    if (items.length === 0) prevReadyCount.current = 0
  }, [items.length])

  const handleDownload = (id) => {
    downloadItem(id)
    setDownloadedIds(prev => new Set([...prev, id]))
  }

  const handleDownloadAll = () => {
    getReadyItems().forEach(it => handleDownload(it.id))
  }

  const handleClosePreview = () => setPreviewOpen(false)

  // FileList preview button — open modal at that specific file
  const handleOpenPreview = (itemId) => {
    const readyItems = getReadyItems()
    const idx = readyItems.findIndex(it => it.id === itemId)
    if (idx >= 0) {
      setPreviewIndex(idx)
      setPreviewOpen(true)
    }
  }

  const readyItems = getReadyItems()

  return (
    <>
      <Header />
      <main className={styles.main}>
        <DropZone onFiles={addFiles} disabled={false} />
        <FileList
          items={items}
          onRemove={removeItem}
          onClearAll={clearAll}
          onPreview={handleOpenPreview}
          downloadedIds={downloadedIds}
        />
        <ConversionOptions
          options={options}
          onChange={setOptions}
          disabled={isConverting}
          showPreview={showPreview}
          onTogglePreview={setShowPreview}
        />
        <ConvertButton items={items} isConverting={isConverting} onClick={handleConvert} />
        <HowItWorks />
      </main>
      <footer className={styles.footer}>
        Обработка происходит полностью в браузере — файлы не покидают ваше устройство.
        &nbsp;&nbsp;
        <a href="https://github.com/sh-dimitrij/fb2-to-pdf-converter" target="_blank" rel="noreferrer">GitHub</a>
      </footer>

      {previewOpen && readyItems.length > 0 && (
        <PdfPreview
          items={readyItems}
          initialIndex={previewIndex}
          downloadedIds={downloadedIds}
          onDownload={handleDownload}
          onDownloadAll={handleDownloadAll}
          onClose={handleClosePreview}
        />
      )}
    </>
  )
}
