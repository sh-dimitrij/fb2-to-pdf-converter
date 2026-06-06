import { useState, useCallback, useRef } from 'react'
import { parseFB2, decodeFB2 } from '../utils/fb2Parser'
import { generatePDF, safeName } from '../utils/pdfGenerator'

export const STATUS = {
  IDLE: 'idle',
  PARSING: 'parsing',
  GENERATING: 'generating',
  READY: 'ready',   // converted, blob ready, not yet downloaded
  DONE: 'done',     // downloaded
  ERROR: 'error',
}

export function useConverter() {
  const [items, setItems] = useState([])
  const [isConverting, setIsConverting] = useState(false)
  // All ready blobs: { id, blob, fileName, bookTitle }[]
  const blobsRef = useRef({})  // id -> { blob, fileName }

  const addFiles = useCallback((newFiles) => {
    setItems(prev => {
      const existing = new Set(prev.map(i => `${i.file.name}:${i.file.size}`))
      const toAdd = newFiles
        .filter(f => f.name.toLowerCase().endsWith('.fb2'))
        .filter(f => !existing.has(`${f.name}:${f.size}`))
        .map(f => ({ id: crypto.randomUUID(), file: f, status: STATUS.IDLE, progress: 0, bookTitle: null, error: null }))
      return [...prev, ...toAdd]
    })
  }, [])

  const removeItem = useCallback((id) => {
    setItems(prev => prev.filter(i => i.id !== id))
    delete blobsRef.current[id]
  }, [])

  const clearAll = useCallback(() => {
    setItems([])
    blobsRef.current = {}
  }, [])

  const updateItem = useCallback((id, patch) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }, [])

  const downloadItem = useCallback((id) => {
    const entry = blobsRef.current[id]
    if (!entry) return
    const url = URL.createObjectURL(entry.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = entry.fileName
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    updateItem(id, { status: STATUS.DONE })
  }, [updateItem])

  const downloadAll = useCallback(() => {
    Object.keys(blobsRef.current).forEach(id => downloadItem(id))
  }, [downloadItem])

  // Returns all READY items info for preview
  const getReadyItems = useCallback(() => {
    return Object.entries(blobsRef.current).map(([id, entry]) => ({ id, ...entry }))
  }, [])

  const convertAll = useCallback(async (options) => {
    const pending = items.filter(i => i.status === STATUS.IDLE || i.status === STATUS.ERROR)
    if (!pending.length || isConverting) return
    setIsConverting(true)

    for (const item of pending) {
      updateItem(item.id, { status: STATUS.PARSING, progress: 0, error: null })

      let book
      try {
        const buffer = await readFileAsBuffer(item.file)
        const xml = decodeFB2(buffer)
        book = parseFB2(xml)
        updateItem(item.id, { bookTitle: book.title, status: STATUS.GENERATING, progress: 5 })
      } catch (err) {
        updateItem(item.id, { status: STATUS.ERROR, error: `Ошибка разбора: ${err.message}` })
        continue
      }

      try {
        const pdf = await generatePDF(book, options, pct => updateItem(item.id, { progress: pct }))
        const blob = pdf.output('blob')
        const fileName = `${safeName(book.title)}.pdf`
        blobsRef.current[item.id] = { blob, fileName, bookTitle: book.title }
        updateItem(item.id, { status: STATUS.READY, progress: 100 })
      } catch (err) {
        updateItem(item.id, { status: STATUS.ERROR, error: `Ошибка генерации: ${err.message}` })
      }
    }

    setIsConverting(false)
  }, [items, isConverting, updateItem])

  return {
    items, isConverting,
    addFiles, removeItem, clearAll, convertAll,
    downloadItem, downloadAll, getReadyItems,
    blobsRef,
  }
}

function readFileAsBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsArrayBuffer(file)
  })
}
