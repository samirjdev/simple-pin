/**
 * Plugin settings persisted via loadData/saveData.
 */
export interface SimplePinSettings {
	/** Show a pin indicator (📌) prefix in the file explorer */
	showPinIndicator: boolean;
	/** Array of pinned file paths (vault-relative) */
	pinnedPaths: string[];
}

export const DEFAULT_SETTINGS: SimplePinSettings = {
	showPinIndicator: true,
	pinnedPaths: [],
};
