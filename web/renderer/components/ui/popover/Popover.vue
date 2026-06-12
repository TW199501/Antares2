<!--
  @usage
  <Popover>
    <PopoverTrigger as-child>
      <Button variant="outline" size="icon"><BaseIcon icon-name="mdiPalette" /></Button>
    </PopoverTrigger>
    <PopoverContent class="w-[200px]">
      <ColorPickerInline v-model="color" />
    </PopoverContent>
  </Popover>
-->
<script setup lang="ts">
import { PopoverRoot, type PopoverRootEmits, type PopoverRootProps, useForwardPropsEmits } from 'reka-ui';

const props = defineProps<PopoverRootProps>();
const emits = defineEmits<PopoverRootEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
   <PopoverRoot v-bind="forwarded">
      <slot />
   </PopoverRoot>
</template>
