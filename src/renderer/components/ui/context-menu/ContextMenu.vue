<!--
  @usage
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <div class="connection-card">...</div>
    </ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuItem @select="onEdit">Edit</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem class="text-destructive" @select="onDelete">Delete</ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
-->
<script setup lang="ts">
import { ContextMenuRoot, type ContextMenuRootEmits, type ContextMenuRootProps, useForwardPropsEmits } from 'reka-ui';

const props = defineProps<ContextMenuRootProps>();
const emits = defineEmits<ContextMenuRootEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
   <ContextMenuRoot v-bind="forwarded">
      <slot />
   </ContextMenuRoot>
</template>
