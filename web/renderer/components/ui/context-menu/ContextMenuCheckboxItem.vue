<script setup lang="ts">
import { ContextMenuCheckboxItem, type ContextMenuCheckboxItemEmits, type ContextMenuCheckboxItemProps, ContextMenuItemIndicator, useForwardPropsEmits } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import BaseIcon from '@/components/BaseIcon.vue';
import { cn } from '@/lib/utils';

const props = defineProps<ContextMenuCheckboxItemProps & { class?: HTMLAttributes['class'] }>();
const emits = defineEmits<ContextMenuCheckboxItemEmits>();

const delegatedProps = computed(() => {
   const { class: _, ...rest } = props;
   return rest;
});
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
   <ContextMenuCheckboxItem
      v-bind="forwarded"
      :class="cn('relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-[13px] outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50', props.class)"
   >
      <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
         <ContextMenuItemIndicator>
            <BaseIcon icon-name="mdiCheck" :size="14" />
         </ContextMenuItemIndicator>
      </span>
      <slot />
   </ContextMenuCheckboxItem>
</template>
