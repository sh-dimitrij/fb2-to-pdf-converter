import { useEffect, useRef, useState, useCallback } from 'react'
import styles from './PdfPreview.module.css'

const PDFJS_VERSION = '4.9.155'
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`

let pdfjsCache = null
function getPdfjsLib() {
  if (pdfjsCache) return pdfjsCache
  pdfjsCache = (async () => {
    const mod = await import(/* @vite-ignore */ `${PDFJS_CDN}/pdf.min.mjs`)
    const lib = mod.default || mod
    lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.mjs`
    return lib
  })()
  return pdfjsCache
}

// Single PDF renderer — takes a blob, renders all pages as images
// Uses a render token to prevent stale renders from updating state
function usePdfRenderer(blob, scale) {
  const [pages, setPages] = useState([])
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const tokenRef = useRef(0)   // increment to cancel all previous renders
  const pdfDocRef = useRef(null)

  const render = useCallback(async (pdfDoc, renderScale, token) => {
    const result = []
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      if (tokenRef.current !== token) return  // cancelled
      try {
        const page = await pdfDoc.getPage(i)
        const vp = page.getViewport({ scale: renderScale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(vp.width)
        canvas.height = Math.floor(vp.height)
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
        if (tokenRef.current !== token) return  // cancelled after render
        result.push(canvas.toDataURL('image/jpeg', 0.88))
        setPages([...result])
      } catch {
        if (tokenRef.current !== token) return
        result.push(null)
        setPages([...result])
      }
    }
    if (tokenRef.current === token) setLoading(false)
  }, [])

  // Load new blob
  useEffect(() => {
    if (!blob) return
    // Invalidate all in-progress renders
    const token = ++tokenRef.current
    setError(null)
    setPages([])
    setTotalPages(0)
    setLoading(true)
    pdfDocRef.current = null
    ;(async () => {
      try {
        const lib = await getPdfjsLib()
        if (tokenRef.current !== token) return
        const buf = await blob.arrayBuffer()
        if (tokenRef.current !== token) return
        const doc = await lib.getDocument({ data: new Uint8Array(buf) }).promise
        if (tokenRef.current !== token) return
        pdfDocRef.current = doc
        setTotalPages(doc.numPages)
        await render(doc, scale, token)
      } catch (e) {
        if (tokenRef.current === token) { setError(e.message); setLoading(false) }
      }
    })()
    // Cleanup: invalidate on unmount or blob change
    return () => { tokenRef.current++ }
  }, [blob])

  // Re-render on scale change (only if doc is loaded)
  useEffect(() => {
    if (!pdfDocRef.current) return
    const token = ++tokenRef.current
    setPages([])
    setLoading(true)
    render(pdfDocRef.current, scale, token)
  }, [scale])

  return { pages, totalPages, loading, error }
}

/**
 * PdfPreview — multi-file preview with navigation
 *
 * Props:
 *   items: [{ id, blob, fileName, bookTitle }]  — all ready items
 *   initialIndex: number                         — which item to show first
 *   downloadedIds: Set<string>                   — already downloaded
 *   onDownload(id): download one file
 *   onDownloadAll(): download all
 *   onClose(): close modal
 */
export function PdfPreview({ items, initialIndex = 0, downloadedIds, onDownload, onDownloadAll, onClose }) {
  const [idx, setIdx] = useState(initialIndex)
  const [scale, setScale] = useState(1.2)

  const current = items[idx]
  const { pages, totalPages, loading, error } = usePdfRenderer(current?.blob, scale)

  // Keyboard nav
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && idx < items.length - 1) setIdx(i => i + 1)
      if (e.key === 'ArrowLeft'  && idx > 0)                setIdx(i => i - 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [idx, items.length, onClose])

  const onBackdrop = (e) => { if (e.target === e.currentTarget) onClose() }

  if (!current) return null

  const isDownloaded = downloadedIds?.has(current.id)
  const readyCount = items.length
  const downloadedCount = items.filter(it => downloadedIds?.has(it.id)).length

  return (
    <div className={styles.backdrop} onClick={onBackdrop}>
      <div className={styles.modal}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.title}>{current.bookTitle || current.fileName}</span>
            {totalPages > 0 && <span className={styles.pageCount}>{totalPages} стр.</span>}
            {isDownloaded && <span className={styles.downloadedBadge}>✓ Скачан</span>}
          </div>
          <div className={styles.headerRight}>
            {/* Zoom */}
            <div className={styles.zoomGroup}>
              <button className={styles.zoomBtn} onClick={() => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(1)))} disabled={loading}>−</button>
              <span className={styles.zoomLabel}>{Math.round(scale * 100)}%</span>
              <button className={styles.zoomBtn} onClick={() => setScale(s => Math.min(3.0, +(s + 0.2).toFixed(1)))} disabled={loading}>+</button>
            </div>
            <button className={styles.closeBtn} onClick={onClose} title="Закрыть (Esc)">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── File tabs (if multiple) ── */}
        {items.length > 1 && (
          <div className={styles.tabs}>
            {items.map((it, i) => (
              <button
                key={it.id}
                className={`${styles.tab} ${i === idx ? styles.tabActive : ''} ${downloadedIds?.has(it.id) ? styles.tabDone : ''}`}
                onClick={() => setIdx(i)}
              >
                {downloadedIds?.has(it.id) && <span className={styles.tabCheck}>✓</span>}
                {it.bookTitle || it.fileName}
              </button>
            ))}
          </div>
        )}

        {/* ── Body ── */}
        <div className={styles.body}>
          {loading && pages.length === 0 && (
            <div className={styles.loadingArea}>
              <div className={styles.spinner}/>
              <span>Рендеринг страниц…</span>
            </div>
          )}
          {error && <div className={styles.errorArea}>{error}</div>}
          {pages.length > 0 && (
            <div className={styles.pagesArea}>
              {pages.map((dataUrl, i) => (
                <div key={i} className={styles.pageWrapper}>
                  {dataUrl
                    ? <img src={dataUrl} className={styles.pageImg} alt={`Страница ${i + 1}`}/>
                    : <div className={styles.pageError}>Ошибка стр. {i + 1}</div>
                  }
                  <div className={styles.pageNum}>{i + 1}</div>
                </div>
              ))}
              {loading && (
                <div className={styles.renderingMore}>
                  <div className={styles.spinnerSmall}/> Рендеринг…
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className={styles.footer}>
          {/* Prev/Next navigation */}
          <div className={styles.navGroup}>
            <button className={styles.navBtn} onClick={() => setIdx(i => i - 1)} disabled={idx === 0}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Предыдущий
            </button>
            <span className={styles.navCounter}>{idx + 1} / {items.length}</span>
            <button className={styles.navBtn} onClick={() => setIdx(i => i + 1)} disabled={idx === items.length - 1}>
              Следующий
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>

          {/* Download actions */}
          <div className={styles.actionGroup}>
            <button
              className={`${styles.downloadOneBtn} ${isDownloaded ? styles.downloadedBtn : ''}`}
              onClick={() => onDownload(current.id)}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {isDownloaded ? 'Скачать снова' : 'Скачать этот файл'}
            </button>

            {items.length > 1 && (
              <button className={styles.downloadAllBtn} onClick={onDownloadAll}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Скачать все ({readyCount})
                {downloadedCount > 0 && ` · ${downloadedCount} скачано`}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
