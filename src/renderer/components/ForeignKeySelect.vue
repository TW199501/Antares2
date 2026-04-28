<template>
   <BaseSelect
      ref="editField"
      :options="foreigns"
      :class="['foreign-key-select', {'small-select': size === 'small'}]"
      :model-value="currentValue"
      dropdown-class="select-sm"
      @update:model-value="onChange"
      @blur="emit('blur')"
   />
</template>

<script setup lang="ts">
import { LONG_TEXT, TEXT } from 'common/fieldTypes';
import { TableField } from 'common/interfaces/antares';
import { storeToRefs } from 'pinia';
import { computed, Ref, ref, watch } from 'vue';

import BaseSelect from '@/components/BaseSelect.vue';
import { toast } from '@/components/ui/sonner';
import { useFilters } from '@/composables/useFilters';
import Tables from '@/ipc-api/Tables';
import { useWorkspacesStore } from '@/stores/workspaces';

const props = defineProps({
   modelValue: [String, Number],
   keyUsage: Object,
   size: {
      type: String,
      default: ''
   }
});

const emit = defineEmits<{
   'update:modelValue': [value: string];
   'blur': [];
}>();

const workspacesStore = useWorkspacesStore();
const { cutText } = useFilters();

const { getSelected: selectedWorkspace } = storeToRefs(workspacesStore);

const editField: Ref<HTMLSelectElement> = ref(null);
const foreignList = ref([]);
const currentValue = ref(props.modelValue);

const isValidDefault = computed(() => {
   if (!foreignList.value.length) return true;
   if (props.modelValue === null) return false;
   return foreignList.value.some(foreign => foreign.foreign_column.toString() === props.modelValue?.toString());
});

const foreigns = computed(() => {
   const list = [];
   if (!isValidDefault.value)
      list.push({ value: props.modelValue, label: props.modelValue === null ? 'NULL' : props.modelValue });
   for (const row of foreignList.value)
      list.push({ value: row.foreign_column, label: `${row.foreign_column} ${cutText('foreign_description' in row ? ` - ${row.foreign_description}` : '', 15)}` });
   return list;
});

const onChange = (val: any) => {
   currentValue.value = val;
   emit('update:modelValue', val);
};

watch(() => props.modelValue, () => {
   currentValue.value = props.modelValue;
});

let foreignDesc: string | false;
const params = {
   uid: selectedWorkspace.value,
   schema: props.keyUsage.refSchema,
   table: props.keyUsage.refTable
};

(async () => {
   try { // Field data
      const { status, response } = await Tables.getTableColumns(params);

      if (status === 'success') {
         const textField = (response as TableField[]).find((field: {type: string; name: string}) => [...TEXT, ...LONG_TEXT].includes(field.type) && field.name !== props.keyUsage.refField);
         foreignDesc = textField ? textField.name : false;
      }
      else
         toast.error(response);
   }
   catch (err) {
      toast.error(err.stack);
   }

   try { // Foregn list
      const { status, response } = await Tables.getForeignList({
         ...params,
         column: props.keyUsage.refField,
         description: foreignDesc
      });

      if (status === 'success')
         foreignList.value = response.rows;
      else
         toast.error(response);
   }
   catch (err) {
      toast.error(err.stack);
   }
})();
</script>
