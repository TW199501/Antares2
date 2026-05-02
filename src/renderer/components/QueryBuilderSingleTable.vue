<template>
   <div class="flex flex-col gap-3 p-3">
      <!-- 查詢表 (Table) -->
      <div class="flex items-center gap-3 border-b border-border/40 pb-3">
         <label class="w-[60px] shrink-0 text-sm text-muted-foreground text-right">
            {{ t('database.queryTable', 'Table') }}
         </label>
         <div class="flex-1">
            <BaseSelect
               v-model="selectedTable"
               :options="tableOptions"
               option-track-by="value"
               option-label="label"
               :searchable="true"
               :placeholder="t('database.queryTable', 'Select table…')"
               class="w-full"
            />
         </div>
      </div>

      <!-- 欄位 (Fields) -->
      <div class="flex gap-3 border-b border-border/40 pb-3">
         <label class="w-[60px] shrink-0 text-sm text-muted-foreground text-right pt-1">
            {{ t('general.field', 'Fields') }}
         </label>
         <div class="flex-1">
            <div v-if="isLoadingFields" class="text-sm text-muted-foreground">
               {{ t('general.loading', 'Loading…') }}
            </div>
            <div v-else-if="!selectedTable" class="text-sm text-muted-foreground italic">
               {{ t('database.selectTableHint', '— select a table —') }}
            </div>
            <div v-else-if="fields.length === 0" class="text-sm text-muted-foreground italic">
               {{ t('database.tableHasNoColumns', '(table has no columns)') }}
            </div>
            <div v-else class="flex flex-col gap-1">
               <!-- 全選 row -->
               <div class="flex items-center gap-2 mb-1">
                  <Checkbox
                     :checked="allSelected ? true : someSelected ? 'indeterminate' : false"
                     @update:checked="toggleAll"
                  />
                  <Label class="text-sm cursor-pointer select-none" @click="toggleAll()">
                     {{ t('database.allFields', 'All fields') }}
                  </Label>
               </div>
               <!-- Per-column checkboxes: 3-column grid -->
               <div class="grid grid-cols-3 gap-x-4 gap-y-1">
                  <div
                     v-for="field in fields"
                     :key="field.name"
                     class="flex items-center gap-2"
                  >
                     <Checkbox
                        :checked="selectedFields.includes(field.name)"
                        @update:checked="(v) => toggleField(field.name, !!v)"
                     />
                     <Label
                        class="text-xs cursor-pointer select-none truncate"
                        :title="field.name"
                        @click="toggleField(field.name, !selectedFields.includes(field.name))"
                     >
                        {{ field.name }}
                     </Label>
                  </div>
               </div>
            </div>
         </div>
      </div>

      <!-- 條件 (Conditions) -->
      <div class="flex gap-3 border-b border-border/40 pb-3">
         <label class="w-[60px] shrink-0 text-sm text-muted-foreground text-right pt-1">
            {{ t('database.conditions', 'Conditions') }}
         </label>
         <div class="flex-1 flex flex-col gap-2">
            <div
               v-for="(cond, idx) in conditions"
               :key="idx"
               class="flex items-center gap-2"
            >
               <!-- Field selector -->
               <BaseSelect
                  v-model="cond.field"
                  :options="fieldNameOptions"
                  option-track-by="value"
                  option-label="label"
                  :searchable="false"
                  class="w-[140px] shrink-0"
               />
               <!-- Operator selector -->
               <BaseSelect
                  v-model="cond.op"
                  :options="operatorOptions"
                  option-track-by="value"
                  option-label="label"
                  :searchable="false"
                  class="w-[130px] shrink-0"
               />
               <!-- Value inputs — conditional on operator -->
               <template v-if="!['IS NULL', 'IS NOT NULL'].includes(cond.op)">
                  <Input
                     v-model="cond.value"
                     type="text"
                     class="!h-8 !text-sm flex-1 min-w-0"
                     :placeholder="t('general.value', 'value')"
                  />
                  <Input
                     v-if="cond.op === 'BETWEEN'"
                     v-model="cond.value2"
                     type="text"
                     class="!h-8 !text-sm flex-1 min-w-0"
                     :placeholder="t('general.value', 'value 2')"
                  />
               </template>
               <!-- Spacer when no value inputs -->
               <div v-else class="flex-1" />
               <!-- Remove button -->
               <Button
                  variant="secondary"
                  size="icon"
                  type="button"
                  class="shrink-0"
                  :aria-label="t('general.remove', 'Remove')"
                  @click="removeCondition(idx)"
               >
                  <BaseIcon icon-name="mdiMinusCircleOutline" :size="16" />
               </Button>
            </div>
            <!-- Add condition button -->
            <div>
               <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  :disabled="fields.length === 0"
                  @click="addCondition"
               >
                  <BaseIcon
                     icon-name="mdiPlusCircleOutline"
                     :size="14"
                     class="mr-1"
                  />
                  {{ t('database.addCondition', '+ Add condition') }}
               </Button>
            </div>
         </div>
      </div>

      <!-- 排序 (Order By) -->
      <div class="flex gap-3 border-b border-border/40 pb-3">
         <label class="w-[60px] shrink-0 text-sm text-muted-foreground text-right pt-1">
            {{ t('database.orderBy', 'Order By') }}
         </label>
         <div class="flex-1 flex flex-col gap-2">
            <div
               v-for="(order, idx) in orderBy"
               :key="idx"
               class="flex items-center gap-2"
            >
               <!-- Field selector -->
               <BaseSelect
                  v-model="order.field"
                  :options="fieldNameOptions"
                  option-track-by="value"
                  option-label="label"
                  :searchable="false"
                  class="w-[200px] shrink-0"
               />
               <!-- Direction selector -->
               <BaseSelect
                  v-model="order.direction"
                  :options="directionOptions"
                  option-track-by="value"
                  option-label="label"
                  :searchable="false"
                  class="w-[100px] shrink-0"
               />
               <!-- Remove button -->
               <Button
                  variant="secondary"
                  size="icon"
                  type="button"
                  :aria-label="t('general.remove', 'Remove')"
                  @click="removeOrderBy(idx)"
               >
                  <BaseIcon icon-name="mdiMinusCircleOutline" :size="16" />
               </Button>
            </div>
            <!-- Add order-by button -->
            <div>
               <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  :disabled="fields.length === 0"
                  @click="addOrderBy"
               >
                  <BaseIcon
                     icon-name="mdiPlusCircleOutline"
                     :size="14"
                     class="mr-1"
                  />
                  {{ t('database.addOrderBy', '+ Add sort') }}
               </Button>
            </div>
         </div>
      </div>

      <!-- 筆數 (Limit) -->
      <div class="flex items-center gap-3">
         <label class="w-[60px] shrink-0 text-sm text-muted-foreground text-right">
            {{ t('database.limit', 'Limit') }}
         </label>
         <div class="flex items-center gap-1">
            <Button
               variant="secondary"
               size="icon"
               type="button"
               class="!h-8 !w-8 shrink-0"
               :aria-label="t('general.decrease', 'Decrease')"
               @click="decrementLimit"
            >
               <BaseIcon icon-name="mdiMinus" :size="14" />
            </Button>
            <Input
               v-model.number="limit"
               type="number"
               min="0"
               max="100000"
               step="1"
               class="!h-8 !text-sm w-[90px] text-center"
            />
            <Button
               variant="secondary"
               size="icon"
               type="button"
               class="!h-8 !w-8 shrink-0"
               :aria-label="t('general.increase', 'Increase')"
               @click="incrementLimit"
            >
               <BaseIcon icon-name="mdiPlus" :size="14" />
            </Button>
         </div>
      </div>
   </div>
