<template>
   <ConfirmModal
      :confirm-text="t('general.confirm')"
      size="medium"
      @confirm="applyChanges"
      @hide="$emit('hide')"
   >
      <template #header>
         <div class="flex items-center">
            <BaseIcon
               class="mr-1"
               :icon-name="mode === 'create' ? 'mdiTablePlus' : 'mdiTableEdit'"
               :size="22"
            />
            <span class="cut-text">
               {{ mode === 'create' ? t('database.addNewField') : `${t('database.editField')} "${row.name}"` }}
            </span>
         </div>
      </template>
      <template #body>
         <div class="flex flex-col gap-3 px-1 py-2">
            <!-- 欄位名 -->
            <div class="flex flex-col gap-1">
               <Label class="!text-sm !text-muted-foreground !font-normal !m-0">
                  {{ t('database.fieldName') }}
               </Label>
               <Input
                  v-model="local.name"
                  type="text"
                  class="!h-[32px] !text-sm"
               />
            </div>
            <!-- 資料類型 -->
            <div class="flex flex-col gap-1">
               <Label class="!text-sm !text-muted-foreground !font-normal !m-0">
                  {{ t('database.type') }}
               </Label>
               <BaseSelect
                  v-model="local.type"
                  :options="dataTypes"
                  group-label="group"
                  group-values="types"
                  option-label="name"
                  option-track-by="name"
                  class="uppercase !h-[32px] !text-sm"
               />
            </div>
            <!-- 長度 / 精度 -->
            <div class="grid grid-cols-2 gap-2">
               <div v-if="currentFieldType?.length" class="flex flex-col gap-1">
                  <Label class="!text-sm !text-muted-foreground !font-normal !m-0">
                     {{ t('database.length') }}
                  </Label>
                  <Input
                     v-model.number="localLength"
                     type="number"
                     min="0"
                     class="!h-[32px] !text-sm"
                  />
               </div>
               <div v-if="currentFieldType?.scale" class="flex flex-col gap-1">
                  <Label class="!text-sm !text-muted-foreground !font-normal !m-0">
                     {{ t('database.precision') }}
                  </Label>
                  <Input
                     v-model.number="local.numScale"
                     type="number"
                     min="0"
                     class="!h-[32px] !text-sm"
                  />
               </div>
            </div>
            <!-- 主鍵 / 自增 / 可空 — Switch UI for clear toggle affordance -->
            <div class="grid grid-cols-3 gap-3 px-2 py-3 border border-border rounded-md bg-muted/30">
               <!-- PK: read-only (set on table level via index modal) -->
               <div class="flex flex-col gap-1.5">
                  <Label class="!text-sm !text-muted-foreground !font-normal !m-0 flex items-center gap-1.5">
                     {{ t('database.primaryKey') }}
                     <span class="text-xs text-muted-foreground/70">({{ t('general.readOnly') }})</span>
                  </Label>
                  <Switch :model-value="isPrimaryKey" disabled />
               </div>
               <!-- AI -->
               <div v-if="customizations.autoIncrement" class="flex flex-col gap-1.5">
                  <Label class="!text-sm !text-muted-foreground !font-normal !m-0">
                     {{ t('database.autoIncrement') }}
                  </Label>
                  <Switch
                     :model-value="!!local.autoIncrement"
                     :disabled="!canAutoincrement"
                     @update:model-value="canAutoincrement && toggleAutoIncrement()"
                  />
               </div>
               <!-- Nullable -->
               <div v-if="customizations.nullable" class="flex flex-col gap-1.5">
                  <Label class="!text-sm !text-muted-foreground !font-normal !m-0">
                     {{ t('database.allowNull') }}
                  </Label>
                  <Switch
                     :model-value="!!local.nullable"
                     :disabled="!isNullable"
                     @update:model-value="(v: boolean) => isNullable && (local.nullable = v)"
                  />
               </div>
            </div>
            <!-- 預設值 -->
            <div class="flex flex-col gap-1">
               <Label class="!text-sm !text-muted-foreground !font-normal !m-0">
                  {{ t('database.default') }}
               </Label>
               <Input
                  v-model="local.default"
                  type="text"
                  :placeholder="t('general.none')"
                  class="!h-[32px] !text-sm"
               />
            </div>
            <!-- 字符集 / 定序 (only when DB supports collation: MySQL / SQL Server) -->
            <template v-if="customizations.collation">
               <div class="flex flex-col gap-1">
                  <Label class="!text-sm !text-muted-foreground !font-normal !m-0">
                     {{ t('database.charset') }}
                  </Label>
                  <Input
                     v-model="local.charset"
                     type="text"
                     :placeholder="t('database.inheritFromTable')"
                     class="!h-[32px] !text-sm"
                  />
               </div>
               <div class="flex flex-col gap-1">
                  <Label class="!text-sm !text-muted-foreground !font-normal !m-0 flex items-center gap-1.5">
                     {{ t('database.collation') }}
                     <span class="text-xs text-muted-foreground/70">({{ t('general.readOnly') }})</span>
                  </Label>
                  <Input
                     :model-value="local.collation || t('database.inheritFromTable')"
                     type="text"
                     readonly
                     class="!h-[32px] !text-sm bg-muted/40 cursor-not-allowed"
                  />
               </div>
            </template>
            <!-- 描述 (with Google Translate) -->
            <div v-if="customizations.comment" class="flex flex-col gap-1">
               <Label class="!text-sm !text-muted-foreground !font-normal !m-0">
                  {{ t('database.comment') }}
               </Label>
               <div class="flex gap-1">
                  <Input
                     v-model="local.comment"
                     type="text"
                     :placeholder="t('database.commentPlaceholder')"
                     class="!h-[32px] !text-sm flex-1"
                  />
                  <Button
                     variant="secondary"
                     size="sm"
                     class="!h-[32px] !w-[36px] !p-0"
                     :title="t('database.translateDescription')"
                     :disabled="isTranslating"
                     @click.prevent="translateDescription"
                  >
                     <span v-if="!isTranslating" aria-hidden="true">🌐</span>
                     <span v-else class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
                  </Button>
               </div>
               <p v-if="translateError" class="text-xs mt-1 text-destructive">
                  {{ translateError }}
               </p>
            </div>
         </div>
      </template>
   </ConfirmModal>
