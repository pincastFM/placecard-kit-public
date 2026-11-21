/**
 * A small CSS reader for conformance (kit CONTRACT.md): what an instance's stylesheet declares,
 * and on which selectors, without a browser. jsdom's cascade is no ground for a theme check, so the suite reads
 * the instance's sheets as text. Framework-free; runs in Node. test/conformance/css.test.js holds it to postcss
 * on the kit's own sheets, declaration for declaration.
 *
 * ttCssRules(text) -> [{ selectors, decls: [{ prop, value, important }], at }] in source order:
 * - comments dropped; strings, parentheses and brackets kept whole (a ';', ',', '{' or '}' inside one is text);
 * - selectors split on top-level commas; a nested rule's selectors resolved against its parent's ('&', or the
 *   parent then a space);
 * - at: the enclosing grouping at-rules' preludes, outermost first (@media, @supports, @container, @layer,
 *   @scope, @document); @keyframes, @font-face, @page, @property and other at-rules are skipped whole.
 */

const GROUPING = new Set(['media', 'supports', 'container', 'layer', 'scope', 'document'])
const CONDITIONAL = new Set(['media', 'supports', 'container', 'scope', 'document'])

function stripComments(s) {
  let out = ''
  let q = null
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) {
      out += c
      if (c === '\\') { out += s[++i] || ''; continue }
      if (c === q) q = null
      continue
    }
    if (c === '"' || c === "'") { q = c; out += c; continue }
    if (c === '/' && s[i + 1] === '*') {
      const end = s.indexOf('*/', i + 2)
      i = end < 0 ? s.length : end + 1
      out += ' '
      continue
    }
    out += c
  }
  return out
}

// The index of the first char at depth 0 (outside strings, parens and brackets) that stop() accepts; s.length if none
function scanTo(s, i, stop) {
  let q = null
  let depth = 0
  for (; i < s.length; i++) {
    const c = s[i]
    if (q) {
      if (c === '\\') i++
      else if (c === q) q = null
      continue
    }
    if (c === '"' || c === "'") q = c
    else if (c === '(' || c === '[') depth++
    else if ((c === ')' || c === ']') && depth > 0) depth--
    else if (depth === 0 && stop(c)) return i
  }
  return s.length
}

// The matching '}' of the '{' at j; s.length if it never closes
function matchBrace(s, j) {
  let q = null
  let depth = 0
  for (let i = j; i < s.length; i++) {
    const c = s[i]
    if (q) {
      if (c === '\\') i++
      else if (c === q) q = null
      continue
    }
    if (c === '"' || c === "'") q = c
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return i
  }
  return s.length
}

/** text split on `sep` at depth 0, outside strings, parens and brackets. */
export function splitTop(text, sep) {
  const out = []
  let i = 0
  for (;;) {
    const j = scanTo(text, i, c => c === sep)
    out.push(text.slice(i, j))
    if (j >= text.length) return out
    i = j + 1
  }
}

function decl(piece) {
  const j = scanTo(piece, 0, c => c === ':')
  if (j >= piece.length) return null
  const prop = piece.slice(0, j).trim()
  if (!prop || /\s/.test(prop)) return null
  let value = piece.slice(j + 1).trim()
  const imp = /\s*!\s*important\s*$/i.exec(value)
  if (imp) value = value.slice(0, imp.index).trim()
  return { prop, value, important: !!imp }
}

const nest = (parents, own) => parents.flatMap(p => own.map(c => (c.includes('&') ? c.replace(/&/g, p) : `${p} ${c}`)))

// This level's declarations (for the rule that owns the block); its rules go to out, a rule before its nested ones
function block(s, at, parents, out) {
  const decls = []
  let i = 0
  while (i < s.length) {
    while (i < s.length && (/\s/.test(s[i]) || s[i] === ';')) i++
    if (i >= s.length) break
    const j = scanTo(s, i, c => c === '{' || c === ';' || c === '}')
    if (j >= s.length || s[j] !== '{') {
      const piece = s.slice(i, j).trim()
      if (parents && piece && piece[0] !== '@') { const d = decl(piece); if (d) decls.push(d) }
      i = j + 1
      continue
    }
    const prelude = s.slice(i, j).trim().replace(/\s+/g, ' ')
    const k = matchBrace(s, j)
    const body = s.slice(j + 1, k)
    i = k + 1
    if (prelude[0] === '@') {
      const name = ((/^@([\w-]+)/.exec(prelude) || [])[1] || '').toLowerCase()
      if (!GROUPING.has(name)) continue
      const inner = [...at, prelude]
      const rule = parents ? { selectors: parents, decls: [], at: inner, wrap: true } : null
      if (rule) out.push(rule)
      const d = block(body, inner, parents, out)
      if (rule) rule.decls = d
      continue
    }
    const own = splitTop(prelude, ',').map(x => x.trim()).filter(Boolean)
    const rule = { selectors: parents ? nest(parents, own) : own, decls: [], at }
    out.push(rule)
    rule.decls = block(body, at, rule.selectors, out)
  }
  return decls
}

/** Every style rule in a stylesheet's text, with its declarations (see the head of this file). */
export function ttCssRules(text) {
  const out = []
  block(stripComments(String(text == null ? '' : text)), [], null, out)
  // a rule's own declarations inside a nested @media come out as a rule of their own; one with none is dropped
  return out.filter(r => !(r.wrap && !r.decls.length)).map(({ wrap, ...r }) => r)
}

/** True when an at list holds a condition (@media, @supports, @container, @scope, @document); @layer is none. */
export function ttCssConditional(at) {
  return (at || []).some(p => CONDITIONAL.has(((/^@([\w-]+)/.exec(p) || [])[1] || '').toLowerCase()))
}

/** The class names a selector names, attribute values and strings left out. */
export function ttSelectorClasses(selector) {
  const s = String(selector).replace(/(["'])(?:\\.|(?!\1).)*\1/g, '""').replace(/\[[^\]]*\]/g, '[]')
  const out = []
  for (const m of s.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) if (!out.includes(m[1])) out.push(m[1])
  return out
}
