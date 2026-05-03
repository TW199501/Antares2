<template>
   <Dialog :open="true" @update:open="(v) => { if (!v) closeModal(); }">
      <DialogContent
         class="!max-w-[820px] max-h-[90vh] !p-0 !gap-0 flex flex-col [&>button.absolute]:!hidden"
         @escape-key-down.prevent="closeModal"
         @pointer-down-outside.prevent
         @interact-outside.prevent
      >
         <DialogHeader class="flex flex-row items-center justify-between !space-y-0 px-5 py-3 border-b border-border/60 bg-muted/30">
            <DialogTitle class="!text-[15px] !font-semibold flex items-center gap-1.5">
               <BaseIcon icon-name="mdiDatabaseExport" :size="20" />
               <span>{{ t('database.exportSchema') }}</span>
            </DialogTitle>
            <DialogDescription class="sr-only">
               {{ t('database.exportSchema') }}
            </DialogDescription>
            <Button
               variant="ghost"
               size="icon"
               class="!h-7 !w-7"
               @click.stop="closeModal"
            >
               <BaseIcon icon-name="mdiClose" :size="16" />
            </Button>
         </DialogHeader>

         <div class="px-5 py-4 overflow-y-auto flex-1 min-h-0 space-y-4 text-[13px]">
            <!--
               Output directory picker. Path is readonly text + Change Button —
               the user can't type a path manually because Tauri's FS dialog
               needs a real navigation event for security gating.
            -->
            <div class="grid grid-cols-[120px_1fr] items-center gap-3">
               <Label class="!text-[13px]">{{ t('general.directoryPath') }}</Label>
               <div class="flex items-center gap-2">
                  <code
                     class="flex-1 truncate rounded-md border border-input bg-secondary px-3 py-2 text-xs text-muted-foreground"
                     :title="basePath"
                     @click.stop="openPathDialog"
                  >{{ basePath || '—' }}</code>
                  <Button
                     variant="outline"
                     size="sm"
                     class="!h-[34px] !text-[13px]"
                     @click.prevent="openPathDialog"
                  >
                     <BaseIcon
                        icon-name="mdiFolderOpenOutline"
                        class="mr-1"
                        :size="14"
                     />
                     {{ t('general.change') }}
                  </Button>
               </div>
            </div>

            <!-- Two-column body: tables grid (left, 2/3) + options (right, 1/3) -->
            <div class="grid grid-cols-3 gap-4 min-h-0">
               <!-- Tables column -->
               <div class="col-span-2 flex flex-col min-h-0 gap-2">
                  <!-- Filename + bulk action toolbar -->
                  <div class="flex items-center gap-2">
                     <div class="relative flex-1 min-w-0">
                        <BaseIcon
                           icon-name="mdiFileDocumentOutline"
                           class="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                           :size="16"
                        />
                        <Input
                           v-model="chosenFilename"
                           type="text"
                           class="!pl-8 italic"
                           :placeholder="filename"
                           :title="t('application.fileName')"
                        />
                     </div>
                     <Button
                        variant="outline"
                        size="sm"
                        class="!h-[34px] !w-[34px] !p-0"
                        :title="t('general.refresh')"
                        @click="refresh"
                     >
                        <BaseIcon icon-name="mdiRefresh" :size="15" />
                     </Button>
                     <Button
                        variant="outline"
                        size="sm"
                        class="!h-[34px] !w-[34px] !p-0"
                        :title="t('database.uncheckAllTables')"
                        :disabled="isRefreshing"
                        @click="uncheckAllTables"
                     >
                        <BaseIcon icon-name="mdiCheckboxBlankOutline" :size="15" />
                     </Button>
                     <Button
                        variant="outline"
                        size="sm"
                        class="!h-[34px] !w-[34px] !p-0"
                        :title="t('database.checkAllTables')"
                        :disabled="isRefreshing"
                        @click="checkAllTables"
                     >
                        <BaseIcon icon-name="mdiCheckboxMarkedOutline" :size="15" />
                     </Button>
                  </div>

                  <!--
                     Tables × export-options matrix. We keep the per-cell
                     Checkbox layout but switch from spectre's `.form-checkbox`
                     to shadcn `<Checkbox>`. Header rows let the user toggle
                     a whole column at once (with indeterminate state when
                     mixed). Sticky header so headers stay visible while
                     scrolling long table lists.
                  -->
                  <div class="flex-1 min-h-0 overflow-auto rounded-md border border-border/60">
                     <table class="w-full text-xs">
                        <thead class="sticky top-0 z-10 bg-muted/40 backdrop-blur-sm">
                           <tr class="border-b border-border/60">
                              <th class="text-left font-semibold px-3 py-2 w-[50%]">
                                 {{ t('database.table') }}
                              </th>
                              <th class="text-center font-semibold px-2 py-2">
                                 {{ t('database.structure') }}
                              </th>
                              <th class="text-center font-semibold px-2 py-2">
                                 {{ t('general.content') }}
                              </th>
                              <th class="text-center font-semibold px-2 py-2">
                                 {{ t('database.drop') }}
                              </th>
                           </tr>
                           <tr class="border-b border-border/60 bg-background">
                              <th />
                              <th class="text-center px-2 py-1.5">
                                 <Checkbox
                                    :model-value="includeStructureStatus === 1
                                       ? true
                                       : (includeStructureStatus === 2 ? 'indeterminate' : false)"
                                    @click.prevent="toggleAllTablesOption('includeStructure')"
                                 />
                              </th>
                              <th class="text-center px-2 py-1.5">
                                 <Checkbox
                                    :model-value="includeContentStatus === 1
                                       ? true
                                       : (includeContentStatus === 2 ? 'indeterminate' : false)"
                                    @click.prevent="toggleAllTablesOption('includeContent')"
                                 />
                              </th>
                              <th class="text-center px-2 py-1.5">
                                 <Checkbox
                                    :model-value="includeDropStatementStatus === 1
                                       ? true
                                       : (includeDropStatementStatus === 2 ? 'indeterminate' : false)"
                                    @click.prevent="toggleAllTablesOption('includeDropStatement')"
                                 />
                              </th>
                           </tr>
                        </thead>
                        <tbody>
                           <tr
                              v-for="item in tables"
                              :key="item.table"
                              class="border-b border-border/40 hover:bg-muted/30"
                              :class="{ 'bg-accent/40': item.table === selectedTable }"
                           >
                              <td class="px-3 py-1.5 truncate">
                                 {{ item.table }}
                              </td>
                              <td class="text-center px-2 py-1.5">
                                 <Checkbox v-model="item.includeStructure" />
                              </td>
                              <td class="text-center px-2 py-1.5">
                                 <Checkbox v-model="item.includeContent" />
                              </td>
                              <td class="text-center px-2 py-1.5">
                                 <Checkbox v-model="item.includeDropStatement" />
                              </td>
                           </tr>
                        </tbody>
                     </table>
                  </div>
               </div>

               <!-- Options column -->
               <div class="col-span-1 space-y-3">
                  <h5 class="text-sm font-semibold m-0">
                     {{ t('general.options') }}
                  </h5>

                  <div>
                     <div class="text-xs font-medium mb-1.5">
                        {{ t('general.includes') }}:
                     </div>
                     <div class="space-y-1.5">
                        <label
                           v-for="(_, key) in options.includes"
                           :key="key"
                           class="flex items-center gap-2 text-xs cursor-pointer"
                        >
                           <Checkbox v-model="options.includes[key]" />
                           {{ t(`database.${String(key).slice(0, -1)}`, 2) }}
                        </label>
                     </div>
                  </div>

                  <div v-if="clientCustoms.exportByChunks">
                     <div class="text-xs font-medium mb-1.5">
                        {{ t('database.newInsertStmtEvery') }}:
                     </div>
                     <div class="grid grid-cols-2 gap-2">
                        <Input
                           v-model.number="options.sqlInsertAfter"
                           type="number"
                        />
                        <BaseSelect
                           v-model="options.sqlInsertDivider"
                           :options="[{value: 'bytes', label: 'KiB'}, {value: 'rows', label: t('database.row', 2)}]"
                        />
                     </div>
                  </div>

                  <div>
                     <div class="text-xs font-medium mb-1.5">
                        {{ t('general.outputFormat') }}:
                     </div>
                     <BaseSelect
                        v-model="options.outputFormat"
                        :options="[{value: 'sql', label: t('general.singleFile', {ext: '.sql'})}, {value: 'sql.zip', label: t('general.zipCompressedFile', {ext: '.sql'})}]"
                     />
                  </div>
               </div>
            </div>
         </div>

         <DialogFooter class="!flex !flex-row !items-center !gap-2 px-5 py-3 border-t border-border/60 bg-muted/30">
            <div class="flex-1 min-w-0 text-left">
               <div v-if="progressPercentage > 0">
                  <div class="text-[11px] italic text-muted-foreground truncate">
                     {{ progressPercentage }}% - {{ progressStatus }}
                  </div>
                  <progress
                     class="block w-full h-1.5 mt-1 rounded overflow-hidden [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary"
                     :value="progressPercentage"
                     max="100"
                  />
               </div>
            </div>
            <Button
               variant="outline"
               size="sm"
               class="!h-[32px] !px-4 !text-[13px]"
               @click.stop="closeModal"
            >
               {{ t('general.close') }}
            </Button>
            <Button
               variant="default"
               size="sm"
               class="!h-[32px] !px-4 !text-[13px]"
               :disabled="isExporting || isRefreshing"
               autofocus
               @click.prevent="startExport"
            >
               {{ t('database.export') }}
            </Button>
         </DialogFooter>
      </DialogContent>
   </Dialog>
