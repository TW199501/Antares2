<template>
   <div v-show="isSelected" class="workspace flex flex-row w-full">
      <WorkspaceTabsContext
         v-if="isTabContext"
         :context-event="contextEvent"
         :selected-tab="selectedContextTab"
         @close-all-tabs="closeAllTabs"
         @close-other-tabs="closeOtherTabs"
         @close-to-left="closeTabsToLeft"
         @close-to-right="closeTabsToRight"
         @close-context="closeContext"
      />
      <WorkspaceExploreBar
         v-if="workspace?.connectionStatus === 'connected'"
         :connection="connection"
         :is-selected="isSelected"
      />
      <div class="workspace-tabs flex-1 min-w-0 flex flex-col">
         <div v-if="workspace?.connectionStatus === 'connected'" class="flex flex-row flex-shrink-0">
            <Draggable
               ref="tabWrap"
               v-model="draggableTabs"
               tag="ul"
               item-key="uid"
               group="tabs"
               class="ws-tabs-row w-full"
               draggable=".tab-draggable"
               @mouseover="addWheelEvent"
            >
               <template #item="{element}">
                  <li
                     class="ws-tab-cell tab-draggable"
                     :draggable="true"
                     :class="{'active': selectedTab === element.uid}"
                     @mousedown.left="selectTab({uid: workspace.uid, tab: element.uid})"
                     @mouseup.middle="closeTab(element)"
                     @contextmenu.prevent="contextMenu($event, element)"
                  >
                     <a
                        v-if="element.type === 'query'"
                        class="tab-link"
                        :class="{'badge': element.isChanged}"
                     >
                        <BaseIcon
                           class="mt-1 mr-1"
                           :icon-name="element.filePath ? 'mdiFileCodeOutline' : 'mdiCodeTags'"
                           :size="18"
                        />
                        <span>
                           <span>{{ cutText(element.elementName || element.content || 'Query', 20, true) }} #{{ element.index }}</span>
                           <span
                              class="tab-close inline-flex items-center justify-center w-4 h-4 ml-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                              :title="t('general.close')"
                              @mousedown.left.stop
                              @click.stop="closeTab(element)"
                           >
                              <BaseIcon icon-name="mdiClose" :size="12" />
                           </span>
                        </span>
                     </a>

                     <a
                        v-else-if="element.type === 'temp-data'"
                        class="tab-link"
                        @dblclick="openAsPermanentTab(element)"
                     >
                        <BaseIcon
                           class="mt-1 mr-1"
                           :icon-name="['view', 'materializedView'].includes(element.elementType) ? 'mdiTableEye' : 'mdiTable'"
                           :size="18"
                        />
                        <span :title="`${t('general.data').toUpperCase()}: ${t('database.' + element.elementType)}`">
                           <span class=" text-italic">{{ cutText(element.elementName, 20, true) }}</span>
                           <span
                              class="tab-close inline-flex items-center justify-center w-4 h-4 ml-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                              :title="t('general.close')"
                              @mousedown.left.stop
                              @click.stop="closeTab(element)"
                           >
                              <BaseIcon icon-name="mdiClose" :size="12" />
                           </span>
                        </span>
                     </a>

                     <a v-else-if="element.type === 'data'" class="tab-link">
                        <BaseIcon
                           class="mt-1 mr-1"
                           :icon-name="['view', 'materializedView'].includes(element.elementType) ? 'mdiTableEye' : 'mdiTable'"
                           :size="18"
                        />
                        <span :title="`${t('general.data').toUpperCase()}: ${t('database.' + element.elementType)}`">
                           {{ cutText(element.elementName, 20, true) }}
                           <span
                              class="tab-close inline-flex items-center justify-center w-4 h-4 ml-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                              :title="t('general.close')"
                              @mousedown.left.stop
                              @click.stop="closeTab(element)"
                           >
                              <BaseIcon icon-name="mdiClose" :size="12" />
                           </span>
                        </span>
                     </a>

                     <a
                        v-else-if="element.type === 'new-table'"
                        class="tab-link"
                        :class="{'badge': element.isChanged}"
                     >
                        <BaseIcon
                           class="mr-1"
                           icon-name="mdiShapeSquarePlus"
                           :size="18"
                        />
                        <span :title="`${t('general.new').toUpperCase()}: ${t(`database.${element.elementType}`)}`">
                           {{ t('database.newTable') }}
                           <span
                              class="tab-close inline-flex items-center justify-center w-4 h-4 ml-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                              :title="t('general.close')"
                              @mousedown.left.stop
                              @click.stop="closeTab(element)"
                           >
                              <BaseIcon icon-name="mdiClose" :size="12" />
                           </span>
                        </span>
                     </a>

                     <a
                        v-else-if="element.type === 'table-props'"
                        class="tab-link"
                        :class="{'badge': element.isChanged}"
                     >
                        <BaseIcon
                           class="mr-1"
                           icon-name="mdiWrenchCog"
                           :size="18"
                        />
                        <span :title="`${t('application.settings').toUpperCase()}: ${t(`database.${element.elementType}`)}`">
                           {{ cutText(element.elementName, 20, true) }}
                           <span
                              class="tab-close inline-flex items-center justify-center w-4 h-4 ml-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                              :title="t('general.close')"
                              @mousedown.left.stop
                              @click.stop="closeTab(element)"
                           >
                              <BaseIcon icon-name="mdiClose" :size="12" />
                           </span>
                        </span>
                     </a>

                     <a
                        v-else-if="element.type === 'view-props'"
                        class="tab-link"
                        :class="{'badge': element.isChanged}"
                     >
                        <BaseIcon
                           class="mr-1"
                           icon-name="mdiWrenchCog"
                           :size="18"
                        />
                        <span :title="`${t('application.settings').toUpperCase()}: ${t(`database.view`)}`">
                           {{ cutText(element.elementName, 20, true) }}
                           <span
                              class="tab-close inline-flex items-center justify-center w-4 h-4 ml-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                              :title="t('general.close')"
                              @mousedown.left.stop
                              @click.stop="closeTab(element)"
                           >
                              <BaseIcon icon-name="mdiClose" :size="12" />
                           </span>
                        </span>
                     </a>

                     <a
                        v-else-if="element.type === 'materialized-view-props'"
                        class="tab-link"
                        :class="{'badge': element.isChanged}"
                     >
                        <BaseIcon
                           class="mr-1"
                           icon-name="mdiWrenchCog"
                           :size="18"
                        />
                        <span :title="`${t('application.settings').toUpperCase()}: ${t(`database.view`)}`">
                           {{ cutText(element.elementName, 20, true) }}
                           <span
                              class="tab-close inline-flex items-center justify-center w-4 h-4 ml-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                              :title="t('general.close')"
                              @mousedown.left.stop
                              @click.stop="closeTab(element)"
                           >
                              <BaseIcon icon-name="mdiClose" :size="12" />
                           </span>
                        </span>
                     </a>

                     <a
                        v-else-if="element.type === 'new-view'"
                        class="tab-link"
                        :class="{'badge': element.isChanged}"
                     >
                        <BaseIcon
                           class="mr-1"
                           icon-name="mdiShapeSquarePlus"
                           :size="18"
                        />
                        <span :title="`${t('general.new').toUpperCase()}: ${t(`database.${element.elementType}`)}`">
                           {{ t('database.newView') }}
                           <span
                              class="tab-close inline-flex items-center justify-center w-4 h-4 ml-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                              :title="t('general.close')"
                              @mousedown.left.stop
                              @click.stop="closeTab(element)"
                           >
                              <BaseIcon icon-name="mdiClose" :size="12" />
                           </span>
                        </span>
                     </a>

                     <a
                        v-else-if="element.type === 'new-materialized-view'"
                        class="tab-link"
                        :class="{'badge': element.isChanged}"
                     >
                        <BaseIcon
                           class="mr-1"
                           icon-name="mdiShapeSquarePlus"
                           :size="18"
                        />
                        <span :title="`${t('general.new').toUpperCase()}: ${t(`database.${element.elementType}`)}`">
                           {{ t('database.newMaterializedView') }}
                           <span
                              class="tab-close inline-flex items-center justify-center w-4 h-4 ml-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                              :title="t('general.close')"
                              @mousedown.left.stop
                              @click.stop="closeTab(element)"
                           >
                              <BaseIcon icon-name="mdiClose" :size="12" />
                           </span>
                        </span>
                     </a>

                     <a
                        v-else-if="element.type === 'new-trigger'"
                        class="tab-link"
                        :class="{'badge': element.isChanged}"
                     >
                        <BaseIcon
                           class="mr-1"
                           icon-name="mdiShapeSquarePlus"
                           :size="18"
                        />
                        <span :title="`${t('general.new').toUpperCase()}: ${t(`database.${element.elementType}`)}`">
                           {{ t('database.newTrigger') }}
                           <span
                              class="tab-close inline-flex items-center justify-center w-4 h-4 ml-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                              :title="t('general.close')"
                              @mousedown.left.stop
                              @click.stop="closeTab(element)"
                           >
                              <BaseIcon icon-name="mdiClose" :size="12" />
                           </span>
                        </span>
                     </a>

                     <a
                        v-else-if="element.type === 'new-routine'"
                        class="tab-link"
                        :class="{'badge': element.isChanged}"
                     >
                        <BaseIcon
                           class="mr-1"
                           icon-name="mdiShapeSquarePlus"
                           :size="18"
                        />
                        <span :title="`${t('general.new').toUpperCase()}: ${t(`database.${element.elementType}`)}`">
                           {{ t('database.newRoutine') }}
                           <span
                              class="tab-close inline-flex items-center justify-center w-4 h-4 ml-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                              :title="t('general.close')"
                              @mousedown.left.stop
                              @click.stop="closeTab(element)"
                           >
                              <BaseIcon icon-name="mdiClose" :size="12" />
                           </span>
                        </span>
                     </a>

                     <a
                        v-else-if="element.type === 'new-function'"
                        class="tab-link"
                        :class="{'badge': element.isChanged}"
                     >
                        <BaseIcon
                           class="mr-1"
                           icon-name="mdiShapeSquarePlus"
                           :size="18"
                        />
                        <span :title="`${t('general.new').toUpperCase()}: ${t(`database.${element.elementType}`)}`">
                           {{ t('database.newFunction') }}
                           <span
                              class="tab-close inline-flex items-center justify-center w-4 h-4 ml-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                              :title="t('general.close')"
                              @mousedown.left.stop
                              @click.stop="closeTab(element)"
                           >
                              <BaseIcon icon-name="mdiClose" :size="12" />
                           </span>
                        </span>
                     </a>

                     <a
                        v-else-if="element.type === 'new-trigger-function'"
                        class="tab-link"
                        :class="{'badge': element.isChanged}"
                     >
                        <BaseIcon
                           class="mr-1"
                           icon-name="mdiShapeSquarePlus"
                           :size="18"
                        />
                        <span :title="`${t('general.new').toUpperCase()}: ${t(`database.${element.elementType}`)}`">
                           {{ t('database.newTriggerFunction') }}
                           <span
                              class="tab-close inline-flex items-center justify-center w-4 h-4 ml-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                              :title="t('general.close')"
                              @mousedown.left.stop
                              @click.stop="closeTab(element)"
                           >
                              <BaseIcon icon-name="mdiClose" :size="12" />
                           </span>
                        </span>
                     </a>

                     <a
                        v-else-if="element.type === 'new-scheduler'"
                        class="tab-link"
                        :class="{'badge': element.isChanged}"
                     >
                        <BaseIcon
                           class="mr-1"
                           icon-name="mdiShapeSquarePlus"
                           :size="18"
                        />
                        <span :title="`${t('general.new').toUpperCase()}: ${t(`database.${element.elementType}`)}`">
                           {{ t('database.newScheduler') }}
                           <span
                              class="tab-close inline-flex items-center justify-center w-4 h-4 ml-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                              :title="t('general.close')"
                              @mousedown.left.stop
                              @click.stop="closeTab(element)"
                           >
                              <BaseIcon icon-name="mdiClose" :size="12" />
                           </span>
                        </span>
                     </a>

                     <a
                        v-else-if="element.type.includes('temp-')"
                        class="tab-link"
                        :class="{'badge': element.isChanged}"
                        @dblclick="openAsPermanentTab(element)"
                     >
                        <BaseIcon
                           class="mr-1"
                           icon-name="mdiWrenchCog"
                           :size="18"
                        />
                        <span :title="`${t('application.settings').toUpperCase()}: ${t(`database.${element.elementType}`)}`">
                           <span class=" text-italic">{{ cutText(element.elementName, 20, true) }}</span>
                           <span
                              class="tab-close inline-flex items-center justify-center w-4 h-4 ml-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                              :title="t('general.close')"
                              @mousedown.left.stop
                              @click.stop="closeTab(element)"
                           >
                              <BaseIcon icon-name="mdiClose" :size="12" />
                           </span>
                        </span>
                     </a>

                     <a
                        v-else
                        class="tab-link"
                        :class="{'badge': element.isChanged}"
                     >
                        <BaseIcon
                           class="mr-1"
                           icon-name="mdiWrenchCog"
                           :size="18"
                        />
                        <span :title="`${t('application.settings').toUpperCase()}: ${t(`database.${element.elementType}`)}`">
                           {{ cutText(element.elementName, 20, true) }}
                           <span
                              class="tab-close inline-flex items-center justify-center w-4 h-4 ml-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                              :title="t('general.close')"
                              @mousedown.left.stop
                              @click.stop="closeTab(element)"
                           >
                              <BaseIcon icon-name="mdiClose" :size="12" />
                           </span>
                        </span>
                     </a>
                  </li>
               </template>
               <template #header>
                  <li
                     v-if="workspace.customizations.processesList"
                     class="ws-tab-cell ws-tab-tools"
                  >
                     <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                           <a
                              class="workspace-tools-link"
                              tabindex="0"
                              :title="t('general.tools')"
                           >
                              <BaseIcon icon-name="mdiTools" :size="24" />
                           </a>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent v-if="hasTools" align="start">
                           <DropdownMenuItem @select="showProcessesModal">
                              <BaseIcon
                                 icon-name="mdiMemory"
                                 :size="18"
                                 class="mr-1"
                              />
                              <span>{{ t('database.processesList') }}</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem @select="toggleConsole">
                              <BaseIcon
                                 icon-name="mdiConsoleLine"
                                 :size="18"
                                 class="mr-1"
                              />
                              <span>{{ t('application.console') }}</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem
                              v-if="workspace.customizations.variables"
                              disabled
                              title="Coming..."
                           >
                              <BaseIcon
                                 icon-name="mdiShape"
                                 :size="18"
                                 class="mr-1"
                              />
                              <span>{{ t('database.variables') }}</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem
                              v-if="workspace.customizations.usersManagement"
                              disabled
                              title="Coming..."
                           >
                              <BaseIcon
                                 icon-name="mdiAccountGroup"
                                 :size="18"
                                 class="mr-1"
                              />
                              <span>{{ t('database.manageUsers') }}</span>
                           </DropdownMenuItem>
                        </DropdownMenuContent>
                     </DropdownMenu>
                  </li>
               </template>
               <template #footer>
                  <li class="ws-tab-cell">
                     <a
                        class="tab-add"
                        :title="t('application.openNewTab')"
                        @click="addQueryTab"
                     >
                        <BaseIcon icon-name="mdiPlus" :size="24" />
                     </a>
                  </li>
               </template>
            </Draggable>
            <WorkspaceEmptyState v-if="!draggableTabs.length" @new-tab="addQueryTab" />
            <template v-for="tab of draggableTabs" :key="tab.uid">
               <WorkspaceTabQuery
                  v-if="tab.type ==='query'"
                  :tab-uid="tab.uid"
                  :tab="tab"
                  :is-selected="selectedTab === tab.uid && isSelected"
                  :connection="connection"
               />
               <WorkspaceTabTable
                  v-else-if="['temp-data', 'data'].includes(tab.type)"
                  :tab-uid="tab.uid"
                  :connection="connection"
                  :is-selected="selectedTab === tab.uid && isSelected"
                  :table="tab.elementName"
                  :schema="tab.schema"
                  :element-type="tab.elementType"
               />
               <WorkspaceTabNewTable
                  v-else-if="tab.type === 'new-table'"
                  :tab-uid="tab.uid"
                  :tab="tab"
                  :connection="connection"
                  :is-selected="selectedTab === tab.uid && isSelected"
                  :schema="tab.schema"
               />
               <WorkspaceTabPropsTable
                  v-else-if="tab.type === 'table-props'"
                  :tab-uid="tab.uid"
                  :connection="connection"
                  :is-selected="selectedTab === tab.uid && isSelected"
                  :table="tab.elementName"
                  :schema="tab.schema"
               />
               <WorkspaceTabNewView
                  v-else-if="tab.type === 'new-view'"
                  :tab-uid="tab.uid"
                  :tab="tab"
                  :connection="connection"
                  :is-selected="selectedTab === tab.uid && isSelected"
                  :schema="tab.schema"
               />
               <WorkspaceTabNewMaterializedView
                  v-else-if="tab.type === 'new-materialized-view'"
                  :tab-uid="tab.uid"
                  :tab="tab"
                  :connection="connection"
                  :is-selected="selectedTab === tab.uid && isSelected"
                  :schema="tab.schema"
               />
               <WorkspaceTabPropsView
                  v-else-if="tab.type === 'view-props'"
                  :tab-uid="tab.uid"
                  :is-selected="selectedTab === tab.uid && isSelected"
                  :connection="connection"
                  :view="tab.elementName"
                  :schema="tab.schema"
               />
               <WorkspaceTabPropsMaterializedView
                  v-else-if="tab.type === 'materialized-view-props'"
                  :tab-uid="tab.uid"
                  :is-selected="selectedTab === tab.uid && isSelected"
                  :connection="connection"
                  :view="tab.elementName"
                  :schema="tab.schema"
               />
               <WorkspaceTabNewTrigger
                  v-else-if="tab.type === 'new-trigger'"
                  :tab-uid="tab.uid"
                  :tab="tab"
                  :connection="connection"
                  :is-selected="selectedTab === tab.uid && isSelected"
                  :trigger="tab.elementName"
                  :schema="tab.schema"
               />
               <WorkspaceTabPropsTrigger
                  v-else-if="['temp-trigger-props', 'trigger-props'].includes(tab.type)"
                  :tab-uid="tab.uid"
                  :connection="connection"
                  :is-selected="selectedTab === tab.uid && isSelected"
                  :trigger="tab.elementName"
                  :schema="tab.schema"
               />
               <WorkspaceTabNewTriggerFunction
                  v-else-if="tab.type === 'new-trigger-function'"
                  :tab-uid="tab.uid"
                  :tab="tab"
                  :connection="connection"
                  :is-selected="selectedTab === tab.uid && isSelected"
                  :trigger="tab.elementName"
                  :schema="tab.schema"
               />
               <WorkspaceTabPropsTriggerFunction
                  v-else-if="['temp-trigger-function-props', 'trigger-function-props'].includes(tab.type)"
                  :tab-uid="tab.uid"
                  :connection="connection"
                  :is-selected="selectedTab === tab.uid && isSelected"
                  :function="tab.elementName"
                  :schema="tab.schema"
               />
               <WorkspaceTabNewRoutine
                  v-else-if="tab.type === 'new-routine'"
                  :tab-uid="tab.uid"
                  :tab="tab"
                  :connection="connection"
                  :is-selected="selectedTab === tab.uid && isSelected"
                  :trigger="tab.elementName"
                  :schema="tab.schema"
               />
               <WorkspaceTabPropsRoutine
                  v-else-if="['temp-routine-props', 'routine-props'].includes(tab.type)"
                  :tab-uid="tab.uid"
                  :connection="connection"
                  :is-selected="selectedTab === tab.uid && isSelected"
                  :routine="tab.elementName"
                  :schema="tab.schema"
               />
               <WorkspaceTabNewFunction
                  v-else-if="tab.type === 'new-function'"
                  :tab-uid="tab.uid"
                  :tab="tab"
                  :connection="connection"
                  :is-selected="selectedTab === tab.uid && isSelected"
                  :trigger="tab.elementName"
                  :schema="tab.schema"
               />
               <WorkspaceTabPropsFunction
                  v-else-if="['temp-function-props', 'function-props'].includes(tab.type)"
                  :tab-uid="tab.uid"
                  :connection="connection"
                  :is-selected="selectedTab === tab.uid && isSelected"
                  :function="tab.elementName"
                  :schema="tab.schema"
               />
               <WorkspaceTabNewScheduler
                  v-else-if="tab.type === 'new-scheduler'"
                  :tab-uid="tab.uid"
                  :tab="tab"
                  :connection="connection"
                  :is-selected="selectedTab === tab.uid && isSelected"
                  :trigger="tab.elementName"
                  :schema="tab.schema"
               />
               <WorkspaceTabPropsScheduler
                  v-else-if="['temp-scheduler-props', 'scheduler-props'].includes(tab.type)"
                  :tab-uid="tab.uid"
                  :connection="connection"
                  :is-selected="selectedTab === tab.uid && isSelected"
                  :scheduler="tab.elementName"
                  :schema="tab.schema"
               />
            </template>
         </div>
         <div v-else class="connection-panel-wrapper relative">
            <div
               v-if="workspace?.connectionStatus === 'connecting'"
               class="flex items-center justify-center w-full h-full"
            >
               <div class="loading loading-lg" />
            </div>
            <WorkspaceEditConnectionPanel v-else :connection="connection" />
         </div>
         <DebugConsole v-if="isConsoleOpen" :uid="workspace.uid" />
      </div>
      <ModalProcessesList
         v-if="isProcessesModal"
         :connection="connection"
         @close="hideProcessesModal"
      />

      <ModalDiscardChanges
         v-if="unsavedTab"
         @confirm="closeTab(unsavedTab, true)"
         @close="unsavedTab = null"
      />
   </div>
