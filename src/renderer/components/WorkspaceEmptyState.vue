<template>
   <div class="flex flex-col items-center justify-center mx-auto h-full w-full gap-4">
      <img :src="logos[applicationTheme]" width="200">
      <p class="text-[15px] font-semibold text-muted-foreground">
         {{ t('application.noOpenTabs') }}
      </p>
      <Button @click="emit('new-tab')">
         <BaseIcon
            icon-name="mdiTabPlus"
            :size="20"
            class="mr-2"
         />
         {{ t('application.openNewTab') }}
      </Button>
   </div>
</template>
<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import { Button } from '@/components/ui/button';
import { useSettingsStore } from '@/stores/settings';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const emit = defineEmits<{
   'new-tab': [];
}>();

const logos = {
   light: new URL('../images/logo-light.svg', import.meta.url).href,
   dark: new URL('../images/logo-dark.svg', import.meta.url).href
};

const settingsStore = useSettingsStore();
const workspacesStore = useWorkspacesStore();

const { applicationTheme } = storeToRefs(settingsStore);
const { getSelected: selectedWorkspace } = storeToRefs(workspacesStore);

const { getWorkspace, changeBreadcrumbs } = workspacesStore;

const workspace = computed(() => {
   return getWorkspace(selectedWorkspace.value);
});

changeBreadcrumbs({ schema: workspace.value.breadcrumbs.schema });
</script>
