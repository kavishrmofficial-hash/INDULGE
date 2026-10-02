# fx: the effects the page ships

The six effects m360 OS uses are the real packages from Libraries.dev and React Bits, bundled once into
`src/js/00-a-fx.vendor.js` and exposed on `window.FX`. The page has no module system (one page, three
script tags, a strict content policy), so the bundle rides inside the page like every other module,
ahead of the m360 code. React, ReactDOM and the JSX runtime resolve to the page's own copies through
`shims/`, so every component shares the React the app runs on.

| Effect | Package | Where |
|---|---|---|
| Orb | `thinking-orbs` | every "thinking" line (size 20), the orb screen on the phone (64, listening), the phone's buddy button (32, breathing) |
| Beam | `border-beam` | any flame card and hot fold (sunset), the thought for the day (colorful, slow) |
| Voice | `voice-glow` | under the Ask input while the mic is live, gathering into a beam while the answer comes; the bottom of the orb screen |
| Bots | `bot-avatars` | beside the AI's words in Ask (clover, flame), in the buddy's bubble (droid) |
| Metal | `metal-fx` | the New button, Check in, That was my day, Ask, Another |
| Bell | React Bits `BellToggle` (`BellToggle.jsx`, `src/css/90-bell.vendor.css`) | the notifications card on Home |

The wrappers in `src/js/01-z-fx.js` (`M.fx.Orb`, `Beam`, `Metal`, `Voice`, `Bot`, `Bell`) pick the
house colours and theme and stand down to the plain child when the bundle is missing or the person asked
for reduced motion.

## Rebuilding the bundle

```bash
cd m360-os/fx
npm install
./build.sh          # writes ../src/js/00-a-fx.vendor.js
cd .. && python3 build.py && python3 harness/conformance.py
```

The bundle is committed, so the page build and the EdgeOne deploy never need npm. `harness/conformance.py`
skips `*.vendor.js` and `*.vendor.css`: they are other people's code, kept as shipped (the bell's default
colours moved to the m360 palette, and em dashes replaced in strings, since the page build refuses them).
