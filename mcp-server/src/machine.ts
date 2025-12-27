import { createMachine, assign, createActor, type AnyActorRef } from 'xstate';
import * as fs from 'node:fs';
import * as path from 'node:path';

// State persistence file path - use __dirname to ensure it's relative to this file
const STATE_FILE = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '.agentic-ui-state.json');

// Persisted state shape (Option B - full state restoration including pending input)
interface PersistedState {
  text: string;
  contentType: 'text' | 'markdown';
  history: HistoryEntry[];
  userContext: Record<string, unknown>;
  // Option B: Also persist input request for full state restoration
  inputRequest: AnyInputRequest | null;
  inputStatus: InputStatus;
  multiFieldInput?: Record<string, unknown> | null;
  sidebarVisible: boolean;
}

// History entry type - stores both text and contentType for proper undo
export interface HistoryEntry {
  text: string;
  contentType: 'text' | 'markdown';
}

// Input request type - describes a pending user input request (single field)
export interface InputRequest {
  prompt: string;
  inputType: 'text' | 'textarea' | 'number';
  placeholder?: string;
  defaultValue?: string;
  requestId: string;
  key?: string; // Optional key for storing in userContext
  content?: string; // Optional markdown content to display above the input form
}

// Multi-field form types
export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'checkbox' | 'select';
  placeholder?: string;
  defaultValue?: string | number | boolean;
  required?: boolean;
  options?: string[]; // For select fields
}

export interface MultiFieldRequest {
  fields: FormField[];
  content?: string; // Optional markdown content to display above the form
  requestId: string;
}

// Union type for any input request
export type AnyInputRequest = InputRequest | MultiFieldRequest;

// Type guard to check if request is multi-field
export function isMultiFieldRequest(request: AnyInputRequest | null): request is MultiFieldRequest {
  return request !== null && 'fields' in request;
}

// Input status type
export type InputStatus = 'idle' | 'pending' | 'submitted' | 'cancelled';

// Context type
export interface TextMachineContext {
  text: string;
  contentType: 'text' | 'markdown';
  history: HistoryEntry[];
  lastAction: string | null;
  lastError: string | null;
  // User input fields - supports both single and multi-field forms
  inputRequest: AnyInputRequest | null;
  userInput: string | null; // For single-field responses
  multiFieldInput: Record<string, unknown> | null; // For multi-field responses
  inputStatus: InputStatus;
  // Persistent user context - stores keyed values across multiple inputs
  userContext: Record<string, unknown>;
  // Sidebar visibility state
  sidebarVisible: boolean;
}

// Event types
export type TextMachineEvent =
  | { type: 'SET_MARKDOWN'; markdown: string }
  | { type: 'APPEND'; text: string }
  | { type: 'UNDO' }
  | { type: 'RESET' }
  // Single-field input events
  | { type: 'SHOW_INPUT'; request: InputRequest }
  | { type: 'SUBMIT_INPUT'; value: string; requestId: string }
  | { type: 'CANCEL_INPUT'; requestId: string }
  // Multi-field form events
  | { type: 'SHOW_MULTI_FORM'; request: MultiFieldRequest }
  | { type: 'SUBMIT_MULTI_FORM'; values: Record<string, unknown>; requestId: string }
  // User context events
  | { type: 'SET_USER_CONTEXT'; key: string; value: unknown }
  | { type: 'CLEAR_USER_CONTEXT' }
  // Sidebar toggle event
  | { type: 'TOGGLE_SIDEBAR' };

// Initial context
const initialContext: TextMachineContext = {
  text: '',
  contentType: 'text',
  history: [],
  lastAction: null,
  lastError: null,
  inputRequest: null,
  userInput: null,
  multiFieldInput: null,
  inputStatus: 'idle',
  userContext: {},
  sidebarVisible: true,
};

