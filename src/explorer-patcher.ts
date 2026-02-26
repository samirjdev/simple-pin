import { TFile, WorkspaceLeaf } from "obsidian";
import type SimplePinPlugin from "./main";
import type { FileExplorerView, FileItem } from "./types";

/**
 * Patches the File Explorer's sort behaviour so that pinned files
 * always appear at the top of their containing folder while preserving
 * the user's chosen sort order among both pinned and unpinned groups.
 *
 * Because the File Explorer internals are **not** part of Obsidian's
 * public API, every access is wrapped in defensive checks.  If a
 * future Obsidian update changes the internal structure the patch
 * will simply no-op and log a warning – the rest of the plugin
 * (pinning data, commands, context-menu) will keep working.
 */
export class ExplorerPatcher {
	private plugin: SimplePinPlugin;
	/** Keep a reference so we can un-patch on unload */
	private origSortFns = new WeakMap<object, Function>();
	private patched = false;

	constructor(plugin: SimplePinPlugin) {
		this.plugin = plugin;
	}

	/* ── public API ──────────────────────────────────── */

	/**
	 * Apply (or re-apply) the sort patch and refresh indicators.
	 * Safe to call repeatedly.
	 */
	patchAndRefresh(): void {
		try {
			const explorerLeaf = this.getExplorerLeaf();
			if (!explorerLeaf) return;

			const view = explorerLeaf.view as unknown as FileExplorerView;
			if (!view) return;

			this.patchFolderSorts(view);
			this.requestSort(view);
			this.updateIndicators(view);
		} catch (e) {
			console.warn("[Simple Pin] patchAndRefresh failed:", e);
		}
	}

	/**
	 * Refresh sorting + indicators without re-patching
	 */
	refresh(): void {
		try {
			const explorerLeaf = this.getExplorerLeaf();
			if (!explorerLeaf) return;
			const view = explorerLeaf.view as unknown as FileExplorerView;
			if (!view) return;
			this.requestSort(view);
			this.updateIndicators(view);
		} catch (e) {
			console.warn("[Simple Pin] refresh failed:", e);
		}
	}

	/**
	 * Remove all patches and indicators.
	 */
	unpatch(): void {
		try {
			const explorerLeaf = this.getExplorerLeaf();
			if (!explorerLeaf) return;
			const view = explorerLeaf.view as unknown as FileExplorerView;
			if (!view) return;

			// Remove pin indicators
			this.removeAllIndicators(view);

			// Restore original sort functions
			if (view.fileItems) {
				for (const item of Object.values(view.fileItems)) {
					if (item && item.sort) {
						const orig = this.origSortFns.get(item);
						if (orig) {
							item.sort = orig as () => void;
							this.origSortFns.delete(item);
						}
					}
				}
			}
			this.patched = false;

			this.requestSort(view);
		} catch (e) {
			console.warn("[Simple Pin] unpatch failed:", e);
		}
	}

	/* ── patching internals ──────────────────────────── */

	private getExplorerLeaf(): WorkspaceLeaf | null {
		const leaves =
			this.plugin.app.workspace.getLeavesOfType("file-explorer");
		return leaves[0] ?? null;
	}

	/**
	 * Walk every folder item in the explorer and monkey-patch
	 * its `sort()` method so that pinned children come first.
	 */
	private patchFolderSorts(view: FileExplorerView): void {
		if (!view.fileItems) {
			console.warn("[Simple Pin] fileItems not found on explorer view.");
			return;
		}

		for (const [, item] of Object.entries(view.fileItems)) {
			if (!item || !item.file || !("children" in item.file)) continue; // not a folder
			if (!item.sort || typeof item.sort !== "function") continue;

			// Avoid double-patching
			if (this.origSortFns.has(item)) continue;

			const origSort = item.sort.bind(item);
			this.origSortFns.set(item, origSort);

			// eslint-disable-next-line @typescript-eslint/no-this-alias
			const patcher = this;

			item.sort = function (this: FileItem) {
				try {
					// Run the original sort first (applies Obsidian's chosen sort order)
					origSort();

					const children = this.children;
					if (!children || children.length === 0) return;

					const pinnedSet = patcher.plugin.pinManager.getPinnedPaths();
					if (pinnedSet.size === 0) return;

					const pinned: FileItem[] = [];
					const unpinned: FileItem[] = [];

					for (const child of children) {
						if (
							child?.file &&
							pinnedSet.has(child.file.path)
						) {
							pinned.push(child);
						} else {
							unpinned.push(child);
						}
					}

					if (pinned.length === 0) return;

					// Reorder: pinned first (in their current sorted order), then unpinned
					children.length = 0;
					children.push(...pinned, ...unpinned);
				} catch (e) {
					console.warn("[Simple Pin] sort patch error:", e);
					// Fallback: just run the original
					origSort();
				}
			};
		}

		this.patched = true;
	}

	/**
	 * Trigger the explorer to re-sort.
	 */
	private requestSort(view: FileExplorerView): void {
		if (typeof view.requestSort === "function") {
			view.requestSort();
		}
	}

	/* ── indicator management ────────────────────────── */

	private static readonly INDICATOR_CLS = "simple-pin-indicator";

	updateIndicators(view: FileExplorerView): void {
		if (!view.fileItems) return;

		const show = this.plugin.settings.showPinIndicator;
		const pinnedSet = this.plugin.pinManager.getPinnedPaths();

		for (const [path, item] of Object.entries(view.fileItems)) {
			if (!item) continue;

			// Find the title element. Obsidian stores it in different places
			// depending on version — try several.
			const titleEl: HTMLElement | null | undefined =
				item.selfEl ?? item.innerEl ?? item.el;
			if (!titleEl) continue;

			// Remove any existing indicator
			const existing = titleEl.querySelector(
				`.${ExplorerPatcher.INDICATOR_CLS}`,
			);
			if (existing) existing.remove();

			if (show && pinnedSet.has(path)) {
				const indicator = createSpan({
					cls: ExplorerPatcher.INDICATOR_CLS,
					text: "\u{1F4CC} ", // 📌 + space
				});
				titleEl.prepend(indicator);
			}
		}
	}

	private removeAllIndicators(view: FileExplorerView): void {
		if (!view.fileItems) return;
		for (const item of Object.values(view.fileItems)) {
			if (!item) continue;
			const titleEl = item.selfEl ?? item.innerEl ?? item.el;
			if (!titleEl) continue;
			const existing = titleEl.querySelector(
				`.${ExplorerPatcher.INDICATOR_CLS}`,
			);
			if (existing) existing.remove();
		}
	}
}
