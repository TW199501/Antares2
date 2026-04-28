<template>
   <details
      ref="schemaAccordion"
      class="accordion workspace-explorebar-database"
      open
   >
      <ContextMenu>
         <ContextMenuTrigger as-child>
            <summary
               class="accordion-header database-name"
               :class="{'text-bold': breadcrumbs.schema === database.name}"
               @click="selectSchema(database.name)"
            >
               <div v-if="isLoading" class="icon loading" />
               <BaseIcon
                  v-else
                  class="icon"
                  icon-name="mdiChevronRight"
                  :size="18"
               />
               <BaseIcon
                  class="database-icon mr-1"
                  icon-name="mdiDatabase"
                  :size="18"
               />
               <div class="">
                  <span v-html="highlightWord(database.name, 'schemas')" />
                  <div
                     v-if="database.size"
                     class="schema-size tooltip tooltip-left mr-1"
                     :data-tooltip="formatBytes(database.size)"
                  >
                     <BaseIcon
                        class="mr-2"
                        icon-name="mdiInformationOutline"
                        :size="18"
                     />
                  </div>
               </div>
            </summary>
         </ContextMenuTrigger>
         <DatabaseContext
            :selected-schema="database.name"
            @open-create-table-tab="emit('open-create-table-tab', database.name)"
            @open-create-view-tab="emit('open-create-view-tab', database.name)"
            @open-create-materialized-view-tab="emit('open-create-materialized-view-tab', database.name)"
            @open-create-trigger-tab="emit('open-create-trigger-tab', database.name)"
            @open-create-routine-tab="emit('open-create-routine-tab', database.name)"
            @open-create-function-tab="emit('open-create-function-tab', database.name)"
            @open-create-trigger-function-tab="emit('open-create-trigger-function-tab', database.name)"
            @open-create-scheduler-tab="emit('open-create-scheduler-tab', database.name)"
            @reload="emit('reload')"
         />
      </ContextMenu>
      <div class="accordion-body">
         <div class="database-tables">
            <ul class="pt-0">
               <ContextMenu
                  v-for="table of filteredTables"
                  :key="table.name"
               >
                  <ContextMenuTrigger as-child>
                     <li
                        class="tree-row"
                        :class="{'selected': breadcrumbs.schema === database.name && [breadcrumbs.table, breadcrumbs.view].includes(table.name)}"
                        @mousedown.left="selectTable({schema: database.name, table})"
                        @dblclick="openDataTab({schema: database.name, table})"
                     >
                        <a class="table-name">
                           <div v-if="checkLoadingStatus(table.name, 'table')" class="icon loading mr-1" />
                           <BaseIcon
                              v-else
                              class="table-icon mr-1"
                              :icon-name="table.type === 'view' ? 'mdiTableEye' : 'mdiTable'"
                              :size="18"
                              :style="`min-width: 18px`"
                           />
                           <span v-html="highlightWord(table.name)" />
                           <span v-if="table.comment" class="table-comment">{{ table.comment }}</span>
                        </a>
                        <div
                           v-if="table.type === 'table' && table.size !== false && !isNaN(table.size)"
                           class="table-size  tooltip tooltip-left mr-1"
                           :data-tooltip="formatBytes(table.size)"
                        >
                           <div class="pie" :style="piePercentage(table.size)" />
                        </div>
                     </li>
                  </ContextMenuTrigger>
                  <TableContext
                     :selected-table="table"
                     :selected-schema="database.name"
                     @duplicate-table="(p) => emit('duplicate-table', p)"
                     @delete-table="(p) => emit('delete-table', p)"
                     @reload="emit('reload')"
                  />
               </ContextMenu>
            </ul>
         </div>

         <div v-if="filteredViews.length" class="database-misc">
            <details class="accordion">
               <ContextMenu>
                  <ContextMenuTrigger as-child>
                     <summary
                        class="accordion-header misc-name"
                        :class="{'text-bold': breadcrumbs.schema === database.name && breadcrumbs.trigger}"
                     >
                        <BaseIcon
                           class="misc-icon mr-1"
                           icon-name="mdiFolderEye"
                           :size="18"
                        />
                        <BaseIcon
                           class="misc-icon open-folder mr-1"
                           icon-name="mdiFolderOpen"
                           :size="18"
                        />
                        {{ t('database.view', 2) }}
                     </summary>
                  </ContextMenuTrigger>
                  <MiscFolderContext
                     :selected-misc="'view'"
                     :selected-schema="database.name"
                     @open-create-view-tab="emit('open-create-view-tab', database.name)"
                     @open-create-materialized-view-tab="emit('open-create-materialized-view-tab', database.name)"
                     @open-create-trigger-tab="emit('open-create-trigger-tab', database.name)"
                     @open-create-trigger-function-tab="emit('open-create-trigger-function-tab', database.name)"
                     @open-create-routine-tab="emit('open-create-routine-tab', database.name)"
                     @open-create-function-tab="emit('open-create-function-tab', database.name)"
                     @open-create-scheduler-tab="emit('open-create-scheduler-tab', database.name)"
                     @reload="emit('reload')"
                  />
               </ContextMenu>
               <div class="accordion-body">
                  <div>
                     <ul class="pt-0">
                        <ContextMenu
                           v-for="view of filteredViews"
                           :key="view.name"
                        >
                           <ContextMenuTrigger as-child>
                              <li
                                 class="tree-row"
                                 :class="{'selected': breadcrumbs.schema === database.name && breadcrumbs.view === view.name}"
                                 @mousedown.left="selectTable({schema: database.name, table: view})"
                                 @dblclick="openDataTab({schema: database.name, table: view})"
                              >
                                 <a class="table-name">
                                    <div v-if="checkLoadingStatus(view.name, 'table')" class="icon loading mr-1" />
                                    <BaseIcon
                                       v-else
                                       class="table-icon mr-1"
                                       icon-name="mdiTableEye"
                                       :size="18"
                                       :style="`min-width: 18px`"
                                    />
                                    <span v-html="highlightWord(view.name)" />
                                 </a>
                              </li>
                           </ContextMenuTrigger>
                           <TableContext
                              :selected-table="view"
                              :selected-schema="database.name"
                              @duplicate-table="(p) => emit('duplicate-table', p)"
                              @delete-table="(p) => emit('delete-table', p)"
                              @reload="emit('reload')"
                           />
                        </ContextMenu>
                     </ul>
                  </div>
               </div>
            </details>
         </div>

         <div v-if="filteredMatViews.length && customizations.materializedViews" class="database-misc">
            <details class="accordion">
               <ContextMenu>
                  <ContextMenuTrigger as-child>
                     <summary
                        class="accordion-header misc-name"
                        :class="{'text-bold': breadcrumbs.schema === database.name && breadcrumbs.trigger}"
                     >
                        <BaseIcon
                           class="misc-icon mr-1"
                           icon-name="mdiFolderEye"
                           :size="18"
                        />
                        <BaseIcon
                           class="misc-icon open-folder mr-1"
                           icon-name="mdiFolderOpen"
                           :size="18"
                        />
                        {{ t('database.materializedView', 2) }}
                     </summary>
                  </ContextMenuTrigger>
                  <MiscFolderContext
                     :selected-misc="'materializedView'"
                     :selected-schema="database.name"
                     @open-create-view-tab="emit('open-create-view-tab', database.name)"
                     @open-create-materialized-view-tab="emit('open-create-materialized-view-tab', database.name)"
                     @open-create-trigger-tab="emit('open-create-trigger-tab', database.name)"
                     @open-create-trigger-function-tab="emit('open-create-trigger-function-tab', database.name)"
                     @open-create-routine-tab="emit('open-create-routine-tab', database.name)"
                     @open-create-function-tab="emit('open-create-function-tab', database.name)"
                     @open-create-scheduler-tab="emit('open-create-scheduler-tab', database.name)"
                     @reload="emit('reload')"
                  />
               </ContextMenu>
               <div class="accordion-body">
                  <div>
                     <ul class="pt-0">
                        <ContextMenu
                           v-for="view of filteredMatViews"
                           :key="view.name"
                        >
                           <ContextMenuTrigger as-child>
                              <li
                                 class="tree-row"
                                 :class="{'selected': breadcrumbs.schema === database.name && breadcrumbs.view === view.name}"
                                 @mousedown.left="selectTable({schema: database.name, table: view})"
                                 @dblclick="openDataTab({schema: database.name, table: view})"
                              >
                                 <a class="table-name">
                                    <div v-if="checkLoadingStatus(view.name, 'table')" class="icon loading mr-1" />
                                    <BaseIcon
                                       v-else
                                       class="table-icon mr-1"
                                       icon-name="mdiTableEye"
                                       :size="18"
                                       :style="`min-width: 18px`"
                                    />
                                    <span v-html="highlightWord(view.name)" />
                                 </a>
                              </li>
                           </ContextMenuTrigger>
                           <TableContext
                              :selected-table="view"
                              :selected-schema="database.name"
                              @duplicate-table="(p) => emit('duplicate-table', p)"
                              @delete-table="(p) => emit('delete-table', p)"
                              @reload="emit('reload')"
                           />
                        </ContextMenu>
                     </ul>
                  </div>
               </div>
            </details>
         </div>

         <div v-if="filteredTriggers.length && customizations.triggers" class="database-misc">
            <details class="accordion">
               <ContextMenu>
                  <ContextMenuTrigger as-child>
                     <summary
                        class="accordion-header misc-name"
                        :class="{'text-bold': breadcrumbs.schema === database.name && breadcrumbs.trigger}"
                     >
                        <BaseIcon
                           class="misc-icon mr-1"
                           icon-name="mdiFolderCog"
                           :size="18"
                        />
                        <BaseIcon
                           class="misc-icon open-folder mr-1"
                           icon-name="mdiFolderOpen"
                           :size="18"
                        />
                        {{ t('database.trigger', 2) }}
                     </summary>
                  </ContextMenuTrigger>
                  <MiscFolderContext
                     :selected-misc="'trigger'"
                     :selected-schema="database.name"
                     @open-create-view-tab="emit('open-create-view-tab', database.name)"
                     @open-create-materialized-view-tab="emit('open-create-materialized-view-tab', database.name)"
                     @open-create-trigger-tab="emit('open-create-trigger-tab', database.name)"
                     @open-create-trigger-function-tab="emit('open-create-trigger-function-tab', database.name)"
                     @open-create-routine-tab="emit('open-create-routine-tab', database.name)"
                     @open-create-function-tab="emit('open-create-function-tab', database.name)"
                     @open-create-scheduler-tab="emit('open-create-scheduler-tab', database.name)"
                     @reload="emit('reload')"
                  />
               </ContextMenu>
               <div class="accordion-body">
                  <div>
                     <ul class="pt-0">
                        <ContextMenu
                           v-for="trigger of filteredTriggers"
                           :key="trigger.name"
                        >
                           <ContextMenuTrigger as-child>
                              <li
                                 class="tree-row"
                                 :class="{'selected': breadcrumbs.schema === database.name && breadcrumbs.trigger === trigger.name}"
                                 @mousedown.left="selectMisc({schema: database.name, misc: trigger, type: 'trigger'})"
                                 @dblclick="openMiscPermanentTab({schema: database.name, misc: trigger, type: 'trigger'})"
                              >
                                 <a class="table-name">
                                    <div v-if="checkLoadingStatus(trigger.name, 'trigger')" class="icon loading mr-1" />
                                    <BaseIcon
                                       v-else
                                       class="table-icon mr-1"
                                       icon-name="mdiTableCog"
                                       :size="18"
                                       :style="`min-width: 18px`"
                                    />
                                    <span v-html="highlightWord(trigger.name)" />
                                 </a>
                                 <div
                                    v-if="trigger.enabled === false"
                                    class="tooltip tooltip-left disabled-indicator"
                                    :data-tooltip="t('general.disabled')"
                                 >
                                    <BaseIcon
                                       class="table-icon mr-1"
                                       icon-name="mdiPause"
                                       :size="18"
                                    />
                                 </div>
                              </li>
                           </ContextMenuTrigger>
                           <MiscContext
                              :selected-misc="{...trigger, type: 'trigger'}"
                              :selected-schema="database.name"
                              @reload="emit('reload')"
                           />
                        </ContextMenu>
                     </ul>
                  </div>
               </div>
            </details>
         </div>

         <div v-if="filteredProcedures.length && customizations.routines" class="database-misc">
            <details class="accordion">
               <ContextMenu>
                  <ContextMenuTrigger as-child>
                     <summary
                        class="accordion-header misc-name"
                        :class="{'text-bold': breadcrumbs.schema === database.name && breadcrumbs.routine}"
                     >
                        <BaseIcon
                           class="misc-icon mr-1"
                           icon-name="mdiFolderSync"
                           :size="18"
                        />
                        <BaseIcon
                           class="misc-icon open-folder mr-1"
                           icon-name="mdiFolderOpen"
                           :size="18"
                        />
                        {{ t('database.storedRoutine', 2) }}
                     </summary>
                  </ContextMenuTrigger>
                  <MiscFolderContext
                     :selected-misc="'routine'"
                     :selected-schema="database.name"
                     @open-create-view-tab="emit('open-create-view-tab', database.name)"
                     @open-create-materialized-view-tab="emit('open-create-materialized-view-tab', database.name)"
                     @open-create-trigger-tab="emit('open-create-trigger-tab', database.name)"
                     @open-create-trigger-function-tab="emit('open-create-trigger-function-tab', database.name)"
                     @open-create-routine-tab="emit('open-create-routine-tab', database.name)"
                     @open-create-function-tab="emit('open-create-function-tab', database.name)"
                     @open-create-scheduler-tab="emit('open-create-scheduler-tab', database.name)"
                     @reload="emit('reload')"
                  />
               </ContextMenu>
               <div class="accordion-body">
                  <div>
                     <ul class="pt-0">
                        <ContextMenu
                           v-for="(routine, i) of filteredProcedures"
                           :key="`${routine.name}-${i}`"
                        >
                           <ContextMenuTrigger as-child>
                              <li
                                 class="tree-row"
                                 :class="{'selected': breadcrumbs.schema === database.name && breadcrumbs.routine === routine.name}"
                                 @mousedown.left="selectMisc({schema: database.name, misc: routine, type: 'routine'})"
                                 @dblclick="openMiscPermanentTab({schema: database.name, misc: routine, type: 'routine'})"
                              >
                                 <a class="table-name">
                                    <BaseIcon
                                       class="table-icon mr-1"
                                       icon-name="mdiSyncCircle"
                                       :size="18"
                                       :style="`min-width: 18px`"
                                    />
                                    <span v-html="highlightWord(routine.name)" />
                                 </a>
                              </li>
                           </ContextMenuTrigger>
                           <MiscContext
                              :selected-misc="{...routine, type: 'routine'}"
                              :selected-schema="database.name"
                              @reload="emit('reload')"
                           />
                        </ContextMenu>
                     </ul>
                  </div>
               </div>
            </details>
         </div>

         <div v-if="filteredTriggerFunctions.length && customizations.triggerFunctions" class="database-misc">
            <details class="accordion">
               <ContextMenu>
                  <ContextMenuTrigger as-child>
                     <summary
                        class="accordion-header misc-name"
                        :class="{'text-bold': breadcrumbs.schema === database.name && breadcrumbs.triggerFunction}"
                     >
                        <BaseIcon
                           class="misc-icon mr-1"
                           icon-name="mdiFolderRefresh"
                           :size="18"
                           :style="`min-width: 18px`"
                        />
                        <BaseIcon
                           class="misc-icon open-folder mr-1"
                           icon-name="mdiFolderOpen"
                           :size="18"
                        />
                        {{ t('database.triggerFunction', 2) }}
                     </summary>
                  </ContextMenuTrigger>
                  <MiscFolderContext
                     :selected-misc="'triggerFunction'"
                     :selected-schema="database.name"
                     @open-create-view-tab="emit('open-create-view-tab', database.name)"
                     @open-create-materialized-view-tab="emit('open-create-materialized-view-tab', database.name)"
                     @open-create-trigger-tab="emit('open-create-trigger-tab', database.name)"
                     @open-create-trigger-function-tab="emit('open-create-trigger-function-tab', database.name)"
                     @open-create-routine-tab="emit('open-create-routine-tab', database.name)"
                     @open-create-function-tab="emit('open-create-function-tab', database.name)"
                     @open-create-scheduler-tab="emit('open-create-scheduler-tab', database.name)"
                     @reload="emit('reload')"
                  />
               </ContextMenu>
               <div class="accordion-body">
                  <div>
                     <ul class="pt-0">
                        <ContextMenu
                           v-for="(func, i) of filteredTriggerFunctions"
                           :key="`${func.name}-${i}`"
                        >
                           <ContextMenuTrigger as-child>
                              <li
                                 class="tree-row"
                                 :class="{'selected': breadcrumbs.schema === database.name && breadcrumbs.triggerFunction === func.name}"
                                 @mousedown.left="selectMisc({schema: database.name, misc: func, type: 'triggerFunction'})"
                                 @dblclick="openMiscPermanentTab({schema: database.name, misc: func, type: 'triggerFunction'})"
                              >
                                 <a class="table-name">
                                    <BaseIcon
                                       class="misc-icon mr-1"
                                       icon-name="mdiCogClockwise"
                                       :size="18"
                                    />
                                    <span v-html="highlightWord(func.name)" />
                                 </a>
                              </li>
                           </ContextMenuTrigger>
                           <MiscContext
                              :selected-misc="{...func, type: 'triggerFunction'}"
                              :selected-schema="database.name"
                              @reload="emit('reload')"
                           />
                        </ContextMenu>
                     </ul>
                  </div>
               </div>
            </details>
         </div>

         <div v-if="filteredFunctions.length && customizations.functions" class="database-misc">
            <details class="accordion">
               <ContextMenu>
                  <ContextMenuTrigger as-child>
                     <summary
                        class="accordion-header misc-name"
                        :class="{'text-bold': breadcrumbs.schema === database.name && breadcrumbs.function}"
                     >
                        <BaseIcon
                           class="misc-icon mr-1"
                           icon-name="mdiFolderMove"
                           :size="18"
                        />
                        <BaseIcon
                           class="misc-icon open-folder mr-1"
                           icon-name="mdiFolderOpen"
                           :size="18"
                        />
                        {{ t('database.function', 2) }}
                     </summary>
                  </ContextMenuTrigger>
                  <MiscFolderContext
                     :selected-misc="'function'"
                     :selected-schema="database.name"
                     @open-create-view-tab="emit('open-create-view-tab', database.name)"
                     @open-create-materialized-view-tab="emit('open-create-materialized-view-tab', database.name)"
                     @open-create-trigger-tab="emit('open-create-trigger-tab', database.name)"
                     @open-create-trigger-function-tab="emit('open-create-trigger-function-tab', database.name)"
                     @open-create-routine-tab="emit('open-create-routine-tab', database.name)"
                     @open-create-function-tab="emit('open-create-function-tab', database.name)"
                     @open-create-scheduler-tab="emit('open-create-scheduler-tab', database.name)"
                     @reload="emit('reload')"
                  />
               </ContextMenu>
               <div class="accordion-body">
                  <div>
                     <ul class="pt-0">
                        <ContextMenu
                           v-for="(func, i) of filteredFunctions"
                           :key="`${func.name}-${i}`"
                        >
                           <ContextMenuTrigger as-child>
                              <li
                                 class="tree-row"
                                 :class="{'selected': breadcrumbs.schema === database.name && breadcrumbs.function === func.name}"
                                 @mousedown.left="selectMisc({schema: database.name, misc: func, type: 'function'})"
                                 @dblclick="openMiscPermanentTab({schema: database.name, misc: func, type: 'function'})"
                              >
                                 <a class="table-name">
                                    <BaseIcon
                                       class="misc-icon mr-1"
                                       icon-name="mdiArrowRightBoldBox"
                                       :size="18"
                                       :style="`min-width: 18px`"
                                    />
                                    <span v-html="highlightWord(func.name)" />
                                 </a>
                              </li>
                           </ContextMenuTrigger>
                           <MiscContext
                              :selected-misc="{...func, type: 'function'}"
                              :selected-schema="database.name"
                              @reload="emit('reload')"
                           />
                        </ContextMenu>
                     </ul>
                  </div>
               </div>
            </details>
         </div>

         <div v-if="filteredSchedulers.length && customizations.schedulers" class="database-misc">
            <details class="accordion">
               <ContextMenu>
                  <ContextMenuTrigger as-child>
                     <summary
                        class="accordion-header misc-name"
                        :class="{'text-bold': breadcrumbs.schema === database.name && breadcrumbs.scheduler}"
                     >
                        <BaseIcon
                           class="misc-icon mr-1"
                           icon-name="mdiFolderClock"
                           :size="18"
                        />
                        <BaseIcon
                           class="misc-icon open-folder mr-1"
                           icon-name="mdiFolderOpen"
                           :size="18"
                        />
                        {{ t('database.scheduler', 2) }}
                     </summary>
                  </ContextMenuTrigger>
                  <MiscFolderContext
                     :selected-misc="'scheduler'"
                     :selected-schema="database.name"
                     @open-create-view-tab="emit('open-create-view-tab', database.name)"
                     @open-create-materialized-view-tab="emit('open-create-materialized-view-tab', database.name)"
                     @open-create-trigger-tab="emit('open-create-trigger-tab', database.name)"
                     @open-create-trigger-function-tab="emit('open-create-trigger-function-tab', database.name)"
                     @open-create-routine-tab="emit('open-create-routine-tab', database.name)"
                     @open-create-function-tab="emit('open-create-function-tab', database.name)"
                     @open-create-scheduler-tab="emit('open-create-scheduler-tab', database.name)"
                     @reload="emit('reload')"
                  />
               </ContextMenu>
               <div class="accordion-body">
                  <div>
                     <ul class="pt-0">
                        <ContextMenu
                           v-for="scheduler of filteredSchedulers"
                           :key="scheduler.name"
                        >
                           <ContextMenuTrigger as-child>
                              <li
                                 class="tree-row"
                                 :class="{'selected': breadcrumbs.schema === database.name && breadcrumbs.scheduler === scheduler.name}"
                                 @mousedown.left="selectMisc({schema: database.name, misc: scheduler, type: 'scheduler'})"
                                 @dblclick="openMiscPermanentTab({schema: database.name, misc: scheduler, type: 'scheduler'})"
                              >
                                 <a class="table-name">
                                    <div v-if="checkLoadingStatus(scheduler.name, 'scheduler')" class="icon loading mr-1" />
                                    <BaseIcon
                                       class="misc-icon mr-1"
                                       icon-name="mdiCalendarClock"
                                       :size="18"
                                       :style="`min-width: 18px`"
                                    />
                                    <span v-html="highlightWord(scheduler.name)" />
                                 </a>
                                 <div
                                    v-if="scheduler.enabled === false"
                                    class="tooltip tooltip-left disabled-indicator"
                                    :data-tooltip="t('general.disabled')"
                                 >
                                    <BaseIcon
                                       class="misc-icon mr-1"
                                       icon-name="mdiPause"
                                       :size="18"
                                    />
                                 </div>
                              </li>
                           </ContextMenuTrigger>
                           <MiscContext
                              :selected-misc="{...scheduler, type: 'scheduler'}"
                              :selected-schema="database.name"
                              @reload="emit('reload')"
                           />
                        </ContextMenu>
                     </ul>
                  </div>
               </div>
            </details>
         </div>
      </div>
   </details>
