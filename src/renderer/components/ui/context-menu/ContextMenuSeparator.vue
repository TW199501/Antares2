<script setup lang="ts">
import { ContextMenuSeparator, type ContextMenuSeparatorProps, useForwardProps } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<ContextMenuSeparatorProps & { class?: HTMLAttributes['class'] }>();

const delegatedProps = computed(() => {
   const { class: _, ...rest } = props;
   return rest;
});
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
   <ContextMenuSeparator
      v-bind="forwarded"
      :class="cn('-mx-1 my-1 h-px bg-border', props.class)"
   />
</template>
