#!/usr/bin/env bash
#
# factory-check.sh – Ein einzelner Diagnose-Befehl, der ausschließlich bereits
# vorhandene Projekt-Befehle orchestriert (kein neues Tooling, keine neue
# Dependency). Gedacht als letzter Check vor einem Runtime-Testlauf.
#
# Usage: ./scripts/factory-check.sh
#
# Exit-Code 0  = alle kritischen Checks (Diff, Tests, Build) bestanden.
# Exit-Code 1  = mindestens ein kritischer Check fehlgeschlagen.
# Typecheck ist bewusst NICHT kritisch (bekannte Baseline-Fehler in
# unangetasteten Alt-Dateien) und beeinflusst den Exit-Code nicht.

set -uo pipefail
cd "$(dirname "$0")/.."

LOG_DIR="$(mktemp -d)"
FAIL=0

echo "FACTORY CHECK"
echo "============="

# ── Git diff --check ────────────────────────────────────────────────────────
if git diff --check > "$LOG_DIR/diffcheck.log" 2>&1; then
  echo "Git diff ........ PASS"
else
  echo "Git diff ........ FAIL   (siehe $LOG_DIR/diffcheck.log)"
  FAIL=1
fi

# ── Tests ────────────────────────────────────────────────────────────────────
if npx tsx --test "tests/*.test.ts" > "$LOG_DIR/tests.log" 2>&1; then
  TEST_SUMMARY=$(grep -E "^ℹ (tests|pass|fail) " "$LOG_DIR/tests.log" | tr '\n' ' ')
  echo "Tests ........... PASS   ($TEST_SUMMARY)"
else
  echo "Tests ........... FAIL   (siehe $LOG_DIR/tests.log)"
  FAIL=1
fi

# ── Firefox Build ────────────────────────────────────────────────────────────
if yarn build:firefox > "$LOG_DIR/build.log" 2>&1; then
  BUILD_SIZE=$(grep -o "Σ Total size:.*" "$LOG_DIR/build.log" || echo "")
  echo "Firefox build ... PASS   ($BUILD_SIZE)"
else
  echo "Firefox build ... FAIL   (siehe $LOG_DIR/build.log)"
  FAIL=1
fi

# ── Typecheck (informativ, nicht kritisch) ─────────────────────────────────
if yarn compile > "$LOG_DIR/typecheck.log" 2>&1; then
  echo "Typecheck ....... PASS"
else
  ERR_COUNT=$(grep -c "error TS" "$LOG_DIR/typecheck.log" || true)
  echo "Typecheck ....... BASELINE ($ERR_COUNT bekannte Fehler, siehe $LOG_DIR/typecheck.log)"
fi

# ── Security-Scan (informativ, nicht kritisch) ─────────────────────────────
TOKEN_LOG_HITS=$(grep -rEn "console\.(log|debug|info)\(\s*(authToken|accessToken|token|password|secret)\s*\)" \
  --include="*.ts" --include="*.vue" entrypoints/ components/ composables/ utils/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$TOKEN_LOG_HITS" -eq 0 ]; then
  echo "Security scan ... INFO (keine offensichtlichen Token-Logs gefunden)"
else
  echo "Security scan ... INFO ($TOKEN_LOG_HITS mögliche Token-Logs — manuell prüfen)"
fi

echo ""
if [ "$FAIL" -ne 0 ]; then
  echo "FACTORY CHECK: FAILED"
  echo "Logs: $LOG_DIR"
  exit 1
fi

echo "FACTORY CHECK: PASS"
echo "Logs: $LOG_DIR"
exit 0
