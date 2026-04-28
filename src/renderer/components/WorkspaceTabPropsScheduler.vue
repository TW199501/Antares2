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
            @click="showTimingModal"
         >
            <BaseIcon
               class="mr-1"
               icon-name="mdiTimer"
               :size="16"
            />
            {{ t('database.timing') }}
         </Button>
      </template>

      <template #metadata>
         <PropertyCard :label="t('general.name')">
            <Input
               v-model="localScheduler.name"
               type="text"
               class="!h-[30px] w-[200px]"
            />
         </PropertyCard>
         <PropertyCard :label="t('database.definer')">
            <BaseSelect
               v-model="localScheduler.definer"
               :options="users"
               :option-label="(user: any) => user.value === '' ? t('database.currentUser') : `${user.name}@${user.host}`"
               :option-track-by="(user: any) => user.value === '' ? '' : `\`${user.name}\`@\`${user.host}\``"
               class="!h-[30px] w-[180px]"
            />
         </PropertyCard>
         <PropertyCard :label="t('database.comment')">
            <Input
               v-model="localScheduler.comment"
               type="text"
               class="!h-[30px] w-[260px]"
            />
         </PropertyCard>
         <PropertyCard :label="t('database.state')">
            <RadioGroup v-model="localScheduler.state" class="flex flex-row items-center gap-3 h-[30px]">
               <div class="flex items-center gap-1.5">
                  <RadioGroupItem id="props-scheduler-state-enable" value="ENABLE" />
                  <Label for="props-scheduler-state-enable" class="!text-[12px] cursor-pointer !m-0">
                     ENABLE
                  </Label>
               </div>
               <div class="flex items-center gap-1.5">
                  <RadioGroupItem id="props-scheduler-state-disable" value="DISABLE" />
                  <Label for="props-scheduler-state-disable" class="!text-[12px] cursor-pointer !m-0">
                     DISABLE
                  </Label>
               </div>
               <div class="flex items-center gap-1.5">
                  <RadioGroupItem id="props-scheduler-state-disable-slave" value="DISABLE ON SLAVE" />
                  <Label for="props-scheduler-state-disable-slave" class="!text-[12px] cursor-pointer !m-0">
                     DISABLE ON SLAVE
                  </Label>
               </div>
            </RadioGroup>
         </PropertyCard>
      </template>

      <template #content>
         <BaseLoader v-if="isLoading" />
         <Label class="!text-[12px] !text-muted-foreground !font-normal !m-0 ml-2">
            {{ t('database.schedulerBody') }}
         </Label>
         <QueryEditor
            v-show="isSelected"
            ref="queryEditor"
            v-model="localScheduler.sql"
            :workspace="workspace"
            :schema="schema"
            :height="editorHeight"
         />
      </template>
   </PropsTabShell>
   <WorkspaceTabPropsSchedulerTimingModal
      v-if="isTimingModal"
      :local-options="localScheduler"
      :workspace="workspace"
      @hide="hideTimingModal"
      @options-update="timingUpdate"
   />
</template>

<script setup lang="ts">
import { Ace } from 'ace-builds';
import { AlterEventParams, EventInfos } from 'common/interfaces/antares';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import PropertyCard from '@/components/workspace/props/PropertyCard.vue';
import PropsTabShell from '@/components/workspace/props/PropsTabShell.vue';
import WorkspaceTabPropsSchedulerTimingModal from '@/components/WorkspaceTabPropsSchedulerTimingModal.vue';
import Schedulers from '@/ipc-api/Schedulers';
import { useConsoleStore } from '@/stores/console';
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const props = defineProps({
   tabUid: String,
   connection: Object,
   scheduler: String,
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
const isTimingModal = ref(false);
const originalScheduler: Ref<EventInfos> = ref(null);
const localScheduler: Ref<EventInfos> = ref({} as EventInfos);
const lastScheduler = ref(null);
const sqlProxy = ref('');
const editorHeight = ref(300);

const workspace = computed(() => {
   return getWorkspace(props.connection.uid);
});

const isChanged = computed(() => {
   return JSON.stringify(originalScheduler.value) !== JSON.stringify(localScheduler.value);
});

const isDefinerInUsers = computed(() => {
   return originalScheduler.value ? workspace.value.users.some(user => originalScheduler.value.definer === `\`${user.name}\`@\`${user.host}\``) : true;
});

const users = computed(() => {
   const users = [{ value: '' }, ...workspace.value.users];
   if (!isDefinerInUsers.value) {
      const [name, host] = originalScheduler.value.definer.replaceAll('`', '').split('@');
      users.unshift({ name, host });
   }

   return users;
});

const getSchedulerData = async () => {
   if (!props.scheduler) return;

   isLoading.value = true;
   lastScheduler.value = props.scheduler;

   const params = {
      uid: props.connection.uid,
      schema: props.schema,
      scheduler: props.scheduler
   };

   try {
      const { status, response } = await Schedulers.getSchedulerInformations(params);
      if (status === 'success') {
         originalScheduler.value = response;
         localScheduler.value = JSON.parse(JSON.stringify(originalScheduler.value));
         sqlProxy.value = localScheduler.value.sql;
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
      scheduler: {
         ...localScheduler.value,
         schema: props.schema,
         oldName: originalScheduler.value.name
      } as AlterEventParams
   };

   try {
      const { status, response } = await Schedulers.alterScheduler(params);

      if (status === 'success') {
         const oldName = originalScheduler.value.name;

         await refreshStructure(props.connection.uid);

         if (oldName !== localScheduler.value.name) {
            renameTabs({
               uid: props.connection.uid,
               schema: props.schema,
               elementName: oldName,
               elementNewName: localScheduler.value.name,
               elementType: 'scheduler'
            });

            changeBreadcrumbs({ schema: props.schema, scheduler: localScheduler.value.name });
         }
         else
            getSchedulerData();
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
   localScheduler.value = JSON.parse(JSON.stringify(originalScheduler.value));
   queryEditor.value.editor.session.setValue(localScheduler.value.sql);
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

const showTimingModal = () => {
   isTimingModal.value = true;
};

const hideTimingModal = () => {
   isTimingModal.value = false;
};

const timingUpdate = (options: EventInfos) => {
   localScheduler.value = options;
};

const saveContentListener = () => {
   const hasModalOpen = !!document.querySelectorAll('.modal.active').length;
   if (props.isSelected && !hasModalOpen && isChanged.value)
      saveChanges();
};

watch(() => props.schema, async () => {
   if (props.isSelected) {
      await getSchedulerData();
      queryEditor.value.editor.session.setValue(localScheduler.value.sql);
      lastScheduler.value = props.scheduler;
   }
});

watch(() => props.scheduler, async () => {
   if (props.isSelected) {
      await getSchedulerData();
      queryEditor.value.editor.session.setValue(localScheduler.value.sql);
      lastScheduler.value = props.scheduler;
   }
});

watch(() => props.isSelected, async (val) => {
   if (val) {
      changeBreadcrumbs({ schema: props.schema, scheduler: props.scheduler });

      setTimeout(() => {
         resizeQueryEditor();
      }, 200);

      if (lastScheduler.value !== props.scheduler)
         getSchedulerData();
   }
});

watch(isChanged, (val) => {
   setUnsavedChanges({ uid: props.connection.uid, tUid: props.tabUid, isChanged: val });
});

watch(consoleHeight, () => {
   resizeQueryEditor();
});

(async () => {
   await getSchedulerData();
   queryEditor.value.editor.session.setValue(localScheduler.value.sql);
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
