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
            @click="runFunctionCheck"
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
               v-model="localFunction.name"
               type="text"
               :class="['!h-[30px] w-[200px]', !isTableNameValid ? '!border-destructive' : '']"
            />
         </PropertyCard>
         <PropertyCard
            v-if="customizations.languages"
            :label="t('application.language')"
         >
            <BaseSelect
               v-model="localFunction.language"
               :options="customizations.languages"
               class="!h-[30px] w-[140px]"
            />
         </PropertyCard>
         <PropertyCard
            v-if="customizations.definer"
            :label="t('database.definer')"
         >
            <BaseSelect
               v-model="localFunction.definer"
               :options="[{value: '', name:t('database.currentUser')}, ...workspace.users]"
               :option-label="(user: any) => user.value === '' ? user.name : `${user.name}@${user.host}`"
               :option-track-by="(user: any) => user.value === '' ? '' : `\`${user.name}\`@\`${user.host}\``"
               class="!h-[30px] w-[180px]"
            />
         </PropertyCard>
         <PropertyCard :label="t('database.returns')">
            <div class="flex items-center gap-1">
               <BaseSelect
                  v-model="localFunction.returns"
                  class="uppercase !h-[30px] w-[150px]"
                  :options="[{ name: 'VOID' }, ...(workspace.dataTypes as any)]"
                  group-label="group"
                  group-values="types"
                  option-label="name"
                  option-track-by="name"
               />
               <Input
                  v-if="customizations.parametersLength"
                  v-model="localFunction.returnsLength"
                  type="number"
                  min="0"
                  :placeholder="t('database.length')"
                  class="!h-[30px] w-[100px]"
               />
            </div>
         </PropertyCard>
         <PropertyCard
            v-if="customizations.comment"
            :label="t('database.comment')"
         >
            <Input
               v-model="localFunction.comment"
               type="text"
               class="!h-[30px] w-[220px]"
            />
         </PropertyCard>
         <PropertyCard :label="t('database.sqlSecurity')">
            <BaseSelect
               v-model="localFunction.security"
               :options="['DEFINER', 'INVOKER']"
               class="!h-[30px] w-[140px]"
            />
         </PropertyCard>
         <PropertyCard
            v-if="customizations.functionDataAccess"
            :label="t('database.dataAccess')"
         >
            <BaseSelect
               v-model="localFunction.dataAccess"
               :options="['CONTAINS SQL', 'NO SQL', 'READS SQL DATA', 'MODIFIES SQL DATA']"
               class="!h-[30px] w-[180px]"
            />
         </PropertyCard>
         <PropertyCard v-if="customizations.functionDeterministic">
            <label class="flex h-[30px] cursor-pointer items-center gap-2 text-[12px]">
               <Checkbox v-model:checked="localFunction.deterministic" />
               {{ t('database.deterministic') }}
            </label>
         </PropertyCard>
      </template>

      <template #content>
         <BaseLoader v-if="isLoading" />
         <Label class="!text-[12px] !text-muted-foreground !font-normal !m-0 ml-2">
            {{ t('database.functionBody') }}
         </Label>
         <QueryEditor
            v-show="isSelected"
            ref="queryEditor"
            v-model="localFunction.sql"
            :workspace="workspace"
            :schema="schema"
            :height="editorHeight"
         />
      </template>
   </PropsTabShell>
   <WorkspaceTabPropsFunctionParamsModal
      v-if="isParamsModal"
      :local-parameters="localFunction.parameters"
      :workspace="workspace"
      :func="localFunction.name"
      @hide="hideParamsModal"
      @parameters-update="parametersUpdate"
   />
   <ModalAskParameters
      v-if="isAskingParameters"
      :local-routine="localFunction"
      :client="workspace.client"
      @confirm="runFunction"
      @close="hideAskParamsModal"
   />
</template>

