// @vitest-environment jsdom
// The kit runs its conformance suite on its two sample instances, as an instance runs it on its own.
import { resolve } from 'node:path'
import { ttConformance } from '../../conformance/index.js'
import { SAMPLE_DAY, SAMPLE_PATH } from './samples.js'

const goldens = resolve(__dirname, 'goldens')
ttConformance({ ...SAMPLE_DAY, goldens })
ttConformance({ ...SAMPLE_PATH, goldens })
