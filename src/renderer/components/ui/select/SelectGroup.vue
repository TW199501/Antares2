<script setup lang="ts">
import { SelectGroup, type SelectGroupProps, useForwardProps } from 'reka-ui';
import { type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<SelectGroupProps & { class?: HTMLAttributes['class'] }>();
const forwarded = useForwardProps(props);
</script>

<template>
   <SelectGroup
      v-bind="forwarded"
      :class="cn('p-1 w-full', props.class)"
   >
      <slot />
   </SelectGroup>
</template>
