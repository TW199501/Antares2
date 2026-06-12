<script setup lang="ts">
import { ContextMenuPortal, ContextMenuSubContent, type ContextMenuSubContentEmits, type ContextMenuSubContentProps, useForwardPropsEmits } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<ContextMenuSubContentProps & { class?: HTMLAttributes['class'] }>();
const emits = defineEmits<ContextMenuSubContentEmits>();

const delegatedProps = computed(() => {
   const { class: _, ...rest } = props;
   return rest;
});
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
   <ContextMenuPortal>
      <ContextMenuSubContent
         v-bind="forwarded"
         :class="cn('z-50 min-w-[8rem] overflow-hidden rounded-md border border-border/60 bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95', props.class)"
      >
         <slot />
      </ContextMenuSubContent>
   </ContextMenuPortal>
</template>
