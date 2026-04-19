<template>
   <!-- Overlay: pointer-events:none so it never blocks clicks -->
   <Teleport to="body">
      <div id="specsnap-overlay" ref="overlayRef" />
   </Teleport>

   <!-- Panel -->
   <Teleport to="#main-content">
      <div id="specsnap-panel" ref="panelRef">
         <!-- Header -->
         <div class="specsnap-header">
            <div class="specsnap-title">
               <BaseIcon
                  icon-name="mdiCrosshairsGps"
                  :size="16"
                  class="specsnap-title-icon"
               />
               <span>{{ t('application.specsnap.inspector') }}</span>
            </div>
            <button
               class="btn btn-clear c-hand"
               :aria-label="t('general.close')"
               @click="close"
            />
         </div>

         <!-- Controls -->
         <div class="specsnap-controls">
            <div class="btn-group" style="flex: 1;">
               <button
                  class="btn btn-sm"
                  :class="isInspecting ? 'btn-error' : 'btn-primary'"
                  style="flex: 1;"
                  @click="toggleInspect"
               >
                  <BaseIcon
                     :icon-name="isInspecting ? 'mdiClose' : 'mdiCursorPointer'"
                     :size="14"
                     class="mr-1"
                  />
                  {{ isInspecting
                     ? t('application.specsnap.done')
                     : (selections.length > 0
                        ? t('application.specsnap.selectedCount', { n: selections.length })
                        : t('application.specsnap.startInspect'))
                  }}
               </button>
            </div>
            <button
               class="btn btn-sm btn-link specsnap-clear-btn"
               :disabled="selections.length === 0"
               @click="clearSelections"
            >
               {{ t('application.specsnap.clear') }}
            </button>
         </div>

         <!-- Hint -->
         <div class="specsnap-hint">
            <span
               v-if="isInspecting"
               class="specsnap-hint-inspecting"
            >
               <BaseIcon
                  icon-name="mdiCircle"
                  :size="8"
                  class="specsnap-pulse-icon"
               />
               {{ t('application.specsnap.inspecting') }}
            </span>
            <span
               v-else
               class="specsnap-hint-idle"
            >
               {{ t('application.specsnap.hint') }}
            </span>
         </div>

         <!-- Tab bar -->
         <div class="specsnap-tabs">
            <button
               class="specsnap-tab"
               :class="{ active: activeTab === 'md' }"
               @click="activeTab = 'md'"
            >
               {{ t('application.specsnap.markdown') }}
            </button>
            <button
               class="specsnap-tab"
               :class="{ active: activeTab === 'json' }"
               @click="activeTab = 'json'"
            >
               {{ t('application.specsnap.json') }}
            </button>
         </div>

         <!-- Content area -->
         <div class="specsnap-content">
            <pre
               v-if="selections.length > 0"
               class="specsnap-pre"
            ><code>{{ activeTab === 'md' ? markdownOutput : jsonOutput }}</code></pre>
            <div
               v-else
               class="specsnap-empty"
            >
               <BaseIcon
                  icon-name="mdiCursorPointer"
                  :size="32"
                  class="specsnap-empty-icon"
               />
               <p>{{ t('application.specsnap.startInspect') }}</p>
            </div>
         </div>

         <!-- Action row -->
         <div class="specsnap-actions">
            <button
               class="btn btn-sm btn-primary"
               :disabled="selections.length === 0"
               @click="copyActive"
            >
               <BaseIcon
                  :icon-name="copyFlash ? 'mdiCheck' : 'mdiContentCopy'"
                  :size="14"
                  class="mr-1"
               />
               {{ copyFlash ? t('application.specsnap.copied') : t('application.specsnap.copy') }}
            </button>
         </div>
      </div>
   </Teleport>
</template>

<script setup lang="ts">
import { captureSession, type Gap, toJSON, toMarkdown } from '@tw199501/specsnap-core';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import { useApplicationStore } from '@/stores/application';

const { t } = useI18n();
const applicationStore = useApplicationStore();
const { hideSpecsnap } = applicationStore;

// ─── State ────────────────────────────────────────────────────────────────────

const isInspecting = ref(false);
const selections = ref<Element[]>([]);
const activeTab = ref<'md' | 'json'>('md');
const copyFlash = ref(false);
const overlayRef = ref<HTMLDivElement | null>(null);
const panelRef = ref<HTMLDivElement | null>(null);

// ─── Derived output ───────────────────────────────────────────────────────────

const session = computed(() => {
   if (selections.value.length === 0) return null;
   return captureSession([...selections.value]);
});

const markdownOutput = computed(() => {
   if (!session.value) return '';
   return toMarkdown(session.value).join('\n\n---\n\n');
});

