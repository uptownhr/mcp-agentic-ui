import { createMachine, assign, createActor, type AnyActorRef } from 'xstate';

// History entry type - stores both text and contentType for proper undo
export interface HistoryEntry {
  text: string;
  contentType: 'text' | 'markdown';
}

// Input request type - describes a pending user input request
export interface InputRequest {
  prompt: string;
  inputType: 'text' | 'textarea' | 'number';
  placeholder?: string;
  defaultValue?: string;
  requestId: string;
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
  // User input fields
  inputRequest: InputRequest | null;
  userInput: string | null;
  inputStatus: InputStatus;
}

// Event types
export type TextMachineEvent =
  | { type: 'SET_TEXT'; text: string }
  | { type: 'SET_MARKDOWN'; markdown: string }
  | { type: 'APPEND_TEXT'; text: string }
  | { type: 'CLEAR_TEXT' }
  | { type: 'UNDO' }
  | { type: 'RESET' }
  // User input events
  | { type: 'SHOW_INPUT'; request: InputRequest }
  | { type: 'SUBMIT_INPUT'; value: string; requestId: string }
  | { type: 'CANCEL_INPUT'; requestId: string };

// Initial context
const initialContext: TextMachineContext = {
  text: '',
  contentType: 'text',
  history: [],
  lastAction: null,
  lastError: null,
  inputRequest: null,
  userInput: null,
  inputStatus: 'idle',
};

// Create the state machine
export const textMachine = createMachine({
  id: 'textDisplay',
  initial: 'idle',
  context: initialContext,
  states: {
    idle: {
      on: {
        SET_TEXT: {
          target: 'displaying',
          actions: assign({
            history: ({ context }) => [...context.history, { text: context.text, contentType: context.contentType }],
            text: ({ event }) => event.text,
            contentType: () => 'text' as const,
            lastAction: () => 'set_text',
            lastError: () => null,
          }),
        },
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
        APPEND_TEXT: {
          target: 'displaying',
          actions: assign({
            history: ({ context }) => [...context.history, { text: context.text, contentType: context.contentType }],
            text: ({ context, event }) => context.text + event.text,
            lastAction: () => 'append_text',
            lastError: () => null,
          }),
        },
        SHOW_INPUT: {
          target: 'waitingForInput',
          actions: assign({
            inputRequest: ({ event }) => event.request,
            userInput: () => null,
            inputStatus: () => 'pending' as const,
            lastAction: () => 'show_input',
            lastError: () => null,
          }),
        },
      },
    },
    displaying: {
      on: {
        SET_TEXT: {
          actions: assign({
            history: ({ context }) => [...context.history, { text: context.text, contentType: context.contentType }],
            text: ({ event }) => event.text,
            contentType: () => 'text' as const,
            lastAction: () => 'set_text',
            lastError: () => null,
          }),
        },
        SET_MARKDOWN: {
          actions: assign({
            history: ({ context }) => [...context.history, { text: context.text, contentType: context.contentType }],
            text: ({ event }) => event.markdown,
            contentType: () => 'markdown' as const,
            lastAction: () => 'set_markdown',
            lastError: () => null,
          }),
        },
        APPEND_TEXT: {
          actions: assign({
            history: ({ context }) => [...context.history, { text: context.text, contentType: context.contentType }],
            text: ({ context, event }) => context.text + event.text,
            lastAction: () => 'append_text',
            lastError: () => null,
          }),
        },
        CLEAR_TEXT: {
          target: 'idle',
          actions: assign({
            history: ({ context }) => [...context.history, { text: context.text, contentType: context.contentType }],
            text: () => '',
            lastAction: () => 'clear_text',
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
          actions: assign(initialContext),
        },
        SHOW_INPUT: {
          target: 'waitingForInput',
          actions: assign({
            inputRequest: ({ event }) => event.request,
            userInput: () => null,
            inputStatus: () => 'pending' as const,
            lastAction: () => 'show_input',
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
            inputStatus: () => 'cancelled' as const,
            inputRequest: () => null,
            lastAction: () => 'input_cancelled',
            lastError: () => null,
          }),
        },
        RESET: {
          target: 'idle',
          actions: assign(initialContext),
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
    name: 'set_text',
    description: 'Set the displayed text to a new value',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The text to display' },
      },
      required: ['text'],
    },
  });

  actions.push({
    name: 'set_markdown',
    description: 'Set the displayed content to markdown with Mermaid diagram support',
    inputSchema: {
      type: 'object',
      properties: {
        markdown: { type: 'string', description: 'The markdown content to display' },
      },
      required: ['markdown'],
    },
  });

  actions.push({
    name: 'append_text',
    description: 'Append text to the current display',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The text to append' },
      },
      required: ['text'],
    },
  });

  // Actions only available in displaying state
  if (state === 'displaying') {
    actions.push({
      name: 'clear_text',
      description: 'Clear all text from the display',
      inputSchema: { type: 'object', properties: {} },
    });

    if (context.history.length > 0) {
      actions.push({
        name: 'undo',
        description: 'Undo the last text change',
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

  return actions;
}

// Singleton actor instance
let actorInstance: AnyActorRef | null = null;

export function getActor() {
  if (!actorInstance) {
    actorInstance = createActor(textMachine);
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
