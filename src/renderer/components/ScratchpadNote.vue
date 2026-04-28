<template>
   <div
      class="group my-2 flex relative rounded-md focus:outline-none focus:bg-accent/30 hover:bg-accent/30 cursor-pointer"
      tabindex="0"
      @click="$emit('select-note', note.uid)"
   >
      <BaseIcon
         v-if="isBig"
         class="absolute right-0.5 top-0 opacity-70 z-[2] cursor-pointer"
         :icon-name="isSelected ? 'mdiChevronUp' : 'mdiChevronDown'"
         :size="36"
         @click.stop="$emit('toggle-note', note.uid)"
      />
      <div class="flex flex-col items-center justify-center mx-1.5 mt-2 w-10 opacity-80">
         <BaseIcon
            :icon-name="note.type === 'query'
               ? 'mdiHeartOutline'
               : note.type === 'todo'
                  ? note.isArchived
                     ? 'mdiCheckboxMarkedOutline'
                     : 'mdiCheckboxBlankOutline'
                  : 'mdiNoteEditOutline'"
            :size="36"
         />
         <div class="text-[8px] uppercase">
            {{ note.type }}
         </div>
      </div>
      <div class="flex flex-col justify-between p-1 pl-0.5 min-h-[75px] flex-1 min-w-0">
         <div class="relative" :class="isSelected ? '' : 'max-h-9 overflow-hidden'">
            <code
               v-if="note.type === 'query'"
               ref="noteParagraph"
               class="note-md-content sql block w-full max-w-full text-[100%] opacity-80 font-semibold whitespace-pre-wrap"
               v-html="highlight(note.note, {html: true})"
            />
            <div
               v-else
               ref="noteParagraph"
               class="note-md-content"
               v-html="parseMarkdown(highlightWord(note.note))"
            />
            <div
               v-if="isBig && !isSelected"
               class="absolute top-0 h-9 w-full pointer-events-none bg-gradient-to-b from-background/0 from-70% to-background"
            />
         </div>
         <div class="flex justify-between items-center">
            <small class="opacity-80 text-[12px] truncate">
               {{ getConnectionName(note.cUid) || t('general.all') }} · {{ formatDate(note.date) }}
            </small>
            <div class="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
               <Tooltip v-if="note.type === 'todo' && !note.isArchived">
                  <TooltipTrigger as-child>
                     <Button
                        variant="ghost"
                        size="icon"
                        class="!h-6 !w-6"
                        @click.stop="$emit('archive-note', note.uid)"
                     >
                        <BaseIcon icon-name="mdiCheck" :size="16" />
                     </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                     {{ t('general.archive') }}
                  </TooltipContent>
               </Tooltip>
               <Tooltip v-if="note.type === 'todo' && note.isArchived">
                  <TooltipTrigger as-child>
                     <Button
                        variant="ghost"
                        size="icon"
                        class="!h-6 !w-6"
                        @click.stop="$emit('restore-note', note.uid)"
                     >
                        <BaseIcon icon-name="mdiRestore" :size="16" />
                     </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                     {{ t('general.undo') }}
                  </TooltipContent>
               </Tooltip>
               <Tooltip v-if="note.type === 'query'">
                  <TooltipTrigger as-child>
                     <Button
                        variant="ghost"
                        size="icon"
                        class="!h-6 !w-6"
                        @click.stop="$emit('select-query', note.note)"
                     >
                        <BaseIcon icon-name="mdiOpenInApp" :size="16" />
                     </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                     {{ t('general.select') }}
                  </TooltipContent>
               </Tooltip>
               <Tooltip v-if="note.type === 'query'">
                  <TooltipTrigger as-child>
                     <Button
                        variant="ghost"
                        size="icon"
                        class="!h-6 !w-6"
                        @click.stop="copyText(note.note)"
                     >
                        <BaseIcon icon-name="mdiContentCopy" :size="14" />
                     </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                     {{ t('general.copy') }}
                  </TooltipContent>
               </Tooltip>
               <Tooltip v-if="!note.isArchived">
                  <TooltipTrigger as-child>
                     <Button
                        variant="ghost"
                        size="icon"
                        class="!h-6 !w-6"
                        @click.stop="$emit('edit-note')"
                     >
                        <BaseIcon icon-name="mdiPencil" :size="16" />
                     </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                     {{ t('general.edit') }}
                  </TooltipContent>
               </Tooltip>
               <Tooltip>
                  <TooltipTrigger as-child>
                     <Button
                        variant="ghost"
                        size="icon"
                        class="!h-6 !w-6 text-destructive hover:text-destructive"
                        @click.stop="$emit('delete-note', note.uid)"
                     >
                        <BaseIcon icon-name="mdiDeleteForever" :size="16" />
                     </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                     {{ t('general.delete') }}
                  </TooltipContent>
               </Tooltip>
            </div>
         </div>
      </div>
   </div>
</template>
<script setup lang="ts">
import { useElementBounding } from '@vueuse/core';
import { marked } from 'marked';
import { highlight } from 'sql-highlight';
import { computed, PropType, Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFilters } from '@/composables/useFilters';
import { copyText } from '@/libs/copyText';
import { useConnectionsStore } from '@/stores/connections';
import { ConnectionNote } from '@/stores/scratchpad';

const props = defineProps({
   note: {
      type: Object as PropType<ConnectionNote>,
      required: true
   },
   searchTerm: {
      type: String,
      default: () => ''
   },
   selectedNote: {
      type: String,
      default: () => ''
   }
});

const { t } = useI18n();
const { formatDate } = useFilters();
const { getConnectionName } = useConnectionsStore();

defineEmits<{
   'edit-note': [];
   'delete-note': [uid: string];
   'select-note': [uid: string];
   'toggle-note': [uid: string];
   'archive-note': [uid: string];
   'restore-note': [uid: string];
   'select-query': [note: string];
}>();

const noteParagraph: Ref<HTMLDivElement> = ref(null);
const noteHeight = ref(useElementBounding(noteParagraph)?.height);

const isSelected = computed(() => props.selectedNote === props.note.uid);
const isBig = computed(() => noteHeight.value > 75);

const parseMarkdown = (text: string) => {
   const renderer = {
      listitem (text: string) {
         return `<li>${text.replace(/ *\([^)]*\) */g, '')}</li>`;
      },
      link (href: string, title: string, text: string) {
         return `<a>${text}</a>`;
      }
   };

   marked.use({ renderer });

   return marked(text);
};

const highlightWord = (string: string) => {
   string = string.replaceAll('<', '&lt;').replaceAll('>', '&gt;');

   if (props.searchTerm) {
      const regexp = new RegExp(`(${props.searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      return string.replace(regexp, '<span class="text-primary text-bold">$1</span>');
   }
   else
      return string;
};
</script>
<style>
/* Reset margins inside markdown-rendered note content. Not scoped because
   the inner HTML is injected via v-html and Vue's scoped CSS won't apply. */
.note-md-content {
   white-space: initial;
   word-break: break-word;
   user-select: text;
}

.note-md-content h1,
.note-md-content h2,
.note-md-content h3,
.note-md-content h4,
.note-md-content h5,
.note-md-content h6,
.note-md-content p,
.note-md-content li {
   margin: 0;
}
</style>
