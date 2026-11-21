<template>
  <section v-if="!denied" class="tt-mod tt-mod-sw" :aria-label="L.moderation" :aria-busy="loading ? 'true' : null">
    <template v-if="s">
      <div class="tt-mod-sw-row">
        <span class="tt-mod-sw-name" aria-hidden="true">{{ L.queue }}</span>
        <button
          type="button" role="switch" class="tt-mod-switch" :aria-label="L.queue" :aria-checked="s.queue ? 'true' : 'false'"
          :disabled="busy === 'queue'" @click="flip('queue')"
        ><span class="tt-mod-switch-word">{{ s.queue ? L.on : L.off }}</span></button>
        <span v-if="waitingWord" class="tt-mod-sw-sub">{{ waitingWord }}</span>
      </div>
      <div class="tt-mod-sw-row">
        <span class="tt-mod-sw-name" aria-hidden="true">{{ L.alerts }}</span>
        <button
          type="button" role="switch" class="tt-mod-switch" :aria-label="L.alerts" :aria-checked="s.alerts ? 'true' : 'false'"
          :disabled="busy === 'alerts'" @click="flip('alerts')"
        ><span class="tt-mod-switch-word">{{ s.alerts ? L.on : L.off }}</span></button>
        <span class="tt-mod-sw-sub" :data-topic="s.topic ? 'set' : 'none'">{{ s.topic ? L.topic : L.noTopic }}</span>
      </div>
    </template>
    <p v-if="err" class="tt-mod-err" role="alert">
      {{ err }} <button v-if="!s" type="button" class="tt-mod-link" @click="load">{{ L.retry }}</button>
    </p>
  </section>
</template>

<script setup>
/**
 * 1.1.0: the instance's approval switch and alerts, above the queue in its admin screen:
 * "Approval queue" with how many wait, "Alerts" with whether a topic is set. Reads the settings at mount (or
 * takes `settings`), and a switch PUTs its one key, showing the host's answer. A 403 renders nothing and emits
 * 'denied' (the admin screen shows when the settings answer 200); 'load' and 'change' carry the
 * settings. `waiting`, when given, is the count shown (TtModQueue's 'counts' keep it current).
 */
import { computed, onMounted, ref, watch } from 'vue'
import { TT_MOD_CALL_PROPS, ttModCall, ttModErrWord, ttModFill, ttModWords } from './moderation.js'

const props = defineProps({
  settings: { type: Object, default: null },
  waiting: { type: Number, default: null },
  ...TT_MOD_CALL_PROPS,
})
const emit = defineEmits(['load', 'change', 'denied'])

const L = computed(() => ttModWords(props.labels))
const s = ref(props.settings ? { ...props.settings } : null)
const loading = ref(false)
const busy = ref('')
const err = ref('')
const denied = ref(false)
watch(() => props.settings, v => { if (v) s.value = { ...v } })

const waitingWord = computed(() => {
  if (!s.value) return ''
  const n = props.waiting != null ? props.waiting : Number(s.value.waiting) || 0
  return s.value.queue || n > 0 ? ttModFill(L.value.waiting, { n }) : ''
})

async function load() {
  loading.value = true
  err.value = ''
  const r = await ttModCall(props, 'settings')
  loading.value = false
  if (r.signIn) return
  if (r.status === 403) { denied.value = true; emit('denied', 403); return }
  if (r.error) { err.value = ttModErrWord(L.value, r.status); return }
  s.value = { ...r.data }
  emit('load', { ...r.data })
}
async function flip(key) {
  if (!s.value || busy.value) return
  busy.value = key
  err.value = ''
  const r = await ttModCall(props, 'saveSettings', { [key]: !s.value[key] })
  busy.value = ''
  if (r.signIn) return
  if (r.status === 403) { denied.value = true; emit('denied', 403); return }
  if (r.error) { err.value = ttModErrWord(L.value, r.status); return }
  s.value = { ...s.value, ...r.data }
  emit('change', { ...s.value })
}
onMounted(() => { if (!s.value) load() })
defineExpose({ reload: load })
</script>
