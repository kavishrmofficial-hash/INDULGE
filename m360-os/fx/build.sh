#!/bin/bash
# Bundles the effects (fx/entry.jsx and the packages in fx/node_modules) into one plain script,
# src/js/00-a-fx.vendor.js, which the page build inlines before the m360 modules. React, ReactDOM and
# the JSX runtime resolve to the page's own copies through fx/shims. Run after `npm install` here.
set -e
cd "$(dirname "$0")"
OUT=../src/js/00-a-fx.vendor.js
python3 patches.py
npx esbuild entry.jsx --bundle --minify --format=iife --target=es2020 --jsx=automatic \
  --alias:react=./shims/react.js --alias:react-dom=./shims/react-dom.js --alias:react/jsx-runtime=./shims/jsx-runtime.js \
  --alias:react/jsx-dev-runtime=./shims/jsx-runtime.js --alias:react-dom/client=./shims/react-dom.js \
  --define:process.env.NODE_ENV=\"production\" --legal-comments=none --log-level=warning --outfile=$OUT.tmp
# the page build refuses em and en dashes anywhere, and a bundle has them in its strings
python3 - "$OUT" <<'EOF'
import sys
p = sys.argv[1]
s = open(p + '.tmp', encoding='utf-8').read()
s = s.replace('—', '-').replace('–', '-')
head = ("/* vendor: the effects from Libraries.dev (thinking-orbs, border-beam, voice-glow, bot-avatars, metal-fx) and\n"
        "   BellToggle from React Bits, bundled by fx/build.sh. Never edited by hand; conformance skips .vendor.js. */\n")
open(p, 'w', encoding='utf-8').write(head + s)
EOF
rm -f "$OUT.tmp"
ls -la "$OUT" | awk '{print $5, $9}'
