import * as fs from 'fs';
import type { WebSocket } from 'ws';
import type { AgentState, Broadcaster } from './types.js';
import { cancelWaitingTimer, cancelPermissionTimer } from './timerManager.js';
import { startFileWatching, readNewLines } from './fileWatcher.js';
import { readSettings } from './settings.js';

export function createAgentFromJsonl(
	jsonlFile: string,
	projectDir: string,
	nextAgentIdRef: { current: number },
	agents: Map<number, AgentState>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	broadcaster: Broadcaster | undefined,
): number {
	const id = nextAgentIdRef.current++;
	const agent: AgentState = {
		id,
		projectDir,
		jsonlFile,
		fileOffset: 0,
		lineBuffer: '',
		activeToolIds: new Set(),
		activeToolStatuses: new Map(),
		activeToolNames: new Map(),
		activeSubagentToolIds: new Map(),
		activeSubagentToolNames: new Map(),
		isWaiting: false,
		permissionSent: false,
		hadToolsInTurn: false,
	};

	agents.set(id, agent);
	console.log(`[Pixel Agents] Agent ${id}: created for ${jsonlFile}`);
	broadcaster?.postMessage({ type: 'agentCreated', id });

	// Start watching — read from beginning for full history
	startFileWatching(id, jsonlFile, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, broadcaster);
	readNewLines(id, agents, waitingTimers, permissionTimers, broadcaster);

	return id;
}

export function removeAgent(
	agentId: number,
	agents: Map<number, AgentState>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
): void {
	const agent = agents.get(agentId);
	if (!agent) return;

	fileWatchers.get(agentId)?.close();
	fileWatchers.delete(agentId);
	const pt = pollingTimers.get(agentId);
	if (pt) { clearInterval(pt); }
	pollingTimers.delete(agentId);
	try { fs.unwatchFile(agent.jsonlFile); } catch { /* ignore */ }

	cancelWaitingTimer(agentId, waitingTimers);
	cancelPermissionTimer(agentId, permissionTimers);

	agents.delete(agentId);
}

export function sendExistingAgents(
	agents: Map<number, AgentState>,
	broadcaster: Broadcaster | undefined,
): void {
	if (!broadcaster) return;
	const { msg, statuses } = buildExistingAgentsPayload(agents);
	broadcaster.postMessage(msg);
	for (const s of statuses) broadcaster.postMessage(s);
}

export function sendExistingAgentsTo(
	ws: WebSocket,
	agents: Map<number, AgentState>,
): void {
	const send = (msg: unknown) => {
		if (ws.readyState === 1) ws.send(JSON.stringify(msg));
	};
	const { msg, statuses } = buildExistingAgentsPayload(agents);
	send(msg);
	for (const s of statuses) send(s);
}

function buildExistingAgentsPayload(
	agents: Map<number, AgentState>,
): { msg: unknown; statuses: unknown[] } {
	const agentIds: number[] = [];
	for (const id of agents.keys()) {
		agentIds.push(id);
	}
	agentIds.sort((a, b) => a - b);

	const settings = readSettings();
	const agentMeta = settings.agentSeats;

	const msg = {
		type: 'existingAgents',
		agents: agentIds,
		agentMeta,
		folderNames: {},
	};

	const statuses = buildCurrentAgentStatuses(agents);
	return { msg, statuses };
}

function buildCurrentAgentStatuses(
	agents: Map<number, AgentState>,
): unknown[] {
	const messages: unknown[] = [];
	for (const [agentId, agent] of agents) {
		for (const [toolId, status] of agent.activeToolStatuses) {
			messages.push({
				type: 'agentToolStart',
				id: agentId,
				toolId,
				status,
			});
		}
		if (agent.isWaiting) {
			messages.push({
				type: 'agentStatus',
				id: agentId,
				status: 'waiting',
			});
		}
	}
	return messages;
}