</template>

<script setup lang="ts">
import { ConnectionParams } from 'common/interfaces/antares';
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted, Prop, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import * as Draggable from 'vuedraggable';

import BaseIcon from '@/components/BaseIcon.vue';
import DebugConsole from '@/components/DebugConsole.vue';
import ModalDiscardChanges from '@/components/ModalDiscardChanges.vue';
import ModalProcessesList from '@/components/ModalProcessesList.vue';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import WorkspaceEditConnectionPanel from '@/components/WorkspaceEditConnectionPanel.vue';
import WorkspaceEmptyState from '@/components/WorkspaceEmptyState.vue';
import WorkspaceExploreBar from '@/components/WorkspaceExploreBar.vue';
import WorkspaceTabNewFunction from '@/components/WorkspaceTabNewFunction.vue';
import WorkspaceTabNewRoutine from '@/components/WorkspaceTabNewRoutine.vue';
import WorkspaceTabNewScheduler from '@/components/WorkspaceTabNewScheduler.vue';
import WorkspaceTabNewTable from '@/components/WorkspaceTabNewTable.vue';
import WorkspaceTabNewTrigger from '@/components/WorkspaceTabNewTrigger.vue';
import WorkspaceTabNewTriggerFunction from '@/components/WorkspaceTabNewTriggerFunction.vue';
import WorkspaceTabNewView from '@/components/WorkspaceTabNewView.vue';
import WorkspaceTabPropsFunction from '@/components/WorkspaceTabPropsFunction.vue';
import WorkspaceTabPropsRoutine from '@/components/WorkspaceTabPropsRoutine.vue';
import WorkspaceTabPropsScheduler from '@/components/WorkspaceTabPropsScheduler.vue';
import WorkspaceTabPropsTable from '@/components/WorkspaceTabPropsTable.vue';
import WorkspaceTabPropsTrigger from '@/components/WorkspaceTabPropsTrigger.vue';
import WorkspaceTabPropsTriggerFunction from '@/components/WorkspaceTabPropsTriggerFunction.vue';
import WorkspaceTabPropsView from '@/components/WorkspaceTabPropsView.vue';
import WorkspaceTabQuery from '@/components/WorkspaceTabQuery.vue';
import WorkspaceTabsContext from '@/components/WorkspaceTabsContext.vue';
import WorkspaceTabTable from '@/components/WorkspaceTabTable.vue';
import { useFilters } from '@/composables/useFilters';
import Connection from '@/ipc-api/Connection';
import { useConsoleStore } from '@/stores/console';
import { useWorkspacesStore, WorkspaceTab } from '@/stores/workspaces';