</template>

<script setup lang="ts">
import { TableInfos } from 'common/interfaces/antares';
import { formatBytes } from 'common/libs/formatBytes';
import { storeToRefs } from 'pinia';
import { computed, onMounted, Prop, Ref, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import MiscContext from '@/components/WorkspaceExploreBarMiscContext.vue';
import MiscFolderContext from '@/components/WorkspaceExploreBarMiscFolderContext.vue';
import DatabaseContext from '@/components/WorkspaceExploreBarSchemaContext.vue';
import TableContext from '@/components/WorkspaceExploreBarTableContext.vue';
import Tables from '@/ipc-api/Tables';
import { useSettingsStore } from '@/stores/settings';
import { Breadcrumb, useWorkspacesStore, WorkspaceStructure } from '@/stores/workspaces';

const { t } = useI18n();

const props = defineProps({
   database: Object as Prop<WorkspaceStructure>,
   connection: Object,
   searchMethod: String as Prop<'elements' | 'schemas' | 'columns'>,
   columnSearchTerm: String as Prop<string>
});

const emit = defineEmits<{
   'reload': [];
   'delete-table': [payload: { schema: string; table: { name: string; type: string } }];
   'duplicate-table': [payload: { schema: string; table: { name: string } }];
   'open-create-table-tab': [schema: string];
   'open-create-view-tab': [schema: string];
   'open-create-materialized-view-tab': [schema: string];
   'open-create-trigger-tab': [schema: string];
   'open-create-routine-tab': [schema: string];
   'open-create-function-tab': [schema: string];
   'open-create-trigger-function-tab': [schema: string];
   'open-create-scheduler-tab': [schema: string];
}>();

const settingsStore = useSettingsStore();
const workspacesStore = useWorkspacesStore();

const { applicationTheme } = storeToRefs(settingsStore);

const {
   getLoadedSchemas,
   getWorkspace,
   getSearchTerm,
   changeBreadcrumbs,
   addLoadedSchema,
   newTab,
   refreshSchema
} = workspacesStore;

const schemaAccordion: Ref<HTMLDetailsElement> = ref(null);
const isLoading = ref(false);
const columnSearchResults: Ref<{ tableName: string; columnName: string }[]> = ref([]);

const searchTerm = computed(() => {
   return getSearchTerm(props.connection.uid);
});

watch(() => props.columnSearchTerm, async (term) => {
   if (!term) {
      columnSearchResults.value = [];
      return;
   }
   const { status, response } = await Tables.searchColumns({
      uid: props.connection.uid,
      schema: props.database.name,
      search: term
   });
   if (status === 'success')
      columnSearchResults.value = response as { tableName: string; columnName: string }[];
});

const filteredTables = computed(() => {
   let tables = props.database.tables.filter(t => t.type === 'table');

   if (props.searchMethod === 'elements' && searchTerm.value) {
      const q = searchTerm.value.toLowerCase();
      tables = tables.filter(t =>
         t.name.toLowerCase().includes(q) ||
         (t.comment && t.comment.toLowerCase().includes(q))
      );
   }

   if (props.columnSearchTerm && columnSearchResults.value.length > 0) {
      const matchedTables = new Set(columnSearchResults.value.map(r => r.tableName));
      tables = tables.filter(t => matchedTables.has(t.name));
   }
   else if (props.columnSearchTerm && columnSearchResults.value.length === 0)
      tables = [];

   return tables;
});

const filteredViews = computed(() => {
   if (props.searchMethod === 'elements')
      return props.database.tables.filter(table => table.name.search(searchTerm.value) >= 0 && table.type === 'view');
   else
      return props.database.tables.filter(table => table.type === 'view');
});

const filteredMatViews = computed(() => {
   if (props.searchMethod === 'elements')
      return props.database.tables.filter(table => table.name.search(searchTerm.value) >= 0 && table.type === 'materializedView');
   else
      return props.database.tables.filter(table => table.type === 'materializedView');
});

const filteredTriggers = computed(() => {
   if (props.searchMethod === 'elements')
      return props.database.triggers.filter(trigger => trigger.name.search(searchTerm.value) >= 0);
   else
      return props.database.triggers;
});

const filteredProcedures = computed(() => {
   if (props.searchMethod === 'elements')
      return props.database.procedures.filter(procedure => procedure.name.search(searchTerm.value) >= 0);
   else
      return props.database.procedures;
});

const filteredFunctions = computed(() => {
   if (props.searchMethod === 'elements')
      return props.database.functions.filter(func => func.name.search(searchTerm.value) >= 0);
   else
      return props.database.functions;
});

const filteredTriggerFunctions = computed(() => {
   if (props.searchMethod === 'elements') {
      return props.database.triggerFunctions
         ? props.database.triggerFunctions.filter(func => func.name.search(searchTerm.value) >= 0)
         : [];
   }
   else {
      return props.database.triggerFunctions
         ? props.database.triggerFunctions
         : [];
   }
});

const filteredSchedulers = computed(() => {
   if (props.searchMethod === 'elements')
      return props.database.schedulers.filter(scheduler => scheduler.name.search(searchTerm.value) >= 0);
   else
      return props.database.schedulers;
});

const workspace = computed(() => {
   return getWorkspace(props.connection.uid);
});

const breadcrumbs = computed(() => {
   return workspace.value.breadcrumbs;
});

const customizations = computed(() => {
   return workspace.value.customizations;
});

const loadedSchemas = computed(() => {
   return getLoadedSchemas(props.connection.uid);
});

const maxSize = computed(() => {
   return props.database.tables.reduce((acc: number, curr) => {
      if (curr.size && curr.size > acc) acc = curr.size;
      return acc;
   }, 0);
});

watch(breadcrumbs, (newVal, oldVal) => {
   if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
      setTimeout(() => {
         const element = document.querySelector<HTMLElement>('.workspace-explorebar-database .selected');

         if (element) {
            const rect = element.getBoundingClientRect();
            const elemTop = rect.top;
            const elemBottom = rect.bottom;
            const isVisible = (elemTop >= 0) && (elemBottom <= window.innerHeight);

            if (!isVisible) {
               element.setAttribute('tabindex', '-1');
               element.focus();
               element.removeAttribute('tabindex');
            }
         }
      }, 100);
   }
});