</template>

<script setup lang="ts">
import { SchemaInfos } from 'common/interfaces/antares';
import { Customizations } from 'common/interfaces/customizations';
import { ExportOptions, ExportState } from 'common/interfaces/exporter';
import moment from 'moment';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Application from '@/ipc-api/Application';
import { createWebSocket } from '@/ipc-api/httpClient';
import { useNotificationsStore } from '@/stores/notifications';
import { useSchemaExportStore } from '@/stores/schemaExport';
import { useWorkspacesStore } from '@/stores/workspaces';

const emit = defineEmits<{
   'close': [];
}>();
const { t } = useI18n();

const { addNotification } = useNotificationsStore();
const workspacesStore = useWorkspacesStore();
const schemaExportStore = useSchemaExportStore();

const { getSelected: selectedWorkspace } = storeToRefs(workspacesStore);

const {
   getWorkspace,
   refreshSchema
} = workspacesStore;

const { selectedTable, selectedSchema } = storeToRefs(schemaExportStore);

const isExporting = ref(false);
const isRefreshing = ref(false);
const progressPercentage = ref(0);
const progressStatus = ref('');
const tables: Ref<{
   table: string;
   includeStructure: boolean;
   includeContent: boolean;
   includeDropStatement: boolean;
}[]> = ref([]);
const options: Ref<Partial<ExportOptions>> = ref({
   schema: selectedSchema.value,
   includes: {} as Record<string, boolean>,
   outputFormat: 'sql' as 'sql' | 'sql.zip',
   sqlInsertAfter: 250,
   sqlInsertDivider: 'bytes' as 'bytes' | 'rows'
});
const basePath = ref('');
const chosenFilename = ref('');

