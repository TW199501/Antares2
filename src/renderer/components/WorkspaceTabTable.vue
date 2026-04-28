<template>
   <div v-show="isSelected" class="workspace-query-tab no-outline flex w-full flex-col p-0">
      <div class="workspace-query-runner flex w-full flex-col">
         <div class="workspace-query-runner-footer !h-[39px] !py-[3px] !px-[10px] !text-[14px]">
            <div class="workspace-query-buttons">
               <!-- 資料 / 屬性 切換 -->
               <Tabs v-model="viewMode" class="mr-2">
                  <TabsList class="h-[32px] gap-0 p-[2px]">
                     <TabsTrigger
                        value="data"
                        class="h-[28px] gap-1 px-[10px] py-0 !text-[14px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
                     >
                        <BaseIcon icon-name="mdiTable" :size="14" />
                        {{ t('general.data') }}
                     </TabsTrigger>
                     <TabsTrigger
                        value="props"
                        class="h-[28px] gap-1 px-[10px] py-0 !text-[14px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
                     >
                        <BaseIcon icon-name="mdiWrenchCog" :size="14" />
                        {{ t('general.properties') }}
                     </TabsTrigger>
                  </TabsList>
               </Tabs>
               <!-- Column header 英文名 / 中文 comment 切換 (僅 data 模式有效) -->
               <button
                  v-show="viewMode === 'data'"
                  type="button"
                  :class="[
                     'mr-3 flex h-[32px] w-[32px] items-center justify-center rounded-md !text-[14px] font-semibold transition-colors',
                     useCommentHeader
                        ? 'border border-primary bg-primary text-primary-foreground'
                        : 'border border-border bg-background text-muted-foreground hover:border-ring/60 hover:text-foreground'
                  ]"
                  :title="useCommentHeader ? t('application.showColumnNames') : t('application.showColumnComments')"
                  @click="useCommentHeader = !useCommentHeader"
               >
                  {{ useCommentHeader ? '中' : 'A' }}
               </button>
               <div v-show="viewMode === 'data'" class="d-flex align-items-center gap-1">
                  <!-- Insert row -->
                  <Button
                     v-if="isTable && !connection.readonly"
                     variant="outline"
                     class="h-[32px] gap-1.5 px-[10px] !text-[14px]"
                     :disabled="isQuering || isSystemSchema"
                     :title="isSystemSchema ? t('application.systemSchemaReadonly') : ''"
                     @click="showFakerModal()"
                  >
                     <BaseIcon icon-name="mdiPlaylistPlus" :size="16" />
                     <span>{{ t('general.add') }}</span>
                  </Button>
               </div>
               <!-- Teleport target for props-mode toolbar (Save/Clear/Add/Indexes/ForeignKeys/DDL) -->
               <div
                  v-show="viewMode === 'props'"
                  :id="propsToolbarSlotId"
                  class="flex items-center gap-2"
               />
            </div>
            <div class="workspace-query-info !gap-0 divide-x divide-border [&>*]:px-[10px] [&>*:first-child]:pl-0 [&>*:last-child]:pr-0">
               <div v-if="tableInfo && viewMode !== 'props'" :title="t('general.name')">
                  <BaseIcon icon-name="mdiTableOfContents" :size="14" />
                  <b>{{ tableInfo.name }}</b>
               </div>
               <div
                  v-if="tableInfo?.comment && viewMode !== 'props'"
                  class="max-w-[240px] truncate text-muted-foreground"
                  :title="tableInfo.comment"
               >
                  <span>{{ tableInfo.comment }}</span>
               </div>
               <div
                  v-if="tableInfo?.autoIncrement"
                  :title="t('database.autoIncrement')"
               >
                  <BaseIcon icon-name="mdiNumeric" :size="14" />
                  <span>{{ tableInfo.autoIncrement }}</span>
               </div>
               <div
                  v-if="tableInfo?.collation"
                  :title="t('database.collation')"
               >
                  <BaseIcon icon-name="mdiSortAlphabeticalAscending" :size="14" />
                  <span>{{ tableInfo.collation }}</span>
               </div>
               <div
                  v-if="results.length"
                  :title="t('database.queryDuration')"
               >
                  <BaseIcon
                     icon-name="mdiTimerSand"
                     :rotate="180"
                     :size="14"
                  />
                  <b>{{ results[0].duration / 1000 }}s</b>
               </div>
               <div v-if="results.length && results[0].rows">
                  <span>{{ t('general.results') }}:</span>
                  <b>{{ localeString(results[0].rows.length) }}</b>
               </div>
               <div v-if="hasApproximately || (page > 1 && approximateCount)">
                  <span>{{ t('database.total') }}:</span>
                  <b
                     :title="!customizations.tableRealCount ? t('database.approximately') : ''"
                  >
                     <span v-if="!customizations.tableRealCount">≈</span>
                     {{ localeString(approximateCount) }}
                  </b>
               </div>
               <div :title="t('database.schema')">
                  <BaseIcon
                     icon-name="mdiDatabase"
                     :size="14"
                  />
                  <b>{{ schema }}</b>
               </div>
            </div>
         </div>
      </div>
      <div v-show="viewMode === 'data'" class="workspace-query-results relative w-full">
         <BaseLoader v-if="isQuering" />
         <BaseSplitV
            :top-height="tableQueryAreaHeight"
            :default-top-height="300"
            class="h-full"
            @update:top-height="tableQueryAreaHeight = $event"
            @resize-end="setTableQueryAreaHeight($event)"
         >
            <template #top>
               <WorkspaceTabTableQueryArea />
            </template>
            <template #bottom>
               <div class="relative h-full">
                  <WorkspaceTabQueryTable
                     v-if="results"
                     ref="queryTable"
                     :results="results"
                     :is-quering="isQuering"
                     :page="page"
                     :tab-uid="tabUid"
                     :conn-uid="connection.uid"
                     :is-selected="isSelected"
                     mode="table"
                     :element-type="elementType"
                     :use-comment-header="useCommentHeader"
                     @update-field="updateField"
                     @delete-selected="deleteSelected"
                     @duplicate-row="showFakerModal"
                     @hard-sort="hardSort"
                  />
                  <div
                     v-if="!isQuering && !results[0]?.rows.length"
                     class="pointer-events-none absolute inset-x-0 top-[12px] flex justify-center text-[12px] text-muted-foreground"
                  >
                     {{ t('database.noResultsPresent') }}
                  </div>
               </div>
            </template>
         </BaseSplitV>
      </div>
      <WorkspaceTabPropsTable
         v-if="viewMode === 'props'"
         tab-uid="props"
         :connection="connection"
         :is-selected="isSelected && viewMode === 'props'"
         :table="table"
         :schema="schema"
         :toolbar-target="`#${propsToolbarSlotId}`"
      />
      <ModalFakerRows
         v-if="isFakerModal"
         :fields="fields"
         :row-to-duplicate="rowToDuplicate"
         :key-usage="keyUsage"
         :tab-uid="tabUid"
         :schema="schema"
         :table="table"
         @hide="hideFakerModal"
         @reload="reloadTable"
      />
   </div>
