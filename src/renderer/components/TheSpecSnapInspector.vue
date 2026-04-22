<template>
   <SpecSnapInspector
      ref="inspectorRef"
      :trigger="false"
      :panel-title="t('application.specsnap.inspector')"
      @close="onPanelClose"
   />
</template>

<script setup lang="ts">
import '@tw199501/specsnap-inspector-vue/styles.css';

import { SpecSnapInspector } from '@tw199501/specsnap-inspector-vue';
import { useDraggable } from '@vueuse/core';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useApplicationStore } from '@/stores/application';

const { t } = useI18n();
const { hideSpecsnap } = useApplicationStore();

const inspectorRef = ref<InstanceType<typeof SpecSnapInspector> | null>(null);

// Wrapper 0.0.9 panel 固定用 data-position 在角落，不支援拖曳。我們在 shell 這層
// 覆寫：抓到 Teleport 到 body 的 panel DOM，用 @vueuse useDraggable 把 header 當 handle，
// 以 inline top/left 取代 CSS 的 bottom/right。
let observer: MutationObserver | null = null;
let stopWatch: (() => void) | null = null;

const PANEL_SEL = '.specsnap-inspector-panel';
const HEADER_SEL = '.specsnap-inspector-panel__header';

function attachDrag (panel: HTMLElement): void {
   const header = panel.querySelector<HTMLElement>(HEADER_SEL);
   if (!header) return;

   // 讀目前 bottom-right 的實際座標，切到 top/left 定位，讓 inline style 能覆寫 CSS。
   const rect = panel.getBoundingClientRect();
   panel.removeAttribute('data-position');
   panel.style.right = 'auto';
   panel.style.bottom = 'auto';
   panel.style.top = `${rect.top}px`;
   panel.style.left = `${rect.left}px`;
   header.style.cursor = 'move';
   header.style.userSelect = 'none';

   const { x, y } = useDraggable(panel, {
      handle: header,
      initialValue: { x: rect.left, y: rect.top },
      preventDefault: true
   });

   stopWatch = watch([x, y], ([nx, ny]) => {
      panel.style.left = `${nx}px`;
      panel.style.top = `${ny}px`;
   });
}

function watchForPanel (): void {
   const existing = document.querySelector<HTMLElement>(PANEL_SEL);
   if (existing) {
      attachDrag(existing);
      return;
   }
   observer = new MutationObserver(() => {
      const el = document.querySelector<HTMLElement>(PANEL_SEL);
      if (el) {
         attachDrag(el);
         observer?.disconnect();
         observer = null;
      }
   });
   observer.observe(document.body, { childList: true, subtree: true });
}

onMounted(async () => {
   await nextTick();
   inspectorRef.value?.open();
   watchForPanel();
});

onBeforeUnmount(() => {
   observer?.disconnect();
   observer = null;
   stopWatch?.();
   stopWatch = null;
});

function onPanelClose (): void {
   hideSpecsnap();
}
</script>
