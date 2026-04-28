<script setup lang="ts">
import { SelectIcon, SelectTrigger, type SelectTriggerProps, useForwardProps } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import BaseIcon from '@/components/BaseIcon.vue';
import { cn } from '@/lib/utils';

const props = defineProps<SelectTriggerProps & { class?: HTMLAttributes['class'] }>();
const delegatedProps = computed(() => {
   const { class: _, ...rest } = props;
   return rest;
});
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
   <SelectTrigger
      v-bind="forwarded"
      :class="cn('flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-secondary px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1', props.class)"
   >
      <slot />
      <SelectIcon as-child>
         <BaseIcon
            icon-name="mdiChevronDown"
            :size="16"
            class="opacity-50"
         />
      </SelectIcon>
   </SelectTrigger>
</template>
