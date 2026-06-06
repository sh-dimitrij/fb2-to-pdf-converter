import { useRef } from 'react'
import { useDropZone } from '../hooks/useDropZone'
import styles from './DropZone.module.css'

export function DropZone({ onFiles, disabled }) {
  const inputRef = useRef(null)
  const { isDragging, onDragEnter, onDragLeave, onDragOver, onDrop } = useDropZone(onFiles)

  const handleInputChange = (e) => {
    const files = [...e.target.files]
    if (files.length) onFiles(files)
    e.target.value = ''
  }

  return (
    <div
      className={`${styles.zone} ${isDragging ? styles.dragging : ''} ${disabled ? styles.disabled : ''}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={disabled ? undefined : onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Загрузить файлы FB2"
      onKeyDown={e => e.key === 'Enter' && !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".fb2"
        multiple
        className={styles.input}
        onChange={handleInputChange}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
      />

      <div className={styles.icon}>
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="6" y="4" width="28" height="38" rx="3" strokeWidth="2" className={styles.docRect} />
          <path d="M28 4L38 14" strokeWidth="2" strokeLinecap="round" className={styles.docFold} />
          <path d="M28 4V14H38" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.docFold} />
          <path d="M24 28V20M24 20L20 24M24 20L28 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.arrow} />
        </svg>
      </div>

      <p className={styles.title}>
        {isDragging ? 'Отпустите файлы' : 'Перетащите файлы .fb2 сюда'}
      </p>
      <p className={styles.hint}>
        или <span className={styles.link}>нажмите для выбора</span> · поддерживается несколько файлов
      </p>
    </div>
  )
}
