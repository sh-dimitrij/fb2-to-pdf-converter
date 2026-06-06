import { jsPDF } from 'jspdf'
import { fonts as fontData } from './fonts'

// ─── Font registration ────────────────────────────────────────────────────────
let fontsRegistered = false
function ensureFonts(pdf) {
  if (fontsRegistered) return
  const variants = [
    { key: 'LiberationSerif-Regular',    style: 'normal' },
    { key: 'LiberationSerif-Bold',       style: 'bold' },
    { key: 'LiberationSerif-Italic',     style: 'italic' },
    { key: 'LiberationSerif-BoldItalic', style: 'bolditalic' },
  ]
  for (const { key, style } of variants) {
    pdf.addFileToVFS(`${key}.ttf`, fontData[key])
    pdf.addFont(`${key}.ttf`, 'LiberationSerif', style)
  }
  fontsRegistered = true
}

const FONT = 'LiberationSerif'
const PAGE_SIZES = { a4: [210, 297], a5: [148, 210], letter: [215.9, 279.4] }

// ─── Plain text writer (for headings, captions, non-body text) ───────────────
function writeText(pdf, text, x, maxW, y, opts, fontStyle, fontSize, align = 'left') {
  const { margin, lineHeight, pageH } = opts
  const fs = fontSize || opts.fontSize
  if (!text.trim()) return y
  pdf.setFont(FONT, fontStyle)
  pdf.setFontSize(fs)
  pdf.setTextColor(0, 0, 0)
  const lh = (fs / 72) * 25.4 * lineHeight
  const lines = pdf.splitTextToSize(text, maxW)
  for (const line of lines) {
    if (y + lh > pageH - margin) { pdf.addPage(); y = margin }
    if (align === 'center') pdf.text(line, x + maxW / 2, y, { align: 'center' })
    else pdf.text(line, x, y)
    y += lh
  }
  return y
}

// ─── Justified paragraph with inline spans (bold/italic per word) ─────────────
// Renders a paragraph with first-line indent, justified text, inline formatting.
function writeParagraph(pdf, spans, x, maxW, y, opts, firstLineIndent = 0) {
  const { margin, lineHeight, pageH } = opts
  const fs = opts.fontSize
  const lh = (fs / 72) * 25.4 * lineHeight
  pdf.setTextColor(0, 0, 0)

  // 1. Tokenize spans into words with style tags
  // Each token: { word: string, bold: bool, italic: bool, space: bool }
  const tokens = []
  for (const span of spans) {
    if (!span.text) continue
    // Split on spaces but keep track of trailing space
    const parts = span.text.split(/(\s+)/)
    for (const part of parts) {
      if (!part) continue
      if (/^\s+$/.test(part)) {
        // space — attach to previous token or create space token
        if (tokens.length > 0) tokens[tokens.length - 1].trailingSpace = true
        else tokens.push({ word: '', bold: span.bold, italic: span.italic, trailingSpace: true })
      } else {
        tokens.push({ word: part, bold: span.bold, italic: span.italic, trailingSpace: false })
      }
    }
  }
  if (!tokens.length) return y

  // 2. Measure word widths (need to set font for each)
  function wordWidth(token) {
    const style = token.bold && token.italic ? 'bolditalic' : token.bold ? 'bold' : token.italic ? 'italic' : 'normal'
    pdf.setFont(FONT, style)
    pdf.setFontSize(fs)
    return pdf.getTextWidth(token.word)
  }
  function spaceWidth() {
    pdf.setFont(FONT, 'normal')
    pdf.setFontSize(fs)
    return pdf.getTextWidth(' ')
  }
  const spW = spaceWidth()

  // 3. Line-break into lines respecting maxW and first-line indent
  const lines = []    // each line: [{token, w}]
  let currentLine = []
  let currentW = 0
  let isFirstLine = true
  let lineMaxW = maxW - firstLineIndent

  for (let ti = 0; ti < tokens.length; ti++) {
    const token = tokens[ti]
    const w = wordWidth(token)
    const needSpace = currentLine.length > 0 ? spW : 0

    if (currentLine.length > 0 && currentW + needSpace + w > lineMaxW + 0.01) {
      // wrap
      lines.push({ items: currentLine, isFirst: isFirstLine })
      currentLine = []
      currentW = 0
      isFirstLine = false
      lineMaxW = maxW
    }
    currentLine.push({ token, w })
    currentW += (currentLine.length > 1 ? spW : 0) + w
  }
  if (currentLine.length > 0) lines.push({ items: currentLine, isFirst: isFirstLine })

  // 4. Render lines
  for (let li = 0; li < lines.length; li++) {
    if (y + lh > pageH - margin) { pdf.addPage(); y = margin }

    const { items, isFirst } = lines[li]
    const isLastLine = li === lines.length - 1
    const lineX = x + (isFirst ? firstLineIndent : 0)
    const availW = isFirst ? maxW - firstLineIndent : maxW

    // Calculate justified gap
    let gap = spW
    if (!isLastLine && items.length > 1) {
      const totalWordW = items.reduce((a, it) => a + it.w, 0)
      gap = (availW - totalWordW) / (items.length - 1)
    }

    let cx = lineX
    for (let ii = 0; ii < items.length; ii++) {
      const { token, w } = items[ii]
      const style = token.bold && token.italic ? 'bolditalic'
        : token.bold ? 'bold'
        : token.italic ? 'italic'
        : 'normal'
      pdf.setFont(FONT, style)
      pdf.setFontSize(fs)
      pdf.setTextColor(0, 0, 0)
      pdf.text(token.word, cx, y)
      cx += w + (ii < items.length - 1 ? gap : 0)
    }
    y += lh
  }
  return y
}

