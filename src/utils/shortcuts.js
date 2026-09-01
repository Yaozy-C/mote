const modifierCodes = new Set(["MetaLeft", "MetaRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "ShiftLeft", "ShiftRight"]);

export function primaryModifierLabel() {
  return "⌘";
}

export function shortcutFromEvent(event) {
  if (modifierCodes.has(event.code)) return null;
  const modifiers = [];
  if (event.metaKey) modifiers.push("Meta");
  if (event.ctrlKey) modifiers.push("Control");
  if (event.altKey) modifiers.push("Alt");
  if (event.shiftKey) modifiers.push("Shift");
  if (!modifiers.length) return null;
  return [...modifiers, event.code].join("+");
}

export function matchesShortcut(event, shortcut) {
  const parts = new Set(String(shortcut).split("+"));
  const code = [...parts].find((part) => !["Meta", "Control", "Alt", "Shift"].includes(part));
  return event.code === code
    && event.metaKey === parts.has("Meta")
    && event.ctrlKey === parts.has("Control")
    && event.altKey === parts.has("Alt")
    && event.shiftKey === parts.has("Shift");
}

export function formatShortcut(shortcut, locale = "en-US") {
  const labels = { Meta: "⌘", Control: "⌃", Alt: "⌥", Shift: "⇧", Space: locale.startsWith("zh") ? "空格" : "Space", Enter: "↵", Backspace: "⌫", Delete: "⌦", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };
  return String(shortcut).split("+").map((part) => labels[part] ?? part.replace(/^Key/, "").replace(/^Digit/, "")).join("");
}
