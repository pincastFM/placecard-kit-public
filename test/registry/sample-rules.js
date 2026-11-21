// Three made-up apps' rules, in the shape a host passes to the registry subpath: a species app with its own rarity
// words, a town app with walk stops and destination cards, and a plain app that only names its cards.

export const SAMPLE_APPS = [
  { id: 'leaf-log', name: 'Leaf Log', color: '#2F6B4F' },
  { id: 'old-town', name: 'Old Town', color: '#C9822B' },
  { id: 'paper-room', name: 'Paper Room', color: '#7A3E9D' },
]
// Rarity words per set kind, low to high
export const SAMPLE_RARITIES = {
  species: ['Everywhere', 'Common', 'Scarce', 'One of a kind'],
  walk: ['Common', 'Uncommon', 'Rare', 'Legendary'],
  destination: ['Common', 'Uncommon'],
}
export const STOP_ACCENT = '#1e3a8a'
const CHIP_COLORS = { food: '#d9480f', history: '#1e4fd0' }
export const chipColor = (id, always = false) => (always ? '#1a1a1a' : Object.prototype.hasOwnProperty.call(CHIP_COLORS, id) ? CHIP_COLORS[id] : '#6b6356')

const numOr = v => (v == null || v === '' || !isFinite(Number(v)) ? null : Number(v))
const upper = s => String(s || '').trim().toUpperCase()

export function sampleRules() {
  const leaf = {
    face: () => 'treehopper',
    set: () => ({ kind: 'species', action: 'Play in Leaf Log' }),
    card: (out, r, { set, page, rank }) => {
      const species = /^species:/.test(r.key)
      const slug = r.key.replace(/^species:/, '')
      return {
        id: `leaf:${slug}`,
        subtitle: r.subtitle,
        type: species ? 'Species' : r.subtitle,
        fact: r.fact,
        back: null,
        number: null,
        of: null,
        rarityRank: rank('species', r.rarity),
        rarityCount: species ? r.fact : null,
        foil: r.foil && r.rarity === 'One of a kind',
        accent: null,
        href: species ? `https://leaflog.example/book?card=${encodeURIComponent(slug)}` : (r.url || page),
        action: (set && set.action) || 'Play in Leaf Log',
      }
    },
    // a single tree is a place, folded into its species
    offTable: r => r.type === 'tree' || /^tree:/.test(r.key),
  }

  const stop = (r, { set, rank }) => {
    const d = r.data
    const walk = numOr(d.walk_id) ?? (set && set.walk) ?? numOr(String(r.set).replace(/^walk-/, ''))
    const rarity = r.rarity || 'Common'
    return {
      id: `${r.set}:${r.key.replace(/^stop:/, '')}`,
      subtitle: r.subtitle,
      type: r.subtitle,
      fact: r.fact,
      back: null,
      stats: Array.isArray(d.stats) ? d.stats.filter(s => s && s.k && s.v).slice(0, 3).map(({ k, v }) => ({ k, v })) : [],
      number: numOr(d.number),
      of: numOr(d.total) ?? (set ? set.total : null),
      rarity,
      rarityRank: rank('walk', rarity),
      foil: r.foil || rarity === 'Legendary',
      accent: d.accent || STOP_ACCENT,
      href: `https://oldtown.example/walk/${walk}`,
      action: 'Open the walk',
      ref: { stop: numOr(r.key.replace(/^stop:/, '')), walk },
    }
  }
  const destination = (out, r, { set, page, rank, options }) => {
    const d = r.data
    const zone = (set && set.zone) || null
    const list = options.chips || (set && set.chips) || []
    const chip = d.chip ? (list.find(x => x && x.id === d.chip) || null) : null
    return {
      id: zone ? `${zone}:${r.key}` : out.id,
      subtitle: r.subtitle,
      type: r.subtitle,
      fact: r.fact,
      back: (d.back && d.back.text) || null,
      number: null,
      of: null,
      rarityRank: rank('destination', r.rarity),
      foil: false,
      accent: d.chip ? chipColor(d.chip, !!(chip && chip.always)) : null,
      chip: d.chip || null,
      chipLabel: chip ? chip.label : null,
      href: r.url || page,
      action: (set && set.action) || 'Open in Placecard',
      ref: { chip: d.chip || null },
    }
  }
  const town = {
    face: r => (/^stop:/.test(r.key) ? 'stop' : 'destination'),
    set: (out, { meta: m }) => {
      if (/^walk-\d+$/.test(out.id)) return { kind: 'walk', action: 'Open the walk', walk: Number(out.id.slice(5)) }
      const city = m.city || out.name
      const part = { kind: 'destination', short: upper(m.short || city), action: `Open in ${city}`, zone: m.zone || null }
      if (Array.isArray(m.chips)) part.chips = m.chips
      return part
    },
    card: (out, r, ctx) => (ctx.face === 'stop' ? stop(r, ctx) : destination(out, r, ctx)),
  }

  const paper = {
    face: () => 'destination',
    card: (out, r, { set, page }) => ({ id: `paper:${r.key}`, href: page, action: (set && set.action) || 'Open in Placecard' }),
  }

  return {
    apps: SAMPLE_APPS,
    rarities: SAMPLE_RARITIES,
    photo: url => (url ? url.replace('/full/', '/480/') : null),
    rules: { 'leaf-log': leaf, 'old-town': town, 'paper-room': paper },
  }
}
