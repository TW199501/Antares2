<script setup lang="ts">
import { AccordionContent, type AccordionContentProps, useForwardProps } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<AccordionContentProps & { class?: HTMLAttributes['class'] }>();

const delegatedProps = computed(() => {
   const { class: _, ...rest } = props;
   return rest;
});
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
   <AccordionContent
      v-bind="forwarded"
      class="overflow-hidden text-[13px] data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
   >
      <div :class="cn('pb-4 pt-0', props.class)">
         <slot />
      </div>
   </AccordionContent>
</template>
