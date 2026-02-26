import type SimplePinPlugin from "./main";

/**
 * Patches the File Explorer's sort behaviour so that pinned files
 * always appear at the top of their containing folder while preserving
 * the user's chosen sort order among both pinned and unpinned groups.
 *
 * KEY APPROACH – prototype-level patching:
 *   Obsidian's folder tree items share a prototype with a `sort()` method.
 *   We wrap that prototype method *once* so that EVERY folder (including
 *   newly created ones and the vault root) automatically runs our
 *   pin-reorder logic after the original sort.  After rearranging the
 *   `children` data array we also reorder the DOM by calling
 *   `appendChild()` which *moves* existing nodes.
 *
 * Because the File Explorer internals are **not** part of Obsidian's
 * public API, every access is wrapped in defensive checks.  If a future
 * Obsidian update changes the internal structure the patch will simply
 * no-op and log a warning – the rest of the plugin keeps working.
 */
export class ExplorerPatcher {
	private plugin: SimplePinPlugin;
	/** The prototype we patched (so we can restore it) */
	private patchedProto: any = null;
	/** The original, unpatched sort function */
	private originalSort: Function | null = null;

	constructor(plugin: SimplePinPlugin) {
		this.plugin = plugin;
	}

	/* ═══════════════════════════════════════════════
	 *  Public API
	 * ═══════════════════════════════════════════════ */

	/** Ensure the sort prototype is patched, trigger a re-sort, and refresh indicators. */
	patchAndRefresh(): void {
		try {
			const view = this.getExplorerView();
			if (!view) return;

			this.ensurePatched(view);
			this.triggerSort(view);

			// Indicators are applied after a short delay so the DOM has
			// settled from the async requestSort() call.
			window.setTimeout(() => {
				try {
					this.updateIndicators();
				} catch (_) {
					/* swallow – non-critical */
				}
			}, 60);
		} catch (e) {
			console.warn("[Simple Pin] patchAndRefresh failed:", e);
		}
	}

	/** Re-sort + update indicators (prototype already patched). */
	refresh(): void {
		try {
			const view = this.getExplorerView();
			if (!view) return;
			this.triggerSort(view);
			window.setTimeout(() => {
				try {
					this.updateIndicators();
				} catch (_) {
					/* swallow */
				}
			}, 60);
		} catch (e) {
			console.warn("[Simple Pin] refresh failed:", e);
		}
	}

	/** Restore the original sort method and remove all indicators. */
	unpatch(): void {
		try {
			if (this.patchedProto && this.originalSort) {
				this.patchedProto.sort = this.originalSort;
				this.patchedProto = null;
				this.originalSort = null;
				console.log("[Simple Pin] Restored original file-explorer sort().");
			}
			this.removeAllIndicators();
			const view = this.getExplorerView();
			if (view) this.triggerSort(view);
		} catch (e) {
			console.warn("[Simple Pin] unpatch failed:", e);
		}
	}

	/* ═══════════════════════════════════════════════
	 *  Sort-prototype patching
	 * ═══════════════════════════════════════════════ */

	/**
	 * Find a folder item in the explorer, grab its shared prototype,
	 * and wrap `prototype.sort()` so every folder benefits from the
	 * pinning logic.  Safe to call repeatedly — patches only once.
	 */
	private ensurePatched(view: any): void {
		if (this.patchedProto) return; // already done

		const folderItem = this.findFolderItem(view);
		if (!folderItem) {
			console.warn(
				"[Simple Pin] No folder item found in file explorer — " +
					"cannot patch sort(). Pinning will persist but the " +
					"UI order will not change.",
			);
			return;
		}

		const proto = Object.getPrototypeOf(folderItem);
		if (!proto || typeof proto.sort !== "function") {
			console.warn(
				"[Simple Pin] Folder item prototype has no sort() method.",
			);
			return;
		}

		// Save originals so we can un-patch later
		const origSort = proto.sort;
		this.originalSort = origSort;
		this.patchedProto = proto;

		// Capture `this` (ExplorerPatcher) for use inside the patched fn.
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const patcher = this;

		// ── The actual patch ────────────────────────────────────────
		// `this` inside the function below will be the *folder item*
		// calling sort(), NOT the ExplorerPatcher.
		proto.sort = function (this: any) {
			// Step 1 — run Obsidian's original sort (honours the user's
			//          chosen sort mode: alphabetical, by date, etc.)
			origSort.call(this);

			// Step 2 — move pinned children to the front
			try {
				patcher.reorderFolder(this);
			} catch (e) {
				console.warn("[Simple Pin] reorderFolder error:", e);
			}
		};

		console.log(
			"[Simple Pin] Patched file-explorer sort() on prototype.",
		);
	}

