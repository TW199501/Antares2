<template>
   <div class="tr" @contextmenu.prevent="!editingField ? emit('contextmenu', $event, localRow._antares_id) : null">
      <!-- 序號 (column ordinal position) -->
      <div class="td p-0 text-center" tabindex="0">
         <span class="cell-content text-center text-sm">{{ localRow.order }}</span>
      </div>
      <!-- 字段名 -->
      <div class="td p-0" tabindex="0">
         <span
            v-if="!isInlineEditor.name"
            class="cell-content text-sm"
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
            class="editable-field h-[28px] w-full rounded-md border border-input bg-background px-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            @blur="editOFF"
         >
      </div>
      <!-- 数据类型 -->
      <div class="td p-0 text-uppercase" tabindex="0">
         <span
            v-if="!isInlineEditor.type"
            class="cell-content text-left text-sm"
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
            class="editable-field pl-1 pr-4 text-uppercase !h-[28px] !text-sm"
            @blur="editOFF"
         />
      </div>
      <!-- 主键 PK (read-only chip) -->
      <div class="td p-0 text-center" tabindex="0">
         <span
            class="inline-flex items-center justify-center h-[20px] min-w-[28px] px-1.5 rounded text-[11px] font-medium"
            :class="isPrimaryKey ? 'bg-blue-100 text-blue-700' : 'bg-orange-50 text-orange-600'"
         >{{ isPrimaryKey ? t('general.yes') : t('general.no') }}</span>
      </div>
      <!-- 自增 AI (toggle chip, conditional) -->
      <div
         v-if="customizations.autoIncrement"
         class="td p-0 text-center"
         tabindex="0"
      >
         <span
            class="inline-flex items-center justify-center h-[20px] min-w-[28px] px-1.5 rounded text-[11px] font-medium select-none transition-colors"
            :class="[
               localRow.autoIncrement ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-50 text-orange-600',
               !canAutoincrement ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            ]"
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
            class="inline-flex items-center justify-center h-[20px] min-w-[28px] px-1.5 rounded text-[11px] font-medium select-none transition-colors"
            :class="[
               localRow.nullable ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-50 text-orange-600',
               !isNullable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            ]"
            @click="isNullable && (localRow.nullable = !localRow.nullable)"
         >{{ localRow.nullable ? t('general.yes') : t('general.no') }}</span>
      </div>
      <!-- 长度 -->
      <div class="td p-0 type-int text-center" tabindex="0">
         <span
            v-if="!isInlineEditor.length"
            class="cell-content text-center text-sm"
            :class="!fieldType?.length ? 'cell-readonly text-muted-foreground cursor-not-allowed' : ''"
            @dblclick="fieldType?.length ? editON($event, localLength, 'length') : null"
         >{{ localRow.enumValues || localLength || '-' }}</span>
         <template v-if="fieldType?.length && isInlineEditor.length">
            <input
               v-if="localRow.enumValues"
               ref="editField"
               v-model="editingContent"
               type="text"
               autofocus
               class="editable-field h-[28px] w-full rounded-md border border-input bg-background px-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
               @blur="editOFF"
            >
            <input
               v-else
               ref="editField"
               v-model="editingContent"
               type="number"
               autofocus
               class="editable-field h-[28px] w-full rounded-md border border-input bg-background px-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
               @blur="editOFF"
            >
         </template>
      </div>
      <!-- 精度 (scale) -->
      <div class="td p-0 type-int text-center" tabindex="0">
         <template v-if="fieldType?.scale">
            <span
               v-if="!isInlineEditor.numScale"
               class="cell-content text-center text-sm"
               @dblclick="editON($event, localRow.numScale, 'numScale')"
            >{{ localRow.numScale }}</span>
            <input
               v-else
               ref="editField"
               v-model="editingContent"
               type="number"
               autofocus
               class="editable-field h-[28px] w-full rounded-md border border-input bg-background px-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
               @blur="editOFF"
            >
         </template>
      </div>
      <!-- FK / UQ (read-only chips) -->
      <div class="td p-0 text-center" tabindex="0">
         <div class="flex flex-wrap gap-[2px] justify-center px-[0.2rem] py-[2px]">
            <span
               v-for="(idx, i) in uqIndexes"
               :key="`uq-${i}`"
               :title="idx.type"
               class="inline-flex items-center justify-center h-[20px] min-w-[28px] px-1.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-700"
            >UQ</span>
            <span
               v-for="foreign in foreigns"
               :key="foreign"
               :title="foreign"
               class="inline-flex items-center justify-center h-[20px] min-w-[28px] px-1.5 rounded text-[11px] font-medium bg-orange-100 text-orange-700"
            >FK</span>
         </div>
      </div>
      <!-- 默认值 -->
      <div class="td p-0" tabindex="0">
         <span class="cell-content text-sm" @dblclick="editON($event, localRow.default, 'default')">
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
            class="cell-content text-sm"
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
            class="editable-field h-[28px] w-full rounded-md border border-input bg-background px-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            @blur="editOFF"
         >
      </div>
      <!-- 操作 -->
      <div class="td p-0 td-ops" tabindex="0">
         <div class="ops-btns">
            <Button
               variant="ghost"
               size="icon"
               class="!h-[24px] !w-[24px] opacity-55 hover:opacity-100"
               :title="t('general.moveUp')"
               @click.stop="emit('move-up', localRow._antares_id)"
            >
               <BaseIcon icon-name="mdiArrowUp" :size="14" />
            </Button>
            <Button
               variant="ghost"
               size="icon"
               class="!h-[24px] !w-[24px] opacity-55 hover:opacity-100"
               :title="t('general.moveDown')"
               @click.stop="emit('move-down', localRow._antares_id)"
            >
               <BaseIcon icon-name="mdiArrowDown" :size="14" />
            </Button>
            <Button
               variant="ghost"
               size="icon"
               class="!h-[24px] !w-[24px] opacity-55 hover:opacity-100 hover:!text-[#4a9eff]"
               :title="t('database.editField')"
               @click.stop="emit('edit-field', localRow._antares_id)"
            >
               <BaseIcon icon-name="mdiPencilOutline" :size="14" />
            </Button>
            <Button
               variant="ghost"
               size="icon"
               class="!h-[24px] !w-[24px] opacity-55 hover:opacity-100 hover:!text-[#e85600]"
               :title="t('general.delete')"
               @click.stop="emit('remove-field-row', localRow._antares_id)"
            >
               <BaseIcon icon-name="mdiDeleteOutline" :size="14" />
            </Button>
         </div>
      </div>
      <ConfirmModal
         v-if="isDefaultModal"
         :confirm-text="t('general.confirm')"
         size="400"
         @confirm="editOFF"
         @hide="hideDefaultModal"
      >
         <template #header>
            <div class="flex items-center">
               <BaseIcon
                  class="mr-1"
                  icon-name="mdiPlaylistEdit"
                  :size="22"
               />
               <span class="cut-text">{{ t('database.default') }} "{{ row.name }}"</span>
            </div>
         </template>
         <template #body>
            <form class="flex flex-col gap-2">
               <!-- noval -->
               <label class="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                     v-model="defaultValue.type"
                     type="radio"
                     name="default"
                     value="noval"
                     class="accent-primary"
                  >
                  <span>No value</span>
               </label>
               <!-- custom value -->
               <div class="grid grid-cols-[140px_1fr] items-center gap-2">
                  <label class="flex items-center gap-2 cursor-pointer text-sm">
                     <input
                        v-model="defaultValue.type"
                        type="radio"
                        name="default"
                        value="custom"
                        class="accent-primary"
                     >
                     <span>{{ t('database.customValue') }}</span>
                  </label>
                  <Input
                     v-model="defaultValue.custom"
                     :disabled="defaultValue.type !== 'custom'"
                     type="text"
                     class="!h-[32px] !text-sm"
                  />
               </div>
               <!-- NULL -->
               <label v-if="customizations.nullable" class="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                     v-model="defaultValue.type"
                     type="radio"
                     name="default"
                     value="null"
                     class="accent-primary"
                  >
                  <span>NULL</span>
               </label>
               <!-- AUTO_INCREMENT -->
               <label
                  v-if="customizations.autoIncrement"
                  class="flex items-center gap-2 cursor-pointer text-sm"
                  :class="{ 'opacity-50 cursor-not-allowed': !canAutoincrement }"
               >
                  <input
                     v-model="defaultValue.type"
                     :disabled="!canAutoincrement"
                     type="radio"
                     name="default"
                     value="autoincrement"
                     class="accent-primary"
                  >
                  <span>AUTO_INCREMENT</span>
               </label>
               <!-- expression -->
               <div class="grid grid-cols-[140px_1fr] items-center gap-2">
                  <label class="flex items-center gap-2 cursor-pointer text-sm">
                     <input
                        v-model="defaultValue.type"
                        type="radio"
                        name="default"
                        value="expression"
                        class="accent-primary"
                     >
                     <span>{{ t('database.expression') }}</span>
                  </label>
                  <Input
                     v-model="defaultValue.expression"
                     :disabled="defaultValue.type !== 'expression'"
                     type="text"
                     class="!h-[32px] !text-sm"
                  />
               </div>
               <!-- ON UPDATE -->
               <div v-if="customizations.onUpdate" class="grid grid-cols-[140px_1fr] items-center gap-2">
                  <Label class="!text-sm !text-muted-foreground !font-normal !m-0">
                     {{ t('database.onUpdate') }}
                  </Label>
                  <Input
                     v-model="defaultValue.onUpdate"
                     type="text"
                     class="!h-[32px] !text-sm"
                  />
               </div>
            </form>
         </template>
      </ConfirmModal>
   </div>
</template>

<script setup lang="ts">
import { TableField, TableIndex, TypesGroup } from 'common/interfaces/antares';
import { computed, nextTick, onMounted, Prop, PropType, Ref, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '@/components/BaseConfirmModal.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
   'edit-field': [id: string];
}>();

const localRow: Ref<TableField> = ref({} as TableField);
const isInlineEditor: Ref<TableField> = ref({} as TableField);
const isDefaultModal = ref(false);
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
// Inline-edit input overlays the cell while editing.
// Visual styling (height/font/border/radius) now lives on the element via Tailwind utilities.
.editable-field {
  position: absolute;
  left: 0;
  right: 0;
  margin: 0;
  width: 100%;
}

.td-ops {
  width: 110px;
  min-width: 110px;
  max-width: 110px;
  position: sticky;
  right: 0;
  z-index: 2;
  background: var(--background);
}

.tr:hover .td-ops {
  background: var(--accent);
}

.ops-btns {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
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

.cell-content {
  display: block;
  padding: 0 0.2rem;
  min-height: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}
</style>
