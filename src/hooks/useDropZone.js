import { useState, useCallback, useRef } from 'react'

export function useDropZone(onFiles) {
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

  const onDragEnter = useCallback((e) => {
    e.preventDefault()
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const onDragLeave = useCallback((e) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const onDragOver = useCallback((e) => {
    e.preventDefault()
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    dragCounter.current = 0
    const files = [...e.dataTransfer.files]
    if (files.length) onFiles(files)
  }, [onFiles])

  return { isDragging, onDragEnter, onDragLeave, onDragOver, onDrop }
}

