import type SimplePinPlugin from "./main";

/**
 * Manages the set of pinned file paths –
 * add, remove, toggle, rename, delete, clear.
 * Persists changes through the plugin's saveSettings().
 */
export class PinManager {
	/** Fast lookup set kept in sync with settings.pinnedPaths */
	private pinned: Set<string>;
	private plugin: SimplePinPlugin;

	constructor(plugin: SimplePinPlugin) {
		this.plugin = plugin;
		this.pinned = new Set(plugin.settings.pinnedPaths);
	}

	/* ── queries ───────────────────────────────────── */

	isPinned(path: string): boolean {
		return this.pinned.has(path);
	}

	getPinnedPaths(): ReadonlySet<string> {
		return this.pinned;
	}

	/* ── mutations ──────────────────────────────────── */

	async pin(path: string): Promise<void> {
		if (this.pinned.has(path)) return;
		this.pinned.add(path);
		await this.persist();
	}

	async unpin(path: string): Promise<void> {
		if (!this.pinned.has(path)) return;
		this.pinned.delete(path);
		await this.persist();
	}

	async toggle(path: string): Promise<boolean> {
		if (this.pinned.has(path)) {
			await this.unpin(path);
			return false;
		}
		await this.pin(path);
		return true;
	}

	/** Handle file rename/move: transfer pin to new path */
	async handleRename(oldPath: string, newPath: string): Promise<void> {
		if (!this.pinned.has(oldPath)) return;
		this.pinned.delete(oldPath);
		this.pinned.add(newPath);
		await this.persist();
	}

	/** Handle file delete: remove pin */
	async handleDelete(path: string): Promise<void> {
		if (!this.pinned.has(path)) return;
		this.pinned.delete(path);
		await this.persist();
	}

	/** Remove all pins */
	async clearAll(): Promise<void> {
		this.pinned.clear();
		await this.persist();
	}

	/** Export pins as JSON string */
	exportJSON(): string {
		return JSON.stringify([...this.pinned], null, 2);
	}

	/** Import pins from JSON string (merges with existing) */
	async importJSON(json: string): Promise<number> {
		const arr: unknown = JSON.parse(json);
		if (!Array.isArray(arr)) throw new Error("Expected a JSON array of file paths");
		let added = 0;
		for (const item of arr) {
			if (typeof item === "string" && !this.pinned.has(item)) {
				this.pinned.add(item);
				added++;
			}
		}
		await this.persist();
		return added;
	}

	/* ── internal ───────────────────────────────────── */

	private async persist(): Promise<void> {
		this.plugin.settings.pinnedPaths = [...this.pinned];
		await this.plugin.saveSettings();
	}
}
