<script setup lang="ts">
import { ComboboxGroup, type ComboboxGroupProps, useForwardProps } from 'reka-ui';
import { type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<ComboboxGroupProps & { class?: HTMLAttributes['class'] }>();
const forwarded = useForwardProps(props);
</script>

<template>
   <ComboboxGroup
      v-bind="forwarded"
      :class="cn('overflow-hidden p-1 text-foreground', props.class)"
   >
      <slot />
   </ComboboxGroup>
</template>
