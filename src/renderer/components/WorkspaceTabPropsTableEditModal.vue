<template>
   <ConfirmModal
      :confirm-text="t('general.confirm')"
      size="medium"
      @confirm="applyChanges"
      @hide="$emit('hide')"
   >
      <template #header>
         <div class="d-flex align-items-center">
            <BaseIcon
               class="mr-1"
               icon-name="mdiTableEdit"
               :size="22"
            />
            <span class="cut-text">{{ t('database.editField') }} "{{ row.name }}"</span>
         </div>
      </template>
      <template #body>
         <div class="edit-field-form">
            <!-- 欄位名 -->
            <div class="form-group">
               <label class="form-label">{{ t('database.fieldName') }}</label>
               <input
                  v-model="local.name"
                  class="form-input input-sm"
                  type="text"
               >
            </div>
            <!-- 資料類型 -->
            <div class="form-group">
               <label class="form-label">{{ t('database.type') }}</label>
               <BaseSelect
                  v-model="local.type"
                  :options="dataTypes"
                  group-label="group"
                  group-values="types"
                  option-label="name"
                  option-track-by="name"
                  class="form-select input-sm text-uppercase"
               />
            </div>
            <!-- 長度 / 精度 -->
            <div class="columns">
               <div v-if="currentFieldType?.length" class="column col-6">
                  <div class="form-group">
                     <label class="form-label">{{ t('database.length') }}</label>
                     <input
                        v-model.number="localLength"
                        class="form-input input-sm"
                        type="number"
                        min="0"
                     >
                  </div>
               </div>
               <div v-if="currentFieldType?.scale" class="column col-6">
                  <div class="form-group">
                     <label class="form-label">{{ t('database.precision') }}</label>
                     <input
                        v-model.number="local.numScale"
                        class="form-input input-sm"
                        type="number"
                        min="0"
                     >
                  </div>
               </div>
            </div>
            <!-- 主鍵 / 自增 / 可空 -->
            <div class="d-flex align-items-center mb-2" style="gap:8px;">
               <!-- PK: read-only -->
               <div class="edit-chip-label">
                  {{ t('database.primaryKey') }}
               </div>
               <span
                  class="field-chip"
                  :class="isPrimaryKey ? 'chip-key-primary' : 'chip-inactive'"
               >{{ isPrimaryKey ? t('general.yes') : t('general.no') }}</span>
               <!-- AI -->
               <template v-if="customizations.autoIncrement">
                  <div class="edit-chip-label ml-2">
                     {{ t('database.autoIncrement') }}
                  </div>
                  <span
                     class="field-chip field-chip-toggle"
                     :class="local.autoIncrement ? 'chip-active' : 'chip-inactive'"
                     :style="!canAutoincrement ? 'opacity:0.3;cursor:not-allowed' : ''"
                     @click="canAutoincrement && toggleAutoIncrement()"
                  >{{ local.autoIncrement ? t('general.yes') : t('general.no') }}</span>
               </template>
               <!-- NULL -->
               <template v-if="customizations.nullable">
                  <div class="edit-chip-label ml-2">
                     {{ t('database.allowNull') }}
                  </div>
                  <span
                     class="field-chip field-chip-toggle"
                     :class="local.nullable ? 'chip-null-active' : 'chip-null-inactive'"
                     :style="!isNullable ? 'opacity:0.3;cursor:not-allowed' : ''"
                     @click="isNullable && (local.nullable = !local.nullable)"
                  >{{ local.nullable ? t('general.yes') : t('general.no') }}</span>
               </template>
            </div>
            <!-- 預設值 -->
            <div class="form-group">
               <label class="form-label">{{ t('database.default') }}</label>
               <input
                  v-model="local.default"
                  class="form-input input-sm"
                  type="text"
                  :placeholder="t('general.none')"
               >
            </div>
            <!-- 描述 (with AI translate) -->
            <div v-if="customizations.comment" class="form-group">
               <label class="form-label">{{ t('database.comment') }}</label>
               <div class="input-group">
                  <input
                     v-model="local.comment"
                     class="form-input input-sm"
                     type="text"
                     :placeholder="t('database.commentPlaceholder')"
                  >
                  <button
                     class="btn btn-sm input-group-btn translate-btn"
                     :class="{ 'loading': isTranslating }"
                     :title="settingsStore.aiApiKey ? t('database.translateWithAi') : t('database.aiKeyRequired')"
                     :disabled="isTranslating"
                     @click.prevent="translateDescription"
                  >
                     <span v-if="!isTranslating" class="globe-icon">🌐</span>
                  </button>
               </div>
               <p v-if="!settingsStore.aiApiKey" class="form-input-hint text-warning mt-1">
                  {{ t('database.aiKeyRequired') }}
               </p>
               <p v-if="translateError" class="form-input-hint text-error mt-1">
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
   if (!settingsStore.aiApiKey) return;
   isTranslating.value = true;
   translateError.value = '';
   try {
      const { status, response } = await Ai.translateColumn({
         columnName: local.name,
         tableName: props.row.table,
         apiKey: settingsStore.aiApiKey
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
.edit-field-form {
  .form-group {
    margin-bottom: 0.6rem;
  }

  .form-label {
    font-size: 0.65rem;
    opacity: 0.7;
    margin-bottom: 2px;
  }
}

.edit-chip-label {
  font-size: 0.65rem;
  opacity: 0.7;
}

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

.translate-btn {
  padding: 0 8px;
  font-size: 1rem;
  line-height: 1;

  .globe-icon {
    display: block;
    line-height: 1.2;
  }
}

.text-warning { color: #ffb700; }
.text-error   { color: #e85600; }
</style>
