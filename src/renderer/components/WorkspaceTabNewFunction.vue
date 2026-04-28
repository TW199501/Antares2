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
               class="!h-[30px] w-[200px]"
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
            <div class="flex items-center gap-2">
               <BaseSelect
                  v-model="localFunction.returns"
                  :options="[{ name: 'VOID' }, ...(workspace.dataTypes as any)]"
                  group-label="group"
                  group-values="types"
                  option-label="name"
                  option-track-by="name"
                  class="!h-[30px] w-[150px] uppercase"
               />
               <Input
                  v-if="customizations.parametersLength"
                  v-model="localFunction.returnsLength"
                  type="number"
                  min="0"
                  :placeholder="t('database.length')"
                  class="!h-[30px] w-[120px]"
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
            <label class="flex h-[30px] cursor-pointer items-center gap-2 text-xs">
               <Checkbox v-model:checked="localFunction.deterministic" />
               {{ t('database.deterministic') }}
            </label>
         </PropertyCard>
      </template>

      <template #content>
         <BaseLoader v-if="isLoading" />
         <Label class="!text-xs !text-muted-foreground !font-normal !m-0 ml-2">
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
</template>

<script setup lang="ts">
import { Ace } from 'ace-builds';
import { FunctionInfos, FunctionParam } from 'common/interfaces/antares';
import { storeToRefs } from 'pinia';
import { Component, computed, onBeforeUnmount, onMounted, onUnmounted, Ref, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import BaseLoader from '@/components/BaseLoader.vue';
import BaseSelect from '@/components/BaseSelect.vue';
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
   tab: Object,
   isSelected: Boolean,
   schema: String
});

const { addNotification } = useNotificationsStore();
const workspacesStore = useWorkspacesStore();
const { consoleHeight } = storeToRefs(useConsoleStore());

const {
   getWorkspace,
   refreshStructure,
   changeBreadcrumbs,
   setUnsavedChanges,
   newTab,
   removeTab
} = workspacesStore;

const queryEditor: Ref<Component & {editor: Ace.Editor; $el: HTMLElement}> = ref(null);
const firstInput: Ref<HTMLInputElement> = ref(null);
const isLoading = ref(false);
const isSaving = ref(false);
const isParamsModal = ref(false);
const originalFunction: Ref<FunctionInfos> = ref(null);
const localFunction = ref(null);
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

const saveChanges = async () => {
   if (isSaving.value) return;
   isSaving.value = true;
   const params = {
      uid: props.connection.uid,
      schema: props.schema,
      ...localFunction.value
   };

   try {
      const { status, response } = await Functions.createFunction(params);

      if (status === 'success') {
         await refreshStructure(props.connection.uid);

         newTab({
            uid: props.connection.uid,
            schema: props.schema,
            elementName: localFunction.value.name,
            elementType: 'function',
            type: 'function-props'
         });

         removeTab({ uid: props.connection.uid, tab: props.tab.uid });
         changeBreadcrumbs({ schema: props.schema, function: localFunction.value.name });
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

const showParamsModal = () => {
   isParamsModal.value = true;
};

const hideParamsModal = () => {
   isParamsModal.value = false;
};

const saveContentListener = () => {
   const hasModalOpen = !!document.querySelectorAll('.modal.active').length;
   if (props.isSelected && !hasModalOpen && isChanged.value)
      saveChanges();
};

watch(() => props.isSelected, (val) => {
   if (val) changeBreadcrumbs({ schema: props.schema });
});

watch(isChanged, (val) => {
   setUnsavedChanges({ uid: props.connection.uid, tUid: props.tabUid, isChanged: val });
});

watch(consoleHeight, () => {
   resizeQueryEditor();
});

originalFunction.value = {
   sql: customizations.value.functionSql,
   language: customizations.value.languages ? customizations.value.languages[0] : null,
   name: '',
   definer: '',
   comment: '',
   security: 'DEFINER',
   dataAccess: 'CONTAINS SQL',
   deterministic: false,
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   returns: workspace.value.dataTypes.length ? (workspace.value.dataTypes[0] as any).types[0].name : null
};

localFunction.value = JSON.parse(JSON.stringify(originalFunction.value));

setTimeout(() => {
   resizeQueryEditor();
}, 50);

onMounted(() => {
   if (props.isSelected)
      changeBreadcrumbs({ schema: props.schema });

   window.addEventListener('antares:save-content', saveContentListener);

   setTimeout(() => {
      firstInput.value?.focus?.();
   }, 100);
});

onBeforeUnmount(() => {
   window.removeEventListener('antares:save-content', saveContentListener);
});

onUnmounted(() => {
   window.removeEventListener('resize', resizeQueryEditor);
});
</script>
