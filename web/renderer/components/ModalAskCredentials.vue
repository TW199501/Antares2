<template>
   <ConfirmModal
      size="small"
      :confirm-text="t('general.send')"
      :cancel-text="t('general.close')"
      @confirm="sendCredentials"
      @hide="closeModal"
   >
      <template #header>
         <div class="flex items-center gap-1.5">
            <BaseIcon icon-name="mdiKeyVariant" :size="20" />
            <span>{{ t('connection.credentials') }}</span>
         </div>
      </template>
      <template #body>
         <form class="space-y-3" @submit.prevent="sendCredentials">
            <FormField :label="t('connection.user')">
               <Input
                  ref="firstInput"
                  v-model="credentials.user"
                  type="text"
                  autocomplete="username"
               />
            </FormField>
            <FormField :label="t('connection.password')">
               <Input
                  v-model="credentials.password"
                  type="password"
                  autocomplete="current-password"
               />
            </FormField>
         </form>
      </template>
   </ConfirmModal>
</template>

<script setup lang="ts">
import { onMounted, Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '@/components/BaseConfirmModal.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

const { t } = useI18n();

const credentials = ref({
   user: '',
   password: ''
});
// firstInput holds a ref to the shadcn Input wrapper component; the actual
// <input> element is its $el. We focus it after mount so the user can start
// typing the username immediately.
const firstInput: Ref<{ $el: HTMLInputElement } | HTMLInputElement | null> = ref(null);

const emit = defineEmits<{
   'close-asking': [];
   'credentials': [credentials: { user: string; password: string }];
}>();

const closeModal = () => {
   emit('close-asking');
};

const sendCredentials = () => {
   emit('credentials', credentials.value);
};

onMounted(() => {
   // BaseConfirmModal's DialogContent has its own focus-trap auto-focus. We
   // additionally pull focus into the username input on the next tick so
   // the user can type immediately, regardless of which child the trap
   // would have picked first.
   setTimeout(() => {
      const ref = firstInput.value as { $el?: HTMLInputElement } | HTMLInputElement | null;
      if (!ref) return;
      const el = (ref as { $el?: HTMLInputElement }).$el ?? (ref as HTMLInputElement);
      el?.focus?.();
   }, 20);
});
</script>
