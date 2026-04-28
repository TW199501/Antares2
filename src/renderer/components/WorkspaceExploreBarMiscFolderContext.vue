<template>
   <ContextMenuContent class="min-w-[200px]">
      <ContextMenuItem
         v-if="props.selectedMisc === 'view'"
         @select="emit('open-create-view-tab')"
      >
         <BaseIcon icon-name="mdiTableCog" :size="16" />
         <span>{{ t('database.createNewView') }}</span>
      </ContextMenuItem>
      <ContextMenuItem
         v-if="props.selectedMisc === 'materializedView'"
         @select="emit('open-create-materializedView-tab')"
      >
         <BaseIcon icon-name="mdiTableCog" :size="16" />
         <span>{{ t('database.createNewMaterializedView') }}</span>
      </ContextMenuItem>
      <ContextMenuItem
         v-if="props.selectedMisc === 'trigger'"
         @select="emit('open-create-trigger-tab')"
      >
         <BaseIcon icon-name="mdiTableCog" :size="16" />
         <span>{{ t('database.createNewTrigger') }}</span>
      </ContextMenuItem>
      <ContextMenuItem
         v-if="['procedure', 'routine'].includes(props.selectedMisc)"
         @select="emit('open-create-routine-tab')"
      >
         <BaseIcon icon-name="mdiSyncCircle" :size="16" />
         <span>{{ t('database.createNewRoutine') }}</span>
      </ContextMenuItem>
      <ContextMenuItem
         v-if="props.selectedMisc === 'function'"
         @select="emit('open-create-function-tab')"
      >
         <BaseIcon icon-name="mdiArrowRightBoldBox" :size="16" />
         <span>{{ t('database.createNewFunction') }}</span>
      </ContextMenuItem>
      <ContextMenuItem
         v-if="props.selectedMisc === 'triggerFunction'"
         @select="emit('open-create-trigger-function-tab')"
      >
         <BaseIcon icon-name="mdiCogClockwise" :size="16" />
         <span>{{ t('database.createNewFunction') }}</span>
      </ContextMenuItem>
      <ContextMenuItem
         v-if="props.selectedMisc === 'scheduler'"
         @select="emit('open-create-scheduler-tab')"
      >
         <BaseIcon icon-name="mdiCalendarClock" :size="16" />
         <span>{{ t('database.createNewScheduler') }}</span>
      </ContextMenuItem>
   </ContextMenuContent>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import { ContextMenuContent, ContextMenuItem } from '@/components/ui/context-menu';

const { t } = useI18n();

const props = defineProps({
   selectedMisc: String,
   selectedSchema: String
});

const emit = defineEmits<{
   'open-create-view-tab': [];
   'open-create-materializedView-tab': [];
   'open-create-trigger-tab': [];
   'open-create-routine-tab': [];
   'open-create-function-tab': [];
   'open-create-trigger-function-tab': [];
   'open-create-scheduler-tab': [];
}>();
</script>
