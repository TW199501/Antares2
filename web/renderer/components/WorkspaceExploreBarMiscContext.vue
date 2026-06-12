<template>
   <ContextMenuContent class="min-w-[180px]">
      <ContextMenuItem
         v-if="['procedure', 'routine', 'function'].includes(selectedMisc.type)"
         @select="runElementCheck"
      >
         <BaseIcon icon-name="mdiPlay" :size="16" />
         <span>{{ t('general.run') }}</span>
      </ContextMenuItem>
      <ContextMenuItem
         v-if="selectedMisc.type === 'trigger' && customizations.triggerEnableDisable && !connection.readonly"
         @select="toggleTrigger"
      >
         <template v-if="!selectedMisc.enabled">
            <BaseIcon icon-name="mdiPlay" :size="16" />
            <span>{{ t('general.enable') }}</span>
         </template>
         <template v-else>
            <BaseIcon icon-name="mdiPause" :size="16" />
            <span>{{ t('general.disable') }}</span>
         </template>
      </ContextMenuItem>
      <ContextMenuItem
         v-if="selectedMisc.type === 'scheduler' && !connection.readonly"
         @select="toggleScheduler"
      >
         <template v-if="!selectedMisc.enabled">
            <BaseIcon icon-name="mdiPlay" :size="16" />
            <span>{{ t('general.enable') }}</span>
         </template>
         <template v-else>
            <BaseIcon icon-name="mdiPause" :size="16" />
            <span>{{ t('general.disable') }}</span>
         </template>
      </ContextMenuItem>
      <ContextMenuItem @select="copyName(selectedMisc.name)">
         <BaseIcon icon-name="mdiContentCopy" :size="16" />
         <span>{{ t('general.copyName') }}</span>
      </ContextMenuItem>
      <ContextMenuSeparator v-if="!connection.readonly" />
      <ContextMenuItem
         v-if="!connection.readonly"
         class="text-destructive focus:text-destructive"
         @select="showDeleteModal"
      >
         <BaseIcon icon-name="mdiTableRemove" :size="16" />
         <span>{{ t('general.delete') }}</span>
      </ContextMenuItem>
   </ContextMenuContent>

   <ConfirmModal
      v-if="isDeleteModal"
      @confirm="deleteMisc"
      @hide="hideDeleteModal"
   >
      <template #header>
         <div class="flex">
            <BaseIcon
               class="text-light mr-1"
               icon-name="mdiDelete"
               :size="24"
            />
            <span class="cut-text">{{ deleteMessage }}</span>
         </div>
      </template>
      <template #body>
         <div class="mb-2">
            {{ t('general.deleteConfirm') }} "<b>{{ selectedMisc.name }}</b>"?
         </div>
      </template>
   </ConfirmModal>
   <ModalAskParameters
      v-if="isAskingParameters"
      :local-routine="(localElement as any)"
      :client="workspace.client"
      @confirm="runElement"
      @close="hideAskParamsModal"
   />
</template>

