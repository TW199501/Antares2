<script setup lang="ts">
import { TabsList, type TabsListProps, useForwardProps } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<TabsListProps & { class?: HTMLAttributes['class'] }>();
const delegatedProps = computed(() => {
   const { class: _, ...rest } = props;
   return rest;
});
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
   <TabsList
      v-bind="forwarded"
      :class="cn('inline-flex h-11 items-center justify-center rounded-md bg-secondary p-1 text-muted-foreground', props.class)"
   >
      <slot />
   </TabsList>
</template>
