// The open card's button: the app's own page for the card when it sends one, named for the app; Placecard's page when
// it sends none or sends an address that is not http or https.
import { describe, it, expect } from 'vitest'
import { TT_PLACECARD_BASE, ttFromMeCards, ttFromRegistry, ttSetFromRegistry } from '../../registry/index.js'

const APPS = [{ id: 'bird-walk', name: 'Bird Walk', color: '#B4432F', site: 'https://birdwalk.example' }]
const SET = ttSetFromRegistry({ app_id: 'bird-walk', id: 'prospect-park', name: 'Prospect Park', meta: {} }, { total: 2 })
const ROW = { app_id: 'bird-walk', set_id: 'prospect-park', card_key: 'hawk', title: 'Red-tailed Hawk', url: 'https://birdwalk.example/hawk', data: {} }
const PAGE = `${TT_PLACECARD_BASE}/card/bird-walk/prospect-park/hawk`

describe('the button on an open card', () => {
  it('goes to the app\'s page and names the app, and the card keeps Placecard\'s page in ref', () => {
    const c = ttFromRegistry(ROW, { set: SET, apps: APPS })
    expect(c).toMatchObject({ href: 'https://birdwalk.example/hawk', action: 'Open in Bird Walk' })
    expect(c.ref.placecard).toBe(PAGE)
  })

  it('reads Open when the app has no name to print', () => {
    expect(ttFromRegistry(ROW, { set: SET }).action).toBe('Open')
  })

  it('goes to Placecard, and says so, when the app sends no page', () => {
    expect(ttFromRegistry({ ...ROW, url: null }, { set: SET, apps: APPS })).toMatchObject({ href: PAGE, action: 'Open in Placecard' })
  })

  it('keeps the words a set names', () => {
    const set = { ...SET, action: 'Open the walk' }
    expect(ttFromRegistry(ROW, { set, apps: APPS }).action).toBe('Open the walk')
    expect(ttFromRegistry({ ...ROW, url: null }, { set, apps: APPS }).action).toBe('Open the walk')
  })

  it.each([
    'javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', 'vbscript:x', 'file:///etc/hosts',
    'https://name:secret@birdwalk.example/hawk', 'birdwalk.example/hawk', 'not a url',
  ])('never links %s', url => {
    expect(ttFromRegistry({ ...ROW, url }, { set: SET, apps: APPS })).toMatchObject({ href: PAGE, action: 'Open in Placecard' })
  })

  it('reads the page from a /me/cards tile too', () => {
    const tile = { kind: 'card', app: 'bird-walk', set: 'prospect-park', key: 'hawk', title: 'Red-tailed Hawk', mine: true, url: 'https://birdwalk.example/hawk' }
    const out = ttFromMeCards({ tiles: [tile], sets: [{ app: 'bird-walk', set: 'prospect-park', name: 'Prospect Park', held: 1, total: 2 }] }, { apps: APPS })
    expect(out.cards[0]).toMatchObject({ href: 'https://birdwalk.example/hawk', action: 'Open in Bird Walk' })
    const { url: _gone, ...bare } = tile
    const out2 = ttFromMeCards({ tiles: [bare], sets: [{ app: 'bird-walk', set: 'prospect-park', name: 'Prospect Park', held: 1, total: 2 }] }, { apps: APPS })
    expect(out2.cards[0]).toMatchObject({ href: PAGE, action: 'Open in Placecard' })
  })
})
