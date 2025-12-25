<script setup lang="ts">
import { defineAsyncComponent } from 'vue';

defineProps<{
  content: string;
}>();

// Lazy load markstream-vue to avoid SSR issues
const MarkstreamVue = defineAsyncComponent(() => import('markstream-vue'));
</script>

<template>
  <div class="mermaid-display">
    <Suspense>
      <template #default>
        <MarkstreamVue
          :content="content"
          :enable-mermaid="true"
          :enable-monaco="false"
          :enable-shiki="false"
          class="markdown-content"
        />
      </template>
      <template #fallback>
        <div class="loading">Loading...</div>
      </template>
    </Suspense>
  </div>
</template>

<style scoped>
.mermaid-display {
  width: 100%;
  text-align: left;
  overflow: auto;
}

.loading {
  color: #666;
  font-style: italic;
  padding: 20px;
  text-align: center;
}

/* Markdown content styling for dark theme */
.markdown-content {
  color: #e0e0e0;
  line-height: 1.6;
}

.markdown-content :deep(h1) {
  font-size: 1.8rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem;
  color: #fff;
  border-bottom: 1px solid #333;
  padding-bottom: 0.3rem;
}

.markdown-content :deep(h2) {
  font-size: 1.4rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem;
  color: #fff;
}

.markdown-content :deep(h3) {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0.8rem 0 0.4rem;
  color: #fff;
}

.markdown-content :deep(p) {
  margin: 0.5rem 0;
}

.markdown-content :deep(code) {
  background: #2a2a2a;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.9em;
  color: #4a9eff;
}

.markdown-content :deep(pre) {
  background: #2a2a2a;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  border: 1px solid #333;
  margin: 0.5rem 0;
}

.markdown-content :deep(pre code) {
  background: transparent;
  padding: 0;
  color: #e0e0e0;
}

.markdown-content :deep(blockquote) {
  border-left: 4px solid #4a9eff;
  margin: 0.5rem 0;
  padding-left: 1rem;
  color: #aaa;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}

.markdown-content :deep(li) {
  margin: 0.25rem 0;
}

.markdown-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5rem 0;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid #333;
  padding: 0.5rem;
  text-align: left;
}

.markdown-content :deep(th) {
  background: #2a2a2a;
  font-weight: 600;
}

.markdown-content :deep(a) {
  color: #4a9eff;
  text-decoration: none;
}

.markdown-content :deep(a:hover) {
  text-decoration: underline;
}

/* Mermaid diagram styling */
.markdown-content :deep(.mermaid) {
  background: transparent;
  display: flex;
  justify-content: center;
  margin: 1rem 0;
}

.markdown-content :deep(.mermaid svg) {
  max-width: 100%;
  height: auto;
}
</style>
