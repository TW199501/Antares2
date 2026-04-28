<script setup lang="ts">
import { ContextMenuItem, type ContextMenuItemEmits, type ContextMenuItemProps, useForwardPropsEmits } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<ContextMenuItemProps & { class?: HTMLAttributes['class']; inset?: boolean }>();
const emits = defineEmits<ContextMenuItemEmits>();

const delegatedProps = computed(() => {
   const { class: _, inset: __, ...rest } = props;
   return rest;
});
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
   <ContextMenuItem
      v-bind="forwarded"
      :class="cn('relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50', inset && 'pl-8', props.class)"
   >
      <slot />
   </ContextMenuItem>
</template>
