<template>
   <Dialog :open="true" @update:open="(v) => { if (!v) hideScratchpad(); }">
      <DialogContent
         class="max-w-[640px] !p-0 !gap-0 [&>button.absolute]:!hidden flex flex-col max-h-[85vh]"
         @escape-key-down.prevent="hideScratchpad"
         @pointer-down-outside.prevent="hideScratchpad"
      >
         <DialogHeader class="flex flex-row items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/30">
            <DialogTitle class="!text-[14px] !font-semibold flex items-center gap-1.5">
               <BaseIcon icon-name="mdiNotebookOutline" :size="20" />
               <span>{{ t('application.note', 2) }}</span>
            </DialogTitle>
            <DialogDescription class="sr-only">
               {{ t('application.note', 2) }}
            </DialogDescription>
            <Button
               variant="ghost"
               size="icon"
               class="!h-7 !w-7"
               @click.stop="hideScratchpad"
            >
               <BaseIcon icon-name="mdiClose" :size="16" />
            </Button>
         </DialogHeader>

         <div class="flex flex-col min-h-0 flex-1 relative">
            <div ref="noteFilters" class="flex items-center gap-2.5 p-2 border-b border-border/60">
               <div class="flex-1 min-w-0">
                  <BaseSelect
                     v-model="localConnection"
                     :options="connectionOptions"
                     option-track-by="code"
                     option-label="name"
                     @change="null"
                  />
               </div>
               <div class="flex items-stretch gap-px rounded-md overflow-hidden border border-border">
                  <button
                     v-for="tag in [{ code: 'all', name: t('general.all') }, ...noteTags]"
                     :key="tag.code"
                     type="button"
                     class="px-3 text-[12px] uppercase font-medium transition-colors"
                     :class="selectedTag === tag.code
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-card-foreground hover:bg-accent/50'"
                     @click="setTag(tag.code)"
                  >
                     {{ tag.name }}
                  </button>
               </div>
               <Tooltip>
                  <TooltipTrigger as-child>
                     <Button
                        :variant="showArchived ? 'default' : 'ghost'"
                        size="icon"
                        class="!h-9 !w-9 rounded-full shrink-0"
                        @click="showArchived = !showArchived"
                     >
                        <BaseIcon
                           :icon-name="!showArchived ? 'mdiArchiveEyeOutline' : 'mdiArchiveCancelOutline'"
                           :size="18"
                        />
                     </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                     {{ showArchived ? t('application.hideArchivedNotes') : t('application.showArchivedNotes') }}
                  </TooltipContent>
               </Tooltip>
            </div>

            <div
               v-show="filteredNotes.length || searchTerm.length"
               ref="searchForm"
               class="relative p-2 border-b border-border/60"
            >
               <Input
                  v-model="searchTerm"
                  type="text"
                  class="pr-9"
                  :placeholder="t('general.search')"
               />
               <BaseIcon
                  v-if="!searchTerm"
                  icon-name="mdiMagnify"
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  :size="18"
               />
               <BaseIcon
                  v-else
                  icon-name="mdiBackspace"
                  class="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                  :size="18"
                  @click="searchTerm = ''"
               />
            </div>

            <div
               v-if="filteredNotes.length"
               ref="tableWrapper"
               class="overflow-auto px-2 flex-1"
               style="overflow-anchor: none;"
               :style="{ height: resultsSize + 'px' }"
            >
               <div ref="table">
                  <BaseVirtualScroll
                     ref="resultTable"
                     :items="filteredNotes"
                     :item-height="83"
                     :visible-height="resultsSize"
                     :scroll-element="scrollElement"
                  >
                     <template #default="{ items }">
                        <ScratchpadNote
                           v-for="note in items"
                           :key="note.uid"
                           :search-term="searchTerm"
                           :note="note"
                           :selected-note="selectedNote"
                           @select-note="selectedNote = note.uid"
                           @toggle-note="toggleNote"
                           @edit-note="startEditNote(note)"
                           @delete-note="deleteNote"
                           @archive-note="archiveNote"
                           @restore-note="restoreNote"
                           @select-query="selectQuery"
                        />
                     </template>
                  </BaseVirtualScroll>
               </div>
            </div>
            <div v-else class="flex flex-col items-center justify-center gap-3 py-10 flex-1">
               <BaseIcon
                  icon-name="mdiNoteSearch"
                  :size="48"
                  class="text-muted-foreground"
               />
               <p class="text-[15px] font-semibold text-muted-foreground">
                  {{ t('application.thereAreNoNotesYet') }}
               </p>
            </div>

            <Tooltip>
               <TooltipTrigger as-child>
                  <Button
                     class="absolute bottom-4 right-4 !h-12 !w-12 rounded-full shadow-lg z-10"
                     @click="isAddModal = true"
                  >
                     <BaseIcon icon-name="mdiPlus" :size="28" />
                  </Button>
               </TooltipTrigger>
               <TooltipContent side="left">
                  {{ t('application.addNote') }}
               </TooltipContent>
            </Tooltip>
         </div>
      </DialogContent>
   </Dialog>
   <ModalNoteNew v-if="isAddModal" @hide="isAddModal = false" />
   <ModalNoteEdit
      v-if="isEditModal"
      :note="noteToEdit"
      @hide="closeEditModal"
   />
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import {
   Component,
   computed,
   ComputedRef,
   onBeforeUnmount,
   onMounted,
   onUpdated,
   provide,
   Ref,
   ref,
   watch
} from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import BaseVirtualScroll from '@/components/BaseVirtualScroll.vue';
import ModalNoteEdit from '@/components/ModalNoteEdit.vue';
import ModalNoteNew from '@/components/ModalNoteNew.vue';
import ScratchpadNote from '@/components/ScratchpadNote.vue';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useApplicationStore } from '@/stores/application';
import { useConnectionsStore } from '@/stores/connections';
import { ConnectionNote, TagCode, useScratchpadStore } from '@/stores/scratchpad';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const applicationStore = useApplicationStore();
const scratchpadStore = useScratchpadStore();
const workspacesStore = useWorkspacesStore();