import WorkspaceTabNewMaterializedView from './WorkspaceTabNewMaterializedView.vue';
import WorkspaceTabPropsMaterializedView from './WorkspaceTabPropsMaterializedView.vue';

const { t } = useI18n();

const { cutText } = useFilters();
const workspacesStore = useWorkspacesStore();

const { getSelected: selectedWorkspace } = storeToRefs(workspacesStore);

const {
   getWorkspace,
   addWorkspace,
   connectWorkspace,
   selectTab,
   newTab,
   removeTab,
   updateTabs,
   selectNextTab,
   selectPrevTab
} = workspacesStore;

const consoleStore = useConsoleStore();

const { isConsoleOpen } = storeToRefs(consoleStore);
const { toggleConsole } = consoleStore;

const props = defineProps({
   connection: Object as Prop<ConnectionParams>
});

const hasWheelEvent = ref(false);
const isProcessesModal = ref(false);
const unsavedTab = ref(null);
const tabWrap = ref(null);
const contextEvent = ref(null);
const isTabContext = ref(false);
const selectedContextTab = ref(null);

const workspace = computed(() => getWorkspace(props.connection.uid));

const draggableTabs = computed<WorkspaceTab[]>({
   get () {
      if (workspace.value.customizations.database)
         return workspace.value.tabs.filter(tab => tab.type === 'query' || tab.database === workspace.value.database);
      else
         return workspace.value.tabs;
   },
   set (val) {
      updateTabs({ uid: props.connection.uid, tabs: val });
   }
});

