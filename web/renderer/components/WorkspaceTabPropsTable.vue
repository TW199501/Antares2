<template>
   <div v-show="isSelected" class="workspace-query-tab column col-12 columns col-gapless">
      <!-- Read-only summary of table options. Editing happens via Edit modal
           (Edit button at end of this row). All mutations are autocommit on
           modal confirm — there's no draft/Save flow anymore. -->
      <div class="px-4 pt-2 pb-3">
         <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <div class="flex items-center gap-2">
               <Label class="!text-sm !text-muted-foreground !font-normal !m-0 whitespace-nowrap">{{ t('general.name') }}</Label>
               <span class="rounded-md border bg-muted/40 px-2.5 py-1 font-medium">{{ localOptions.name }}</span>
            </div>
            <div v-if="workspace.customizations.comment && localOptions.comment" class="flex items-center gap-2">
               <Label class="!text-sm !text-muted-foreground !font-normal !m-0 whitespace-nowrap">{{ t('database.comment') }}</Label>
               <span class="rounded-md border bg-muted/40 px-2.5 py-1 max-w-[300px] truncate" :title="localOptions.comment">{{ localOptions.comment }}</span>
            </div>
            <div v-if="workspace.customizations.autoIncrement && localOptions.autoIncrement != null" class="flex items-center gap-2">
               <Label class="!text-sm !text-muted-foreground !font-normal !m-0 whitespace-nowrap">{{ t('database.autoIncrement') }}</Label>
               <span class="rounded-md border bg-muted/40 px-2.5 py-1 font-mono">{{ localOptions.autoIncrement }}</span>
            </div>
            <div v-if="workspace.customizations.collations && localOptions.collation" class="flex items-center gap-2">
               <Label class="!text-sm !text-muted-foreground !font-normal !m-0 whitespace-nowrap">{{ t('database.collation') }}</Label>
               <span class="rounded-md border bg-muted/40 px-2.5 py-1 text-xs">{{ localOptions.collation }}</span>
            </div>
            <div v-if="workspace.customizations.engines && localOptions.engine" class="flex items-center gap-2">
               <Label class="!text-sm !text-muted-foreground !font-normal !m-0 whitespace-nowrap">{{ t('database.engine') }}</Label>
               <span class="rounded-md border bg-muted/40 px-2.5 py-1">{{ localOptions.engine }}</span>
            </div>
            <Button
               variant="outline"
               size="sm"
               class="!h-[32px] !text-sm gap-1 !text-[#4a9eff] hover:!bg-[#4a9eff]/10 hover:!border-[#4a9eff]"
               :title="t('database.editTableOptions')"
               @click="showOptionsModal"
            >
               <BaseIcon icon-name="mdiPencilOutline" :size="16" />
               <span>{{ t('general.edit') }}</span>
            </Button>
         </div>
      </div>
      <Teleport v-if="toolbarTarget" :to="toolbarTarget">
         <div class="flex items-center gap-2">
            <!-- Save / Clear removed: each modal commits via Tables.alterTable
                 immediately on confirm (autocommit-on-confirm). The Edit button
                 lives at the end of the inline read-only summary row above. -->
            <Button
               variant="secondary"
               size="sm"
               :disabled="isSaving"
               class="h-[32px] !text-sm gap-1"
               :title="t('database.addNewField')"
               @click="addField"
            >
               <BaseIcon icon-name="mdiPlaylistPlus" :size="16" />
               <span>{{ t('general.add') }}</span>
            </Button>
            <Button
               variant="secondary"
               size="sm"
               :disabled="isSaving"
               class="h-[32px] !text-sm gap-1"
               :title="t('database.manageIndexes')"
               @click="showIntdexesModal"
            >
               <BaseIcon
                  icon-name="mdiKey"
                  :rotate="45"
                  :size="16"
               />
               <span>{{ t('database.indexes') }}</span>
            </Button>
            <Button
               variant="secondary"
               size="sm"
               :disabled="isSaving"
               class="h-[32px] !text-sm gap-1"
               :title="t('database.manageForeignKeys')"
               @click="showForeignModal"
            >
               <BaseIcon icon-name="mdiKeyLink" :size="16" />
               <span>{{ t('database.foreignKeys') }}</span>
            </Button>
            <Button
               v-if="workspace.customizations.tableCheck && originalTableChecks !== false"
               variant="secondary"
               size="sm"
               :disabled="isSaving"
               class="h-[32px] !text-sm gap-1"
               :title="t('database.manageTableChecks')"
               @click="showTableChecksModal"
            >
               <BaseIcon icon-name="mdiTableCheck" :size="16" />
               <span>{{ t('database.tableChecks') }}</span>
            </Button>

            <div class="mx-1 h-[20px] w-px bg-border" />

            <Button
               v-if="workspace.customizations.tableDdl"
               variant="secondary"
               size="sm"
               :disabled="isSaving"
               class="h-[32px] !text-sm gap-1"
               @click="showDdlModal"
            >
               <BaseIcon icon-name="mdiCodeTags" :size="16" />
               <span>{{ t('database.ddl') }}</span>
            </Button>
         </div>
      </Teleport>
      <div class="workspace-query-results column col-12 p-relative">
         <BaseLoader v-if="isLoading" />
         <WorkspaceTabPropsTableFields
            v-if="localFields"
            ref="indexTable"
            :fields="localFields"
            :indexes="localIndexes"
            :foreigns="localKeyUsage"
            :tab-uid="tabUid"
            :conn-uid="connection.uid"
            :index-types="workspace.indexTypes"
            :table="table"
            :schema="schema"
            mode="table"
            @duplicate-field="duplicateField"
            @remove-field="removeField"
            @add-new-index="addNewIndex"
            @add-to-index="addToIndex"
            @rename-field="renameField"
            @edit-field="openEditField"
         />
      </div>
      <WorkspaceTabPropsTableIndexesModal
         v-if="isIndexesModal"
         :local-indexes="localIndexes"
         :table="table"
         :fields="localFields"
         :index-types="workspace.indexTypes"
         :workspace="workspace"
         @hide="hideIndexesModal"
         @indexes-update="indexesUpdate"
      />
      <WorkspaceTabPropsTableForeignModal
         v-if="isForeignModal"
         :local-key-usage="localKeyUsage"
         :connection="connection"
         :table="table"
         :schema="schema"
         :schema-tables="schemaTables"
         :fields="localFields"
         :workspace="workspace"
         @hide="hideForeignModal"
         @foreigns-update="foreignsUpdate"
      />
      <WorkspaceTabPropsTableDdlModal
         v-if="isDdlModal"
         :table="table"
         :schema="schema"
         :workspace="workspace"
         @hide="hideDdlModal"
      />
      <WorkspaceTabPropsTableChecksModal
         v-if="isTableChecksModal"
         :local-checks="localTableChecks || []"
         :table="table"
         :workspace="workspace"
         @hide="hideTableChecksModal"
         @checks-update="checksUpdate"
      />
      <WorkspaceTabPropsTableEditModal
         v-if="editModalOpen && editModalDraft"
         :row="editModalDraft"
         :indexes="editModalIndexes"
         :foreigns="editModalForeigns"
         :data-types="workspace.dataTypes"
         :customizations="workspace.customizations"
         :mode="editModalMode"
         @confirm="confirmEditModal"
         @hide="hideEditModal"
      />
      <WorkspaceTabPropsTableOptionsModal
         v-if="isOptionsModal"
         :options="localOptions"
         :table="table"
         :customizations="workspace.customizations"
         :engines="Array.isArray(workspace.engines) ? workspace.engines : []"
         @confirm="optionsUpdate"
         @hide="hideOptionsModal"
      />
   </div>
