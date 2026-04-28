<!--
  @usage
  <Combobox v-model="selected" by="value">
    <ComboboxAnchor>
      <ComboboxInput placeholder="Search…" />
    </ComboboxAnchor>
    <ComboboxList>
      <ComboboxEmpty>No result.</ComboboxEmpty>
      <ComboboxGroup>
        <ComboboxLabel>Group</ComboboxLabel>
        <ComboboxItem v-for="opt in opts" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </ComboboxItem>
      </ComboboxGroup>
    </ComboboxList>
  </Combobox>
-->
<script setup lang="ts">
import { ComboboxRoot, type ComboboxRootEmits, type ComboboxRootProps, useForwardPropsEmits } from 'reka-ui';
import { type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<ComboboxRootProps & { class?: HTMLAttributes['class'] }>();
const emits = defineEmits<ComboboxRootEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
   <ComboboxRoot
      v-bind="forwarded"
      :class="cn('relative', props.class)"
   >
      <slot />
   </ComboboxRoot>
</template>