	/* ═══════════════════════════════════════════════
	 *  Per-folder reorder (data array + DOM)
	 * ═══════════════════════════════════════════════ */

	/**
	 * Given a folder tree item whose children have just been sorted by
	 * Obsidian, partition them into [pinned…, unpinned…] preserving
	 * relative order within each group, then rewrite the array in-place
	 * and reorder the corresponding DOM nodes.
	 */
	private reorderFolder(folderItem: any): void {
		// Obsidian stores child items in different locations across
		// versions — try each known path defensively.
		const children: any[] | undefined =
			folderItem.vChildren?._children ?? // Obsidian ≥ 1.6+
			folderItem.vChildren?.children ?? // alternate layout
			folderItem.children; // older versions

		if (!children || children.length < 2) return;

		const pinnedSet = this.plugin.pinManager.getPinnedPaths();
		if (pinnedSet.size === 0) return;

		const pinned: any[] = [];
		const unpinned: any[] = [];

		for (const child of children) {
			const path: string | undefined = child?.file?.path;
			if (path !== undefined && pinnedSet.has(path)) {
				pinned.push(child);
			} else {
				unpinned.push(child);
			}
		}

		if (pinned.length === 0) return;

		// ── Rewrite the children array in-place ──────────────────
		const merged = [...pinned, ...unpinned];
		for (let i = 0; i < merged.length; i++) {
			children[i] = merged[i];
		}

		// ── Reorder DOM to match ─────────────────────────────────
		// `appendChild` on an existing child node *moves* it to the
		// end of its parent.  By appending in the new order we
		// rearrange the visible tree without creating / destroying
		// elements.
		for (const child of children) {
			const el: HTMLElement | undefined = child?.el;
			if (el?.parentElement) {
				el.parentElement.appendChild(el);
			}
		}
	}

	/* ═══════════════════════════════════════════════
	 *  Helpers
	 * ═══════════════════════════════════════════════ */

	/** Return the first file-explorer leaf's view, or null. */
	private getExplorerView(): any | null {
		const leaves =
			this.plugin.app.workspace.getLeavesOfType("file-explorer");
		return leaves[0]?.view ?? null;
	}

	/**
	 * Walk `view.fileItems` to find any folder item (i.e. one whose
	 * `.file` is a TFolder and that has a `sort` method).  We only
	 * need one — we patch its prototype which is shared by all.
	 */
	private findFolderItem(view: any): any | null {
		const items: Record<string, any> | undefined = view?.fileItems;
		if (!items) return null;

		for (const key of Object.keys(items)) {
			const it = items[key];
			if (
				it?.file &&
				"children" in it.file && // TFolder has a `children` property
				typeof it.sort === "function"
			) {
				return it;
			}
		}

		// Fallback: the root tree item might be separate
		const root = view.tree;
		if (root && typeof root.sort === "function") return root;

		return null;
	}

	/** Ask the explorer to re-sort all folders (async/queued internally). */
	private triggerSort(view: any): void {
		if (typeof view.requestSort === "function") {
			view.requestSort();
		}
	}

	/* ═══════════════════════════════════════════════
	 *  Pin indicators (📌 prefix)
	 * ═══════════════════════════════════════════════ */

	private static readonly CLS = "simple-pin-indicator";

	/** Add or remove 📌 indicators based on current pin state + settings. */
	updateIndicators(): void {
		const view = this.getExplorerView();
		const items: Record<string, any> | undefined = view?.fileItems;
		if (!items) return;

		const show = this.plugin.settings.showPinIndicator;
		const pinnedSet = this.plugin.pinManager.getPinnedPaths();

		for (const [path, item] of Object.entries(items)) {
			if (!item) continue;

			// Obsidian stores the title element under varying names.
			const titleEl: HTMLElement | undefined =
				item.selfEl ?? item.innerEl ?? item.el;
			if (!titleEl) continue;

			// Remove any existing indicator first
			titleEl
				.querySelector(`.${ExplorerPatcher.CLS}`)
				?.remove();

			if (show && pinnedSet.has(path)) {
				const span = createSpan({
					cls: ExplorerPatcher.CLS,
					text: "\u{1F4CC} ", // 📌 + thin space
				});
				titleEl.prepend(span);
			}
		}
	}

	/** Strip all indicators from every item. */
	removeAllIndicators(): void {
		const view = this.getExplorerView();
		const items: Record<string, any> | undefined = view?.fileItems;
		if (!items) return;

		for (const item of Object.values(items)) {
			if (!item) continue;
			const el: HTMLElement | undefined =
				(item as any).selfEl ??
				(item as any).innerEl ??
				(item as any).el;
			el?.querySelector(`.${ExplorerPatcher.CLS}`)?.remove();
		}
	}
}