// ─── PDF named destinations (bookmarks / anchors) ────────────────────────────
// jsPDF supports outline items via internal API
function addBookmark(pdf, title, y) {
  // jsPDF outline
  pdf.outline.add(null, title, { pageNumber: pdf.internal.getCurrentPageInfo().pageNumber, y })
}

// ─── Chapter header box ───────────────────────────────────────────────────────
function drawChapterBox(pdf, text, opts) {
  const { margin, lineHeight, pageW } = opts
  const usableW = pageW - margin * 2
  const fs = opts.chapterFontSize   // 16–18pt
  pdf.setFont(FONT, 'bold')
  pdf.setFontSize(fs)
  const lh = (fs / 72) * 25.4 * lineHeight
  const lines = pdf.splitTextToSize(text, usableW - 6)
  const boxH = lh * lines.length + 8

  pdf.setFillColor(235, 235, 235)
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.4)
  pdf.rect(margin, margin, usableW, boxH, 'FD')

  // Named destination for internal linking
  const pageNum = pdf.internal.getCurrentPageInfo().pageNumber
  pdf.link(margin, margin, usableW, boxH, { pageNumber: pageNum, x: margin, y: margin })

  let ty = margin + 5 + lh * 0.75
  pdf.setTextColor(0, 0, 0)
  for (const line of lines) {
    pdf.text(line, margin + 4, ty)
    ty += lh
  }

  return { yAfter: margin + boxH + lh * 0.8, boxTop: margin, boxH, pageNum }
}

// ─── TOC collection ───────────────────────────────────────────────────────────
function collectTOC(sections) {
  const entries = []
  function walk(sec, depth) {
    if (sec.titleSpans) {
      const title = spansText(sec.titleSpans).trim()
      if (title) entries.push({ title, depth, pageRef: null /* filled later */ })
    }
    for (const b of sec.blocks)
      if (b.type === 'section') walk(b.section, depth + 1)
  }
  sections.forEach(s => walk(s, 0))
  return entries
}

function spansText(spans) {
  return spans ? spans.map(s => s.text).join('') : ''
}

