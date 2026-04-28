<template>
   <ContextMenuContent class="min-w-[200px]">
      <ContextMenuSub v-if="!connection.readonly">
         <ContextMenuSubTrigger>
            <BaseIcon icon-name="mdiPlus" :size="16" />
            <span>{{ t('general.add') }}</span>
         </ContextMenuSubTrigger>
         <ContextMenuSubContent class="min-w-[200px]">
            <ContextMenuItem
               v-if="workspace.customizations.tableAdd"
               @select="emit('open-create-table-tab')"
            >
               <BaseIcon icon-name="mdiTable" :size="16" />
               <span>{{ t('database.table') }}</span>
            </ContextMenuItem>
            <ContextMenuItem
               v-if="workspace.customizations.viewAdd"
               @select="emit('open-create-view-tab')"
            >
               <BaseIcon icon-name="mdiTableEye" :size="16" />
               <span>{{ t('database.view') }}</span>
            </ContextMenuItem>
            <ContextMenuItem
               v-if="workspace.customizations.materializedViewAdd"
               @select="emit('open-create-materialized-view-tab')"
            >
               <BaseIcon icon-name="mdiTableEye" :size="16" />
               <span>{{ t('database.materializedView') }}</span>
            </ContextMenuItem>
            <ContextMenuItem
               v-if="workspace.customizations.triggerAdd"
               @select="emit('open-create-trigger-tab')"
            >
               <BaseIcon icon-name="mdiTableCog" :size="16" />
               <span>{{ t('database.trigger', 1) }}</span>
            </ContextMenuItem>
            <ContextMenuItem
               v-if="workspace.customizations.routineAdd"
               @select="emit('open-create-routine-tab')"
            >
               <BaseIcon icon-name="mdiSyncCircle" :size="16" />
               <span>{{ t('database.storedRoutine', 1) }}</span>
            </ContextMenuItem>
            <ContextMenuItem
               v-if="workspace.customizations.functionAdd"
               @select="emit('open-create-function-tab')"
            >
               <BaseIcon icon-name="mdiArrowRightBoldBox" :size="16" />
               <span>{{ t('database.function', 1) }}</span>
            </ContextMenuItem>
            <ContextMenuItem
               v-if="workspace.customizations.triggerFunctionAdd"
               @select="emit('open-create-trigger-function-tab')"
            >
               <BaseIcon icon-name="mdiCogClockwise" :size="16" />
               <span>{{ t('database.triggerFunction', 1) }}</span>
            </ContextMenuItem>
            <ContextMenuItem
               v-if="workspace.customizations.schedulerAdd"
               @select="emit('open-create-scheduler-tab')"
            >
               <BaseIcon icon-name="mdiCalendarClock" :size="16" />
               <span>{{ t('database.scheduler', 1) }}</span>
            </ContextMenuItem>
         </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuItem @select="copyName(selectedSchema)">
         <BaseIcon icon-name="mdiContentCopy" :size="16" />
         <span>{{ t('general.copyName') }}</span>
      </ContextMenuItem>
      <ContextMenuItem
         v-if="workspace.customizations.schemaExport"
         @select="showExportSchemaModal"
      >
         <BaseIcon icon-name="mdiDatabaseExport" :size="16" />
         <span>{{ t('database.export') }}</span>
      </ContextMenuItem>
      <ContextMenuItem
         v-if="workspace.customizations.schemaImport && !connection.readonly"
         @select="initImport"
      >
         <BaseIcon icon-name="mdiDatabaseImport" :size="16" />
         <span>{{ t('database.import') }}</span>
      </ContextMenuItem>
      <ContextMenuItem
         v-if="workspace.customizations.schemaEdit && !connection.readonly"
         @select="showEditModal"
      >
         <BaseIcon icon-name="mdiDatabaseEdit" :size="16" />
         <span>{{ t('database.editSchema') }}</span>
      </ContextMenuItem>
      <ContextMenuSeparator v-if="workspace.customizations.schemaDrop && !connection.readonly" />
      <ContextMenuItem
         v-if="workspace.customizations.schemaDrop && !connection.readonly"
         class="text-destructive focus:text-destructive"
         @select="showDeleteModal"
      >
         <BaseIcon icon-name="mdiDatabaseRemove" :size="16" />
         <span>{{ t('database.deleteSchema') }}</span>
      </ContextMenuItem>
   </ContextMenuContent>

   <ConfirmModal
      v-if="isDeleteModal"
      @confirm="deleteSchema"
      @hide="hideDeleteModal"
   >
      <template #header>
         <div class="flex">
            <BaseIcon
               class="text-light mr-1"
               icon-name="mdiDatabaseRemove"
               :size="24"
            />
            <span class="cut-text">{{ t('database.deleteSchema') }}</span>
         </div>
      </template>
      <template #body>
         <div class="mb-2">
            {{ t('general.deleteConfirm') }} "<b>{{ selectedSchema }}</b>"?
         </div>
      </template>
   </ConfirmModal>
   <ModalEditSchema
      v-if="isEditModal"
      :selected-schema="selectedSchema"
      @close="hideEditModal"
   />
   <ModalImportSchema
      v-if="isImportSchemaModal"
      ref="importModalRef"
      :selected-schema="selectedSchema"
      @close="hideImportSchemaModal"
   />
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { Component, computed, nextTick, Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '@/components/BaseConfirmModal.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import ModalEditSchema from '@/components/ModalEditSchema.vue';
import ModalImportSchema from '@/components/ModalImportSchema.vue';
import {
   ContextMenuContent,
   ContextMenuItem,
   ContextMenuSeparator,
   ContextMenuSub,
   ContextMenuSubContent,
   ContextMenuSubTrigger
} from '@/components/ui/context-menu';
import Application from '@/ipc-api/Application';
import Schema from '@/ipc-api/Schema';
import { copyText } from '@/libs/copyText';
import { useConnectionsStore } from '@/stores/connections';
import { useNotificationsStore } from '@/stores/notifications';
import { useSchemaExportStore } from '@/stores/schemaExport';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const props = defineProps({
   selectedSchema: String
});

const emit = defineEmits<{
   'open-create-table-tab': [];
   'open-create-view-tab': [];
   'open-create-materialized-view-tab': [];
   'open-create-trigger-tab': [];
   'open-create-routine-tab': [];
   'open-create-function-tab': [];
   'open-create-trigger-function-tab': [];
   'open-create-scheduler-tab': [];
   'reload': [];
}>();

const { addNotification } = useNotificationsStore();
const workspacesStore = useWorkspacesStore();
const schemaExportStore = useSchemaExportStore();
const { showExportModal } = schemaExportStore;

const connectionsStore = useConnectionsStore();
const { getSelected: selectedWorkspace } = storeToRefs(workspacesStore);
const { getConnectionByUid } = connectionsStore;

const {
   getWorkspace,
   changeBreadcrumbs
} = workspacesStore;

const importModalRef: Ref<Component & {startImport: (file: string) => void}> = ref(null);
const isDeleteModal = ref(false);
const isEditModal = ref(false);
const isImportSchemaModal = ref(false);

const workspace = computed(() => getWorkspace(selectedWorkspace.value));
const connection = computed(() => getConnectionByUid(selectedWorkspace.value));

const copyName = (name: string) => {
   copyText(name);
};

const showDeleteModal = () => {
   isDeleteModal.value = true;
};

const hideDeleteModal = () => {
   isDeleteModal.value = false;
};

const showEditModal = () => {
   isEditModal.value = true;
};

const hideEditModal = () => {
   isEditModal.value = false;
};

const showExportSchemaModal = () => {
   showExportModal(props.selectedSchema);
};

const showImportSchemaModal = () => {
   isImportSchemaModal.value = true;
};

const hideImportSchemaModal = () => {
   isImportSchemaModal.value = false;
};

const initImport = async () => {
   const result = await Application.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'SQL', extensions: ['sql'] }] });
   if (result && !result.canceled) {
      const file = result.filePaths[0];
      showImportSchemaModal();
      await nextTick();
      importModalRef.value.startImport(file);
   }
};

const deleteSchema = async () => {
   try {
      const { status, response } = await Schema.deleteSchema({
         uid: selectedWorkspace.value,
         database: props.selectedSchema
      });

      if (status === 'success') {
         if (props.selectedSchema === workspace.value.breadcrumbs.schema)
            changeBreadcrumbs({ schema: null });

         hideDeleteModal();
         emit('reload');
      }
      else
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }
};
</script>
