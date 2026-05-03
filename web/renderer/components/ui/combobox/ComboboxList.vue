<script setup lang="ts">
import {
   ComboboxContent,
   type ComboboxContentEmits,
   type ComboboxContentProps,
   ComboboxPortal,
   ComboboxViewport,
   useForwardPropsEmits
} from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = withDefaults(defineProps<ComboboxContentProps & { class?: HTMLAttributes['class'] }>(), {
   position: 'popper'
});
const emits = defineEmits<ComboboxContentEmits>();

const delegatedProps = computed(() => {
   const { class: _, ...rest } = props;
   return rest;
});
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
   <ComboboxPortal>
      <ComboboxContent
         v-bind="forwarded"
         :class="cn(
            'relative z-50 max-h-[300px] min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
            props.class
         )"
      >
         <ComboboxViewport
            :class="cn('p-1', position === 'popper' && 'w-full min-w-[var(--reka-combobox-anchor-width)]')"
         >
            <slot />
         </ComboboxViewport>
      </ComboboxContent>
   </ComboboxPortal>
</template>
