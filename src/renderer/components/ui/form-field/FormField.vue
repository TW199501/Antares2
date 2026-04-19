<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { useId } from 'vue';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const props = defineProps<{
   label?: string;
   error?: string;
   class?: HTMLAttributes['class'];
}>();

const inputId = useId();
</script>

<template>
   <div :class="cn('flex flex-col gap-[6px]', props.class)">
      <Label
         v-if="label"
         :for="inputId"
         class="text-[12px] font-medium"
      >
         {{ label }}
      </Label>
      <slot :id="inputId" :aria-invalid="!!error" />
      <p v-if="error" class="text-xs text-destructive">
         {{ error }}
      </p>
   </div>
</template>
