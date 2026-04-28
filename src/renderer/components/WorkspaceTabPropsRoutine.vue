<template>
   <PropsTabShell :is-selected="isSelected" :schema="schema">
      <template #toolbar>
         <Button
            variant="default"
            size="sm"
            :disabled="!isChanged || isSaving"
            @click="saveChanges"
         >
            <BaseIcon
               class="mr-1"
               icon-name="mdiContentSave"
               :size="16"
            />
            {{ t('general.save') }}
         </Button>
         <Button
            variant="ghost"
            size="sm"
            :disabled="!isChanged"
            :title="t('database.clearChanges')"
            @click="clearChanges"
         >
            <BaseIcon
               class="mr-1"
               icon-name="mdiDeleteSweep"
               :size="16"
            />
            {{ t('general.clear') }}
         </Button>

         <Separator orientation="vertical" class="!h-5 mx-1" />

         <Button
            variant="outline"
            size="sm"
            :disabled="isChanged"
            @click="runRoutineCheck"
         >
            <BaseIcon
               class="mr-1"
               icon-name="mdiPlay"
               :size="16"
            />
            {{ t('general.run') }}
         </Button>
         <Button
            variant="outline"
            size="sm"
            @click="showParamsModal"
         >
            <BaseIcon
               class="mr-1"
               icon-name="mdiDotsHorizontal"
               :size="16"
            />
            {{ t('database.parameters') }}
         </Button>
      </template>

      <template #metadata>
         <PropertyCard :label="t('general.name')">
            <Input
               ref="firstInput"
               v-model="localRoutine.name"
               type="text"
               :class="['!h-[30px] w-[200px]', !isTableNameValid ? '!border-destructive' : '']"
            />
         </PropertyCard>
         <PropertyCard
            v-if="customizations.languages"
            :label="t('application.language')"
         >
            <BaseSelect
               v-model="localRoutine.language"
               :options="customizations.languages"
               class="!h-[30px] w-[140px]"
            />
         </PropertyCard>
         <PropertyCard
            v-if="customizations.definer"
            :label="t('database.definer')"
         >
            <BaseSelect
               v-model="localRoutine.definer"
               :options="[{value: '', name: t('database.currentUser')}, ...workspace.users]"
               :option-label="(user: any) => user.value === '' ? user.name : `${user.name}@${user.host}`"
               :option-track-by="(user: any) => user.value === '' ? '' : `\`${user.name}\`@\`${user.host}\``"
               class="!h-[30px] w-[180px]"
            />
         </PropertyCard>
         <PropertyCard
            v-if="customizations.comment"
            :label="t('database.comment')"
         >
            <Input
               v-model="localRoutine.comment"
               type="text"
               class="!h-[30px] w-[220px]"
            />
         </PropertyCard>
         <PropertyCard :label="t('database.sqlSecurity')">
            <BaseSelect
               v-model="localRoutine.security"
               :options="['DEFINER', 'INVOKER']"
               class="!h-[30px] w-[140px]"
            />
         </PropertyCard>
         <PropertyCard
            v-if="customizations.procedureDataAccess"
            :label="t('database.dataAccess')"
         >
            <BaseSelect
               v-model="localRoutine.dataAccess"
               :options="['CONTAINS SQL', 'NO SQL', 'READS SQL DATA', 'MODIFIES SQL DATA']"
               class="!h-[30px] w-[180px]"
            />
         </PropertyCard>
         <PropertyCard v-if="customizations.procedureDeterministic">
            <label class="flex h-[30px] cursor-pointer items-center gap-2 text-xs">
               <Checkbox v-model:checked="localRoutine.deterministic" />
               {{ t('database.deterministic') }}
            </label>
         </PropertyCard>
      </template>

      <template #content>
         <BaseLoader v-if="isLoading" />
         <Label class="!text-xs !text-muted-foreground !font-normal !m-0 ml-2">
            {{ t('database.routineBody') }}
         </Label>
         <QueryEditor
            v-show="isSelected"
            ref="queryEditor"
            v-model="localRoutine.sql"
            :workspace="workspace"
            :schema="schema"
            :height="editorHeight"
         />
      </template>
   </PropsTabShell>
   <WorkspaceTabPropsRoutineParamsModal
      v-if="isParamsModal"
      :local-parameters="localRoutine.parameters"
      :workspace="workspace"
      :routine="localRoutine.name"
      @hide="hideParamsModal"
      @parameters-update="parametersUpdate"
   />
   <ModalAskParameters
      v-if="isAskingParameters"
      :local-routine="localRoutine"
      :client="workspace.client"
      @confirm="runRoutine"
      @close="hideAskParamsModal"
   />
