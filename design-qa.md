# Design QA — Mote Transient UI and Titlebar Interactions

- Source visual truth: current captured surfaces before refinement — `.audit/02-settings.png`, `.audit/03-shortcuts.png`, `.audit/04-help.png`
- Implementation screenshots: `.audit/09-settings-final.png`, `.audit/10-shortcuts-final.png`, `.audit/11-help-final.png`, `.audit/08-clear-confirm-refined.png`
- Combined comparisons: `.audit/comparison-settings.jpg`, `.audit/comparison-shortcuts.jpg`, `.audit/comparison-help.jpg`
- Viewport: 1280 × 720 CSS px
- Source pixels: 1280 × 720 each
- Implementation pixels: 1280 × 720 each at browser density 1
- Density normalization: none; source and implementation are equal-size captures
- State: Simplified Chinese, demo clipboard history, permissions ready, global-shortcut category, first help topic

## Findings

No actionable P0, P1, or P2 issues remain.

- Fonts and typography: system typography remains unchanged. Decorative eyebrow labels and repeated subtitles were removed, leaving one clear title and compact 11–13 px control text. Small permission labels remain readable at the target desktop scale.
- Spacing and layout rhythm: Settings is narrower and shorter; Shortcut settings no longer reserves a sidebar or empty footer region; Help groups related capabilities into dense rows; destructive confirmation is left-aligned and compact. Radii, separators, and shadows remain consistent with the existing macOS-neutral design.
- Colors and visual tokens: all surfaces continue to use the existing neutral materials, system blue selection/focus, green readiness, amber permission warning, and red destructive action tokens.
- Image quality and asset fidelity: no new raster assets were needed. Removing redundant Mote logos from transient surfaces avoids competing with task content; existing real content previews remain intact.
- Copy and content: Settings removes descriptions when the label is self-explanatory and reveals detail for permission exceptions. Shortcut rows retain command names and key combinations. Help preserves every major capability and its visual example while reducing navigation from 15 pages to 5 topics.
- Accessibility and interaction: dialogs retain semantic roles, accessible names, Escape/outside-click dismissal, labeled close controls where needed, and keyboard-operable categories. Permission refresh keeps visible state feedback. Destructive confirmation retains explicit Cancel and destructive actions.
- Titlebar actions: all six icon buttons now share the same hover surface, press feedback, keyboard focus ring, localized tooltip, and accessible name. Configurable shortcuts appear in the two relevant tooltips; open Settings, Help, and Shortcut surfaces expose `aria-pressed` and a visible blue active state. The disabled Pin action remains hoverable through its wrapper and explains why it is unavailable in multiple-selection mode.

Focused-region evidence was required because the task concerned small transient surfaces. The three combined comparison images show each original surface and its same-viewport replacement together; the final clear-history screenshot verifies the compact alert grammar.

## Comparison History

1. Initial audit found repeated identity/title content, duplicate dismissal controls, a full sidebar for three shortcut categories, 15 isolated Help pages, repeated row descriptions, and fixed-height empty space.
2. First implementation collapsed Settings permissions into one readiness summary, moved Shortcut categories into a segmented control, grouped Help into five topics, and simplified destructive confirmation.
3. Visual review found the Shortcut dialog still held a fixed empty region. Its height was changed to content-driven sizing with a bounded scrolling list; Help height was tightened.
4. Final same-viewport captures show no remaining actionable P0/P1/P2 issue. Browser console errors: none.

## Primary Interactions Tested

- Open Settings and inspect permission/general state.
- Switch Shortcut settings from Global actions to Browse & reuse.
- Open Help and advance from Getting started to Rich content.
- Open Privacy and reach the clear-history alert without executing deletion.
- Close modal surfaces through their intended controls.
- Hover every titlebar action, open Settings to verify the pressed/active state, and enter multiple selection to verify the disabled Pin explanation.

## Implementation Checklist

- [x] Remove redundant transient-surface logos, subtitles, and eyebrow labels.
- [x] Keep permission readiness visible while showing details only for exceptions.
- [x] Make Shortcut settings content-sized and keyboard-category navigation functional.
- [x] Group Help into five topics while retaining visual examples for all capabilities.
- [x] Remove duplicate dismissal affordances from alert/update/error dialogs.
- [x] Verify the production build and browser interactions.

## Follow-up Polish

- P3: verify optical weight and material blur once more in a packaged native Tauri window; browser capture validates the webview rendering but not macOS vibrancy composition.

final result: passed