const jsonOutput = computed(() => {
   if (!session.value) return '';
   return toJSON(session.value);
});

// ─── Overlay SVG rendering ────────────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';
const STROKE_SELECTED = '#2563eb';
const STROKE_PARENT = '#dc2626';
const STROKE_GAP = '#ff5000';
const FILL_SELECTED = '#2563eb';
const FILL_PARENT = '#dc2626';
const FILL_GAP = '#ff5000';

function createSvgEl (name: string, attrs: Record<string, string | number>): SVGElement {
   const el = document.createElementNS(SVG_NS, name);
   for (const [k, v] of Object.entries(attrs))
      el.setAttribute(k, String(v));
   return el;
}

function addSvgLabel (
   parent: SVGElement,
   text: string,
   x: number,
   y: number,
   color: string,
   anchor: 'start' | 'middle' | 'end' = 'start'
): void {
   const padX = 5;
   const approxW = text.length * 7;
   let bgX = x;
   if (anchor === 'middle') bgX = x - approxW / 2 - padX;
   else if (anchor === 'end') bgX = x - approxW - padX * 2;
   parent.appendChild(createSvgEl('rect', {
      x: bgX,
      y: y - 10,
      width: approxW + padX * 2,
      height: 16,
      rx: 3,
      ry: 3,
      fill: color
   }));
   const textEl = createSvgEl('text', {
      x: anchor === 'middle' ? x : anchor === 'end' ? x - padX : x + padX,
      y: y + 2,
      fill: '#fff',
      'font-family': 'system-ui, sans-serif',
      'font-size': 11,
      'font-weight': 600,
      'text-anchor': anchor === 'middle' ? 'middle' : anchor === 'end' ? 'end' : 'start'
   });
   textEl.textContent = text;
   parent.appendChild(textEl);
}

function addSvgBadge (parent: SVGElement, n: number, x: number, y: number, color: string): void {
   parent.appendChild(createSvgEl('circle', {
      cx: x,
      cy: y,
      r: 10,
      fill: color,
      stroke: '#fff',
      'stroke-width': 2
   }));
   const textEl = createSvgEl('text', {
      x,
      y: y + 3,
      fill: '#fff',
      'font-family': 'system-ui, sans-serif',
      'font-size': 11,
      'font-weight': 700,
      'text-anchor': 'middle'
   });
   textEl.textContent = String(n);
   parent.appendChild(textEl);
}

function drawGap (svg: SVGElement, a: DOMRect, b: DOMRect, gap: Gap): void {
   if (gap.axis === 'horizontal') {
      const leftRect = a.right <= b.left ? a : b;
      const rightRect = a.right <= b.left ? b : a;
      const y = (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2;
      svg.appendChild(createSvgEl('line', {
         x1: leftRect.right,
         y1: y,
         x2: rightRect.left,
         y2: y,
         stroke: STROKE_GAP,
         'stroke-width': 1.5,
         'stroke-dasharray': '4 3'
      }));
      svg.appendChild(createSvgEl('line', {
         x1: leftRect.right,
         y1: y - 5,
         x2: leftRect.right,
         y2: y + 5,
         stroke: STROKE_GAP,
         'stroke-width': 1.5
      }));
      svg.appendChild(createSvgEl('line', {
         x1: rightRect.left,
         y1: y - 5,
         x2: rightRect.left,
         y2: y + 5,
         stroke: STROKE_GAP,
         'stroke-width': 1.5
      }));
      addSvgLabel(svg, `${gap.px}px`, (leftRect.right + rightRect.left) / 2, y - 6, FILL_GAP, 'middle');
   }
   else {
      const topRect = a.bottom <= b.top ? a : b;
      const bottomRect = a.bottom <= b.top ? b : a;
      const x = (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2;
      svg.appendChild(createSvgEl('line', {
         x1: x,
         y1: topRect.bottom,
         x2: x,
         y2: bottomRect.top,
         stroke: STROKE_GAP,
         'stroke-width': 1.5,
         'stroke-dasharray': '4 3'
      }));
      svg.appendChild(createSvgEl('line', {
         x1: x - 5,
         y1: topRect.bottom,
         x2: x + 5,
         y2: topRect.bottom,
         stroke: STROKE_GAP,
         'stroke-width': 1.5
      }));
      svg.appendChild(createSvgEl('line', {
         x1: x - 5,
         y1: bottomRect.top,
         x2: x + 5,
         y2: bottomRect.top,
         stroke: STROKE_GAP,
         'stroke-width': 1.5
      }));
      addSvgLabel(svg, `${gap.px}px`, x + 4, (topRect.bottom + bottomRect.top) / 2 + 4, FILL_GAP, 'start');
   }
}

function renderOverlay (): void {
   const overlay = overlayRef.value;
   if (!overlay) return;

   while (overlay.firstChild) overlay.removeChild(overlay.firstChild);

   const targets = selections.value;
   if (targets.length === 0) return;

   const svg = createSvgEl('svg', { width: '100%', height: '100%' }) as SVGSVGElement;
   (svg as SVGElement & { style: CSSStyleDeclaration }).style.width = '100%';
   (svg as SVGElement & { style: CSSStyleDeclaration }).style.height = '100%';
   overlay.appendChild(svg);

   // Parent of last selection — red dashed
   const last = targets[targets.length - 1];
   const parentEl = last.parentElement;
   if (parentEl && parentEl !== document.body && parentEl !== document.documentElement) {
      const pr = parentEl.getBoundingClientRect();
      svg.appendChild(createSvgEl('rect', {
         x: pr.left,
         y: pr.top,
         width: pr.width,
         height: pr.height,
         fill: 'none',
         stroke: STROKE_PARENT,
         'stroke-width': 1.5,
         'stroke-dasharray': '4 3'
      }));
      addSvgLabel(
         svg,
         `parent · ${Math.round(pr.width)} × ${Math.round(pr.height)} px`,
         pr.left,
         pr.top - 4,
         FILL_PARENT,
         'start'
      );
   }

   // Each selection — blue solid outline, size label, numbered badge
   const rects: DOMRect[] = [];
   targets.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      rects.push(r);
      svg.appendChild(createSvgEl('rect', {
         x: r.left,
         y: r.top,
         width: r.width,
         height: r.height,
         fill: 'none',
         stroke: STROKE_SELECTED,
         'stroke-width': 2
      }));
      addSvgLabel(
         svg,
         `${Math.round(r.width)} × ${Math.round(r.height)} px`,
         r.left + r.width,
         r.top - 4,
         FILL_SELECTED,
         'end'
      );
      addSvgBadge(svg, i + 1, r.left - 10, r.top - 10, FILL_SELECTED);
   });

   // Gap distance lines from session
   if (session.value && session.value.gaps) {
      for (const gap of session.value.gaps) {
         const a = rects[gap.from - 1];
         const b = rects[gap.to - 1];
         if (a && b)
            drawGap(svg, a, b, gap);
      }
   }
}