const isSelected = computed(() => {
   return selectedWorkspace.value === props.connection.uid;
});

const selectedTab = computed(() => {
   return workspace.value ? workspace.value.selectedTab : null;
});

const queryTabs = computed(() => {
   return workspace.value ? workspace.value.tabs.filter(tab => tab.type === 'query') : [];
});

const hasTools = computed(() => {
   if (!workspace.value.customizations) return false;
   else {
      return workspace.value.customizations.processesList ||
      workspace.value.customizations.usersManagement ||
      workspace.value.customizations.variables;
   }
});

watch(queryTabs, (newVal, oldVal) => {
   if (newVal.length > oldVal.length) {
      setTimeout(() => {
         const scroller = tabWrap.value;
         if (scroller) scroller.$el.scrollLeft = scroller.$el.scrollWidth;
      }, 0);
   }
});

const addQueryTab = () => {
   newTab({ uid: props.connection.uid, type: 'query', schema: workspace.value.breadcrumbs.schema });
};

const getSelectedTab = () => {
   return workspace.value.tabs.find(tab => tab.uid === selectedTab.value);
};

const openAsPermanentTab = (tab: WorkspaceTab) => {
   const permanentTabs = {
      table: 'data',
      view: 'data',
      materializedView: 'data',
      trigger: 'trigger-props',
      triggerFunction: 'trigger-function-props',
      function: 'function-props',
      routine: 'routine-props',
      procedure: 'routine-props',
      scheduler: 'scheduler-props'
   } as Record<string, string>;

   newTab({
      uid: props.connection.uid,
      schema: tab.schema,
      elementName: tab.elementName,
      type: permanentTabs[tab.elementType],
      elementType: tab.elementType
   });
};