</template>

<script setup lang="ts">
import { TableField, TableIndex, TypesGroup } from 'common/interfaces/antares';
import { computed, PropType, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '@/components/BaseConfirmModal.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import Ai from '@/ipc-api/Ai';
import { useSettingsStore } from '@/stores/settings';

const { t } = useI18n();

const props = defineProps({
   row: {
      type: Object as PropType<TableField>,
      required: true
   },
   indexes: {
      type: Array as PropType<TableIndex[]>,
      default: () => []
   },
   foreigns: {
      type: Array as PropType<string[]>,
      default: () => []
   },
   dataTypes: {
      type: Array as PropType<TypesGroup[]>,
      default: () => []
   },
   customizations: {
      type: Object,
      default: () => ({})
   },
   mode: {
      type: String as PropType<'edit' | 'create'>,
      default: 'edit'
   }
});

const emit = defineEmits<{
   'confirm': [field: TableField];
   'hide': [];
}>();

const settingsStore = useSettingsStore();

// Deep-clone so edits don't mutate the parent until confirmed
const local = reactive<TableField>({ ...props.row });
const isTranslating = ref(false);
const translateError = ref('');

const currentFieldType = computed(() => {
   const found = props.dataTypes
      .flatMap(g => g.types)
      .find(t => t.name === (local.type?.toUpperCase() ?? ''));
   return found ?? null;
});

const localLength = computed({
   get: () => local.numLength ?? local.charLength ?? local.datePrecision ?? local.numPrecision ?? 0,
   set: (val: number) => {
      const group = props.dataTypes.find(g => g.types.some(t => t.name === local.type?.toUpperCase()))?.group ?? '';
      if (['integer', 'float', 'binary', 'spatial'].includes(group)) local.numLength = val;
      else if (['string', 'unknown'].includes(group)) local.charLength = val;
      else if (['time'].includes(group)) local.datePrecision = val;
      else local.numPrecision = val;
   }
});

const isPrimaryKey = computed(() => props.indexes.some(i => i.type === 'PRIMARY'));
const canAutoincrement = computed(() => props.indexes.some(i => ['PRIMARY', 'UNIQUE'].includes(i.type)));
const isNullable = computed(() => props.customizations.nullablePrimary || !isPrimaryKey.value);

const toggleAutoIncrement = () => {
   local.autoIncrement = !local.autoIncrement;
   if (local.autoIncrement) {
      local.default = null;
      local.nullable = false;
   }
};

const translateDescription = async () => {
   if (!local.name) return;
   isTranslating.value = true;
   translateError.value = '';
   try {
      const { status, response } = await Ai.translateColumn({
         columnName: local.name,
         targetLocale: settingsStore.locale || 'zh-TW'
      });
      if (status === 'ok')
         local.comment = response.description;
      else
         translateError.value = String(response);
   }
   catch (e) {
      translateError.value = String(e);
   }
   finally {
      isTranslating.value = false;
   }
};

const applyChanges = () => {
   emit('confirm', { ...local });
};
</script>

<style lang="scss" scoped>
.field-chip {
  display: inline-block;
  padding: 0 5px;
  border-radius: 3px;
  font-size: 0.65rem;
  font-weight: 700;
  line-height: 1.6;
  cursor: default;

  &.chip-key-primary { background: rgba(74, 158, 255, 0.18); color: #4a9eff; border: 1px solid rgba(74, 158, 255, 0.4); }
  &.chip-null-active  { background: rgba(50, 182, 67, 0.18);  color: #32b643; border: 1px solid rgba(50, 182, 67, 0.4); }
  &.chip-null-inactive,
  &.chip-inactive     { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.35); border: 1px solid rgba(255,255,255,0.12); }
  &.chip-active       { background: rgba(227, 105, 41, 0.18); color: #e36929; border: 1px solid rgba(227, 105, 41, 0.4); }

  &.field-chip-toggle {
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;
    &:hover:not([style*="not-allowed"]) { filter: brightness(1.2); }
  }
}
</style>
