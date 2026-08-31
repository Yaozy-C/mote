# Mote

**English** · [简体中文](README.zh-CN.md)

Mote is a private clipboard history app for macOS and Windows. It quietly records what you copy, makes it searchable, and lets you paste one item—or an ordered group of items—back into the app you were using.

![Mote product interface](public/assets/mote-interface.png)

## What Mote does

- Records text, links, colors, code, HTML, images, and files automatically.
- Keeps multiple formats from one copy operation together as a single history record.
- Shows the richest useful preview instead of exposing format tabs.
- Searches clipboard history instantly.
- Pastes directly into the previously active app.
- Builds a multiple-paste list and pastes it from the earliest copy to the latest.
- Pins frequently reused records.
- Restores accidentally deleted or cleared records with a seven-second Undo action.
- Detects files that have moved or been deleted.
- Opens the macOS system screen color sampler from a configurable global shortcut; one click copies the HEX value and saves it as a color record, while `Escape` cancels.
- Extracts a color palette from images and copies colors as HEX or RGB.
- Stores all history locally in SQLite.
- Checks GitHub Releases for signed application updates.
- Supports English and Simplified Chinese.

## Platforms

| Platform | Package | Automatic paste | Notes |
| --- | --- | --- | --- |
| macOS (Apple Silicon and Intel) | DMG | Uses macOS Accessibility permission | Native pasteboard representations, ordered pasteboard items, and the system screen color sampler are supported. |
| Windows 10/11 x64 | NSIS installer (`.exe`) | Uses the standard `Ctrl+V` input path | Text, HTML, images, files, and available combined formats are preserved. Native screen color picking is not yet available. |

Download the newest build from [GitHub Releases](https://github.com/Yaozy-C/mote/releases/latest).

### Install on macOS without an Apple developer account

The macOS release is built in public GitHub Actions, but it is not notarized by Apple. Apple may therefore show “Apple could not verify Mote is free of malware” the first time it is opened.

1. Open the downloaded DMG and drag **Mote** into **Applications**.
2. Double-click **Mote** once. When macOS shows the verification warning, choose **Done** instead of moving the app to the Trash.
3. Open **System Settings → Privacy & Security**, scroll to **Security**, and click **Open Anyway** next to the Mote message.
4. Authenticate when prompted, then confirm **Open**. Normal double-clicking works after this one-time approval.

Do not disable Gatekeeper globally. Each release also includes `SHA256SUMS.txt`; run `shasum -a 256 <downloaded-file>` and compare the result with that file before installing.

## Keyboard shortcuts

Every application shortcut can be changed from **Settings → Keyboard shortcuts**.

| Action | macOS default | Windows default |
| --- | --- | --- |
| Open Mote | `Option + Space` | `Ctrl + Shift + Space` |
| Open multiple paste | `Option + Shift + Space` | `Ctrl + Alt + Space` |
| Pick a screen color | `Option + Shift + C` | Not yet available |
| Toggle multiple selection while Mote is open | `Command + Shift + M` | `Ctrl + Shift + M` |
| Search | `Command + K` | `Ctrl + K` |
| Paste selected content | `Enter` | `Enter` |
| Copy selected content without pasting | `Command + Enter` | `Ctrl + Enter` |

Sampled colors are copied immediately and stored as normal color records, so they can be searched, pinned, copied as HEX or RGB, and restored later. Mote deduplicates the picker result and the clipboard event into one history record.

## Privacy and permissions

Mote does not require an account or a cloud service. Clipboard records and cached image previews stay in the operating system's application-data directory and are stored in a local SQLite database.

- **macOS:** Accessibility permission is only used to send the paste shortcut to the app that was active before Mote opened. Opening System Settings does not grant access by itself: turn on the Mote switch under **Privacy & Security → Accessibility**. If macOS still reports Mote as untrusted, quit and reopen Mote after enabling it.
- **Windows:** no separate accessibility permission is required. Windows may prevent a normal application from pasting into an application running as administrator.
- **Sensitive apps:** optional password-manager exclusion prevents Mote from recording clipboard changes while a recognized sensitive app is active.

## Development

### Requirements

- Node.js 22 or later
- npm
- Rust 1.77.2 or later
- Platform build tools:
  - macOS: Xcode Command Line Tools
  - Windows: Visual Studio 2022 Build Tools with the Desktop development with C++ workload, plus WebView2

### Run the desktop app

```bash
npm install
npm run desktop:dev
```

### Build and test

```bash
npm run build
npm run test:sites
cargo test --manifest-path src-tauri/Cargo.toml
```

Create the native package on its matching operating system:

```bash
# macOS
npm run desktop:bundle:dmg

# Windows
npm run desktop:bundle:windows
```

## Project structure

```text
src/                         React interface
  components/                History, preview, Help, Settings, and dialogs
  hooks/                     Clipboard-history and updater state
  services/                  Tauri command bridge and browser demo fallback
  utils/                     Cross-platform shortcut helpers
src-tauri/                   Native Tauri application
  src/database.rs            SQLite storage, search, retention, and Undo
  src/watcher.rs             Clipboard monitoring and snapshot creation
  src/platform.rs            macOS and Windows clipboard/paste integration
  src/commands.rs            Commands exposed to the interface
.github/workflows/release.yml  macOS and Windows GitHub Release builds
worker/                      Sites-compatible web preview worker
```

## Releases and updates

Pushing a version tag such as `v0.3.0` runs the release workflow. It builds Apple Silicon and Intel DMGs, a Windows x64 NSIS installer, updater artifacts, `latest.json`, and a consolidated `SHA256SUMS.txt`. Mote uses that GitHub Release metadata for in-app update checks.

The updater artifacts are cryptographically signed. The macOS application uses an ad-hoc signature and is not Apple-notarized; the Windows installer is not Authenticode-signed. Fresh machines may therefore show an unverified-developer or unknown-publisher warning.
