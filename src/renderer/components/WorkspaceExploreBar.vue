<template>
   <div class="shrink-0 relative">
      <div ref="resizer" class="workspace-explorebar-resizer" />
      <div
         ref="explorebar"
         class="workspace-explorebar flex flex-col outline-none"
         :style="{width: localWidth ? localWidth+'px' : ''}"
         tabindex="0"
         @keypress="explorebarSearch"
         @keydown="explorebarSearch"
      >
         <div class="flex items-start gap-1.5 px-2 py-1">
            <div
               v-if="customizations.database && databases.length"
               class="min-w-0 flex-1"
            >
               <div
                  class="flex flex-col rounded-md border border-muted-foreground/40 bg-muted/40 transition-colors hover:border-ring/60 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/40"
                  :title="t('database.switchDatabase')"
               >
                  <BaseSelect
                     v-model="selectedDatabase"
                     :options="databases"
                     class="min-w-0 w-full text-sm font-semibold"
                     dropdown-match-parent
                     @keypress.stop=""
                     @keydown.stop=""
                  />
                  <span
                     v-if="databaseComment"
                     class="truncate px-2 pb-1 text-[11px] font-medium leading-tight text-muted-foreground"
                     :title="databaseComment"
                  >{{ databaseComment }}</span>
               </div>
            </div>
            <span
               v-else
               class="min-w-0 flex-1 truncate self-center text-[11px] font-bold uppercase tracking-wide"
            >{{ connectionName }}</span>
            <div
               v-if="workspace.connectionStatus === 'connected'"
               class="flex shrink-0 items-center gap-0.5"
            >
               <button
                  v-if="customizations.schemas"
                  v-tooltip="{
                     strategy: 'fixed',
                     placement: 'bottom',
                     content: t('database.createNewSchema')
                  }"
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  @click="showNewDBModal"
               >
                  <BaseIcon icon-name="mdiDatabasePlus" :size="20" />
               </button>
               <button
                  v-tooltip="{
                     strategy: 'fixed',
                     placement: 'bottom',
                     content: t('general.refresh')
                  }"
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  @click="refresh"
               >
                  <BaseIcon
                     icon-name="mdiRefresh"
                     :size="20"
                     :class="{'rotate': isRefreshing}"
                  />
               </button>
               <button
                  v-tooltip="{
                     strategy: 'fixed',
                     placement: 'bottom',
                     content: t('connection.disconnect')
                  }"
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
                  @click="disconnectWorkspace(connection.uid)"
               >
                  <BaseIcon icon-name="mdiPower" :size="20" />
               </button>
            </div>
         </div>
         <div
            v-if="workspace.connectionStatus === 'connected'"
            class="flex h-[32px] items-center gap-1 border-b border-border px-2"
         >
            <div class="relative flex-[1_1_55%]">
               <input
                  ref="searchInput"
                  v-model="searchTerm"
                  type="text"
                  class="h-[22px] w-full rounded-md border border-input bg-muted/40 pl-2 pr-6 text-[11px] text-foreground placeholder:text-xs placeholder:text-muted-foreground/70 transition-colors hover:border-ring/60 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
                  :placeholder="t('database.searchForElements')"
               >
               <BaseIcon
                  v-if="!searchTerm"
                  icon-name="mdiMagnify"
                  :size="14"
                  class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/70"
               />
               <BaseIcon
                  v-else
                  icon-name="mdiBackspace"
                  :size="14"
                  class="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground/70 hover:text-foreground"
                  @click="searchTerm = ''"
               />
            </div>
            <div class="relative flex-[1_1_45%]">
               <input
                  v-model="columnSearchTerm"
                  type="text"
                  class="h-[22px] w-full rounded-md border border-input bg-muted/40 pl-2 pr-6 text-[11px] text-foreground placeholder:text-xs placeholder:text-muted-foreground/70 transition-colors hover:border-ring/60 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
                  :placeholder="t('database.searchForColumns')"
                  @keypress.stop=""
                  @keydown.stop=""
               >
               <BaseIcon
                  v-if="!columnSearchTerm"
                  icon-name="mdiTableColumn"
                  :size="14"
                  class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/70"
               />
               <BaseIcon
                  v-else
                  icon-name="mdiBackspace"
                  :size="14"
                  class="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground/70 hover:text-foreground"
                  @click="columnSearchTerm = ''"
               />
            </div>
         </div>
         <div
            class="workspace-explorebar-body min-h-0 flex-1 overflow-auto px-1 py-1"
            @click="explorebar.focus()"
         >
            <WorkspaceExploreBarSchema
               v-for="db of filteredSchemas"
               :key="db.name"
               ref="schema"
               :database="db"
               :connection="connection"
               :search-method="searchMethod"
               :column-search-term="columnSearchTerm"
               @reload="refresh"
               @delete-table="deleteTable"
               @duplicate-table="duplicateTable"
               @open-create-table-tab="openCreateElementTab('table', $event)"
               @open-create-view-tab="openCreateElementTab('view', $event)"
               @open-create-materialized-view-tab="openCreateElementTab('materialized-view', $event)"
               @open-create-trigger-tab="openCreateElementTab('trigger', $event)"
               @open-create-routine-tab="openCreateElementTab('routine', $event)"
               @open-create-function-tab="openCreateElementTab('function', $event)"
               @open-create-trigger-function-tab="openCreateElementTab('trigger-function', $event)"
               @open-create-scheduler-tab="openCreateElementTab('scheduler', $event)"
            />
         </div>
      </div>
      <ModalNewSchema
         v-if="isNewDBModal"
         @close="hideNewDBModal"
         @reload="refresh"
      />
   </div>
