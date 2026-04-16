<template>
   <div
      ref="tableWrapper"
      class="vscroll"
      :style="{'height': resultsSize+'px'}"
   >
      <TableContext
         v-if="isContext"
         :context-event="contextEvent"
         :selected-field="selectedField"
         :index-types="indexTypes"
         :indexes="indexes"
         @delete-selected="removeField"
         @duplicate-selected="duplicateField"
         @close-context="isContext = false"
         @add-new-index="emit('add-new-index', $event)"
         @add-to-index="emit('add-to-index', $event)"
      />
      <div ref="propTable" class="table table-hover">
         <div class="thead">
            <div class="tr">
               <div class="th th-order">
                  <div class="text-right">
                     {{ t('database.order') }}
                  </div>
               </div>
               <div class="th">
                  <div class="column-resizable min-120">
                     <div class="table-column-title">
                        {{ t('database.fieldName') }}
                     </div>
                  </div>
               </div>
               <div class="th">
                  <div class="column-resizable min-100">
                     <div class="table-column-title">
                        {{ t('database.type') }}
                     </div>
                  </div>
               </div>
               <div class="th th-chip">
                  <div class="table-column-title">
                     {{ t('database.primaryKey') }}
                  </div>
               </div>
               <div v-if="customizations.autoIncrement" class="th th-chip">
                  <div class="table-column-title">
                     {{ t('database.autoIncrement') }}
                  </div>
               </div>
               <div v-if="customizations.nullable" class="th th-chip">
                  <div class="table-column-title">
                     {{ t('database.allowNull') }}
                  </div>
               </div>
               <div class="th th-num">
                  <div class="table-column-title">
                     {{ t('database.length') }}
                  </div>
               </div>
               <div class="th th-scale">
                  <div class="table-column-title">
                     {{ t('database.precision') }}
                  </div>
               </div>
               <div class="th th-chip2">
                  <div class="table-column-title">
                     FK / UQ
                  </div>
               </div>
               <div class="th">
                  <div class="column-resizable">
                     <div class="table-column-title">
                        {{ t('database.default') }}
                     </div>
                  </div>
               </div>
               <div v-if="customizations.comment" class="th">
                  <div class="column-resizable">
                     <div class="table-column-title">
                        {{ t('database.comment') }}
                     </div>
                  </div>
               </div>
               <div v-if="customizations.collation" class="th">
                  <div class="column-resizable min-100">
                     <div class="table-column-title">
                        {{ t('database.collation') }}
                     </div>
                  </div>
               </div>
               <div class="th th-ops">
                  <div class="table-column-title">
                     {{ t('general.actions') }}
                  </div>
               </div>
            </div>
         </div>
         <Draggable
            ref="resultTable"
            :list="fields"
            class="tbody"
            item-key="_antares_id"
            handle=".row-draggable"
         >
            <template #item="{element}">
               <TableRow
                  :row="element"
                  :indexes="getIndexes(element.name)"
                  :foreigns="getForeigns(element.name)"
                  :data-types="dataTypes"
                  :customizations="customizations"
                  @contextmenu="contextMenu"
                  @rename-field="emit('rename-field', $event)"
                  @move-up="moveFieldUp"
                  @move-down="moveFieldDown"
                  @remove-field-row="removeFieldById"
               />
            </template>
         </Draggable>
      </div>
   </div>
</template>