</template>

<script setup lang="ts">
import { TableField, TableInfos } from 'common/interfaces/antares';
import type { BuildSingleTableInput, SqlOperator, SqlOrderBy, SqlValueKind } from 'common/libs/sqlBuilder';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Tables from '@/ipc-api/Tables';
import { useNotificationsStore } from '@/stores/notifications';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
   // workspace/connection uid — required for IPC
   uid: string;
   // list of tables in current schema
   tables: TableInfos[];
   // current schema name (e.g. 'dbo')
   schema: string;
   // pre-select table on open
   defaultTable?: string;
}

const props = defineProps<Props>();

// ---------------------------------------------------------------------------
// Stores / i18n
// ---------------------------------------------------------------------------

const { t } = useI18n();
const notificationsStore = useNotificationsStore();

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

const selectedTable = ref<string | null>(props.defaultTable ?? null);
const fields = ref<TableField[]>([]);
const selectedFields = ref<string[]>([]);
const conditions = ref<Array<{
   field: string;
   op: SqlOperator;
   value: string;
   value2: string;
}>>([]);
const orderBy = ref<SqlOrderBy[]>([]);
const limit = ref<number>(100);
const isLoadingFields = ref(false);

// ---------------------------------------------------------------------------
// Derived options for BaseSelect components
// ---------------------------------------------------------------------------

const tableOptions = computed(() =>
   props.tables.map(t => ({ value: t.name, label: t.name }))
);

const fieldNameOptions = computed(() =>
   fields.value.map(f => ({ value: f.name, label: f.name }))
);

const operators: SqlOperator[] = [
   '=', '<>', '<', '<=', '>', '>=',
   'LIKE', 'NOT LIKE',
   'IN', 'NOT IN',
   'IS NULL', 'IS NOT NULL',
   'BETWEEN'
];

const operatorOptions = operators.map(op => ({ value: op, label: op }));

