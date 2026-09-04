# Mote transient UI audit

## Scope

Settings, keyboard shortcuts, Help, and destructive confirmation at 1280 × 720. User goal: change preferences or understand an action without reading repeated supporting text. Accessibility target: clear hierarchy, keyboard-operable controls, visible status, and unambiguous recovery/dismissal.

## Flow and health

1. Main window — healthy. The titlebar actions are compact and discoverable; the working UI remains visible behind transient surfaces.
2. Settings — healthy after refinement. One title, four compact categories, one permission summary, and task-focused rows replace repeated branding, section labels, and ready-state descriptions.
3. Keyboard shortcuts — healthy after refinement. Three top categories and one compact command list replace the oversized intro, sidebar, row descriptions, footer explanation, and Done button.
4. Help — healthy after refinement. Five topic pages replace fifteen isolated slides; every major capability still has a visible example.
5. Clear history confirmation — healthy after refinement. One title, one consequence statement, Cancel, and the destructive action replace the duplicate close affordance and decorative warning block.
6. Titlebar actions — healthy after refinement. Every icon now exposes an immediate localized tooltip, consistent hover/press/focus treatment, and an active state for owned transient surfaces; disabled Pin still explains its unavailable state.

## Highest-impact changes

- Show explanations only when a permission or action needs attention.
- Use one dismissal model per surface: close button for browsable tools, explicit Cancel for destructive alerts.
- Let compact tools size to content; reserve fixed height only when stable topic navigation prevents layout jump.
- Keep Settings a popover and Shortcut/Help focused dialogs so their interaction models stay distinct.

## Evidence

- Before: `02-settings.png`, `03-shortcuts.png`, `04-help.png`
- After: `09-settings-final.png`, `10-shortcuts-final.png`, `11-help-final.png`, `08-clear-confirm-refined.png`
- Same-frame comparisons: `comparison-settings.jpg`, `comparison-shortcuts.jpg`, `comparison-help.jpg`

## Evidence limits

Screenshots confirm hierarchy, density, and visible contrast risks, but not full assistive-technology behavior or native macOS vibrancy. DOM inspection confirmed dialog roles and accessible control names; packaged-app keyboard and VoiceOver behavior still need native validation.
