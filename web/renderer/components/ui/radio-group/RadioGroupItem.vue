<script setup lang="ts">
import { RadioGroupIndicator, RadioGroupItem, type RadioGroupItemProps, useForwardProps } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import BaseIcon from '@/components/BaseIcon.vue';
import { cn } from '@/lib/utils';

const props = defineProps<RadioGroupItemProps & { class?: HTMLAttributes['class'] }>();

const delegatedProps = computed(() => {
   const { class: _, ...rest } = props;
   return rest;
});
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
   <RadioGroupItem
      v-bind="forwarded"
      :class="cn('aspect-square h-4 w-4 rounded-full border border-muted-foreground text-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50', props.class)"
   >
      <RadioGroupIndicator class="flex h-full w-full items-center justify-center">
         <BaseIcon
            icon-name="mdiCircle"
            :size="8"
            class="text-primary"
         />
      </RadioGroupIndicator>
   </RadioGroupItem>
</template>