// Create the state machine
export const textMachine = createMachine({
  id: 'textDisplay',
  initial: 'idle',
  context: initialContext,
  states: {
    idle: {
      on: {
        SET_MARKDOWN: {
          target: 'displaying',
          actions: assign({
            history: ({ context }) => [...context.history, { text: context.text, contentType: context.contentType }],
            text: ({ event }) => event.markdown,
            contentType: () => 'markdown' as const,
            lastAction: () => 'set_markdown',
            lastError: () => null,
          }),
        },
        APPEND: {
          target: 'displaying',
          actions: assign({
            history: ({ context }) => [...context.history, { text: context.text, contentType: context.contentType }],
            text: ({ context, event }) => context.text + event.text,
            lastAction: () => 'append',
            lastError: () => null,
          }),
        },
        SHOW_INPUT: {
          target: 'waitingForInput',
          actions: assign({
            inputRequest: ({ event }) => event.request,
            userInput: () => null,
            multiFieldInput: () => null,
            inputStatus: () => 'pending' as const,
            lastAction: () => 'show_input',
            lastError: () => null,
          }),
        },
        SHOW_MULTI_FORM: {
          target: 'waitingForInput',
          actions: assign({
            inputRequest: ({ event }) => event.request,
            userInput: () => null,
            multiFieldInput: () => null,
            inputStatus: () => 'pending' as const,
            lastAction: () => 'show_multi_form',
            lastError: () => null,
          }),
        },
        SET_USER_CONTEXT: {
          actions: assign({
            userContext: ({ context, event }) => ({
              ...context.userContext,
              [event.key]: event.value,
            }),
            lastAction: () => 'set_user_context',
            lastError: () => null,
          }),
        },
        CLEAR_USER_CONTEXT: {
          actions: assign({
            userContext: () => ({}),
            lastAction: () => 'clear_user_context',
            lastError: () => null,
          }),
        },
        TOGGLE_SIDEBAR: {
          actions: assign({
            sidebarVisible: ({ context }) => !context.sidebarVisible,
            lastAction: () => 'toggle_sidebar',
            lastError: () => null,
          }),
        },
      },
    },
    displaying: {
      on: {
        SET_MARKDOWN: {
          actions: assign({
            history: ({ context }) => [...context.history, { text: context.text, contentType: context.contentType }],
            text: ({ event }) => event.markdown,
            contentType: () => 'markdown' as const,
            lastAction: () => 'set_markdown',
            lastError: () => null,
          }),
        },
        APPEND: {
          actions: assign({
            history: ({ context }) => [...context.history, { text: context.text, contentType: context.contentType }],
            text: ({ context, event }) => context.text + event.text,
            lastAction: () => 'append',
            lastError: () => null,
          }),
        },
        UNDO: [
          {
            guard: ({ context }) => context.history.length > 0,
            actions: assign({
              text: ({ context }) => context.history[context.history.length - 1].text,
              contentType: ({ context }) => context.history[context.history.length - 1].contentType,
              history: ({ context }) => context.history.slice(0, -1),
              lastAction: () => 'undo',
              lastError: () => null,
            }),
          },
          {
            actions: assign({
              lastError: () => 'No history to undo',
            }),
          },
        ],
        RESET: {
          target: 'idle',
          actions: assign(({ context }) => ({
            ...initialContext,
            userContext: context.userContext,
          })),
        },
        SHOW_INPUT: {
          target: 'waitingForInput',
          actions: assign({
            inputRequest: ({ event }) => event.request,
            userInput: () => null,
            multiFieldInput: () => null,
            inputStatus: () => 'pending' as const,
            lastAction: () => 'show_input',
            lastError: () => null,
          }),
        },
        SHOW_MULTI_FORM: {
          target: 'waitingForInput',
          actions: assign({
            inputRequest: ({ event }) => event.request,
            userInput: () => null,
            multiFieldInput: () => null,
            inputStatus: () => 'pending' as const,
            lastAction: () => 'show_multi_form',
            lastError: () => null,
          }),
        },
        SET_USER_CONTEXT: {
          actions: assign({
            userContext: ({ context, event }) => ({
              ...context.userContext,
              [event.key]: event.value,
            }),
            lastAction: () => 'set_user_context',
            lastError: () => null,
          }),
        },
        CLEAR_USER_CONTEXT: {
          actions: assign({
            userContext: () => ({}),
            lastAction: () => 'clear_user_context',
            lastError: () => null,
          }),
        },
        TOGGLE_SIDEBAR: {
          actions: assign({
            sidebarVisible: ({ context }) => !context.sidebarVisible,
            lastAction: () => 'toggle_sidebar',
            lastError: () => null,
          }),
        },
      },
    },
    waitingForInput: {
      on: {
        SUBMIT_INPUT: {
          target: 'displaying',
          guard: ({ context, event }) =>
            context.inputRequest?.requestId === event.requestId,
          actions: assign({
            userInput: ({ event }) => event.value,
            inputStatus: () => 'submitted' as const,
            // Store in userContext if key was provided (only for single-field requests)
            userContext: ({ context, event }) => {
              const request = context.inputRequest;
              if (request && !isMultiFieldRequest(request) && request.key) {
                return { ...context.userContext, [request.key]: event.value };
              }
              return context.userContext;
            },
            // Preserve input content as the displayed text (if content was provided)
            text: ({ context }) => context.inputRequest?.content || context.text,
            contentType: ({ context }) => context.inputRequest?.content ? 'markdown' as const : context.contentType,
            inputRequest: () => null,
            lastAction: () => 'input_submitted',
            lastError: () => null,
          }),
        },
        CANCEL_INPUT: {
          target: 'displaying',
          guard: ({ context, event }) =>
            context.inputRequest?.requestId === event.requestId,
          actions: assign({
            userInput: () => null,
            multiFieldInput: () => null,
            inputStatus: () => 'cancelled' as const,
            // Preserve input content as the displayed text (if content was provided)
            text: ({ context }) => context.inputRequest?.content || context.text,
            contentType: ({ context }) => context.inputRequest?.content ? 'markdown' as const : context.contentType,
            inputRequest: () => null,
            lastAction: () => 'input_cancelled',
            lastError: () => null,
          }),
        },
        SUBMIT_MULTI_FORM: {
          target: 'displaying',
          guard: ({ context, event }) =>
            context.inputRequest?.requestId === event.requestId,
          actions: assign({
            multiFieldInput: ({ event }) => event.values,
            userInput: () => null,
            inputStatus: () => 'submitted' as const,
            // Store all field values in userContext
            userContext: ({ context, event }) => {
              const newContext = { ...context.userContext };
              for (const [key, value] of Object.entries(event.values)) {
                newContext[key] = value;
              }
              return newContext;
            },
            // Preserve input content as the displayed text (if content was provided)
            text: ({ context }) => context.inputRequest?.content || context.text,
            contentType: ({ context }) => context.inputRequest?.content ? 'markdown' as const : context.contentType,
            inputRequest: () => null,
            lastAction: () => 'multi_form_submitted',
            lastError: () => null,
          }),
        },
        RESET: {
          target: 'idle',
          actions: assign(({ context }) => ({
            ...initialContext,
            userContext: context.userContext,
          })),
        },
      },
    },
  },
});

