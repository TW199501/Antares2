<template>
   <div
      v-show="isSelected"
      class="workspace-query-tab no-outline flex w-full flex-col p-0"
      tabindex="0"
   >
      <div class="workspace-query-runner flex w-full flex-col">
         <QueryEditor
            v-show="isSelected"
            id="query-editor"
            ref="queryEditor"
            v-model="query"
            :auto-focus="true"
            :workspace="workspace"
            :schema="breadcrumbsSchema"
            :is-selected="isSelected"
            :height="editorHeight"
            editor-classes="editor-query"
         />
         <div ref="resizer" class="query-area-resizer" />
         <div ref="queryAreaFooter" class="workspace-query-runner-footer">
            <div class="workspace-query-buttons">
               <div
                  @mouseenter="setCancelButtonVisibility(true)"
                  @mouseleave="setCancelButtonVisibility(false)"
               >
                  <Button
                     v-if="showCancel && isQuering"
                     variant="destructive"
                     size="sm"
                     :disabled="!query"
                     :title="t('general.cancel')"
                     class="gap-1"
                     @click="killTabQuery()"
                  >
                     <BaseIcon icon-name="mdiWindowClose" :size="16" />
                     <span>{{ t('general.run') }}</span>
                  </Button>
                  <Button
                     v-else
                     variant="default"
                     size="sm"
                     :class="['gap-1', { 'opacity-70': isQuering }]"
                     :disabled="!query"
                     @click="runQuery(query)"
                  >
                     <BaseIcon icon-name="mdiPlay" :size="16" />
                     <span>{{ t('general.run') }}</span>
                  </Button>
               </div>
               <Button
                  v-if="!autocommit"
                  variant="secondary"
                  size="sm"
                  :class="['gap-1', { 'opacity-70': isQuering }]"
                  @click="commitTab()"
               >
                  <BaseIcon icon-name="mdiCubeSend" :size="16" />
                  <span>{{ t('database.commit') }}</span>
               </Button>
               <Button
                  v-if="!autocommit"
                  variant="secondary"
                  size="sm"
                  :class="['gap-1', { 'opacity-70': isQuering }]"
                  @click="rollbackTab()"
               >
                  <BaseIcon icon-name="mdiUndoVariant" :size="16" />
                  <span>{{ t('database.rollback') }}</span>
               </Button>
               <Button
                  variant="ghost"
                  size="sm"
                  class="gap-1"
                  :disabled="!query || isQuering"
                  @click="clear()"
               >
                  <BaseIcon icon-name="mdiDeleteSweep" :size="16" />
                  <span>{{ t('general.clear') }}</span>
               </Button>

               <div class="mx-1 h-5 w-px bg-border/60" />

               <Button
                  variant="secondary"
                  size="icon"
                  class="h-8 w-8"
                  :disabled="!query || isQuering"
                  :title="t('general.format')"
                  @click="beautify()"
               >
                  <BaseIcon icon-name="mdiBrush" :size="16" />
               </Button>
               <div class="inline-flex overflow-hidden rounded-md border border-border/60 bg-secondary">
                  <button
                     type="button"
                     class="inline-flex h-8 w-8 items-center justify-center text-secondary-foreground transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50"
                     :disabled="!filePath || lastSavedQuery === query"
                     :title="t('application.saveFile')"
                     @click="saveFile()"
                  >
                     <BaseIcon icon-name="mdiContentSaveCheckOutline" :size="16" />
                  </button>
                  <div class="w-px bg-border/60" />
                  <button
                     type="button"
                     class="inline-flex h-8 w-8 items-center justify-center text-secondary-foreground transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50"
                     :title="t('application.saveFileAs')"
                     @click="saveFileAs()"
                  >
                     <BaseIcon icon-name="mdiContentSavePlusOutline" :size="16" />
                  </button>
                  <div class="w-px bg-border/60" />
                  <button
                     type="button"
                     class="inline-flex h-8 w-8 items-center justify-center text-secondary-foreground transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50"
                     :title="t('application.openFile')"
                     @click="openFile()"
                  >
                     <BaseIcon icon-name="mdiFolderOpenOutline" :size="16" />
                  </button>
               </div>
               <div class="inline-flex overflow-hidden rounded-md border border-border/60 bg-secondary">
                  <button
                     type="button"
                     class="inline-flex h-8 w-8 items-center justify-center text-secondary-foreground transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50"
                     :disabled="isQuering || (isQuerySaved || query.length < 5)"
                     :title="t('application.saveAsNote')"
                     @click="saveQuery()"
                  >
                     <BaseIcon icon-name="mdiHeartPlusOutline" :size="16" />
                  </button>
                  <div class="w-px bg-border/60" />
                  <button
                     type="button"
                     class="inline-flex h-8 w-8 items-center justify-center text-secondary-foreground transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50"
                     :disabled="isQuering"
                     :title="t('database.savedQueries')"
                     @click="openSavedModal()"
                  >
                     <BaseIcon icon-name="mdiNotebookHeartOutline" :size="16" />
                  </button>
               </div>
               <Button
                  variant="secondary"
                  size="icon"
                  class="h-8 w-8"
                  :disabled="isQuering"
                  :title="t('general.history')"
                  @click="openHistoryModal()"
               >
                  <BaseIcon icon-name="mdiHistory" :size="16" />
               </Button>
               <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                     <Button
                        variant="secondary"
                        size="sm"
                        :disabled="!hasResults || isQuering"
                        class="gap-1"
                        tabindex="0"
                     >
                        <BaseIcon icon-name="mdiFileExport" :size="16" />
                        <span>{{ t('database.export') }}</span>
                        <BaseIcon icon-name="mdiMenuDown" :size="16" />
                     </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                     <DropdownMenuItem @select="downloadTable('json')">
                        JSON
                     </DropdownMenuItem>
                     <DropdownMenuItem @select="downloadTable('csv')">
                        CSV
                     </DropdownMenuItem>
                     <DropdownMenuItem @select="downloadTable('php')">
                        {{ t('application.phpArray') }}
                     </DropdownMenuItem>
                     <DropdownMenuItem @select="downloadTable('sql')">
                        SQL INSERT
                     </DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>
               <div class="commit-mode-select" :title="t('database.commitMode')">
                  <BaseIcon
                     icon-name="mdiSourceCommit"
                     :size="18"
                     class="text-muted-foreground"
                  />
                  <BaseSelect
                     v-model="autocommit"
                     :options="[{value: true, label: t('database.autoCommit')}, {value: false, label: t('database.manualCommit')}]"
                     :option-label="(opt: any) => opt.label"
                     :option-track-by="(opt: any) => opt.value"
                  />
               </div>
            </div>
            <div class="workspace-query-info">
               <div
                  v-if="results.length"
                  class="flex items-center gap-1"
                  :title="t('database.queryDuration')"
               >
                  <BaseIcon
                     icon-name="mdiTimerSand"
                     :rotate="180"
                     :size="14"
                     class="text-muted-foreground"
                  /> <b>{{ durationsCount / 1000 }}s</b>
               </div>
               <div
                  v-if="resultsCount"
                  class="flex items-center gap-1"
                  :title="t('general.results')"
               >
                  <BaseIcon
                     icon-name="mdiEqual"
                     :size="14"
                     class="text-muted-foreground"
                  />
                  <b>{{ resultsCount.toLocaleString() }}</b>
               </div>
               <div
                  v-if="hasAffected"
                  class="flex items-center gap-1"
                  :title="t('database.affectedRows')"
               >
                  <BaseIcon
                     icon-name="mdiTarget"
                     :size="14"
                     class="text-muted-foreground"
                  />
                  <b>{{ affectedCount }}</b>
               </div>
               <div class="schema-select" :title="t('database.schema')">
                  <BaseIcon
                     icon-name="mdiDatabase"
                     :size="18"
                     class="text-muted-foreground"
                  />
                  <BaseSelect
                     v-model="selectedSchema"
                     :options="[{value: null, label: t('database.noSchema')}, ...databaseSchemas.map(el => ({label: el, value: el}))]"
                  />
               </div>
            </div>
         </div>
      </div>
      <WorkspaceTabQueryEmptyState v-if="!results.length && !isQuering" :customizations="workspace.customizations" />
      <div class="workspace-query-results p-relative w-full">
         <BaseLoader v-if="isQuering" />
         <WorkspaceTabQueryTable
            v-if="results"
            v-show="!isQuering"
            ref="queryTable"
            :is-quering="isQuering"
            :results="results"
            :tab-uid="tab.uid"
            :conn-uid="connection.uid"
            :is-selected="isSelected"
            mode="query"
            @update-field="updateField"
            @delete-selected="deleteSelected"
         />
      </div>
      <ModalHistory
         v-if="isHistoryOpen"
         :connection="connection"
         @select-query="selectQuery"
         @close="isHistoryOpen = false"
      />
   </div>