// ─── Inspect mode ─────────────────────────────────────────────────────────────

const BLOCKED_SELECTORS = [
   '#specsnap-panel',
   '#specsnap-overlay',
   '#settingbar',
   'html',
   'body'
];

function isBlocked (el: Element): boolean {
   if (el === document.body || el === document.documentElement) return true;
   for (const sel of BLOCKED_SELECTORS)
      if (el.matches(sel) || el.closest(sel)) return true;
   return false;
}

function onDocClick (e: MouseEvent): void {
   if (!isInspecting.value) return;
   const target = e.target as Element | null;
   if (!target) return;
   if (isBlocked(target)) return;

   e.preventDefault();
   e.stopPropagation();

   const idx = selections.value.indexOf(target);
   if (idx !== -1)
      selections.value.splice(idx, 1);
   else
      selections.value.push(target);
}

function onDocKeyDown (e: KeyboardEvent): void {
   if (e.key === 'Escape' && isInspecting.value)
      stopInspect();
}

function startInspect (): void {
   isInspecting.value = true;
   document.body.classList.add('specsnap-inspecting');
   document.addEventListener('click', onDocClick, true);
   document.addEventListener('keydown', onDocKeyDown, true);
}

function stopInspect (): void {
   isInspecting.value = false;
   document.body.classList.remove('specsnap-inspecting');
   document.removeEventListener('click', onDocClick, true);
   document.removeEventListener('keydown', onDocKeyDown, true);
}

function toggleInspect (): void {
   if (isInspecting.value) stopInspect();
   else startInspect();
}

function clearSelections (): void {
   selections.value = [];
}

function close (): void {
   stopInspect();
   clearSelections();
   hideSpecsnap();
}

// ─── Copy ─────────────────────────────────────────────────────────────────────

async function copyActive (): Promise<void> {
   const text = activeTab.value === 'md' ? markdownOutput.value : jsonOutput.value;
   if (!text) return;
   try {
      await navigator.clipboard.writeText(text);
      copyFlash.value = true;
      setTimeout(() => {
         copyFlash.value = false;
      }, 1500);
   }
   catch (_err) {
      // Fallback: ignore silently
   }
}

// ─── Lifecycle + reactive re-render ───────────────────────────────────────────

watch(selections, () => {
   renderOverlay();
}, { deep: true });

function onResize (): void {
   renderOverlay();
}

onMounted(() => {
   window.addEventListener('resize', onResize);
   window.addEventListener('scroll', onResize, true);
});

