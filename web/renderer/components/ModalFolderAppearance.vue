<template>
   <Dialog :open="true" @update:open="(v) => { if (!v) closeModal(); }">
      <!--
         Folder appearance editor: edit a sidebar folder's name + accent color.
         Color palette is the legacy spectre-era 17 colors hardcoded below; the
         picker is rendered as a CSS grid of 24px swatches with mdiCheck overlay
         on the active selection. Modal width matches the original spectre 360px
         so legacy users see the same affordance footprint.
      -->
      <DialogContent
         class="!max-w-[360px] !p-0 !gap-0 [&>button.absolute]:!hidden"
         @escape-key-down.prevent="closeModal"
         @pointer-down-outside.prevent="closeModal"
      >
         <DialogHeader class="px-5 pt-4 pb-3 border-b border-border/60 flex flex-row items-center justify-between !space-y-0">
            <DialogTitle class="!text-[15px] !font-semibold flex items-center gap-1">
               <BaseIcon icon-name="mdiFolderEdit" :size="20" />
               <span>{{ t('application.editFolder') }}</span>
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
               <Label for="folder-name" class="!text-[13px] font-medium">{{ t('general.name') }}</Label>
               <Input
                  id="folder-name"
                  ref="firstInput"
                  v-model="localFolder.name"
                  type="text"
                  required
                  :placeholder="t('application.folderName')"
               />
            </div>
            <div class="grid grid-cols-[80px_1fr] items-start gap-3">
               <Label class="!text-[13px] font-medium pt-1">{{ t('application.color') }}</Label>
               <!--
                  17-swatch grid. Each swatch is a Button variant="ghost"
                  with no padding so the colored background fills the
                  6×6 (24px) box. Selected swatch gets ring-2 + ring-ring
                  for high-contrast affordance against any palette color.
               -->
               <div class="grid grid-cols-[repeat(auto-fill,24px)] gap-1.5">
                  <Button
                     v-for="color in colorPalette"
                     :key="color.name"
                     type="button"
                     variant="ghost"
                     size="icon"
                     class="!h-6 !w-6 !p-0 !rounded-md hover:!opacity-90"
                     :class="localFolder.color === color.hex ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''"
                     :style="`background-color: ${color.hex}`"
                     :title="color.name"
                     @click="localFolder.color = color.hex"
                  >
                     <BaseIcon
                        v-if="localFolder.color === color.hex"
                        icon-name="mdiCheck"
                        :size="14"
                        class="text-white drop-shadow"
                     />
                  </Button>
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
import { onBeforeUnmount, PropType, Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { unproxify } from '@/libs/unproxify';
import { SidebarElement, useConnectionsStore } from '@/stores/connections';

const connectionsStore = useConnectionsStore();

const { t } = useI18n();

const props = defineProps({
   folder: {
      type: Object as PropType<SidebarElement>,
      required: true
   }
});

const emit = defineEmits<{
   'close': [];
}>();

const { updateConnectionOrder } = connectionsStore;

const colorPalette = [
   { name: 'default', hex: '#E36929' },
   { name: 'grape-fruit', hex: '#ED5565' },
   { name: 'rose', hex: '#E3242B' },
   { name: 'fire', hex: '#FDA50F' },
   { name: 'sunflower', hex: '#FFCE54' },
   { name: 'moss', hex: '#8A985E' },
   { name: 'grass', hex: '#6DCD05' },
   { name: 'emerald', hex: '#038835' },
   { name: 'mint', hex: '#48CFAD' },
   { name: 'aqua', hex: '#4FC1E9' },
   { name: 'royal-lblue', hex: '#4169E1' },
   { name: 'blue-jeans', hex: '#5D9CEC' },
   { name: 'stone', hex: '#59788E' },
   { name: 'lavander', hex: '#AC92EC' },
   { name: 'pink-rose', hex: '#EC87C0' },
   { name: 'smoke', hex: '#BEBDB8' },
   { name: 'slate', hex: '#757C88' }
];

const firstInput: Ref<HTMLInputElement> = ref(null);
const localFolder: Ref<SidebarElement> = ref(unproxify(props.folder));

const editFolderAppearance = () => {
   updateConnectionOrder(localFolder.value);
   closeModal();
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