const selectSchema = async (schema: string) => {
   if (!loadedSchemas.value.has(schema) && !isLoading.value) {
      isLoading.value = true;
      setBreadcrumbs({ schema });
      await refreshSchema({ uid: props.connection.uid, schema });
      addLoadedSchema(schema);
      isLoading.value = false;
   }
};

const selectTable = ({ schema, table }: { schema: string; table: TableInfos }) => {
   newTab({
      uid: props.connection.uid,
      elementName: table.name,
      schema: props.database.name,
      type: 'temp-data',
      elementType: table.type
   });

   setBreadcrumbs({ schema, [table.type]: table.name });
};

const selectMisc = ({ schema, misc, type }: { schema: string; misc: { name: string }; type: 'trigger' | 'triggerFunction' | 'function' | 'routine' | 'scheduler' }) => {
   const miscTempTabs = {
      trigger: 'temp-trigger-props',
      triggerFunction: 'temp-trigger-function-props',
      function: 'temp-function-props',
      routine: 'temp-routine-props',
      scheduler: 'temp-scheduler-props'
   };

   newTab({
      uid: props.connection.uid,
      elementName: misc.name,
      schema: props.database.name,
      type: miscTempTabs[type],
      elementType: type
   });

   setBreadcrumbs({ schema, [type]: misc.name });
};

