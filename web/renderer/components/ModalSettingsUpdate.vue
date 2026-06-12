<template>
   <div class="flex flex-col items-center gap-3 py-8 text-center">
      <BaseIcon icon-name="mdiCloudDownload" :size="48" />
      <p class="text-[15px] font-semibold">
         {{ updateMessage }}
      </p>
      <div v-if="updateStatus === 'downloading'" class="w-full max-w-[320px]">
         <progress
            class="w-full h-2 rounded bg-secondary overflow-hidden"
            :value="downloadPercentage"
            max="100"
         />
         <p class="text-xs text-muted-foreground mt-1">
            {{ downloadPercentage }}%
         </p>
      </div>
      <div v-if="updateStatus === 'available'" class="w-full max-w-[320px]">
         <progress class="w-full h-2 rounded bg-secondary overflow-hidden" max="100" />
      </div>
      <div class="mt-2">
         <Button
            v-if="['noupdate', 'checking', 'nocheck'].includes(updateStatus)"
            :disabled="updateStatus === 'checking'"
            @click="checkForUpdates"
         >
            {{ t('application.checkForUpdates') }}
         </Button>
         <Button
            v-else-if="updateStatus === 'downloaded'"
            @click="restartToUpdate"
         >
            {{ t('application.restartToInstall') }}
         </Button>
         <Button
            v-else-if="updateStatus === 'link'"
            @click="openOutside('https://github.com/TW199501/Antares2/releases/latest')"
         >
            {{ t('application.goToDownloadPage') }}
         </Button>
      </div>
      <div class="flex items-center gap-2 mt-4">
         <Switch
            id="allow-prerelease"
            :checked="allowPrerelease"
            @update:checked="toggleAllowPrerelease"
         />
         <Label for="allow-prerelease" class="text-[13px]">{{ t('application.includeBetaUpdates') }}</Label>
      </div>
   </div>
</template>

<script setup lang="ts">
import { open } from '@tauri-apps/plugin-shell';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useApplicationStore } from '@/stores/application';
import { useSettingsStore } from '@/stores/settings';

const { t } = useI18n();

const applicationStore = useApplicationStore();
const settingsStore = useSettingsStore();

const {
   updateStatus,
   getDownloadProgress: downloadPercentage
} = storeToRefs(applicationStore);
const { allowPrerelease } = storeToRefs(settingsStore);

const { changeAllowPrerelease } = settingsStore;

const updateMessage = computed(() => {
   switch (updateStatus.value) {
      case 'noupdate':
         return t('application.noUpdatesAvailable');
      case 'checking':
         return t('application.checkingForUpdate');
      case 'nocheck':
         return t('application.checkFailure');
      case 'available':
         return t('application.updateAvailable');
      case 'downloading':
         return t('application.downloadingUpdate');
      case 'downloaded':
         return t('application.updateDownloaded');
      case 'link':
         return t('application.updateAvailable');
      default:
         return updateStatus.value;
   }
});

const openOutside = async (link: string) => {
   await open(link);
};

const { checkForUpdates, installUpdate } = applicationStore;

const restartToUpdate = () => {
   installUpdate();
};

const toggleAllowPrerelease = (val: boolean) => {
   changeAllowPrerelease(val);
};
</script>
