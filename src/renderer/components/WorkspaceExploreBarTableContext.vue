<template>
   <ContextMenuContent class="min-w-[180px]">
      <ContextMenuItem
         v-if="selectedTable && selectedTable.type === 'table' && customizations.tableSettings"
         @select="openTableSettingTab"
      >
         <BaseIcon icon-name="mdiWrenchCog" :size="16" />
         <span>{{ t('application.settings') }}</span>
      </ContextMenuItem>
      <ContextMenuItem @select="copyName(selectedTable.name)">
         <BaseIcon icon-name="mdiContentCopy" :size="16" />
         <span>{{ t('general.copyName') }}</span>
      </ContextMenuItem>
      <ContextMenuItem
         v-if="selectedTable && selectedTable.type === 'table' && customizations.schemaExport"
         @select="showTableExportModal"
      >
         <BaseIcon icon-name="mdiTableArrowRight" :size="16" />
         <span>{{ t('database.exportTable') }}</span>
      </ContextMenuItem>
      <ContextMenuItem
         v-if="selectedTable && selectedTable.type === 'view' && customizations.viewSettings"
         @select="openViewSettingTab"
      >
         <BaseIcon icon-name="mdiWrenchCog" :size="16" />
         <span>{{ t('application.settings') }}</span>
      </ContextMenuItem>
      <ContextMenuItem
         v-if="selectedTable && selectedTable.type === 'materializedView' && customizations.materializedViewSettings"
         @select="openMaterializedViewSettingTab"
      >
         <BaseIcon icon-name="mdiWrenchCog" :size="16" />
         <span>{{ t('application.settings') }}</span>
      </ContextMenuItem>
      <ContextMenuItem
         v-if="selectedTable && selectedTable.type === 'table' && customizations.tableDuplicate && !connection.readonly"
         @select="duplicateTable"
      >
         <BaseIcon icon-name="mdiTableMultiple" :size="16" />
         <span>{{ t('database.duplicateTable') }}</span>
      </ContextMenuItem>
      <ContextMenuItem
         v-if="selectedTable && selectedTable.type === 'table' && !connection.readonly"
         @select="showEmptyModal"
      >
         <BaseIcon icon-name="mdiTableOff" :size="16" />
         <span>{{ t('database.emptyTable') }}</span>
      </ContextMenuItem>
      <ContextMenuSeparator v-if="!connection.readonly" />
      <ContextMenuItem
         v-if="!connection.readonly"
         class="text-destructive focus:text-destructive"
         @select="showDeleteModal"
      >
         <BaseIcon icon-name="mdiTableRemove" :size="16" />
         <span>{{ t('database.deleteTable') }}</span>
      </ContextMenuItem>
   </ContextMenuContent>

   <ConfirmModal
      v-if="isEmptyModal"
      @confirm="emptyTable"
      @hide="hideEmptyModal"
   >
      <template #header>
         <div class="d-flex">
            <BaseIcon
               class="text-light mr-1"
               icon-name="mdiTableOff"
               :size="24"
            /> <span class="cut-text">{{ t('database.emptyTable') }}</span>
         </div>
      </template>
      <template #body>
         <div class="mb-2">
            {{ t('database.emptyConfirm') }} "<b>{{ selectedTable.name }}</b>"?
         </div>
         <div v-if="customizations.tableTruncateDisableFKCheck">
            <label class="flex items-center gap-2 text-[13px]">
               <input
                  v-model="forceTruncate"
                  type="checkbox"
                  class="text-foreground"
               > {{ t('database.disableFKChecks') }}
            </label>
         </div>
      </template>
   </ConfirmModal>
   <ConfirmModal
      v-if="isDeleteModal"
      @confirm="deleteTable"
      @hide="hideDeleteModal"
   >
      <template #header>
         <div class="d-flex">
            <BaseIcon
               class="text-light mr-1"
               icon-name="mdiTableRemove"
               :size="24"
            />
            <span class="cut-text">{{ selectedTable.type === 'table' ? t('database.deleteTable') : t('database.deleteView') }}</span>
         </div>
      </template>
      <template #body>
         <div class="mb-2">
            {{ t('general.deleteConfirm') }} "<b>{{ selectedTable.name }}</b>"?
         </div>
      </template>
   </ConfirmModal>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '@/components/BaseConfirmModal.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import Tables from '@/ipc-api/Tables';
