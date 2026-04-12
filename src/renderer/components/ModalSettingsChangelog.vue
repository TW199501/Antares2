<template>
   <div class="p-relative">
      <div class="empty">
         <div class="empty-icon">
            <BaseIcon icon-name="mdiInformationOutline" :size="48" />
         </div>
         <p class="empty-title h5">
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
