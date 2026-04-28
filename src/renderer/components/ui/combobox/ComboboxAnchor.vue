<script setup lang="ts">
import { ComboboxAnchor, type ComboboxAnchorProps, useForwardProps } from 'reka-ui';
import { type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<ComboboxAnchorProps & { class?: HTMLAttributes['class'] }>();
const forwarded = useForwardProps(props);
</script>

<template>
   <ComboboxAnchor
      v-bind="forwarded"
      :class="cn('relative', props.class)"
   >
      <slot />
   </ComboboxAnchor>
</template>
