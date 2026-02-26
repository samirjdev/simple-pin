import { Notice, Plugin, TAbstractFile, TFile, Menu } from "obsidian";
import { DEFAULT_SETTINGS, SimplePinSettings } from "./types";
import { PinManager } from "./pin-manager";
import { ExplorerPatcher } from "./explorer-patcher";
import { SimplePinSettingTab } from "./settings";

export default class SimplePinPlugin extends Plugin {
	settings: SimplePinSettings = { ...DEFAULT_SETTINGS };
	pinManager!: PinManager;
	private patcher!: ExplorerPatcher;

	/* ── lifecycle ─────────────────────────────────── */

	async onload() {
		await this.loadSettings();

		this.pinManager = new PinManager(this);
		this.patcher = new ExplorerPatcher(this);

		// Wait for layout to be ready before patching the explorer
		this.app.workspace.onLayoutReady(() => {
			this.patcher.patchAndRefresh();
		});

		// Re-patch when the explorer view is opened / restored
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				this.patcher.patchAndRefresh();
			}),
		);

		/* ── file-menu (right-click context menu) ────── */
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
				if (!(file instanceof TFile)) return;

				const pinned = this.pinManager.isPinned(file.path);

				menu.addItem((item) => {
					item
						.setTitle(pinned ? "Unpin" : "Pin")
						.setIcon(pinned ? "pin-off" : "pin")
						.onClick(async () => {
							await this.pinManager.toggle(file.path);
							this.refreshExplorer();
							new Notice(
								this.pinManager.isPinned(file.path)
									? `Pinned: ${file.name}`
									: `Unpinned: ${file.name}`,
							);
						});
				});
			}),
		);

		/* ── vault events: rename / delete ───────────── */
		this.registerEvent(
			this.app.vault.on("rename", (file: TAbstractFile, oldPath: string) => {
				void this.pinManager.handleRename(oldPath, file.path).then(() => {
					this.refreshExplorer();
				});
			}),
		);

		this.registerEvent(
			this.app.vault.on("delete", (file: TAbstractFile) => {
				void this.pinManager.handleDelete(file.path).then(() => {
					this.refreshExplorer();
				});
			}),
		);

		/* ── commands ────────────────────────────────── */
		this.addCommand({
			id: "pin-current-file",
			name: "Pin current file",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file) return false;
				if (this.pinManager.isPinned(file.path)) return false;
				if (!checking) {
					void this.pinManager.pin(file.path).then(() => {
						this.refreshExplorer();
						new Notice(`Pinned: ${file.name}`);
					});
				}
				return true;
			},
		});

		this.addCommand({
			id: "unpin-current-file",
			name: "Unpin current file",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file) return false;
				if (!this.pinManager.isPinned(file.path)) return false;
				if (!checking) {
					void this.pinManager.unpin(file.path).then(() => {
						this.refreshExplorer();
						new Notice(`Unpinned: ${file.name}`);
					});
				}
				return true;
			},
		});

		this.addCommand({
			id: "toggle-pin-current-file",
			name: "Toggle pin current file",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file) return false;
				if (!checking) {
					void this.pinManager.toggle(file.path).then((nowPinned) => {
						this.refreshExplorer();
						new Notice(
							nowPinned
								? `Pinned: ${file.name}`
								: `Unpinned: ${file.name}`,
						);
					});
				}
				return true;
			},
		});

		/* ── settings tab ────────────────────────────── */
		this.addSettingTab(new SimplePinSettingTab(this.app, this));
	}

	onunload() {
		this.patcher.unpatch();
	}

	/* ── settings persistence ─────────────────────── */

	async loadSettings() {
		const data = (await this.loadData()) as Partial<SimplePinSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/* ── helpers ───────────────────────────────────── */

	refreshExplorer(): void {
		this.patcher.patchAndRefresh();
	}
}
