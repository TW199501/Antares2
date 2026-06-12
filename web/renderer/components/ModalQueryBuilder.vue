<template>
   <Dialog :open="open" @update:open="(v) => { if (!v) handleClose(); }">
      <DialogContent
         class="!max-w-[1100px] !max-h-[85vh] !p-0 !gap-0 flex flex-col [&>button.absolute]:!hidden"
         @escape-key-down.prevent="handleClose"
         @pointer-down-outside.prevent="handleClose"
         @interact-outside.prevent
      >
         <!-- Header -->
         <DialogHeader class="px-5 py-3 border-b border-border/60 flex flex-row items-center justify-between !space-y-0 shrink-0">
            <DialogTitle class="!text-[15px] !font-semibold flex items-center gap-2">
               <BaseIcon icon-name="mdiDatabaseSearch" :size="18" />
               <span>{{ t('database.queryBuilder', 'SQL Query') }}</span>
               <span class="text-xs font-normal bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                  {{ connection.uid }}
               </span>
               <span class="text-xs font-normal bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                  {{ schema }}
               </span>
            </DialogTitle>
            <DialogDescription class="sr-only">
               {{ t('database.queryBuilderDescription', 'Build and execute SQL queries against the selected schema') }}
            </DialogDescription>
            <Button
               variant="ghost"
               size="icon"
               class="!h-7 !w-7 shrink-0"
               :aria-label="t('general.close', 'Close')"
               @click.stop="handleClose"
            >
               <BaseIcon icon-name="mdiClose" :size="16" />
            </Button>
         </DialogHeader>

         <!-- Mode tabs -->
         <Tabs
            v-model="modeTab"
            class="flex-1 min-h-0 flex flex-col overflow-hidden"
         >
            <TabsList class="!justify-start !rounded-none border-b border-border/60 !bg-transparent !px-5 !py-0 !h-auto shrink-0 gap-0">
               <TabsTrigger
                  value="single"
                  class="!rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:!bg-transparent !px-3 !py-2 !text-sm"
               >
                  {{ t('database.singleTable', 'Single table') }}
               </TabsTrigger>
               <TabsTrigger
                  value="raw"
                  class="!rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:!bg-transparent !px-3 !py-2 !text-sm"
               >
                  {{ t('database.directSql', 'Raw SQL') }}
               </TabsTrigger>
               <TabsTrigger
                  value="join"
                  :disabled="true"
                  class="!rounded-none border-b-2 border-transparent !px-3 !py-2 !text-sm opacity-40 cursor-not-allowed"
                  :title="t('database.mvpComingSoon', 'Coming in a future release')"
               >
                  {{ t('database.joinQuery', 'JOIN') }}
               </TabsTrigger>
               <TabsTrigger
                  value="aggregate"
                  :disabled="true"
                  class="!rounded-none border-b-2 border-transparent !px-3 !py-2 !text-sm opacity-40 cursor-not-allowed"
                  :title="t('database.mvpComingSoon', 'Coming in a future release')"
               >
                  {{ t('database.aggregateQuery', 'Aggregate') }}
               </TabsTrigger>
               <TabsTrigger
                  value="join-aggregate"
                  :disabled="true"
                  class="!rounded-none border-b-2 border-transparent !px-3 !py-2 !text-sm opacity-40 cursor-not-allowed"
                  :title="t('database.mvpComingSoon', 'Coming in a future release')"
               >
                  {{ t('database.joinAggregateQuery', 'JOIN + Aggregate') }}
               </TabsTrigger>
               <TabsTrigger
                  value="subquery"
                  :disabled="true"
                  class="!rounded-none border-b-2 border-transparent !px-3 !py-2 !text-sm opacity-40 cursor-not-allowed"
                  :title="t('database.mvpComingSoon', 'Coming in a future release')"
               >
                  {{ t('database.subquery', 'Subquery') }}
               </TabsTrigger>
            </TabsList>

            <!-- Single table visual builder -->
            <TabsContent value="single" class="flex-none overflow-y-auto mt-0">
               <QueryBuilderSingleTable
                  ref="singleTableForm"
                  :uid="connection.uid"
                  :tables="tables"
                  :schema="schema"
                  :default-table="defaultTable"
               />
            </TabsContent>

            <!-- Raw SQL editor -->
            <TabsContent value="raw" class="flex-none mt-0 px-5 pt-3">
               <QueryEditor
                  ref="queryEditorRef"
                  v-model="rawSql"
                  :workspace="workspace ?? undefined"
                  :schema="schema"
                  :is-selected="open && modeTab === 'raw'"
                  :height="240"
               />
            </TabsContent>

            <!-- Disabled tabs — content never rendered -->
            <TabsContent value="join" class="mt-0" />
            <TabsContent value="aggregate" class="mt-0" />
            <TabsContent value="join-aggregate" class="mt-0" />
            <TabsContent value="subquery" class="mt-0" />
         </Tabs>

         <!-- Action bar -->
         <div class="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center gap-2 shrink-0">
            <!-- Auto commit toggle (only for transaction-capable clients) -->
            <template v-if="supportsTransactions">
               <Switch
                  :id="`qm-autocommit-${tabUid}`"
                  v-model:checked="autocommit"
                  class="!h-4 !w-7"
               />
               <Label :for="`qm-autocommit-${tabUid}`" class="text-sm cursor-pointer select-none">
                  {{ t('database.autoCommit', 'Auto commit') }}
               </Label>
            </template>

            <div class="flex-1" />

            <!-- Generate SQL (single-table mode only) -->
            <Button
               v-if="modeTab === 'single'"
               variant="secondary"
               size="sm"
               @click="handleGenerate"
            >
               <BaseIcon
                  icon-name="mdiCodeBraces"
                  :size="14"
                  class="mr-1"
               />
               {{ t('database.generateSql', 'Generate SQL') }}
            </Button>

            <!-- Execute -->
            <Button
               variant="default"
               size="sm"
               :disabled="(modeTab === 'raw' && !rawSql.trim()) || isQuering"
               @click="handleExecute"
            >
               <BaseIcon
                  v-if="isQuering"
                  icon-name="mdiLoading"
                  :size="14"
                  class="mr-1 animate-spin"
               />
               <BaseIcon
                  v-else
                  icon-name="mdiPlay"
                  :size="14"
                  class="mr-1"
               />
               {{ t('database.execute', 'Execute') }}
            </Button>

            <!-- Commit / Rollback (manual commit mode only) -->
            <template v-if="!autocommit && hasUnsavedChanges">
               <Button
                  variant="secondary"
                  size="sm"
                  :disabled="isQuering"
                  @click="handleCommit"
               >
                  {{ t('database.commit', 'Commit') }}
               </Button>
               <Button
                  variant="secondary"
                  size="sm"
                  :disabled="isQuering"
                  @click="handleRollback"
               >
                  {{ t('database.rollback', 'Rollback') }}
               </Button>
            </template>
         </div>

         <!-- Results area -->
         <div class="flex-none overflow-auto px-5 pb-3 pt-2 max-h-[320px] border-t border-border/40">
            <!-- Loading spinner -->
            <template v-if="isQuering">
               <div class="flex justify-center py-6">
                  <BaseLoader />
               </div>
            </template>

            <!-- Rows result -->
            <template v-else-if="resultsWithRows.length">
               <div class="text-xs text-muted-foreground mb-2">
                  {{ t('database.queryResultSummary', { n: resultsCount, ms: durationsCount }) }}
               </div>
               <div class="border border-border/60 rounded overflow-auto max-h-[260px]">
                  <table class="w-full text-xs">
                     <thead class="bg-muted/50 sticky top-0">
                        <tr>
                           <th
                              v-for="field in resultsWithRows[0].fields"
                              :key="field.name"
                              class="px-2 py-1 text-left font-semibold border-b border-border/60 whitespace-nowrap"
                           >
                              {{ field.alias || field.name }}
                           </th>
                        </tr>
                     </thead>
                     <tbody>
                        <tr
                           v-for="(row, idx) in resultsWithRows[0].rows.slice(0, 100)"
                           :key="idx"
                           class="border-b border-border/30 last:border-0 hover:bg-muted/30"
                        >
                           <td
                              v-for="field in resultsWithRows[0].fields"
                              :key="field.name"
                              class="px-2 py-1 truncate max-w-[300px]"
                           >
                              {{ formatCell(row[field.alias || field.name]) }}
                           </td>
                        </tr>
                     </tbody>
                  </table>
                  <div
                     v-if="resultsWithRows[0].rows.length > 100"
                     class="text-xs text-muted-foreground p-2 text-center"
                  >
                     {{ t('database.showingFirstNRows', { total: resultsWithRows[0].rows.length }) }}
                  </div>
               </div>
            </template>

            <!-- Affected rows (DML) -->
            <template v-else-if="affectedCount !== null">
               <div class="text-sm text-foreground">
                  {{ affectedCount }} {{ t('database.affectedRows', 'Affected rows') }} · {{ durationsCount }}ms
               </div>
            </template>

            <!-- No results yet -->
            <template v-else>
               <div class="text-sm text-muted-foreground italic">
                  {{ t('database.queryNoResults', 'Run a query to see results.') }}
               </div>
            </template>
         </div>
      </DialogContent>
   </Dialog>