</template>

<script setup lang="ts">
import { AlterTableParams, TableCheck, TableField, TableForeign, TableIndex, TableInfos, TableOptions } from 'common/interfaces/antares';
import { uidGen } from 'common/libs/uidGen';
import { storeToRefs } from 'pinia';
import { Component, computed, onBeforeUnmount, onMounted, Ref, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import BaseLoader from '@/components/BaseLoader.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import WorkspaceTabPropsTableChecksModal from '@/components/WorkspaceTabPropsTableChecksModal.vue';
import WorkspaceTabPropsTableDdlModal from '@/components/WorkspaceTabPropsTableDdlModal.vue';
import WorkspaceTabPropsTableEditModal from '@/components/WorkspaceTabPropsTableEditModal.vue';
import WorkspaceTabPropsTableFields from '@/components/WorkspaceTabPropsTableFields.vue';
import WorkspaceTabPropsTableForeignModal from '@/components/WorkspaceTabPropsTableForeignModal.vue';
import WorkspaceTabPropsTableIndexesModal from '@/components/WorkspaceTabPropsTableIndexesModal.vue';
import WorkspaceTabPropsTableOptionsModal from '@/components/WorkspaceTabPropsTableOptionsModal.vue';
import Tables from '@/ipc-api/Tables';
import { useNotificationsStore } from '@/stores/notifications';
import { useSettingsStore } from '@/stores/settings';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const props = defineProps({
   tabUid: String,
   connection: Object,
   isSelected: Boolean,
   table: String,
   schema: String,
   // null when no toolbar mount point — Teleport then short-circuits via v-if.
   // Empty string would crash Vue's Teleport (querySelector('') throws even
   // when :disabled="true" is set, because Vue still validates the selector).
   toolbarTarget: { type: String, default: null }
});

const { addNotification } = useNotificationsStore();
const workspacesStore = useWorkspacesStore();
const settingsStore = useSettingsStore();

const { getSelected: selectedWorkspace } = storeToRefs(workspacesStore);
const { showTableSize } = settingsStore;

const {
   getWorkspace,
   getDatabaseVariable,
   refreshStructure,
   renameTabs,
   changeBreadcrumbs,
   setUnsavedChanges
} = workspacesStore;

const indexTable: Ref<Component & {tableWrapper: HTMLDivElement }> = ref(null);
const firstInput: Ref<HTMLInputElement> = ref(null);
const isLoading = ref(false);
const isSaving = ref(false);
const isIndexesModal = ref(false);
const isForeignModal = ref(false);
const isTableChecksModal = ref(false);
const isDdlModal = ref(false);
const isOptionsModal = ref(false);
const editModalOpen = ref(false);
const editModalMode = ref<'edit' | 'create'>('edit');
const editModalDraft: Ref<TableField | null> = ref(null);
const editModalTargetId = ref<string | null>(null);

const originalFields: Ref<TableField[]> = ref([]);
const localFields: Ref<TableField[]> = ref([]);
const originalKeyUsage: Ref<TableForeign[]> = ref([]);
const localKeyUsage: Ref<TableForeign[]> = ref([]);
const originalIndexes: Ref<TableIndex[]> = ref([]);
const localIndexes: Ref<TableIndex[]> = ref([]);
const originalTableChecks: Ref<TableCheck[] | false> = ref([]);
const localTableChecks: Ref<TableCheck[] | false> = ref(false);
const tableOptions: Ref<TableOptions> = ref(null);
const localOptions: Ref<TableOptions> = ref({} as TableOptions);
const lastTable = ref(null);
const newFieldsCounter = ref(0);

const workspace = computed(() => {
   return getWorkspace(props.connection.uid);
});

const defaultCollation = computed(() => {
   if (workspace.value.customizations.collations)
      return getDatabaseVariable(selectedWorkspace.value, 'collation_server')?.value || '';
   return '';
});

const schemaTables = computed(() => {
   const schemaTables = workspace.value.structure
      .filter(schema => schema.name === props.schema)
      .map(schema => schema.tables);

   return schemaTables.length ? schemaTables[0].filter(table => table.type === 'table') : [];
});

const isChanged = computed(() => {
   return JSON.stringify(originalFields.value) !== JSON.stringify(localFields.value) ||
      JSON.stringify(originalKeyUsage.value) !== JSON.stringify(localKeyUsage.value) ||
      JSON.stringify(originalIndexes.value) !== JSON.stringify(localIndexes.value) ||
      JSON.stringify(originalTableChecks.value) !== JSON.stringify(localTableChecks.value) ||
      JSON.stringify(tableOptions.value) !== JSON.stringify(localOptions.value);
});

const getTableOptions = async (params: {uid: string; schema: string; table: string}) => {
   const db = workspace.value.structure.find(db => db.name === props.schema);

   if (db && db.tables.length && props.table && showTableSize)
      tableOptions.value = db.tables.find(table => table.name === props.table);
   else {
      const { status, response } = await Tables.getTableOptions(params);

      if (status === 'success')
         tableOptions.value = response;
      else
         addNotification({ status: 'error', message: response });
   }
};

const getFieldsData = async () => {
   if (!props.table) return;

   localFields.value = [];
   lastTable.value = props.table;
   newFieldsCounter.value = 0;
   isLoading.value = true;

   const params = {
      uid: props.connection.uid,
      schema: props.schema,
      table: props.table
   };

   try {
      await getTableOptions(params);
      localOptions.value = JSON.parse(JSON.stringify(tableOptions.value));
   }
   catch (err) {
      console.error(err);
   }

   try { // Columns data
      const { status, response } = await Tables.getTableColumns(params);
      if (status === 'success') {
         originalFields.value = response.map((field: TableField) => {
            if (field.autoIncrement)
               field.defaultType = 'autoincrement';
            else if (field.default === null)
               field.defaultType = 'noval';
            else if (field.default === 'NULL')
               field.defaultType = 'null';
            else if (typeof field.default === 'string' && isNaN(+field.default) && field.default.charAt(0) !== '\'')
               field.defaultType = 'expression';
            else {
               field.defaultType = 'custom';
               if (isNaN(+field.default) && !field.default.includes('\''))
                  field.default = `'${field.default}'`;
            }

            return { ...field, _antares_id: uidGen() };
         });
         localFields.value = JSON.parse(JSON.stringify(originalFields.value));
      }
      else
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   try { // Indexes
      const { status, response } = await Tables.getTableIndexes(params);

      if (status === 'success') {
         const indexesObj = response
            .filter((index: TableIndex) => index.type !== 'FOREIGN KEY')
            .reduce((acc: Record<string, TableIndex[]>, curr: TableIndex) => {
               acc[curr.name] = acc[curr.name] || [];
               acc[curr.name].push(curr);
               return acc;
            }, {});

         originalIndexes.value = Object.keys(indexesObj).map(index => {
            return {
               _antares_id: uidGen(),
               name: index,
               // eslint-disable-next-line @typescript-eslint/no-explicit-any
               fields: indexesObj[index].map((field: any) => field.column),
               type: indexesObj[index][0].type,
               comment: indexesObj[index][0].comment,
               indexType: indexesObj[index][0].indexType,
               indexComment: indexesObj[index][0].indexComment,
               cardinality: indexesObj[index][0].cardinality
            };
         });

         localIndexes.value = JSON.parse(JSON.stringify(originalIndexes.value));
      }
      else
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   try { // Key usage (foreign keys)
      const { status, response } = await Tables.getKeyUsage(params);

      if (status === 'success') {
         originalKeyUsage.value = response.map((foreign: TableForeign) => {
            return {
               _antares_id: uidGen(),
               ...foreign
            };
         });
         localKeyUsage.value = JSON.parse(JSON.stringify(originalKeyUsage.value));
      }
      else
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   isLoading.value = false;

   if (workspace.value.customizations.tableCheck) {
      try { // Table checks
         const { status, response } = await Tables.getTableChecks(params);

         if (status === 'success') {
            if (response === false) {
               originalTableChecks.value = false;
               localTableChecks.value = false;
            }
            else {
               originalTableChecks.value = response.map((check: TableCheck) => {
                  return {
                     _antares_id: uidGen(),
                     ...check
                  };
               });
               localTableChecks.value = JSON.parse(JSON.stringify(originalTableChecks.value));
            }
         }
         else
            addNotification({ status: 'error', message: response });
      }
      catch (err) {
         addNotification({ status: 'error', message: err.stack });
      }
   }
};

const saveChanges = async () => {
   if (isSaving.value) return;
   isSaving.value = true;

   // FIELDS
   const originalIDs = originalFields.value.reduce((acc, curr) => [...acc, curr._antares_id], []);
   const localIDs = localFields.value.reduce((acc, curr) => [...acc, curr._antares_id], []);

   // Fields Additions
   const additions = localFields.value.filter(field => !originalIDs.includes(field._antares_id)).map(field => {
      const lI = localFields.value.findIndex(localField => localField._antares_id === field._antares_id);
      const after = lI > 0 ? localFields.value[lI - 1].name : false;
      return { ...field, after };
   });

   // Fields Deletions
   const deletions = originalFields.value.filter(field => !localIDs.includes(field._antares_id));

   // Fields Changes
   const changes: TableField[] & {after: string | boolean; orgName: string}[] = [];
   localFields.value.forEach((field, i) => {
      const originalField = originalFields.value.find(oField => oField._antares_id === field._antares_id);
      if (!originalField) return;
      const after = i > 0 ? localFields.value[i - 1].name : false;
      const orgName = originalField.name;

      changes.push({ ...field, after, orgName });
   });

   // OPTIONS
   const options = Object.keys(localOptions.value).reduce((acc: {[key:string]: TableInfos}, option: keyof TableInfos) => {
      if (localOptions.value[option] !== tableOptions.value[option])
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         acc[option] = localOptions.value[option] as any;
      return acc;
   }, {});

   // INDEXES
   const indexChanges = {
      additions: [] as TableIndex[],
      changes: [] as TableIndex[],
      deletions: [] as TableIndex[]
   };
   const originalIndexIDs = originalIndexes.value.reduce((acc, curr) => [...acc, curr._antares_id], []);
   const localIndexIDs = localIndexes.value.reduce((acc, curr) => [...acc, curr._antares_id], []);

   // Index Additions
   indexChanges.additions = localIndexes.value.filter(index => !originalIndexIDs.includes(index._antares_id));

   // Index Changes
   originalIndexes.value.forEach(originalIndex => {
      const lI = localIndexes.value.findIndex(localIndex => localIndex._antares_id === originalIndex._antares_id);
      if (JSON.stringify(originalIndex) !== JSON.stringify(localIndexes.value[lI])) {
         if (localIndexes.value[lI]) {
            indexChanges.changes.push({
               ...localIndexes.value[lI],
               oldName: originalIndex.name,
               oldType: originalIndex.type
            });
         }
      }
   });

   // Index Deletions
   indexChanges.deletions = originalIndexes.value.filter(index => !localIndexIDs.includes(index._antares_id));

   // FOREIGN KEYS
   const foreignChanges = {
      additions: [] as TableForeign[],
      changes: [] as TableForeign[],
      deletions: [] as TableForeign[]
   };
   const originalForeignIDs = originalKeyUsage.value.reduce((acc, curr) => [...acc, curr._antares_id], []);
   const localForeignIDs = localKeyUsage.value.reduce((acc, curr) => [...acc, curr._antares_id], []);

   // Foreigns Additions
   foreignChanges.additions = localKeyUsage.value.filter(foreign => !originalForeignIDs.includes(foreign._antares_id));

   // Foreigns Changes
   originalKeyUsage.value.forEach(originalForeign => {
      const lI = localKeyUsage.value.findIndex(localForeign => localForeign._antares_id === originalForeign._antares_id);
      if (JSON.stringify(originalForeign) !== JSON.stringify(localKeyUsage.value[lI])) {
         if (localKeyUsage.value[lI]) {
            foreignChanges.changes.push({
               ...localKeyUsage.value[lI],
               oldName: originalForeign.constraintName
            });
         }
      }
   });

   // Foreigns Deletions
   foreignChanges.deletions = originalKeyUsage.value.filter(foreign => !localForeignIDs.includes(foreign._antares_id));

   // CHECKS
   if (originalTableChecks.value !== false && localTableChecks.value !== false) {
      const checkChanges = {
         additions: [] as TableCheck[],
         changes: [] as TableCheck[],
         deletions: [] as TableCheck[]
      };
      const originalCheckIDs = originalTableChecks.value.reduce((acc, curr) => [...acc, curr._antares_id], []);
      const localCheckIDs = localTableChecks.value.reduce((acc, curr) => [...acc, curr._antares_id], []);

      // Check Additions
      checkChanges.additions = localTableChecks.value.filter(check => !originalCheckIDs.includes(check._antares_id));

      // Check Changes
      originalTableChecks.value.forEach(originalCheck => {
         const lI = Array.isArray(localTableChecks.value)
            ? localTableChecks.value.findIndex(localCheck => localCheck._antares_id === originalCheck._antares_id)
            : -1;
         if (Array.isArray(localTableChecks.value) && JSON.stringify(originalCheck) !== JSON.stringify(localTableChecks.value[lI])) {
            if (localTableChecks.value[lI]) {
               checkChanges.changes.push({
                  ...localTableChecks.value[lI]
               });
            }
         }
      });

      // Check Deletions
      checkChanges.deletions = originalTableChecks.value.filter(check => !localCheckIDs.includes(check._antares_id));
   }

   // CHECKS
   const checkChanges = {
      additions: [] as TableCheck[],
      changes: [] as TableCheck[],
      deletions: [] as TableCheck[]
   };

   if (originalTableChecks.value !== false && localTableChecks.value !== false) {
      const originalCheckIDs = originalTableChecks.value.reduce((acc, curr) => [...acc, curr._antares_id], []);
      const localCheckIDs = localTableChecks.value.reduce((acc, curr) => [...acc, curr._antares_id], []);

      // Check Additions
      checkChanges.additions = localTableChecks.value.filter(check => !originalCheckIDs.includes(check._antares_id));

      // Check Changes
      originalTableChecks.value.forEach(originalCheck => {
         const lI = Array.isArray(localTableChecks.value)
            ? localTableChecks.value.findIndex(localCheck => localCheck._antares_id === originalCheck._antares_id)
            : -1;
         if (Array.isArray(localTableChecks.value) && JSON.stringify(originalCheck) !== JSON.stringify(localTableChecks.value[lI])) {
            if (localTableChecks.value[lI]) {
               checkChanges.changes.push({
                  ...localTableChecks.value[lI]
               });
            }
         }
      });

      // Check Deletions
      checkChanges.deletions = originalTableChecks.value.filter(check => !localCheckIDs.includes(check._antares_id));
   }

   // ALTER
   const params = {
      uid: props.connection.uid,
      schema: props.schema,
      table: props.table,
      tableStructure: {
         name: localOptions.value.name,
         fields: localFields.value,
         foreigns: localKeyUsage.value,
         indexes: localIndexes.value
      },
      additions,
      changes,
      deletions,
      indexChanges,
      foreignChanges,
      checkChanges,
      options
   } as unknown as AlterTableParams;

   try {
      const { status, response } = await Tables.alterTable(params);

      if (status === 'success') {
         const oldName = tableOptions.value.name;

         await refreshStructure(props.connection.uid);

         if (oldName !== localOptions.value.name) {
            renameTabs({
               uid: props.connection.uid,
               schema: props.schema,
               elementName: oldName,
               elementNewName: localOptions.value.name,
               elementType: 'table'
            });

            changeBreadcrumbs({ schema: props.schema, table: localOptions.value.name });
         }
         else
            getFieldsData();
      }
      else {
         addNotification({ status: 'error', message: response });
         // Autocommit-on-confirm relies on local state always matching DB
         // after every operation. On ALTER TABLE rejection, refetch so
         // local snaps back to the pre-mutation state — otherwise the
         // failed mutation lingers in localXxx with no Save button to
         // retry/clear it.
         await getFieldsData();
      }
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
      await getFieldsData();
   }

   isSaving.value = false;
   newFieldsCounter.value = 0;
};

const clearChanges = () => {
   localFields.value = JSON.parse(JSON.stringify(originalFields.value));
   localIndexes.value = JSON.parse(JSON.stringify(originalIndexes.value));
   localKeyUsage.value = JSON.parse(JSON.stringify(originalKeyUsage.value));
   localTableChecks.value = JSON.parse(JSON.stringify(originalTableChecks.value));
   localOptions.value = JSON.parse(JSON.stringify(tableOptions.value));
   newFieldsCounter.value = 0;
};

const buildDraftField = (): TableField => {
   const uid = uidGen();
   return {
      _antares_id: uid,
      name: `${t('database.field', 1)}_${uid.substring(0, 4)}`,
      key: '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: (workspace.value.dataTypes[0] as any).types[0].name,
      schema: props.schema,
      numPrecision: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      numLength: (workspace.value.dataTypes[0] as any).types[0].length,
      datePrecision: null,
      charLength: null,
      nullable: false,
      unsigned: false,
      zerofill: false,
      order: localFields.value.length + 1,
      default: null,
      charset: null,
      collation: defaultCollation.value,
      autoIncrement: false,
      onUpdate: '',
      comment: '',
      alias: '',
      tableAlias: '',
      orgTable: ''
   } as TableField;
};

const editModalIndexes = computed(() => {
   if (!editModalDraft.value) return [];
   const fieldName = editModalDraft.value.name;
   return localIndexes.value.reduce((acc, curr) => {
      acc.push(...curr.fields.map(f => ({ name: f, type: curr.type })));
      return acc;
   }, [] as { name: string; type: string }[]).filter(f => f.name === fieldName);
});

const editModalForeigns = computed(() => {
   if (!editModalDraft.value) return [];
   const fieldName = editModalDraft.value.name;
   return localKeyUsage.value.reduce((acc, curr) => {
      if (curr.field === fieldName)
         acc.push(`${curr.refTable}.${curr.refField}`);
      return acc;
   }, [] as string[]);
});

const openEditField = (uid: string) => {
   const field = localFields.value.find(f => f._antares_id === uid);
   if (!field) return;
   // Deep-clone so modal edits don't leak until confirmed
   editModalDraft.value = JSON.parse(JSON.stringify(field));
   editModalTargetId.value = uid;
   editModalMode.value = 'edit';
   editModalOpen.value = true;
};

const addField = () => {
   editModalDraft.value = buildDraftField();
   editModalTargetId.value = null;
   editModalMode.value = 'create';
   editModalOpen.value = true;
};

const hideEditModal = () => {
   editModalOpen.value = false;
   editModalDraft.value = null;
   editModalTargetId.value = null;
};

const confirmEditModal = async (updated: TableField) => {
   if (editModalMode.value === 'create') {
      localFields.value.push({ ...updated });
      setTimeout(() => {
         const scrollable = indexTable.value?.tableWrapper;
         if (scrollable) scrollable.scrollTop = scrollable.scrollHeight + 30;
      }, 20);
   }
   else {
      const target = localFields.value.find(f => f._antares_id === editModalTargetId.value);
      if (target) {
         const oldName = target.name;
         Object.assign(target, updated);
         if (updated.name !== oldName)
            renameField({ index: '', old: oldName, new: updated.name } as any);
      }
   }
   hideEditModal();
   await saveChanges();
};

const renameField = (payload: {index: string; new: string; old: string}) => {
   localIndexes.value = localIndexes.value.map(index => {
      const fi = index.fields.findIndex(field => field === payload.old);
      if (fi !== -1)
         index.fields[fi] = payload.new;
      return index;
   });

   localKeyUsage.value = localKeyUsage.value.map(key => {
      if (key.field === payload.old)
         key.field = payload.new;
      return key;
   });
};

const duplicateField = async (uid: string) => {
   const fieldToClone = Object.assign({}, localFields.value.find(field => field._antares_id === uid));
   fieldToClone._antares_id = uidGen();
   fieldToClone.name = `${fieldToClone.name}_copy`;
   fieldToClone.order = localFields.value.length + 1;
   localFields.value = [...localFields.value, fieldToClone];

   setTimeout(() => {
      const scrollable = indexTable.value.tableWrapper;
      scrollable.scrollTop = scrollable.scrollHeight + 30;
   }, 20);
   await saveChanges();
};

const removeField = async (uid: string) => {
   localFields.value = localFields.value.filter(field => field._antares_id !== uid);
   localKeyUsage.value = localKeyUsage.value.filter(fk =>// Clear foreign keys
      localFields.value.some(field => field.name === fk.field)
   );
   localIndexes.value = localIndexes.value.filter(index =>// Clear indexes
      localFields.value.some(field =>
         index.fields.includes(field.name)
      )
   );
   await saveChanges();
};

const addNewIndex = (payload: { index: string; field: string }) => {
   localIndexes.value = [...localIndexes.value, {
      _antares_id: uidGen(),
      name: payload.index === 'PRIMARY' ? 'PRIMARY' : payload.field,
      fields: [payload.field],
      type: payload.index,
      comment: '',
      indexType: 'BTREE',
      indexComment: '',
      cardinality: 0
   }];
};

const addToIndex = (payload: { index: string; field: string }) => {
   localIndexes.value = localIndexes.value.map(index => {
      if (index._antares_id === payload.index) index.fields.push(payload.field);
      return index;
   });
};

const showIntdexesModal = () => {
   isIndexesModal.value = true;
};

const hideIndexesModal = () => {
   isIndexesModal.value = false;
};

const showOptionsModal = () => {
   isOptionsModal.value = true;
};

const hideOptionsModal = () => {
   isOptionsModal.value = false;
};

const optionsUpdate = async (next: typeof localOptions.value) => {
   Object.assign(localOptions.value, next);
   isOptionsModal.value = false;
   await saveChanges();
};

const indexesUpdate = async (indexes: TableIndex[]) => {
   localIndexes.value = indexes;
   await saveChanges();
};

const showForeignModal = () => {
   isForeignModal.value = true;
};

const hideForeignModal = () => {
   isForeignModal.value = false;
};

const showTableChecksModal = () => {
   isTableChecksModal.value = true;
};

const hideTableChecksModal = () => {
   isTableChecksModal.value = false;
};

const showDdlModal = () => {
   isDdlModal.value = true;
};

const hideDdlModal = () => {
   isDdlModal.value = false;
};

const foreignsUpdate = async (foreigns: TableForeign[]) => {
   localKeyUsage.value = foreigns;
   await saveChanges();
};

const checksUpdate = async (checks: TableCheck[]) => {
   localTableChecks.value = checks;
   await saveChanges();
};

const saveContentListener = () => {
   const hasModalOpen = !!document.querySelectorAll('.modal.active').length;
   if (props.isSelected && !hasModalOpen && isChanged.value)
      saveChanges();
};

watch(() => props.schema, () => {
   if (props.isSelected) {
      getFieldsData();
      lastTable.value = props.table;
   }
});

watch(() => props.table, () => {
   if (props.isSelected) {
      getFieldsData();
      lastTable.value = props.table;
   }
});

watch(() => props.isSelected, (val) => {
   if (val) {
      changeBreadcrumbs({ schema: props.schema, table: props.table });

      if (lastTable.value !== props.table)
         getFieldsData();
   }
});

watch(isChanged, (val) => {
   setUnsavedChanges({ uid: props.connection.uid, tUid: props.tabUid, isChanged: val });
});

getFieldsData();

onMounted(() => {
   window.addEventListener('antares:save-content', saveContentListener);
});

onBeforeUnmount(() => {
   window.removeEventListener('antares:save-content', saveContentListener);
});
</script>
