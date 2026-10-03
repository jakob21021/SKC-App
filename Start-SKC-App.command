#!/bin/bash
# Startet die SKC-App lokal (macOS: Doppelklick, Linux: ./Start-SKC-App.command)
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Bitte zuerst Node.js installieren: https://nodejs.org (LTS-Version)"
  read -r -p "Enter zum Schließen"
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Einmalige Einrichtung: lade Bausteine herunter …"
  npm install || { read -r -p "Enter zum Schließen"; exit 1; }
fi
npm run lokal
