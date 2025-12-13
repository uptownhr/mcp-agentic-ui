import { ref, onMounted, onUnmounted } from 'vue';

export interface AvailableAction {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  reason?: string;
}

export interface StateData {
  currentState: string;
  text: string;
  historyCount: number;
  lastAction: string | null;
  lastError: string | null;
  availableActions: AvailableAction[];
}

export interface ActionLogEntry {
  action: string;
  timestamp: string;
  text: string;
}

export function useWebSocket(url: string = 'ws://localhost:8765') {
  const connected = ref(false);
  const state = ref<StateData>({
    currentState: 'idle',
    text: '',
    historyCount: 0,
    lastAction: null,
    lastError: null,
    availableActions: [],
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
              actionLog.value.unshift({
                action: message.data.lastAction,
                timestamp: message.timestamp || new Date().toISOString(),
                text: message.data.text,
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

  return {
    connected,
    state,
    actionLog,
    error,
  };
}
