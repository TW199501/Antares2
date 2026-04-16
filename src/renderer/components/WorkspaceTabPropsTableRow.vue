<template>
   <div class="tr" @contextmenu.prevent="!editingField ? emit('contextmenu', $event, localRow._antares_id) : null">
      <!-- 排序 -->
      <div class="td p-0 text-center" tabindex="0">
         <span class="cell-content text-center">{{ localRow.order }}</span>
      </div>
      <!-- 字段名 -->
      <div class="td p-0" tabindex="0">
         <span
            v-if="!isInlineEditor.name"
            class="cell-content"
            @dblclick="editON($event, localRow.name, 'name')"
         >
            {{ localRow.name }}
         </span>
         <input
            v-else
            ref="editField"
            v-model="editingContent"
            type="text"
            autofocus
            class="editable-field form-input input-sm px-1"
            @blur="editOFF"
         >
      </div>
      <!-- 数据类型 -->
      <div class="td p-0 text-uppercase" tabindex="0">
         <span
            v-if="!isInlineEditor.type"
            class="cell-content text-left"
            :class="typeClass(localRow.type)"
            @dblclick="editON($event, localRow.type.toUpperCase(), 'type')"
         >
            {{ localRow.type }}
         </span>
         <BaseSelect
            v-else
            ref="editField"
            v-model="editingContent"
            :options="types"
            group-label="group"
            group-values="types"
            option-label="name"
            option-track-by="name"
            class="form-select editable-field pl-1 pr-4 small-select text-uppercase"
            @blur="editOFF"
         />
      </div>
      <!-- 主键 PK (read-only chip) -->
      <div class="td p-0 text-center" tabindex="0">
         <span
            class="field-chip"
            :class="isPrimaryKey ? 'chip-key-primary' : 'chip-inactive'"
         >{{ isPrimaryKey ? t('general.yes') : t('general.no') }}</span>
      </div>
      <!-- 自增 AI (toggle chip, conditional) -->
      <div
         v-if="customizations.autoIncrement"
         class="td p-0 text-center"
         tabindex="0"
      >
         <span
            class="field-chip field-chip-toggle"
            :class="[localRow.autoIncrement ? 'chip-active' : 'chip-inactive', !canAutoincrement ? 'chip-disabled' : '']"
            @click="canAutoincrement && toggleAutoIncrement()"
         >{{ localRow.autoIncrement ? t('general.yes') : t('general.no') }}</span>
      </div>
      <!-- 可空 NULL (toggle chip, conditional) -->
      <div
         v-if="customizations.nullable"
         class="td p-0 text-center"
         tabindex="0"
      >
         <span
            class="field-chip field-chip-toggle"
            :class="[localRow.nullable ? 'chip-null-active' : 'chip-null-inactive', !isNullable ? 'chip-disabled' : '']"
            @click="isNullable && (localRow.nullable = !localRow.nullable)"
         >{{ localRow.nullable ? t('general.yes') : t('general.no') }}</span>
      </div>
      <!-- 长度 -->
      <div class="td p-0 type-int text-center" tabindex="0">
         <span
            v-if="!isInlineEditor.length"
            class="cell-content text-center"
            :class="!fieldType?.length ? 'cell-readonly' : ''"
            @dblclick="fieldType?.length ? editON($event, localLength, 'length') : null"
         >{{ localRow.enumValues || localLength || '-' }}</span>
         <template v-if="fieldType?.length && isInlineEditor.length">
            <input
               v-if="localRow.enumValues"
               ref="editField"
               v-model="editingContent"
               type="text"
               autofocus
               class="editable-field form-input input-sm px-1"
               @blur="editOFF"
            >
            <input
               v-else
               ref="editField"
               v-model="editingContent"
               type="number"
               autofocus
               class="editable-field form-input input-sm px-1"
               @blur="editOFF"
            >
         </template>
      </div>
      <!-- 精度 (scale) -->
      <div class="td p-0 type-int text-center" tabindex="0">
         <template v-if="fieldType?.scale">
            <span
               v-if="!isInlineEditor.numScale"
               class="cell-content text-center"
               @dblclick="editON($event, localRow.numScale, 'numScale')"
            >{{ localRow.numScale }}</span>
            <input
               v-else
               ref="editField"
               v-model="editingContent"
               type="number"
               autofocus
               class="editable-field form-input input-sm px-1"
               @blur="editOFF"
            >
         </template>
      </div>
      <!-- FK / UQ (read-only chips) -->
      <div class="td p-0 text-center" tabindex="0">
         <div class="field-fkuq-chips">
            <span
               v-for="(idx, i) in uqIndexes"
               :key="`uq-${i}`"
               :title="idx.type"
               class="field-chip chip-key-unique"
            >UQ</span>
            <span
               v-for="foreign in foreigns"
               :key="foreign"
               :title="foreign"
               class="field-chip chip-key-fk"
            >FK</span>
         </div>
      </div>
      <!-- 默认值 -->
      <div class="td p-0" tabindex="0">
         <span class="cell-content" @dblclick="editON($event, localRow.default, 'default')">
            {{ fieldDefault }}
         </span>
      </div>
      <!-- 描述 (conditional) -->
      <div
         v-if="customizations.comment"
         class="td p-0 type-varchar"
         tabindex="0"
      >
         <span
            v-if="!isInlineEditor.comment"
            class="cell-content"
            @dblclick="editON($event, localRow.comment, 'comment')"
         >
            {{ localRow.comment }}
         </span>
         <input
            v-else
            ref="editField"
            v-model="editingContent"
            type="text"
            autofocus
            class="editable-field form-input input-sm px-1"
            @blur="editOFF"
         >
      </div>
      <!-- 排序規則 (collation, conditional) -->
      <div
         v-if="customizations.collation"
         class="td p-0"
         tabindex="0"
      >
         <template v-if="fieldType.collation">
            <span
               v-if="!isInlineEditor.collation"
               class="cell-content"
               @dblclick="editON($event, localRow.collation, 'collation')"
            >
               {{ localRow.collation }}
            </span>
            <BaseSelect
               v-else
               ref="editField"
               v-model="editingContent"
               :options="collations"
               option-label="collation"
               option-track-by="collation"
               :max-visible-options="1000"
               class="form-select small-select pl-1 pr-4 editable-field"
               @blur="editOFF"
            />
         </template>
      </div>
      <!-- 操作 -->
      <div class="td p-0 td-ops" tabindex="0">
         <div class="ops-btns">
            <button
               class="btn btn-link btn-sm op-btn"
               :title="t('general.moveUp')"
               @click.stop="emit('move-up', localRow._antares_id)"
            >
               <BaseIcon icon-name="mdiArrowUp" :size="14" />
            </button>
            <button
               class="btn btn-link btn-sm op-btn"
               :title="t('general.moveDown')"
               @click.stop="emit('move-down', localRow._antares_id)"
            >
               <BaseIcon icon-name="mdiArrowDown" :size="14" />
            </button>
            <button
               class="btn btn-link btn-sm op-btn op-btn-edit"
               :title="t('database.editField')"
               @click.stop="isEditModal = true"
            >
               <BaseIcon icon-name="mdiPencilOutline" :size="14" />
            </button>
            <button
               class="btn btn-link btn-sm op-btn op-btn-delete"
               :title="t('general.delete')"
               @click.stop="emit('remove-field-row', localRow._antares_id)"
            >
               <BaseIcon icon-name="mdiDeleteOutline" :size="14" />
            </button>
         </div>
      </div>
      <EditModal
         v-if="isEditModal"
         :row="localRow"
         :indexes="indexes"
         :foreigns="foreigns"
         :data-types="dataTypes"
         :customizations="customizations"
         @confirm="applyEditModal"
         @hide="isEditModal = false"
      />
      <ConfirmModal
         v-if="isDefaultModal"
         :confirm-text="t('general.confirm')"
         size="400"
         @confirm="editOFF"
         @hide="hideDefaultModal"
      >
         <template #header>
            <div class="d-flex">
               <BaseIcon
                  class="mr-1"
                  icon-name="mdiPlaylistEdit"
                  :size="24"
               />
               <span class="cut-text">{{ t('database.default') }} "{{ row.name }}"</span>
            </div>
         </template>
         <template #body>
            <form class="form-horizontal">
               <div class="mb-2">
                  <label class="form-radio form-inline">
                     <input
                        v-model="defaultValue.type"
                        type="radio"
                        name="default"
                        value="noval"
                     ><i class="form-icon" /> No value
                  </label>
               </div>
               <div class="mb-2">
                  <div class="form-group">
                     <label class="form-radio form-inline col-4">
                        <input
                           v-model="defaultValue.type"
                           value="custom"
                           type="radio"
                           name="default"
                        ><i class="form-icon" /> {{ t('database.customValue') }}
                     </label>
                     <div class="column">
                        <input
                           v-model="defaultValue.custom"
                           :disabled="defaultValue.type !== 'custom'"
                           class="form-input"
                           type="text"
                        >
                     </div>
                  </div>
               </div>
               <div v-if="customizations.nullable" class="mb-2">
                  <label class="form-radio form-inline">
                     <input
                        v-model="defaultValue.type"
                        type="radio"
                        name="default"
                        value="null"
                     ><i class="form-icon" /> NULL
                  </label>
               </div>
               <div v-if="customizations.autoIncrement" class="mb-2">
                  <label class="form-radio form-inline">
                     <input
                        v-model="defaultValue.type"
                        :disabled="!canAutoincrement"
                        type="radio"
                        name="default"
                        value="autoincrement"
                     ><i class="form-icon" /> AUTO_INCREMENT
                  </label>
               </div>
               <div class="mb-2">
                  <div class="form-group">
                     <label class="form-radio form-inline col-4">
                        <input
                           v-model="defaultValue.type"
                           type="radio"
                           name="default"
                           value="expression"
                        ><i class="form-icon" /> {{ t('database.expression') }}
                     </label>
                     <div class="column">
                        <input
                           v-model="defaultValue.expression"
                           :disabled="defaultValue.type !== 'expression'"
                           class="form-input"
                           type="text"
                        >
                     </div>
                  </div>
               </div>
               <div v-if="customizations.onUpdate">
                  <div class="form-group">
                     <label class="form-label col-4">
                        {{ t('database.onUpdate') }}
                     </label>
                     <div class="column">
                        <input
                           v-model="defaultValue.onUpdate"
                           class="form-input"
                           type="text"
                        >
                     </div>
                  </div>
               </div>
            </form>
         </template>
      </ConfirmModal>
   </div>
