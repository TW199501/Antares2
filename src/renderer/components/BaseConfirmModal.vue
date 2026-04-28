<template>
   <Dialog :open="true" @update:open="(v) => { if (!v) hideModal(); }">
      <DialogContent
         :class="[modalSizeClass, '!p-0 !gap-0 !rounded-xl !shadow-2xl !border-border/70 overflow-hidden']"
         aria-describedby="undefined"
         @open-auto-focus="onOpenAutoFocus"
         @escape-key-down.prevent="hideModal"
         @pointer-down-outside.prevent="hideModal"
      >
         <DialogHeader v-if="hasHeader || hasDefault" class="px-5 pt-4 pb-3 border-b border-border/60">
            <DialogTitle class="!text-[15px] !font-semibold !tracking-normal pr-8">
               <slot name="header" />
               <slot />
            </DialogTitle>
         </DialogHeader>
         <div
            v-if="hasBody"
            data-modal-body
            class="px-5 py-4 overflow-auto"
            :class="bodyMaxHeightClass"
         >
            <slot name="body" />
         </div>
         <DialogFooter v-if="!hideFooter" class="!flex !flex-row !justify-end !gap-2 !px-5 !py-3 border-t border-border/60 bg-muted/30">
            <Button
               variant="ghost"
               size="sm"
               class="!h-[32px] !px-4 !text-[13px]"
               @click="hideModal"
            >
               {{ cancelText || t('general.cancel') }}
            </Button>
            <Button
               variant="default"
               size="sm"
               class="!h-[32px] !px-4 !text-[13px]"
               @click.stop="confirmModal"
            >
               {{ confirmText || t('general.confirm') }}
            </Button>
         </DialogFooter>
      </DialogContent>
   </Dialog>
</template>

<script setup lang="ts">
import { computed, PropType, useSlots } from 'vue';
import { useI18n } from 'vue-i18n';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const { t } = useI18n();

const props = defineProps({
   size: {
      type: String as PropType<'small' | 'medium' | '400' | 'large' | 'resize'>,
      validator: (prop: string) => ['small', 'medium', '400', 'large', 'resize'].includes(prop),
      default: 'small'
   },
   hideFooter: {
      type: Boolean,
      default: false
   },
   confirmText: String,
   cancelText: String,
   disableAutofocus: {
      type: Boolean,
      default: false
   },
   closeOnConfirm: {
      type: Boolean,
      default: true
   }
});
const emit = defineEmits<{
   'confirm': [];
   'hide': [];
}>();
const slots = useSlots();

const hasHeader = computed(() => !!slots.header);
const hasBody = computed(() => !!slots.body);
const hasDefault = computed(() => !!slots.default);

const modalSizeClass = computed(() => {
   switch (props.size) {
      case 'small': return 'max-w-sm';
      case 'medium': return 'max-w-md';
      case '400': return 'max-w-[400px]';
      case 'large': return 'max-w-2xl';
      case 'resize': return 'max-w-[95vw] max-h-[95vh]';
      default: return 'max-w-sm';
   }
});

const bodyMaxHeightClass = computed(() => {
   // Reserve space for header (~52px) + footer (~56px) + margin within viewport
   return props.size === 'resize' ? 'max-h-[calc(95vh-130px)]' : 'max-h-[calc(85vh-130px)]';
});

const confirmModal = () => {
   emit('confirm');
   if (props.closeOnConfirm) hideModal();
};

const hideModal = () => {
   emit('hide');
};

const onOpenAutoFocus = (e: Event) => {
   if (props.disableAutofocus) e.preventDefault();
};
</script>