const openDataTab = ({ schema, table }: { schema: string; table: TableInfos }) => {
   newTab({
      uid: props.connection.uid,
      elementName: table.name,
      schema: props.database.name,
      type: 'data',
      elementType: table.type
   });
   setBreadcrumbs({ schema, [table.type]: table.name });
};

const openMiscPermanentTab = ({ schema, misc, type }: { schema: string; misc: { name: string }; type: 'trigger' | 'triggerFunction' | 'function' | 'routine' | 'scheduler' }) => {
   const miscTabs = {
      trigger: 'trigger-props',
      triggerFunction: 'trigger-function-props',
      function: 'function-props',
      routine: 'routine-props',
      scheduler: 'scheduler-props'
   };

   newTab({
      uid: props.connection.uid,
      elementName: misc.name,
      schema: props.database.name,
      type: miscTabs[type],
      elementType: type
   });
   setBreadcrumbs({ schema, [type]: misc.name });
};

const piePercentage = (val: number) => {
   const perc = val / maxSize.value * 100;
   if (applicationTheme.value === 'dark')
      return { background: `conic-gradient(lime ${perc}%, white 0)` };
   else
      return { background: `conic-gradient(teal ${perc}%, silver 0)` };
};

const setBreadcrumbs = (payload: Breadcrumb) => {
   if (breadcrumbs.value.schema === payload.schema && breadcrumbs.value.table === payload.table) return;
   changeBreadcrumbs(payload);
};

