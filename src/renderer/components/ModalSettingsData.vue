<template>
   <div class="px-2 py-2 space-y-6">
      <Card class="!shadow-none">
         <CardHeader class="!p-4 !pb-2">
            <CardTitle class="text-sm font-semibold uppercase tracking-wide">
               {{ t('application.exportData') }}
            </CardTitle>
            <CardDescription class="text-xs">
               {{ t('application.exportDataExplanation') }}
            </CardDescription>
         </CardHeader>
         <CardContent class="!p-4 !pt-2 flex justify-end">
            <Button class="inline-flex items-center gap-2" @click="isExportModal=true">
               <BaseIcon icon-name="mdiTrayArrowUp" :size="20" />
               <span>{{ t('application.exportData') }}</span>
            </Button>
         </CardContent>
      </Card>

      <Card class="!shadow-none">
         <CardHeader class="!p-4 !pb-2">
            <CardTitle class="text-sm font-semibold uppercase tracking-wide">
               {{ t('application.importData') }}
            </CardTitle>
            <CardDescription class="text-xs">
               {{ t('application.importDataExplanation') }}
            </CardDescription>
         </CardHeader>
         <CardContent class="!p-4 !pt-2 flex justify-end">
            <Button
               variant="secondary"
               class="inline-flex items-center gap-2"
               @click="isImportModal=true"
            >
               <BaseIcon icon-name="mdiTrayArrowDown" :size="20" />
               <span>{{ t('application.importData') }}</span>
            </Button>
         </CardContent>
      </Card>

      <ModalSettingsDataExport
         v-if="isExportModal"
         @close="isExportModal = false"
      />
      <ModalSettingsDataImport
         v-if="isImportModal"
         @close="isImportModal = false"
      />
   </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import ModalSettingsDataExport from '@/components/ModalSettingsDataExport.vue';
import ModalSettingsDataImport from '@/components/ModalSettingsDataImport.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const { t } = useI18n();

const isExportModal = ref(false);
const isImportModal = ref(false);

</script>
