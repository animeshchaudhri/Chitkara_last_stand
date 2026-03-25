/**
 * k6 Load Test — MONOLITHIC (Port 3001)
 *
 * Usage:
 *   k6 run load-tests/monolithic-test.js
 *   TARGET_VUS=200 k6 run load-tests/monolithic-test.js
 *
 * Stages: 30s ramp-up → 3 min hold → 30s ramp-down
 * Iteration: authenticate + 5 data writes + 2 report reads
 * Errors: 5xx responses and timeouts only
 */

import http from 'k6/http'
import { check } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const monoErrorRate     = new Rate('mono_error_rate')
const monoDataLatency   = new Trend('mono_data_latency',   true)
const monoReportLatency = new Trend('mono_report_latency', true)

const TARGET_VUS = parseInt(__ENV.TARGET_VUS || '50')
const BASE       = __ENV.BASE_URL || 'http://localhost:3001'

export const options = {
  stages: [
    { duration: '30s', target: TARGET_VUS },
    { duration: '3m',  target: TARGET_VUS },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<10000'],
    mono_error_rate:   ['rate<0.10'],
  },
}

const jsonHeaders = { 'Content-Type': 'application/json' }
const params = { timeout: '10s' }

export default function () {
  // ── Authenticate ─────────────────────────────────────────────
  const user  = `mono_${__VU}_${__ITER}`
  const creds = JSON.stringify({ username: user, password: 'pass123' })

  http.post(`${BASE}/api/auth/register`, creds, { headers: jsonHeaders, ...params })

  const loginRes = http.post(`${BASE}/api/auth/login`, creds, { headers: jsonHeaders, ...params })
  const token    = loginRes.json('token') || ''
  const authHdrs = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  // ── 5 data writes ─────────────────────────────────────────────
  for (let i = 0; i < 5; i++) {
    const body = JSON.stringify({ value: Math.random() * 1000, label: `item_${i}` })
    const res  = http.post(`${BASE}/api/data`, body, { headers: authHdrs, ...params })
    monoDataLatency.add(res.timings.duration)
    const isErr = res.status >= 500 || res.status === 0
    monoErrorRate.add(isErr)
    check(res, { 'mono write <500': r => r.status < 500 })
  }

  // ── 2 report reads ────────────────────────────────────────────
  for (let i = 0; i < 2; i++) {
    const res = http.get(`${BASE}/api/report/summary`, { headers: authHdrs, ...params })
    monoReportLatency.add(res.timings.duration)
    const isErr = res.status >= 500 || res.status === 0
    monoErrorRate.add(isErr)
    check(res, { 'mono report <500': r => r.status < 500 })
  }
}
