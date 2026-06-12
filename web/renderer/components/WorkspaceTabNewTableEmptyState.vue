<template>
   <div class="flex w-full items-center justify-center">
      <Card class="m-auto max-w-[400px] !p-8 text-center bg-card/90 border-border/60 shadow-none">
         <CardContent class="flex flex-col items-center gap-4 !p-0">
            <BaseIcon
               icon-name="mdiTablePlus"
               :size="48"
               class="opacity-40"
            />
            <CardTitle class="text-sm font-semibold">
               {{ t('database.thereAreNoTableFields') }}
            </CardTitle>
            <Button @click="emit('new-field')">
               <BaseIcon
                  class="mr-2"
                  icon-name="mdiPlaylistPlus"
                  :size="18"
               />
               {{ t('database.addNewField') }}
            </Button>
         </CardContent>
      </Card>
   </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';

const { t } = useI18n();
const emit = defineEmits<{
   'new-field': [];
}>();
</script>
