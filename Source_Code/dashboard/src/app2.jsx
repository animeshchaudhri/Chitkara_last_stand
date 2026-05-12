import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import MetricsOverview from './components/MetricsOverview'
import ResponseTimeChart from './components/ResponseTimeChart'
import ErrorRateChart from './components/ErrorRateChart'
import MemoryChart from './components/MemoryChart'
import ComparisonTable from './components/ComparisonTable'
import ThroughputGauge from './components/ThroughputGauge'
import LiveIndicator from './components/LiveIndicator'
import BenchmarkResults from './components/BenchmarkResults'
import './App.css'

// Endpoints — when running via Vite proxy, use /metrics/* paths
// When running standalone, point directly to the services
// In Docker: env vars point to nginx proxy paths on the same host.
// In dev (Vite): falls back to direct localhost service ports.
const ENDPOINTS = {
  monolithic:    import.meta.env.VITE_MONO_URL    || 'http://localhost:3001/metrics',
  microservices: import.meta.env.VITE_MS_URL      || 'http://localhost:3002/metrics',
  hybrid:        import.meta.env.VITE_HYBRID_URL  || 'http://localhost:3003/metrics',
}

const ARCH_COLORS = {
  monolithic:    '#3b82f6',   // blue
  microservices: '#f59e0b',   // amber
  hybrid:        '#10b981',   // emerald
}

const ARCH_LABELS = {
  monolithic:    'Monolithic',
  microservices: 'Microservices',
  hybrid:        'Hybrid',
}

const POLL_INTERVAL = 3000  // ms

// Default / placeholder snapshot when a service is unreachable
const emptySnapshot = (arch) => ({
  architecture: arch,
  totalRequests: 0,
  totalErrors: 0,
  avgResponseTime: 0,
  p95ResponseTime: 0,
  requestsPerMinute: 0,
  errorRate: 0,
  uptimeSeconds: 0,
  memoryMB: 0,
  online: false,
})

export default function App() {
  const [snapshots, setSnapshots] = useState({
    monolithic:    emptySnapshot('monolithic'),
    microservices: emptySnapshot('microservices'),
    hybrid:        emptySnapshot('hybrid'),
  })
  const [history, setHistory] = useState([])   // [{ts, mono, ms, hybrid}]
  const [lastUpdated, setLastUpdated] = useState(null)
  const [pollCount, setPollCount]     = useState(0)

  const fetchAll = useCallback(async () => {
    const results = await Promise.allSettled(
      Object.entries(ENDPOINTS).map(([key, url]) =>
        axios.get(url, { timeout: 2500 }).then(r => ({ key, data: { ...r.data, online: true } }))
      )
    )

    const next = { ...snapshots }
    results.forEach(r => {
      if (r.status === 'fulfilled') {
        next[r.value.key] = r.value.data
      } else {
        // keep previous values but mark offline if parse failed
        const key = Object.keys(ENDPOINTS)[results.indexOf(r)]
        if (key) next[key] = { ...next[key], online: false }
      }
    })

    setSnapshots(next)
    setLastUpdated(new Date())
    setPollCount(c => c + 1)

    setHistory(prev => {
      const point = {
        ts:    Date.now(),
        label: new Date().toLocaleTimeString(),
        monolithic:    next.monolithic.avgResponseTime,
        microservices: next.microservices.avgResponseTime,
        hybrid:        next.hybrid.avgResponseTime,
        monoRpm:       next.monolithic.requestsPerMinute,
        msRpm:         next.microservices.requestsPerMinute,
        hybridRpm:     next.hybrid.requestsPerMinute,
        monoError:     next.monolithic.errorRate,
        msError:       next.microservices.errorRate,
        hybridError:   next.hybrid.errorRate,
      }
      const updated = [...prev, point]
      return updated.length > 60 ? updated.slice(-60) : updated
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [fetchAll])

  return (
    <div className="app">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="header">
        <div className="header-left">
          <h1>🏗️ Backend Architecture Dashboard</h1>
          <p className="subtitle">Practical Comparative Study — Scalable &amp; Secure Backends</p>
        </div>
        <div className="header-right">
          <LiveIndicator snapshots={snapshots} pollCount={pollCount} />
          {lastUpdated && (
            <span className="last-updated">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button className="refresh-btn" onClick={fetchAll}>⟳ Refresh</button>
        </div>
      </header>

      <main className="main">
        {/* ── Architecture Status Cards ──────────────── */}
        <section className="section">
          <h2 className="section-title">Live Architecture Metrics</h2>
          <MetricsOverview snapshots={snapshots} colors={ARCH_COLORS} labels={ARCH_LABELS} />
        </section>

        {/* ── Response Time Chart ─────────────────────── */}
        <section className="section">
          <h2 className="section-title">Avg Response Time Over Time (ms)</h2>
          <ResponseTimeChart history={history} colors={ARCH_COLORS} labels={ARCH_LABELS} />
        </section>

        {/* ── Two-column grid: Throughput + Memory ────── */}
        <div className="two-col-grid">
          <section className="section">
            <h2 className="section-title">Requests / Minute</h2>
            <ThroughputGauge snapshots={snapshots} colors={ARCH_COLORS} labels={ARCH_LABELS} />
          </section>

          <section className="section">
            <h2 className="section-title">Memory Usage (MB)</h2>
            <MemoryChart snapshots={snapshots} colors={ARCH_COLORS} labels={ARCH_LABELS} />
          </section>
        </div>

        {/* ── Error Rate Chart ────────────────────────── */}
        <section className="section">
          <h2 className="section-title">Error Rate Over Time (%)</h2>
          <ErrorRateChart history={history} colors={ARCH_COLORS} labels={ARCH_LABELS} />
        </section>

        {/* ── Live Comparison Table ───────────────────────── */}
        <section className="section">
          <h2 className="section-title">Live Side-by-Side Comparison</h2>
          <p className="section-subtitle">
            Continuous background load · ~30 VUs per service · metrics exclude /health and /metrics polls ·
            Microservices adds 20–35 ms inter-service hop · Hybrid adds 18–30 ms gateway overhead
          </p>
          <ComparisonTable snapshots={snapshots} colors={ARCH_COLORS} labels={ARCH_LABELS} />
        </section>

        {/* ── Benchmark Results (from k6 runs) ────────────── */}
        <section className="section">
          <h2 className="section-title">Load Test Benchmark Results</h2>
          <p className="section-subtitle">
            Results averaged over 3 runs per load level · 30s ramp-up → 3 min hold → 30s ramp-down ·
            Each iteration: 5 write + 2 report requests · 10s timeout
          </p>
          <BenchmarkResults />
        </section>
      </main>

      <footer className="footer">
        Research Study · Three backends · Auto-polling every {POLL_INTERVAL / 1000}s ·
        Run <code>bash load-tests/run-all-tests.sh</code> then <code>node load-tests/summarize-results.js</code> to populate benchmarks
      </footer>
    </div>
  )
}
