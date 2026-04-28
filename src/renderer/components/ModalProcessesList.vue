<template>
   <Dialog :open="true" @update:open="(v) => { if (!v) closeModal(); }">
      <!--
         Processes-list browser. Wraps the existing BaseVirtualScroll table
         intact (Batch 9 will revisit virtual table internals); only the
         outer Dialog shell + toolbar are migrated to shadcn here.
         max-w-[75vw] preserves the original wide-table footprint so MSSQL's
         12-column session list stays comfortably readable.
      -->
      <DialogContent
         class="!max-w-[75vw] !w-[75vw] !max-h-[85vh] !p-0 !gap-0 flex flex-col [&>button.absolute]:!hidden"
         @escape-key-down.prevent="closeModal"
         @pointer-down-outside.prevent="closeModal"
         @interact-outside.prevent
      >
         <DialogHeader class="px-5 py-3 border-b border-border/60 bg-muted/30 flex flex-row items-center justify-between !space-y-0">
            <DialogTitle class="!text-[15px] !font-semibold flex items-center gap-1.5">
               <BaseIcon icon-name="mdiMemory" :size="20" />
               <span class="cut-text">{{ t('database.processesList') }}: {{ connectionName }}</span>
            </DialogTitle>
            <Button
               variant="ghost"
               size="icon"
               class="!h-7 !w-7"
               @click.stop="closeModal"
            >
               <BaseIcon icon-name="mdiClose" :size="16" />
            </Button>
         </DialogHeader>

         <!--
            Toolbar: refresh + auto-refresh popover, export menu, results count.
            Refresh popover uses shadcn Popover so the legacy `dropdown-toggle`
            spectre interactions are gone. Export dropdown also moves to
            Popover; both keep mdi icons + tooltips for affordance.
         -->
         <div class="flex items-center justify-between px-4 py-2 border-b border-border/60">
            <div class="flex items-center gap-2">
               <Popover>
                  <div class="flex items-stretch">
                     <Button
                        size="sm"
                        variant="outline"
                        class="!h-[28px] !px-2 !text-[12px] gap-1 rounded-r-none border-r-0"
                        :disabled="isQuering"
                        :title="t('general.refresh')"
                        @click="getProcessesList"
                     >
                        <BaseIcon
                           v-if="!+autorefreshTimer"
                           icon-name="mdiRefresh"
                           :size="16"
                        />
                        <BaseIcon
                           v-else
                           icon-name="mdiHistory"
                           flip="horizontal"
                           :size="16"
                        />
                     </Button>
                     <PopoverTrigger as-child>
                        <Button
                           size="sm"
                           variant="outline"
                           class="!h-[28px] !w-7 !p-0 rounded-l-none"
                        >
                           <BaseIcon icon-name="mdiMenuDown" :size="16" />
                        </Button>
                     </PopoverTrigger>
                  </div>
                  <PopoverContent class="w-[260px] p-3 space-y-2">
                     <div class="text-[12px]">
                        {{ t('general.autoRefresh') }}: <b>{{ +autorefreshTimer ? `${autorefreshTimer}s` : 'OFF' }}</b>
                     </div>
                     <input
                        v-model="autorefreshTimer"
                        type="range"
                        min="0"
                        max="15"
                        step="0.5"
                        class="w-full text-foreground"
                        @change="setRefreshInterval"
                     >
                  </PopoverContent>
               </Popover>

               <Popover>
                  <PopoverTrigger as-child>
                     <Button
                        size="sm"
                        variant="outline"
                        class="!h-[28px] !px-2 !text-[12px] gap-1"
                        :disabled="isQuering"
                     >
                        <BaseIcon icon-name="mdiFileExport" :size="16" />
                        <span>{{ t('database.export') }}</span>
                        <BaseIcon icon-name="mdiMenuDown" :size="16" />
                     </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-[120px] p-1">
                     <button
                        type="button"
                        class="flex w-full items-center px-2 py-1.5 text-[12px] rounded hover:bg-muted"
                        @click="downloadTable('json')"
                     >
                        JSON
                     </button>
                     <button
                        type="button"
                        class="flex w-full items-center px-2 py-1.5 text-[12px] rounded hover:bg-muted"
                        @click="downloadTable('csv')"
                     >
                        CSV
                     </button>
                  </PopoverContent>
               </Popover>
            </div>
            <div class="text-[12px] text-muted-foreground">
               <div v-if="sortedResults.length">
                  {{ t('database.processes') }}: <b class="text-foreground">{{ sortedResults.length.toLocaleString() }}</b>
               </div>
            </div>
         </div>

         <!--
            Results table preserves the existing BaseVirtualScroll +
            ModalProcessesListRow stack (per spec §5.7: don't touch table
            internals; only Dialog shell + toolbar are in scope here).
         -->
         <div class="flex-1 min-h-0 overflow-hidden">
            <div
               ref="tableWrapper"
               class="vscroll h-full"
            >
               <div ref="table" class="table table-hover">
                  <div class="thead">
                     <div class="tr">
                        <div
                           v-for="(field, index) in fields"
                           :key="index"
                           class="th c-hand"
                        >
                           <div ref="columnResize" class="column-resizable">
                              <div class="table-column-title" @click="sort(field)">
                                 <span>{{ field.toUpperCase() }}</span>

                                 <BaseIcon
                                    v-if="currentSort === field"
                                    :icon-name="currentSortDir === 'asc' ? 'mdiSortAscending':'mdiSortDescending'"
                                    :size="18"
                                    class="ml-1"
                                 />
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
                  <BaseVirtualScroll
                     ref="resultTable"
                     :items="sortedResults"
                     :item-height="22"
                     class="tbody"
                     :visible-height="resultsSize"
                     :scroll-element="scrollElement"
                  >
                     <template #default="{ items }">
                        <ModalProcessesListRow
                           v-for="row in items"
                           :key="row.id"
                           class="process-row"
                           :row="row"
                           @select-row="selectRow(row.id)"
                           @contextmenu="contextMenu"
                           @stop-refresh="stopRefresh"
                        />
                     </template>
                  </BaseVirtualScroll>
               </div>
            </div>
         </div>
      </DialogContent>
   </Dialog>

   <ModalProcessesListContext
      v-if="isContext"
      :context-event="contextEvent"
      :selected-row="selectedRow"
      :selected-cell="selectedCell"
      @copy-cell="copyCell"
      @copy-row="copyRow"
      @kill-process="killProcess"
      @close-context="closeContext"
   />