const currentWorkspace = computed(() => getWorkspace(selectedWorkspace.value));
const clientCustoms: Ref<Customizations> = computed(() => currentWorkspace.value.customizations);
const schemaItems = computed(() => {
   const db: SchemaInfos = currentWorkspace.value.structure.find((db: SchemaInfos) => db.name === selectedSchema.value);
   if (db)
      return db.tables.filter(table => table.type === 'table');

   return [];
});
const filename = computed(() => {
   const date = moment().format('YYYY-MM-DD_HH-mm-ss');
   return `${selectedTable.value || selectedSchema.value}_${date}`;
});
const dumpFilePath = computed(() => `${basePath.value}/${chosenFilename.value || filename.value}.${options.value.outputFormat}`);
const includeStructureStatus = computed(() => {
   if (tables.value.every(item => item.includeStructure)) return 1;
   else if (tables.value.some(item => item.includeStructure)) return 2;
   else return 0;
});
const includeContentStatus = computed(() => {
   if (tables.value.every(item => item.includeContent)) return 1;
   else if (tables.value.some(item => item.includeContent)) return 2;
   else return 0;
});
const includeDropStatementStatus = computed(() => {
   if (tables.value.every(item => item.includeDropStatement)) return 1;
   else if (tables.value.some(item => item.includeDropStatement)) return 2;
   else return 0;
});

const wsExport = ref<WebSocket | null>(null);

