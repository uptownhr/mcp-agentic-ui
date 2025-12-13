#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  getSnapshot,
  sendEvent,
  getAvailableActions,
  type TextMachineEvent,
} from './machine.js';
import { startWebSocketServer, broadcastState, closeWebSocketServer, isPortInUse } from './websocket.js';

// App description
const APP_INFO = {
  name: 'Agentic UI Prototype',
  purpose: 'A simple text display controlled by AI through state machine actions',
  capabilities: [
    'Display text on screen',
    'Set text to any value',
    'Append text to existing content',
    'Clear all text',
    'Undo changes (with history)',
    'Reset to initial state',
  ],
  stateDescription: {
    idle: 'No text is being displayed',
    displaying: 'Text is visible on screen',
  },
};

// Create MCP server
const server = new Server(
  {
    name: 'agentic-ui-prototype',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_app_info',
        description: 'Get information about what this app does and its capabilities',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_current_state',
        description: 'Get the current state of the app, including displayed text and available actions',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'execute_action',
        description: 'Execute an action to change the app state. Must be one of the available actions from get_current_state.',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description: 'The action name (e.g., set_text, append_text, clear_text, undo, reset)',
            },
            payload: {
              type: 'object',
              description: 'Action payload - for set_text/append_text, include { text: "your text" }',
            },
          },
          required: ['action'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'get_app_info': {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(APP_INFO, null, 2),
          },
        ],
      };
    }

    case 'get_current_state': {
      const snapshot = getSnapshot();
      const state = String(snapshot.value);
      const context = snapshot.context;
      const availableActions = getAvailableActions(state, context);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                currentState: state,
                text: context.text,
                textLength: context.text.length,
                historyCount: context.history.length,
                lastAction: context.lastAction,
                lastError: context.lastError,
                availableActions,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case 'execute_action': {
      const { action, payload } = args as { action: string; payload?: Record<string, unknown> };

      // Map action names to events
      let event: TextMachineEvent;
      switch (action) {
        case 'set_text':
          if (!payload?.text) {
            return {
              content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'set_text requires a "text" field in payload' }) }],
            };
          }
          event = { type: 'SET_TEXT', text: String(payload.text) };
          break;
        case 'append_text':
          if (!payload?.text) {
            return {
              content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'append_text requires a "text" field in payload' }) }],
            };
          }
          event = { type: 'APPEND_TEXT', text: String(payload.text) };
          break;
        case 'clear_text':
          event = { type: 'CLEAR_TEXT' };
          break;
        case 'undo':
          event = { type: 'UNDO' };
          break;
        case 'reset':
          event = { type: 'RESET' };
          break;
        default:
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: `Unknown action: ${action}. Use get_current_state to see available actions.`,
                }),
              },
            ],
          };
      }

      // Send event and get new state
      const newSnapshot = sendEvent(event);
      const newState = String(newSnapshot.value);
      const newContext = newSnapshot.context;

      // Broadcast to WebSocket clients
      broadcastState({
        currentState: newState,
        text: newContext.text,
        historyCount: newContext.history.length,
        lastAction: newContext.lastAction,
        lastError: newContext.lastError,
      });

      // Check if there was an error
      if (newContext.lastError) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: newContext.lastError,
                currentState: newState,
                text: newContext.text,
              }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              action: action,
              newState: newState,
              text: newContext.text,
              availableActions: getAvailableActions(newState, newContext),
            }),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const WS_PORT = 8765;

// Graceful shutdown handler
async function shutdown(signal: string) {
  console.error(`\nReceived ${signal}, shutting down gracefully...`);

  try {
    await closeWebSocketServer();
    console.error('Cleanup complete, exiting');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
}

// Register signal handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGHUP', () => shutdown('SIGHUP'));

// Handle uncaught errors
process.on('uncaughtException', async (err) => {
  console.error('Uncaught exception:', err);
  await closeWebSocketServer();
  process.exit(1);
});

// Start the server
async function main() {
  // Check if port is already in use
  const portInUse = await isPortInUse(WS_PORT);
  if (portInUse) {
    console.error(`Error: Port ${WS_PORT} is already in use.`);
    console.error('Another instance may be running. Kill it with:');
    console.error(`  lsof -i :${WS_PORT} | grep LISTEN | awk '{print $2}' | xargs kill`);
    process.exit(1);
  }

  // Start WebSocket server for frontend
  startWebSocketServer(WS_PORT);

  // Start MCP server on stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Agentic UI MCP Server running');
  console.error(`WebSocket server on ws://localhost:${WS_PORT}`);
}

main().catch(console.error);
