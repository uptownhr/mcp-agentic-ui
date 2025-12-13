<script setup lang="ts">
import type { AvailableAction } from '../composables/useWebSocket';

defineProps<{
  currentState: string;
  historyCount: number;
  lastError: string | null;
  availableActions: AvailableAction[];
}>();
</script>

<template>
  <div class="state-indicator">
    <div class="section">
      <div class="label">Current State</div>
      <div class="state-badge" :class="currentState">
        {{ currentState }}
      </div>
    </div>

    <div class="section">
      <div class="label">History</div>
      <div class="value">{{ historyCount }} change(s) recorded</div>
    </div>

    <div v-if="lastError" class="section error">
      <div class="label">Last Error</div>
      <div class="error-message">{{ lastError }}</div>
    </div>

    <div class="section">
      <div class="label">Available Actions</div>
      <ul class="actions-list">
        <li v-for="action in availableActions" :key="action.name" class="action-item">
          <span class="action-name">{{ action.name }}</span>
          <span class="action-desc">{{ action.description }}</span>
          <span v-if="action.reason" class="action-reason">{{ action.reason }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.state-indicator {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 20px;
}

.section {
  margin-bottom: 20px;
}

.section:last-child {
  margin-bottom: 0;
}

.label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #666;
  margin-bottom: 8px;
}

.state-badge {
  display: inline-block;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
  background: #2a2a2a;
  color: #888;
}

.state-badge.idle {
  background: #2a2a2a;
  color: #888;
}

.state-badge.displaying {
  background: #1a3d1a;
  color: #6bff6b;
}

.value {
  color: #aaa;
  font-size: 0.9rem;
}

.error {
  background: #3d1515;
  margin: -10px -20px;
  padding: 10px 20px;
  margin-bottom: 10px;
}

.error-message {
  color: #ff6b6b;
  font-size: 0.9rem;
}

.actions-list {
  list-style: none;
  padding: 0;
}

.action-item {
  display: flex;
  flex-direction: column;
  padding: 10px;
  background: #222;
  border-radius: 8px;
  margin-bottom: 8px;
}

.action-item:last-child {
  margin-bottom: 0;
}

.action-name {
  font-family: monospace;
  font-size: 0.85rem;
  color: #4a9eff;
  margin-bottom: 4px;
}

.action-desc {
  font-size: 0.8rem;
  color: #888;
}

.action-reason {
  font-size: 0.75rem;
  color: #6b6bff;
  margin-top: 4px;
  font-style: italic;
}
</style>
