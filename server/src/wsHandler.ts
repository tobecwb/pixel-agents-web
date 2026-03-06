import * as fs from 'fs';
import type { WebSocket } from 'ws';
import type { AgentState, Broadcaster } from './types.js';
import { createAgentFromJsonl, removeAgent, sendExistingAgentsTo } from './agentManager.js';
import { ensureProjectScan } from './fileWatcher.js';
import {
	loadFurnitureAssets, loadFloorTiles, loadWallTiles, loadCharacterSprites, loadDefaultLayout,
} from './assetLoader.js';
import { readSettings, writeSettings } from './settings.js';
import { writeLayoutToFile, loadLayout, watchLayoutFile } from './layoutPersistence.js';
import type { LayoutWatcher } from './layoutPersistence.js';

export interface WsHandlerState {
	agents: Map<number, AgentState>;
	clients: Set<WebSocket>;
	broadcaster: Broadcaster;
	handleConnection(ws: WebSocket): void;
	dispose(): void;
}

export async function createWsHandler(
	projectDir: string,
	assetsRoot: string,
): Promise<WsHandlerState> {
	const agents = new Map<number, AgentState>();
	const clients = new Set<WebSocket>();

	// Timer maps
	const fileWatchers = new Map<number, fs.FSWatcher>();
	const pollingTimers = new Map<number, ReturnType<typeof setInterval>>();
	const waitingTimers = new Map<number, ReturnType<typeof setTimeout>>();
	const permissionTimers = new Map<number, ReturnType<typeof setTimeout>>();
	const knownJsonlFiles = new Set<string>();
	const projectScanTimerRef = { current: null as ReturnType<typeof setInterval> | null };
	const nextAgentIdRef = { current: 1 };

	// Broadcaster sends to all connected clients
	const broadcaster: Broadcaster = {
		postMessage(msg: unknown) {
			const data = JSON.stringify(msg);
			for (const client of clients) {
				if (client.readyState === 1 /* WebSocket.OPEN */) {
					client.send(data);
				}
			}
		},
	};

	// Load all assets
	console.log('[Server] Loading assets...');
	const charSprites = await loadCharacterSprites(assetsRoot);
	const floorTiles = await loadFloorTiles(assetsRoot);
	const wallTiles = await loadWallTiles(assetsRoot);
	const furnitureAssets = await loadFurnitureAssets(assetsRoot);
	const defaultLayout = loadDefaultLayout(assetsRoot);

	// Prepare cached asset messages
	const cachedMessages: unknown[] = [];

	if (charSprites) {
		cachedMessages.push({
			type: 'characterSpritesLoaded',
			characters: charSprites.characters,
		});
	}
	if (floorTiles) {
		cachedMessages.push({
			type: 'floorTilesLoaded',
			sprites: floorTiles.sprites,
		});
	}
	if (wallTiles) {
		cachedMessages.push({
			type: 'wallTilesLoaded',
			sprites: wallTiles.sprites,
		});
	}
	if (furnitureAssets) {
		const spritesObj: Record<string, string[][]> = {};
		for (const [id, spriteData] of furnitureAssets.sprites) {
			spritesObj[id] = spriteData;
		}
		cachedMessages.push({
			type: 'furnitureAssetsLoaded',
			catalog: furnitureAssets.catalog,
			sprites: spritesObj,
		});
	}

	// Verify layout exists (write default if needed)
	loadLayout(defaultLayout);

	// Start layout watcher
	let layoutWatcher: LayoutWatcher | null = watchLayoutFile((newLayout) => {
		console.log('[Server] External layout change — pushing to clients');
		broadcaster.postMessage({ type: 'layoutLoaded', layout: newLayout });
	});

	// Start project directory scanning
	ensureProjectScan(projectDir, knownJsonlFiles, projectScanTimerRef, (jsonlFile: string) => {
		createAgentFromJsonl(
			jsonlFile, projectDir, nextAgentIdRef, agents,
			fileWatchers, pollingTimers, waitingTimers, permissionTimers,
			broadcaster,
		);
	});

	function sendTo(ws: WebSocket, msg: unknown): void {
		if (ws.readyState === 1 /* WebSocket.OPEN */) {
			ws.send(JSON.stringify(msg));
		}
	}

	function handleConnection(ws: WebSocket): void {
		clients.add(ws);
		console.log(`[Server] Client connected (${clients.size} total)`);

		ws.on('close', () => {
			clients.delete(ws);
			console.log(`[Server] Client disconnected (${clients.size} total)`);
		});

		ws.on('message', (raw: Buffer | string) => {
			try {
				const message = JSON.parse(typeof raw === 'string' ? raw : raw.toString()) as Record<string, unknown>;
				handleMessage(ws, message);
			} catch {
				// Ignore malformed messages
			}
		});
	}

	function handleMessage(ws: WebSocket, message: Record<string, unknown>): void {
		const type = message.type as string;

		if (type === 'webviewReady') {
			sendFullState(ws);
		} else if (type === 'saveLayout') {
			if (message.layout && typeof message.layout === 'object') {
				layoutWatcher?.markOwnWrite();
				writeLayoutToFile(message.layout as Record<string, unknown>);
			}
		} else if (type === 'saveAgentSeats') {
			if (message.seats && typeof message.seats === 'object') {
				writeSettings({ agentSeats: message.seats as Record<string, { palette?: number; hueShift?: number; seatId?: string }> });
			}
		} else if (type === 'setSoundEnabled') {
			if (typeof message.enabled === 'boolean') {
				writeSettings({ soundEnabled: message.enabled });
			}
		} else if (type === 'closeAgent') {
			const agentId = message.id;
			if (typeof agentId !== 'number') return;
			removeAgent(agentId, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers);
			broadcaster.postMessage({ type: 'agentClosed', id: agentId });
		} else if (type === 'importLayout') {
			const imported = message.layout as Record<string, unknown> | undefined;
			if (imported && typeof imported === 'object' && imported.version === 1 && Array.isArray(imported.tiles)) {
				layoutWatcher?.markOwnWrite();
				writeLayoutToFile(imported);
				broadcaster.postMessage({ type: 'layoutLoaded', layout: imported });
			}
		}
		// Ignore: openClaude, focusAgent, openSessionsFolder, exportLayout (handled via HTTP)
	}

	function sendFullState(ws: WebSocket): void {
		// Settings
		const settings = readSettings();
		sendTo(ws, { type: 'settingsLoaded', soundEnabled: settings.soundEnabled });

		// Cached asset messages
		for (const msg of cachedMessages) {
			sendTo(ws, msg);
		}

		// Existing agents BEFORE layout — the frontend buffers agents in pendingAgents
		// and drains them when layoutLoaded arrives. If layout comes first, buffer is empty.
		sendExistingAgentsTo(ws, agents);

		// Layout (drains the pendingAgents buffer in the frontend)
		const currentLayout = loadLayout(defaultLayout);
		if (currentLayout) {
			sendTo(ws, { type: 'layoutLoaded', layout: currentLayout });
		}
	}

	return {
		agents,
		clients,
		broadcaster,
		handleConnection,
		dispose() {
			layoutWatcher?.dispose();
			layoutWatcher = null;
			if (projectScanTimerRef.current) {
				clearInterval(projectScanTimerRef.current);
				projectScanTimerRef.current = null;
			}
			for (const id of [...agents.keys()]) {
				removeAgent(id, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers);
			}
		},
	};
}