</template>

<script setup lang="ts">
import { ConnectionParams } from 'common/interfaces/antares';
import { storeToRefs } from 'pinia';
import { Component, computed, onMounted, Prop, Ref, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import ModalNewSchema from '@/components/ModalNewSchema.vue';
import WorkspaceExploreBarSchema from '@/components/WorkspaceExploreBarSchema.vue';
import Databases from '@/ipc-api/Databases';
import Tables from '@/ipc-api/Tables';
import Views from '@/ipc-api/Views';
import { useConnectionsStore } from '@/stores/connections';
import { useNotificationsStore } from '@/stores/notifications';
import { useSettingsStore } from '@/stores/settings';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const props = defineProps({
   connection: Object as Prop<ConnectionParams>,
   isSelected: Boolean
});

const { getConnectionName } = useConnectionsStore();
const { addNotification } = useNotificationsStore();
const settingsStore = useSettingsStore();
const workspacesStore = useWorkspacesStore();

const { explorebarSize } = storeToRefs(settingsStore);

const { changeExplorebarSize } = settingsStore;
const {
   getWorkspace,
   switchConnection,
   removeConnected: disconnectWorkspace,
   refreshStructure,
   newTab,
   removeTabs,
   setSearchTerm,
   setDatabase,
   addLoadingElement,
   removeLoadingElement
} = workspacesStore;

const searchInput: Ref<HTMLInputElement> = ref(null);
const explorebar: Ref<HTMLInputElement> = ref(null);
const resizer: Ref<HTMLInputElement> = ref(null);
const databases: Ref<string[]> = ref([]);
const schema: Ref<Component & { selectSchema: (name: string) => void; openSchemaAccordion: () => void }[]> = ref(null);
const isRefreshing = ref(false);
const isNewDBModal = ref(false);
const localWidth = ref(null);
const explorebarWidthInterval = ref(null);
const searchTermInterval = ref(null);
const selectedDatabase = ref(getWorkspace(props.connection.uid)?.database || props.connection.database);
const searchTerm = ref('');
const columnSearchTerm = ref('');
const databaseComment = ref('');
const searchMethod: Ref<'elements' | 'schemas' | 'columns'> = ref('elements');

const workspace = computed(() => {
   return getWorkspace(props.connection.uid);
});

const connectionName = computed(() => {
   return getConnectionName(props.connection.uid);
});

const customizations = computed(() => {
   return workspace.value.customizations;
});

const filteredSchemas = computed(() => {
   if (searchMethod.value === 'schemas')
      return workspace.value.structure.filter(schema => schema.name.search(searchTerm.value) >= 0);
   else
      return workspace.value.structure;
});

watch(localWidth, (val: number) => {
   clearTimeout(explorebarWidthInterval.value);

   explorebarWidthInterval.value = setTimeout(() => {
      changeExplorebarSize(val);
   }, 500);
});

watch(() => props.isSelected, (val: boolean) => {
   if (val) localWidth.value = explorebarSize.value;
});

watch(searchTerm, () => {
   clearTimeout(searchTermInterval.value);

   searchTermInterval.value = setTimeout(() => {
      setSearchTerm(searchTerm.value);
   }, 200);
});

watch(selectedDatabase, (val, oldVal) => {
   if (oldVal)
      switchConnection({ ...props.connection, database: selectedDatabase.value }).catch(() => {});
});

watch(selectedDatabase, async () => {
   if (!customizations.value.database) return;
   const { status, response } = await Databases.getDatabaseComment(props.connection.uid);
   databaseComment.value = status === 'success' ? (response as string) : '';
});

localWidth.value = explorebarSize.value;

onMounted(async () => {
   resizer.value.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();

      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResize);
   });

   if (workspace.value.structure.length === 1 && schema.value?.[0]) { // Auto-open if just one schema
      schema.value[0].selectSchema(workspace.value.structure[0].name);
      schema.value[0].openSchemaAccordion();
   }

   if (customizations.value.database) {
      try {
         const { status, response } = await Databases.getDatabases(props.connection.uid);
         if (status === 'success') {
            databases.value = response;
            if (selectedDatabase.value === '') {
               selectedDatabase.value = response[0];
               setDatabase(selectedDatabase.value);
            }
         }
         else
            addNotification({ status: 'error', message: response });

         const { status: cs, response: comment } = await Databases.getDatabaseComment(props.connection.uid);
         if (cs === 'success') databaseComment.value = comment as string;
      }
      catch (err) {
         addNotification({ status: 'error', message: err.stack });
      }
   }
});