</template>

<script setup lang="ts">
import { ConnectionParams } from 'common/interfaces/antares';
import { TableFilterClausole } from 'common/interfaces/tableApis';
import { storeToRefs } from 'pinia';
import { computed, nextTick, onBeforeUnmount, Prop, Ref, ref, useId, watch, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import BaseLoader from '@/components/BaseLoader.vue';
import BaseSplitV from '@/components/BaseSplitV.vue';
import ModalFakerRows from '@/components/ModalFakerRows.vue';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WorkspaceTabPropsTable from '@/components/WorkspaceTabPropsTable.vue';
import WorkspaceTabQueryTable from '@/components/WorkspaceTabQueryTable.vue';
import WorkspaceTabTableQueryArea from '@/components/WorkspaceTabTableQueryArea.vue';
import { useFilters } from '@/composables/useFilters';
import { useResultTables } from '@/composables/useResultTables';
import Tables from '@/ipc-api/Tables';
import { useNotificationsStore } from '@/stores/notifications';
import { useSettingsStore } from '@/stores/settings';
import { type ExportFormat, useTablePagerStore } from '@/stores/tablePager';
import { useWorkspacesStore } from '@/stores/workspaces';

const { localeString } = useFilters();

const { t } = useI18n();

const propsToolbarSlotId = `props-toolbar-${useId()}`;

const props = defineProps({
   connection: Object as Prop<ConnectionParams>,
   isSelected: Boolean,
   table: String,
   schema: String,
   elementType: String
});

const reloadTable = async () => {
   await nextTick();
   getTableData();
};

const {
   queryTable,
   isQuering,
   updateField,
   deleteSelected
} = useResultTables(props.connection.uid, reloadTable);

const { addNotification } = useNotificationsStore();
const settingsStore = useSettingsStore();
const workspacesStore = useWorkspacesStore();
const tablePagerStore = useTablePagerStore();

const { dataTabLimit: limit, tableAutoRefreshInterval, tableQueryAreaHeight } = storeToRefs(settingsStore);
const { setTableQueryAreaHeight } = settingsStore;

const { changeBreadcrumbs, getWorkspace, newTab } = workspacesStore;

const pageSelect: Ref<HTMLInputElement> = ref(null);
const tabUid = ref('data');
const isPageMenu = ref(false);
const isSearch = ref(false);
const results = ref([]);
const viewMode = ref<'data' | 'props'>('data');
const useCommentHeader = ref(false);
const lastTable = ref(null);
const isFakerModal = ref(false);
const refreshInterval = ref(null);
const sortParams = ref({} as { field: string; dir: 'asc' | 'desc'});
const filters = ref([]);
const page = ref(1);
const pageProxy = ref(1);
const approximateCount = ref(0);
const rowToDuplicate = ref(null);

const workspace = computed(() => {
   return getWorkspace(props.connection.uid);
});

const customizations = computed(() => {
   return workspace.value.customizations;
});

const isTable = computed(() => {
   return props.elementType === 'table';
});

// Reserved / system databases (e.g. SQL Server master, msdb, tempdb, model;
// MySQL mysql / information_schema / ...). Insert UI is blocked on these to
// prevent accidental schema pollution. Matches case-insensitively because
// SQL Server collations are commonly CI by default.
const isSystemSchema = computed(() => {
   const list = workspace.value.customizations?.systemSchemas ?? [];
   if (!props.schema || list.length === 0) return false;
   const needle = props.schema.toLowerCase();
   return list.some(name => name.toLowerCase() === needle);
});

// Read-only table metadata shown in the info bar: table name, comment,
// autoIncrement value, collation. Source: workspace's structure cache.
const tableInfo = computed(() => {
   const db = workspace.value.structure?.find((d: { name: string }) => d.name === props.schema);
   return db?.tables?.find((t: { name: string }) => t.name === props.table);
});

const fields = computed(() => {
   return results.value.length ? results.value[0].fields : [];
});

const keyUsage = computed(() => {
   return results.value.length ? results.value[0].keys : [];
});

const getTableData = async () => {
   if (!props.table || !props.isSelected || isQuering.value) return;
   isQuering.value = true;

   // if table changes clear cached values
   if (lastTable.value !== props.table)
      results.value = [];

   lastTable.value = props.table;

   const params = {
      uid: props.connection.uid,
      schema: props.schema,
      table: props.table,
      limit: limit.value,
      page: page.value,
      sortParams: { ...sortParams.value },
      where: [...filters.value]
   };

   try { // Table data
      const { status, response } = await Tables.getTableData(params);

      if (status === 'success')
         results.value = [response];
      else
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   if (results.value.length && results.value[0].rows.length === limit.value) {
      try { // Table approximate count
         const { status, response } = await Tables.getTableApproximateCount(params);

         if (status === 'success')
            approximateCount.value = response;
         else
            addNotification({ status: 'error', message: response as unknown as string });
      }
      catch (err) {
         addNotification({ status: 'error', message: err.stack });
      }
   }

   isQuering.value = false;
};

const hardSort = (params: { field: string; dir: 'asc' | 'desc'}) => {
   sortParams.value = params;
   getTableData();
};

const openPageMenu = () => {
   if (isQuering.value || (results.value.length && results.value[0].rows.length < limit.value && page.value === 1)) return;

   isPageMenu.value = true;
   if (isPageMenu.value)
      setTimeout(() => pageSelect.value.focus(), 20);
};

const setPageNumber = () => {
   isPageMenu.value = false;

   if (pageProxy.value > 0)
      page.value = pageProxy.value;
   else
      pageProxy.value = page.value;
};

const pageChange = (direction: 'prev' | 'next') => {
   if (isQuering.value) return;

   if (direction === 'next' && (results.value.length && results.value[0].rows.length === limit.value)) {
      if (!page.value)
         page.value = 2;
      else
         page.value++;
   }
   else if (direction === 'prev' && page.value > 1)
      page.value--;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const showFakerModal = (row?: any) => {
   if (isQuering.value) return;
   isFakerModal.value = true;
   rowToDuplicate.value = row;
};

const hideFakerModal = () => {
   isFakerModal.value = false;
   rowToDuplicate.value = null;
};

watchEffect((onCleanup) => {
   if (refreshInterval.value)
      clearInterval(refreshInterval.value);

   if (tableAutoRefreshInterval.value > 0) {
      refreshInterval.value = setInterval(() => {
         if (!isQuering.value)
            reloadTable();
      }, tableAutoRefreshInterval.value * 1000);
   }
   else
      refreshInterval.value = null;

   onCleanup(() => {
      if (refreshInterval.value)
         clearInterval(refreshInterval.value);
   });
});

const downloadTable = (format: 'csv' | 'json' | 'sql' | 'php') => {
   queryTable.value.downloadTable(format, props.table);
};

const onFilterChange = (clausoles: TableFilterClausole[]) => {
   resizeScroller();
   if (clausoles.length === 0)
      isSearch.value = false;
};

const resizeScroller = () => {
   setTimeout(() => queryTable.value.refreshScroller(), 1);
};

const updateFilters = (clausoles: TableFilterClausole[]) => {
   filters.value = clausoles;
   results.value = [];

   const permanentTabs = {
      table: 'data',
      view: 'data',
      trigger: 'trigger-props',
      triggerFunction: 'trigger-function-props',
      function: 'function-props',
      routine: 'routine-props',
      procedure: 'routine-props',
      scheduler: 'scheduler-props'
   } as Record<string, string>;

   newTab({
      uid: props.connection.uid,
      schema: props.schema,
      elementName: props.table,
      type: permanentTabs[props.elementType],
      elementType: props.elementType
   });
   getTableData();
};

const reloadListener = () => {
   const hasModalOpen = !!document.querySelectorAll('.modal.active').length;
   if (props.isSelected && !hasModalOpen)
      reloadTable();
};

const openFilterListener = () => {
   const hasModalOpen = !!document.querySelectorAll('.modal.active').length;
   if (props.isSelected && !hasModalOpen)
      isSearch.value = !isSearch.value;
};

const nextPageListener = () => {
   const hasModalOpen = !!document.querySelectorAll('.modal.active').length;
   if (props.isSelected && !hasModalOpen)
      pageChange('next');
};

const prevPageListener = () => {
   const hasModalOpen = !!document.querySelectorAll('.modal.active').length;
   if (props.isSelected && !hasModalOpen)
      pageChange('prev');
};

const hasApproximately = computed(() => {
   return results.value.length &&
      results.value[0].rows &&
      results.value[0].rows.length === limit.value &&
      results.value[0].rows.length < approximateCount.value;
});

const openTableSettingTab = () => {
   newTab({
      uid: workspace.value.uid,
      elementName: props.table,
      schema: props.schema,
      type: isTable.value ? 'table-props' : props.elementType === 'view' ? 'view-props' : 'materialized-view-props',
      elementType: props.elementType
   });

   changeBreadcrumbs({
      schema: props.schema,
      table: isTable.value ? props.table : null,
      view: !isTable.value ? props.table : null
   });
};

// NOTE: lastTable is intentionally NOT set here — getTableData() updates it
// at line ~287 only when it actually runs. If we pre-set it synchronously
// and the fetch early-returns (e.g. !isSelected at the moment the watcher
// fires), the isSelected watcher below loses its ability to recover via
// `if (lastTable.value !== props.table) getTableData()`. Symptom: first
// table opened shows no column headers until user clicks to another table
// and back.
watch(() => props.schema, () => {
   if (props.isSelected) {
      page.value = 1;
      approximateCount.value = 0;
      sortParams.value = {} as { field: string; dir: 'asc' | 'desc'};
      getTableData();
      queryTable.value?.resetSort();
   }
});

watch(() => props.table, () => {
   if (props.isSelected) {
      page.value = 1;
      filters.value = [];
      isSearch.value = false;
      viewMode.value = 'data';
      approximateCount.value = 0;
      sortParams.value = {} as { field: string; dir: 'asc' | 'desc'};
      getTableData();
      queryTable.value?.resetSort();
   }
});

watch(page, (val, oldVal) => {
   if (val && val > 0 && val !== oldVal) {
      pageProxy.value = page.value;
      getTableData();
   }
});

watch(() => props.isSelected, (val) => {
   if (val) {
      changeBreadcrumbs({ schema: props.schema, [props.elementType]: props.table });

      if (lastTable.value !== props.table)
         getTableData();
   }
});

watch(isSearch, (val) => {
   if (filters.value.length > 0 && !val) {
      filters.value = [];
      getTableData();
   }
   resizeScroller();
});

getTableData();

window.addEventListener('antares:run-or-reload', reloadListener);
window.addEventListener('antares:open-filter', openFilterListener);
window.addEventListener('antares:next-page', nextPageListener);
window.addEventListener('antares:prev-page', prevPageListener);

// Footer pagination + Export bridge.
// When this tab is the active selection, publish state + handlers into the
// app-singleton tablePager store so TheFooter can render pagination/export
// without any prop wiring. Whenever the underlying state changes (page,
// results, isQuering) we patch the store. We clear on unmount AND when
// isSelected flips false to avoid stale handlers from background tabs
// firing into someone else's table.
function pushPagerState (): void {
   tablePagerStore.setActivePager({
      page: page.value,
      hasNext: !(isQuering.value || (results.value.length && results.value[0].rows.length < limit.value)),
      hasPrev: !(isQuering.value || page.value === 1),
      isQuering: isQuering.value,
      onPrev: () => pageChange('prev'),
      onNext: () => pageChange('next'),
      onExport: (format: ExportFormat) => downloadTable(format)
   });
}

watch(
   [() => props.isSelected, () => viewMode.value, page, results, isQuering],
   () => {
      if (props.isSelected && viewMode.value === 'data') pushPagerState();
      else tablePagerStore.clearActivePager();
   },
   { immediate: true, deep: true }
);

onBeforeUnmount(() => {
   clearInterval(refreshInterval.value);
   window.removeEventListener('antares:run-or-reload', reloadListener);
   window.removeEventListener('antares:open-filter', openFilterListener);
   window.removeEventListener('antares:next-page', nextPageListener);
   window.removeEventListener('antares:prev-page', prevPageListener);
   tablePagerStore.clearActivePager();
});
</script>