onUnmounted(() => {
   stopInspect();
   window.removeEventListener('resize', onResize);
   window.removeEventListener('scroll', onResize, true);
});
</script>

<style lang="scss">
/* Crosshair cursor while inspecting — applies to all page elements except our panel & sidebar */
body.specsnap-inspecting,
body.specsnap-inspecting *:not(#specsnap-panel, #specsnap-panel *):not(#settingbar, #settingbar *) {
   cursor: crosshair !important;
}
</style>

<style lang="scss" scoped>
#specsnap-overlay {
   position: fixed;
   inset: 0;
   pointer-events: none;
   z-index: 99998;
}

#specsnap-panel {
   position: fixed;
   bottom: 40px;
   right: 16px;
   width: 420px;
   height: 540px;
   display: flex;
   flex-direction: column;
   z-index: 99999;
   border-radius: $border-radius;
   border: 1px solid $border-color-dark;
   background: $bg-color;
   box-shadow: 0 8px 32px rgba(0 0 0 / 28%);
   overflow: hidden;
   font-size: 13px;

   .theme-dark & {
      background: #12162a;
      border-color: rgba(255 255 255 / 12%);
   }
}

.specsnap-header {
   display: flex;
   align-items: center;
   justify-content: space-between;
   padding: 6px 10px 6px 12px;
   border-bottom: 1px solid $border-color-dark;
   background: $bg-color-light;
   flex-shrink: 0;

   .theme-dark & {
      background: rgba(255 255 255 / 4%);
      border-color: rgba(255 255 255 / 10%);
   }
}

.specsnap-title {
   display: flex;
   align-items: center;
   gap: 6px;
   font-weight: 600;
   font-size: 13px;
}

.specsnap-title-icon {
   color: $primary-color;
   opacity: 0.9;
}

.specsnap-controls {
   display: flex;
   align-items: center;
   gap: 6px;
   padding: 8px 10px;
   border-bottom: 1px solid $border-color-dark;
   flex-shrink: 0;

   .theme-dark & {
      border-color: rgba(255 255 255 / 8%);
   }
}

.specsnap-clear-btn {
   flex-shrink: 0;
   font-size: 12px;
   opacity: 0.7;

   &:hover:not(:disabled) {
      opacity: 1;
   }
}

.specsnap-hint {
   padding: 4px 12px;
   font-size: 11px;
   opacity: 0.6;
   border-bottom: 1px solid $border-color-dark;
   flex-shrink: 0;
   line-height: 1.4;
   min-height: 26px;
   display: flex;
   align-items: center;

   .theme-dark & {
      border-color: rgba(255 255 255 / 8%);
   }
}

.specsnap-hint-inspecting {
   display: flex;
   align-items: center;
   gap: 5px;
   color: #ef4444;
}

.specsnap-pulse-icon {
   animation: specsnap-pulse 1.2s ease-in-out infinite;
}

@keyframes specsnap-pulse {
   0%, 100% { opacity: 1; }
   50% { opacity: 0.2; }
}

.specsnap-tabs {
   display: flex;
   border-bottom: 1px solid $border-color-dark;
   flex-shrink: 0;

   .theme-dark & {
      border-color: rgba(255 255 255 / 8%);
   }
}

.specsnap-tab {
   flex: 1;
   padding: 6px 0;
   font-size: 12px;
   font-weight: 500;
   background: transparent;
   border: none;
   cursor: pointer;
   opacity: 0.55;
   border-bottom: 2px solid transparent;
   transition: opacity 0.15s, border-color 0.15s;

   &:hover {
      opacity: 0.85;
   }

   &.active {
      opacity: 1;
      border-bottom-color: $primary-color;
      font-weight: 600;
   }
}

.specsnap-content {
   flex: 1;
   overflow: hidden;
   position: relative;
}

.specsnap-pre {
   margin: 0;
   padding: 10px 12px;
   font-size: 11px;
   line-height: 1.5;
   white-space: pre-wrap;
   word-break: break-word;
   overflow-y: auto;
   height: 100%;
   background: transparent;
   border: none;
   font-family: 'Fira Code', 'Consolas', monospace;

   code {
      font-family: inherit;
      background: none;
      padding: 0;
      font-size: inherit;
   }
}

.specsnap-empty {
   display: flex;
   flex-direction: column;
   align-items: center;
   justify-content: center;
   height: 100%;
   opacity: 0.3;
   gap: 8px;
   font-size: 13px;
}

.specsnap-empty-icon {
   opacity: 0.5;
}

.specsnap-actions {
   display: flex;
   align-items: center;
   justify-content: flex-end;
   padding: 6px 10px;
   border-top: 1px solid $border-color-dark;
   flex-shrink: 0;

   .theme-dark & {
      border-color: rgba(255 255 255 / 8%);
   }
}
</style>
