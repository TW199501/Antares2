<!--
  @usage
  <Badge>Default</Badge>
  <Badge variant="success">OK</Badge>
  <Badge variant="warning">Caution</Badge>
  <Badge variant="info">Info</Badge>
  <Badge variant="destructive">Error</Badge>
  <Badge variant="outline">Outline</Badge>
-->
<script setup lang="ts">
import { type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

import { type BadgeVariants, badgeVariants } from './variants';

const props = defineProps<{
   variant?: BadgeVariants['variant'];
   class?: HTMLAttributes['class'];
}>();
</script>

<template>
   <div :class="cn(badgeVariants({ variant }), props.class)">
      <slot />
   </div>
</template>