// ─── Block renderer ───────────────────────────────────────────────────────────
async function renderBlocks(pdf, blocks, opts, state) {
  const { margin, fontSize, lineHeight, pageW, pageH, images } = opts
  const usableW = pageW - margin * 2
  const lh = (fontSize / 72) * 25.4 * lineHeight
  const textX = margin          // text starts at margin (no extra left shift)
  const textW = usableW         // full usable width
  const paraIndent = (fontSize / 72) * 25.4 * 1.8  // first-line indent ~1.8em

  function checkPage(needed) {
    if (state.y + needed > pageH - margin) { pdf.addPage(); state.y = margin }
  }

  for (const block of blocks) {
    if (block.type === 'p') {
      if (!spansText(block.spans).trim()) continue
      checkPage(lh)
      // writeParagraph handles first-line indent + justified text + inline bold/italic
      state.y = writeParagraph(pdf, block.spans, textX, textW, state.y, opts, paraIndent)

    } else if (block.type === 'empty-line') {
      // * * * centred separator
      state.y += lh * 0.4
      checkPage(lh * 2)
      pdf.setFont(FONT, 'normal')
      pdf.setFontSize(fontSize)
      pdf.setTextColor(0, 0, 0)
      pdf.text('* * *', margin + usableW / 2, state.y, { align: 'center' })
      state.y += lh * 1.0

    } else if (block.type === 'subtitle') {
      const text = spansText(block.spans).trim()
      if (!text) continue
      state.y += lh * 0.4
      checkPage(lh)
      state.y = writeText(pdf, text, textX, textW, state.y, opts, 'bold', null, 'left')
      state.y += lh * 0.2

    } else if (block.type === 'epigraph') {
      state.y += lh * 0.5
      const xOff = usableW * 0.4
      for (const line of block.lines) {
        const text = spansText(line).trim()
        if (text) { checkPage(lh); state.y = writeParagraph(pdf, line, margin + xOff, usableW - xOff, state.y, opts, 0) }
      }
      if (block.author) {
        const text = spansText(block.author).trim()
        if (text) { checkPage(lh); state.y = writeText(pdf, `— ${text}`, margin + xOff, usableW - xOff, state.y, opts, 'italic', opts.fontSize - 1, 'left') }
      }
      state.y += lh * 0.5

    } else if (block.type === 'poem') {
      state.y += lh * 0.5
      if (block.title) {
        const text = spansText(block.title).trim()
        if (text) { checkPage(lh); state.y = writeText(pdf, text, margin + usableW * 0.1, usableW * 0.9, state.y, opts, 'bold', null, 'left') }
      }
      for (const stanza of block.stanzas) {
        for (const line of stanza) {
          const text = spansText(line).trim()
          if (text) { checkPage(lh); state.y = writeParagraph(pdf, line, margin + usableW * 0.1, usableW * 0.9, state.y, opts, 0) }
        }
        state.y += lh * 0.4
      }
      state.y += lh * 0.5

    } else if (block.type === 'cite') {
      state.y += lh * 0.3
      const citeX = margin + 6, citeW = usableW - 12
      for (const line of block.lines) {
        const text = spansText(line).trim()
        if (text) { checkPage(lh); state.y = writeParagraph(pdf, line, citeX, citeW, state.y, opts, 0) }
      }
      if (block.author) {
        const text = spansText(block.author).trim()
        if (text) { checkPage(lh); state.y = writeText(pdf, `— ${text}`, citeX, citeW, state.y, opts, 'italic', opts.fontSize - 1, 'left') }
      }
      state.y += lh * 0.3

    } else if (block.type === 'image') {
      const dataUrl = images[block.id]
      if (dataUrl) {
        state.y += lh * 0.5
        await addInlineImage(pdf, dataUrl, opts, state)
        state.y += lh * 0.5
      }

    } else if (block.type === 'section') {
      await renderSection(pdf, block.section, opts, state)

    } else if (block.type === 'table') {
      state.y += lh * 0.3
      const cols = Math.max(...block.rows.map(r => r.length), 1)
      const colW = textW / cols
      for (const row of block.rows) {
        checkPage(lh)
        row.forEach((cell, ci) => {
          pdf.setFont(FONT, cell.header ? 'bold' : 'normal')
          pdf.setFontSize(opts.fontSize - 1)
          pdf.setTextColor(0, 0, 0)
          pdf.text(pdf.splitTextToSize(cell.text, colW - 2)[0] || '', textX + ci * colW, state.y)
        })
        state.y += lh
      }
      state.y += lh * 0.3
    }
  }
}

async function addInlineImage(pdf, dataUrl, opts, state) {
  const { margin, pageW, pageH } = opts
  const usableW = pageW - margin * 2
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const maxW = usableW * 0.9, maxH = pageH * 0.55
      const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
      const dw = img.naturalWidth * ratio, dh = img.naturalHeight * ratio
      if (state.y + dh > pageH - opts.margin) { pdf.addPage(); state.y = opts.margin }
      try { pdf.addImage(dataUrl, 'JPEG', margin + (usableW - dw) / 2, state.y, dw, dh) }
      catch { try { pdf.addImage(dataUrl, 'PNG', margin + (usableW - dw) / 2, state.y, dw, dh) } catch { } }
      state.y += dh
      resolve()
    }
    img.onerror = resolve
    img.src = dataUrl
  })
}

