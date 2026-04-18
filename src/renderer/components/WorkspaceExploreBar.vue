<template>
   <div class="column col-auto p-relative">
      <div ref="resizer" class="workspace-explorebar-resizer" />
      <div
         ref="explorebar"
         class="workspace-explorebar flex flex-col outline-none"
         :style="{width: localWidth ? localWidth+'px' : ''}"
         tabindex="0"
         @keypress="explorebarSearch"
         @keydown="explorebarSearch"
      >
         <div class="flex h-[32px] items-center gap-1.5 px-2">
            <div
               v-if="customizations.database && databases.length"
               class="min-w-0 flex-1"
            >
               <div
                  class="flex h-[32px] items-center gap-1.5 rounded-md border border-muted-foreground/40 bg-muted/40 px-2 transition-colors hover:border-ring/60 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/40"
                  :title="t('database.switchDatabase')"
               >
                  <BaseSelect
                     v-model="selectedDatabase"
                     :options="databases"
                     class="min-w-0 flex-1 text-[14px] font-semibold"
                     dropdown-match-parent
                     @keypress.stop=""
                     @keydown.stop=""
                  />
                  <span
                     v-if="databaseComment"
                     class="max-w-[40%] shrink-0 truncate rounded bg-muted-foreground/15 px-2 py-0.5 text-[12px] font-medium text-muted-foreground"
                     :title="databaseComment"
                  >{{ databaseComment }}</span>
                  <BaseIcon
                     icon-name="mdiChevronDown"
                     :size="18"
                     class="shrink-0 text-muted-foreground"
                  />
               </div>
            </div>
            <span
               v-else
               class="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-wide"
            >{{ connectionName }}</span>
            <div
               v-if="workspace.connectionStatus === 'connected'"
               class="flex shrink-0 items-center gap-0.5"
            >
               <button
                  v-if="customizations.schemas"
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  :title="t('database.createNewSchema')"
                  @click="showNewDBModal"
               >
                  <BaseIcon icon-name="mdiDatabasePlus" :size="20" />
               </button>
               <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  :title="t('general.refresh')"
                  @click="refresh"
               >
                  <BaseIcon
                     icon-name="mdiRefresh"
                     :size="20"
                     :class="{'rotate': isRefreshing}"
                  />
               </button>
               <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
                  :title="t('connection.disconnect')"
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
                  class="h-[22px] w-full rounded-md border border-input bg-muted/40 pl-2 pr-6 text-[11px] text-foreground placeholder:text-muted-foreground/70 transition-colors hover:border-ring/60 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
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
                  class="h-[22px] w-full rounded-md border border-input bg-muted/40 pl-2 pr-6 text-[11px] text-foreground placeholder:text-muted-foreground/70 transition-colors hover:border-ring/60 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
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
               @show-schema-context="openSchemaContext"
               @show-table-context="openTableContext"
               @show-misc-context="openMiscContext"
               @show-misc-folder-context="openMiscFolderContext"
            />
         </div>
      </div>
      <ModalNewSchema
         v-if="isNewDBModal"
         @close="hideNewDBModal"
         @reload="refresh"
      />
      <DatabaseContext
         v-if="isDatabaseContext"
         :selected-schema="selectedSchema"
         :context-event="databaseContextEvent"
         @close-context="closeDatabaseContext"
         @open-create-table-tab="openCreateElementTab('table')"
         @open-create-view-tab="openCreateElementTab('view')"
         @open-create-materialized-view-tab="openCreateElementTab('materialized-view')"
         @open-create-trigger-tab="openCreateElementTab('trigger')"
         @open-create-routine-tab="openCreateElementTab('routine')"
         @open-create-function-tab="openCreateElementTab('function')"
         @open-create-trigger-function-tab="openCreateElementTab('trigger-function')"
         @open-create-scheduler-tab="openCreateElementTab('scheduler')"
         @reload="refresh"
      />
      <TableContext
         v-if="isTableContext"
         :selected-schema="selectedSchema"
         :selected-table="selectedTable"
         :context-event="tableContextEvent"
         @delete-table="deleteTable"
         @duplicate-table="duplicateTable"
         @close-context="closeTableContext"
         @reload="refresh"
      />
      <MiscContext
         v-if="isMiscContext"
         :selected-misc="selectedMisc"
         :selected-schema="selectedSchema"
         :context-event="miscContextEvent"
         @close-context="closeMiscContext"
         @reload="refresh"
      />
      <MiscFolderContext
         v-if="isMiscFolderContext"
         :selected-misc="selectedMisc"
         :selected-schema="selectedSchema"
         :context-event="miscContextEvent"
         @open-create-view-tab="openCreateElementTab('view')"
         @open-create-materialized-view-tab="openCreateElementTab('materialized-view')"
         @open-create-trigger-tab="openCreateElementTab('trigger')"
         @open-create-trigger-function-tab="openCreateElementTab('trigger-function')"
         @open-create-routine-tab="openCreateElementTab('routine')"
         @open-create-function-tab="openCreateElementTab('function')"
         @open-create-scheduler-tab="openCreateElementTab('scheduler')"
         @close-context="closeMiscFolderContext"
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
import MiscContext from '@/components/WorkspaceExploreBarMiscContext.vue';
import MiscFolderContext from '@/components/WorkspaceExploreBarMiscFolderContext.vue';
import WorkspaceExploreBarSchema from '@/components/WorkspaceExploreBarSchema.vue';
import DatabaseContext from '@/components/WorkspaceExploreBarSchemaContext.vue';
import TableContext from '@/components/WorkspaceExploreBarTableContext.vue';
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
const schema: Ref<Component & { selectSchema: (name: string) => void; $refs: {schemaAccordion: HTMLDetailsElement} }[]> = ref(null);
const isRefreshing = ref(false);
const isNewDBModal = ref(false);
const localWidth = ref(null);
const explorebarWidthInterval = ref(null);
const searchTermInterval = ref(null);
const isDatabaseContext = ref(false);
const isTableContext = ref(false);
const isMiscContext = ref(false);
const isMiscFolderContext = ref(false);
const databaseContextEvent = ref(null);
const tableContextEvent = ref(null);
const miscContextEvent = ref(null);
const selectedDatabase = ref(getWorkspace(props.connection.uid)?.database || props.connection.database);
const selectedSchema = ref('');
const selectedTable = ref(null);
const selectedMisc = ref(null);
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
      schema.value[0].$refs.schemaAccordion.open = true;
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

