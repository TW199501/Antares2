<script setup lang="ts">
import { ComboboxInput, type ComboboxInputEmits, type ComboboxInputProps, useForwardPropsEmits } from 'reka-ui';
import { type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<ComboboxInputProps & { class?: HTMLAttributes['class'] }>();
const emits = defineEmits<ComboboxInputEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
   <ComboboxInput
      v-bind="forwarded"
      :class="cn(
         'flex h-9 w-full rounded-md border border-input bg-secondary px-3 py-1 text-foreground text-[13px] outline-none ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
         props.class
      )"
   />
</template>