// Available actions type
export interface AvailableAction {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  reason?: string;
}

// Get available actions based on current state
export function getAvailableActions(
  state: string,
  context: TextMachineContext
): AvailableAction[] {
  const actions: AvailableAction[] = [];

  // When waiting for input, only reset is available (submit/cancel come from frontend)
  if (state === 'waitingForInput') {
    actions.push({
      name: 'reset',
      description: 'Reset the display to initial state (cancels pending input)',
      inputSchema: { type: 'object', properties: {} },
    });
    return actions;
  }

  // Actions available in idle and displaying states
  actions.push({
    name: 'set_markdown',
    description: 'Set the displayed content to markdown',
    inputSchema: {
      type: 'object',
      properties: {
        markdown: { type: 'string', description: 'The markdown content to display' },
      },
      required: ['markdown'],
    },
  });

  actions.push({
    name: 'append',
    description: 'Append content to the current display',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The content to append' },
      },
      required: ['text'],
    },
  });

  // Actions only available in displaying state
  if (state === 'displaying') {
    if (context.history.length > 0) {
      actions.push({
        name: 'undo',
        description: 'Undo the last change',
        inputSchema: { type: 'object', properties: {} },
        reason: `Can undo ${context.history.length} change(s)`,
      });
    }
  }

  // Reset is always available
  actions.push({
    name: 'reset',
    description: 'Reset the display to initial state',
    inputSchema: { type: 'object', properties: {} },
  });

  // Toggle sidebar is always available
  actions.push({
    name: 'toggle_sidebar',
    description: 'Toggle the sidebar visibility',
    inputSchema: { type: 'object', properties: {} },
  });

  return actions;
}