// ─── Section renderer ─────────────────────────────────────────────────────────
// Returns TOC entry {title, pageNum, y} if this is a top-level chapter
async function renderSection(pdf, section, opts, state) {
  const { margin, fontSize, lineHeight, pageW, pageH } = opts
  const usableW = pageW - margin * 2
  const lh = (fontSize / 72) * 25.4 * lineHeight
  const leftM = margin
  const textW = usableW

  let tocEntry = null

  if (section.titleSpans) {
    const text = spansText(section.titleSpans).trim()
    if (text) {
      if (section.depth === 0) {
        // New page + box header
        pdf.addPage()
        const { yAfter, pageNum, boxTop } = drawChapterBox(pdf, text, opts)
        state.y = yAfter

        // PDF outline bookmark
        pdf.outline.add(null, text, { pageNumber: pageNum, y: boxTop })

        tocEntry = { title: text, pageNum, y: boxTop }
      } else {
        state.y += lh * 0.5
        const sz = fontSize + 1
        const subLH = (sz / 72) * 25.4 * lineHeight
        pdf.setFont(FONT, 'bold')
        pdf.setFontSize(sz)
        pdf.setTextColor(0, 0, 0)
        const pageNum = pdf.internal.getCurrentPageInfo().pageNumber
        pdf.outline.add(null, text, { pageNumber: pageNum, y: state.y })
        for (const line of pdf.splitTextToSize(text, textW)) {
          if (state.y + subLH > pageH - margin) { pdf.addPage(); state.y = margin }
          pdf.text(line, leftM, state.y)
          state.y += subLH
        }
        state.y += lh * 0.3
      }
    }
  }

  await renderBlocks(pdf, section.blocks, opts, state)
  return tocEntry
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function generatePDF(book, options, onProgress) {
  const {
    pageSize = 'a4',
    fontSize = 12,
    margin = 20,
    lineHeight = 1.5,
    includeCover = true,
    includeAnnotation = true,
    includeTOC = true,
  } = options

  const chapterFontSize = Math.max(fontSize + 4, 16) // at least 16pt

  const [pageW, pageH] = PAGE_SIZES[pageSize] || PAGE_SIZES.a4
  const pdf = new jsPDF({ unit: 'mm', format: [pageW, pageH], orientation: 'portrait' })
  ensureFonts(pdf)

  const state = { y: margin }
  const opts = { margin, fontSize, lineHeight, pageW, pageH, images: book.images, chapterFontSize }
  const usableW = pageW - margin * 2
  const lh = (fontSize / 72) * 25.4 * lineHeight
  const leftM = margin

  // ── Cover ──
  if (includeCover && book.cover) {
    await new Promise(resolve => {
      const img = new Image()
      img.onload = () => {
        try { pdf.addImage(book.cover.dataUrl, 'JPEG', 0, 0, pageW, pageH) } catch { }
        resolve()
      }
      img.onerror = resolve
      img.src = book.cover.dataUrl
    })
    pdf.addPage()
    state.y = margin
  }

  // ── Title page ──
  state.y = pageH * 0.28
  const titleSz = chapterFontSize + 2
  const titleLH = (titleSz / 72) * 25.4 * lineHeight
  pdf.setFont(FONT, 'bold')
  pdf.setFontSize(titleSz)
  pdf.setTextColor(0, 0, 0)
  for (const line of pdf.splitTextToSize(book.title, usableW)) {
    pdf.text(line, pageW / 2, state.y, { align: 'center' })
    state.y += titleLH
  }
  if (book.author) {
    state.y += lh
    pdf.setFont(FONT, 'italic')
    pdf.setFontSize(fontSize + 1)
    pdf.text(book.author, pageW / 2, state.y, { align: 'center' })
  }

  onProgress(5)

  // ── Annotation ──
  if (includeAnnotation && book.annotationBlocks.length > 0) {
    pdf.addPage()
    state.y = margin
    const boxH = (chapterFontSize / 72) * 25.4 * lineHeight + 8
    pdf.setFillColor(235, 235, 235)
    pdf.setDrawColor(0, 0, 0)
    pdf.setLineWidth(0.4)
    pdf.rect(margin, margin, usableW, boxH, 'FD')
    pdf.setFont(FONT, 'bold')
    pdf.setFontSize(chapterFontSize)
    pdf.setTextColor(0, 0, 0)
    pdf.text('Аннотация', margin + 4, margin + boxH - 5)
    state.y = margin + boxH + lh * 0.8
    await renderBlocks(pdf, book.annotationBlocks, opts, state)
  }

  // ── Collect TOC entries (we'll fill pageNum during render) ──
  const tocEntries = []  // { title, depth, pageNum, y }

  // ── TOC placeholder page ──
  let tocPageNum = null
  if (includeTOC && collectTOC(book.sections).length > 0) {
    pdf.addPage()
    tocPageNum = pdf.internal.getCurrentPageInfo().pageNumber
    // We'll fill this page AFTER rendering content (we need page numbers)
    // For now just leave it empty — we revisit after render
    state.y = margin
  }

  onProgress(10)

  // ── Content ──
  const total = book.sections.length || 1
  for (let i = 0; i < book.sections.length; i++) {
    const entry = await renderSection(pdf, book.sections[i], opts, state)
    if (entry) tocEntries.push({ ...entry, depth: 0 })
    // Also collect sub-sections from nested blocks
    collectSubSections(book.sections[i], tocEntries)
    onProgress(10 + Math.round(((i + 1) / total) * 80))
  }

  // ── Fill TOC page ──
  if (includeTOC && tocPageNum && tocEntries.length > 0) {
    pdf.setPage(tocPageNum)

    const boxH = (chapterFontSize / 72) * 25.4 * lineHeight + 8
    pdf.setFillColor(235, 235, 235)
    pdf.setDrawColor(0, 0, 0)
    pdf.setLineWidth(0.4)
    pdf.rect(margin, margin, usableW, boxH, 'FD')
    pdf.setFont(FONT, 'bold')
    pdf.setFontSize(chapterFontSize)
    pdf.setTextColor(0, 0, 0)
    pdf.text('Содержание', margin + 4, margin + boxH - 5)

    let ty = margin + boxH + lh

    // Deduplicate: only unique titles that were actually rendered as chapters
    const seen = new Set()
    const unique = tocEntries.filter(e => {
      if (seen.has(e.title)) return false
      seen.add(e.title)
      return true
    })

    for (const entry of unique) {
      if (ty + lh > pageH - margin) break  // TOC overflow — skip rest
      const xOff = entry.depth > 0 ? 6 * entry.depth : 0
      const entryFs = entry.depth === 0 ? fontSize + 1 : fontSize
      const entryLH = (entryFs / 72) * 25.4 * lineHeight

      pdf.setFont(FONT, entry.depth === 0 ? 'bold' : 'normal')
      pdf.setFontSize(entryFs)

      // Page number (right-aligned)
      const pageLabel = String(entry.pageNum)
      pdf.setTextColor(0, 0, 0)
      pdf.text(pageLabel, margin + usableW, ty, { align: 'right' })

      // Dots
      const titleMaxW = usableW - xOff - pdf.getTextWidth(pageLabel) - 4
      const titleLines = pdf.splitTextToSize(entry.title, titleMaxW)
      const titleLine = titleLines[0]

      // Clickable link to the chapter page
      pdf.setTextColor(0, 0, 150)
      pdf.textWithLink(titleLine, margin + xOff, ty, {
        pageNumber: entry.pageNum,
        x: entry.x || margin,
        y: entry.y || margin,
      })

      // Dotted fill between title and page number
      pdf.setTextColor(100, 100, 100)
      const titleW = pdf.getTextWidth(titleLine)
      const dotsStart = margin + xOff + titleW + 2
      const dotsEnd = margin + usableW - pdf.getTextWidth(pageLabel) - 3
      if (dotsEnd > dotsStart + 4) {
        const dotStr = '.'
        const dotW = pdf.getTextWidth(dotStr)
        let dx = dotsStart
        while (dx + dotW < dotsEnd) { pdf.text(dotStr, dx, ty); dx += dotW + 0.3 }
      }

      ty += entryLH
    }
  }

  // ── Page numbers ──
  const totalPages = pdf.internal.getNumberOfPages()
  const frontPages = (includeCover && book.cover ? 1 : 0)
    + 1  // title
    + (includeAnnotation && book.annotationBlocks.length ? 1 : 0)
    + (includeTOC && tocEntries.length ? 1 : 0)

  for (let i = frontPages + 1; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setFont(FONT, 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(120, 120, 120)
    pdf.text(String(i - frontPages), pageW / 2, pageH - margin / 2 + 2, { align: 'center' })
  }

  onProgress(100)
  return pdf
}

function collectSubSections(section, out) {
  for (const b of section.blocks) {
    if (b.type === 'section' && b.section.titleSpans) {
      const title = spansText(b.section.titleSpans).trim()
      if (title) {
        // We don't have page num here since sub-sections don't trigger addPage
        // So we skip them from TOC or add without link
      }
      collectSubSections(b.section, out)
    }
  }
}

export function safeName(title) {
  return title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').replace(/\s+/g, '_').slice(0, 100).trim() || 'book'
}