<script setup lang="ts">
import { Ace } from 'ace-builds';
import { AlterFunctionParams, FunctionInfos, FunctionParam } from 'common/interfaces/antares';
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
import WorkspaceTabPropsFunctionParamsModal from '@/components/WorkspaceTabPropsFunctionParamsModal.vue';
import Functions from '@/ipc-api/Functions';
import { useConsoleStore } from '@/stores/console';
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const props = defineProps({
   tabUid: String,
   connection: Object,
   function: String,
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
const originalFunction: Ref<FunctionInfos> = ref(null);
const localFunction: Ref<FunctionInfos> = ref({ name: '', sql: '', definer: null });
const lastFunction = ref(null);
const sqlProxy = ref('');
const editorHeight = ref(300);

const workspace = computed(() => {
   return getWorkspace(props.connection.uid);
});

const customizations = computed(() => {
   return workspace.value.customizations;
});

const isChanged = computed(() => {
   return JSON.stringify(originalFunction.value) !== JSON.stringify(localFunction.value);
});

const isTableNameValid = computed(() => {
   return localFunction.value.name !== '';
});

const getFunctionData = async () => {
   if (!props.function) return;

   isLoading.value = true;
   localFunction.value = { name: '', sql: '', definer: null };
   lastFunction.value = props.function;

   const params = {
      uid: props.connection.uid,
      schema: props.schema,
      func: props.function
   };

   try {
      const { status, response } = await Functions.getFunctionInformations(params);
      if (status === 'success') {
         originalFunction.value = response;

         originalFunction.value.parameters = [...originalFunction.value.parameters.map(param => {
            param._antares_id = uidGen();
            return param;
         })];

         localFunction.value = JSON.parse(JSON.stringify(originalFunction.value));
         sqlProxy.value = localFunction.value.sql;
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
      uid: props.connection.uid,
      func: {
         ...localFunction.value,
         schema: props.schema,
         oldName: originalFunction.value.name
      } as AlterFunctionParams
   };

   try {
      const { status, response } = await Functions.alterFunction(params);

      if (status === 'success') {
         const oldName = originalFunction.value.name;

         await refreshStructure(props.connection.uid);

         if (oldName !== localFunction.value.name) {
            renameTabs({
               uid: props.connection.uid,
               schema: props.schema,
               elementName: oldName,
               elementNewName: localFunction.value.name,
               elementType: 'function'
            });

            changeBreadcrumbs({ schema: props.schema, function: localFunction.value.name });
         }
         else
            getFunctionData();
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
   localFunction.value = JSON.parse(JSON.stringify(originalFunction.value));
   queryEditor.value.editor.session.setValue(localFunction.value.sql);
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
   localFunction.value = { ...localFunction.value, parameters };
};

const runFunctionCheck = () => {
   if (localFunction.value.parameters.length)
      showAskParamsModal();
   else
      runFunction();
};

const runFunction = (params?: string[]) => {
   if (!params) params = [];

   let sql;
   switch (props.connection.client) { // TODO: move in a better place
      case 'maria':
      case 'mysql':
         sql = `SELECT \`${originalFunction.value.name}\` (${params.join(',')})`;
         break;
      case 'pg':
         sql = `SELECT ${originalFunction.value.name}(${params.join(',')})`;
         break;
      case 'mssql':
         sql = `SELECT ${originalFunction.value.name} ${params.join(',')}`;
         break;
      default:
         sql = `SELECT \`${originalFunction.value.name}\` (${params.join(',')})`;
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
      await getFunctionData();
      queryEditor.value.editor.session.setValue(localFunction.value.sql);
      lastFunction.value = props.function;
   }
});

watch(() => props.function, async () => {
   if (props.isSelected) {
      await getFunctionData();
      queryEditor.value.editor.session.setValue(localFunction.value.sql);
      lastFunction.value = props.function;
   }
});

watch(() => props.isSelected, async (val) => {
   if (val) {
      changeBreadcrumbs({ schema: props.schema, function: props.function });

      setTimeout(() => {
         resizeQueryEditor();
      }, 200);

      if (lastFunction.value !== props.function)
         getFunctionData();
   }
});

watch(isChanged, (val) => {
   setUnsavedChanges({ uid: props.connection.uid, tUid: props.tabUid, isChanged: val });
});

watch(consoleHeight, () => {
   resizeQueryEditor();
});

(async () => {
   await getFunctionData();
   queryEditor.value.editor.session.setValue(localFunction.value.sql);
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
