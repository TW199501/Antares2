<template>
   <ContextMenuContent class="min-w-[200px]">
      <ContextMenuItem
         v-if="isConnected"
         @select="disconnect"
      >
         <BaseIcon icon-name="mdiPower" :size="16" />
         <span>{{ t('connection.disconnect') }}</span>
      </ContextMenuItem>
      <ContextMenuSub v-if="!contextConnection.isFolder">
         <ContextMenuSubTrigger>
            <BaseIcon icon-name="mdiFolderMove" :size="16" />
            <span>{{ t('general.moveTo') }}</span>
         </ContextMenuSubTrigger>
         <ContextMenuSubContent class="min-w-[200px]">
            <ContextMenuItem @select="moveToFolder(null)">
               <BaseIcon icon-name="mdiFolderPlus" :size="16" />
               <span>{{ t('application.newFolder') }}</span>
            </ContextMenuItem>
            <ContextMenuItem
               v-for="folder in filteredFolders"
               :key="folder.uid"
               @select="moveToFolder(folder.uid)"
            >
               <BaseIcon
                  icon-name="mdiFolder"
                  :size="16"
                  :style="`color: ${folder.color}`"
               />
               <span>{{ folder.name || t('general.folder') }}</span>
            </ContextMenuItem>
            <ContextMenuItem
               v-if="isInFolder"
               @select="outOfFolder"
            >
               <BaseIcon icon-name="mdiFolderOff" :size="16" />
               <span>{{ t('application.outOfFolder') }}</span>
            </ContextMenuItem>
         </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuItem @select="showAppearanceModal">
         <BaseIcon icon-name="mdiBrushVariant" :size="16" />
         <span>{{ t('application.appearance') }}</span>
      </ContextMenuItem>
      <ContextMenuItem
         v-if="!contextConnection.isFolder"
         @select="duplicateConnection"
      >
         <BaseIcon icon-name="mdiContentDuplicate" :size="16" />
         <span>{{ t('general.duplicate') }}</span>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
         class="text-destructive focus:text-destructive"
         @select="showConfirmModal"
      >
         <BaseIcon icon-name="mdiDelete" :size="16" />
         <span>{{ t('general.delete') }}</span>
      </ContextMenuItem>
   </ContextMenuContent>

   <ConfirmModal
      v-if="isConfirmModal"
      @confirm="confirmDeleteConnection"
      @hide="hideConfirmModal"
   >
      <template #header>
         <div class="flex">
            <BaseIcon
               class="text-light mr-1"
               :icon-name="contextConnection.isFolder ? 'mdiFolderRemove' : 'mdiServerRemove'"
               :size="24"
            /> {{ t(contextConnection.isFolder ? 'application.deleteFolder' : 'connection.deleteConnection') }}
         </div>
      </template>
      <template #body>
         <div class="mb-2">
            {{ t('general.deleteConfirm') }} <b>{{ connectionName }}</b>?
         </div>
      </template>
   </ConfirmModal>
   <ModalFolderAppearance
      v-if="isFolderEdit"
      :folder="contextConnection"
      @close="hideAppearanceModal"
   />
   <ModalConnectionAppearance
      v-if="isConnectionEdit"
      :connection="contextConnection"
      @close="hideAppearanceModal"
   />
</template>

<script setup lang="ts">
import { uidGen } from 'common/libs/uidGen';
import { storeToRefs } from 'pinia';
import { computed, Prop, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '@/components/BaseConfirmModal.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import ModalConnectionAppearance from '@/components/ModalConnectionAppearance.vue';
import ModalFolderAppearance from '@/components/ModalFolderAppearance.vue';
import {
   ContextMenuContent,
   ContextMenuItem,
   ContextMenuSeparator,
   ContextMenuSub,
   ContextMenuSubContent,
   ContextMenuSubTrigger
} from '@/components/ui/context-menu';
import { SidebarElement, useConnectionsStore } from '@/stores/connections';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const connectionsStore = useConnectionsStore();

const {
   getConnectionByUid,
   getConnectionName,
   addConnection,
   deleteConnection,
   addFolder,
   addToFolder,
   removeFromFolders
} = connectionsStore;

const { getFolders: folders } = storeToRefs(connectionsStore);

const workspacesStore = useWorkspacesStore();

const {
   removeConnected: disconnectWorkspace,
   getWorkspace
} = workspacesStore;

const props = defineProps({
   contextConnection: Object as Prop<SidebarElement>
});

const isConfirmModal = ref(false);
const isFolderEdit = ref(false);
const isConnectionEdit = ref(false);

const connectionName = computed(() => props.contextConnection.name || getConnectionName(props.contextConnection.uid) || t('general.folder', 1));
const isConnected = computed(() => getWorkspace(props.contextConnection.uid)?.connectionStatus === 'connected');
const filteredFolders = computed(() => folders.value.filter(f => !f.connections.includes(props.contextConnection.uid)));
const isInFolder = computed(() => folders.value.some(f => f.connections.includes(props.contextConnection.uid)));

const confirmDeleteConnection = () => {
   if (isConnected.value)
      disconnectWorkspace(props.contextConnection.uid);
   deleteConnection(props.contextConnection);
   hideConfirmModal();
};

const moveToFolder = (folderUid?: string) => {
   if (!folderUid) {
      addFolder({
         connections: [props.contextConnection.uid]
      });
   }
   else {
      addToFolder({
         folder: folderUid,
         connection: props.contextConnection.uid
      });
   }
};

const outOfFolder = () => {
   removeFromFolders(props.contextConnection.uid);
};

const duplicateConnection = () => {
   let connectionCopy = getConnectionByUid(props.contextConnection.uid);
   connectionCopy = {
      ...connectionCopy,
      uid: uidGen('C'),
      name: connectionCopy.name ? `${connectionCopy?.name}_copy` : ''
   };

   addConnection(connectionCopy);
};

const showAppearanceModal = () => {
   if (props.contextConnection.isFolder)
      isFolderEdit.value = true;
   else
      isConnectionEdit.value = true;
};

const hideAppearanceModal = () => {
   isConnectionEdit.value = false;
   isFolderEdit.value = false;
};

const showConfirmModal = () => {
   isConfirmModal.value = true;
};

const hideConfirmModal = () => {
   isConfirmModal.value = false;
};

const disconnect = () => {
   disconnectWorkspace(props.contextConnection.uid);
};
</script>