const closeTab = (tab: WorkspaceTab, force = false) => {
   unsavedTab.value = null;
   // if (tab.type === 'query' && this.queryTabs.length === 1) return;
   if (!force && tab.isChanged) {
      unsavedTab.value = tab;
      return;
   }

   removeTab({ uid: props.connection.uid, tab: tab.uid });
};

const closeAllTabs = () => {
   for (const tab of draggableTabs.value)
      removeTab({ uid: props.connection.uid, tab: tab.uid });
};

const closeOtherTabs = () => {
   const otherTabs = draggableTabs.value.filter(t => t.uid !== selectedContextTab.value.uid);

   for (const tab of otherTabs)
      removeTab({ uid: props.connection.uid, tab: tab.uid });
};

const closeTabsToLeft = () => {
   const tabIndex = draggableTabs.value.findIndex(t => t.uid === selectedContextTab.value.uid);
   const leftTabs = draggableTabs.value.filter((t, i) => i < tabIndex);

   for (const tab of leftTabs)
      removeTab({ uid: props.connection.uid, tab: tab.uid });
};

const closeTabsToRight = () => {
   const tabIndex = draggableTabs.value.findIndex(t => t.uid === selectedContextTab.value.uid);
   const leftTabs = draggableTabs.value.filter((t, i) => i > tabIndex);

   for (const tab of leftTabs)
      removeTab({ uid: props.connection.uid, tab: tab.uid });
};

