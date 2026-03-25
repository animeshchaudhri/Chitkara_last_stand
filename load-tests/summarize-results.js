#!/usr/bin/env node
/**
 * summarize-results.js
 *
 * Reads all k6 _summary.json files from load-tests/results/,
 * averages the 3 runs per (architecture × VU-level) combination,
 * and writes load-tests/results/benchmark_summary.json
 *
 * The dashboard reads this file to show the benchmark comparison table.
 *
 * Usage: node load-tests/summarize-results.js
 */

const fs   = require('fs')
const path = require('path')

const RESULTS_DIR  = path.join(__dirname, 'results')
const PUBLIC_DIR   = path.join(__dirname, '..', 'dashboard', 'public')
const OUT_FILE     = path.join(RESULTS_DIR, 'benchmark_summary.json')
const PUBLIC_FILE  = path.join(PUBLIC_DIR, 'benchmark_summary.json')

const ARCHS    = ['monolithic', 'microservices', 'hybrid']
const VU_LEVELS = [50, 200, 500]

// ── helpers ──────────────────────────────────────────────────────────────────

function avg(arr) {
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function round2(n) {
  return n === null ? null : Math.round(n * 100) / 100
}

/**
 * Extract key metrics from a k6 summary JSON file.
 * k6 --summary-export produces a flat object of metric stats.
 */
function extractFromSummary(summaryPath, arch) {
  const raw = JSON.parse(fs.readFileSync(summaryPath, 'utf8'))

  const prefix = arch === 'monolithic' ? 'mono'
               : arch === 'microservices' ? 'ms'
               : 'hybrid'

  // k6 --summary-export stores stats directly on the metric object (no .values nesting)
  // Rate metrics use 'value' (0–1); Trend metrics use 'avg', 'p(95)', etc.
  const get = (metric, stat) => raw.metrics?.[metric]?.[stat] ?? null

  return {
    avgResponseTime: round2(get('http_req_duration', 'avg')),
    p95ResponseTime: round2(get('http_req_duration', 'p(95)')),
    // Rate metric 'value' is 0–1; multiply by 100 for percentage
    errorRate:       round2((get(`${prefix}_error_rate`, 'value') ?? 0) * 100),
    // requests per second × 60
    requestsPerMin:  round2((get('http_reqs', 'rate') ?? 0) * 60),
    totalRequests:   get('http_reqs', 'count') ?? 0,
    // data and report endpoint p95 latency
    dataP95:         round2(get(`${prefix}_data_latency`, 'p(95)')),
    reportP95:       round2(get(`${prefix}_report_latency`, 'p(95)')),
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

const summaryFiles = fs.readdirSync(RESULTS_DIR)
  .filter(f => f.endsWith('_summary.json'))

if (!summaryFiles.length) {
  console.error('No _summary.json files found in', RESULTS_DIR)
  console.error('Run: bash load-tests/run-all-tests.sh first.')
  process.exit(1)
}

// Group files by (arch, vus)
// Filename pattern: {arch}_{vus}vu_run{n}_{timestamp}_summary.json
const groups = {}

for (const file of summaryFiles) {
  const m = file.match(/^(monolithic|microservices|hybrid)_(\d+)vu_run\d+_\d+_\d+_summary\.json$/)
  if (!m) continue
  const [, arch, vus] = m
  const key = `${arch}_${vus}`
  if (!groups[key]) groups[key] = []
  groups[key].push(path.join(RESULTS_DIR, file))
}

// Build output
const result = {
  source: 'k6',
  generatedAt: new Date().toISOString(),
  vuLevels: VU_LEVELS,
  architectures: ARCHS,
  data: {},
}

for (const arch of ARCHS) {
  result.data[arch] = {}
  for (const vus of VU_LEVELS) {
    const key = `${arch}_${vus}`
    const files = groups[key] || []

    if (!files.length) {
      console.warn(`  ⚠  No results for ${arch} @ ${vus} VUs`)
      result.data[arch][vus] = null
      continue
    }

    const runs = files.map(f => {
      try { return extractFromSummary(f, arch) }
      catch (e) { console.warn(`  Skipping ${f}: ${e.message}`); return null }
    }).filter(Boolean)

    if (!runs.length) {
      result.data[arch][vus] = null
      continue
    }

    // Average across runs
    const keys = Object.keys(runs[0])
    const averaged = {}
    for (const k of keys) {
      averaged[k] = round2(avg(runs.map(r => r[k]).filter(v => v !== null)))
    }
    averaged.runsAveraged = runs.length

    result.data[arch][vus] = averaged
    console.log(`  ✓ ${arch} @ ${vus} VUs — averaged ${runs.length} run(s)`)
  }
}

const json = JSON.stringify(result, null, 2)
fs.writeFileSync(OUT_FILE, json)
console.log(`\nWrote: ${OUT_FILE}`)

// Also copy to dashboard public folder so it's served by Vite / the built app
if (fs.existsSync(PUBLIC_DIR)) {
  fs.writeFileSync(PUBLIC_FILE, json)
  console.log(`Copied: ${PUBLIC_FILE}`)
}
