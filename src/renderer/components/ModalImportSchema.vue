<template>
   <Teleport to="#window-content">
      <div class="modal active">
         <a class="modal-overlay" @click.stop="closeModal" />
         <div class="modal-container p-0">
            <div class="modal-header pl-2">
               <div class="modal-title h6">
                  <div class="d-flex">
                     <BaseIcon
                        icon-name="mdiDatabaseImport"
                        class="mr-1"
                        :size="24"
                     />
                     <span class="cut-text">{{ t('database.importSchema') }}</span>
                  </div>
               </div>
               <a class="btn btn-clear c-hand" @click.stop="closeModal" />
            </div>
            <div class="modal-body pb-0">
               {{ sqlFile }}
               <div v-if="queryErrors.length > 0" class="mt-2">
                  <label>{{ t('database.importQueryErrors', queryErrors.length) }}</label>
                  <textarea
                     v-model="formattedQueryErrors"
                     class="form-input"
                     rows="5"
                     readonly
                  />
               </div>
            </div>
            <div class="modal-footer columns">
               <div class="column col modal-progress-wrapper text-left">
                  <div class="import-progress">
                     <span class="progress-status">
                        {{ progressPercentage }}% - {{ progressStatus }} - {{ t('database.executedQueries', queryCount) }}
                     </span>
                     <progress
                        class="progress d-block"
                        :value="progressPercentage"
                        max="100"
                     />
                  </div>
               </div>
               <div class="column col-auto px-0">
                  <button class="btn btn-link" @click.stop="closeModal">
                     {{ completed ? t('general.close') : t('general.cancel') }}
                  </button>
               </div>
            </div>
         </div>
      </div>
      <Teleport to="#window-content" />
   </teleport>
</template>

<script setup lang="ts">
import { ImportState } from 'common/interfaces/importer';
import moment from 'moment';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
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

const startImport = (file: string) => {
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

   const ws = createWebSocket('/ws/import');
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

<style lang="scss" scoped>
.modal {
  .modal-container {
    max-width: 800px;
  }

  .modal-body {
    max-height: 60vh;
    display: flex;
    flex-direction: column;
  }

  .modal-footer {
    display: flex;
  }
}

.progress-status {
  font-style: italic;
  font-size: 80%;
}
</style>
