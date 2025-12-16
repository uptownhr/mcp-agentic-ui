import { ref, onMounted, onUnmounted } from 'vue';

export interface AvailableAction {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  reason?: string;
}

export interface InputRequest {
  prompt: string;
  inputType: 'text' | 'textarea' | 'number';
  placeholder?: string;
  defaultValue?: string;
  requestId: string;
}

export type InputStatus = 'idle' | 'pending' | 'submitted' | 'cancelled';

export interface StateData {
  currentState: string;
  text: string;
  contentType: 'text' | 'markdown';
  historyCount: number;
  lastAction: string | null;
  lastError: string | null;
  availableActions: AvailableAction[];
  inputRequest: InputRequest | null;
  inputStatus: InputStatus;
  userInput: string | null;
}

export interface ActionLogEntry {
  action: string;
  timestamp: string;
  detail: string;
}

// Compute a meaningful detail string based on action type
function getActionDetail(data: StateData): string {
  const action = data.lastAction;

  switch (action) {
    case 'set_text':
    case 'set_markdown':
      // Show the text that was set (truncated)
      return truncate(data.text, 100);
    case 'append_text':
      return `Appended to text (now ${data.text.length} chars)`;
    case 'show_input':
      // Show the prompt that was displayed
      return data.inputRequest?.prompt || 'Input requested';
    case 'input_submitted':
      // Show the value that was submitted
      return data.userInput || '(empty)';
    case 'input_cancelled':
      return 'User cancelled input';
    case 'clear_text':
      return 'Text cleared';
    case 'undo':
      return 'Restored previous state';
    case 'reset':
      return 'Reset to initial state';
    default:
      return data.text || '(empty)';
  }
}

// Truncate string with ellipsis
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str || '(empty)';
  return str.slice(0, maxLength) + '...';
}

export function useWebSocket(url: string = 'ws://localhost:8765') {
  const connected = ref(false);
  const state = ref<StateData>({
    currentState: 'idle',
    text: '',
    contentType: 'text',
    historyCount: 0,
    lastAction: null,
    lastError: null,
    availableActions: [],
    inputRequest: null,
    inputStatus: 'idle',
    userInput: null,
  });
  const actionLog = ref<ActionLogEntry[]>([]);
  const error = ref<string | null>(null);

  let ws: WebSocket | null = null;
  let reconnectTimer: number | null = null;

  function connect() {
    try {
      ws = new WebSocket(url);

      ws.onopen = () => {
        connected.value = true;
        error.value = null;
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'state_update') {
            const oldAction = state.value.lastAction;
            state.value = message.data;

            // Log the action if it changed
            if (message.data.lastAction && message.data.lastAction !== oldAction) {
              // Compute detail based on action type
              const detail = getActionDetail(message.data);

              actionLog.value.unshift({
                action: message.data.lastAction,
                timestamp: message.timestamp || new Date().toISOString(),
                detail,
              });
              // Keep only last 20 entries
              if (actionLog.value.length > 20) {
                actionLog.value.pop();
              }
            }
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        connected.value = false;
        console.log('WebSocket disconnected, reconnecting...');
        scheduleReconnect();
      };

      ws.onerror = (e) => {
        error.value = 'WebSocket error';
        console.error('WebSocket error:', e);
      };
    } catch (e) {
      error.value = 'Failed to connect';
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 2000);
  }

  onMounted(() => {
    connect();
  });

  onUnmounted(() => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    if (ws) {
      ws.close();
    }
  });

  // Send message to server
  function sendMessage(message: { type: string; payload: Record<string, unknown> }) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket not connected');
    }
  }

  // Submit user input
  function submitInput(value: string, requestId: string) {
    sendMessage({
      type: 'submit_input',
      payload: { value, requestId },
    });
  }

  // Cancel input request
  function cancelInput(requestId: string) {
    sendMessage({
      type: 'cancel_input',
      payload: { requestId },
    });
  }

  return {
    connected,
    state,
    actionLog,
    error,
    submitInput,
    cancelInput,
  };
}