</template>

<script setup lang="ts">
import { Ace } from 'ace-builds';
import { ConnectionParams } from 'common/interfaces/antares';
import { uidGen } from 'common/libs/uidGen';
import { storeToRefs } from 'pinia';
import { format } from 'sql-formatter';
import { Component, computed, onBeforeUnmount, onMounted, Prop, Ref, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import BaseLoader from '@/components/BaseLoader.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import ModalHistory from '@/components/ModalHistory.vue';
import QueryEditor from '@/components/QueryEditor.vue';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import WorkspaceTabQueryEmptyState from '@/components/WorkspaceTabQueryEmptyState.vue';
import WorkspaceTabQueryTable from '@/components/WorkspaceTabQueryTable.vue';
import { useResultTables } from '@/composables/useResultTables';
import Application from '@/ipc-api/Application';
import Schema from '@/ipc-api/Schema';
import { useApplicationStore } from '@/stores/application';
import { useConsoleStore } from '@/stores/console';
import { useHistoryStore } from '@/stores/history';
import { useNotificationsStore } from '@/stores/notifications';
import { useScratchpadStore } from '@/stores/scratchpad';
import { useSettingsStore } from '@/stores/settings';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const props = defineProps({
   tabUid: String,
   connection: Object as Prop<ConnectionParams>,
   tab: Object,
   isSelected: Boolean
});

const reloadTable = () => runQuery(lastQuery.value);

const {
   queryTable,
   isQuering,
   updateField,
   deleteSelected
} = useResultTables(props.connection.uid, reloadTable);

const { saveHistory } = useHistoryStore();
const { addNotification } = useNotificationsStore();
const workspacesStore = useWorkspacesStore();
const { showScratchpad } = useApplicationStore();
const { addNote } = useScratchpadStore();

const { consoleHeight } = storeToRefs(useConsoleStore());
const { executeSelected } = storeToRefs(useSettingsStore());

const {
   getWorkspace,
   changeBreadcrumbs,
   updateTabContent,
   setUnsavedChanges,
   newTab
} = workspacesStore;

const queryEditor: Ref<Component & { editor: Ace.Editor; $el: HTMLElement }> = ref(null);
const queryAreaFooter: Ref<HTMLDivElement> = ref(null);
const resizer: Ref<HTMLDivElement> = ref(null);
const queryName = ref('');
const query = ref('');
const filePath = ref('');
const lastQuery = ref('');
const lastSavedQuery = ref('');
const isCancelling = ref(false);
const showCancel = ref(false);
const autocommit = ref(true);
const results = ref([]);
const selectedSchema = ref(null);
const resultsCount = ref(0);
const durationsCount = ref(0);
const affectedCount = ref(null);
const editorHeight = ref(200);
const isQuerySaved = ref(false);
const isHistoryOpen = ref(false);
const debounceTimeout = ref(null);

const workspace = computed(() => getWorkspace(props.connection.uid));
const breadcrumbsSchema = computed(() => workspace.value.breadcrumbs.schema || null);
const databaseSchemas = computed(() => {
   return workspace.value.structure.reduce((acc, curr) => {
      acc.push(curr.name);
      return acc;
   }, []);
});
const hasResults = computed(() => results.value.length && results.value[0].rows);
const hasAffected = computed(() => affectedCount.value || (!resultsCount.value && affectedCount.value !== null));
const isChanged = computed(() => {
   return filePath.value && lastSavedQuery.value !== query.value;
});

watch(query, (val) => {
   clearTimeout(debounceTimeout.value);

   debounceTimeout.value = setTimeout(() => {
      updateTabContent({
         elementName: queryName.value,
         filePath: filePath.value,
         uid: props.connection.uid,
         tab: props.tab.uid,
         type: 'query',
         schema: selectedSchema.value,
         content: val

      });

      isQuerySaved.value = false;
   }, 200);
});

watch(queryName, (val) => {
   clearTimeout(debounceTimeout.value);

   debounceTimeout.value = setTimeout(() => {
      updateTabContent({
         elementName: val,
         filePath: filePath.value,
         uid: props.connection.uid,
         tab: props.tab.uid,
         type: 'query',
         schema: selectedSchema.value,
         content: query.value
      });

      isQuerySaved.value = false;
   }, 200);
});

watch(() => props.isSelected, (val) => {
   if (val) {
      changeBreadcrumbs({ schema: selectedSchema.value, query: t('database.queryTabLabel', { n: props.tab.index }) });
      setTimeout(() => {
         if (queryEditor.value)
            queryEditor.value.editor.focus();
      }, 0);
   }
});

watch(selectedSchema, () => {
   changeBreadcrumbs({ schema: selectedSchema.value, query: t('database.queryTabLabel', { n: props.tab.index }) });
});

watch(databaseSchemas, () => {
   if (!databaseSchemas.value.includes(selectedSchema.value))
      selectedSchema.value = null;
}, { deep: true });

watch(() => props.tab.content, () => {
   query.value = props.tab.content;
   const editorValue = queryEditor.value.editor.session.getValue();

   if (editorValue !== query.value)// If change not rendered in editor
      queryEditor.value.editor.session.setValue(query.value);
});

watch(isChanged, (val) => {
   setUnsavedChanges({ uid: props.connection.uid, tUid: props.tabUid, isChanged: val });
});

const runQuery = async (query: string) => {
   if (!query || isQuering.value) return;
   isQuering.value = true;

   if (executeSelected.value) {
      const selectedQuery = queryEditor.value.editor.getSelectedText();
      if (selectedQuery) query = selectedQuery;
   }

   clearTabData();
   queryTable.value.resetSort();

   try { // Query Data
      const params = {
         uid: props.connection.uid,
         schema: selectedSchema.value,
         tabUid: props.tab.uid,
         autocommit: autocommit.value,
         query
      };

      const { status, response } = await Schema.rawQuery(params);

      if (status === 'success') {
         results.value = Array.isArray(response) ? response : [response];
         resultsCount.value = results.value.reduce((acc, curr) => acc + (curr.rows ? curr.rows.length : 0), 0);
         durationsCount.value = results.value.reduce((acc, curr) => acc + curr.duration, 0);
         affectedCount.value = results.value
            .filter(result => result.report !== null)
            .reduce((acc, curr) => {
               if (acc === null) acc = 0;
               return acc + (curr.report ? curr.report.affectedRows : 0);
            }, null);

         saveHistory(params);
         if (!autocommit.value)
            setUnsavedChanges({ uid: props.connection.uid, tUid: props.tabUid, isChanged: true });

         queryEditor.value.editor.focus();
      }
      else
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   isQuering.value = false;
   lastQuery.value = query;
};

const killTabQuery = async () => {
   if (isCancelling.value) return;

   isCancelling.value = true;

   try {
      const params = {
         uid: props.connection.uid,
         tabUid: props.tab.uid
      };

      await Schema.killTabQuery(params);
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   isCancelling.value = false;
};

const setCancelButtonVisibility = (val: boolean) => {
   if (workspace.value.customizations.cancelQueries)
      showCancel.value = val;
};

const clearTabData = () => {
   results.value = [];
   resultsCount.value = 0;
   durationsCount.value = 0;
   affectedCount.value = null;
};

const resize = (e: MouseEvent) => {
   const el = queryEditor.value.$el;
   const queryFooterHeight = queryAreaFooter.value.clientHeight;
   const bottom = e.pageY || resizer.value.getBoundingClientRect().bottom;
   const maxHeight = window.innerHeight - 100 - queryFooterHeight - consoleHeight.value;
   let localEditorHeight = bottom - el.getBoundingClientRect().top;
   if (localEditorHeight > maxHeight) localEditorHeight = maxHeight;
   if (localEditorHeight < 50) localEditorHeight = 50;
   editorHeight.value = localEditorHeight;
};

const resizeResults = () => queryTable.value.resizeResults();

const onWindowResize = (e: MouseEvent) => {
   if (!queryEditor.value) return;
   const el = queryEditor.value.$el;
   const queryFooterHeight = queryAreaFooter.value.clientHeight;
   const bottom = e.pageY || resizer.value.getBoundingClientRect().bottom;
   const maxHeight = window.innerHeight - 100 - queryFooterHeight;
   const localEditorHeight = bottom - el.getBoundingClientRect().top;

   if (localEditorHeight > maxHeight)
      editorHeight.value = maxHeight;
};

const stopResize = () => {
   window.removeEventListener('mousemove', resize);
   if (queryTable.value && results.value.length)
      resizeResults();

   if (queryEditor.value)
      queryEditor.value.editor.resize();
};

const beautify = () => {
   if (queryEditor.value) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let language: any = 'sql';

      switch (workspace.value.client) {
         case 'mysql':
            language = 'mysql';
            break;
         case 'maria':
            language = 'mariadb';
            break;
         case 'pg':
            language = 'postgresql';
            break;
      }

      const formattedQuery = format(query.value, {
         language,
         uppercase: true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      queryEditor.value.editor.session.setValue(formattedQuery);
   }
};

const openHistoryModal = () => {
   isHistoryOpen.value = true;
};

const saveQuery = () => {
   addNote({
      uid: uidGen('N'),
      cUid: workspace.value.uid,
      type: 'query',
      date: new Date(),
      note: query.value,
      isArchived: false,
      title: queryName.value
   });
   isQuerySaved.value = true;
};

const openSavedModal = () => {
   showScratchpad('query');
};

const selectQuery = (sql: string) => {
   if (queryEditor.value)
      queryEditor.value.editor.session.setValue(sql);

   isHistoryOpen.value = false;
};

const clear = () => {
   if (queryEditor.value)
      queryEditor.value.editor.session.setValue('');
   clearTabData();
};

const downloadTable = (format: 'csv' | 'json' | 'sql' | 'php') => {
   queryTable.value.downloadTable(format, `${props.tab.type}-${props.tab.index}`);
};

const commitTab = async () => {
   isQuering.value = true;
   try {
      const params = {
         uid: props.connection.uid,
         tabUid: props.tab.uid
      };

      await Schema.commitTab(params);
      setUnsavedChanges({ uid: props.connection.uid, tUid: props.tabUid, isChanged: false });
      addNotification({ status: 'success', message: t('general.actionSuccessful', { action: 'COMMIT' }) });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   isQuering.value = false;
};

const rollbackTab = async () => {
   isQuering.value = true;
   try {
      const params = {
         uid: props.connection.uid,
         tabUid: props.tab.uid
      };

      await Schema.rollbackTab(params);
      setUnsavedChanges({ uid: props.connection.uid, tUid: props.tabUid, isChanged: false });
      addNotification({ status: 'success', message: t('general.actionSuccessful', { action: 'ROLLBACK' }) });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   isQuering.value = false;
};

defineExpose({ resizeResults });

query.value = props.tab.content as string;
queryName.value = props.tab.elementName as string;
filePath.value = props.tab.filePath as string;
selectedSchema.value = props.tab.schema || breadcrumbsSchema.value;

window.addEventListener('resize', onWindowResize);

const reloadListener = () => {
   const hasModalOpen = !!document.querySelectorAll('.modal.active').length;
   if (props.isSelected && !hasModalOpen)
      runQuery(query.value);
};

const formatListener = () => {
   const hasModalOpen = !!document.querySelectorAll('.modal.active').length;
   if (props.isSelected && !hasModalOpen)
      beautify();
};

const killQueryListener = () => {
   const hasModalOpen = !!document.querySelectorAll('.modal.active').length;
   if (props.isSelected && !hasModalOpen)
      killTabQuery();
};

const clearQueryListener = () => {
   const hasModalOpen = !!document.querySelectorAll('.modal.active').length;
   if (props.isSelected && !hasModalOpen)
      clear();
};

const historyListener = () => {
   const hasModalOpen = !!document.querySelectorAll('.modal.active').length;
   if (props.isSelected && !hasModalOpen)
      openHistoryModal();
};

const openFileListener = () => {
   const hasModalOpen = !!document.querySelectorAll('.modal.active').length;
   if (props.isSelected && !hasModalOpen)
      openFile();
};

const saveFileAsListener = () => {
   const hasModalOpen = !!document.querySelectorAll('.modal.active').length;
   if (props.isSelected && !hasModalOpen)
      saveFileAs();
};

const saveContentListener = () => {
   const hasModalOpen = !!document.querySelectorAll('.modal.active').length;
   if (props.isSelected && !hasModalOpen && filePath)
      saveFile();
};

const openFile = async () => {
   const result = await Application.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'SQL', extensions: ['sql', 'txt'] }] });
   if (result && !result.canceled) {
      const file = result.filePaths[0];
      const content = await Application.readFile({ filePath: file, encoding: 'utf-8' });
      const fileName = file.split('/').pop().split('\\').pop();
      if (props.tab.filePath && props.tab.filePath !== file) {
         newTab({
            uid: props.connection.uid,
            type: 'query',
            filePath: file,
            content: '',
            schema: selectedSchema.value,
            elementName: fileName
         });
      }
      else {
         filePath.value = file;
         queryName.value = fileName;
         query.value = content;
         lastSavedQuery.value = content;
      }
   }
};

const saveFileAs = async () => {
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   const result: any = await Application.showSaveDialog({
      filters: [{ name: 'SQL', extensions: ['sql'] }],
      defaultPath: (queryName.value !== undefined && !queryName.value.includes('.sql') ? `${queryName.value}.sql` : queryName.value) || 'query.sql'
   });

   if (result && !result.canceled) {
      await Application.writeFile(result.filePath, query.value);
      addNotification({ status: 'success', message: t('general.actionSuccessful', { action: t('application.saveFile') }) });
      queryName.value = result.filePath.split('/').pop().split('\\').pop();
      filePath.value = result.filePath;
      lastSavedQuery.value = toRaw(query.value);
   }
};

const saveFile = async () => {
   if (filePath.value) {
      await Application.writeFile(filePath.value, query.value);
      addNotification({ status: 'success', message: t('general.actionSuccessful', { action: t('application.saveFile') }) });
      lastSavedQuery.value = toRaw(query.value);
   }
   else
      saveFileAs();
};

const loadFileContent = async (file: string) => {
   const content = await Application.readFile({ filePath: file, encoding: 'utf-8' });
   query.value = content;
   lastSavedQuery.value = content;
};

onMounted(() => {
   const localResizer = resizer.value;

   window.addEventListener('antares:run-or-reload', reloadListener);
   window.addEventListener('antares:format-query', formatListener);
   window.addEventListener('antares:kill-query', killQueryListener);
   window.addEventListener('antares:clear-query', clearQueryListener);
   window.addEventListener('antares:query-history', historyListener);
   window.addEventListener('antares:open-file', openFileListener);
   window.addEventListener('antares:save-file-as', saveFileAsListener);
   window.addEventListener('antares:save-content', saveContentListener);

   localResizer.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();

      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResize);
   });

   if (props.tab.autorun)
      runQuery(query.value);

   if (props.tab.filePath)
      loadFileContent(props.tab.filePath);
});