<script setup lang="ts">
import { EventInfos, FunctionInfos, IpcResponse, RoutineInfos, TriggerInfos } from 'common/interfaces/antares';
import { storeToRefs } from 'pinia';
import { computed, Prop, Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '@/components/BaseConfirmModal.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import ModalAskParameters from '@/components/ModalAskParameters.vue';
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import Functions from '@/ipc-api/Functions';
import Routines from '@/ipc-api/Routines';
import Schedulers from '@/ipc-api/Schedulers';
import Triggers from '@/ipc-api/Triggers';
import { copyText } from '@/libs/copyText';
import { useConnectionsStore } from '@/stores/connections';
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const props = defineProps({
   selectedMisc: Object as Prop<{ name:string; type:string; enabled?: boolean }>,
   selectedSchema: String
});

const emit = defineEmits<{
   'reload': [];
}>();

const { addNotification } = useNotificationsStore();
const workspacesStore = useWorkspacesStore();
const { getConnectionByUid } = useConnectionsStore();

const { getSelected: selectedWorkspace } = storeToRefs(workspacesStore);

const {
   getWorkspace,
   addLoadingElement,
   removeLoadingElement,
   removeTabs,
   newTab
} = workspacesStore;

const isDeleteModal = ref(false);
const isAskingParameters = ref(false);
const localElement: Ref<TriggerInfos | RoutineInfos | FunctionInfos | EventInfos> = ref(null);

const workspace = computed(() => {
   return getWorkspace(selectedWorkspace.value);
});

const customizations = computed(() => {
   return getWorkspace(selectedWorkspace.value).customizations;
});
const connection = computed(() => getConnectionByUid(selectedWorkspace.value));

const deleteMessage = computed(() => {
   switch (props.selectedMisc.type) {
      case 'trigger':
         return t('database.deleteTrigger');
      case 'routine':
      case 'procedure':
         return t('database.deleteRoutine');
      case 'function':
      case 'triggerFunction':
         return t('database.deleteFunction');
      case 'scheduler':
         return t('database.deleteScheduler');
      default:
         return '';
   }
});

const copyName = (name: string) => {
   copyText(name);
};

const showDeleteModal = () => {
   isDeleteModal.value = true;
};

const hideDeleteModal = () => {
   isDeleteModal.value = false;
};

const showAskParamsModal = () => {
   isAskingParameters.value = true;
};

const hideAskParamsModal = () => {
   isAskingParameters.value = false;
};

const deleteMisc = async () => {
   try {
      let res: IpcResponse;

      switch (props.selectedMisc.type) {
         case 'trigger':
            res = await Triggers.dropTrigger({
               uid: selectedWorkspace.value,
               schema: props.selectedSchema,
               trigger: props.selectedMisc.name
            });
            break;
         case 'routine':
         case 'procedure':
            res = await Routines.dropRoutine({
               uid: selectedWorkspace.value,
               schema: props.selectedSchema,
               routine: props.selectedMisc.name
            });
            break;
         case 'function':
         case 'triggerFunction':
            res = await Functions.dropFunction({
               uid: selectedWorkspace.value,
               schema: props.selectedSchema,
               func: props.selectedMisc.name
            });
            break;
         case 'scheduler':
            res = await Schedulers.dropScheduler({
               uid: selectedWorkspace.value,
               schema: props.selectedSchema,
               scheduler: props.selectedMisc.name
            });
            break;
      }

      const { status, response } = res;

      if (status === 'success') {
         removeTabs({
            uid: selectedWorkspace.value,
            elementName: props.selectedMisc.name,
            elementType: props.selectedMisc.type,
            schema: props.selectedSchema
         });

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

const runElementCheck = () => {
   if (['procedure', 'routine'].includes(props.selectedMisc.type))
      runRoutineCheck();
   else if (props.selectedMisc.type === 'function')
      runFunctionCheck();
};

const runElement = (params: string[]) => {
   if (['procedure', 'routine'].includes(props.selectedMisc.type))
      runRoutine(params);
   else if (props.selectedMisc.type === 'function')
      runFunction(params);
};

const runRoutineCheck = async () => {
   const params = {
      uid: selectedWorkspace.value,
      schema: props.selectedSchema,
      routine: props.selectedMisc.name
   };

   try {
      const { status, response } = await Routines.getRoutineInformations(params);
      if (status === 'success')
         localElement.value = response;

      else
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   if ((localElement.value as RoutineInfos).parameters.length)
      showAskParamsModal();
   else
      runRoutine();
};

const runRoutine = (params?: string[]) => {
   if (!params) params = [];

   let sql;
   switch (workspace.value.client) { // TODO: move in a better place
      case 'maria':
      case 'mysql':
      case 'pg':
         sql = `CALL ${localElement.value.name}(${params.join(',')})`;
         break;
      case 'firebird':
         sql = `EXECUTE PROCEDURE "${localElement.value.name}"(${params.join(',')})`;
         break;
      // case 'mssql':
      //    sql = `EXEC ${localElement.value.name} ${params.join(',')}`;
      //    break;
      default:
         sql = `CALL \`${localElement.value.name}\`(${params.join(',')})`;
   }

   newTab({
      uid: workspace.value.uid,
      content: sql,
      type: 'query',
      schema: props.selectedSchema,
      autorun: true
   });
};

const runFunctionCheck = async () => {
   const params = {
      uid: selectedWorkspace.value,
      schema: props.selectedSchema,
      func: props.selectedMisc.name
   };

   try {
      const { status, response } = await Functions.getFunctionInformations(params);
      if (status === 'success')
         localElement.value = response;
      else
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   if ((localElement.value as FunctionInfos).parameters.length)
      showAskParamsModal();
   else
      runFunction();
};

const runFunction = (params?: string[]) => {
   if (!params) params = [];

   let sql;
   switch (workspace.value.client) { // TODO: move in a better place
      case 'maria':
      case 'mysql':
         sql = `SELECT \`${localElement.value.name}\` (${params.join(',')})`;
         break;
      case 'pg':
         sql = `SELECT ${localElement.value.name}(${params.join(',')})`;
         break;
      // case 'mssql':
      //    sql = `SELECT ${localElement.value.name} ${params.join(',')}`;
      //    break;
      default:
         sql = `SELECT \`${localElement.value.name}\` (${params.join(',')})`;
   }

   newTab({
      uid: workspace.value.uid,
      content: sql,
      type: 'query',
      schema: props.selectedSchema,
      autorun: true
   });
};

const toggleTrigger = async () => {
   addLoadingElement({
      name: props.selectedMisc.name,
      schema: props.selectedSchema,
      type: 'trigger'
   });

   try {
      const { status, response } = await Triggers.toggleTrigger({
         uid: selectedWorkspace.value,
         schema: props.selectedSchema,
         trigger: props.selectedMisc.name,
         enabled: props.selectedMisc.enabled
      });

      if (status !== 'success')
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   removeLoadingElement({
      name: props.selectedMisc.name,
      schema: props.selectedSchema,
      type: 'trigger'
   });

   emit('reload');
};

const toggleScheduler = async () => {
   addLoadingElement({
      name: props.selectedMisc.name,
      schema: props.selectedSchema,
      type: 'scheduler'
   });

   try {
      const { status, response } = await Schedulers.toggleScheduler({
         uid: selectedWorkspace.value,
         schema: props.selectedSchema,
         scheduler: props.selectedMisc.name,
         enabled: props.selectedMisc.enabled
      });

      if (status !== 'success')
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   removeLoadingElement({
      name: props.selectedMisc.name,
      schema: props.selectedSchema,
      type: 'scheduler'
   });

   emit('reload');
};
</script>
