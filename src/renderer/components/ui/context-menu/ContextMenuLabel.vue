<script setup lang="ts">
import { ContextMenuLabel, type ContextMenuLabelProps, useForwardProps } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<ContextMenuLabelProps & { class?: HTMLAttributes['class']; inset?: boolean }>();

const delegatedProps = computed(() => {
   const { class: _, inset: __, ...rest } = props;
   return rest;
});
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
   <ContextMenuLabel
      v-bind="forwarded"
      :class="cn('px-2 py-1.5 text-xs font-semibold text-muted-foreground', inset && 'pl-8', props.class)"
   >
      <slot />
   </ContextMenuLabel>
</template>
