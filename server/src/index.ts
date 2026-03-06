import * as path from 'path';
import * as os from 'os';
import { DEFAULT_PORT } from './constants.js';
import { createWsHandler } from './wsHandler.js';
import { createServer } from './server.js';

function getProjectDirPath(cwd: string): string {
	const dirName = cwd.replace(/[^a-zA-Z0-9-]/g, '-');
	return path.join(os.homedir(), '.claude', 'projects', dirName);
}

async function main(): Promise<void> {
	// Parse args
	let port = DEFAULT_PORT;
	let openBrowser = false;

	const args = process.argv.slice(2);
	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--port' && args[i + 1]) {
			const parsed = parseInt(args[i + 1], 10);
			if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
				port = parsed;
			}
			i++;
		} else if (args[i] === '--open') {
			openBrowser = true;
		}
	}

	const cwd = process.cwd();
	const projectDir = getProjectDirPath(cwd);
	console.log(`[Pixel Agents] Watching project: ${cwd}`);
	console.log(`[Pixel Agents] JSONL dir: ${projectDir}`);

	// __dirname is the dist/ folder where index.cjs lives
	// Assets are at dist/assets/, and the loader joins assetsRoot + 'assets/...'
	const assetsRoot = __dirname;

	// Webview files are in dist/webview/
	const webviewDir = path.join(__dirname, 'webview');

	const handler = await createWsHandler(projectDir, assetsRoot);
	const server = createServer(webviewDir, handler, port);
	server.start();

	process.on('SIGINT', () => {
		handler.dispose();
		process.exit(0);
	});
	process.on('SIGTERM', () => {
		handler.dispose();
		process.exit(0);
	});

	if (openBrowser) {
		const { exec } = await import('child_process');
		const url = `http://localhost:${port}`;
		const cmd = process.platform === 'darwin' ? `open ${url}` : process.platform === 'win32' ? `start ${url}` : `xdg-open ${url}`;
		exec(cmd);
	}
}

main().catch((err) => {
	console.error('Failed to start Pixel Agents server:', err);
	process.exit(1);
});
