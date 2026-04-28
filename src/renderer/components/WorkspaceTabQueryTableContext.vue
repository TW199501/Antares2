<template>
   <ContextMenuContent class="min-w-[200px]">
      <ContextMenuSub>
         <ContextMenuSubTrigger>
            <BaseIcon icon-name="mdiContentCopy" :size="16" />
            <span>{{ t('general.copy') }}</span>
         </ContextMenuSubTrigger>
         <ContextMenuSubContent class="min-w-[220px]">
            <ContextMenuItem
               v-if="selectedRows.length === 1"
               @select="copyCell"
            >
               <BaseIcon
                  icon-name="mdiNumeric0"
                  :rotate="90"
                  :size="16"
               />
               <span>{{ t('database.cell', 1) }}</span>
            </ContextMenuItem>
            <ContextMenuItem @select="copyRow('html')">
               <BaseIcon icon-name="mdiTableRow" :size="16" />
               <span>{{ t('database.row', selectedRows.length) }} ({{ t('database.table') }})</span>
            </ContextMenuItem>
            <ContextMenuItem @select="copyRow('json')">
               <BaseIcon icon-name="mdiTableRow" :size="16" />
               <span>{{ t('database.row', selectedRows.length) }} (JSON)</span>
            </ContextMenuItem>
            <ContextMenuItem @select="copyRow('csv')">
               <BaseIcon icon-name="mdiTableRow" :size="16" />
               <span>{{ t('database.row', selectedRows.length) }} (CSV)</span>
            </ContextMenuItem>
            <ContextMenuItem @select="copyRow('php')">
               <BaseIcon icon-name="mdiTableRow" :size="16" />
               <span>{{ t('database.row', selectedRows.length) }} (PHP)</span>
            </ContextMenuItem>
            <ContextMenuItem @select="copyRow('sql')">
               <BaseIcon icon-name="mdiTableRow" :size="16" />
               <span>{{ t('database.row', selectedRows.length) }} (SQL INSERT)</span>
            </ContextMenuItem>
         </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuItem
         v-if="selectedRows.length === 1 && selectedCell.isEditable && mode === 'table'"
         @select="duplicateRow"
      >
         <BaseIcon icon-name="mdiContentDuplicate" :size="16" />
         <span>{{ t('general.duplicate') }}</span>
      </ContextMenuItem>
      <ContextMenuSub
         v-if="selectedRows.length === 1 && selectedCell.isEditable && mode === 'table' && fakerGroup"
      >
         <ContextMenuSubTrigger>
            <BaseIcon icon-name="mdiAutoFix" :size="16" />
            <span>{{ t('database.fillCell') }}</span>
         </ContextMenuSubTrigger>
         <ContextMenuSubContent class="min-w-[180px]">
            <ContextMenuItem
               v-for="method in fakerMethods[fakerGroup]"
               :key="method.name"
               @select="fillCell(method)"
            >
               <span>{{ t(`faker.${method.name}`) }}</span>
            </ContextMenuItem>
         </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuItem
         v-if="selectedRows.length === 1 && selectedCell.isEditable"
         @select="setNull"
      >
         <BaseIcon icon-name="mdiNull" :size="16" />
         <span>{{ t('database.setNull') }}</span>
      </ContextMenuItem>
      <ContextMenuSeparator v-if="selectedCell.isEditable" />
      <ContextMenuItem
         v-if="selectedCell.isEditable"
         class="text-destructive focus:text-destructive"
         @select="showConfirmModal"
      >
         <BaseIcon icon-name="mdiDelete" :size="16" />
         <span>{{ t('database.deleteRows', selectedRows.length) }}</span>
      </ContextMenuItem>
   </ContextMenuContent>
</template>

<script setup lang="ts">
import { DATE, DATETIME, FLOAT, LONG_TEXT, NUMBER, TEXT, TIME, UUID } from 'common/fieldTypes';
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
   selectedRows: Array,
   selectedCell: Object,
   mode: String as Prop<'table' | 'query'>
});

const emit = defineEmits<{
   'show-delete-modal': [e?: any];
   'set-null': [];
   'copy-cell': [];
   'copy-row': [format: string];
   'duplicate-row': [];
   'fill-cell': [method: { name: string; group: string; type: string | boolean }];
}>();

const fakerMethods = {
   string: [
      { name: 'word', group: 'lorem' },
      { name: 'text', group: 'lorem' },
      { name: 'firstName', group: 'name' },
      { name: 'lastName', group: 'name' },
      { name: 'jobTitle', group: 'name' },
      { name: 'phoneNumber', group: 'phone' },
      { name: 'exampleEmail', group: 'internet' },
      { name: 'ip', group: 'internet' },
      { name: 'domainName', group: 'internet' },
      { name: 'color', group: 'internet' },
      { name: 'uuid', group: 'random' }
   ],
   number: [
      { name: 'number', group: 'random' }
   ],
   float: [
      { name: 'float', group: 'random' },
      { name: 'amount', group: 'finance' }
   ],
   datetime: [
      { name: 'now', group: 'date' },
      { name: 'past', group: 'date' },
      { name: 'future', group: 'date' }
   ],
   time: [
      { name: 'now', group: 'time' },
      { name: 'random', group: 'time' }
   ],
   uuid: [
      { name: 'uuid', group: 'random' }
   ]
};

const fakerGroup = computed(() => {
   if ([...TEXT, ...LONG_TEXT].includes(props.selectedCell.type))
      return 'string';
   else if (NUMBER.includes(props.selectedCell.type))
      return 'number';
   else if (FLOAT.includes(props.selectedCell.type))
      return 'float';
   else if ([...DATE, ...DATETIME].includes(props.selectedCell.type))
      return 'datetime';
   else if (TIME.includes(props.selectedCell.type))
      return 'time';
   else if (UUID.includes(props.selectedCell.type))
      return 'uuid';
   else
      return false;
});

const showConfirmModal = () => {
   emit('show-delete-modal');
};

const setNull = () => {
   emit('set-null');
};

const copyCell = () => {
   emit('copy-cell');
};

const copyRow = (format: string) => {
   emit('copy-row', format);
};

const duplicateRow = () => {
   emit('duplicate-row');
};

const fillCell = (method: {name: string; group: string}) => {
   emit('fill-cell', { ...method, type: fakerGroup.value });
};
</script>
