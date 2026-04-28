<script setup lang="ts">
import { ComboboxTrigger, type ComboboxTriggerProps, useForwardProps } from 'reka-ui';
import { type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<ComboboxTriggerProps & { class?: HTMLAttributes['class'] }>();
const forwarded = useForwardProps(props);
</script>

<template>
   <ComboboxTrigger
      v-bind="forwarded"
      :class="cn(
         'inline-flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-secondary px-3 py-2 text-[13px] ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
         props.class
      )"
   >
      <slot />
   </ComboboxTrigger>
</template>
