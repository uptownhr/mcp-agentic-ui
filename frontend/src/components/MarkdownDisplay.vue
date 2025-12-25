<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue';
import MarkdownIt from 'markdown-it';
import mermaid from 'mermaid';

const props = defineProps<{
  content: string;
}>();

const renderedHtml = ref('');
const containerRef = ref<HTMLElement | null>(null);

// Initialize markdown-it
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
});

// Custom renderer for code blocks to handle mermaid
const defaultFence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const lang = token.info.trim().toLowerCase();

  if (lang === 'mermaid') {
    // Return a placeholder div for mermaid
    const code = token.content.trim();
    return `<div class="mermaid-block" data-mermaid="${encodeURIComponent(code)}"></div>`;
  }

  // Use default renderer for other code blocks
  return defaultFence(tokens, idx, options, env, self);
};

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
});

async function renderMermaidBlocks() {
  if (!containerRef.value) return;

  const mermaidBlocks = containerRef.value.querySelectorAll('.mermaid-block');

  for (let i = 0; i < mermaidBlocks.length; i++) {
    const block = mermaidBlocks[i] as HTMLElement;
    const code = decodeURIComponent(block.dataset.mermaid || '');

    if (code) {
      try {
        const id = `mermaid-${Date.now()}-${i}`;
        const { svg } = await mermaid.render(id, code);
        block.innerHTML = svg;
        block.classList.add('mermaid-rendered');
      } catch (e) {
        console.error('Mermaid render error:', e);
        block.innerHTML = `<pre class="mermaid-error">${code}</pre>`;
      }
    }
  }
}

function render() {
  renderedHtml.value = md.render(props.content || '');
  nextTick(() => {
    renderMermaidBlocks();
  });
}

watch(() => props.content, render, { immediate: true });
onMounted(render);
</script>

<template>
  <div ref="containerRef" class="markdown-display" v-html="renderedHtml"></div>
</template>

<style scoped>
.markdown-display {
  width: 100%;
  text-align: left;
  overflow: auto;
  color: #e0e0e0;
  line-height: 1.6;
}

.markdown-display :deep(h1) {
  font-size: 1.8rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem;
  color: #fff;
  border-bottom: 1px solid #333;
  padding-bottom: 0.3rem;
}

.markdown-display :deep(h2) {
  font-size: 1.4rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem;
  color: #fff;
}

.markdown-display :deep(h3) {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0.8rem 0 0.4rem;
  color: #fff;
}

.markdown-display :deep(p) {
  margin: 0.5rem 0;
}

.markdown-display :deep(code) {
  background: #2a2a2a;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 0.9em;
  color: #4a9eff;
}

.markdown-display :deep(pre) {
  background: #1e1e1e;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  border: 1px solid #333;
  margin: 0.5rem 0;
}

.markdown-display :deep(pre code) {
  background: transparent;
  padding: 0;
  color: #d4d4d4;
  font-size: 0.85em;
  line-height: 1.5;
}

.markdown-display :deep(blockquote) {
  border-left: 4px solid #4a9eff;
  margin: 0.5rem 0;
  padding-left: 1rem;
  color: #aaa;
  font-style: italic;
}

.markdown-display :deep(ul),
.markdown-display :deep(ol) {
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}

.markdown-display :deep(li) {
  margin: 0.25rem 0;
}

.markdown-display :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5rem 0;
}

.markdown-display :deep(th),
.markdown-display :deep(td) {
  border: 1px solid #333;
  padding: 0.5rem;
  text-align: left;
}

.markdown-display :deep(th) {
  background: #2a2a2a;
  font-weight: 600;
}

.markdown-display :deep(a) {
  color: #4a9eff;
  text-decoration: none;
}

.markdown-display :deep(a:hover) {
  text-decoration: underline;
}

.markdown-display :deep(hr) {
  border: none;
  border-top: 1px solid #333;
  margin: 1rem 0;
}

/* Mermaid diagram styling */
.markdown-display :deep(.mermaid-block) {
  background: #1e1e1e;
  border-radius: 8px;
  padding: 1rem;
  margin: 0.5rem 0;
  display: flex;
  justify-content: center;
}

.markdown-display :deep(.mermaid-rendered) {
  background: transparent;
}

.markdown-display :deep(.mermaid-rendered svg) {
  max-width: 100%;
  height: auto;
}

.markdown-display :deep(.mermaid-error) {
  color: #f44;
  font-size: 0.85em;
}
</style>
