<template>
   <Dialog :open="true" @update:open="(v) => { if (!v) closeModal(); }">
      <DialogContent
         class="!max-w-[75vw] w-[75vw] max-h-[85vh] !p-0 !gap-0 flex flex-col [&>button.absolute]:!hidden"
         @escape-key-down.prevent="onEscape"
         @pointer-down-outside.prevent="closeModal"
         @interact-outside.prevent
      >
         <DialogHeader class="flex flex-row items-center justify-between !space-y-0 px-5 py-3 border-b border-border/60 bg-muted/30">
            <DialogTitle class="!text-[15px] !font-semibold flex items-center gap-1.5">
               <BaseIcon icon-name="mdiApps" :size="20" />
               <span>{{ t('connection.allConnections') }}</span>
            </DialogTitle>
            <DialogDescription class="sr-only">
               {{ t('connection.allConnections') }}
            </DialogDescription>
            <Button
               variant="ghost"
               size="icon"
               class="!h-7 !w-7"
               @click.stop="closeModal"
            >
               <BaseIcon icon-name="mdiClose" :size="16" />
            </Button>
         </DialogHeader>

         <!--
            Search bar. Right-side icon switches between magnifier (empty) and
            backspace (clears term on click). The magnifier is pointer-events-
            none so it never steals clicks from the input itself.
         -->
         <div class="relative px-5 py-3 border-b border-border/60">
            <Input
               v-model="searchTerm"
               type="text"
               class="pr-9"
               :placeholder="t('connection.searchForConnections')"
               @keydown.esc.stop="onSearchEscape"
            />
            <BaseIcon
               v-if="!searchTerm"
               icon-name="mdiMagnify"
               class="absolute right-7 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
               :size="18"
            />
            <BaseIcon
               v-else
               icon-name="mdiBackspace"
               class="absolute right-7 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
               :size="18"
               @click="searchTerm = ''"
            />
         </div>

         <!--
            Scrollable connection grid. Cards are responsive: 1 / 2 / 3 / 4
            columns by breakpoint, mirroring the original col-3 / col-md-6 /
            col-lg-4 spectre breakpoints. Tailwind sm/md/lg/xl don't perfectly
            match spectre's, so we approximate with the standard Tailwind
            ones (sm:640 / md:768 / lg:1024 / xl:1280) which is what shadcn
            assumes throughout the rest of the app.
         -->
         <ScrollArea class="flex-1 min-h-0">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
               <TransitionGroup name="fade" :duration="{ enter: 200, leave: 200 }">
                  <div
                     v-for="connection in filteredConnections"
                     :key="connection.uid"
                     class="group relative rounded-md border border-border/60 bg-card text-card-foreground p-3 cursor-pointer transition-all hover:border-primary/60 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                     tabindex="0"
                     @click.stop="selectConnection(connection.uid)"
                     @keypress.stop.enter="selectConnection(connection.uid)"
                  >
                     <!-- Hover-only delete affordance (top-right corner) -->
                     <button
                        type="button"
                        class="absolute right-1.5 top-1.5 rounded-sm p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-70 hover:!opacity-100 hover:bg-muted hover:text-destructive"
                        :title="t('general.delete')"
                        @click.stop="askToDelete(connection)"
                     >
                        <BaseIcon icon-name="mdiDelete" :size="16" />
                     </button>

                     <!-- Avatar + name + driver -->
                     <div class="flex flex-col items-center text-center gap-1">
                        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                           <div
                              v-if="connection.icon"
                              class="settingbar-connection-icon"
                           >
                              <BaseIcon
                                 :icon-name="camelize(connection.icon)"
                                 :type="connection.hasCustomIcon ? 'custom' : 'mdi'"
                                 :size="36"
                              />
                           </div>
                           <div
                              v-else
                              class="settingbar-element-icon dbi"
                              :class="[`dbi-${connection.client}`]"
                           />
                        </div>
                        <div class="text-[13px] font-semibold truncate w-full" :title="getConnectionName(connection.uid)">
                           {{ getConnectionName(connection.uid) }}
                        </div>
                        <Badge variant="secondary" class="text-[10px] !py-0 !px-1.5">
                           {{ clients.get(connection.client) || connection.client }}
                        </Badge>
                     </div>

                     <!-- Connection target details -->
                     <div class="mt-2 space-y-1 text-[12px] text-foreground/80">
                        <div
                           v-if="connection.databasePath"
                           class="flex items-center gap-1.5 truncate"
                           :title="connection.databasePath"
                        >
                           <BaseIcon icon-name="mdiDatabase" :size="14" />
                           <span class="font-semibold truncate">{{ connection.databasePath }}</span>
                        </div>
                        <div
                           v-else
                           class="flex items-center gap-1.5 truncate"
                           :title="`${connection.host}:${connection.port}`"
                        >
                           <BaseIcon icon-name="mdiServer" :size="14" />
                           <span class="font-semibold truncate">{{ connection.host }}:{{ connection.port }}</span>
                        </div>
                        <div v-if="connection.user" class="flex items-center gap-1.5 truncate">
                           <BaseIcon icon-name="mdiAccount" :size="14" />
                           <span class="font-semibold truncate">{{ connection.user }}</span>
                        </div>
                        <div v-if="connection.schema" class="flex items-center gap-1.5 truncate">
                           <BaseIcon icon-name="mdiDatabase" :size="14" />
                           <span class="font-semibold truncate">{{ connection.schema }}</span>
                        </div>
                        <div v-if="connection.database" class="flex items-center gap-1.5 truncate">
                           <BaseIcon icon-name="mdiDatabase" :size="14" />
                           <span class="font-semibold truncate">{{ connection.database }}</span>
                        </div>
                     </div>

                     <!-- Footer chips (folder / SSL / SSH / Read-only) -->
                     <div
                        v-if="connection.folderName || connection.ssl || connection.ssh || connection.readonly"
                        class="mt-2 flex flex-wrap items-center justify-center gap-1"
                     >
                        <Badge
                           v-if="connection.folderName"
                           variant="outline"
                           class="text-[10px] !py-0 !px-1.5 gap-1"
                        >
                           <BaseIcon
                              icon-name="mdiFolder"
                              :style="connection.color ? `color: ${connection.color};` : ''"
                              :size="12"
                           />
                           {{ connection.folderName }}
                        </Badge>
                        <Badge
                           v-if="connection.ssl"
                           variant="outline"
                           class="text-[10px] !py-0 !px-1.5 gap-1"
                        >
                           <BaseIcon icon-name="mdiShieldKey" :size="12" />
                           SSL
                        </Badge>
                        <Badge
                           v-if="connection.ssh"
                           variant="outline"
                           class="text-[10px] !py-0 !px-1.5 gap-1"
                        >
                           <BaseIcon icon-name="mdiConsoleNetwork" :size="12" />
                           SSH
                        </Badge>
                        <Badge
                           v-if="connection.readonly"
                           variant="outline"
                           class="text-[10px] !py-0 !px-1.5 gap-1"
                        >
                           <BaseIcon icon-name="mdiLock" :size="12" />
                           Read-only
                        </Badge>
                     </div>
                  </div>
               </TransitionGroup>
            </div>
         </ScrollArea>
      </DialogContent>
   </Dialog>

   <ConfirmModal
      v-if="isConfirmModal"
      @confirm="confirmDeleteConnection"
      @hide="isConfirmModal = false"
   >
      <template #header>
         <div class="flex items-center gap-1.5">
            <BaseIcon icon-name="mdiServerRemove" :size="20" />
            <span>{{ t('connection.deleteConnection') }}</span>
         </div>
      </template>
      <template #body>
         <div class="text-[13px]">
            {{ t('general.deleteConfirm') }} <b>{{ selectedConnectionName }}</b>?
         </div>
      </template>
   </ConfirmModal>
