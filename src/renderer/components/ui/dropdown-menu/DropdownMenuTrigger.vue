<script setup lang="ts">
import { DropdownMenuTrigger, type DropdownMenuTriggerProps } from 'reka-ui';
import { type HTMLAttributes } from 'vue';

defineProps<DropdownMenuTriggerProps & { class?: HTMLAttributes['class'] }>();
</script>

<template>
   <DropdownMenuTrigger v-bind="$attrs">
      <slot />
   </DropdownMenuTrigger>
</template>
