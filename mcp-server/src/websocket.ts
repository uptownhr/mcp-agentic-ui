import { WebSocketServer, WebSocket } from 'ws';
import { getSnapshot, getAvailableActions, sendEvent, type InputRequest, type InputStatus, type TextMachineEvent } from './machine.js';

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

export interface StateUpdate {
  currentState: string;
  text: string;
  contentType: 'text' | 'markdown';
  historyCount: number;
  lastAction: string | null;
  lastError: string | null;
  inputRequest: InputRequest | null;
  inputStatus: InputStatus;
  userInput: string | null;
  userContext?: Record<string, unknown>;
}

// Incoming message types from frontend
export interface IncomingMessage {
  type: 'submit_input' | 'cancel_input';
  payload: {
    requestId: string;
    value?: string;
  };
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
          contentType: context.contentType,
          historyCount: context.history.length,
          lastAction: context.lastAction,
          lastError: context.lastError,
          inputRequest: context.inputRequest,
          inputStatus: context.inputStatus,
          userInput: context.userInput,
          userContext: context.userContext,
          availableActions: getAvailableActions(state, context),
        },
      })
    );

    // Handle incoming messages from frontend
    ws.on('message', (data) => {
      try {
        const message: IncomingMessage = JSON.parse(data.toString());
        handleIncomingMessage(message);
      } catch (error) {
        console.error('Failed to parse incoming message:', error);
      }
    });

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

// Handle incoming messages from frontend
function handleIncomingMessage(message: IncomingMessage) {
  let event: TextMachineEvent;

  switch (message.type) {
    case 'submit_input':
      event = {
        type: 'SUBMIT_INPUT',
        value: message.payload.value || '',
        requestId: message.payload.requestId,
      };
      break;
    case 'cancel_input':
      event = {
        type: 'CANCEL_INPUT',
        requestId: message.payload.requestId,
      };
      break;
    default:
      console.error('Unknown message type:', message.type);
      return;
  }

  // Send event to state machine
  const newSnapshot = sendEvent(event);
  const newState = String(newSnapshot.value);
  const newContext = newSnapshot.context;

  // Broadcast updated state to all clients
  broadcastState({
    currentState: newState,
    text: newContext.text,
    contentType: newContext.contentType,
    historyCount: newContext.history.length,
    lastAction: newContext.lastAction,
    lastError: newContext.lastError,
    inputRequest: newContext.inputRequest,
    inputStatus: newContext.inputStatus,
    userInput: newContext.userInput,
    userContext: newContext.userContext,
  });
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