const showProcessesModal = () => {
   isProcessesModal.value = true;
};

const hideProcessesModal = () => {
   isProcessesModal.value = false;
};

const addWheelEvent = () => {
   if (!hasWheelEvent.value) {
      tabWrap.value.$el.addEventListener('wheel', (e: WheelEvent) => {
         if (e.deltaX !== 0) return; // If trackpad horizontal scroll

         if (e.deltaY > 0) tabWrap.value.$el.scrollLeft += 50;
         else tabWrap.value.$el.scrollLeft -= 50;
      });
      hasWheelEvent.value = true;
   }
};

const contextMenu = (event: MouseEvent, tab: WorkspaceTab) => {
   selectedContextTab.value = tab;
   contextEvent.value = event;
   isTabContext.value = true;
};

const closeContext = () => {
   isTabContext.value = false;
};

(async () => {
   await addWorkspace(props.connection.uid);
   // Only auto-connect if the sidecar already has an active connection for this uid
   // (e.g. page refresh without sidecar restart). If not, the user must click Connect.
   const isInitiated = await Connection.checkConnection(props.connection.uid);
   if (isInitiated)
      connectWorkspace(props.connection);
})().catch(() => {
   // Ignore errors (e.g. sidecar not ready yet); user will connect manually
});

const onOpenNewTab = (_e: Event) => {
   if (!isSelected.value) return;
   addQueryTab();
};

