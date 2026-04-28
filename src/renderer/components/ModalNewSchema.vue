<template>
   <ConfirmModal
      size="medium"
      :confirm-text="t('general.add')"
      :cancel-text="t('general.close')"
      @confirm="createSchema"
      @hide="closeModal"
   >
      <template #header>
         <div class="flex items-center gap-1.5">
            <BaseIcon icon-name="mdiDatabasePlus" :size="20" />
            <span class="cut-text">{{ t('database.createNewSchema') }}</span>
         </div>
      </template>
      <template #body>
         <form class="space-y-3" @submit.prevent="createSchema">
            <FormField :label="t('general.name')">
               <Input
                  ref="firstInput"
                  v-model="database.name"
                  type="text"
                  required
                  :placeholder="t('database.schemaName')"
               />
            </FormField>
            <FormField v-if="customizations.collations" :label="t('database.collation')">
               <BaseSelect
                  v-model="database.collation"
                  :options="collations"
                  :max-visible-options="1000"
                  option-label="collation"
                  option-track-by="collation"
               />
               <p class="text-[12px] text-muted-foreground mt-1">
                  {{ t('database.serverDefault') }}: {{ defaultCollation }}
               </p>
            </FormField>
         </form>
      </template>
   </ConfirmModal>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '@/components/BaseConfirmModal.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import Schema from '@/ipc-api/Schema';
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const { addNotification } = useNotificationsStore();
const workspacesStore = useWorkspacesStore();

const { getSelected: selectedWorkspace } = storeToRefs(workspacesStore);

const { getWorkspace, getDatabaseVariable } = workspacesStore;

const emit = defineEmits<{
   'reload': [];
   'close': [];
}>();

// firstInput holds a ref to the shadcn Input wrapper component; the real
// <input> is its $el. Used by onMounted to pull initial focus.
const firstInput: Ref<{ $el: HTMLInputElement } | HTMLInputElement | null> = ref(null);
const database = ref({
   name: '',
   collation: ''
});

const collations = computed(() => getWorkspace(selectedWorkspace.value).collations);
const customizations = computed(() => getWorkspace(selectedWorkspace.value).customizations);
const defaultCollation = computed(() => getDatabaseVariable(selectedWorkspace.value, 'collation_server') ? getDatabaseVariable(selectedWorkspace.value, 'collation_server').value : '');

database.value = { ...database.value, collation: defaultCollation.value };

const createSchema = async () => {
   try {
      const { status, response } = await Schema.createSchema({
         uid: selectedWorkspace.value,
         ...database.value
      });

      if (status === 'success') {
         closeModal();
         emit('reload');
      }
      else
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }
};

const closeModal = () => {
   emit('close');
};

onMounted(() => {
   setTimeout(() => {
      const r = firstInput.value as { $el?: HTMLInputElement } | HTMLInputElement | null;
      if (!r) return;
      const el = (r as { $el?: HTMLInputElement }).$el ?? (r as HTMLInputElement);
      el?.focus?.();
   }, 20);
});
</script>
