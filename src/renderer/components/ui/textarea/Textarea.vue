<!--
  @usage
  <Textarea v-model="note.content" rows="6" placeholder="Write something..." />
  <Textarea v-model="ddl" readonly class="font-mono text-[12px]" />
-->
<script setup lang="ts">
import { useVModel } from '@vueuse/core';
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<{
   defaultValue?: string | number;
   modelValue?: string | number;
   class?: HTMLAttributes['class'];
}>();

interface TextareaEmits {
   (e: 'update:modelValue', payload: string | number): void;
}

const emits = defineEmits<TextareaEmits>();

const modelValue = useVModel(props, 'modelValue', emits, {
   passive: true,
   defaultValue: props.defaultValue
});
</script>

<template>
   <textarea
      v-model="modelValue"
      :class="cn('flex min-h-[80px] w-full rounded-md border border-input bg-secondary px-3 py-2 text-[13px] text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', props.class)"
   />
</template>
