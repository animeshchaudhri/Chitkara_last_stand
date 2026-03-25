#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# run-all-tests.sh
# Runs k6 load tests SEQUENTIALLY across all architectures and
# VU levels (50 / 200 / 500), 3 runs each.
# Saves files as: {arch}_{vus}vu_run{n}_{timestamp}_summary.json
#
# Usage: bash load-tests/run-all-tests.sh
# ─────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"
mkdir -p "$RESULTS_DIR"

VU_LEVELS=(50 200 500)
RUNS=3

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Backend Architecture Load Test Suite               ║"
echo "║   VU levels: 50 / 200 / 500  ·  3 runs each         ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

run_one() {
  local arch="$1"    # monolithic | microservices | hybrid
  local script="$2"  # path to k6 script
  local port="$3"    # service port
  local vus="$4"     # VU level
  local run="$5"     # run number (1-3)

  local ts
  ts=$(date +%Y%m%d_%H%M%S)
  local base="${arch}_${vus}vu_run${run}_${ts}"

  echo "  → ${arch} @ ${vus} VUs  run ${run}/3"

  if ! curl -sf "http://localhost:${port}/health" > /dev/null 2>&1; then
    echo "  ⚠  ${arch} not reachable on port ${port} — skipping."
    return
  fi

  TARGET_VUS="$vus" k6 run \
    --out "json=$RESULTS_DIR/${base}.json" \
    --summary-export "$RESULTS_DIR/${base}_summary.json" \
    "$SCRIPT_DIR/$script" 2>&1 | grep -E '✓|✗|http_req_duration|error|VUs|default' || true

  echo "  ✓  Saved: ${base}_summary.json"
}

for vus in "${VU_LEVELS[@]}"; do
  echo ""
  echo "══════════════════════════════════════════════════════"
  echo "  Load level: ${vus} VUs"
  echo "══════════════════════════════════════════════════════"

  for run in $(seq 1 $RUNS); do
    echo ""
    echo "  Run ${run} of ${RUNS}"
    echo "  ──────────────────────────────────────────────────"

    run_one "monolithic"    "monolithic-test.js"    3001 "$vus" "$run"
    run_one "microservices" "microservices-test.js" 3002 "$vus" "$run"
    run_one "hybrid"        "hybrid-test.js"        3003 "$vus" "$run"

    # Brief pause between runs to let services recover
    if [ "$run" -lt "$RUNS" ]; then
      echo "  Cooling down 10s..."
      sleep 10
    fi
  done
done

echo ""
echo "════════════════════════════════════════════════════════"
echo "  All tests complete. Results saved in: $RESULTS_DIR"
echo "  Now run: node load-tests/summarize-results.js"
echo "════════════════════════════════════════════════════════"
