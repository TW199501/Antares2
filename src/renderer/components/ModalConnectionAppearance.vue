<template>
   <Dialog :open="true" @update:open="(v) => { if (!v) closeModal(); }">
      <!--
         Connection appearance editor: edit a sidebar connection's display name
         + icon. Three icon families stack vertically:
           1. Built-in MDI icons (~40 entries) — clickable BaseIcon swatches.
           2. Custom user-uploaded SVG icons — same swatch grid; right-click
              opens a context menu with Delete.
           3. A "+" plus tile that opens the Tauri file picker for a new SVG.
         Icon swatches use 36px BaseIcon inside a 40×40 hover-able tile;
         active selection gets ring-2 ring-ring outline (was outline-2
         var(--primary-color) under spectre).
      -->
      <DialogContent
         class="!max-w-[420px] !p-0 !gap-0 [&>button.absolute]:!hidden"
         @escape-key-down.prevent="closeModal"
         @pointer-down-outside.prevent="closeModal"
      >
         <DialogHeader class="px-5 pt-4 pb-3 border-b border-border/60 flex flex-row items-center justify-between !space-y-0">
            <DialogTitle class="!text-[15px] !font-semibold flex items-center gap-1">
               <BaseIcon icon-name="mdiBrushVariant" :size="20" />
               <span class="cut-text">{{ t('application.editConnectionAppearance') }}</span>
            </DialogTitle>
            <Button
               variant="ghost"
               size="icon"
               class="!h-7 !w-7"
               @click.stop="closeModal"
            >
               <BaseIcon icon-name="mdiClose" :size="16" />
            </Button>
         </DialogHeader>

         <div class="px-5 py-4 space-y-4">
            <div class="grid grid-cols-[80px_1fr] items-center gap-3">
               <Label for="conn-label" class="!text-[13px] font-medium">{{ t('application.label') }}</Label>
               <Input
                  id="conn-label"
                  ref="firstInput"
                  v-model="localConnection.name"
                  type="text"
                  :placeholder="getConnectionName(localConnection.uid)"
               />
            </div>
            <div class="grid grid-cols-[80px_1fr] items-start gap-3">
               <Label class="!text-[13px] font-medium pt-1">{{ t('application.icon') }}</Label>
               <div class="grid grid-cols-[repeat(auto-fill,40px)] gap-1.5">
                  <template v-for="icon in icons" :key="icon.name">
                     <button
                        v-if="icon.code"
                        type="button"
                        class="flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted focus:outline-none"
                        :class="localConnection.icon === icon.code ? 'ring-2 ring-ring' : ''"
                        :title="icon.name"
                        @click="setIcon(icon.code)"
                     >
                        <BaseIcon :icon-name="camelize(icon.code)" :size="28" />
                     </button>
                     <button
                        v-else
                        type="button"
                        class="flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-muted focus:outline-none"
                        :class="[`dbi dbi-${connection.client}`, localConnection.icon === null ? 'ring-2 ring-ring' : '']"
                        :title="icon.name"
                        @click="setIcon(null)"
                     />
                  </template>
               </div>
            </div>
            <div class="grid grid-cols-[80px_1fr] items-start gap-3">
               <Label class="!text-[13px] font-medium pt-1">{{ t('application.customIcon') }}</Label>
               <div class="grid grid-cols-[repeat(auto-fill,40px)] gap-1.5">
                  <ContextMenu
                     v-for="icon in customIcons"
                     :key="icon.uid"
                  >
                     <ContextMenuTrigger as-child>
                        <button
                           type="button"
                           class="flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted focus:outline-none"
                           :class="localConnection.icon === icon.uid ? 'ring-2 ring-ring' : ''"
                           @click="setIcon(icon.uid, 'custom')"
                           @contextmenu="setContextIcon(icon.uid)"
                        >
                           <BaseIcon
                              :icon-name="icon.uid"
                              type="custom"
                              :size="28"
                           />
                        </button>
                     </ContextMenuTrigger>
                     <ContextMenuContent class="min-w-[140px]">
                        <ContextMenuItem
                           class="text-destructive focus:text-destructive"
                           @select="removeIconHandler"
                        >
                           <BaseIcon icon-name="mdiDelete" :size="16" />
                           <span>{{ t('general.delete') }}</span>
                        </ContextMenuItem>
                     </ContextMenuContent>
                  </ContextMenu>
                  <!-- Add new SVG tile -->
                  <button
                     type="button"
                     class="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none"
                     :title="t('general.add')"
                     @click="openFile"
                  >
                     <BaseIcon icon-name="mdiPlus" :size="28" />
                  </button>
               </div>
            </div>
         </div>

         <DialogFooter class="!flex !flex-row !justify-end !gap-2 !px-5 !py-3 border-t border-border/60 bg-muted/30">
            <Button
               variant="ghost"
               size="sm"
               class="!h-[32px] !px-4 !text-[13px]"
               @click.stop="closeModal"
            >
               {{ t('general.close') }}
            </Button>
            <Button
               size="sm"
               class="!h-[32px] !px-4 !text-[13px]"
               @click.stop="editFolderAppearance"
            >
               {{ t('application.update') }}
            </Button>
         </DialogFooter>
      </DialogContent>
   </Dialog>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { onBeforeUnmount, PropType, Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Application from '@/ipc-api/Application';
import { camelize } from '@/libs/camelize';
import { unproxify } from '@/libs/unproxify';
import { SidebarElement, useConnectionsStore } from '@/stores/connections';
import { useNotificationsStore } from '@/stores/notifications';

const connectionsStore = useConnectionsStore();
const { addNotification } = useNotificationsStore();

const { addIcon, removeIcon, updateConnectionOrder, getConnectionName } = connectionsStore;
const { customIcons } = storeToRefs(connectionsStore);

// Records which custom icon was right-clicked, so removeIconHandler
// (called from the ContextMenu's "Delete" item) knows what to remove.
const contextContent: Ref<string> = ref(null);

const { t } = useI18n();

const props = defineProps({
   connection: {
      type: Object as PropType<SidebarElement>,
      required: true
   }
});

const emit = defineEmits<{
   'close': [];
}>();

const icons = [
   { name: 'default', code: null },

   // Symbols
   { name: 'account-group', code: 'mdi-account-group-outline' },
   { name: 'cloud', code: 'mdi-cloud-outline' },
   { name: 'key-chain', code: 'mdi-key-chain-variant' },
   { name: 'lightning-bolt', code: 'mdi-lightning-bolt' },
   { name: 'map-marker', code: 'mdi-map-marker-radius-outline' },
   { name: 'api', code: 'mdi-api' },
   { name: 'chart-line', code: 'mdi-chart-line' },
   { name: 'chat', code: 'mdi-chat-outline' },
   { name: 'bug', code: 'mdi-bug-outline' },
   { name: 'shield', code: 'mdi-shield-outline' },
   { name: 'cart', code: 'mdi-cart-variant' },
   { name: 'bank', code: 'mdi-bank-outline' },
   { name: 'receipt', code: 'mdi-receipt-text-outline' },
   { name: 'raspberry-pi', code: 'mdi-raspberry-pi' },
   { name: 'book', code: 'mdi-book-outline' },
   { name: 'web', code: 'mdi-web' },
   { name: 'multimedia', code: 'mdi-multimedia' },
   { name: 'qr-code', code: 'mdi-qrcode' },
   { name: 'flask', code: 'mdi-flask-outline' },
   { name: 'memory', code: 'mdi-memory' },
   { name: 'cube', code: 'mdi-cube-outline' },
   { name: 'weather', code: 'mdi-weather-partly-snowy-rainy' },
   { name: 'controller', code: 'mdi-controller' },
   { name: 'home-group', code: 'mdi-home-group' },

   // Vehicles
   { name: 'truck', code: 'mdi-truck-outline' },
   { name: 'car', code: 'mdi-car' },
   { name: 'motorbike', code: 'mdi-atv' },
   { name: 'train', code: 'mdi-train' },
   { name: 'airplane', code: 'mdi-airplane' },
   { name: 'ferry', code: 'mdi-ferry' },

   // Brand
   { name: 'docker', code: 'mdi-docker' },
   { name: 'open-source', code: 'mdi-open-source-initiative' },
   { name: 'aws', code: 'mdi-aws' },
   { name: 'google-cloud', code: 'mdi-google-cloud' },
   { name: 'microsoft-azure', code: 'mdi-microsoft-azure' },
   { name: 'linux', code: 'mdi-linux' },
   { name: 'microsoft-windows', code: 'mdi-microsoft-windows' },
   { name: 'apple', code: 'mdi-apple' },
   { name: 'android', code: 'mdi-android' }
];

const firstInput: Ref<HTMLInputElement> = ref(null);
const localConnection: Ref<SidebarElement> = ref(unproxify(props.connection));

const editFolderAppearance = () => {
   updateConnectionOrder(localConnection.value);
   closeModal();
};

const setIcon = (code: string, type?: 'mdi' | 'custom') => {
   localConnection.value.icon = code;
   localConnection.value.hasCustomIcon = type === 'custom';
};

const removeIconHandler = () => {
   if (localConnection.value.icon === contextContent.value) {
      setIcon(null);
      updateConnectionOrder(localConnection.value);
   }
   removeIcon(contextContent.value);
};

const adjustSVGContent = (svgContent: string) => {
   try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, 'image/svg+xml');

      const parseError = doc.querySelector('parsererror');
      if (parseError) {
         addNotification({ status: 'error', message: parseError.textContent });
         return null;
      }

      const svg = doc.documentElement;
      if (svg.tagName.toLowerCase() !== 'svg') {
         addNotification({ status: 'error', message: t('application.invalidFile') });
         return null;
      }

      if (!svg.hasAttribute('viewBox')) {
         const width = svg.getAttribute('width') || '36';
         const height = svg.getAttribute('height') || '36';
         svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      }

      svg.removeAttribute('width');
      svg.removeAttribute('height');

      const serializer = new XMLSerializer();
      return serializer.serializeToString(svg);
   }
   catch (error) {
      addNotification({ status: 'error', message: error.stack });
      return null;
   }
};

const openFile = async () => {
   const result = await Application.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: '"SVG"', extensions: ['svg'] }]
   });

   if (result && !result.canceled) {
      const file = result.filePaths[0];
      let content = await Application.readFile({ filePath: file, encoding: 'utf-8' });

      content = adjustSVGContent(content);

      const base64Content = Buffer.from(content).toString('base64');

      addIcon(base64Content);
   }
};

// Records the right-clicked icon's UID into reactive state so the
// ContextMenu's "Delete" action can target it. The shadcn ContextMenu
// handles position + open/close internally; we only need to track which
// icon was clicked.
const setContextIcon = (iconUid: string) => {
   contextContent.value = iconUid;
};

const closeModal = () => emit('close');

const onKey =(e: KeyboardEvent) => {
   e.stopPropagation();
   if (e.key === 'Escape')
      closeModal();
};

window.addEventListener('keydown', onKey);

onBeforeUnmount(() => {
   window.removeEventListener('keydown', onKey);
});
</script>

<style scoped lang="scss">
  .theme-light {
      .dbi {
         filter: invert(100%) opacity(.8);
      }
  }
</style>
