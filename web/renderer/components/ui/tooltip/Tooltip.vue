<!--
  @usage
  <Tooltip>
    <TooltipTrigger as-child>
      <Button variant="ghost" size="icon"><BaseIcon icon-name="mdiContentCopy" /></Button>
    </TooltipTrigger>
    <TooltipContent>Copy</TooltipContent>
  </Tooltip>
-->
<script setup lang="ts">
import { TooltipRoot, type TooltipRootEmits, type TooltipRootProps, useForwardPropsEmits } from 'reka-ui';

const props = defineProps<TooltipRootProps>();
const emits = defineEmits<TooltipRootEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
   <TooltipRoot v-bind="forwarded">
      <slot />
   </TooltipRoot>
</template>