const directionOptions = [
   { value: 'ASC', label: 'ASC' },
   { value: 'DESC', label: 'DESC' }
];

// ---------------------------------------------------------------------------
// Select-all / indeterminate state
// ---------------------------------------------------------------------------

const allSelected = computed(() =>
   fields.value.length > 0 && selectedFields.value.length === fields.value.length
);

const someSelected = computed(() =>
   selectedFields.value.length > 0 && selectedFields.value.length < fields.value.length
);

const toggleAll = () => {
   if (allSelected.value)
      selectedFields.value = [];
   else
      selectedFields.value = fields.value.map(f => f.name);
};

const toggleField = (name: string, selected: boolean) => {
   if (selected) {
      if (!selectedFields.value.includes(name))
         selectedFields.value = [...selectedFields.value, name];
   }
   else
      selectedFields.value = selectedFields.value.filter(n => n !== name);
};

// ---------------------------------------------------------------------------
// Load fields when selectedTable changes
// ---------------------------------------------------------------------------

const loadFields = async (tableName: string | null) => {
   if (!tableName) {
      fields.value = [];
      selectedFields.value = [];
      conditions.value = [];
      orderBy.value = [];
      return;
   }

   isLoadingFields.value = true;
   try {
      const { status, response } = await Tables.getTableColumns({
         uid: props.uid,
         schema: props.schema,
         table: tableName
      });

      if (status === 'success') {
         fields.value = response as TableField[];
         selectedFields.value = (response as TableField[]).map(f => f.name);
         // Reset conditions / orderBy referencing old columns
         conditions.value = [];
         orderBy.value = [];
      }
      else
         notificationsStore.addNotification({ status: 'error', message: String(response) });
   }
   catch (err) {
      notificationsStore.addNotification({
         status: 'error',
         message: `Failed to load columns: ${err instanceof Error ? err.message : String(err)}`
      });
   }
   finally {
      isLoadingFields.value = false;
   }
};

watch(selectedTable, (tableName) => {
   loadFields(tableName).catch(err => {
      notificationsStore.addNotification({
         status: 'error',
         message: `Failed to load columns: ${err instanceof Error ? err.message : String(err)}`
      });
   });
}, { immediate: true });

// I3: when parent swaps `tables` (e.g. schema change), drop stale selection
watch(() => props.tables, (newTables) => {
   if (selectedTable.value && !newTables.some(t => t.name === selectedTable.value))
      selectedTable.value = null;
}, { deep: false });

// ---------------------------------------------------------------------------
// Conditions helpers
// ---------------------------------------------------------------------------

const addCondition = () => {
   conditions.value.push({
      field: fields.value[0]?.name ?? '',
      op: '=',
      value: '',
      value2: ''
   });
};

const removeCondition = (idx: number) => {
   conditions.value = conditions.value.filter((_, i) => i !== idx);
};

// ---------------------------------------------------------------------------
// OrderBy helpers
// ---------------------------------------------------------------------------

const addOrderBy = () => {
   orderBy.value.push({
      field: fields.value[0]?.name ?? '',
      direction: 'ASC'
   });
};

const removeOrderBy = (idx: number) => {
   orderBy.value = orderBy.value.filter((_, i) => i !== idx);
};

// ---------------------------------------------------------------------------
// Limit stepper
// ---------------------------------------------------------------------------

const incrementLimit = () => {
   limit.value = Math.min(100000, (limit.value || 0) + 1);
};

const decrementLimit = () => {
   limit.value = Math.max(0, (limit.value || 0) - 1);
};

// ---------------------------------------------------------------------------
// Field-type-aware value kind inference
// ---------------------------------------------------------------------------

const inferValueKind = (fieldName: string): SqlValueKind => {
   const field = fields.value.find(f => f.name === fieldName);
   if (!field) return 'string';
   const type = field.type.toUpperCase();
   if (['INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'DECIMAL', 'FLOAT', 'REAL', 'NUMERIC', 'BIT'].some(t => type.includes(t)))
      return 'number';
   if (['DATE', 'TIME', 'DATETIME', 'TIMESTAMP'].some(t => type.includes(t)))
      return 'datetime';
   return 'string';
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const getInput = (): BuildSingleTableInput | null => {
   if (!selectedTable.value) return null;

   return {
      schema: props.schema,
      table: selectedTable.value,
      // If all fields are selected, pass empty array → buildSingleTableSql emits SELECT *
      fields: selectedFields.value.length === fields.value.length ? [] : selectedFields.value,
      conditions: conditions.value
         .filter(c => c.field)
         .map(c => ({
            field: c.field,
            op: c.op,
            value: c.value || undefined,
            value2: c.value2 || undefined,
            valueKind: inferValueKind(c.field)
         })),
      orderBy: orderBy.value.filter(o => o.field),
      limit: limit.value > 0 ? limit.value : undefined
   };
};

defineExpose({ getInput });
</script>
