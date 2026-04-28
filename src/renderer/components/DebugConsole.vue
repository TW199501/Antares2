<template>
   <!--
      Bottom-anchored debug/query console panel. Despite its filename, this is
      NOT a modal — it's an inline panel docked to the bottom of the workspace
      that shares vertical space with the editor pane via a vertical resizer
      handle on its top edge.

      The whole panel is migrated to a shadcn Tabs (horizontal) + Tailwind
      layout so the legacy spectre `.tab.tab-block` / `.btn.btn-clear`
      decorations are gone. Tab content (query log + debug log) is unchanged.
   -->
   <div
      ref="wrapper"
      class="console-wrapper"
      @mouseenter="isHover = true"
      @mouseleave="isHover = false"
   >
      <div ref="resizer" class="console-resizer" />
      <div
         id="console"
         ref="queryConsole"
         class="console column col-12 bg-background border-t border-border/60"
         :style="{height: localHeight ? localHeight+'px' : ''}"
      >
         <Tabs v-model="selectedTabModel" class="flex h-full flex-col">
            <div class="console-header flex items-center justify-between px-1 border-b border-border/40">
               <TabsList class="!h-7 !p-0.5 !bg-transparent !rounded-none gap-0.5">
                  <TabsTrigger
                     value="query"
                     class="!text-[12px] !px-2 !py-0.5 !h-6 data-[state=active]:!bg-muted data-[state=active]:!shadow-none"
                  >
                     {{ t('application.executedQueries') }}
                  </TabsTrigger>
                  <TabsTrigger
                     value="debug"
                     class="!text-[12px] !px-2 !py-0.5 !h-6 data-[state=active]:!bg-muted data-[state=active]:!shadow-none"
                  >
                     {{ t('application.debugConsole') }}
                  </TabsTrigger>
               </TabsList>
               <div class="flex items-center gap-1 pr-1">
                  <Button
                     v-if="isDevelopment"
                     variant="ghost"
                     size="icon"
                     class="!h-6 !w-6"
                     :title="t('application.debugConsole')"
                     @click="openDevTools"
                  >
                     <BaseIcon icon-name="mdiBugPlayOutline" :size="18" />
                  </Button>
                  <Button
                     v-if="isDevelopment"
                     variant="ghost"
                     size="icon"
                     class="!h-6 !w-6"
                     :title="t('general.refresh')"
                     @click="reload"
                  >
                     <BaseIcon icon-name="mdiRefresh" :size="18" />
                  </Button>
                  <Button
                     variant="ghost"
                     size="icon"
                     class="!h-6 !w-6"
                     :title="t('general.close')"
                     @click="resizeConsole(0)"
                  >
                     <BaseIcon icon-name="mdiClose" :size="16" />
                  </Button>
               </div>
            </div>
            <TabsContent value="query" class="flex-1 min-h-0 !mt-0">
               <div ref="queryConsoleBody" class="console-body">
                  <div
                     v-for="(wLog, i) in workspaceQueryLogs"
                     :key="i"
                     class="console-log"
                     tabindex="0"
                     @contextmenu.prevent="contextMenu($event, wLog)"
                  >
                     <span class="console-log-datetime">{{ moment(wLog.date).format('HH:mm:ss') }}</span>: <code class="console-log-sql" v-html="highlight(wLog.sql, {html: true})" />
                  </div>
               </div>
            </TabsContent>
            <TabsContent value="debug" class="flex-1 min-h-0 !mt-0">
               <div ref="logConsoleBody" class="console-body">
                  <div
                     v-for="(log, i) in debugLogs"
                     :key="i"
                     class="console-log"
                     tabindex="0"
                     @contextmenu.prevent="contextMenu($event, log)"
                  >
                     <span class="console-log-datetime">{{ moment(log.date).format('HH:mm:ss') }}</span> <small>[{{ log.process.substring(0, 1).toUpperCase() }}]</small>: <span class="console-log-message" :class="`console-log-level-${log.level}`">{{ log.message }}</span>
                  </div>
               </div>
            </TabsContent>
         </Tabs>
      </div>
   </div>
   <BaseContextMenu
      v-if="isContext"
      :context-event="contextEvent"
      @close-context="isContext = false"
   >
      <div class="context-element" @click="copyLog">
         <span class="d-flex">
            <BaseIcon
               class="text-light mt-1 mr-1"
               icon-name="mdiContentCopy"
               :size="18"
            /> {{ t('general.copy') }}</span>
      </div>
   </BaseContextMenu>
</template>

