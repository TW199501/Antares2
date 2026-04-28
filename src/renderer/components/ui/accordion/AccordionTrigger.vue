<script setup lang="ts">
import { AccordionHeader, AccordionTrigger, type AccordionTriggerProps, useForwardProps } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import BaseIcon from '@/components/BaseIcon.vue';
import { cn } from '@/lib/utils';

const props = defineProps<AccordionTriggerProps & { class?: HTMLAttributes['class'] }>();

const delegatedProps = computed(() => {
   const { class: _, ...rest } = props;
   return rest;
});
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
   <AccordionHeader class="flex">
      <AccordionTrigger
         v-bind="forwarded"
         :class="cn('flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180', props.class)"
      >
         <slot />
         <BaseIcon
            icon-name="mdiChevronDown"
            :size="16"
            class="shrink-0 transition-transform duration-200"
         />
      </AccordionTrigger>
   </AccordionHeader>
</template>
