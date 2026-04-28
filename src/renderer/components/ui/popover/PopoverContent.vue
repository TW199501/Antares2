<script setup lang="ts">
import { PopoverContent, type PopoverContentEmits, type PopoverContentProps, PopoverPortal, useForwardPropsEmits } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = withDefaults(defineProps<PopoverContentProps & { class?: HTMLAttributes['class'] }>(), {
   align: 'center',
   sideOffset: 4
});
const emits = defineEmits<PopoverContentEmits>();

const delegatedProps = computed(() => {
   const { class: _, ...rest } = props;
   return rest;
});
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
   <PopoverPortal>
      <PopoverContent
         v-bind="forwarded"
         :class="cn('z-50 w-72 rounded-md border border-border/60 bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95', props.class)"
      >
         <slot />
      </PopoverContent>
   </PopoverPortal>
</template>