<script setup lang="ts">
import moment from 'moment';
import { storeToRefs } from 'pinia';
import { highlight } from 'sql-highlight';
import { computed, nextTick, onMounted, Ref, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseContextMenu from '@/components/BaseContextMenu.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { copyText } from '@/libs/copyText';
import { type LogType, useConsoleStore } from '@/stores/console';

const { t } = useI18n();

const consoleStore = useConsoleStore();

const { resizeConsole, getLogsByWorkspace } = consoleStore;
const {
   isConsoleOpen,
   consoleHeight,
   selectedTab,
   debugLogs
} = storeToRefs(consoleStore);

// Two-way binding for the shadcn Tabs root: selectedTab in the Pinia store
// remains the source of truth, but Tabs root expects v-model on a single ref.
// The watcher below pushes Tabs-emitted changes back into the store and the
// computed getter keeps Tabs in sync when the store updates externally.
const selectedTabModel = computed({
   get: () => selectedTab.value,
   set: (val: string) => {
      selectedTab.value = val as LogType;
   }
});

const props = defineProps({
   uid: {
      type: String,
      default: null,
      required: false
   }
});

const wrapper: Ref<HTMLInputElement> = ref(null);
const queryConsole: Ref<HTMLInputElement> = ref(null);
const queryConsoleBody: Ref<HTMLInputElement> = ref(null);
const logConsoleBody: Ref<HTMLInputElement> = ref(null);
const resizer: Ref<HTMLInputElement> = ref(null);
const localHeight = ref(consoleHeight.value);
const isHover = ref(false);
const isContext = ref(false);
const contextContent: Ref<string> = ref(null);
const contextEvent: Ref<MouseEvent> = ref(null);
// TODO: Replace with import.meta.env.DEV when Vite is configured
const isDevelopment = ref(typeof import.meta !== 'undefined' ? import.meta.env?.MODE === 'development' : false);

const resize = (e: MouseEvent) => {
   const el = queryConsole.value;
   let elementHeight = el.getBoundingClientRect().bottom - e.pageY;
   if (elementHeight > 400) elementHeight = 400;
   localHeight.value = elementHeight;
};

const workspaceQueryLogs = computed(() => {
   return getLogsByWorkspace(props.uid);
});

const stopResize = () => {
   if (localHeight.value < 0) localHeight.value = 0;
   resizeConsole(localHeight.value);
   window.removeEventListener('mousemove', resize);
   window.removeEventListener('mouseup', stopResize);
};

const contextMenu = (event: MouseEvent, wLog: {date: Date; sql?: string; message?: string}) => {
   contextEvent.value = event;
   contextContent.value = wLog.sql || wLog.message;
   isContext.value = true;
};

const copyLog = () => {
   copyText(contextContent.value);
   isContext.value = false;
};

const openDevTools = () => {
   // DevTools are auto-opened in debug builds by Tauri setup.
};

const reload = () => {
   location.reload();
};

watch(workspaceQueryLogs, async () => {
   if (!isHover.value) {
      await nextTick();
      if (queryConsoleBody.value)
         queryConsoleBody.value.scrollTop = queryConsoleBody.value.scrollHeight;
   }
});

watch(() => debugLogs.value.length, async () => {
   if (!isHover.value) {
      await nextTick();
      if (logConsoleBody.value)
         logConsoleBody.value.scrollTop = logConsoleBody.value.scrollHeight;
   }
});

watch(isConsoleOpen, async () => {
   await nextTick();
   if (queryConsoleBody.value)
      queryConsoleBody.value.scrollTop = queryConsoleBody.value.scrollHeight;
   if (logConsoleBody.value)
      logConsoleBody.value.scrollTop = logConsoleBody.value.scrollHeight;
});

watch(selectedTab, async () => {
   await nextTick();
   if (queryConsoleBody.value)
      queryConsoleBody.value.scrollTop = queryConsoleBody.value.scrollHeight;
   if (logConsoleBody.value)
      logConsoleBody.value.scrollTop = logConsoleBody.value.scrollHeight;
});

watch(consoleHeight, async (val) => {
   await nextTick();
   localHeight.value = val;
});

onMounted(() => {
   if (queryConsoleBody.value)
      queryConsoleBody.value.scrollTop = queryConsoleBody.value.scrollHeight;
   if (logConsoleBody.value)
      logConsoleBody.value.scrollTop = logConsoleBody.value.scrollHeight;

   resizer.value.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();

      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResize);
   });
});
</script>
<style lang="scss" scoped>
.console-wrapper {
  width: -webkit-fill-available;
  z-index: 9;
  margin-top: auto;
  position: absolute;
  bottom: 0;

  .console-resizer {
    height: 4px;
    top: -1px;
    width: 100%;
    cursor: ns-resize;
    position: absolute;
    z-index: 99;
    transition: background 0.2s;

    &:hover {
      background: var(--primary-color-dark);
    }
  }

  .console {
    padding: 0;
    padding-bottom: $footer-height;

    .console-body {
      overflow: auto;
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: 100%;
      padding: 0 6px 3px;

      .console-log {
        padding: 1px 3px;
        margin: 1px 0;
        border-radius: $border-radius;
        user-select: text;

        &-datetime {
            opacity: .6;
            font-size: 90%;
        }

        &-sql {
          font-size: 95%;
          opacity: 0.8;
          font-weight: 700;

          &:hover {
            user-select: text;
          }
        }

        &-message {
          font-size: 95%;
        }

        &-level {
         &-warn {
            color: orange;
         }
         &-error {
            color: red;
         }
        }

        small {
         opacity: .6;
        }
      }
    }
  }
}
</style>