const refresh = async () => {
   if (!isRefreshing.value) {
      isRefreshing.value = true;
      await refreshStructure(props.connection.uid);
      isRefreshing.value = false;
   }
};

const explorebarSearch = (event: KeyboardEvent) => {
   const isLetter = (event.key >= 'a' && event.key <= 'z');
   const isNumber = (event.key >= '0' && event.key <= '9');
   if (isLetter || isNumber)
      searchInput.value.focus();
};

const resize = (e: MouseEvent) => {
   const el = explorebar.value;
   let explorebarWidth = e.pageX - el.getBoundingClientRect().left;
   if (explorebarWidth > 500) explorebarWidth = 500;
   if (explorebarWidth < 150) explorebarWidth = 150;
   localWidth.value = explorebarWidth;
};

const stopResize = () => {
   window.removeEventListener('mousemove', resize);
};

const showNewDBModal = () => {
   isNewDBModal.value = true;
};

const hideNewDBModal = () => {
   isNewDBModal.value = false;
};

const openCreateElementTab = (element: string, schema: string) => {
   newTab({
      uid: workspace.value.uid,
      schema,
      elementName: '',
      elementType: element,
      type: `new-${element}`
   });
};

const deleteTable = async (payload: { schema: string; table: { name: string; type: string } }) => {
   addLoadingElement({
      name: payload.table.name,
      schema: payload.schema,
      type: 'table'
   });

   try {
      let res;

      if (payload.table.type === 'table') {
         res = await Tables.dropTable({
            uid: props.connection.uid,
            table: payload.table.name,
            schema: payload.schema
         });
      }
      else if (payload.table.type === 'view') {
         res = await Views.dropView({
            uid: props.connection.uid,
            view: payload.table.name,
            schema: payload.schema
         });
      }

      const { status, response } = res;

      if (status === 'success') {
         refresh();

         removeTabs({
            uid: props.connection.uid as string,
            elementName: payload.table.name as string,
            elementType: payload.table.type,
            schema: payload.schema as string
         });
      }
      else
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   removeLoadingElement({
      name: payload.table.name,
      schema: payload.schema,
      type: 'table'
   });
};

const duplicateTable = async (payload: { schema: string; table: { name: string } }) => {
   addLoadingElement({
      name: payload.table.name,
      schema: payload.schema,
      type: 'table'
   });

   try {
      const { status, response } = await Tables.duplicateTable({
         uid: props.connection.uid,
         table: payload.table.name,
         schema: payload.schema
      });

      if (status === 'success')
         refresh();
      else
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   removeLoadingElement({
      name: payload.table.name,
      schema: payload.schema,
      type: 'table'
   });
};

const toggleSearchMethod = () => {
   searchTerm.value = '';
   setSearchTerm(searchTerm.value);

   if (searchMethod.value === 'elements')
      searchMethod.value = 'schemas';
   else if (searchMethod.value === 'schemas')
      searchMethod.value = 'columns';
   else
      searchMethod.value = 'elements';
};
</script>

<style lang="scss" scoped>
.workspace-explorebar-resizer {
  position: absolute;
  width: 4px;
  right: -2px;
  top: 0;
  height: calc(100vh - #{$excluding-size});
  cursor: ew-resize;
  z-index: 99;
  transition: background 0.2s;

  &:hover {
    background: var(--primary);
  }
}

.workspace-explorebar {
  width: $explorebar-width;
  height: calc(100vh - #{$excluding-size});
  text-align: left;
  z-index: 8;
  flex: initial;
  position: relative;
}

.workspace-explorebar-body::-webkit-scrollbar {
  width: 4px;
}

.workspace-explorebar-body::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--muted-foreground) 30%, transparent);
  border-radius: 2px;
}

.workspace-explorebar-body::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--muted-foreground) 55%, transparent);
}
</style>
