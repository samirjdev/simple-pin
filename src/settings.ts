import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type SimplePinPlugin from "./main";

export class SimplePinSettingTab extends PluginSettingTab {
	plugin: SimplePinPlugin;

	constructor(app: App, plugin: SimplePinPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Simple Pin settings" });

		/* ── Pin indicator toggle ─────────────────────── */
		new Setting(containerEl)
			.setName("Show pin indicator")
			.setDesc("Display a 📌 icon next to pinned files in the File Explorer.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showPinIndicator)
					.onChange(async (value) => {
						this.plugin.settings.showPinIndicator = value;
						await this.plugin.saveSettings();
						this.plugin.refreshExplorer();
					}),
			);

		/* ── Clear all pins ───────────────────────────── */
		new Setting(containerEl)
			.setName("Clear all pins")
			.setDesc("Remove every pinned file at once.")
			.addButton((btn) =>
				btn
					.setButtonText("Clear all")
					.setWarning()
					.onClick(async () => {
						await this.plugin.pinManager.clearAll();
						this.plugin.refreshExplorer();
						new Notice("All pins cleared.");
					}),
			);

		/* ── Export pins ──────────────────────────────── */
		new Setting(containerEl)
			.setName("Export pins")
			.setDesc("Copy pinned paths as JSON to clipboard.")
			.addButton((btn) =>
				btn.setButtonText("Export").onClick(async () => {
					const json = this.plugin.pinManager.exportJSON();
					await navigator.clipboard.writeText(json);
					new Notice("Pinned paths copied to clipboard.");
				}),
			);

		/* ── Import pins ──────────────────────────────── */
		new Setting(containerEl)
			.setName("Import pins")
			.setDesc("Paste a JSON array of file paths to add as pins.")
			.addText((text) =>
				text.setPlaceholder('["path/to/file.md", ...]'),
			)
			.addButton((btn) =>
				btn.setButtonText("Import").onClick(async () => {
					const input = containerEl.querySelector<HTMLInputElement>(
						".setting-item:last-child input",
					);
					const raw = input?.value ?? "";
					if (!raw.trim()) {
						new Notice("Paste a JSON array first.");
						return;
					}
					try {
						const count =
							await this.plugin.pinManager.importJSON(raw);
						this.plugin.refreshExplorer();
						new Notice(`Imported ${count} new pin(s).`);
					} catch {
						new Notice("Invalid JSON. Expected an array of paths.");
					}
				}),
			);
	}
}
