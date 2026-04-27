<!--
  @usage
  <Accordion type="multiple" :default-value="['tables', 'views']">
    <AccordionItem value="tables">
      <AccordionTrigger>Tables</AccordionTrigger>
      <AccordionContent>
        <div v-for="t in tables" :key="t.name">{{ t.name }}</div>
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="views">
      <AccordionTrigger>Views</AccordionTrigger>
      <AccordionContent>...</AccordionContent>
    </AccordionItem>
  </Accordion>
-->
<script setup lang="ts">
import { AccordionRoot, type AccordionRootEmits, type AccordionRootProps, useForwardPropsEmits } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<AccordionRootProps & { class?: HTMLAttributes['class'] }>();
const emits = defineEmits<AccordionRootEmits>();

const delegatedProps = computed(() => {
   const { class: _, ...rest } = props;
   return rest;
});
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
   <AccordionRoot
      v-bind="forwarded"
      :class="cn('w-full', props.class)"
   >
      <slot />
   </AccordionRoot>
</template>
