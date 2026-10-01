#!/bin/sh
# Copies the built server and view into the extension folder and packs it.
set -e
cd "$(dirname "$0")"
pnpm build
mkdir -p mcpb/server
cp dist/server.js dist/view.html mcpb/server/
npx mcpb validate mcpb/manifest.json
npx mcpb pack mcpb anachoic-probe.mcpb