</template>

<script setup lang="ts">
import { type ClientCode, type TableInfos } from 'common/interfaces/antares';
import { buildSingleTableSql } from 'common/libs/sqlBuilder';
import { uidGen } from 'common/libs/uidGen';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import BaseLoader from '@/components/BaseLoader.vue';
import QueryBuilderSingleTable from '@/components/QueryBuilderSingleTable.vue';
import QueryEditor from '@/components/QueryEditor.vue';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQueryExecution } from '@/composables/useQueryExecution';
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';

// ---------------------------------------------------------------------------
// Props / emits
// ---------------------------------------------------------------------------

interface Props {
   open: boolean;
   connection: { uid: string; client: ClientCode };
   schema: string;
   tables: TableInfos[];
   defaultTable?: string;
}

interface Emits {
   'update:open': [value: false];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();
const notificationsStore = useNotificationsStore();

// ---------------------------------------------------------------------------
// Mode state
// ---------------------------------------------------------------------------

const modeTab = ref<'single' | 'raw' | 'join' | 'aggregate' | 'join-aggregate' | 'subquery'>('single');

// ---------------------------------------------------------------------------
// SQL string — owned by this modal; shared between modes
// ---------------------------------------------------------------------------

const rawSql = ref('');

// ---------------------------------------------------------------------------
// Transaction / autocommit
// ---------------------------------------------------------------------------

const autocommit = ref(true);
const supportsTransactions = computed(() => props.connection.client === 'mssql');

// ---------------------------------------------------------------------------
// Query execution composable
// ---------------------------------------------------------------------------

// Fresh uid per modal mount so transaction routing is isolated
const tabUid = uidGen('QM');

const queryExecution = useQueryExecution({
   connectionUid: props.connection.uid,
   tabUid,
   schema: props.schema,
   autocommit
});

const {
   isQuering,
   results,
   resultsCount,
   durationsCount,
   affectedCount,
   runQuery,
   commitTab,
   rollbackTab,
   clearResults
} = queryExecution;

// ---------------------------------------------------------------------------
// Template refs
// ---------------------------------------------------------------------------

const singleTableForm = ref<InstanceType<typeof QueryBuilderSingleTable> | null>(null);
const queryEditorRef = ref<InstanceType<typeof QueryEditor> | null>(null);

// ---------------------------------------------------------------------------
// Workspace (QueryEditor needs it for autocomplete — gracefully null-safe)
// ---------------------------------------------------------------------------

const workspacesStore = useWorkspacesStore();
const workspace = computed(() => workspacesStore.getWorkspace(props.connection.uid));

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------

const resultsWithRows = computed(() =>
   results.value.filter(r => r.rows && r.rows.length > 0)
);

const hasUnsavedChanges = computed(() => {
   if (autocommit.value) return false;
   // Show Commit / Rollback whenever we have results in manual-commit mode.
   // The composable already marked the tab dirty via setUnsavedChanges.
   return results.value.length > 0;
});

// ---------------------------------------------------------------------------
// Cleanup on close
// ---------------------------------------------------------------------------

watch(() => props.open, (isOpen) => {
   if (!isOpen) {
      rawSql.value = '';
      modeTab.value = 'single';
      autocommit.value = true;
      clearResults();
   }
});

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/** Generate SQL from visual builder → populate rawSql → switch to raw tab */
const handleGenerate = () => {
   if (!singleTableForm.value) return;

   const input = singleTableForm.value.getInput();
   if (!input) {
      notificationsStore.addNotification({
         status: 'warning',
         message: t('database.querySelectTableFirst', 'Select a table first.')
      });
      return;
   }

   try {
      const sql = buildSingleTableSql(props.connection.client, input);
      rawSql.value = sql;
      modeTab.value = 'raw';
   }
   catch (err) {
      notificationsStore.addNotification({
         status: 'error',
         message: err instanceof Error ? err.message : String(err)
      });
   }
};

/** Execute the current rawSql against the connection */
const handleExecute = () => {
   const query = rawSql.value.trim();
   if (!query) {
      notificationsStore.addNotification({
         status: 'warning',
         message: t('database.queryEmpty', 'Enter SQL first.')
      });
      return;
   }
   return runQuery(query);
};

/** Commit open transaction. Composable returns false on backend / IPC failure
 *  (already notified). On success we clear results so the commit/rollback
 *  buttons hide (gated on results.length) and show a success toast. */
const handleCommit = async () => {
   const ok = await commitTab();
   if (!ok) return;
   clearResults();
   notificationsStore.addNotification({
      status: 'success',
      message: t('general.actionSuccessful', { action: 'COMMIT' })
   });
};

/** Same contract as handleCommit. */
const handleRollback = async () => {
   const ok = await rollbackTab();
   if (!ok) return;
   clearResults();
   notificationsStore.addNotification({
      status: 'success',
      message: t('general.actionSuccessful', { action: 'ROLLBACK' })
   });
};

/** Close the modal */
const handleClose = () => {
   emit('update:open', false);
};

// ---------------------------------------------------------------------------
// Cell formatter
// ---------------------------------------------------------------------------

const formatCell = (value: unknown): string => {
   if (value === null || value === undefined) return 'NULL';
   if (value instanceof Date) return value.toISOString();
   const str = String(value);
   return str.length > 200 ? `${str.slice(0, 200)}…` : str;
};
</script>
