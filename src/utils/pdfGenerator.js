import { jsPDF } from 'jspdf'
import { fonts as fontData } from './fonts'

const FONT = 'LiberationSerif'
const PAGE_SIZES = { a4: [210, 297], a5: [148, 210], letter: [215.9, 279.4] }

// Register fonts on EVERY new pdf instance (not globally)
// because each new jsPDF() starts with empty VFS
function registerFonts(pdf) {
  const variants = [
    { key: 'LiberationSerif-Regular',    style: 'normal' },
    { key: 'LiberationSerif-Bold',       style: 'bold' },
    { key: 'LiberationSerif-Italic',     style: 'italic' },
    { key: 'LiberationSerif-BoldItalic', style: 'bolditalic' },
  ]
  for (const { key, style } of variants) {
    pdf.addFileToVFS(`${key}.ttf`, fontData[key])
    pdf.addFont(`${key}.ttf`, FONT, style)
  }
  pdf.setFont(FONT, 'normal')
}

// ─── Plain text writer ────────────────────────────────────────────────────────
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

// ─── Justified paragraph with inline spans ────────────────────────────────────
// Renders body text: first-line indent, justified, supports bold/italic per span
function writeParagraph(pdf, spans, x, maxW, y, opts, firstLineIndent = 0) {
  const { margin, lineHeight, pageH } = opts
  const fs = opts.fontSize
  const lh = (fs / 72) * 25.4 * lineHeight
  pdf.setTextColor(0, 0, 0)

  // Tokenize spans → words with style
  const tokens = []
  for (const span of spans) {
    if (!span.text) continue
    const parts = span.text.split(/(\s+)/)
    for (const part of parts) {
      if (!part) continue
      if (/^\s+$/.test(part)) {
        if (tokens.length > 0) tokens[tokens.length - 1].trailingSpace = true
      } else {
        tokens.push({ word: part, bold: span.bold, italic: span.italic, trailingSpace: false })
      }
    }
  }
  if (!tokens.length) return y

  const getStyle = t => t.bold && t.italic ? 'bolditalic' : t.bold ? 'bold' : t.italic ? 'italic' : 'normal'

  function wordW(token) {
    pdf.setFont(FONT, getStyle(token))
    pdf.setFontSize(fs)
    return pdf.getTextWidth(token.word)
  }
  function spaceW() {
    pdf.setFont(FONT, 'normal'); pdf.setFontSize(fs)
    return pdf.getTextWidth(' ')
  }
  const spW = spaceW()

  // Build lines
  const lines = []
  let cur = [], curW = 0, isFirstLine = true
  let lineMaxW = maxW - firstLineIndent

  for (const token of tokens) {
    const w = wordW(token)
    const needSpace = cur.length > 0 ? spW : 0
    if (cur.length > 0 && curW + needSpace + w > lineMaxW + 0.01) {
      lines.push({ items: cur, isFirst: isFirstLine })
      cur = []; curW = 0; isFirstLine = false; lineMaxW = maxW
    }
    cur.push({ token, w })
    curW += (cur.length > 1 ? spW : 0) + w
  }
  if (cur.length) lines.push({ items: cur, isFirst: isFirstLine })

  // Render
  for (let li = 0; li < lines.length; li++) {
    if (y + lh > pageH - margin) { pdf.addPage(); y = margin }
    const { items, isFirst } = lines[li]
    const isLastLine = li === lines.length - 1
    const lineX = x + (isFirst ? firstLineIndent : 0)
    const availW = isFirst ? maxW - firstLineIndent : maxW

    let gap = spW
    if (!isLastLine && items.length > 1) {
      const totalWordW = items.reduce((a, it) => a + it.w, 0)
      gap = (availW - totalWordW) / (items.length - 1)
    }

    let cx = lineX
    for (let ii = 0; ii < items.length; ii++) {
      const { token, w } = items[ii]
      pdf.setFont(FONT, getStyle(token))
      pdf.setFontSize(fs)
      pdf.setTextColor(0, 0, 0)
      pdf.text(token.word, cx, y)
      cx += w + (ii < items.length - 1 ? gap : 0)
    }
    y += lh
  }
  return y
}

