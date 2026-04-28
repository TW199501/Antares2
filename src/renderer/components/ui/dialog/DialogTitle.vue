<script setup lang="ts">
import { DialogTitle, type DialogTitleProps, useForwardProps } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<DialogTitleProps & { class?: HTMLAttributes['class'] }>();
const delegatedProps = computed(() => {
   const { class: _, ...rest } = props;
   return rest;
});
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
   <DialogTitle v-bind="forwarded" :class="cn('text-lg font-semibold leading-none tracking-tight', props.class)">
      <slot />
   </DialogTitle>
</template>
