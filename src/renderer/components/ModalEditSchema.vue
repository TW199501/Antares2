<template>
   <ConfirmModal
      size="medium"
      :confirm-text="t('application.update')"
      :cancel-text="t('general.close')"
      @confirm="updateSchema"
      @hide="closeModal"
   >
      <template #header>
         <div class="flex items-center gap-1.5">
            <BaseIcon icon-name="mdiDatabaseEdit" :size="20" />
            <span class="cut-text">{{ t('database.editSchema') }}</span>
         </div>
      </template>
      <template #body>
         <form class="space-y-3" @submit.prevent="updateSchema">
            <FormField :label="t('general.name')">
               <Input
                  v-model="database.name"
                  type="text"
                  :placeholder="t('database.schemaName')"
                  readonly
                  class="cursor-not-allowed bg-muted/50 text-muted-foreground"
               />
            </FormField>
            <FormField :label="t('database.collation')">
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
import { computed, ref } from 'vue';
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

const props = defineProps({
   selectedSchema: String
});

const emit = defineEmits<{
   'close': [];
}>();

const { addNotification } = useNotificationsStore();
const workspacesStore = useWorkspacesStore();

const { getSelected: selectedWorkspace } = storeToRefs(workspacesStore);

const { getWorkspace, getDatabaseVariable } = workspacesStore;

const database = ref({
   name: '',
   prevName: '',
   collation: '',
   prevCollation: null
});

const collations = computed(() => getWorkspace(selectedWorkspace.value).collations);
const defaultCollation = computed(() => (getDatabaseVariable(selectedWorkspace.value, 'collation_server').value || ''));

const updateSchema = async () => {
   if (database.value.collation !== database.value.prevCollation) {
      try {
         const { status, response } = await Schema.updateSchema({
            uid: selectedWorkspace.value,
            ...database.value
         });

         if (status === 'success')
            closeModal();
         else
            addNotification({ status: 'error', message: response });
      }
      catch (err) {
         addNotification({ status: 'error', message: err.stack });
      }
   }
   else closeModal();
};

const closeModal = () => emit('close');

(async () => {
   let actualCollation;
   try {
      const { status, response } = await Schema.getDatabaseCollation({ uid: selectedWorkspace.value, database: props.selectedSchema });

      if (status === 'success')
         actualCollation = response;
      else
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   database.value = {
      name: props.selectedSchema,
      prevName: props.selectedSchema,
      collation: actualCollation || defaultCollation.value,
      prevCollation: actualCollation || defaultCollation.value
   };
})();
</script>
