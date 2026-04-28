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
      </template>

      <template #metadata>
         <PropertyCard
            v-if="customizations.triggerFunctionlanguages"
            :label="t('application.language')"
         >
            <BaseSelect
               v-model="localFunction.language"
               :options="customizations.triggerFunctionlanguages"
               class="!h-[30px] w-[140px]"
            />
         </PropertyCard>
         <PropertyCard
            v-if="customizations.definer"
            :label="t('database.definer')"
         >
            <BaseSelect
               v-model="localFunction.definer"
               :options="workspace.users"
               :option-label="(user: any) => user.value === '' ? t('database.currentUser') : `${user.name}@${user.host}`"
               :option-track-by="(user: any) => user.value === '' ? '' : `\`${user.name}\`@\`${user.host}\``"
               class="!h-[30px] w-[180px]"
            />
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
</template>

<script setup lang="ts">
import { Ace } from 'ace-builds';
import { AlterFunctionParams, TriggerFunctionInfos } from 'common/interfaces/antares';
import { storeToRefs } from 'pinia';
import { Component, computed, onBeforeUnmount, onMounted, onUnmounted, Ref, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import BaseLoader from '@/components/BaseLoader.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import QueryEditor from '@/components/QueryEditor.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PropertyCard from '@/components/workspace/props/PropertyCard.vue';
import PropsTabShell from '@/components/workspace/props/PropsTabShell.vue';
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
   changeBreadcrumbs,
   setUnsavedChanges
} = workspacesStore;

const queryEditor: Ref<Component & {editor: Ace.Editor; $el: HTMLElement}> = ref(null);
const isLoading = ref(false);
const isSaving = ref(false);
const originalFunction: Ref<TriggerFunctionInfos> = ref(null);
const localFunction: Ref<TriggerFunctionInfos> = ref(null);
const lastFunction = ref(null);
const sqlProxy = ref('');
const editorHeight = ref(300);

const workspace = computed(() => getWorkspace(props.connection.uid));
const customizations = computed(() => workspace.value.customizations);
const isChanged = computed(() => JSON.stringify(originalFunction.value) !== JSON.stringify(localFunction.value));

const getFunctionData = async () => {
   if (!props.function) return;

   isLoading.value = true;
   localFunction.value = { name: '', sql: '', type: '', definer: null };
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
      const { status, response } = await Functions.alterTriggerFunction(params);

      if (status === 'success') {
         const oldName = originalFunction.value.name;

         await refreshStructure(props.connection.uid);

         if (oldName !== localFunction.value.name) {
            renameTabs({
               uid: props.connection.uid,
               schema: props.schema,
               elementName: oldName,
               elementNewName: localFunction.value.name,
               elementType: 'triggerFunction'
            });

            changeBreadcrumbs({ schema: props.schema, triggerFunction: localFunction.value.name });
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

watch(consoleHeight, () => {
   resizeQueryEditor();
});

watch(() => props.isSelected, (val) => {
   if (val) changeBreadcrumbs({ schema: props.schema });
});

watch(isChanged, (val) => {
   setUnsavedChanges({ uid: props.connection.uid, tUid: props.tabUid, isChanged: val });
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