// ─── Chapter header box ───────────────────────────────────────────────────────
function drawChapterBox(pdf, text, opts) {
  const { margin, lineHeight, pageW } = opts
  const usableW = pageW - margin * 2
  const fs = opts.chapterFontSize
  pdf.setFont(FONT, 'bold')
  pdf.setFontSize(fs)
  const lh = (fs / 72) * 25.4 * lineHeight
  const lines = pdf.splitTextToSize(text, usableW - 8)
  const boxH = lh * lines.length + 8

  pdf.setFillColor(235, 235, 235)
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.4)
  pdf.rect(margin, margin, usableW, boxH, 'FD')

  const pageNum = pdf.internal.getCurrentPageInfo().pageNumber
  let ty = margin + 5 + lh * 0.78
  pdf.setTextColor(0, 0, 0)
  for (const line of lines) { pdf.text(line, margin + 4, ty); ty += lh }

  return { yAfter: margin + boxH + lh * 0.8, pageNum, boxTop: margin, boxH }
}

// ─── TOC helpers ──────────────────────────────────────────────────────────────
function spansText(spans) { return spans ? spans.map(s => s.text).join('') : '' }

function collectTOC(sections) {
  const entries = []
  function walk(sec, depth) {
    if (sec.titleSpans) {
      const title = spansText(sec.titleSpans).trim()
      if (title) entries.push({ title, depth })
    }
    for (const b of sec.blocks) if (b.type === 'section') walk(b.section, depth + 1)
  }
  sections.forEach(s => walk(s, 0))
  return entries
}

// ─── Inline image ─────────────────────────────────────────────────────────────
async function addInlineImage(pdf, dataUrl, opts, state) {
  const { margin, pageW, pageH } = opts
  const usableW = pageW - margin * 2
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const maxW = usableW * 0.9, maxH = pageH * 0.55
      const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
      const dw = img.naturalWidth * ratio, dh = img.naturalHeight * ratio
      if (state.y + dh > pageH - margin) { pdf.addPage(); state.y = margin }
      try { pdf.addImage(dataUrl, 'JPEG', margin + (usableW - dw) / 2, state.y, dw, dh) }
      catch { try { pdf.addImage(dataUrl, 'PNG', margin + (usableW - dw) / 2, state.y, dw, dh) } catch { } }
      state.y += dh
      resolve()
    }
    img.onerror = resolve
    img.src = dataUrl
  })
}