const { connectionNotes, selectedTag } = storeToRefs(scratchpadStore);
const { changeNotes } = scratchpadStore;
const { hideScratchpad } = applicationStore;
const { getConnectionName } = useConnectionsStore();
const { connections } = storeToRefs(useConnectionsStore());
const { getSelected: selectedWorkspace } = storeToRefs(workspacesStore);
const { getWorkspaceTab, getWorkspace, newTab, updateTabContent } = workspacesStore;

const localConnection = ref(null);
const table: Ref<HTMLDivElement> = ref(null);
const resultTable: Ref<Component & { updateWindow: () => void }> = ref(null);
const tableWrapper: Ref<HTMLDivElement> = ref(null);
const noteFilters: Ref<HTMLInputElement> = ref(null);
const searchForm: Ref<HTMLInputElement> = ref(null);
const resultsSize = ref(1000);
const searchTermInterval: Ref<NodeJS.Timeout> = ref(null);
const scrollElement: Ref<HTMLDivElement> = ref(null);
const searchTerm = ref('');
const localSearchTerm = ref('');
const showArchived = ref(false);
const isAddModal = ref(false);
const isEditModal = ref(false);
const noteToEdit: Ref<ConnectionNote> = ref(null);
const selectedNote = ref(null);

const noteTags: ComputedRef<{code: TagCode; name: string}[]> = computed(() => [
   { code: 'note', name: t('application.note') },
   { code: 'todo', name: 'TODO' },
   { code: 'query', name: 'Query' }
]);
const filteredNotes = computed(() => connectionNotes.value.filter(n => (
   (n.type === selectedTag.value || selectedTag.value === 'all') &&
   (n.cUid === localConnection.value || localConnection.value === null) &&
   (!n.isArchived || showArchived.value) &&
   (n.note.toLowerCase().search(localSearchTerm.value.toLowerCase()) >= 0)
)));
const connectionOptions = computed(() => {
   return [
      { code: null, name: t('general.all') },
      ...connections.value.map(c => ({ code: c.uid, name: getConnectionName(c.uid) }))
   ];
});

provide('noteTags', noteTags);
provide('connectionOptions', connectionOptions);
provide('selectedConnection', localConnection);
provide('selectedTag', selectedTag);

const resizeResults = () => {
   if (resultTable.value) {
      const el = tableWrapper.value.parentElement;

      if (el)
         resultsSize.value = el.offsetHeight - searchForm.value.offsetHeight - noteFilters.value.offsetHeight;

      resultTable.value.updateWindow();
   }
};

const refreshScroller = () => resizeResults();

const setTag = (tag: string) => {
   selectedTag.value = tag;
};

const toggleNote = (uid: string) => {
   selectedNote.value = selectedNote.value !== uid ? uid : null;
};

const startEditNote = (note: ConnectionNote) => {
   isEditModal.value = true;
   noteToEdit.value = note;
};

const archiveNote = (uid: string) => {
   const remappedNotes = connectionNotes.value.map(n => {
      if (n.uid === uid)
         n.isArchived = true;
      return n;
   });
   changeNotes(remappedNotes);
};

const restoreNote = (uid: string) => {
   const remappedNotes = connectionNotes.value.map(n => {
      if (n.uid === uid)
         n.isArchived = false;
      return n;
   });
   changeNotes(remappedNotes);
};

const deleteNote = (uid: string) => {
   const otherNotes = connectionNotes.value.filter(n => n.uid !== uid);
   changeNotes(otherNotes);
};

const selectQuery = (query: string) => {
   const workspace = getWorkspace(selectedWorkspace.value);
   const selectedTab = getWorkspaceTab(workspace.selectedTab);

   if (workspace.connectionStatus !== 'connected') return;

   if (selectedTab.type === 'query') {
      updateTabContent({
         tab: selectedTab.uid,
         uid: selectedWorkspace.value,
         type: 'query',
         content: query,
         schema: workspace.breadcrumbs.schema
      });
   }
   else {
      newTab({
         uid: selectedWorkspace.value,
         type: 'query',
         content: query,
         autorun: false,
         schema: workspace.breadcrumbs.schema
      });
   }

   hideScratchpad();
};

const closeEditModal = () => {
   isEditModal.value = false;
   noteToEdit.value = null;
};

watch(searchTerm, () => {
   clearTimeout(searchTermInterval.value);

   searchTermInterval.value = setTimeout(() => {
      localSearchTerm.value = searchTerm.value;
   }, 200);
});

onUpdated(() => {
   if (table.value)
      refreshScroller();

   if (tableWrapper.value)
      scrollElement.value = tableWrapper.value;
});

onMounted(() => {
   resizeResults();
   window.addEventListener('resize', resizeResults);

   if (selectedWorkspace.value && selectedWorkspace.value !== 'NEW')
      localConnection.value = selectedWorkspace.value;
});

onBeforeUnmount(() => {
   window.removeEventListener('resize', resizeResults);
   clearInterval(searchTermInterval.value);
});

</script>