const startExport = async () => {
   isExporting.value = true;
   progressPercentage.value = 0;
   progressStatus.value = '';

   const { uid, client } = currentWorkspace.value;
   const params = {
      uid,
      type: client,
      schema: selectedSchema.value,
      outputFile: dumpFilePath.value,
      tables: [...tables.value],
      ...options.value
   };

   const ws = await createWebSocket('/ws/export');
   wsExport.value = ws;

   ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'start', params }));
   };

   ws.onmessage = (event: MessageEvent) => {
      const msg = JSON.parse(event.data as string);
      switch (msg.type) {
         case 'export-progress':
            updateProgress(msg.payload);
            break;
         case 'end':
            progressStatus.value = msg.payload?.cancelled
               ? t('general.aborted')
               : t('general.completed');
            isExporting.value = false;
            wsExport.value = null;
            ws.close();
            break;
         case 'cancel':
            progressStatus.value = t('general.aborted');
            isExporting.value = false;
            wsExport.value = null;
            ws.close();
            break;
         case 'error':
            progressStatus.value = msg.payload;
            addNotification({ status: 'error', message: msg.payload });
            isExporting.value = false;
            wsExport.value = null;
            ws.close();
            break;
      }
   };

   ws.onerror = () => {
      progressStatus.value = t('general.error');
      isExporting.value = false;
      wsExport.value = null;
   };
};

const updateProgress = (state: ExportState) => {
   progressPercentage.value = Number((state.currentItemIndex / state.totalItems * 100).toFixed(1));
   switch (state.op) {
      case 'PROCESSING':
         progressStatus.value = t('database.processingTableExport', { table: state.currentItem });
         break;
      case 'FETCH':
         progressStatus.value = t('database.fetchingTableExport', { table: state.currentItem });
         break;
      case 'WRITE':
         progressStatus.value = t('database.writingTableExport', { table: state.currentItem });
         break;
   }
};

const closeModal = () => {
   if (isExporting.value) {
      if (wsExport.value && wsExport.value.readyState === WebSocket.OPEN)
         wsExport.value.send(JSON.stringify({ type: 'abort' }));
      return;
   }
   emit('close');
};

const onKey = (e: KeyboardEvent) => {
   e.stopPropagation();
   if (e.key === 'Escape')
      closeModal();
};

const checkAllTables = () => {
   tables.value = tables.value.map(item => ({ ...item, includeStructure: true, includeContent: true, includeDropStatement: true }));
};

const uncheckAllTables = () => {
   tables.value = tables.value.map(item => ({ ...item, includeStructure: false, includeContent: false, includeDropStatement: false }));
};

const toggleAllTablesOption = (option: 'includeStructure' | 'includeContent' |'includeDropStatement') => {
   const optsStatus = {
      includeStructure: includeStructureStatus.value,
      includeContent: includeContentStatus.value,
      includeDropStatement: includeDropStatementStatus.value
   };

   if (optsStatus[option] !== 1)
      tables.value = tables.value.map(item => ({ ...item, [option]: true }));
   else
      tables.value = tables.value.map(item => ({ ...item, [option]: false }));
};

const refresh = async () => {
   isRefreshing.value = true;
   await refreshSchema({ uid: currentWorkspace.value.uid, schema: selectedSchema.value });
   isRefreshing.value = false;
};

const openPathDialog = async () => {
   const result = await Application.showOpenDialog({ properties: ['openDirectory'] });
   if (result && !result.canceled)
      basePath.value = result.filePaths[0];
};

(async () => {
   if (!schemaItems.value.length) await refresh();

   window.addEventListener('keydown', onKey);

   basePath.value = await Application.getDownloadPathDirectory();
   tables.value = schemaItems.value.map(item => ({
      table: item.name,
      includeStructure: !selectedTable.value ? true : selectedTable.value === item.name,
      includeContent: !selectedTable.value ? true : selectedTable.value === item.name,
      includeDropStatement: !selectedTable.value ? true : selectedTable.value === item.name
   }));

   const structure = ['functions', 'views', 'triggers', 'routines', 'schedulers'];

   structure.forEach((feat: keyof Customizations) => {
      const val = clientCustoms.value[feat];
      if (val)
         options.value.includes[feat] = !selectedTable.value;
   });
})();

onBeforeUnmount(() => {
   window.removeEventListener('keydown', onKey);
   if (wsExport.value) {
      wsExport.value.close();
      wsExport.value = null;
   }
});
</script>
