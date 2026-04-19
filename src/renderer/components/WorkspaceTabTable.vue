<template>
   <div v-show="isSelected" class="workspace-query-tab column col-12 columns col-gapless no-outline p-0">
      <div class="workspace-query-runner column col-12">
         <div class="workspace-query-runner-footer">
            <div class="workspace-query-buttons">
               <!-- 資料 / 屬性 切換 -->
               <Tabs v-model="viewMode" class="mr-3">
                  <TabsList class="h-[28px] gap-0 p-[2px]">
                     <TabsTrigger value="data" class="h-[24px] gap-1 px-[10px] py-0 text-[12px]">
                        <BaseIcon icon-name="mdiTable" :size="14" />
                        {{ t('general.data') }}
                     </TabsTrigger>
                     <TabsTrigger value="props" class="h-[24px] gap-1 px-[10px] py-0 text-[12px]">
                        <BaseIcon icon-name="mdiWrenchCog" :size="14" />
                        {{ t('general.properties') }}
                     </TabsTrigger>
                  </TabsList>
               </Tabs>
               <div v-show="viewMode === 'data'" class="d-flex align-items-center gap-1">
                  <!-- Manual refresh -->
                  <Button
                     variant="outline"
                     class="h-[28px] gap-1.5 px-[10px] text-[12px]"
                     :disabled="isQuering"
                     :title="`${t('general.refresh')}`"
                     @click="reloadTable"
                  >
                     <BaseIcon :icon-name="settingsStore.tableAutoRefreshInterval ? 'mdiHistory' : 'mdiRefresh'" :size="16" />
                  </Button>

                  <!-- Page navigation -->
                  <div class="flex">
                     <Button
                        variant="outline"
                        class="h-[28px] rounded-r-none px-[8px] text-[12px]"
                        :disabled="isQuering || page === 1"
                        :title="t('application.previousResultsPage')"
                        @click="pageChange('prev')"
                     >
                        <BaseIcon icon-name="mdiSkipPrevious" :size="16" />
                     </Button>
                     <div class="dropdown" :class="{'active': isPageMenu}">
                        <div @click="openPageMenu">
                           <div class="btn btn-dark btn-sm mr-0 no-radius dropdown-toggle text-bold px-3" style="height: 28px; border-radius: 0;">
                              {{ page }}
                           </div>
                           <div class="menu px-3">
                              <span>{{ t('general.pageNumber') }}</span>
                              <input
                                 ref="pageSelect"
                                 v-model="pageProxy"
                                 type="number"
                                 min="1"
                                 class="form-input"
                                 @blur="setPageNumber"
                              >
                           </div>
                        </div>
                     </div>
                     <Button
                        variant="outline"
                        class="h-[28px] rounded-l-none px-[8px] text-[12px]"
                        :disabled="isQuering || (results.length && results[0].rows.length < limit)"
                        :title="t('application.nextResultsPage')"
                        @click="pageChange('next')"
                     >
                        <BaseIcon icon-name="mdiSkipNext" :size="16" />
                     </Button>
                  </div>

                  <div class="divider-vert py-3" />

                  <!-- Filter toggle -->
                  <Button
                     :variant="isSearch ? 'default' : 'outline'"
                     class="h-[28px] px-[10px] text-[12px]"
                     :title="t('general.filter')"
                     :disabled="isQuering"
                     @click="isSearch = !isSearch"
                  >
                     <BaseIcon icon-name="mdiMagnify" :size="16" />
                  </Button>

                  <!-- Insert row -->
                  <Button
                     v-if="isTable && !connection.readonly"
                     variant="outline"
                     class="h-[28px] gap-1.5 px-[10px] text-[12px]"
                     :disabled="isQuering"
                     @click="showFakerModal()"
                  >
                     <BaseIcon icon-name="mdiPlaylistPlus" :size="16" />
                     <span>{{ t('database.insertRow', 2) }}</span>
                  </Button>

                  <!-- Export dropdown -->
                  <DropdownMenu>
                     <DropdownMenuTrigger as-child>
                        <Button
                           variant="outline"
                           class="h-[28px] gap-1.5 px-[10px] text-[12px]"
                           :disabled="isQuering"
                        >
                           <BaseIcon icon-name="mdiFileExport" :size="16" />
                           <span>{{ t('database.export') }}</span>
                           <BaseIcon icon-name="mdiMenuDown" :size="16" />
                        </Button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent align="end">
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
               </div>
            </div>
            <div class="workspace-query-info">
               <div
                  v-if="results.length"
                  class="d-flex"
                  :title="t('database.queryDuration')"
               >
                  <BaseIcon
                     class="mr-1 mt-1"
                     icon-name="mdiTimerSand"
                     :rotate="180"
                     :size="16"
                  /> <b>{{ results[0].duration / 1000 }}s</b>
               </div>
               <div v-if="results.length && results[0].rows">
                  {{ t('general.results') }}: <b>{{ localeString(results[0].rows.length) }}</b>
               </div>
               <div v-if="hasApproximately || (page > 1 && approximateCount)">
                  {{ t('database.total') }}: <b
                     :title="!customizations.tableRealCount ? t('database.approximately') : ''"
                  >
                     <span v-if="!customizations.tableRealCount">≈</span>
                     {{ localeString(approximateCount) }}
                  </b>
               </div>
               <div class="d-flex" :title="t('database.schema')">
                  <BaseIcon
                     class="mt-1 mr-1"
                     icon-name="mdiDatabase"
                     :size="18"
                  /><b>{{ schema }}</b>
               </div>
            </div>
         </div>
      </div>
      <WorkspaceTabTableFilters
         v-if="isSearch"
         :fields="fields"
         :is-quering="isQuering"
         :conn-client="connection.client"
         @filter="updateFilters"
         @filter-change="onFilterChange"
      />
      <div v-show="viewMode === 'data'" class="workspace-query-results p-relative column col-12">
         <BaseLoader v-if="isQuering" />
         <div v-if="!isQuering && !results[0]?.rows.length" class="empty">
            <div class="empty-icon">
               <BaseIcon icon-name="mdiIsland" :size="56" />
            </div>
            <p class="h4 empty-subtitle">
               {{ t('database.noResultsPresent') }}
            </p>
         </div>
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
            @update-field="updateField"
            @delete-selected="deleteSelected"
            @duplicate-row="showFakerModal"
            @hard-sort="hardSort"
         />
      </div>
      <WorkspaceTabPropsTable
         v-if="viewMode === 'props'"
         tab-uid="props"
         :connection="connection"
         :is-selected="isSelected && viewMode === 'props'"
         :table="table"
         :schema="schema"
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
import { computed, nextTick, onBeforeUnmount, Prop, Ref, ref, watch, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import BaseLoader from '@/components/BaseLoader.vue';
import ModalFakerRows from '@/components/ModalFakerRows.vue';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WorkspaceTabPropsTable from '@/components/WorkspaceTabPropsTable.vue';
import WorkspaceTabQueryTable from '@/components/WorkspaceTabQueryTable.vue';
import WorkspaceTabTableFilters from '@/components/WorkspaceTabTableFilters.vue';
import { useFilters } from '@/composables/useFilters';
import { useResultTables } from '@/composables/useResultTables';
import Tables from '@/ipc-api/Tables';
import { useNotificationsStore } from '@/stores/notifications';
import { useSettingsStore } from '@/stores/settings';
import { useWorkspacesStore } from '@/stores/workspaces';

const { localeString } = useFilters();

const { t } = useI18n();

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

const { dataTabLimit: limit, tableAutoRefreshInterval } = storeToRefs(settingsStore);

const { changeBreadcrumbs, getWorkspace, newTab } = workspacesStore;

const pageSelect: Ref<HTMLInputElement> = ref(null);
const tabUid = ref('data');
const isPageMenu = ref(false);
const isSearch = ref(false);
const results = ref([]);
const viewMode = ref<'data' | 'props'>('data');
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

watch(() => props.schema, () => {
   if (props.isSelected) {
      page.value = 1;
      approximateCount.value = 0;
      sortParams.value = {} as { field: string; dir: 'asc' | 'desc'};
      getTableData();
      lastTable.value = props.table;
      queryTable.value.resetSort();
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
      lastTable.value = props.table;
      queryTable.value.resetSort();
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

onBeforeUnmount(() => {
   clearInterval(refreshInterval.value);
   window.removeEventListener('antares:run-or-reload', reloadListener);
   window.removeEventListener('antares:open-filter', openFilterListener);
   window.removeEventListener('antares:next-page', nextPageListener);
   window.removeEventListener('antares:prev-page', prevPageListener);
});
</script>
