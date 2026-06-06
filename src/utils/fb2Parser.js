/**
 * FB2 Parser
 *
 * Key insight: DOMParser always parses as UTF-8 regardless of XML encoding declaration.
 * Solution: decode the buffer ourselves with the correct encoding, then strip the
 * XML declaration so DOMParser doesn't try to re-interpret it.
 */

export function decodeFB2(buffer) {
  const bytes = new Uint8Array(buffer)

  // Read first 512 bytes as latin-1 (1:1 byte mapping) to safely extract the XML declaration
  const header = Array.from(bytes.slice(0, 512)).map(b => String.fromCharCode(b)).join('')
  const match = header.match(/encoding=["']([^"']+)["']/i)
  const declared = match ? match[1].toLowerCase().trim() : 'utf-8'

  const normalize = enc => {
    if (/1251|cp1251|win.*1251/.test(enc)) return 'windows-1251'
    if (/1252|cp1252/.test(enc)) return 'windows-1252'
    if (/iso.?8859.?1/.test(enc)) return 'iso-8859-1'
    if (/utf.?8/.test(enc)) return 'utf-8'
    return enc
  }

  // Try declared encoding first, then common fallbacks for Russian texts
  const candidates = [normalize(declared)]
  if (!candidates.includes('windows-1251')) candidates.push('windows-1251')
  if (!candidates.includes('utf-8')) candidates.push('utf-8')

  let decoded = null
  for (const enc of candidates) {
    try {
      const text = new TextDecoder(enc, { fatal: true }).decode(buffer)
      // Heuristic: valid Russian text shouldn't have many replacement chars
      const badChars = (text.match(/\uFFFD/g) || []).length
      if (badChars < 5) { decoded = text; break }
    } catch {
      continue
    }
  }
  if (!decoded) decoded = new TextDecoder('utf-8', { fatal: false }).decode(buffer)

  // CRITICAL: strip the XML declaration so DOMParser doesn't override our encoding
  decoded = decoded.replace(/^<\?xml[^?]*\?>\s*/i, '')

  return decoded
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function getText(el) { return el ? el.textContent.trim() : '' }
function getEl(p, sel) { return p ? p.querySelector(sel) : null }

function collectSpans(el) {
  const spans = []
  function walk(node, bold, italic) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) spans.push({ text: node.textContent, bold, italic })
      return
    }
    const tag = node.nodeName.toLowerCase()
    const b = bold || tag === 'strong' || tag === 'b'
    const i = italic || tag === 'emphasis' || tag === 'em' || tag === 'i'
    for (const child of node.childNodes) walk(child, b, i)
  }
  walk(el, false, false)
  return spans
}

function extractCover(doc) {
  try {
    const ref = doc.querySelector('coverpage image')
    if (!ref) return null
    const href = ref.getAttribute('href') || ref.getAttribute('l:href') ||
      ref.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || ''
    const id = href.replace('#', '')
    const bin = id && doc.querySelector(`binary[id="${id}"]`)
    if (!bin) return null
    const ct = bin.getAttribute('content-type') || 'image/jpeg'
    return { dataUrl: `data:${ct};base64,${bin.textContent.replace(/\s/g, '')}`, id }
  } catch { return null }
}

