#!/usr/bin/env node
/**
 * live-load.js
 *
 * Continuous background load generator for the dashboard.
 * Keeps all three services under realistic traffic so live metrics are meaningful.
 *
 * Each virtual user (VU) loops: register → 5 writes → 2 reports → repeat
 * Default: 30 VUs per service (90 total). Override with:
 *   VUS=50 node load-tests/live-load.js
 *
 * Usage:
 *   node load-tests/live-load.js          # foreground
 *   node load-tests/live-load.js &        # background (killed by stop script)
 */

const http = require('http')

const VUS_PER_SERVICE = parseInt(process.env.VUS || '30')

const SERVICES = [
  { name: 'monolithic',    base: process.env.MONO_URL || 'http://localhost:3001' },
  { name: 'microservices', base: process.env.MS_URL   || 'http://localhost:3002' },
  { name: 'hybrid',        base: process.env.HYBRID_URL || 'http://localhost:3003' },
]

// ── tiny http helper (no dependencies) ───────────────────────
function request(method, url, body, headers = {}) {
  return new Promise((resolve) => {
    const u = new URL(url)
    const opts = {
      hostname: u.hostname,
      port:     u.port || 80,
      path:     u.pathname + u.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      timeout: 8000,
    }
    if (body) {
      const b = JSON.stringify(body)
      opts.headers['Content-Length'] = Buffer.byteLength(b)
    }

    const req = http.request(opts, (res) => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, body: {} }) }
      })
    })
    req.on('error',   () => resolve({ status: 0,   body: {} }))
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: {} }) })
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── stats ─────────────────────────────────────────────────────
const stats = {}
SERVICES.forEach(s => { stats[s.name] = { ok: 0, err: 0 } })

// ── one virtual user loop ─────────────────────────────────────
async function vuLoop(service, vuId) {
  const { name, base } = service
  const username = `live_${name}_${vuId}_${Date.now()}`

  // Register once — retry until service is up
  let token = null
  while (!token) {
    const r = await request('POST', `${base}/api/auth/register`,
      { username, password: 'live123' })
    if (r.status === 201 && r.body.token) {
      token = r.body.token
    } else {
      await sleep(2000 + Math.random() * 1000)
    }
  }

  const auth = { Authorization: `Bearer ${token}` }

  // Main loop
  while (true) {
    // 5 write requests
    for (let i = 0; i < 5; i++) {
      const r = await request('POST', `${base}/api/data`,
        { title: `live_${Date.now()}`, content: 'background load payload' }, auth)
      r.status === 201 ? stats[name].ok++ : stats[name].err++
      await sleep(50 + Math.random() * 100)
    }

    // 2 report requests
    for (let i = 0; i < 2; i++) {
      const r = await request('GET', `${base}/api/report/summary`, null, auth)
      r.status === 200 ? stats[name].ok++ : stats[name].err++
      await sleep(50 + Math.random() * 100)
    }

    // Small pause between iterations (vary per VU to avoid thundering herd)
    await sleep(200 + Math.random() * 300)
  }
}

// ── print stats every 10s ─────────────────────────────────────
setInterval(() => {
  const lines = SERVICES.map(s => {
    const { ok, err } = stats[s.name]
    const total = ok + err
    const errPct = total > 0 ? ((err / total) * 100).toFixed(1) : '0.0'
    return `  ${s.name.padEnd(14)} ok=${ok}  err=${err}  err%=${errPct}`
  })
  console.log(`[live-load] ${new Date().toLocaleTimeString()} — cumulative requests:`)
  lines.forEach(l => console.log(l))
}, 10_000)

// ── launch all VUs ────────────────────────────────────────────
console.log(`[live-load] Starting ${VUS_PER_SERVICE} VUs × ${SERVICES.length} services = ${VUS_PER_SERVICE * SERVICES.length} total VUs`)
console.log(`[live-load] Override with: VUS=50 node load-tests/live-load.js`)
console.log()

SERVICES.forEach(service => {
  for (let i = 0; i < VUS_PER_SERVICE; i++) {
    // Stagger startup to avoid hammering on boot
    setTimeout(() => vuLoop(service, i), i * 80)
  }
})

process.on('SIGINT',  () => { console.log('\n[live-load] Stopped.'); process.exit(0) })
process.on('SIGTERM', () => { console.log('\n[live-load] Stopped.'); process.exit(0) })
