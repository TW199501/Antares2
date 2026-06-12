<script setup lang="ts">
import { ComboboxEmpty, type ComboboxEmptyProps, useForwardProps } from 'reka-ui';
import { type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<ComboboxEmptyProps & { class?: HTMLAttributes['class'] }>();
const forwarded = useForwardProps(props);
</script>

<template>
   <ComboboxEmpty
      v-bind="forwarded"
      :class="cn('py-6 text-center text-[13px] text-muted-foreground', props.class)"
   >
      <slot />
   </ComboboxEmpty>
</template>
