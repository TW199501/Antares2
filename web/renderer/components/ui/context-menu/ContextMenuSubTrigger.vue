<script setup lang="ts">
import { ContextMenuSubTrigger, type ContextMenuSubTriggerProps, useForwardProps } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import BaseIcon from '@/components/BaseIcon.vue';
import { cn } from '@/lib/utils';

const props = defineProps<ContextMenuSubTriggerProps & { class?: HTMLAttributes['class']; inset?: boolean }>();

const delegatedProps = computed(() => {
   const { class: _, inset: __, ...rest } = props;
   return rest;
});
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
   <ContextMenuSubTrigger
      v-bind="forwarded"
      :class="cn('flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-[13px] outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent', inset && 'pl-8', props.class)"
   >
      <slot />
      <BaseIcon
         icon-name="mdiChevronRight"
         :size="14"
         class="ml-auto"
      />
   </ContextMenuSubTrigger>
</template>
