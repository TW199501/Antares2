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
         <PropertyCard :label="t('general.name')">
            <Input
               v-model="localView.name"
               type="text"
               class="!h-[30px] w-[200px]"
            />
         </PropertyCard>
         <PropertyCard
            v-if="workspace.customizations.definer"
            :label="t('database.definer')"
         >
            <BaseSelect
               v-model="localView.definer"
               :options="users"
               :option-label="(user: any) => user.value === '' ? t('database.currentUser') : `${user.name}@${user.host}`"
               :option-track-by="(user: any) => user.value === '' ? '' : `\`${user.name}\`@\`${user.host}\``"
               class="!h-[30px] w-[180px]"
            />
         </PropertyCard>
         <PropertyCard
            v-if="workspace.customizations.viewSqlSecurity"
            :label="t('database.sqlSecurity')"
         >
            <BaseSelect
               v-model="localView.security"
               :options="['DEFINER', 'INVOKER']"
               class="!h-[30px] w-[140px]"
            />
         </PropertyCard>
         <PropertyCard
            v-if="workspace.customizations.viewAlgorithm"
            :label="t('database.algorithm')"
         >
            <BaseSelect
               v-model="localView.algorithm"
               :options="['UNDEFINED', 'MERGE', 'TEMPTABLE']"
               class="!h-[30px] w-[140px]"
            />
         </PropertyCard>
         <PropertyCard
            v-if="workspace.customizations.viewUpdateOption"
            :label="t('database.updateOption')"
         >
            <BaseSelect
               v-model="localView.updateOption"
               :option-track-by="(user: any) => user.value"
               :options="[{label: 'None', value: ''}, {label: 'CASCADED', value: 'CASCADED'}, {label: 'LOCAL', value: 'LOCAL'}]"
               class="!h-[30px] w-[140px]"
            />
         </PropertyCard>
      </template>

      <template #content>
         <BaseLoader v-if="isLoading" />
         <Label class="!text-[12px] !text-muted-foreground !font-normal !m-0 ml-2">
            {{ t('database.selectStatement') }}
         </Label>
         <QueryEditor
            v-show="isSelected"
            ref="queryEditor"
            v-model="localView.sql"
            :workspace="workspace"
            :schema="schema"
            :height="editorHeight"
         />
      </template>
   </PropsTabShell>
</template>

<script setup lang="ts">
import { Ace } from 'ace-builds';
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
import Views from '@/ipc-api/Views';
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const props = defineProps({
   tabUid: String,
   connection: Object,
   isSelected: Boolean,
   schema: String,
   view: String
});

const { addNotification } = useNotificationsStore();
const workspacesStore = useWorkspacesStore();

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
const originalView = ref(null);
const localView = ref(null);
const editorHeight = ref(300);
const lastView = ref(null);
const sqlProxy = ref('');

const workspace = computed(() => getWorkspace(props.connection.uid));
const isChanged = computed(() => JSON.stringify(originalView.value) !== JSON.stringify(localView.value));
const isDefinerInUsers = computed(() => originalView.value ? workspace.value.users.some(user => originalView.value.definer === `\`${user.name}\`@\`${user.host}\``) : true);

const users = computed(() => {
   const users = [{ value: '' }, ...workspace.value.users];
   if (!isDefinerInUsers.value) {
      const [name, host] = originalView.value.definer.replaceAll('`', '').split('@');
      users.unshift({ name, host });
   }

   return users;
});

const getViewData = async () => {
   if (!props.view) return;
   isLoading.value = true;
   localView.value = { sql: '' };
   lastView.value = props.view;

   const params = {
      uid: props.connection.uid,
      schema: props.schema,
      view: props.view
   };

   try {
      const { status, response } = await Views.getViewInformations(params);
      if (status === 'success') {
         originalView.value = response;
         localView.value = JSON.parse(JSON.stringify(originalView.value));
         sqlProxy.value = localView.value.sql;
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
      view: {
         ...localView.value,
         schema: props.schema,
         oldName: originalView.value.name
      }
   };

   try {
      const { status, response } = await Views.alterView(params);

      if (status === 'success') {
         const oldName = originalView.value.name;

         await refreshStructure(props.connection.uid);

         if (oldName !== localView.value.name) {
            renameTabs({
               uid: props.connection.uid,
               schema: props.schema,
               elementName: oldName,
               elementNewName: localView.value.name,
               elementType: 'view'
            });

            changeBreadcrumbs({ schema: props.schema, view: localView.value.name });
         }
         else
            getViewData();
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
   localView.value = JSON.parse(JSON.stringify(originalView.value));
   queryEditor.value.editor.session.setValue(localView.value.sql);
};

const resizeQueryEditor = () => {
   if (queryEditor.value) {
      const footer = document.getElementById('footer');
      const size = window.innerHeight - queryEditor.value.$el.getBoundingClientRect().top - footer.offsetHeight;
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
      await getViewData();
      queryEditor.value.editor.session.setValue(localView.value.sql);
      lastView.value = props.view;
   }
});

watch(() => props.view, async () => {
   if (props.isSelected) {
      await getViewData();
      queryEditor.value.editor.session.setValue(localView.value.sql);
      lastView.value = props.view;
   }
});

watch(() => props.isSelected, (val) => {
   if (val) {
      changeBreadcrumbs({ schema: props.schema, view: localView.value.name });

      setTimeout(() => {
         resizeQueryEditor();
      }, 50);
   }
});

watch(isChanged, (val) => {
   setUnsavedChanges({ uid: props.connection.uid, tUid: props.tabUid, isChanged: val });
});

(async () => {
   await getViewData();
   queryEditor.value.editor.session.setValue(localView.value.sql);
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
