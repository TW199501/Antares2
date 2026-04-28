<template>
   <div class="relative">
      <div class="flex flex-col items-center justify-center gap-3 py-8">
         <BaseIcon
            icon-name="mdiInformationOutline"
            :size="48"
            class="text-muted-foreground"
         />
         <p class="text-[18px] font-semibold">
            v{{ appVersion }}
         </p>
      </div>
   </div>
</template>
<script setup lang="ts">
import BaseIcon from '@/components/BaseIcon.vue';
import { useApplicationStore } from '@/stores/application';

const { appVersion } = useApplicationStore();
</script>
<style lang="scss">
#changelog {
  h3 {
    font-size: 1rem;
  }

  li {
    margin-top: 0;
  }
}
</style>
