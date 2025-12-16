<script setup lang="ts">
import type { ActionLogEntry } from '../composables/useWebSocket';

defineProps<{
  entries: ActionLogEntry[];
}>();

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString();
}
</script>

<template>
  <div class="action-log">
    <div class="header">
      <div class="label">Action Log</div>
    </div>

    <div class="entries">
      <div v-if="entries.length === 0" class="empty">
        No actions yet. Ask Claude to control this UI!
      </div>

      <div v-for="(entry, index) in entries" :key="index" class="entry">
        <div class="entry-header">
          <span class="action-name">{{ entry.action }}</span>
          <span class="timestamp">{{ formatTime(entry.timestamp) }}</span>
        </div>
        <div class="entry-detail">
          {{ entry.detail }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.action-log {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  max-height: 400px;
}

.header {
  margin-bottom: 16px;
}

.label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #666;
}

.entries {
  flex: 1;
  overflow-y: auto;
}

.empty {
  color: #555;
  font-size: 0.9rem;
  text-align: center;
  padding: 20px;
}

.entry {
  padding: 12px;
  background: #222;
  border-radius: 8px;
  margin-bottom: 10px;
  animation: slideIn 0.3s ease;
}

.entry:last-child {
  margin-bottom: 0;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.entry-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.action-name {
  font-family: monospace;
  font-size: 0.85rem;
  color: #6bff6b;
  background: #1a3d1a;
  padding: 2px 8px;
  border-radius: 4px;
}

.timestamp {
  font-size: 0.75rem;
  color: #666;
}

.entry-detail {
  font-size: 0.85rem;
  color: #aaa;
  word-break: break-word;
}
</style>
