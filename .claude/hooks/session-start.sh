#!/usr/bin/env bash
set -e
echo "AUTODARTS SESSION START"
echo "Projekt: $(pwd)"
echo "Branch: $(git branch --show-current 2>/dev/null || echo unbekannt)"
echo "Git-Status:"
git status --short 2>/dev/null || true