const onCloseTab = (_e: Event) => {
   if (!isSelected.value) return;
   const currentTab = getSelectedTab();
   if (currentTab)
      closeTab(currentTab);
};

const onNextTab = (_e: Event) => {
   if (!isSelected.value) return;
   selectNextTab({ uid: props.connection.uid });
};

const onPrevTab = (_e: Event) => {
   if (!isSelected.value) return;
   selectPrevTab({ uid: props.connection.uid });
};

const selectTabHandlers: ((_e: Event) => void)[] = [];
for (let i = 1; i <= 9; i++) {
   selectTabHandlers[i] = (_e: Event) => {
      if (!isSelected.value) return;
      if (workspace.value.tabs[i - 1])
         selectTab({ uid: props.connection.uid, tab: workspace.value.tabs[i - 1].uid });
   };
}

onMounted(() => {
   window.addEventListener('antares:open-new-tab', onOpenNewTab);
   window.addEventListener('antares:close-tab', onCloseTab);
   window.addEventListener('antares:next-tab', onNextTab);
   window.addEventListener('antares:prev-tab', onPrevTab);

   for (let i = 1; i <= 9; i++)
      window.addEventListener(`antares:select-tab-${i}`, selectTabHandlers[i]);
});

onUnmounted(() => {
   window.removeEventListener('antares:open-new-tab', onOpenNewTab);
   window.removeEventListener('antares:close-tab', onCloseTab);
   window.removeEventListener('antares:next-tab', onNextTab);
   window.removeEventListener('antares:prev-tab', onPrevTab);

   for (let i = 1; i <= 9; i++)
      window.removeEventListener(`antares:select-tab-${i}`, selectTabHandlers[i]);
});
</script>

