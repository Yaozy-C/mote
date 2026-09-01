const now = Date.now();

export const demoItems = [
  { id: 1, kind: "image", title: "Flower photograph", content: "/assets/dahlia-preview.png", detail: "Text + HTML + Image", byteSize: "287 KB", createdAt: now - 60_000, pinned: false, sourceAppId: "com.apple.Safari", sourceAppName: "Safari", ocrText: "Orange dahlia photographed in warm evening light.\nExposure: 1/250 s · f/2.8\nE = mc²", ocrStatus: "ready", ocrEngine: "PP-OCRv5 Mobile FP16", ocrConfidence: 0.94, ocrHasFormula: true, formats: ["text", "html", "image"], representations: [
    { itemIndex: 0, format: "text", content: "Orange dahlia photographed in warm evening light.", byteSize: null },
    { itemIndex: 0, format: "html", content: "<figure><img alt=\"Orange dahlia\"><figcaption>Warm evening light</figcaption></figure>", byteSize: null },
    { itemIndex: 0, format: "image", content: "/assets/dahlia-preview.png", byteSize: "287 KB" },
  ] },
  { id: 2, kind: "url", title: "https://www.nature.com", content: "https://www.nature.com", detail: "URL", byteSize: null, createdAt: now - 12 * 60_000, pinned: false },
  { id: 3, kind: "color", title: "#FFB347", content: "#FFB347", detail: "Color", byteSize: null, createdAt: now - 17 * 60_000, pinned: false },
  { id: 4, kind: "code", title: "fn fibonacci(n: u32) -> u32 {", content: "fn fibonacci(n: u32) -> u32 {\n  match n {\n    0 => 0,\n    1 => 1,\n    _ => fibonacci(n - 1) + fibonacci(n - 2),\n  }\n}", detail: "Rust Code · 7 lines", byteSize: null, createdAt: now - 26 * 60_000, pinned: false },
  { id: 5, kind: "text", title: "最好的风景总在路上。", content: "最好的风景总在路上。", detail: "Text · 10 characters", byteSize: null, createdAt: now - 43 * 60_000, pinned: false },
  { id: 6, kind: "text-green", title: "Design is not just what it looks like…", content: "Design is not just what it looks like and feels like. Design is how it works.", detail: "Text · 42 characters", byteSize: null, createdAt: now - 86_400_000, pinned: false },
  { id: 7, kind: "html", title: '<div class="flex items-center…"', content: '<div class="flex items-center">\n  <span>Mote</span>\n</div>', detail: "HTML · 3 lines", byteSize: null, createdAt: now - 90_000_000, pinned: false },
];

export const defaultSettings = {
  reduceMotion: false,
  captureEnabled: true,
  historyLimit: 500,
  hasSeenHelp: false,
  retentionDays: 30,
  launchAtLogin: false,
  directPaste: true,
  excludeSensitiveApps: false,
  openShortcut: "Alt+Space",
  batchShortcut: "Alt+Shift+Space",
  colorShortcut: "Alt+Shift+KeyC",
  screenshotShortcut: "Alt+Shift+KeyS",
  toggleBatchShortcut: "Meta+Shift+KeyM",
  language: "auto",
};
