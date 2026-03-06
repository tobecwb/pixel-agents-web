import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LAYOUT_FILE_DIR, SETTINGS_FILE_NAME } from './constants.js';

interface Settings {
	soundEnabled: boolean;
	agentSeats: Record<string, { palette?: number; hueShift?: number; seatId?: string }>;
}

const defaultSettings: Settings = {
	soundEnabled: true,
	agentSeats: {},
};

function getSettingsFilePath(): string {
	return path.join(os.homedir(), LAYOUT_FILE_DIR, SETTINGS_FILE_NAME);
}

export function readSettings(): Settings {
	const filePath = getSettingsFilePath();
	try {
		if (!fs.existsSync(filePath)) return { ...defaultSettings };
		const raw = fs.readFileSync(filePath, 'utf-8');
		const parsed = JSON.parse(raw) as Partial<Settings>;
		return {
			soundEnabled: parsed.soundEnabled ?? defaultSettings.soundEnabled,
			agentSeats: parsed.agentSeats ?? defaultSettings.agentSeats,
		};
	} catch {
		return { ...defaultSettings };
	}
}

export function writeSettings(partial: Partial<Settings>): void {
	const filePath = getSettingsFilePath();
	const dir = path.dirname(filePath);
	try {
		const current = readSettings();
		const merged = { ...current, ...partial };
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		const tmpPath = filePath + '.tmp';
		fs.writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf-8');
		fs.renameSync(tmpPath, filePath);
	} catch (err) {
		console.error('[Settings] Failed to write settings:', err);
	}
}