onBeforeUnmount(() => {
   window.removeEventListener('resize', onWindowResize);
   const params = {
      uid: props.connection.uid,
      tabUid: props.tab.uid
   };
   Schema.destroyConnectionToCommit(params);

   window.removeEventListener('antares:run-or-reload', reloadListener);
   window.removeEventListener('antares:format-query', formatListener);
   window.removeEventListener('antares:kill-query', killQueryListener);
   window.removeEventListener('antares:clear-query', clearQueryListener);
   window.removeEventListener('antares:query-history', historyListener);
   window.removeEventListener('antares:open-file', openFileListener);
   window.removeEventListener('antares:save-file-as', saveFileAsListener);
   window.removeEventListener('antares:save-content', saveContentListener);
});
</script>

<style lang="scss">
.workspace-tabs {
  align-content: baseline;

  .workspace-query-runner {
    position: relative;

    .query-area-resizer {
      height: 4px;
      margin-top: -2px;
      width: 100%;
      cursor: ns-resize;
      z-index: 99;
      transition: background 0.2s;

      &:hover {
        background: var(--primary);
      }
    }

    .workspace-query-runner-footer {
      display: flex;
      flex-wrap: wrap;
      row-gap: 0.4rem;
      justify-content: space-between;
      padding: 6px 10px;
      align-items: center;
      min-height: 44px;
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      background: var(--card);
      backdrop-filter: blur(4px);

      .workspace-query-buttons {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
      }

      .workspace-query-info {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 12px;
        color: var(--foreground);

        b {
          font-weight: 600;
        }
      }

      .commit-mode-select,
      .schema-select {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 0 4px;
        height: 32px;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: var(--secondary);

        :deep(.select-base) {
          border: none;
          background: transparent;
          height: 28px;
          min-width: 120px;
          color: var(--foreground);
          font-size: 12px;

          &:focus {
            box-shadow: none;
          }
        }
      }

    }
  }

  .workspace-query-results {
    min-height: 200px;
  }
}
</style>
