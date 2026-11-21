<script>
/**
 * An instance's table (kit CONTRACT.md): TtTable drawn from a createTabletop() result.
 *
 *   <Tabletop :tabletop="tabletop"><template #cell="{ card, t }">...</template></Tabletop>
 *
 * Props: tabletop (required), autoload (default true: load() on mount when there is no collection yet).
 * The root is TtTable, so $el, a class and listeners (nest) reach it, and any TtTable prop the config does not
 * hold (tag, ledgerFig, counter, dockWrap, emptyStatus, quiver, print) passes as an attribute. From the config:
 * collection, loading (no collection and no error yet), options (table.key, widths, stacked, only; groups and the
 * first of them as group; labels.groups; sorts; filters.facets, missing, search), back and emptyLinks (links),
 * labels (less groups) and theme, its class on the root. A key the config leaves out is not passed, so TtTable's
 * own default holds. Every slot passes through as it is (the same slot functions, so the same markup).
 * Exposes the inner table's handle (t, T, change, openCard, deal, openNest, closeNest, over, pop) and keeps it in
 * tabletop.table from mount to unmount.
 */
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue'
import TtTable from './TtTable.vue'

const FORWARD = ['change', 'openCard', 'deal', 'openNest', 'closeNest', 'over', 'pop']

// The TtTable props a config gives: only the keys it sets
export function ttTabletopProps(config) {
  const c = config || {}
  const t = c.table || {}
  const f = c.filters || {}
  const l = c.links || {}
  const options = {}
  const put = (k, v) => { if (v !== undefined) options[k] = v }
  put('key', t.key)
  put('widths', t.widths)
  put('stacked', t.stacked)
  put('only', t.only)
  if (Array.isArray(c.groups) && c.groups.length) { options.groups = c.groups; options.group = c.groups[0] }
  if (c.labels && c.labels.groups) options.groupLabels = c.labels.groups
  put('sorts', c.sorts)
  put('facets', f.facets)
  put('missing', f.missing)
  put('search', f.search)
  const p = { options }
  if (l.back) p.back = l.back
  if (l.empty) p.emptyLinks = l.empty
  if (c.labels) {
    const { groups, ...words } = c.labels
    p.labels = words
  }
  if (c.theme) p.theme = c.theme
  return p
}

export default defineComponent({
  name: 'Tabletop',
  props: {
    tabletop: { type: Object, required: true },
    autoload: { type: Boolean, default: true },
  },
  setup(props, { slots, expose }) {
    const tt = props.tabletop
    const inner = ref(null)
    const fixed = ttTabletopProps(tt.config)
    const cls = tt.config.theme && tt.config.theme.class
    const collection = computed(() => tt.collection.value)
    const loading = computed(() => !tt.collection.value && !tt.error.value)

    const handle = {
      get t() { return inner.value ? inner.value.t : null },
      get T() { return inner.value ? inner.value.T : null },
    }
    for (const name of FORWARD) handle[name] = (...a) => (inner.value ? inner.value[name](...a) : undefined)
    expose(handle)

    onMounted(() => {
      tt.table.value = inner.value
      if (props.autoload && !tt.collection.value) tt.load()
    })
    onBeforeUnmount(() => { if (tt.table.value === inner.value) tt.table.value = null })

    return () => h(TtTable, { ...fixed, class: cls, collection: collection.value, loading: loading.value, ref: inner }, slots)
  },
})
</script>