// ============================================
// State Persistence Functions
// ============================================

// Load persisted state from file
function loadPersistedState(): Partial<TextMachineContext> | null {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(data) as PersistedState;
      console.error(`[Persistence] Loaded state from ${STATE_FILE}`);

      // Option B: Restore inputRequest with a fresh requestId
      let inputRequest = parsed.inputRequest || null;
      if (inputRequest) {
        // Generate new requestId since old one is stale
        inputRequest = {
          ...inputRequest,
          requestId: `restored-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
        console.error('[Persistence] Restored pending input request with new ID:', inputRequest.requestId);
      }

      return {
        text: parsed.text || '',
        contentType: parsed.contentType || 'text',
        history: parsed.history || [],
        userContext: parsed.userContext || {},
        inputRequest,
        inputStatus: inputRequest ? 'pending' : (parsed.inputStatus || 'idle'),
        multiFieldInput: parsed.multiFieldInput || null,
        sidebarVisible: parsed.sidebarVisible ?? true,
      };
    }
  } catch (error) {
    console.error('[Persistence] Failed to load state:', error);
  }
  return null;
}

// Save state to file
function saveState(context: TextMachineContext): void {
  try {
    const toSave: PersistedState = {
      text: context.text,
      contentType: context.contentType,
      history: context.history,
      userContext: context.userContext,
      // Option B: Also save input request for full state restoration
      inputRequest: context.inputRequest,
      inputStatus: context.inputStatus,
      multiFieldInput: context.multiFieldInput,
      sidebarVisible: context.sidebarVisible,
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(toSave, null, 2));
    console.error(`[Persistence] State saved to ${STATE_FILE}`);
  } catch (error) {
    console.error('[Persistence] Failed to save state:', error);
  }
}

// ============================================
// Actor Instance Management
// ============================================

// Singleton actor instance
let actorInstance: AnyActorRef | null = null;

export function getActor() {
  if (!actorInstance) {
    // Try to load persisted state
    const persistedState = loadPersistedState();

    if (persistedState) {
      // Create machine with persisted context
      const restoredContext: TextMachineContext = {
        ...initialContext,
        text: persistedState.text || '',
        contentType: persistedState.contentType || 'text',
        history: persistedState.history || [],
        userContext: persistedState.userContext || {},
        // Option B: Restore input request state
        inputRequest: persistedState.inputRequest || null,
        inputStatus: persistedState.inputStatus || 'idle',
        userInput: null,
        multiFieldInput: persistedState.multiFieldInput || null,
        sidebarVisible: persistedState.sidebarVisible ?? true,
      };

      // Determine initial state based on content and pending input
      let initialState: string;
      if (restoredContext.inputRequest) {
        // Option B: If there's a pending input request, restore to waitingForInput
        initialState = 'waitingForInput';
        console.error('[Persistence] Restoring to waitingForInput state');
      } else if (restoredContext.text) {
        initialState = 'displaying';
      } else {
        initialState = 'idle';
      }

      // Create a machine starting in the correct state with restored context
      const restoredMachine = createMachine({
        ...textMachine.config,
        initial: initialState,
        context: restoredContext,
      });

      actorInstance = createActor(restoredMachine);
    } else {
      actorInstance = createActor(textMachine);
    }

    // Subscribe to state changes and persist
    actorInstance.subscribe((snapshot) => {
      saveState(snapshot.context);
    });

    actorInstance.start();
  }
  return actorInstance;
}

// Helper to get current snapshot
export function getSnapshot() {
  const actor = getActor();
  return actor.getSnapshot();
}

// Helper to send events
export function sendEvent(event: TextMachineEvent) {
  const actor = getActor();
  actor.send(event);
  return actor.getSnapshot();
}
