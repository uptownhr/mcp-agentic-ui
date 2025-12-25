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
  getActor,
  isMultiFieldRequest,
  type TextMachineEvent,
  type InputRequest,
  type MultiFieldRequest,
  type FormField,
} from './machine.js';
import { startWebSocketServer, broadcastState, closeWebSocketServer, isPortInUse } from './websocket.js';

// App description
const APP_INFO = {
  name: 'Agentic UI Prototype',
  purpose: 'A simple text display controlled by AI through state machine actions',
  capabilities: [
    'Display text on screen',
    'Set text to any value',
    'Set markdown content with Mermaid diagram support',
    'Append text to existing content',
    'Clear all text',
    'Undo changes (with history)',
    'Reset to initial state',
    'Request user input via forms',
    'Retrieve user-submitted input',
  ],
  stateDescription: {
    idle: 'No text is being displayed',
    displaying: 'Text is visible on screen',
    waitingForInput: 'Waiting for user to submit input',
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
              description: 'The action name (e.g., set_text, set_markdown, append_text, clear_text, undo, reset)',
            },
            payload: {
              type: 'object',
              description: 'Action payload - for set_text/append_text use { text: "..." }, for set_markdown use { markdown: "..." }',
            },
          },
          required: ['action'],
        },
      },
      {
        name: 'show_input_form',
        description: 'Display an input form to the user and request their input. Returns immediately - use get_user_input to retrieve the submitted value. If a key is provided, the response will also be stored in userContext for later retrieval.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'The question or prompt to display to the user',
            },
            content: {
              type: 'string',
              description: 'Optional markdown content to display above the input form. Use this to provide context, options, or information the user needs to make their decision.',
            },
            key: {
              type: 'string',
              description: 'Optional key to store the response in userContext (e.g., "userName", "preferredLanguage"). If provided, the value will persist across multiple inputs.',
            },
            inputType: {
              type: 'string',
              enum: ['text', 'textarea', 'number'],
              description: 'Type of input field. Defaults to "text"',
            },
            placeholder: {
              type: 'string',
              description: 'Placeholder text for the input field',
            },
            defaultValue: {
              type: 'string',
              description: 'Default value to pre-fill in the input',
            },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'get_user_input',
        description: 'Get the value submitted by the user after show_input_form was called. This tool uses LONG-POLLING: it will BLOCK and wait until the user submits or cancels the input, then return the result. Returns status: submitted (with value), cancelled, or idle (no input was requested).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_user_context',
        description: 'Get all stored user context values. Returns the persistent key-value store that accumulates across multiple show_input_form calls with keys.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'set_user_context',
        description: 'Directly set a value in the user context without showing an input form. Useful for storing computed values or information gathered from conversation.',
        inputSchema: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'The key to store the value under',
            },
            value: {
              description: 'The value to store (can be string, number, boolean, object, or array)',
            },
          },
          required: ['key', 'value'],
        },
      },
      {
        name: 'clear_user_context',
        description: 'Clear all stored user context values. Resets the persistent store to empty.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'show_multi_form',
        description: 'Display a multi-field form to collect multiple inputs at once. All field values are stored in userContext using field keys. Use get_user_input to retrieve submitted values.',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Optional markdown content to display above the form.',
            },
            fields: {
              type: 'array',
              description: 'Array of form fields to display',
              items: {
                type: 'object',
                properties: {
                  key: {
                    type: 'string',
                    description: 'Unique identifier for the field. Value will be stored in userContext[key].',
                  },
                  label: {
                    type: 'string',
                    description: 'Display label for the field',
                  },
                  type: {
                    type: 'string',
                    enum: ['text', 'textarea', 'number', 'checkbox', 'select'],
                    description: 'Type of input field',
                  },
                  placeholder: {
                    type: 'string',
                    description: 'Placeholder text for text inputs',
                  },
                  defaultValue: {
                    description: 'Default value for the field',
                  },
                  required: {
                    type: 'boolean',
                    description: 'Whether the field is required',
                  },
                  options: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Options for select fields',
                  },
                },
                required: ['key', 'label', 'type'],
              },
            },
          },
          required: ['fields'],
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
                ...context,
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
        case 'set_markdown':
          if (!payload?.markdown) {
            return {
              content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'set_markdown requires a "markdown" field in payload' }) }],
            };
          }
          event = { type: 'SET_MARKDOWN', markdown: String(payload.markdown) };
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
        contentType: newContext.contentType,
        historyCount: newContext.history.length,
        lastAction: newContext.lastAction,
        lastError: newContext.lastError,
        inputRequest: newContext.inputRequest,
        inputStatus: newContext.inputStatus,
        userInput: newContext.userInput,
        userContext: newContext.userContext,
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

    case 'show_input_form': {
      const { prompt, content, key, inputType, placeholder, defaultValue } = args as {
        prompt: string;
        content?: string;
        key?: string;
        inputType?: 'text' | 'textarea' | 'number';
        placeholder?: string;
        defaultValue?: string;
      };

      // Generate unique request ID
      const requestId = `input_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const request: InputRequest = {
        prompt,
        inputType: inputType || 'text',
        placeholder,
        defaultValue,
        requestId,
        key, // Include key for userContext storage
        content, // Include markdown content for display
      };

      const event: TextMachineEvent = { type: 'SHOW_INPUT', request };
      const newSnapshot = sendEvent(event);
      const newState = String(newSnapshot.value);
      const newContext = newSnapshot.context;

      // Broadcast to WebSocket clients
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

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Input form displayed. Use get_user_input to retrieve the submitted value.',
              requestId,
              currentState: newState,
            }),
          },
        ],
      };
    }

    case 'get_user_input': {
      const snapshot = getSnapshot();
      const context = snapshot.context;
      const state = String(snapshot.value);

      // If already submitted, return immediately
      if (context.inputStatus === 'submitted') {
        // Check if this was a multi-field submission
        if (context.multiFieldInput) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  status: 'submitted',
                  values: context.multiFieldInput,
                  message: 'User submitted multi-field form successfully.',
                }),
              },
            ],
          };
        }
        // Single-field submission
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'submitted',
                value: context.userInput,
                message: 'User submitted their input successfully.',
              }),
            },
          ],
        };
      }

      // If already cancelled, return immediately
      if (context.inputStatus === 'cancelled') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'cancelled',
                value: null,
                message: 'User cancelled the input request.',
              }),
            },
          ],
        };
      }

      // If waiting for input, use LONG-POLLING: block until user submits or cancels
      if (state === 'waitingForInput') {
        const isMultiField = isMultiFieldRequest(context.inputRequest);
        console.error(`[Long-Polling] Waiting for user input... (isMultiField: ${isMultiField})`);
        const startTime = Date.now();

        return new Promise((resolve) => {
          const actor = getActor();

          const subscription = actor.subscribe((newSnapshot) => {
            const newState = String(newSnapshot.value);
            const newContext = newSnapshot.context;

            // Check if user submitted
            if (newContext.inputStatus === 'submitted') {
              const elapsed = Date.now() - startTime;
              console.error(`[Long-Polling] Input submitted after ${elapsed}ms`);
              subscription.unsubscribe();

              // Check if this was a multi-field submission
              if (newContext.multiFieldInput) {
                resolve({
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify({
                        status: 'submitted',
                        values: newContext.multiFieldInput,
                        message: 'User submitted multi-field form successfully.',
                        waitTime: elapsed,
                      }),
                    },
                  ],
                });
              } else {
                resolve({
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify({
                        status: 'submitted',
                        value: newContext.userInput,
                        message: 'User submitted their input successfully.',
                        waitTime: elapsed,
                      }),
                    },
                  ],
                });
              }
            }

            // Check if user cancelled
            if (newContext.inputStatus === 'cancelled') {
              const elapsed = Date.now() - startTime;
              console.error(`[Long-Polling] Input cancelled after ${elapsed}ms`);
              subscription.unsubscribe();

              resolve({
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      status: 'cancelled',
                      value: null,
                      message: 'User cancelled the input request.',
                      waitTime: elapsed,
                    }),
                  },
                ],
              });
            }
          });
        });
      }

      // No input was ever requested (idle state)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'idle',
              value: null,
              message: 'No input has been requested. Use show_input_form or show_multi_form first.',
            }),
          },
        ],
      };
    }

    case 'get_user_context': {
      const snapshot = getSnapshot();
      const context = snapshot.context;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              userContext: context.userContext,
              keyCount: Object.keys(context.userContext).length,
              message: Object.keys(context.userContext).length > 0
                ? 'User context contains stored values.'
                : 'User context is empty. Use show_input_form with a key or set_user_context to add values.',
            }),
          },
        ],
      };
    }

    case 'set_user_context': {
      const { key, value } = args as { key: string; value: unknown };

      const event: TextMachineEvent = { type: 'SET_USER_CONTEXT', key, value };
      const newSnapshot = sendEvent(event);
      const newContext = newSnapshot.context;

      // Broadcast to WebSocket clients
      broadcastState({
        currentState: String(newSnapshot.value),
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

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              key,
              value,
              userContext: newContext.userContext,
              message: `Stored "${key}" in user context.`,
            }),
          },
        ],
      };
    }

    case 'clear_user_context': {
      const event: TextMachineEvent = { type: 'CLEAR_USER_CONTEXT' };
      const newSnapshot = sendEvent(event);
      const newContext = newSnapshot.context;

      // Broadcast to WebSocket clients
      broadcastState({
        currentState: String(newSnapshot.value),
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

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              userContext: {},
              message: 'User context has been cleared.',
            }),
          },
        ],
      };
    }

    case 'show_multi_form': {
      const { content, fields } = args as {
        content?: string;
        fields: FormField[];
      };

      // Generate unique request ID
      const requestId = `multi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const request: MultiFieldRequest = {
        fields,
        content,
        requestId,
      };

      const event: TextMachineEvent = { type: 'SHOW_MULTI_FORM', request };
      const newSnapshot = sendEvent(event);
      const newState = String(newSnapshot.value);
      const newContext = newSnapshot.context;

      // Broadcast to WebSocket clients
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

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Multi-field form displayed. Use get_user_input to retrieve submitted values.',
              requestId,
              fieldCount: fields.length,
              fieldKeys: fields.map(f => f.key),
              currentState: newState,
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
