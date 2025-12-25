import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';

// MIME types for common file extensions
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

let httpServer: http.Server | null = null;

/**
 * Start an HTTP server to serve static files from a directory
 */
export function startHTTPServer(port: number, staticDir: string): void {
  const absoluteDir = path.resolve(staticDir);

  if (!fs.existsSync(absoluteDir)) {
    console.error(`[HTTP] Static directory not found: ${absoluteDir}`);
    console.error('[HTTP] Skipping HTTP server (dev mode?)');
    return;
  }

  httpServer = http.createServer((req, res) => {
    // Default to index.html for root or SPA routes
    let filePath = req.url === '/' ? '/index.html' : req.url || '/index.html';

    // Remove query strings
    filePath = filePath.split('?')[0];

    // Construct full path
    let fullPath = path.join(absoluteDir, filePath);

    // Security: prevent directory traversal
    if (!fullPath.startsWith(absoluteDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    // Check if file exists, fallback to index.html for SPA
    if (!fs.existsSync(fullPath)) {
      fullPath = path.join(absoluteDir, 'index.html');
    }

    // Read and serve file
    fs.readFile(fullPath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const ext = path.extname(fullPath).toLowerCase();
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(data);
    });
  });

  httpServer.listen(port, () => {
    console.error(`[HTTP] UI available at http://localhost:${port}`);
  });

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[HTTP] Port ${port} already in use, skipping HTTP server`);
    } else {
      console.error('[HTTP] Server error:', err);
    }
  });
}

/**
 * Close the HTTP server
 */
export function closeHTTPServer(): Promise<void> {
  return new Promise((resolve) => {
    if (httpServer) {
      httpServer.close(() => {
        console.error('[HTTP] Server closed');
        httpServer = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

/**
 * Check if we're in production mode (dist folder exists)
 */
export function isProductionMode(distPath: string): boolean {
  return fs.existsSync(path.resolve(distPath));
}