function processSection(el, depth) {
  const titleEl = el.querySelector(':scope > title')
  let titleSpans = null
  if (titleEl) {
    const p = titleEl.querySelector('p')
    titleSpans = collectSpans(p || titleEl)
  }

  const blocks = []
  for (const node of el.childNodes) {
    const tag = node.nodeName.toLowerCase()
    if (tag === 'title') continue

    if (tag === 'p') {
      const spans = collectSpans(node)
      if (spans.map(s => s.text).join('').trim()) blocks.push({ type: 'p', spans })

    } else if (tag === 'empty-line') {
      blocks.push({ type: 'empty-line' })

    } else if (tag === 'subtitle') {
      blocks.push({ type: 'subtitle', spans: collectSpans(node) })

    } else if (tag === 'epigraph') {
      const lines = [...node.querySelectorAll('p')].map(p => collectSpans(p))
      const auth = node.querySelector('text-author')
      blocks.push({ type: 'epigraph', lines, author: auth ? collectSpans(auth) : null })

    } else if (tag === 'poem') {
      const tp = node.querySelector('title p') || node.querySelector('title')
      const stanzas = []
      node.querySelectorAll('stanza').forEach(st => {
        const lines = [...st.querySelectorAll('v')].map(v => collectSpans(v))
        if (lines.length) stanzas.push(lines)
      })
      if (!stanzas.length) {
        const lines = [...node.querySelectorAll('v')].map(v => collectSpans(v))
        if (lines.length) stanzas.push(lines)
      }
      if (stanzas.length || tp) blocks.push({ type: 'poem', title: tp ? collectSpans(tp) : null, stanzas })

    } else if (tag === 'cite') {
      const lines = [...node.querySelectorAll('p')].map(p => collectSpans(p))
      const auth = node.querySelector('text-author')
      blocks.push({ type: 'cite', lines, author: auth ? collectSpans(auth) : null })

    } else if (tag === 'section') {
      blocks.push({ type: 'section', section: processSection(node, depth + 1) })

    } else if (tag === 'image') {
      const href = node.getAttribute('href') || node.getAttribute('l:href') ||
        node.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || ''
      const id = href.replace('#', '')
      if (id) blocks.push({ type: 'image', id })

    } else if (tag === 'table') {
      const rows = []
      node.querySelectorAll('tr').forEach(tr => {
        const cells = []
        tr.querySelectorAll('td,th').forEach(td =>
          cells.push({ text: td.textContent.trim(), header: td.nodeName.toLowerCase() === 'th' })
        )
        if (cells.length) rows.push(cells)
      })
      if (rows.length) blocks.push({ type: 'table', rows })
    }
  }

  return { titleSpans, depth, blocks }
}

// ─── main export ──────────────────────────────────────────────────────────────

export function parseFB2(xmlString) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'application/xml')

  if (doc.querySelector('parsererror')) {
    // Try as text/html fallback (some malformed FB2s)
    const doc2 = parser.parseFromString(xmlString, 'text/html')
    if (!doc2.querySelector('fictionbook')) throw new Error('Файл повреждён или не является корректным FB2')
    return parseFB2Doc(doc2)
  }
  return parseFB2Doc(doc)
}

function parseFB2Doc(doc) {
  const titleInfoEl = getEl(doc.querySelector('description'), 'title-info')

  const bookTitle = getText(getEl(titleInfoEl, 'book-title')) || 'Без названия'
  const author = [
    getText(getEl(titleInfoEl, 'author first-name')),
    getText(getEl(titleInfoEl, 'author middle-name')),
    getText(getEl(titleInfoEl, 'author last-name')),
  ].filter(Boolean).join(' ') || ''

  const annotationEl = getEl(titleInfoEl, 'annotation')
  const annotationBlocks = annotationEl
    ? [...annotationEl.querySelectorAll('p')].map(p => ({ type: 'p', spans: collectSpans(p) }))
    : []

  const cover = extractCover(doc)

  const images = {}
  doc.querySelectorAll('binary[id]').forEach(bin => {
    const id = bin.getAttribute('id')
    const ct = bin.getAttribute('content-type') || 'image/jpeg'
    images[id] = `data:${ct};base64,${bin.textContent.replace(/\s/g, '')}`
  })

  const bodies = [...doc.querySelectorAll('body')]
  const mainBody = bodies.find(b => !b.getAttribute('name')) || doc.querySelector('body')
  const sections = []

  if (mainBody) {
    mainBody.querySelectorAll(':scope > section').forEach(s => sections.push(processSection(s, 0)))
    if (!sections.length) {
      const blocks = [...mainBody.querySelectorAll(':scope > p')]
        .map(p => ({ type: 'p', spans: collectSpans(p) }))
      if (blocks.length) sections.push({ titleSpans: null, depth: 0, blocks })
    }
  }

  return { title: bookTitle, author, annotationBlocks, cover, sections, images }
}
