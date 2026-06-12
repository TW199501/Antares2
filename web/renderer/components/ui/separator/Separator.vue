<!--
  @usage
  <Separator />
  <Separator orientation="vertical" class="h-6" />
-->
<script setup lang="ts">
import { Separator, type SeparatorProps } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = withDefaults(defineProps<SeparatorProps & { class?: HTMLAttributes['class'] }>(), {
   orientation: 'horizontal',
   decorative: true
});

const delegatedProps = computed(() => {
   const { class: _, ...rest } = props;
   return rest;
});
</script>

<template>
   <Separator
      v-bind="delegatedProps"
      :class="cn(
         'shrink-0 bg-border',
         orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
         props.class
      )"
   />
</template>
