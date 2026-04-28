<template>
   <div ref="containerRef" class="flex h-full flex-col">
      <div :style="{ height: `${resolvedTopHeight}px` }" class="min-h-0 overflow-hidden">
         <slot name="top" />
      </div>
      <div
         ref="handleRef"
         class="h-[6px] flex-shrink-0 cursor-row-resize bg-border transition-colors hover:bg-primary"
         :class="{ '!bg-primary': isDragging }"
         role="separator"
         aria-orientation="horizontal"
         :aria-valuenow="resolvedTopHeight"
         :aria-valuemin="minTop"
         :title="t('general.doubleClickToReset')"
         @pointerdown="onPointerDown"
         @dblclick="resetToDefault"
      />
      <div class="min-h-0 flex-1 overflow-hidden">
         <slot name="bottom" />
      </div>
   </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(defineProps<{
   topHeight: number;
   minTop?: number;
   minBottom?: number;
   defaultTopHeight?: number;
}>(), {
   minTop: 80,
   minBottom: 80,
   defaultTopHeight: 300
});

const emit = defineEmits<{
   'update:topHeight': [value: number];
   'resize-end': [value: number];
}>();

const { t } = useI18n();

const containerRef = ref<HTMLElement | null>(null);
const handleRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);

// Clamp the rendered top height so it never exceeds container - minBottom - handle,
// even if persisted state is stale after a window-resize that shrunk the viewport.
const resolvedTopHeight = computed(() => Math.max(props.minTop, props.topHeight));

let startY = 0;
let startTop = 0;

function onPointerDown (e: PointerEvent): void {
   e.preventDefault();
   startY = e.clientY;
   startTop = resolvedTopHeight.value;
   isDragging.value = true;
   handleRef.value?.setPointerCapture(e.pointerId);
   window.addEventListener('pointermove', onPointerMove);
   window.addEventListener('pointerup', onPointerUp);
}

function onPointerMove (e: PointerEvent): void {
   const delta = e.clientY - startY;
   const container = containerRef.value;
   if (!container) return;
   const containerHeight = container.getBoundingClientRect().height;
   const handleHeight = 6;
   const maxTop = Math.max(props.minTop, containerHeight - handleHeight - props.minBottom);
   const next = Math.max(props.minTop, Math.min(maxTop, startTop + delta));
   emit('update:topHeight', next);
}

function onPointerUp (): void {
   window.removeEventListener('pointermove', onPointerMove);
   window.removeEventListener('pointerup', onPointerUp);
   isDragging.value = false;
   emit('resize-end', resolvedTopHeight.value);
}

function resetToDefault (): void {
   emit('update:topHeight', props.defaultTopHeight);
   emit('resize-end', props.defaultTopHeight);
}
</script>
