<script setup lang="ts">
import { ComboboxItemIndicator, type ComboboxItemIndicatorProps, useForwardProps } from 'reka-ui';
import { type HTMLAttributes } from 'vue';

import BaseIcon from '@/components/BaseIcon.vue';
import { cn } from '@/lib/utils';

const props = defineProps<ComboboxItemIndicatorProps & { class?: HTMLAttributes['class'] }>();
const forwarded = useForwardProps(props);
</script>

<template>
   <ComboboxItemIndicator
      v-bind="forwarded"
      :class="cn('absolute right-2 flex h-3.5 w-3.5 items-center justify-center', props.class)"
   >
      <slot>
         <BaseIcon icon-name="mdiCheck" :size="14" />
      </slot>
   </ComboboxItemIndicator>
</template>
