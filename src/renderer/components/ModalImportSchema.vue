<template>
   <Dialog :open="true" @update:open="(v) => { if (!v) closeModal(); }">
      <DialogContent
         class="!max-w-[800px] max-h-[85vh] !p-0 !gap-0 flex flex-col [&>button.absolute]:!hidden"
         @escape-key-down.prevent="closeModal"
         @pointer-down-outside.prevent
         @interact-outside.prevent
      >
         <DialogHeader class="flex flex-row items-center justify-between !space-y-0 px-5 py-3 border-b border-border/60 bg-muted/30">
            <DialogTitle class="!text-[15px] !font-semibold flex items-center gap-1.5">
               <BaseIcon icon-name="mdiDatabaseImport" :size="20" />
               <span>{{ t('database.importSchema') }}</span>
            </DialogTitle>
            <DialogDescription class="sr-only">
               {{ t('database.importSchema') }}
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

         <div class="px-5 py-4 overflow-y-auto flex-1 min-h-0 space-y-3">
            <!-- Source SQL file path -->
            <div v-if="sqlFile" class="flex items-center gap-2 text-[13px]">
               <BaseIcon
                  icon-name="mdiFileOutline"
                  class="text-muted-foreground"
                  :size="16"
               />
               <code class="flex-1 truncate text-xs text-muted-foreground" :title="sqlFile">{{ sqlFile }}</code>
            </div>

            <!--
               Query errors collected during import. Surfaced via a readonly
               Textarea so the user can scroll through them and copy/paste
               into a bug report. Wrapped in a Card to visually group with
               the contextual label.
            -->
            <Card v-if="queryErrors.length > 0" class="overflow-hidden">
               <CardHeader class="!p-3 !pb-2">
                  <CardTitle class="!text-[13px] !font-semibold flex items-center gap-1.5">
                     <BaseIcon
                        icon-name="mdiAlertCircleOutline"
                        class="text-destructive"
                        :size="16"
                     />
                     {{ t('database.importQueryErrors', queryErrors.length) }}
                  </CardTitle>
               </CardHeader>
               <CardContent class="!p-3 !pt-0">
                  <Textarea
                     v-model="formattedQueryErrors"
                     rows="6"
                     readonly
                     class="font-mono text-xs"
                  />
               </CardContent>
            </Card>
         </div>

         <DialogFooter class="!flex !flex-row !items-center !gap-2 px-5 py-3 border-t border-border/60 bg-muted/30">
            <!-- Inline progress meter (left-justified, fills available width) -->
            <div class="flex-1 min-w-0 text-left">
               <div class="text-[11px] italic text-muted-foreground truncate">
                  {{ progressPercentage }}% - {{ progressStatus }} - {{ t('database.executedQueries', queryCount) }}
               </div>
               <progress
                  class="block w-full h-1.5 mt-1 rounded overflow-hidden [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary"
                  :value="progressPercentage"
                  max="100"
               />
            </div>

            <Button
               variant="outline"
               size="sm"
               class="!h-[32px] !px-4 !text-[13px]"
               @click.stop="closeModal"
            >
               {{ completed ? t('general.close') : t('general.cancel') }}
            </Button>
         </DialogFooter>
      </DialogContent>
   </Dialog>
</template>

<script setup lang="ts">
import { ImportState } from 'common/interfaces/importer';
import moment from 'moment';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { createWebSocket } from '@/ipc-api/httpClient';
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const { addNotification } = useNotificationsStore();
const workspacesStore = useWorkspacesStore();

const { getSelected: selectedWorkspace } = storeToRefs(workspacesStore);

const { getWorkspace, refreshSchema } = workspacesStore;

const props = defineProps({
   selectedSchema: String
});

const emit = defineEmits<{
   'close': [];
}>();

const sqlFile = ref('');
const isImporting = ref(false);
const progressPercentage = ref(0);
const queryCount = ref(0);
const completed = ref(false);
const progressStatus = ref('Reading');
const queryErrors: Ref<{time: string; message: string}[]> = ref([]);

const currentWorkspace = computed(() => getWorkspace(selectedWorkspace.value));

const formattedQueryErrors = computed(() => {
   return queryErrors.value.map(err =>
      `Time: ${moment(err.time).format('HH:mm:ss.S')} (${err.time})\nError: ${err.message}`
   ).join('\n\n');
});

const wsImport = ref<WebSocket | null>(null);

const startImport = async (file: string) => {
   isImporting.value = true;
   sqlFile.value = file;
   completed.value = false;
   progressPercentage.value = 0;
   queryCount.value = 0;
   queryErrors.value = [];

   const { uid, client } = currentWorkspace.value;
   const params = {
      uid,
      type: client,
      schema: props.selectedSchema,
      file
   };

   const ws = await createWebSocket('/ws/import');
   wsImport.value = ws;

   ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'start', params }));
   };

   ws.onmessage = (event: MessageEvent) => {
      const msg = JSON.parse(event.data as string);
      switch (msg.type) {
         case 'import-progress':
            updateProgress(msg.payload);
            break;
         case 'query-error':
            handleQueryError(msg.payload);
            break;
         case 'end':
            progressStatus.value = msg.payload?.cancelled
               ? t('general.aborted')
               : t('general.completed');
            completed.value = true;
            isImporting.value = false;
            wsImport.value = null;
            ws.close();
            refreshSchema({ uid, schema: props.selectedSchema });
            break;
         case 'cancel':
            progressStatus.value = t('general.aborted');
            completed.value = true;
            isImporting.value = false;
            wsImport.value = null;
            ws.close();
            break;
         case 'error':
            progressStatus.value = msg.payload;
            addNotification({ status: 'error', message: msg.payload });
            isImporting.value = false;
            wsImport.value = null;
            ws.close();
            break;
      }
   };

   ws.onerror = () => {
      progressStatus.value = t('general.error');
      isImporting.value = false;
      wsImport.value = null;
   };
};

const updateProgress = (state: ImportState) => {
   progressPercentage.value = parseFloat(Number(state.percentage).toFixed(1));
   queryCount.value = Number(state.queryCount);
};

const handleQueryError = (err: { time: string; message: string }) => {
   queryErrors.value.push(err);
};

const closeModal = () => {
   if (isImporting.value) {
      if (wsImport.value && wsImport.value.readyState === WebSocket.OPEN)
         wsImport.value.send(JSON.stringify({ type: 'abort' }));
      return;
   }
   emit('close');
};

const onKey = (e: KeyboardEvent) => {
   e.stopPropagation();
   if (e.key === 'Escape')
      closeModal();
};

window.addEventListener('keydown', onKey);

onBeforeUnmount(() => {
   window.removeEventListener('keydown', onKey);
   if (wsImport.value) {
      wsImport.value.close();
      wsImport.value = null;
   }
});

defineExpose({ startImport });
</script>