</template>

<script setup lang="ts">
import { TableField, TableIndex, TypesGroup } from 'common/interfaces/antares';
import { storeToRefs } from 'pinia';
import { computed, nextTick, onMounted, Prop, PropType, Ref, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '@/components/BaseConfirmModal.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import EditModal from '@/components/WorkspaceTabPropsTableEditModal.vue';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const props = defineProps({
   row: Object as Prop<TableField>,
   dataTypes: {
      type: Array as PropType<TypesGroup[]>,
      default: () => []
   },
   indexes: Array as Prop<TableIndex[]>,
   foreigns: Array as Prop<string[]>,
   customizations: Object
});

const emit = defineEmits<{
   'contextmenu': [event: MouseEvent, id: string];
   'rename-field': [payload: { old: string; new: string | number }];
   'move-up': [id: string];
   'move-down': [id: string];
   'remove-field-row': [id: string];
}>();

const workspacesStore = useWorkspacesStore();

const { getSelected: selectedWorkspace } = storeToRefs(workspacesStore);

const { getWorkspace } = workspacesStore;

const localRow: Ref<TableField> = ref({} as TableField);
const isInlineEditor: Ref<TableField> = ref({} as TableField);
const isDefaultModal = ref(false);
const isEditModal = ref(false);
const defaultValue = ref({
   type: 'noval',
   custom: '',
   expression: '',
   onUpdate: ''
});
const editingContent: Ref<string | number> = ref(null);
const originalContent = ref(null);
const editingField: Ref<keyof TableField> = ref(null);

