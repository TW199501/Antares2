<script setup lang="ts">
import { SelectItem, SelectItemIndicator, type SelectItemProps, SelectItemText, useForwardProps } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import BaseIcon from '@/components/BaseIcon.vue';
import { cn } from '@/lib/utils';

const props = defineProps<SelectItemProps & { class?: HTMLAttributes['class'] }>();
const delegatedProps = computed(() => {
   const { class: _, ...rest } = props;
   return rest;
});
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
   <SelectItem
      v-bind="forwarded"
      :class="cn('relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50', props.class)"
   >
      <span class="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
         <SelectItemIndicator>
            <BaseIcon icon-name="mdiCheck" :size="14" />
         </SelectItemIndicator>
      </span>
      <SelectItemText>
         <slot />
      </SelectItemText>
   </SelectItem>
</template>