// ─── Block renderer ───────────────────────────────────────────────────────────
async function renderBlocks(pdf, blocks, opts, state) {
  const { margin, fontSize, lineHeight, pageW, pageH, images } = opts
  const usableW = pageW - margin * 2
  const lh = (fontSize / 72) * 25.4 * lineHeight
  const paraIndent = (fontSize / 72) * 25.4 * 1.8

  function checkPage(needed) {
    if (state.y + needed > pageH - margin) { pdf.addPage(); state.y = margin }
  }

  for (const block of blocks) {
    if (block.type === 'p') {
      if (!spansText(block.spans).trim()) continue
      checkPage(lh)
      state.y = writeParagraph(pdf, block.spans, margin, usableW, state.y, opts, paraIndent)

    } else if (block.type === 'empty-line' || block.type === 'separator') {
      // * * * — separator box centred, spanning full text width
      const sepFontSize = fontSize
      const sepLH = (sepFontSize / 72) * 25.4 * lineHeight
      const boxH = sepLH * 0.55 + 6   // было: * 0.85 + 6
      const gapAbove = 0               // было: lh * 1.0
      const gapBelow = lh * 0.8        // было: lh * 1.0
      checkPage(gapAbove + boxH + gapBelow)
      state.y += gapAbove
      pdf.setFillColor(255, 255, 255)
      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(0.4)
      pdf.rect(margin, state.y, usableW, boxH, 'FD')
      pdf.setFont(FONT, 'normal')
      pdf.setFontSize(sepFontSize)
      pdf.setTextColor(0, 0, 0)
      const sepW = pdf.getTextWidth('* * *')
      const sepX = margin + (usableW - sepW) / 2
      pdf.text('* * *', sepX, state.y + boxH * 0.68)
      state.y += boxH + gapBelow

    } else if (block.type === 'subtitle') {
      const text = spansText(block.spans).trim()
      if (!text) continue
      state.y += lh * 0.4
      checkPage(lh)
      state.y = writeText(pdf, text, margin, usableW, state.y, opts, 'bold', null, 'left')
      state.y += lh * 0.2
      

    } else if (block.type === 'epigraph') {
      state.y += lh * 0.5
      const xOff = usableW * 0.4
      for (const line of block.lines) {
        if (!spansText(line).trim()) continue
        checkPage(lh)
        state.y = writeParagraph(pdf, line, margin + xOff, usableW - xOff, state.y, opts, 0)
      }
      if (block.author) {
        const text = spansText(block.author).trim()
        if (text) { checkPage(lh); state.y = writeText(pdf, `— ${text}`, margin + xOff, usableW - xOff, state.y, opts, 'italic', fontSize - 1) }
      }
      state.y += lh * 0.5

    } else if (block.type === 'poem') {
      state.y += lh * 0.5
      if (block.title) {
        const text = spansText(block.title).trim()
        if (text) { checkPage(lh); state.y = writeText(pdf, text, margin + usableW * 0.1, usableW * 0.9, state.y, opts, 'bold') }
      }
      for (const stanza of block.stanzas) {
        for (const line of stanza) {
          if (!spansText(line).trim()) continue
          checkPage(lh)
          state.y = writeParagraph(pdf, line, margin + usableW * 0.1, usableW * 0.9, state.y, opts, 0)
        }
        state.y += lh * 0.4
      }
      state.y += lh * 0.5

    } else if (block.type === 'cite') {
      state.y += lh * 0.3
      for (const line of block.lines) {
        if (!spansText(line).trim()) continue
        checkPage(lh)
        state.y = writeParagraph(pdf, line, margin + 6, usableW - 12, state.y, opts, 0)
      }
      if (block.author) {
        const text = spansText(block.author).trim()
        if (text) { checkPage(lh); state.y = writeText(pdf, `— ${text}`, margin + 6, usableW - 12, state.y, opts, 'italic', fontSize - 1) }
      }
      state.y += lh * 0.3

    } else if (block.type === 'image') {
      const dataUrl = images[block.id]
      if (dataUrl) { state.y += lh * 0.5; await addInlineImage(pdf, dataUrl, opts, state); state.y += lh * 0.5 }

    } else if (block.type === 'section') {
      await renderSection(pdf, block.section, opts, state)

    } else if (block.type === 'table') {
      state.y += lh * 0.3
      const cols = Math.max(...block.rows.map(r => r.length), 1)
      const colW = usableW / cols
      for (const row of block.rows) {
        checkPage(lh)
        row.forEach((cell, ci) => {
          pdf.setFont(FONT, cell.header ? 'bold' : 'normal')
          pdf.setFontSize(fontSize - 1); pdf.setTextColor(0, 0, 0)
          pdf.text(pdf.splitTextToSize(cell.text, colW - 2)[0] || '', margin + ci * colW, state.y)
        })
        state.y += lh
      }
      state.y += lh * 0.3
    }
  }
}

