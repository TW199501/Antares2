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
               v-model="localTrigger.name"
               type="text"
               class="!h-[30px] w-[200px]"
            />
         </PropertyCard>
         <PropertyCard
            v-if="customizations.definer"
            :label="t('database.definer')"
         >
            <BaseSelect
               v-model="localTrigger.definer"
               :options="users"
               :option-label="(user: any) => user.value === '' ? t('database.currentUser') : `${user.name}@${user.host}`"
               :option-track-by="(user: any) => user.value === '' ? '' : `\`${user.name}\`@\`${user.host}\``"
               class="!h-[30px] w-[180px]"
            />
         </PropertyCard>
         <fieldset class="contents" :disabled="customizations.triggerOnlyRename">
            <PropertyCard :label="t('database.table')">
               <BaseSelect
                  v-model="localTrigger.table"
                  :options="schemaTables"
                  option-label="name"
                  option-track-by="name"
                  class="!h-[30px] w-[180px]"
               />
            </PropertyCard>
            <PropertyCard :label="t('database.event')">
               <div class="flex items-center gap-2">
                  <BaseSelect
                     v-model="localTrigger.activation"
                     :options="['BEFORE', 'AFTER']"
                     class="!h-[30px] w-[110px]"
                  />
                  <BaseSelect
                     v-if="!customizations.triggerMultipleEvents"
                     v-model="localTrigger.event"
                     :options="Object.keys(localEvents)"
                     class="!h-[30px] w-[110px]"
                  />
                  <div
                     v-if="customizations.triggerMultipleEvents"
                     class="flex items-center gap-3"
                  >
                     <label
                        v-for="event in Object.keys(localEvents) as ('INSERT' | 'UPDATE' | 'DELETE')[]"
                        :key="event"
                        class="flex cursor-pointer items-center gap-1.5 text-[12px]"
                     >
                        <Checkbox
                           :checked="localEvents[event]"
                           @update:checked="changeEvents(event)"
                        />
                        {{ event }}
                     </label>
                  </div>
               </div>
            </PropertyCard>
         </fieldset>
      </template>

      <template #content>
         <BaseLoader v-if="isLoading" />
         <Label class="!text-[12px] !text-muted-foreground !font-normal !m-0 ml-2">
            {{ t('database.triggerStatement') }}
         </Label>
         <QueryEditor
            v-show="isSelected"
            ref="queryEditor"
            v-model="localTrigger.sql"
            :workspace="workspace"
            :schema="schema"
            :height="editorHeight"
         />
      </template>
   </PropsTabShell>
</template>

<script setup lang="ts">
import { Ace } from 'ace-builds';
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
import PropertyCard from '@/components/workspace/props/PropertyCard.vue';
import PropsTabShell from '@/components/workspace/props/PropsTabShell.vue';
import Triggers from '@/ipc-api/Triggers';
import { useConsoleStore } from '@/stores/console';
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';

type TriggerEventName = 'INSERT' | 'UPDATE' | 'DELETE'

const { t } = useI18n();