const localLength = computed(() => {
   const localLength = localRow.value.numLength || localRow.value.charLength || localRow.value.numPrecision || localRow.value.datePrecision || 0 as number | true;
   return localLength === true ? null : localLength;
});

const fieldType = computed(() => {
   const fieldType = props.dataTypes.reduce((acc, group) => [...acc, ...group.types], []).filter(type =>
      type.name === (localRow.value.type ? localRow.value.type.toUpperCase() : '')
   );
   const group = props.dataTypes.filter(group => group.types.some(type =>
      type.name === (localRow.value.type ? localRow.value.type.toUpperCase() : ''))
   );

   return fieldType.length ? { ...fieldType[0], group: group[0].group } : {};
});

const fieldDefault = computed(() => {
   if (localRow.value.autoIncrement) return 'AUTO_INCREMENT';
   if (localRow.value.default === 'NULL') return 'NULL';
   return localRow.value.default;
});

const collations = computed(() => getWorkspace(selectedWorkspace.value).collations);
const canAutoincrement = computed(() => props.indexes.some(index => ['PRIMARY', 'UNIQUE'].includes(index.type)));
const isNullable = computed(() => props.customizations.nullablePrimary || !props.indexes.some(index => ['PRIMARY'].includes(index.type)));
const isPrimaryKey = computed(() => props.indexes.some(index => index.type === 'PRIMARY'));
const uqIndexes = computed(() => props.indexes.filter(index => index.type === 'UNIQUE'));