</template>

<script setup lang="ts">
import { ConnectionParams } from 'common/interfaces/antares';
import { Component, computed, onBeforeUnmount, onMounted, onUpdated, Prop, Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import BaseVirtualScroll from '@/components/BaseVirtualScroll.vue';
import ModalProcessesListContext from '@/components/ModalProcessesListContext.vue';
import ModalProcessesListRow from '@/components/ModalProcessesListRow.vue';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Schema from '@/ipc-api/Schema';
import { copyText } from '@/libs/copyText';
import { useConnectionsStore } from '@/stores/connections';
import { useNotificationsStore } from '@/stores/notifications';

import { exportRows } from '../libs/exportRows';

const { t } = useI18n();

const { addNotification } = useNotificationsStore();
const { getConnectionName } = useConnectionsStore();

const props = defineProps({
   connection: Object as Prop<ConnectionParams>
});

const emit = defineEmits<{
   'close': [];
}>();

const tableWrapper: Ref<HTMLDivElement> = ref(null);
const table: Ref<HTMLDivElement> = ref(null);
const resultTable: Ref<Component & {updateWindow: () => void}> = ref(null);
const resultsSize = ref(1000);
const isQuering = ref(false);
const isContext = ref(false);
const autorefreshTimer = ref(0);
const refreshInterval: Ref<NodeJS.Timeout> = ref(null);
const contextEvent = ref(null);
const selectedCell = ref(null);
const selectedRow: Ref<number> = ref(null);
const results = ref([]);
const fields = ref([]);
const currentSort = ref('');
const currentSortDir = ref('asc');
const scrollElement = ref(null);

const connectionName = computed(() => getConnectionName(props.connection.uid));

const sortedResults = computed(() => {
   if (currentSort.value) {
      return [...results.value].sort((a, b) => {
         let modifier = 1;
         const valA = typeof a[currentSort.value] === 'string' ? a[currentSort.value].toLowerCase() : a[currentSort.value];
         const valB = typeof b[currentSort.value] === 'string' ? b[currentSort.value].toLowerCase() : b[currentSort.value];
         if (currentSortDir.value === 'desc') modifier = -1;
         if (valA < valB) return -1 * modifier;
         if (valA > valB) return 1 * modifier;
         return 0;
      });
   }
   else
      return results.value;
});

const getProcessesList = async () => {
   isQuering.value = true;

   try { // Table data
      const { status, response } = await Schema.getProcesses(props.connection.uid);

      if (status === 'success') {
         results.value = response;
         fields.value = response.length ? Object.keys(response[0]) : [];
      }
      else
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   isQuering.value = false;
};

const setRefreshInterval = () => {
   clearRefresh();

   if (+autorefreshTimer.value) {
      refreshInterval.value = setInterval(() => {
         if (!isQuering.value)
            getProcessesList();
      }, autorefreshTimer.value * 1000);
   }
};

const clearRefresh = () => {
   if (refreshInterval.value)
      clearInterval(refreshInterval.value);
};

const resizeResults = () => {
   if (resultTable.value) {
      const el = tableWrapper.value.parentElement;

      if (el) {
         const size = el.offsetHeight;
         resultsSize.value = size;
      }
      resultTable.value.updateWindow();
   }
};

const refreshScroller = () => resizeResults();

const sort = (field: string) => {
   if (field === currentSort.value) {
      if (currentSortDir.value === 'asc')
         currentSortDir.value = 'desc';
      else
         resetSort();
   }
   else {
      currentSortDir.value = 'asc';
      currentSort.value = field;
   }
};

const resetSort = () => {
   currentSort.value = '';
   currentSortDir.value = 'asc';
};

const stopRefresh = () => {
   autorefreshTimer.value = 0;
   clearRefresh();
};

const selectRow = (row: number) => {
   selectedRow.value = Number(row);
};

const contextMenu = (event: MouseEvent, cell: { id: number; field: string }) => {
   if ((event.target as HTMLElement).localName === 'input') return;
   stopRefresh();

   selectedCell.value = cell;
   selectedRow.value = Number(cell.id);
   contextEvent.value = event;
   isContext.value = true;
};

const killProcess = async () => {
   try { // Table data
      const { status, response } = await Schema.killProcess({ uid: props.connection.uid, pid: selectedRow.value });

      if (status === 'success')
         getProcessesList();
      else
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }
};

const closeContext = () => {
   isContext.value = false;
};

const copyCell = () => {
   const row = results.value.find(row => Number(row.id) === selectedRow.value);
   const valueToCopy = row[selectedCell.value.field];
   copyText(valueToCopy);
};

const copyRow = () => {
   const row = results.value.find(row => Number(row.id) === selectedRow.value);
   const rowToCopy = JSON.parse(JSON.stringify(row));
   copyText(JSON.stringify(rowToCopy));
};

const closeModal = () => emit('close');

const downloadTable = (format: 'csv' | 'json') => {
   if (!sortedResults.value) return;
   exportRows({
      type: format,
      content: sortedResults.value,
      table: 'processes'
   });
};

const onKey = (e:KeyboardEvent) => {
   e.stopPropagation();
   if (e.key === 'Escape')
      closeModal();
};

window.addEventListener('antares:run-or-reload', getProcessesList);

window.addEventListener('keydown', onKey, { capture: true });

onMounted(() => {
   getProcessesList();
   window.addEventListener('resize', resizeResults);
});

onUpdated(() => {
   if (table.value)
      refreshScroller();
   if (tableWrapper.value)
      scrollElement.value = tableWrapper.value;
});

onBeforeUnmount(() => {
   window.removeEventListener('keydown', onKey, { capture: true });
   window.removeEventListener('resize', resizeResults);
   clearInterval(refreshInterval.value);

   window.removeEventListener('antares:run-or-reload', getProcessesList);
});

defineExpose({ refreshScroller });
</script>

<style lang="scss" scoped>
.vscroll {
  overflow: auto;
  overflow-anchor: none;
}

.column-resizable {
  &:hover,
  &:active {
    resize: horizontal;
    overflow: hidden;
  }
}

.table-column-title {
  display: flex;
  align-items: center;
}

.sort-icon {
  font-size: 0.7rem;
  line-height: 1;
  margin-left: 0.2rem;
}
</style>
