<script setup lang="ts">
import { watch, computed, reactive } from 'vue';
import type { MultiFieldRequest, FormField } from '../composables/useWebSocket';
import MermaidDisplay from './MermaidDisplay.vue';

const props = defineProps<{
  request: MultiFieldRequest;
}>();

const hasContent = computed(() => !!props.request.content);

const emit = defineEmits<{
  submit: [values: Record<string, unknown>, requestId: string];
  cancel: [requestId: string];
}>();

// Form value type
type FormValue = string | number | boolean;

// Initialize form values from default values
function initFormValues(): Record<string, FormValue> {
  const values: Record<string, FormValue> = {};
  for (const field of props.request.fields) {
    if (field.defaultValue !== undefined) {
      values[field.key] = field.defaultValue;
    } else if (field.type === 'checkbox') {
      values[field.key] = false;
    } else if (field.type === 'number') {
      values[field.key] = 0;
    } else {
      values[field.key] = '';
    }
  }
  return values;
}

const formValues = reactive<Record<string, FormValue>>(initFormValues());

// Reset values when request changes
watch(() => props.request.requestId, () => {
  const newValues = initFormValues();
  for (const key of Object.keys(formValues)) {
    delete formValues[key];
  }
  Object.assign(formValues, newValues);
});

function handleSubmit() {
  // Convert reactive object to plain object
  const values: Record<string, unknown> = { ...formValues };
  emit('submit', values, props.request.requestId);
}

function handleCancel() {
  emit('cancel', props.request.requestId);
}

// Get appropriate input type for number fields
function getInputType(field: FormField): string {
  switch (field.type) {
    case 'number':
      return 'number';
    default:
      return 'text';
  }
}
</script>

<template>
  <div class="multi-field-form" :class="{ 'has-content': hasContent }">
    <!-- Markdown content section (when provided) -->
    <div v-if="hasContent" class="content-section">
      <MermaidDisplay :content="request.content!" />
    </div>

    <!-- Form section -->
    <div class="form-section">
      <div class="fields">
        <div v-for="field in request.fields" :key="field.key" class="field">
          <label :for="field.key" class="field-label">
            {{ field.label }}
            <span v-if="field.required" class="required">*</span>
          </label>

          <!-- Textarea -->
          <textarea
            v-if="field.type === 'textarea'"
            :id="field.key"
            :value="formValues[field.key] as string"
            @input="formValues[field.key] = ($event.target as HTMLTextAreaElement).value"
            :placeholder="field.placeholder"
            class="input textarea"
            rows="3"
          />

          <!-- Checkbox -->
          <label v-else-if="field.type === 'checkbox'" class="checkbox-wrapper">
            <input
              :id="field.key"
              v-model="formValues[field.key]"
              type="checkbox"
              class="checkbox"
            />
            <span class="checkbox-label">{{ field.placeholder || 'Yes' }}</span>
          </label>

          <!-- Select -->
          <select
            v-else-if="field.type === 'select'"
            :id="field.key"
            v-model="formValues[field.key]"
            class="input select"
          >
            <option value="" disabled>{{ field.placeholder || 'Select...' }}</option>
            <option v-for="option in field.options" :key="option" :value="option">
              {{ option }}
            </option>
          </select>

          <!-- Text / Number input -->
          <input
            v-else
            :id="field.key"
            v-model="formValues[field.key]"
            :type="getInputType(field)"
            :placeholder="field.placeholder"
            class="input"
          />
        </div>
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
  </div>
</template>

<style scoped>
.multi-field-form {
  background: #1a1a1a;
  border: 2px solid #ff9f4a;
  border-radius: 12px;
  padding: 24px;
  animation: fadeIn 0.3s ease;
  max-width: 600px;
  margin: 0 auto;
}

/* Expand width when content is present */
.multi-field-form.has-content {
  max-width: 800px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

/* Content section - displays markdown above form */
.content-section {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #333;
}

/* Form section */
.form-section {
  /* Contains fields and actions */
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 0.9rem;
  color: #ccc;
  font-weight: 500;
}

.required {
  color: #ff6b6b;
  margin-left: 2px;
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

.input.select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

/* Checkbox styling */
.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 8px 0;
}

.checkbox {
  width: 20px;
  height: 20px;
  accent-color: #ff9f4a;
  cursor: pointer;
}

.checkbox-label {
  color: #fff;
  font-size: 0.95rem;
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
