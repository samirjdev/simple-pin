# Simple Pin

An Obsidian plugin that lets you **pin files to the top** of their containing folder in the File Explorer sidebar.

## Features

- **Right-click to pin/unpin** any file in the File Explorer.
- Pinned files appear **at the top of their folder**, above unpinned files.
- Works with **all six Obsidian sort modes**: filename A→Z / Z→A, modified time new→old / old→new, created time new→old / old→new.
- Within the pinned section, the current sort order is preserved.
- Optional **📌 indicator** next to pinned file names (toggle in settings).
- **Commands**: "Pin current file", "Unpin current file", "Toggle pin current file".
- Pins **follow renames/moves** and are **removed on delete**.
- **Export/import** pins as JSON from the settings tab.
- Pure UI ordering — **no files are moved on disk**.

## How it works

The plugin patches the internal File Explorer's `sort()` method on folder items so that, after Obsidian's normal sort runs, pinned children are moved to the front of the list. This is a non-destructive, UI-only reorder.

Because this relies on Obsidian's internal (non-public) File Explorer API, the patching is wrapped in defensive checks. If a future Obsidian update changes the internal structure, the sort patch will gracefully no-op and log a console warning — pinning data, commands, and the context menu will continue to work normally.

## Installation

### From source (development)

1. Clone this repository into your vault's plugin folder:

   ```bash
   cd <your-vault>/.obsidian/plugins/
   git clone <repo-url> simple-pin
   cd simple-pin
   ```

2. Install dependencies and build:

   ```bash
   npm install
   npm run build
   ```

3. Reload Obsidian and enable **Simple Pin** in **Settings → Community plugins**.

### Manual install (release)

1. Download `main.js`, `manifest.json`, and `styles.css` from a release.
2. Create `<your-vault>/.obsidian/plugins/simple-pin/`.
3. Copy the three files into that folder.
4. Reload Obsidian and enable the plugin.

## Development

```bash
# Watch mode – rebuilds on every change
npm run dev

# Production build (minified, no sourcemaps)
npm run build
```

## Usage

| Action | How |
|---|---|
| Pin a file | Right-click a file in the File Explorer → **Pin** |
| Unpin a file | Right-click a pinned file → **Unpin** |
| Pin/unpin via command palette | `Ctrl/Cmd + P` → "Pin current file" / "Unpin current file" / "Toggle pin current file" |
| Toggle pin indicator | **Settings → Simple Pin → Show pin indicator** |
| Clear all pins | **Settings → Simple Pin → Clear all pins** |
| Export pins | **Settings → Simple Pin → Export** (copies JSON to clipboard) |
| Import pins | **Settings → Simple Pin → Import** (paste JSON array of paths) |

## Settings

| Setting | Default | Description |
|---|---|---|
| Show pin indicator | On | Display a 📌 emoji next to pinned files |
| Clear all pins | — | Button to remove all pins at once |
| Export pins | — | Copy pinned paths as JSON |
| Import pins | — | Add pins from a pasted JSON array |

## Limitations

- This plugin patches Obsidian's **internal** File Explorer view, which is not part of the public API. It may break with major Obsidian updates. If patching fails, the plugin degrades gracefully.
- Only **files** (TFile) can be pinned, not folders.
- Pinning is per-vault (stored in the plugin's data file).

## License

[0-BSD](LICENSE)