import { copyText } from '@/libs/copyText';
import { useConnectionsStore } from '@/stores/connections';
import { useNotificationsStore } from '@/stores/notifications';
import { useSchemaExportStore } from '@/stores/schemaExport';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const props = defineProps({
   selectedTable: Object,
   selectedSchema: String
});

const emit = defineEmits<{
   'duplicate-table': [payload: { schema: string; table: any }];
   'reload': [];
   'delete-table': [payload: { schema: string; table: any }];
}>();

const { addNotification } = useNotificationsStore();
const workspacesStore = useWorkspacesStore();
const { showExportModal } = useSchemaExportStore();
const { getConnectionByUid } = useConnectionsStore();

const { getSelected: selectedWorkspace } = storeToRefs(workspacesStore);

const {
   getWorkspace,
   newTab,
   addLoadingElement,
   removeLoadingElement,
   changeBreadcrumbs
} = workspacesStore;

const isDeleteModal = ref(false);
const isEmptyModal = ref(false);
const forceTruncate = ref(false);

const workspace = computed(() => getWorkspace(selectedWorkspace.value));
const customizations = computed(() => workspace.value && workspace.value.customizations ? workspace.value.customizations : null);
const connection = computed(() => getConnectionByUid(selectedWorkspace.value));

const showTableExportModal = () => {
   showExportModal(props.selectedSchema, props.selectedTable.name);
};

const copyName = (name: string) => {
   copyText(name);
};

const showDeleteModal = () => {
   isDeleteModal.value = true;
};

const hideDeleteModal = () => {
   isDeleteModal.value = false;
};

const showEmptyModal = () => {
   isEmptyModal.value = true;
};

const hideEmptyModal = () => {
   isEmptyModal.value = false;
};

const openTableSettingTab = () => {
   newTab({
      uid: selectedWorkspace.value,
      elementName: props.selectedTable.name,
      schema: props.selectedSchema,
      type: 'table-props',
      elementType: 'table'
   });

   changeBreadcrumbs({
      schema: props.selectedSchema,
      table: props.selectedTable.name
   });
};

const openViewSettingTab = () => {
   newTab({
      uid: selectedWorkspace.value,
      elementType: 'table',
      elementName: props.selectedTable.name,
      schema: props.selectedSchema,
      type: 'view-props'
   });

   changeBreadcrumbs({
      schema: props.selectedSchema,
      view: props.selectedTable.name
   });
};

const openMaterializedViewSettingTab = () => {
   newTab({
      uid: selectedWorkspace.value,
      elementType: 'table',
      elementName: props.selectedTable.name,
      schema: props.selectedSchema,
      type: 'materialized-view-props'
   });

   changeBreadcrumbs({
      schema: props.selectedSchema,
      view: props.selectedTable.name
   });
};

const duplicateTable = () => {
   emit('duplicate-table', { schema: props.selectedSchema, table: props.selectedTable });
};

const emptyTable = async () => {
   hideEmptyModal();

   addLoadingElement({
      name: props.selectedTable.name,
      schema: props.selectedSchema,
      type: 'table'
   });

   try {
      const { status, response } = await Tables.truncateTable({
         uid: selectedWorkspace.value,
         table: props.selectedTable.name,
         schema: props.selectedSchema,
         force: forceTruncate.value
      });

      if (status === 'success')
         emit('reload');
      else
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   removeLoadingElement({
      name: props.selectedTable.name,
      schema: props.selectedSchema,
      type: 'table'
   });
};

const deleteTable = () => {
   emit('delete-table', { schema: props.selectedSchema, table: props.selectedTable });
};
</script>
