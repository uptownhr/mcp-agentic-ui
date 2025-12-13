import { WebSocketServer, WebSocket } from 'ws';
import { getSnapshot, getAvailableActions } from './machine.js';

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

export interface StateUpdate {
  currentState: string;
  text: string;
  historyCount: number;
  lastAction: string | null;
  lastError: string | null;
}

export function startWebSocketServer(port: number) {
  wss = new WebSocketServer({ port });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.error(`WebSocket client connected. Total: ${clients.size}`);

    // Send initial state on connection
    const snapshot = getSnapshot();
    const state = String(snapshot.value);
    const context = snapshot.context;

    ws.send(
      JSON.stringify({
        type: 'state_update',
        data: {
          currentState: state,
          text: context.text,
          historyCount: context.history.length,
          lastAction: context.lastAction,
          lastError: context.lastError,
          availableActions: getAvailableActions(state, context),
        },
      })
    );

    ws.on('close', () => {
      clients.delete(ws);
      console.error(`WebSocket client disconnected. Total: ${clients.size}`);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  console.error(`WebSocket server started on port ${port}`);
}

export function broadcastState(update: StateUpdate) {
  const snapshot = getSnapshot();
  const state = String(snapshot.value);
  const context = snapshot.context;

  const message = JSON.stringify({
    type: 'state_update',
    data: {
      ...update,
      availableActions: getAvailableActions(state, context),
    },
    timestamp: new Date().toISOString(),
  });

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

export function getClientCount() {
  return clients.size;
}

export function closeWebSocketServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!wss) {
      resolve();
      return;
    }

    // Close all client connections
    for (const client of clients) {
      client.close(1000, 'Server shutting down');
    }
    clients.clear();

    // Close the server
    wss.close((err) => {
      if (err) {
        console.error('Error closing WebSocket server:', err);
      } else {
        console.error('WebSocket server closed');
      }
      wss = null;
      resolve();
    });
  });
}

export function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(false);
    });

    server.listen(port);
  });
}
