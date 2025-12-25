<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import MermaidDisplay from './MermaidDisplay.vue';
import MultiFieldForm from './MultiFieldForm.vue';
import {
  isMultiFieldRequest,
  type AnyInputRequest,
  type InputRequest,
  type MultiFieldRequest,
} from '../composables/useWebSocket';

const props = defineProps<{
  text: string;
  state: string;
  contentType: 'text' | 'markdown';
  inputRequest?: AnyInputRequest | null;
}>();

const emit = defineEmits<{
  submitInput: [value: string, requestId: string];
  cancelInput: [requestId: string];
  submitMultiForm: [values: Record<string, unknown>, requestId: string];
}>();

// Input form state (for single-field)
const inputValue = ref('');

// Reset input value when request changes (for single-field)
watch(() => props.inputRequest?.requestId, () => {
  if (props.inputRequest && !isMultiFieldRequest(props.inputRequest)) {
    inputValue.value = props.inputRequest.defaultValue || '';
  }
});

// Computed properties
const isWaitingForInput = computed(() => props.state === 'waitingForInput' && props.inputRequest);
const isMultiField = computed(() => isMultiFieldRequest(props.inputRequest ?? null));
const isSingleField = computed(() => isWaitingForInput.value && !isMultiField.value);
const hasInputContent = computed(() => !!props.inputRequest?.content);

// Get single-field request (type-safe)
const singleFieldRequest = computed(() => {
  if (props.inputRequest && !isMultiFieldRequest(props.inputRequest)) {
    return props.inputRequest as InputRequest;
  }
  return null;
});

// Get multi-field request (type-safe)
const multiFieldRequest = computed(() => {
  if (props.inputRequest && isMultiFieldRequest(props.inputRequest)) {
    return props.inputRequest as MultiFieldRequest;
  }
  return null;
});

// Display content: use inputRequest.content when waiting for input, otherwise use text
const displayContent = computed(() => {
  if (isWaitingForInput.value && hasInputContent.value) {
    return props.inputRequest!.content!;
  }
  return props.text;
});

const isEmpty = computed(() => !displayContent.value && !isWaitingForInput.value);
const isMarkdown = computed(() => {
  // Always markdown mode when showing input content
  if (isWaitingForInput.value && hasInputContent.value) return true;
  return props.contentType === 'markdown';
});

const label = computed(() => {
  if (isWaitingForInput.value) {
    return isMultiField.value ? 'Form Required' : 'Input Required';
  }
  return isMarkdown.value ? 'Markdown Content' : 'Displayed Text';
});

// Single-field input handlers
function handleSubmit() {
  if (singleFieldRequest.value) {
    emit('submitInput', inputValue.value, singleFieldRequest.value.requestId);
  }
}

function handleCancel() {
  if (props.inputRequest) {
    emit('cancelInput', props.inputRequest.requestId);
  }
}

// Multi-field form handlers
function handleMultiFormSubmit(values: Record<string, unknown>, requestId: string) {
  emit('submitMultiForm', values, requestId);
}

function handleMultiFormCancel(requestId: string) {
  emit('cancelInput', requestId);
}
</script>

<template>
  <div class="text-display" :class="{ empty: isEmpty, markdown: isMarkdown, 'waiting-input': isWaitingForInput }">
    <div class="label">{{ label }}</div>

    <!-- Main content area -->
    <div class="content" :class="{ 'markdown-mode': isMarkdown, 'has-input': isWaitingForInput }">
      <template v-if="displayContent">
        <!-- Markdown rendering -->
        <MermaidDisplay v-if="isMarkdown" :content="displayContent" />
        <!-- Plain text -->
        <div v-else class="plain-text">{{ displayContent }}</div>
      </template>
      <template v-else-if="!isWaitingForInput">
        <span class="placeholder">No content to display</span>
      </template>
    </div>

    <!-- Single-field input form section -->
    <div v-if="isSingleField && singleFieldRequest" class="input-section">
      <div class="prompt">{{ singleFieldRequest.prompt }}</div>

      <div class="input-wrapper">
        <textarea
          v-if="singleFieldRequest.inputType === 'textarea'"
          v-model="inputValue"
          :placeholder="singleFieldRequest.placeholder"
          class="input textarea"
          rows="3"
        />
        <input
          v-else
          v-model="inputValue"
          :type="singleFieldRequest.inputType === 'number' ? 'number' : 'text'"
          :placeholder="singleFieldRequest.placeholder"
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

    <!-- Multi-field form section -->
    <div v-else-if="isMultiField && multiFieldRequest" class="multi-form-section">
      <MultiFieldForm
        :request="multiFieldRequest"
        @submit="handleMultiFormSubmit"
        @cancel="handleMultiFormCancel"
      />
    </div>
  </div>
</template>

<style scoped>
.text-display {
  background: #1a1a1a;
  border: 2px solid #333;
  border-radius: 12px;
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.text-display:not(.empty) {
  border-color: #4a9eff;
  box-shadow: 0 0 20px rgba(74, 158, 255, 0.1);
}

.text-display.markdown:not(.empty) {
  border-color: #9b59b6;
  box-shadow: 0 0 20px rgba(155, 89, 182, 0.1);
}

/* Waiting for input state - orange border */
.text-display.waiting-input {
  border-color: #ff9f4a;
  box-shadow: 0 0 20px rgba(255, 159, 74, 0.15);
}

.label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #666;
  margin-bottom: 16px;
}

.content {
  flex: 1;
  font-size: 2rem;
  line-height: 1.4;
  word-wrap: break-word;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #fff;
}

/* Markdown mode adjusts layout */
.content.markdown-mode {
  font-size: 1rem;
  align-items: flex-start;
  justify-content: flex-start;
  text-align: left;
  overflow: auto;
}

/* When content has input below, limit height but maximize space */
.content.has-input {
  max-height: 65vh;
  overflow-y: auto;
  margin-bottom: 0;
  padding-bottom: 16px;
  padding-right: 12px;
}

/* Custom scrollbar styling */
.content::-webkit-scrollbar {
  width: 8px;
}

.content::-webkit-scrollbar-track {
  background: transparent;
  margin: 8px 0;
}

.content::-webkit-scrollbar-thumb {
  background: #9b59b6;
  border-radius: 4px;
}

.content::-webkit-scrollbar-thumb:hover {
  background: #a86bc4;
}

.plain-text {
  width: 100%;
}

.placeholder {
  color: #444;
  font-style: italic;
}

.empty .content {
  color: #444;
}

/* Input section styles */
.input-section {
  margin-top: auto;
  border-top: 2px solid #ff9f4a;
  background: linear-gradient(180deg, rgba(255, 159, 74, 0.08) 0%, transparent 100%);
  margin-left: -24px;
  margin-right: -24px;
  margin-bottom: -24px;
  padding: 16px 24px 24px 24px;
  border-radius: 0 0 10px 10px;
}

.prompt {
  font-size: 1.1rem;
  color: #ff9f4a;
  margin-bottom: 12px;
  font-weight: 600;
}

.input-wrapper {
  margin-bottom: 12px;
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
  min-height: 80px;
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

/* Multi-form section */
.multi-form-section {
  margin-top: auto;
  padding-top: 16px;
}
</style>