</template>

<script setup lang="ts">
import { ConnectionParams } from 'common/interfaces/antares';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '@/components/BaseConfirmModal.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { camelize } from '@/libs/camelize';
import { useConnectionsStore } from '@/stores/connections';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const connectionsStore = useConnectionsStore();
const workspacesStore = useWorkspacesStore();

const { connections,
   connectionsOrder,
   lastConnections,
   getFolders: folders
} = storeToRefs(connectionsStore);
const { getSelected: selectedWorkspace } = storeToRefs(workspacesStore);

const {
   getConnectionName,
   deleteConnection
} = connectionsStore;
const { selectWorkspace } = workspacesStore;

const emit = defineEmits<{
   'close': [];
}>();

const clients = new Map([
   ['mysql', 'MySQL'],
   ['maria', 'MariaDB'],
   ['pg', 'PostgreSQL'],
   ['sqlite', 'SQLite'],
   ['firebird', 'Firebird SQL'],
   ['mssql', 'SQL Server']
]);

const searchTerm = ref('');
const isConfirmModal = ref(false);
const selectedConnection: Ref<ConnectionParams> = ref(null);

const remappedConnections = computed(() => {
   return connections.value
      .map(c => {
         const connTime = lastConnections.value.find((lc) => lc.uid === c.uid)?.time || 0;
         const connIcon = connectionsOrder.value.find((co) => co.uid === c.uid).icon;
         const connHasCustomIcon = connectionsOrder.value.find((co) => co.uid === c.uid).hasCustomIcon;
         const folder = folders.value.find(f => f.connections.includes(c.uid));

         return {
            ...c,
            icon: connIcon,
            color: folder?.color,
            folderName: folder?.name,
            hasCustomIcon: connHasCustomIcon,
            time: connTime
         };
      })
      .sort((a, b) => {
         if (a.time < b.time) return 1;
         if (a.time > b.time) return -1;
         return 0;
      });
});

