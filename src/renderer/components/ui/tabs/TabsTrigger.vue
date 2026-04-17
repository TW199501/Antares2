<script setup lang="ts">
import { TabsTrigger, type TabsTriggerProps, useForwardProps } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<TabsTriggerProps & { class?: HTMLAttributes['class'] }>();
const delegatedProps = computed(() => {
   const { class: _, ...rest } = props;
   return rest;
});
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
   <TabsTrigger
      v-bind="forwarded"
      :class="cn('inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-3.5 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm', props.class)"
   >
      <slot />
   </TabsTrigger>
</template>
