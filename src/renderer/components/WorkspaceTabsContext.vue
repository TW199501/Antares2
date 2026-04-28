<template>
   <ContextMenuContent class="min-w-[200px]">
      <ContextMenuItem @select="closeAllTabs">
         <BaseIcon icon-name="mdiAsterisk" :size="16" />
         <span>{{ t('application.closeAllTabs') }}</span>
      </ContextMenuItem>
      <ContextMenuItem @select="closeOtherTabs">
         <BaseIcon icon-name="mdiNotEqual" :size="16" />
         <span>{{ t('application.closeOtherTabs') }}</span>
      </ContextMenuItem>
      <ContextMenuItem @select="closeLeftTabs">
         <BaseIcon icon-name="mdiLessThan" :size="16" />
         <span>{{ t('application.closeTabsToLeft') }}</span>
      </ContextMenuItem>
      <ContextMenuItem @select="closeRightTabs">
         <BaseIcon icon-name="mdiGreaterThan" :size="16" />
         <span>{{ t('application.closeTabsToRight') }}</span>
      </ContextMenuItem>
   </ContextMenuContent>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import { ContextMenuContent, ContextMenuItem } from '@/components/ui/context-menu';

const { t } = useI18n();

defineProps({
   selectedTab: Object
});

const emit = defineEmits<{
   'close-all-tabs': [];
   'close-other-tabs': [];
   'close-to-left': [];
   'close-to-right': [];
}>();

const closeAllTabs = () => {
   emit('close-all-tabs');
};

const closeLeftTabs = () => {
   emit('close-to-left');
};

const closeRightTabs = () => {
   emit('close-to-right');
};

const closeOtherTabs = () => {
   emit('close-other-tabs');
};
</script>
