<template>
   <div v-show="isSelected" class="flex flex-col h-full w-full">
      <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60 bg-muted/30">
         <div class="flex items-center gap-2 flex-wrap">
            <slot name="toolbar" />
         </div>
         <div
            v-if="schema"
            class="flex items-center gap-1 text-[12px] text-muted-foreground"
            :title="schemaTitle"
         >
            <BaseIcon icon-name="mdiDatabase" :size="14" />
            <b class="font-semibold">{{ schema }}</b>
         </div>
      </div>
      <div class="px-3 pt-3 pb-2 flex flex-wrap items-end gap-x-4 gap-y-2">
         <slot name="metadata" />
      </div>
      <div class="flex-1 min-h-0 relative">
         <slot name="content" />
      </div>
   </div>
</template>

<script setup lang="ts">
import BaseIcon from '@/components/BaseIcon.vue';

defineProps({
   isSelected: {
      type: Boolean,
      default: true
   },
   schema: {
      type: String,
      default: ''
   },
   schemaTitle: {
      type: String,
      default: ''
   }
});
</script>
