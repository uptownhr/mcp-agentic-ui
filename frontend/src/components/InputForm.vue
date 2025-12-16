<script setup lang="ts">
import { ref, watch } from 'vue';
import type { InputRequest } from '../composables/useWebSocket';

const props = defineProps<{
  request: InputRequest;
}>();

const emit = defineEmits<{
  submit: [value: string, requestId: string];
  cancel: [requestId: string];
}>();

const inputValue = ref(props.request.defaultValue || '');

// Reset value when request changes
watch(() => props.request.requestId, () => {
  inputValue.value = props.request.defaultValue || '';
});

function handleSubmit() {
  emit('submit', inputValue.value, props.request.requestId);
}

function handleCancel() {
  emit('cancel', props.request.requestId);
}
</script>

<template>
  <div class="input-form">
    <div class="prompt">{{ request.prompt }}</div>

    <div class="input-wrapper">
      <textarea
        v-if="request.inputType === 'textarea'"
        v-model="inputValue"
        :placeholder="request.placeholder"
        class="input textarea"
        rows="4"
      />
      <input
        v-else
        v-model="inputValue"
        :type="request.inputType === 'number' ? 'number' : 'text'"
        :placeholder="request.placeholder"
        class="input"
        @keyup.enter="handleSubmit"
      />
    </div>

    <div class="actions">
      <button class="btn btn-secondary" @click="handleCancel">
        Cancel
      </button>
      <button class="btn btn-primary" @click="handleSubmit">
        Submit
      </button>
    </div>
  </div>
</template>

<style scoped>
.input-form {
  background: #1a1a1a;
  border: 2px solid #ff9f4a;
  border-radius: 12px;
  padding: 24px;
  animation: fadeIn 0.3s ease;
  max-width: 600px;
  margin: 0 auto;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.prompt {
  font-size: 1.2rem;
  color: #fff;
  margin-bottom: 16px;
  text-align: center;
}

.input-wrapper {
  margin-bottom: 16px;
}

.input {
  width: 100%;
  padding: 12px 16px;
  font-size: 1rem;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  color: #fff;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.input:focus {
  border-color: #ff9f4a;
}

.input.textarea {
  resize: vertical;
  min-height: 100px;
  font-family: inherit;
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn {
  padding: 10px 20px;
  font-size: 0.9rem;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
}

.btn:active {
  transform: scale(0.98);
}

.btn-primary {
  background: #ff9f4a;
  color: #000;
  font-weight: 600;
}

.btn-primary:hover {
  background: #ffb36a;
}

.btn-secondary {
  background: #333;
  color: #aaa;
}

.btn-secondary:hover {
  background: #444;
}
</style>
