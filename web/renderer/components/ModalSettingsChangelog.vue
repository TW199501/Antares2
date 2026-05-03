<template>
   <ScrollArea class="h-[60vh]">
      <div id="changelog" class="px-5 py-4 space-y-8">
         <article
            v-for="note in sortedNotes"
            :key="note.version"
            class="text-sm leading-relaxed"
            v-html="note.html"
         />
         <p
            v-if="!sortedNotes.length"
            class="text-center text-muted-foreground py-8"
         >
            v{{ appVersion }}
         </p>
      </div>
   </ScrollArea>
</template>

<script setup lang="ts">
import { marked } from 'marked';
import { computed } from 'vue';

import { ScrollArea } from '@/components/ui/scroll-area';
import { useApplicationStore } from '@/stores/application';

const { appVersion } = useApplicationStore();

const notesGlob = import.meta.glob('../../../docs/release-notes-v*.md', {
   query: '?raw',
   import: 'default',
   eager: true
}) as Record<string, string>;

const sortedNotes = computed(() => {
   return Object.entries(notesGlob)
      .map(([path, content]) => {
         const m = path.match(/release-notes-v(\d+)\.(\d+)\.(\d+)\.md$/);
         const version = m ? `${m[1]}.${m[2]}.${m[3]}` : '0.0.0';
         const sortKey = m
            ? Number(m[1]) * 1e6 + Number(m[2]) * 1e3 + Number(m[3])
            : 0;
         return {
            version,
            sortKey,
            html: marked.parse(content, { async: false }) as string
         };
      })
      .sort((a, b) => b.sortKey - a.sortKey);
});
</script>

<style lang="scss">
#changelog {
  h1 { @apply text-[18px] font-semibold mb-2 pb-2 border-b border-border/60; }
  h2 { @apply text-[15px] font-semibold mt-4 mb-1.5; }
  h3 { @apply text-[14px] font-semibold mt-3 mb-1; }
  p { @apply mb-2 text-foreground/85; }
  ul { @apply list-disc pl-5 space-y-1 mb-2 text-foreground/85; }
  ol { @apply list-decimal pl-5 space-y-1 mb-2 text-foreground/85; }
  li { margin-top: 0; }
  code { @apply px-1 py-0.5 rounded bg-muted text-[12px] font-mono; }
  pre { @apply p-3 rounded bg-muted overflow-x-auto text-[12px] font-mono mb-2; }
  pre code { @apply p-0 bg-transparent; }
  table { @apply w-full text-[12px] my-2 border-collapse; }
  th, td { @apply border border-border/60 px-2 py-1 text-left; }
  th { @apply bg-muted/50 font-semibold; }
  hr { @apply my-3 border-border/60; }
  a { @apply text-primary underline hover:opacity-80; }
  blockquote { @apply pl-3 border-l-2 border-border/60 text-muted-foreground italic; }
  strong { @apply font-semibold; }
}
</style>
