# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Mote visual direction

- Product name: Mote.
- Source visual: `public/assets/source-reference.png`.
- Preserve the warm luminous frosted-glass window, restrained coral selection/action color, content-rich preview, sparse ambient particles, precise desktop typography, and calm premium feel.
- The primary flow is search history, select an item, inspect it, then copy, pin, or delete it.
- Selected redesign direction: a native-neutral macOS split view with an integrated titlebar/toolbar, system materials, compact information density, neutral colors, and macOS system blue for selection and focus. Avoid broad pink tint, card-heavy web UI, oversized controls, and format tabs.
- Motion should feel native and functional: short interruptible transitions for selection, search focus, detail changes, menus/dialogs, and action confirmation. Keep ambient motion nearly invisible and fully honor Reduce Motion.
- Keep the macOS titlebar minimal: show neither the app logo nor the app name beside the native traffic-light controls.
- Use Tabler Icons for the paste, pin, and delete action group, with consistent 18px sizing and 1.75px strokes; do not use a return-arrow icon to represent paste.
- In multiple-paste previews, show the actual queued content (text/URL/code/file names, image thumbnails, or color swatches) instead of record titles and type labels.
- The multiple-paste detail pane is content-adaptive: use large visual cards when images/colors dominate, a comfortable list for a few text records, and a scrollable list for larger queues. Its content region should consume the available pane height instead of leaving a fixed blank area.
- A “combined copy” means one clipboard change containing multiple ordered pasteboard items (for example text plus an image), not merely alternate formats of one value. Store it as one history record, preserve item order and native representations, preview the items together, and restore the whole structure when copied or pasted.
- Ambient particles must remain visible in the native Tauri window, use restrained coral/gold/cream tones, stay behind the working UI, and prefer a GPU shader path with reduced-motion and rendering-failure fallbacks.
- Do not expose alternate clipboard representations as format tabs. One clipboard change is one user-facing record; choose its richest representation automatically and show multiple ordered pasteboard items as one combined preview.
- Distribute macOS builds through GitHub Releases. Mote should check the signed `latest.json` feed on launch, offer a manual check in Settings, show download progress, and restart only after a verified update is installed.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
