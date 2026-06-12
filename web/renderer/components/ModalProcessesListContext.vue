<template>
   <ContextMenuContent class="min-w-[180px]">
      <ContextMenuSub v-if="props.selectedRow">
         <ContextMenuSubTrigger>
            <BaseIcon icon-name="mdiContentCopy" :size="16" />
            <span>{{ t('general.copy') }}</span>
         </ContextMenuSubTrigger>
         <ContextMenuSubContent class="min-w-[160px]">
            <ContextMenuItem @select="copyCell">
               <BaseIcon
                  icon-name="mdiNumeric0"
                  :rotate="90"
                  :size="16"
               />
               <span>{{ t('database.cell', 1) }}</span>
            </ContextMenuItem>
            <ContextMenuItem @select="copyRow">
               <BaseIcon icon-name="mdiTableRow" :size="16" />
               <span>{{ t('database.row', 1) }}</span>
            </ContextMenuItem>
         </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator v-if="props.selectedRow" />
      <ContextMenuItem
         v-if="props.selectedRow"
         class="text-destructive focus:text-destructive"
         @select="killProcess"
      >
         <BaseIcon icon-name="mdiCloseCircleOutline" :size="16" />
         <span>{{ t('database.killProcess') }}</span>
      </ContextMenuItem>
   </ContextMenuContent>
</template>

<script setup lang="ts">
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
   selectedRow: Number,
   selectedCell: Object
});

const emit = defineEmits<{
   'copy-cell': [];
   'copy-row': [];
   'kill-process': [];
}>();

const copyCell = () => {
   emit('copy-cell');
};

const copyRow = () => {
   emit('copy-row');
};

const killProcess = () => {
   emit('kill-process');
};
</script>