const isInDataTypes = computed(() => {
   let typeNames: string[] = [];
   for (const group of props.dataTypes) {
      const groupTypeNames = group.types.reduce((acc, curr) => {
         acc.push(curr.name);
         return acc;
      }, []);

      typeNames = [...groupTypeNames, ...typeNames];
   }
   return typeNames.includes(props.row.type);
});

const types = computed(() => {
   const types = [...props.dataTypes];
   if (!isInDataTypes.value)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (types as any).unshift({ name: props.row.type });

   return types;
});

const typeClass = (type: string) => {
   if (type)
      return `type-${type.toLowerCase().replaceAll(' ', '_').replaceAll('"', '')}`;
   return '';
};

const initLocalRow = () => {
   Object.keys(localRow.value).forEach(key => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (isInlineEditor as any).value[key] = false;
   });

   defaultValue.value.onUpdate = localRow.value.onUpdate;
   defaultValue.value.type = localRow.value.defaultType || 'noval';
   if (defaultValue.value.type === 'custom') {
      defaultValue.value.custom = localRow.value.default
         ? localRow.value.default.includes('\'')
            ? localRow.value.default.split('\'')[1]
            : localRow.value.default
         : '';
   }
   else if (defaultValue.value.type === 'expression') {
      if (localRow.value.default.toUpperCase().includes('ON UPDATE'))
         defaultValue.value.expression = localRow.value.default.replace(/ on update.*$/i, '');
      else
         defaultValue.value.expression = localRow.value.default;
   }
};

const toggleAutoIncrement = () => {
   localRow.value.autoIncrement = !localRow.value.autoIncrement;
   if (localRow.value.autoIncrement) {
      localRow.value.default = null;
      localRow.value.nullable = false;
   }
};

const editON = async (event: MouseEvent, content: string | number, field: keyof TableField) => {
   if (field === 'length') {
      if (['integer', 'float', 'binary', 'spatial'].includes(fieldType.value.group)) editingField.value = 'numLength';
      else if (['string', 'unknown'].includes(fieldType.value.group)) editingField.value = 'charLength';
      else if (['other'].includes(fieldType.value.group)) editingField.value = 'enumValues';
      else if (['time'].includes(fieldType.value.group)) editingField.value = 'datePrecision';
   }
   else
      editingField.value = field;

   if (localRow.value.enumValues && field === 'length') {
      editingContent.value = localRow.value.enumValues;
      originalContent.value = localRow.value.enumValues;
   }
   else {
      editingContent.value = content;
      originalContent.value = content;
   }

   const obj = { [field]: true };
   isInlineEditor.value = { ...isInlineEditor.value, ...obj };

   if (field === 'default')
      isDefaultModal.value = true;
   else {
      await nextTick();
      (event as MouseEvent & { target: HTMLInputElement }).target.blur();
      await nextTick();
      document.querySelector<HTMLInputElement>('.editable-field').focus();
   }
};

const editOFF = () => {
   if (editingField.value === 'name')
      emit('rename-field', { old: localRow.value[editingField.value], new: editingContent.value });

   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   (localRow.value as any)[editingField.value] = editingContent.value;

   if (editingField.value === 'type' && editingContent.value !== originalContent.value) {
      localRow.value.numLength = null;
      localRow.value.numScale = null;
      localRow.value.charLength = null;
      localRow.value.datePrecision = null;
      localRow.value.enumValues = '';

      if (fieldType.value.length) {
         if (['integer', 'float', 'binary', 'spatial'].includes(fieldType.value.group)) localRow.value.numLength = 10;
         if (['string'].includes(fieldType.value.group)) localRow.value.charLength = 20;
         if (['time'].includes(fieldType.value.group)) localRow.value.datePrecision = 0;
         if (['other'].includes(fieldType.value.group)) localRow.value.enumValues = '\'valA\',\'valB\'';
      }

      if (!fieldType.value.collation)
         localRow.value.collation = null;

      if (!fieldType.value.unsigned)
         localRow.value.unsigned = false;

      if (!fieldType.value.zerofill)
         localRow.value.zerofill = false;
   }
   else if (editingField.value === 'default') {
      switch (defaultValue.value.type) {
         case 'autoincrement':
            localRow.value.autoIncrement = true;
            break;
         case 'noval':
            localRow.value.autoIncrement = false;
            localRow.value.default = null;
            break;
         case 'null':
            localRow.value.autoIncrement = false;
            localRow.value.default = 'NULL';
            break;
         case 'custom':
            localRow.value.autoIncrement = false;
            if (fieldType.value.group === 'string')
               localRow.value.default = `'${defaultValue.value.custom}'`;
            else
               localRow.value.default = defaultValue.value.custom;
            break;
         case 'expression':
            localRow.value.autoIncrement = false;
            localRow.value.default = defaultValue.value.expression;
            break;
      }

      localRow.value.onUpdate = defaultValue.value.onUpdate;
   }

   Object.keys(isInlineEditor.value).forEach(key => {
      isInlineEditor.value = { ...isInlineEditor.value, [key]: false };
   });

   editingContent.value = null;
   originalContent.value = null;
   editingField.value = null;
};