// ─── Section renderer ─────────────────────────────────────────────────────────
async function renderSection(pdf, section, opts, state) {
  const { margin, fontSize, lineHeight, pageW, pageH } = opts
  const usableW = pageW - margin * 2
  const lh = (fontSize / 72) * 25.4 * lineHeight

  if (section.titleSpans) {
    const text = spansText(section.titleSpans).trim()
    if (text) {
      if (section.depth === 0) {
        pdf.addPage()
        const { yAfter, pageNum, boxTop } = drawChapterBox(pdf, text, opts)
        state.y = yAfter
        pdf.outline.add(null, text, { pageNumber: pageNum, y: boxTop })
        state._tocEntries = state._tocEntries || []
        state._tocEntries.push({ title: text, depth: 0, pageNum, y: boxTop })
      } else {
        state.y += lh * 0.5
        const sz = fontSize + 1
        const subLH = (sz / 72) * 25.4 * lineHeight
        if (state.y + subLH > pageH - margin) { pdf.addPage(); state.y = margin }
        const pageNum = pdf.internal.getCurrentPageInfo().pageNumber
        const entryY = state.y
        pdf.outline.add(null, text, { pageNumber: pageNum, y: entryY })
        // Also add to TOC entries with depth
        state._tocEntries = state._tocEntries || []
        state._tocEntries.push({ title: text, depth: section.depth, pageNum, y: entryY })
        pdf.setFont(FONT, 'bold'); pdf.setFontSize(sz); pdf.setTextColor(0, 0, 0)
        for (const line of pdf.splitTextToSize(text, usableW)) {
          if (state.y + subLH > pageH - margin) { pdf.addPage(); state.y = margin }
          pdf.text(line, margin, state.y); state.y += subLH
        }
        state.y += lh * 0.3
      }
    }
  }
  await renderBlocks(pdf, section.blocks, opts, state)
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function generatePDF(book, options, onProgress) {
  const {
    pageSize = 'a4',
    fontSize = 15,
    margin = 25,
    lineHeight = 1.3,
    includeCover = true,
    includeAnnotation = true,
    includeTOC = true,
  } = options

  const chapterFontSize = Math.max(fontSize + 3, 16)
  const [pageW, pageH] = PAGE_SIZES[pageSize] || PAGE_SIZES.a4

  // Create fresh instance and register fonts every time
  const pdf = new jsPDF({ unit: 'mm', format: [pageW, pageH], orientation: 'portrait' })
  registerFonts(pdf)  // always call on fresh instance

  const state = { y: margin, _tocEntries: [] }
  const opts = { margin, fontSize, lineHeight, pageW, pageH, images: book.images, chapterFontSize }
  const usableW = pageW - margin * 2
  const lh = (fontSize / 72) * 25.4 * lineHeight

  // ── Cover ──
  if (includeCover && book.cover) {
    await new Promise(resolve => {
      const img = new Image()
      img.onload = () => { try { pdf.addImage(book.cover.dataUrl, 'JPEG', 0, 0, pageW, pageH) } catch { } resolve() }
      img.onerror = resolve
      img.src = book.cover.dataUrl
    })
    pdf.addPage(); state.y = margin
  }

  // ── Title page ──
  state.y = pageH * 0.28
  const titleSz = chapterFontSize + 2
  const titleLH = (titleSz / 72) * 25.4 * lineHeight
  pdf.setFont(FONT, 'bold'); pdf.setFontSize(titleSz); pdf.setTextColor(0, 0, 0)
  for (const line of pdf.splitTextToSize(book.title, usableW)) {
    pdf.text(line, pageW / 2, state.y, { align: 'center' }); state.y += titleLH
  }
  if (book.author) {
    state.y += lh
    pdf.setFont(FONT, 'italic'); pdf.setFontSize(fontSize + 1)
    pdf.text(book.author, pageW / 2, state.y, { align: 'center' })
  }

  onProgress(5)

  // ── Annotation ──
  if (includeAnnotation && book.annotationBlocks.length > 0) {
    pdf.addPage(); state.y = margin
    const boxH = (chapterFontSize / 72) * 25.4 * lineHeight + 8
    pdf.setFillColor(235, 235, 235); pdf.setDrawColor(0, 0, 0); pdf.setLineWidth(0.4)
    pdf.rect(margin, margin, usableW, boxH, 'FD')
    pdf.setFont(FONT, 'bold'); pdf.setFontSize(chapterFontSize); pdf.setTextColor(0, 0, 0)
    pdf.text('Аннотация', margin + 4, margin + boxH - 5)
    state.y = margin + boxH + lh * 0.8
    await renderBlocks(pdf, book.annotationBlocks, opts, state)
  }

  // ── TOC placeholder page ──
  let tocPageNum = null
  if (includeTOC && collectTOC(book.sections).length > 0) {
    pdf.addPage()
    tocPageNum = pdf.internal.getCurrentPageInfo().pageNumber
    state.y = margin
  }

  onProgress(10)

  // ── Content ──
  const total = book.sections.length || 1
  for (let i = 0; i < book.sections.length; i++) {
    await renderSection(pdf, book.sections[i], opts, state)
    onProgress(10 + Math.round(((i + 1) / total) * 80))
  }

  // ── Fill TOC page ──
  const tocEntries = state._tocEntries || []
  if (includeTOC && tocPageNum && tocEntries.length > 0) {
    pdf.setPage(tocPageNum)
    const boxH = (chapterFontSize / 72) * 25.4 * lineHeight + 8
    pdf.setFillColor(235, 235, 235); pdf.setDrawColor(0, 0, 0); pdf.setLineWidth(0.4)
    pdf.rect(margin, margin, usableW, boxH, 'FD')
    pdf.setFont(FONT, 'bold'); pdf.setFontSize(chapterFontSize); pdf.setTextColor(0, 0, 0)
    pdf.text('Содержание', margin + 4, margin + boxH - 5)

    let ty = margin + boxH + lh
    for (const entry of tocEntries) {
      if (ty + lh > pageH - margin) break
      // depth 0 = chapter (bold, no indent)
      // depth 1 = section (normal, 8mm indent)
      // depth 2+ = subsection (normal, 16mm+ indent, smaller font)
      const xOff = entry.depth === 0 ? 0 : entry.depth === 1 ? 8 : 8 + (entry.depth - 1) * 6
      const entryFs = entry.depth === 0 ? fontSize + 1 : entry.depth === 1 ? fontSize : fontSize - 1
      const entryLH = (entryFs / 72) * 25.4 * lineHeight
      const fontStyle = entry.depth === 0 ? 'bold' : 'normal'
      pdf.setFont(FONT, fontStyle)
      pdf.setFontSize(entryFs); pdf.setTextColor(0, 0, 0)

      const pageLabel = String(entry.pageNum)
      pdf.setFont(FONT, 'normal'); pdf.setFontSize(entryFs)
      const pageLabelW = pdf.getTextWidth(pageLabel)
      pdf.setFont(FONT, fontStyle)
      const titleMaxW = usableW - xOff - pageLabelW - 6
      const titleLine = pdf.splitTextToSize(entry.title, titleMaxW)[0]

      // Page number right — plain text, no link
      pdf.setTextColor(0, 0, 0)
      const pageNumX = margin + usableW - pageLabelW
      pdf.text(pageLabel, pageNumX, ty)

      // Clickable chapter title
      pdf.setTextColor(0, 0, 130)
      pdf.textWithLink(titleLine, margin + xOff, ty, { pageNumber: entry.pageNum, x: margin, y: entry.y || margin })

      // Dots between title and page number
      pdf.setFont(FONT, 'normal'); pdf.setFontSize(entryFs)
      pdf.setTextColor(150, 150, 150)
      const titleW = pdf.getTextWidth(titleLine)
      const dStart = margin + xOff + titleW + 2
      const dEnd = pageNumX - 2
      const dotW = pdf.getTextWidth('.')
      if (dEnd > dStart + 4) {
        let dx = dStart
        while (dx + dotW < dEnd) { pdf.text('.', dx, ty); dx += dotW + 0.3 }
      }

      ty += entryLH
    }
  }

  // ── Page numbers ──
  const totalPages = pdf.internal.getNumberOfPages()
  const frontPages = (includeCover && book.cover ? 1 : 0)
    + 1
    + (includeAnnotation && book.annotationBlocks.length ? 1 : 0)
    + (includeTOC && tocEntries.length ? 1 : 0)

  for (let i = frontPages + 1; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setFont(FONT, 'normal'); pdf.setFontSize(8); pdf.setTextColor(120, 120, 120)
    pdf.text(String(i - frontPages), pageW / 2, pageH - margin / 2 + 2, { align: 'center' })
  }

  onProgress(100)
  return pdf
}

export function safeName(title) {
  return title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').replace(/\s+/g, '_').slice(0, 100).trim() || 'book'
}