const filteredConnections = computed(() => {
   const q = searchTerm.value.toLocaleLowerCase();
   return remappedConnections.value.filter(connection => {
      return connection.name?.toLocaleLowerCase().includes(q) ||
         connection.host?.toLocaleLowerCase().includes(q) ||
         connection.database?.toLocaleLowerCase().includes(q) ||
         connection.databasePath?.toLocaleLowerCase().includes(q) ||
         connection.schema?.toLocaleLowerCase().includes(q) ||
         connection.user?.toLocaleLowerCase().includes(q) ||
         String(connection.port)?.includes(searchTerm.value);
   });
});

const selectedConnectionName = computed(() => getConnectionName(selectedConnection.value?.uid));

const closeModal = () => emit('close');

const selectConnection = (uid: string) => {
   selectWorkspace(uid);
   closeModal();
};

const askToDelete = (connection: ConnectionParams) => {
   selectedConnection.value = connection;
   isConfirmModal.value = true;
};

const confirmDeleteConnection = () => {
   if (selectedWorkspace.value === selectedConnection.value.uid)
      selectWorkspace(null);
   deleteConnection(selectedConnection.value);
};

// First Esc: clear search if typed; second Esc: close modal. The
// Dialog's own escape-key-down.prevent gives us first-shot here.
const onEscape = (e: Event) => {
   if (searchTerm.value.length > 0) {
      searchTerm.value = '';
      e.preventDefault();
   }
   else
      closeModal();
};

const onSearchEscape = (e: KeyboardEvent) => {
   if (searchTerm.value.length > 0) {
      searchTerm.value = '';
      e.preventDefault();
   }
};

const onKey = (e: KeyboardEvent) => {
   // Reka's escape-key-down handler already runs at DialogContent level; we
   // keep this listener as a safety net for the unlikely case the focus
   // escapes the dialog (e.g. into the embedded ConfirmModal).
   if (e.key === 'Escape' && !isConfirmModal.value) {
      e.stopPropagation();
      if ((e.target as HTMLInputElement)?.tagName === 'INPUT' && searchTerm.value.length > 0)
         searchTerm.value = '';
   }
};

window.addEventListener('keydown', onKey);

onBeforeUnmount(() => {
   window.removeEventListener('keydown', onKey);
});
</script>

<style lang="scss" scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