<style lang="scss">
.workspace {
  padding: 0;
  margin: 0;

  .workspace-tabs {
    overflow-y: hidden;
    height: calc(100vh - #{$excluding-size});
    position: relative;

    .ws-tabs-row {
      margin-top: 0;
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      flex-wrap: nowrap;
      overflow: auto;
      margin-bottom: 0;
      list-style: none;
      padding: 0;

      &::-webkit-scrollbar {
        width: 2px;
        height: 2px;
      }

      .ws-tab-cell {
        width: fit-content;
        flex: initial;

        > a {
          padding: 0.2rem 0.6rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          opacity: 0.7;
          transition: opacity 0.2s;

          &.badge::after {
            position: absolute;
            right: 35px;
            top: 25px;
          }

          .tab-close {
            opacity: 0;
            transition: opacity 0.2s;
          }

          &:hover {
            opacity: 1;

            .tab-close {
              opacity: 1;
            }
          }

          &.tab-add {
            padding: 0.2rem 0.4rem;
            margin-top: 2px;
            border: 0;
          }

          > span {
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            padding: 0 0.2rem;
          }
        }

        &.active a {
          opacity: 1;

          .tab-close {
            opacity: 1;
          }
        }

        &.ws-tab-tools {
          height: 34px;

          .workspace-tools-link {
            padding-bottom: 0;
            padding-top: 0.3rem;
          }

          z-index: 9;
          position: absolute;
        }

        &.ws-tab-tools + .ws-tab-cell {
          margin-left: 56px;
        }
      }
    }
  }
}
</style>
