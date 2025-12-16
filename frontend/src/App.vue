<script setup lang="ts">
import { useWebSocket } from './composables/useWebSocket';
import TextDisplay from './components/TextDisplay.vue';
import StateIndicator from './components/StateIndicator.vue';
import ActionLog from './components/ActionLog.vue';
import InputForm from './components/InputForm.vue';

const { connected, state, actionLog, submitInput, cancelInput } = useWebSocket();
</script>

<template>
  <div class="app">
    <header class="header">
      <h1>Agentic UI Prototype</h1>
      <div class="connection-status" :class="{ connected }">
        {{ connected ? 'Connected' : 'Disconnected' }}
      </div>
    </header>

    <main class="main">
      <div class="display-section">
        <!-- Show InputForm when waiting for user input -->
        <InputForm
          v-if="state.currentState === 'waitingForInput' && state.inputRequest"
          :request="state.inputRequest"
          @submit="submitInput"
          @cancel="(requestId) => cancelInput(requestId)"
        />
        <!-- Show TextDisplay otherwise -->
        <TextDisplay
          v-else
          :text="state.text"
          :state="state.currentState"
          :content-type="state.contentType"
        />
      </div>

      <div class="info-section">
        <StateIndicator
          :current-state="state.currentState"
          :history-count="state.historyCount"
          :last-error="state.lastError"
          :available-actions="state.availableActions"
        />
        <ActionLog :entries="actionLog" />
      </div>
    </main>

    <footer class="footer">
      <p>Control this UI by asking Claude to use the agentic-ui tools</p>
    </footer>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid #333;
}

.header h1 {
  font-size: 1.5rem;
  font-weight: 500;
  color: #fff;
}

.connection-status {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  background: #3d1515;
  color: #ff6b6b;
}

.connection-status.connected {
  background: #153d15;
  color: #6bff6b;
}

.main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 30px;
}

.display-section {
  display: flex;
  flex-direction: column;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.footer {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #333;
  text-align: center;
  color: #666;
  font-size: 0.9rem;
}

@media (max-width: 900px) {
  .main {
    grid-template-columns: 1fr;
  }
}
</style>
