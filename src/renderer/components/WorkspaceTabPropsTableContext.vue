<template>
   <ContextMenuContent class="min-w-[200px]">
      <ContextMenuSub>
         <ContextMenuSubTrigger>
            <BaseIcon icon-name="mdiKeyPlus" :size="16" />
            <span>{{ t('database.createNewIndex') }}</span>
         </ContextMenuSubTrigger>
         <ContextMenuSubContent class="min-w-[160px]">
            <ContextMenuItem
               v-for="index in indexTypes"
               :key="index"
               :disabled="index === 'PRIMARY' && hasPrimary"
               @select="addNewIndex(index)"
            >
               <BaseIcon
                  class="column-key"
                  :class="`key-${index}`"
                  icon-name="mdiKey"
                  :rotate="45"
                  :size="16"
               />
               <span>{{ index }}</span>
            </ContextMenuItem>
         </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSub v-if="indexes.length">
         <ContextMenuSubTrigger>
            <BaseIcon icon-name="mdiKeyArrowRight" :size="16" />
            <span>{{ t('database.addToIndex') }}</span>
         </ContextMenuSubTrigger>
         <ContextMenuSubContent class="min-w-[160px]">
            <ContextMenuItem
               v-for="index in indexes"
               :key="index.name"
               :disabled="index.fields.includes(selectedField.name)"
               @select="addToIndex(index._antares_id)"
            >
               <BaseIcon
                  class="column-key"
                  :class="`key-${index.type}`"
                  icon-name="mdiKey"
                  :rotate="45"
                  :size="16"
               />
               <span>{{ index.name }}</span>
            </ContextMenuItem>
         </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuItem @select="duplicateField">
         <BaseIcon icon-name="mdiContentDuplicate" :size="16" />
         <span>{{ t('general.duplicate') }}</span>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
         class="text-destructive focus:text-destructive"
         @select="deleteField"
      >
         <BaseIcon icon-name="mdiDelete" :size="16" />
         <span>{{ t('database.deleteField') }}</span>
      </ContextMenuItem>
   </ContextMenuContent>
</template>

<script setup lang="ts">
import { TableIndex } from 'common/interfaces/antares';
import { computed, Prop } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import {
   ContextMenuContent,
   ContextMenuItem,
   ContextMenuSeparator,
   ContextMenuSub,
   ContextMenuSubContent,
   ContextMenuSubTrigger
} from '@/components/ui/context-menu';

const { t } = useI18n();

const props = defineProps({
   indexes: Array as Prop<TableIndex[]>,
   indexTypes: Array as Prop<string[]>,
   selectedField: Object
});

const emit = defineEmits<{
   'duplicate-selected': [];
   'delete-selected': [];
   'add-new-index': [payload: { field: string; index: string }];
   'add-to-index': [payload: { field: string; index: string }];
}>();

const hasPrimary = computed(() => props.indexes.some(index => index.type === 'PRIMARY'));

const duplicateField = () => {
   emit('duplicate-selected');
};

const deleteField = () => {
   emit('delete-selected');
};

const addNewIndex = (index: string) => {
   emit('add-new-index', { field: props.selectedField.name, index });
};

const addToIndex = (index: string) => {
   emit('add-to-index', { field: props.selectedField.name, index });
};
</script>
