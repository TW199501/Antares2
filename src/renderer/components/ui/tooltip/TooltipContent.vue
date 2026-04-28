<script setup lang="ts">
import { TooltipContent, type TooltipContentEmits, type TooltipContentProps, TooltipPortal, useForwardPropsEmits } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = withDefaults(defineProps<TooltipContentProps & { class?: HTMLAttributes['class'] }>(), {
   sideOffset: 4
});
const emits = defineEmits<TooltipContentEmits>();

const delegatedProps = computed(() => {
   const { class: _, ...rest } = props;
   return rest;
});
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
   <TooltipPortal>
      <TooltipContent
         v-bind="forwarded"
         :class="cn('z-50 overflow-hidden rounded-md border border-border/60 bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95', props.class)"
      >
         <slot />
      </TooltipContent>
   </TooltipPortal>
</template>