<script setup lang="ts">
import { TableField, TableForeign, TableIndex } from 'common/interfaces/antares';
import { storeToRefs } from 'pinia';
import { Component, computed, onMounted, onUnmounted, onUpdated, Prop, Ref, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import * as Draggable from 'vuedraggable';

import TableContext from '@/components/WorkspaceTabPropsTableContext.vue';
import TableRow from '@/components/WorkspaceTabPropsTableRow.vue';
import { useConsoleStore } from '@/stores/console';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const props = defineProps({
   fields: Array as Prop<TableField[]>,
   indexes: Array as Prop<TableIndex[]>,
   foreigns: Array as Prop<TableForeign[]>,
   indexTypes: Array as Prop<string[]>,
   tabUid: [String, Number],
   connUid: String,
   table: String,
   schema: String,
   mode: String
});

const emit = defineEmits<{
   'add-new-index': [index: any];
   'add-to-index': [index: any];
   'rename-field': [field: any];
   'duplicate-field': [id: string];
   'remove-field': [id: string];
}>();

const workspacesStore = useWorkspacesStore();
const consoleStore = useConsoleStore();

const { getWorkspace } = workspacesStore;

const { consoleHeight } = storeToRefs(consoleStore);

const tableWrapper: Ref<HTMLDivElement> = ref(null);
const propTable: Ref<HTMLDivElement> = ref(null);
const resultTable: Ref<Component> = ref(null);
const resultsSize = ref(1000);
const isContext = ref(false);
const contextEvent = ref(null);
const selectedField = ref(null);
const scrollElement = ref(null);

const customizations = computed(() => getWorkspace(props.connUid).customizations);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dataTypes = computed(() => getWorkspace(props.connUid).dataTypes) as any;
const fieldsLength = computed(() => props.fields.length);

const resizeResults = () => {
   if (resultTable.value) {
      const el = tableWrapper.value;

      if (el) {
         let sizeToSubtract = 0;
         const footer = document.getElementById('footer');
         if (footer) sizeToSubtract += footer.offsetHeight;

         sizeToSubtract += consoleHeight.value;

         const size = window.innerHeight - el.getBoundingClientRect().top - sizeToSubtract;
         resultsSize.value = size;
      }
   }
};

const refreshScroller = () => {
   resizeResults();
};

const contextMenu = (event: MouseEvent, uid: string) => {
   selectedField.value = props.fields.find(field => field._antares_id === uid);
   contextEvent.value = event;
   isContext.value = true;
};

const duplicateField = () => {
   emit('duplicate-field', selectedField.value._antares_id);
};

const removeField = () => {
   emit('remove-field', selectedField.value._antares_id);
};

const removeFieldById = (id: string) => {
   emit('remove-field', id);
};

const moveFieldUp = (id: string) => {
   const idx = props.fields.findIndex(f => f._antares_id === id);
   if (idx <= 0) return;
   const arr = props.fields as typeof props.fields;
   [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
};

const moveFieldDown = (id: string) => {
   const idx = props.fields.findIndex(f => f._antares_id === id);
   if (idx < 0 || idx >= props.fields.length - 1) return;
   const arr = props.fields as typeof props.fields;
   [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
};

const getIndexes = (field: string) => {
   return props.indexes.reduce((acc, curr) => {
      acc.push(...curr.fields.map(f => ({ name: f, type: curr.type })));
      return acc;
   }, []).filter(f => f.name === field);
};

const getForeigns = (field: string) => {
   return props.foreigns.reduce((acc, curr) => {
      if (curr.field === field)
         acc.push(`${curr.refTable}.${curr.refField}`);
      return acc;
   }, []);
};

watch(fieldsLength, () => {
   refreshScroller();
});

watch(consoleHeight, () => {
   resizeResults();
});

onUpdated(() => {
   if (propTable.value)
      refreshScroller();

   if (tableWrapper.value)
      scrollElement.value = tableWrapper.value;
});

onMounted(() => {
   window.addEventListener('resize', resizeResults);
});

onUnmounted(() => {
   window.removeEventListener('resize', resizeResults);
});

defineExpose({ tableWrapper });
</script>

<style lang="scss" scoped>
.column-resizable {
  &:hover,
  &:active {
    resize: horizontal;
    overflow: hidden;
  }
}

.vscroll {
  overflow: auto;
}

.min-100 {
  min-width: 100px !important;
}

.min-120 {
  min-width: 120px !important;
}

// Fixed-width header cells
.th-order {
  width: 55px;
  min-width: 55px;
  max-width: 55px;
}

.th-chip {
  width: 54px;
  min-width: 54px;
  max-width: 54px;
  text-align: center;
}

.th-num {
  width: 52px;
  min-width: 52px;
  max-width: 52px;
}

.th-chip2 {
  width: 72px;
  min-width: 72px;
  max-width: 72px;
  text-align: center;
}

.th-scale {
  width: 40px;
  min-width: 40px;
  max-width: 40px;
}

.th-ops {
  width: 110px;
  min-width: 110px;
  max-width: 110px;
  text-align: center;
}
</style>
