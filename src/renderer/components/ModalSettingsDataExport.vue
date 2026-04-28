<template>
   <Dialog :open="true" @update:open="(v) => { if (!v) closeModal(); }">
      <!--
         Backup-bundle export wizard. Two-column layout inside the dialog
         body: left column lists every saved connection with a per-row
         "include" checkbox + a master-toggle in the table header (mirrors
         spectre's indeterminate / all / none tri-state). Right column
         carries options (passwords / folders) and the encryption passkey.
         Output is a hex-encoded encrypted JSON written to disk via a
         throwaway anchor click — same logic as before; only chrome moves.
      -->
      <DialogContent
         class="!max-w-[800px] !w-[800px] !p-0 !gap-0 [&>button.absolute]:!hidden"
         @escape-key-down.prevent="closeModal"
         @pointer-down-outside.prevent="closeModal"
      >
         <DialogHeader class="px-5 pt-4 pb-3 border-b border-border/60 flex flex-row items-center justify-between !space-y-0">
            <DialogTitle class="!text-[15px] !font-semibold flex items-center gap-1">
               <BaseIcon icon-name="mdiTrayArrowUp" :size="20" />
               <span>{{ t('application.exportData') }}</span>
            </DialogTitle>
            <Button
               variant="ghost"
               size="icon"
               class="!h-7 !w-7"
               @click.stop="closeModal"
            >
               <BaseIcon icon-name="mdiClose" :size="16" />
            </Button>
         </DialogHeader>

         <div class="grid grid-cols-[2fr_1fr] gap-4 px-5 py-4 max-h-[60vh] overflow-hidden">
            <!--
               Left column: connection picker. Custom HTML grid (NOT a real
               <table>) keeps the row-hover + checkbox alignment consistent
               with the rest of the app's "results table" pattern. Indeterminate
               state on the master checkbox needs an attribute, not a checked
               binding, so we set :data-state on the underlying Checkbox.
            -->
            <Card class="!shadow-none !p-0 flex flex-col min-h-0">
               <div class="grid grid-cols-[1fr_1fr_60px] items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/30 text-xs font-semibold uppercase tracking-wide">
                  <div>{{ t('connection.connectionName') }}</div>
                  <div>{{ t('connection.client') }}</div>
                  <div class="flex items-center justify-center">
                     <Checkbox
                        :checked="includeConnectionStatus === 1"
                        :data-state="includeConnectionStatus === 2 ? 'indeterminate' : (includeConnectionStatus === 1 ? 'checked' : 'unchecked')"
                        @update:checked="toggleAllConnections"
                     />
                  </div>
               </div>
               <div class="overflow-y-auto flex-1 min-h-[280px]">
                  <div
                     v-for="(item, i) in connections"
                     :key="i"
                     class="grid grid-cols-[1fr_1fr_60px] items-center gap-2 px-3 py-1.5 text-[13px] border-b border-border/40 hover:bg-muted/40"
                  >
                     <div class="truncate">
                        {{ getConnectionName(item.uid) }}
                     </div>
                     <div class="truncate">
                        {{ item.client }}
                     </div>
                     <div class="flex items-center justify-center">
                        <Checkbox
                           :checked="connectionToggles[item.uid]"
                           @update:checked="(v) => connectionToggles[item.uid] = v"
                        />
                     </div>
                  </div>
               </div>
            </Card>

            <!-- Right column: options + passkey -->
            <div class="space-y-4 min-h-0">
               <h5 class="text-sm font-semibold uppercase tracking-wide">
                  {{ t('general.options') }}
               </h5>
               <div class="space-y-2">
                  <div class="flex items-center gap-2">
                     <Checkbox
                        id="opt-passwords"
                        :checked="options.includes.passwords"
                        @update:checked="(v) => options.includes.passwords = v"
                     />
                     <Label for="opt-passwords" class="!text-[13px]">{{ t('application.includeConnectionPasswords') }}</Label>
                  </div>
                  <div class="flex items-center gap-2">
                     <Checkbox
                        id="opt-folders"
                        :checked="options.includes.folders"
                        @update:checked="(v) => options.includes.folders = v"
                     />
                     <Label for="opt-folders" class="!text-[13px]">{{ t('application.includeFolders') }}</Label>
                  </div>
               </div>
               <div class="space-y-1.5">
                  <Label class="text-xs font-medium uppercase tracking-wide">{{ t('application.encryptionPassword') }}</Label>
                  <div class="flex items-stretch gap-1">
                     <Input
                        ref="passkey"
                        v-model="options.passkey"
                        :type="isPasswordVisible ? 'text' : 'password'"
                        :placeholder="t('application.required')"
                        :class="isPasswordError ? 'border-destructive' : ''"
                     />
                     <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        class="!h-[34px] !w-[34px] shrink-0"
                        @click="isPasswordVisible = !isPasswordVisible"
                     >
                        <BaseIcon
                           :icon-name="isPasswordVisible ? 'mdiEye' : 'mdiEyeOff'"
                           :size="16"
                        />
                     </Button>
                  </div>
                  <p v-if="isPasswordError" class="text-xs text-destructive">
                     {{ t('application.encryptionPasswordError') }}
                  </p>
               </div>
            </div>
         </div>

         <DialogFooter class="!flex !flex-row !justify-end !gap-2 !px-5 !py-3 border-t border-border/60 bg-muted/30">
            <Button
               variant="ghost"
               size="sm"
               class="!h-[32px] !px-4 !text-[13px]"
               @click.stop="closeModal"
            >
               {{ t('general.close') }}
            </Button>
            <Button
               size="sm"
               class="!h-[32px] !px-4 !text-[13px]"
               autofocus
               @click.prevent="exportData"
            >
               {{ t('database.export') }}
            </Button>
         </DialogFooter>
      </DialogContent>
   </Dialog>
</template>

<script setup lang="ts">
import { ConnectionParams } from 'common/interfaces/antares';
import { encrypt } from 'common/libs/encrypter';
import { uidGen } from 'common/libs/uidGen';
import moment from 'moment';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { unproxify } from '@/libs/unproxify';
import { SidebarElement, useConnectionsStore } from '@/stores/connections';

const { t } = useI18n();
const emit = defineEmits<{
   'close': [];
}>();

const { getConnectionName } = useConnectionsStore();
const { connectionsOrder, connections, customIcons } = storeToRefs(useConnectionsStore());
const localConnections = unproxify<ConnectionParams[]>(connections.value);
const localConnectionsOrder = unproxify<SidebarElement[]>(connectionsOrder.value);

const isPasswordVisible = ref(false);
const isPasswordError = ref(false);
const connectionToggles: Ref<{[k:string]: boolean}> = ref({});
const options = ref({
   passkey: '',
   includes: {
      passwords: true,
      folders: true
   }
});
const filename = computed(() => {
   const date = moment().format('YYYY-MM-DD');
   return `backup_${date}`;
});
const includeConnectionStatus = computed(() => {
   if (Object.values(connectionToggles.value).every(item => item)) return 1;
   else if (Object.values(connectionToggles.value).some(item => item)) return 2;
   else return 0;
});

const exportData = () => {
   if (options.value.passkey.length < 8)
      isPasswordError.value = true;
   else {
      isPasswordError.value = false;
      const connectionsToInclude: string[] = [];
      const connectionsUidMap = new Map<string, string>();
      for (const cUid in connectionToggles.value)
         if (connectionToggles.value[cUid]) connectionsToInclude.push(cUid);

      let filteredConnections = unproxify<typeof localConnections>(localConnections.filter(conn => connectionsToInclude.includes(conn.uid)));
      filteredConnections = filteredConnections.map(c => {
         const newUid = uidGen('C');
         connectionsUidMap.set(c.uid, newUid);
         c.uid = newUid;
         return c;
      });

      if (!options.value.includes.passwords) { // Remove passwords and set ask:true
         filteredConnections.map(c => {
            if (c.password) {
               c.password = '';
               c.ask = true;
            }
            return c;
         });
      }

      let filteredOrders = [];
      for (const [oldVal, newVal] of connectionsUidMap) {
         const connOrder = unproxify(localConnectionsOrder.find(c => c.uid === oldVal));
         connOrder.uid = newVal;
         filteredOrders.push(connOrder);
      }

      if (options.value.includes.folders) { // Includes folders
         const oldConnUids = Array.from(connectionsUidMap.keys());
         const newConnUids = Array.from(connectionsUidMap.values());
         const foldersToInclude = unproxify(localConnectionsOrder).filter(f => (
            f.isFolder && oldConnUids.some(uid => f.connections.includes(uid))
         )).map(f => {
            f.uid = uidGen('F');
            f.connections = f.connections
               .map(fc => connectionsUidMap.get(fc))
               .filter(fc => newConnUids.includes(fc));
            return f;
         });

         filteredOrders = [...filteredOrders, ...foldersToInclude];
      }

      const exportObj = encrypt(JSON.stringify({
         connections: filteredConnections,
         connectionsOrder: filteredOrders,
         customIcons: customIcons.value
      }), options.value.passkey);

      const blobContent = Buffer.from(JSON.stringify(exportObj), 'utf-8').toString('hex');
      const file = new Blob([blobContent], { type: 'application/octet-stream' });
      const downloadLink = document.createElement('a');
      downloadLink.download = `${filename.value}.antares`;
      downloadLink.href = window.URL.createObjectURL(file);
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();

      closeModal();
   }
};

const closeModal = () => {
   emit('close');
};

const onKey = (e: KeyboardEvent) => {
   e.stopPropagation();
   if (e.key === 'Escape')
      closeModal();
};

const toggleAllConnections = () => {
   if (includeConnectionStatus.value !== 1) {
      connectionToggles.value = localConnections.reduce((acc, curr) => {
         acc[curr.uid] = true;
         return acc;
      }, {} as {[k:string]: boolean});
   }
   else {
      connectionToggles.value = localConnections.reduce((acc, curr) => {
         acc[curr.uid] = false;
         return acc;
      }, {} as {[k:string]: boolean});
   }
};

connectionToggles.value = localConnections.reduce((acc, curr) => {
   acc[curr.uid] = true;
   return acc;
}, {} as {[k:string]: boolean});

window.addEventListener('keydown', onKey);

onBeforeUnmount(() => {
   window.removeEventListener('keydown', onKey);
});
</script>