const openCreateElementTab = (element: string) => {
   closeDatabaseContext();
   closeMiscFolderContext();

   newTab({
      uid: workspace.value.uid,
      schema: selectedSchema.value,
      elementName: '',
      elementType: element,
      type: `new-${element}`
   });
};

const openSchemaContext = (payload: { schema: string; event: PointerEvent }) => {
   selectedSchema.value = payload.schema;
   databaseContextEvent.value = payload.event;
   isDatabaseContext.value = true;
};

const closeDatabaseContext = () => {
   isDatabaseContext.value = false;
};

const openTableContext = (payload: { schema: string; table: string; event: PointerEvent }) => {
   selectedTable.value = payload.table;
   selectedSchema.value = payload.schema;
   tableContextEvent.value = payload.event;
   isTableContext.value = true;
};

const closeTableContext = () => {
   isTableContext.value = false;
};

const openMiscContext = (payload: { schema: string; misc: string; event: PointerEvent }) => {
   selectedMisc.value = payload.misc;
   selectedSchema.value = payload.schema;
   miscContextEvent.value = payload.event;
   isMiscContext.value = true;
};

const openMiscFolderContext = (payload: { schema: string; type: string; event: PointerEvent }) => {
   selectedMisc.value = payload.type;
   selectedSchema.value = payload.schema;
   miscContextEvent.value = payload.event;
   isMiscFolderContext.value = true;
};

const closeMiscContext = () => {
   isMiscContext.value = false;
};

const closeMiscFolderContext = () => {
   isMiscFolderContext.value = false;
};

const deleteTable = async (payload: { schema: string; table: { name: string; type: string }; event: PointerEvent }) => {
   closeTableContext();

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

const duplicateTable = async (payload: { schema: string; table: { name: string }; event: PointerEvent }) => {
   closeTableContext();

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
