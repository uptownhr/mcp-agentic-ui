<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  text: string;
  state: string;
}>();

const isEmpty = computed(() => !props.text);
</script>

<template>
  <div class="text-display" :class="{ empty: isEmpty, 'state-change': true }">
    <div class="label">Displayed Text</div>
    <div class="content">
      <template v-if="!isEmpty">
        {{ text }}
      </template>
      <template v-else>
        <span class="placeholder">No text to display</span>
      </template>
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

.placeholder {
  color: #444;
  font-style: italic;
}

.empty .content {
  color: #444;
}
</style>
