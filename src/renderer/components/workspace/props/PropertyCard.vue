<template>
   <div class="flex flex-col gap-1 min-w-0">
      <Label
         v-if="label"
         :for="forId"
         class="!text-[12px] !text-muted-foreground !font-normal !m-0 whitespace-nowrap"
      >
         {{ label }}
      </Label>
      <slot />
   </div>
</template>

<script setup lang="ts">
import { Label } from '@/components/ui/label';

defineProps({
   label: {
      type: String,
      default: ''
   },
   forId: {
      type: String,
      default: ''
   }
});
</script>
