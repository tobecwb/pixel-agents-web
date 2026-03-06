import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { WebSocketServer } from 'ws';
import type { WsHandlerState } from './wsHandler.js';
import { readLayoutFromFile } from './layoutPersistence.js';

const MIME_TYPES: Record<string, string> = {
	'.html': 'text/html',
	'.js': 'application/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.svg': 'image/svg+xml',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
};

export function createServer(
	webviewDir: string,
	handler: WsHandlerState,
	port: number,
): { start(): void } {
	const server = http.createServer((req, res) => {
		const url = new URL(req.url || '/', `http://localhost:${port}`);
		const pathname = url.pathname;

		// API routes
		if (pathname === '/api/export-layout' && req.method === 'GET') {
			const layout = readLayoutFromFile();
			if (!layout) {
				res.writeHead(404, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ error: 'No layout found' }));
				return;
			}
			const json = JSON.stringify(layout, null, 2);
			res.writeHead(200, {
				'Content-Type': 'application/json',
				'Content-Disposition': 'attachment; filename="pixel-agents-layout.json"',
			});
			res.end(json);
			return;
		}

		// Static file serving — resolve and validate path stays within webviewDir
		const resolvedWebview = path.resolve(webviewDir);
		let filePath = path.resolve(webviewDir, pathname === '/' ? 'index.html' : '.' + pathname);

		// Prevent path traversal: resolved path must be within webviewDir
		if (!filePath.startsWith(resolvedWebview + path.sep) && filePath !== resolvedWebview) {
			res.writeHead(403);
			res.end('Forbidden');
			return;
		}

		// Check if file exists
		if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
			// SPA fallback
			filePath = path.join(webviewDir, 'index.html');
		}

		try {
			const ext = path.extname(filePath).toLowerCase();
			const contentType = MIME_TYPES[ext] || 'application/octet-stream';
			const content = fs.readFileSync(filePath);
			res.writeHead(200, { 'Content-Type': contentType });
			res.end(content);
		} catch {
			res.writeHead(404);
			res.end('Not Found');
		}
	});

	// WebSocket
	const wss = new WebSocketServer({ noServer: true });

	server.on('upgrade', (req, socket, head) => {
		if (req.url === '/ws') {
			wss.handleUpgrade(req, socket, head, (ws) => {
				handler.handleConnection(ws);
			});
		} else {
			socket.destroy();
		}
	});

	return {
		start() {
			server.listen(port, '127.0.0.1', () => {
				console.log(`\nPixel Agents running at http://localhost:${port}\n`);
			});
		},
	};
}
