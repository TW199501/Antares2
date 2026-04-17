<template>
   <Dialog :open="true" @update:open="(v) => { if (!v) hideModal(); }">
      <DialogContent
         ref="trapRef"
         :class="modalSizeClass"
         @escape-key-down.prevent="hideModal"
         @pointer-down-outside.prevent="hideModal"
      >
         <DialogHeader v-if="hasHeader || hasDefault">
            <DialogTitle>
               <slot name="header" />
               <slot />
            </DialogTitle>
         </DialogHeader>
         <div v-if="hasBody" class="py-2">
            <slot name="body" />
         </div>
         <DialogFooter v-if="!hideFooter">
            <Button variant="default" @click.stop="confirmModal">
               {{ confirmText || t('general.confirm') }}
            </Button>
            <Button variant="link" @click="hideModal">
               {{ cancelText || t('general.cancel') }}
            </Button>
         </DialogFooter>
      </DialogContent>
   </Dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, PropType, useSlots } from 'vue';
import { useI18n } from 'vue-i18n';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFocusTrap } from '@/composables/useFocusTrap';

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

const { trapRef } = useFocusTrap({ disableAutofocus: props.disableAutofocus });

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

const confirmModal = () => {
   emit('confirm');
   if (props.closeOnConfirm) hideModal();
};

const hideModal = () => {
   emit('hide');
};

const onKey = (e: KeyboardEvent) => {
   e.stopPropagation();
   if (e.key === 'Escape')
      hideModal();
};

window.addEventListener('keydown', onKey);

onBeforeUnmount(() => {
   window.removeEventListener('keydown', onKey);
});
</script>
