#!/usr/bin/env bash
# Regenerates the PWA icons in public/icons from the SVG sources in
# scripts/icons/. Requires librsvg (rsvg-convert). Run once after changing art.
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p public/icons

rsvg-convert -w 192 -h 192 scripts/icons/icon.svg -o public/icons/icon-192x192.png
rsvg-convert -w 512 -h 512 scripts/icons/icon.svg -o public/icons/icon-512x512.png
rsvg-convert -w 512 -h 512 scripts/icons/icon-maskable.svg -o public/icons/icon-maskable-512x512.png

# iOS applies its own mask, so it wants a full-bleed square underneath.
rsvg-convert -w 180 -h 180 scripts/icons/icon-maskable.svg -o public/icons/apple-touch-icon.png

ls -l public/icons