const hideDefaultModal = () => {
   isDefaultModal.value = false;
};

const applyEditModal = (updated: TableField) => {
   const oldName = localRow.value.name;
   Object.assign(localRow.value, updated);
   isEditModal.value = false;
   if (updated.name !== oldName)
      emit('rename-field', { old: oldName, new: updated.name });
};

watch(localRow, () => {
   initLocalRow();
});

watch(() => props.row, () => {
   localRow.value = props.row;
});

watch(() => props.indexes, () => {
   if (!canAutoincrement.value)
      localRow.value.autoIncrement = false;

   if (!isNullable.value)
      localRow.value.nullable = false;
});

onMounted(() => {
   localRow.value = props.row;
   initLocalRow();
   isInlineEditor.value.length = false;
});
</script>

<style lang="scss" scoped>
.editable-field {
  margin: 0;
  border: none;
  line-height: 1;
  width: 100%;
  position: absolute;
  left: 0;
  right: 0;
  max-height: 21px;
  border-radius: 3px;
  font-size: 0.7rem;
}

.td-ops {
  width: 110px;
  min-width: 110px;
  max-width: 110px;
}

.ops-btns {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
  opacity: 0;
  transition: opacity 0.15s;

  .tr:hover & {
    opacity: 1;
  }
}

.op-btn {
  padding: 0 3px;
  min-height: 0;
  height: 20px;
  line-height: 1;
  opacity: 0.55;

  &:hover {
    opacity: 1;
  }

  &.op-btn-edit:hover { color: #4a9eff; }
  &.op-btn-delete:hover { color: #e85600; }
}

.cell-readonly {
  opacity: 0.5;
  cursor: default;
}

.row-draggable {
  position: relative;
  text-align: right;
  padding-left: 28px;
  padding-right: 2px;
  cursor: grab;

  .row-draggable-icon {
    position: absolute;
    left: 0;
    font-size: 22px;
  }
}

.table-column-title {
  display: flex;
  align-items: center;
}

.form-checkbox {
  padding: 0;
  margin: 0;
  line-height: 1;
  min-height: auto;

  .form-icon {
    top: -0.65rem;
    left: calc(50% - 8px);
  }
}

.cell-content {
  display: block;
  padding: 0 0.2rem;
  min-height: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}

.field-key-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 2px 0.2rem 2px;
}

.field-chip {
  display: inline-block;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 0.58rem;
  font-weight: 700;
  line-height: 1.5;
  letter-spacing: 0.02em;

  &.chip-key-primary   { background: rgba(74, 158, 255, 0.18); color: #4a9eff; border: 1px solid rgba(74, 158, 255, 0.4); }
  &.chip-key-unique    { background: rgba(50, 182, 67, 0.18);  color: #32b643; border: 1px solid rgba(50, 182, 67, 0.4); }
  &.chip-key-index,
  &.chip-key-key       { background: rgba(224, 164, 12, 0.18); color: #e0a40c; border: 1px solid rgba(224, 164, 12, 0.4); }
  &.chip-key-fk        { background: rgba(155, 89, 182, 0.18); color: #9b59b6; border: 1px solid rgba(155, 89, 182, 0.4); }
  &.chip-null-active   { background: rgba(50, 182, 67, 0.18);  color: #32b643; border: 1px solid rgba(50, 182, 67, 0.4); }
  &.chip-null-inactive,
  &.chip-inactive      { background: rgba(232, 86, 0, 0.12); color: rgba(232, 86, 0, 0.75); border: 1px solid rgba(232, 86, 0, 0.3); }
  &.chip-active        { background: rgba(227, 105, 41, 0.18); color: #e36929; border: 1px solid rgba(227, 105, 41, 0.4); }

  &.field-chip-toggle {
    cursor: pointer;
    user-select: none;
    transition: background 0.15s, color 0.15s;

    &.chip-disabled {
      cursor: not-allowed;
    }

    &:hover:not(.chip-disabled) {
      filter: brightness(1.2);
    }
  }
}

.field-fkuq-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  justify-content: center;
  padding: 2px 0.2rem;
}
</style>