const highlightWord = (string: string, type = 'elements') => {
   string = string.replaceAll('<', '&lt;').replaceAll('>', '&gt;');

   if (searchTerm.value && props.searchMethod === type) {
      const regexp = new RegExp(`(${searchTerm.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      return string.replace(regexp, '<span class="text-primary">$1</span>');
   }
   else
      return string;
};

const checkLoadingStatus = (name: string, type: string) => {
   return workspace.value.loadingElements.some(el =>
      el.name === name &&
      el.type === type &&
      el.schema === props.database.name);
};

onMounted(() => {
   selectSchema(props.database.name);
});

defineExpose({ selectSchema, schemaAccordion });
</script>

<style lang="scss">
.workspace-explorebar-database {
  // Reset spectre list / accordion defaults inside tree
  .menu,
  .menu-nav {
    list-style: none;
    margin: 0;
    padding: 0;
    background: transparent;
    box-shadow: none;
    border: 0;
  }

  .accordion {
    padding: 0;
    margin: 0;
  }

  summary {
    list-style: none;
    cursor: pointer;
    user-select: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  // Chevron rotation when open
  .accordion[open] > .database-name > .icon:not(.loading),
  .accordion[open] > .misc-name > .icon:not(.loading) {
    transform: rotate(90deg);
  }

  .database-name > .icon,
  .misc-name > .icon {
    transition: transform 0.15s;
  }

  // Schema header row
  .database-name {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px 6px;
    margin-bottom: 2px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.2;
    border-radius: 4px;
    color: var(--foreground);
    position: relative;

    &:hover {
      background: color-mix(in srgb, var(--muted-foreground) 10%, transparent);

      .schema-size {
        visibility: visible;
      }
    }
  }

  // Category folder (Views / Triggers / Routines ...)
  .misc-name {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    margin: 2px 0 1px 0;
    min-height: 24px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    line-height: 1.25;
    color: var(--muted-foreground);
    border-radius: 4px;
    position: relative;

    &:hover {
      background: color-mix(in srgb, var(--muted-foreground) 10%, transparent);
      color: var(--foreground);
    }
  }

  // Leaf row (table / view / function / trigger / routine / scheduler)
  .tree-row {
    list-style: none;
    margin: 0;
    padding: 0;
    position: relative;

    > .table-name {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0 8px;
      min-height: 32px;
      font-size: 14px;
      font-weight: 500;
      line-height: 1.3;
      color: var(--foreground);
      background: color-mix(in srgb, var(--muted-foreground) 6%, transparent);
      border-radius: 4px;
      cursor: pointer;
      text-decoration: none;

      > span:not(.table-comment) {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .table-comment {
        margin-left: 6px;
        padding: 2px 8px;
        font-size: 12px;
        font-weight: 500;
        line-height: 1.3;
        color: var(--muted-foreground);
        background: color-mix(in srgb, var(--muted-foreground) 14%, transparent);
        border-radius: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex-shrink: 1;
      }

      .table-icon,
      .misc-icon,
      .database-icon {
        opacity: 0.75;
        flex-shrink: 0;
      }

      .loading {
        height: 14px;
        width: 14px;
        flex-shrink: 0;

        &::after {
          height: 0.55rem;
          width: 0.55rem;
        }
      }
    }

    &:hover > .table-name {
      background: color-mix(in srgb, var(--muted-foreground) 14%, transparent);

      .table-comment {
        background: color-mix(in srgb, var(--muted-foreground) 22%, transparent);
      }
    }

    &.selected > .table-name {
      background: color-mix(in srgb, var(--primary) 16%, transparent);
      color: var(--primary);
      font-weight: 600;

      .table-comment {
        color: var(--primary-foreground);
        background: var(--primary);
      }

      .table-icon,
      .misc-icon {
        opacity: 1;
      }
    }
  }

  // Only-child schema: hide the schema header, flatten nesting
  &:only-child {
    > .database-name {
      display: none !important;
    }

    > .accordion-body {
      padding: 0;
      margin: 0;

      > .database-tables {
        margin-left: 0;
      }

      > .database-misc {
        margin-left: 6px;
      }
    }
  }

  // Indentation for nested tables/misc inside a named schema
  .database-tables {
    margin-left: 14px;
  }

  .database-misc {
    margin-left: 18px;

    .open-folder {
      display: none;
    }

    .accordion[open] .accordion-header {
      > .misc-icon:not(.open-folder) {
        display: none;
      }

      > .misc-icon.open-folder {
        display: initial;
      }
    }

    .accordion-body {
      margin-bottom: 2px;
    }
  }

  // Right-aligned indicators
  .schema-size,
  .table-size,
  .disabled-indicator {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;
    display: flex;
    align-items: center;
    opacity: 0.45;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }

    .pie {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
    }
  }

  .schema-size {
    visibility: hidden;
  }

  .loading {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }
}
</style>
