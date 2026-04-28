<template>
   <ConfirmModal
      :confirm-text="t('general.confirm')"
      size="large"
      :cancel-text="t('general.close')"
      :hide-footer="true"
      @hide="$emit('hide')"
   >
      <template #header>
         <div class="flex items-center justify-between gap-2">
            <div class="flex items-center min-w-0">
               <BaseIcon
                  class="mr-1 shrink-0"
                  icon-name="mdiCodeTags"
                  :size="22"
               />
               <span class="truncate">{{ t('database.ddl') }} "{{ table }}"</span>
            </div>
            <Button
               variant="ghost"
               size="sm"
               class="!h-[28px] !text-[12px] mr-8"
               :disabled="!createDdl"
               :title="t('general.copy')"
               @click="copyDdl"
            >
               <BaseIcon
                  class="mr-1"
                  icon-name="mdiContentCopy"
                  :size="14"
               />
               {{ t('general.copy') }}
            </Button>
         </div>
      </template>
      <template #body>
         <div class="pb-2">
            <BaseTextEditor
               ref="queryEditor"
               v-model="createDdl"
               editor-class="textarea-editor"
               :read-only="true"
               mode="sql"
            />
         </div>
      </template>
   </ConfirmModal>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '@/components/BaseConfirmModal.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import BaseTextEditor from '@/components/BaseTextEditor.vue';
import { Button } from '@/components/ui/button';
import Tables from '@/ipc-api/Tables';
import { useNotificationsStore } from '@/stores/notifications';

const { t } = useI18n();

const props = defineProps({
   table: String,
   schema: String,
   workspace: Object
});

const createDdl = ref('');

defineEmits<{
   'hide': [];
}>();

const { addNotification } = useNotificationsStore();

const copyDdl = async () => {
   if (!createDdl.value) return;
   try {
      await navigator.clipboard.writeText(createDdl.value);
      addNotification({ status: 'success', message: t('general.copied') });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.message });
   }
};

onMounted(async () => {
   try {
      const { status, response } = await Tables.getTableDll({
         uid: props.workspace.uid,
         table: props.table,
         schema: props.schema
      });

      if (status === 'success')
         createDdl.value = response;
      else
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }
});

</script>
