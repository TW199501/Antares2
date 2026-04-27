<script setup lang="ts">
import { ComboboxLabel, type ComboboxLabelProps, useForwardProps } from 'reka-ui';
import { type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<ComboboxLabelProps & { class?: HTMLAttributes['class'] }>();
const forwarded = useForwardProps(props);
</script>

<template>
   <ComboboxLabel
      v-bind="forwarded"
      :class="cn('px-2 py-1.5 text-[12px] font-semibold text-muted-foreground', props.class)"
   >
      <slot />
   </ComboboxLabel>
</template>
