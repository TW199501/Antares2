<!--
  @usage
  <RadioGroup v-model="settings.autoUpdate">
    <div class="flex items-center gap-2">
      <RadioGroupItem id="auto-on" value="enabled" />
      <Label for="auto-on">Enabled</Label>
    </div>
    <div class="flex items-center gap-2">
      <RadioGroupItem id="auto-off" value="disabled" />
      <Label for="auto-off">Disabled</Label>
    </div>
  </RadioGroup>
-->
<script setup lang="ts">
import { RadioGroupRoot, type RadioGroupRootEmits, type RadioGroupRootProps, useForwardPropsEmits } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<RadioGroupRootProps & { class?: HTMLAttributes['class'] }>();
const emits = defineEmits<RadioGroupRootEmits>();

const delegatedProps = computed(() => {
   const { class: _, ...rest } = props;
   return rest;
});
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
   <RadioGroupRoot
      v-bind="forwarded"
      :class="cn('grid gap-2', props.class)"
   >
      <slot />
   </RadioGroupRoot>
</template>