</template>

<script setup lang="ts">
import { Ace } from 'ace-builds';
import { AlterRoutineParams, FunctionParam, RoutineInfos } from 'common/interfaces/antares';
import { uidGen } from 'common/libs/uidGen';
import { storeToRefs } from 'pinia';
import { Component, computed, onBeforeUnmount, onMounted, onUnmounted, Ref, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import BaseLoader from '@/components/BaseLoader.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import ModalAskParameters from '@/components/ModalAskParameters.vue';
import QueryEditor from '@/components/QueryEditor.vue';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import PropertyCard from '@/components/workspace/props/PropertyCard.vue';
import PropsTabShell from '@/components/workspace/props/PropsTabShell.vue';
import WorkspaceTabPropsRoutineParamsModal from '@/components/WorkspaceTabPropsRoutineParamsModal.vue';
import Routines from '@/ipc-api/Routines';
import { useConsoleStore } from '@/stores/console';
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const props = defineProps({
   tabUid: String,
   connection: Object,
   routine: String,
   isSelected: Boolean,
   schema: String
});

const { addNotification } = useNotificationsStore();
const workspacesStore = useWorkspacesStore();
const { consoleHeight } = storeToRefs(useConsoleStore());

const {
   getWorkspace,
   refreshStructure,
   renameTabs,
   newTab,
   changeBreadcrumbs,
   setUnsavedChanges
} = workspacesStore;

const queryEditor: Ref<Component & {editor: Ace.Editor; $el: HTMLElement}> = ref(null);
const firstInput: Ref<HTMLInputElement> = ref(null);
const isLoading = ref(false);
const isSaving = ref(false);
const isParamsModal = ref(false);
const isAskingParameters = ref(false);
const originalRoutine: Ref<RoutineInfos> = ref(null);
const localRoutine: Ref<RoutineInfos> = ref(null);
const lastRoutine = ref(null);
const sqlProxy = ref('');
const editorHeight = ref(300);

const workspace = computed(() => {
   return getWorkspace(props.connection.uid);
});

const customizations = computed(() => {
   return workspace.value.customizations;
});

const isChanged = computed(() => {
   return JSON.stringify(originalRoutine.value) !== JSON.stringify(localRoutine.value);
});

const isTableNameValid = computed(() => {
   return localRoutine.value.name !== '';
});

const getRoutineData = async () => {
   if (!props.routine) return;

   localRoutine.value = { name: '', sql: '', definer: null };
   isLoading.value = true;
   lastRoutine.value = props.routine;

   const params = {
      uid: props.connection.uid,
      schema: props.schema,
      routine: props.routine
   };

   try {
      const { status, response } = await Routines.getRoutineInformations(params);
      if (status === 'success') {
         originalRoutine.value = response;

         originalRoutine.value.parameters = [...originalRoutine.value.parameters.map(param => {
            param._antares_id = uidGen();
            return param;
         })];

         localRoutine.value = JSON.parse(JSON.stringify(originalRoutine.value));
         sqlProxy.value = localRoutine.value.sql;
      }
      else
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   resizeQueryEditor();
   isLoading.value = false;
};

const saveChanges = async () => {
   if (isSaving.value) return;
   isSaving.value = true;
   const params = {
      uid: props.connection.uid as string,
      routine: {
         ...localRoutine.value,
         schema: props.schema,
         oldName: originalRoutine.value.name
      } as AlterRoutineParams
   };

   try {
      const { status, response } = await Routines.alterRoutine(params);

      if (status === 'success') {
         const oldName = originalRoutine.value.name;

         await refreshStructure(props.connection.uid);

         if (oldName !== localRoutine.value.name) {
            renameTabs({
               uid: props.connection.uid,
               schema: props.schema,
               elementName: oldName,
               elementNewName: localRoutine.value.name,
               elementType: 'procedure'
            });

            changeBreadcrumbs({ schema: props.schema, routine: localRoutine.value.name });
         }
         else
            getRoutineData();
      }
      else
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   isSaving.value = false;
};

const clearChanges = () => {
   localRoutine.value = JSON.parse(JSON.stringify(originalRoutine.value));
   queryEditor.value.editor.session.setValue(localRoutine.value.sql);
};

const resizeQueryEditor = () => {
   if (queryEditor.value) {
      let sizeToSubtract = 0;
      const footer = document.getElementById('footer');
      if (footer) sizeToSubtract += footer.offsetHeight;
      sizeToSubtract += consoleHeight.value;

      const size = window.innerHeight - queryEditor.value.$el.getBoundingClientRect().top - sizeToSubtract;
      editorHeight.value = size;
      queryEditor.value.editor.resize();
   }
};

const parametersUpdate = (parameters: FunctionParam[]) => {
   localRoutine.value = { ...localRoutine.value, parameters };
};

const runRoutineCheck = () => {
   if (localRoutine.value.parameters.length)
      showAskParamsModal();
   else
      runRoutine();
};

const runRoutine = (params?: string[]) => {
   if (!params) params = [];

   let sql;
   switch (props.connection.client) { // TODO: move in a better place
      case 'maria':
      case 'mysql':
      case 'pg':
         sql = `CALL ${originalRoutine.value.name}(${params.join(',')})`;
         break;
      case 'firebird':
         sql = `EXECUTE PROCEDURE "${originalRoutine.value.name}"(${params.join(',')})`;
         break;
      case 'mssql':
         sql = `EXEC ${originalRoutine.value.name} ${params.join(',')}`;
         break;
      default:
         sql = `CALL \`${originalRoutine.value.name}\`(${params.join(',')})`;
   }

   newTab({ uid: props.connection.uid, content: sql, type: 'query', autorun: true });
};

const showParamsModal = () => {
   isParamsModal.value = true;
};

const hideParamsModal = () => {
   isParamsModal.value = false;
};

const showAskParamsModal = () => {
   isAskingParameters.value = true;
};

const hideAskParamsModal = () => {
   isAskingParameters.value = false;
};

const saveContentListener = () => {
   const hasModalOpen = !!document.querySelectorAll('.modal.active').length;
   if (props.isSelected && !hasModalOpen && isChanged.value)
      saveChanges();
};

watch(() => props.schema, async () => {
   if (props.isSelected) {
      await getRoutineData();
      queryEditor.value.editor.session.setValue(localRoutine.value.sql);
      lastRoutine.value = props.routine;
   }
});

watch(() => props.routine, async () => {
   if (props.isSelected) {
      await getRoutineData();
      queryEditor.value.editor.session.setValue(localRoutine.value.sql);
      lastRoutine.value = props.routine;
   }
});

watch(() => props.isSelected, async (val) => {
   if (val) {
      changeBreadcrumbs({ schema: props.schema, routine: props.routine });

      setTimeout(() => {
         resizeQueryEditor();
      }, 200);

      if (lastRoutine.value !== props.routine)
         getRoutineData();
   }
});

watch(isChanged, (val) => {
   setUnsavedChanges({ uid: props.connection.uid, tUid: props.tabUid, isChanged: val });
});

watch(consoleHeight, () => {
   resizeQueryEditor();
});

(async () => {
   await getRoutineData();
   queryEditor.value.editor.session.setValue(localRoutine.value.sql);
})();

onMounted(() => {
   window.addEventListener('resize', resizeQueryEditor);
   window.addEventListener('antares:save-content', saveContentListener);
});

onUnmounted(() => {
   window.removeEventListener('resize', resizeQueryEditor);
});

onBeforeUnmount(() => {
   window.removeEventListener('antares:save-content', saveContentListener);
});
</script>