const props = defineProps({
   tabUid: String,
   connection: Object,
   trigger: String,
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
const lastTrigger = ref(null);
const isLoading = ref(false);
const isSaving = ref(false);
const originalTrigger = ref(null);
const localTrigger = ref(null);
const editorHeight = ref(300);
const localEvents = ref({ INSERT: false, UPDATE: false, DELETE: false });

const workspace = computed(() => {
   return getWorkspace(props.connection.uid);
});

const customizations = computed(() => {
   return workspace.value.customizations;
});

const isChanged = computed(() => {
   return JSON.stringify(originalTrigger.value) !== JSON.stringify(localTrigger.value);
});

const isDefinerInUsers = computed(() => {
   return originalTrigger.value ? workspace.value.users.some(user => originalTrigger.value.definer === `\`${user.name}\`@\`${user.host}\``) : true;
});

const schemaTables = computed(() => {
   const schemaTables = workspace.value.structure
      .filter(schema => schema.name === props.schema)
      .map(schema => schema.tables);

   return schemaTables.length ? schemaTables[0].filter(table => table.type === 'table') : [];
});

const users = computed(() => {
   const users = [{ value: '' }, ...workspace.value.users];
   if (!isDefinerInUsers.value) {
      const [name, host] = originalTrigger.value.definer.replaceAll('`', '').split('@');
      users.unshift({ name, host });
   }

   return users;
});

const getTriggerData = async () => {
   if (!props.trigger) return;

   Object.keys(localEvents.value).forEach((event: TriggerEventName) => {
      localEvents.value[event] = false;
   });

   localTrigger.value = { sql: '' };
   isLoading.value = true;
   lastTrigger.value = props.trigger;

   const params = {
      uid: props.connection.uid,
      schema: props.schema,
      trigger: props.trigger
   };

   try {
      const { status, response } = await Triggers.getTriggerInformations(params);
      if (status === 'success') {
         originalTrigger.value = response;
         localTrigger.value = JSON.parse(JSON.stringify(originalTrigger.value));

         if (customizations.value.triggerMultipleEvents) {
            originalTrigger.value.event.forEach((event: TriggerEventName) => {
               localEvents.value[event] = true;
            });
         }
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

const changeEvents = (event: TriggerEventName) => {
   if (customizations.value.triggerMultipleEvents) {
      localEvents.value[event] = !localEvents.value[event];
      localTrigger.value.event = [];
      for (const key in localEvents.value) {
         if (localEvents.value[key as TriggerEventName])
            localTrigger.value.event.push(key);
      }
   }
};

const saveChanges = async () => {
   if (isSaving.value) return;
   isSaving.value = true;
   const params = {
      uid: props.connection.uid,
      trigger: {
         ...localTrigger.value,
         schema: props.schema,
         oldName: originalTrigger.value.name
      }
   };

   try {
      const { status, response } = await Triggers.alterTrigger(params);

      if (status === 'success') {
         await refreshStructure(props.connection.uid);

         if (originalTrigger.value.name !== localTrigger.value.name) {
            const triggerName = customizations.value.triggerTableInName ? `${localTrigger.value.table}.${localTrigger.value.name}` : localTrigger.value.name;
            const triggerOldName = customizations.value.triggerTableInName ? `${originalTrigger.value.table}.${originalTrigger.value.name}` : originalTrigger.value.name;

            renameTabs({
               uid: props.connection.uid,
               schema: props.schema,
               elementName: triggerOldName,
               elementNewName: triggerName,
               elementType: 'trigger'
            });

            changeBreadcrumbs({ schema: props.schema, trigger: triggerName });
         }
         else
            getTriggerData();
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
   localTrigger.value = JSON.parse(JSON.stringify(originalTrigger.value));
   queryEditor.value.editor.session.setValue(localTrigger.value.sql);

   Object.keys(localEvents.value).forEach((event: TriggerEventName) => {
      localEvents.value[event] = false;
   });

   if (customizations.value.triggerMultipleEvents) {
      originalTrigger.value.event.forEach((event: TriggerEventName) => {
         localEvents.value[event] = true;
      });
   }
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
      await getTriggerData();
      queryEditor.value.editor.session.setValue(localTrigger.value.sql);
      lastTrigger.value = props.trigger;
   }
});

watch(() => props.trigger, async () => {
   if (props.isSelected) {
      await getTriggerData();
      queryEditor.value.editor.session.setValue(localTrigger.value.sql);
      lastTrigger.value = props.trigger;
   }
});

watch(() => props.isSelected, (val) => {
   if (val) changeBreadcrumbs({ schema: props.schema });
});

watch(isChanged, (val) => {
   setUnsavedChanges({ uid: props.connection.uid, tUid: props.tabUid, isChanged: val });
});

watch(consoleHeight, () => {
   resizeQueryEditor();
});

(async () => {
   await getTriggerData();
   queryEditor.value.editor.session.setValue(localTrigger.value.sql);
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
