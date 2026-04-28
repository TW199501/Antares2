<template>
   <Dialog :open="true" @update:open="(v) => { if (!v) closeModal(); }">
      <DialogContent
         class="max-w-md !p-0 !gap-0 !rounded-xl !shadow-2xl !border-border/70 overflow-hidden [&>button.absolute]:!hidden"
         @escape-key-down.prevent="closeModal"
         @pointer-down-outside.prevent="closeModal"
      >
         <DialogHeader class="px-5 pt-4 pb-3 border-b border-border/60 flex flex-row items-center justify-between">
            <DialogTitle class="!text-[15px] !font-semibold flex items-center gap-1">
               <BaseIcon icon-name="mdiTrayArrowDown" :size="20" />
               <span>{{ t('application.importData') }}</span>
            </DialogTitle>
            <Button
               variant="ghost"
               size="icon"
               class="!h-7 !w-7"
               @click="closeModal"
            >
               <BaseIcon icon-name="mdiClose" :size="16" />
            </Button>
         </DialogHeader>
         <div class="px-5 py-4 space-y-4">
            <div class="space-y-1.5">
               <Label class="text-xs font-medium uppercase tracking-wide">{{ t('application.choseFile') }}</Label>
               <BaseUploadInput
                  :model-value="filePath"
                  :message="t('general.browse')"
                  accept=".antares"
                  @clear="clearPath"
                  @change="filesChange($event)"
               />
            </div>
            <div class="space-y-1.5">
               <Label class="text-xs font-medium uppercase tracking-wide">{{ t('application.password') }}</Label>
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
            <div class="flex items-center gap-2">
               <Checkbox
                  id="ignore-duplicates"
                  :checked="options.ignoreDuplicates"
                  @update:checked="(v) => options.ignoreDuplicates = v"
               />
               <Label for="ignore-duplicates" class="text-[13px]">{{ t('application.ignoreDuplicates') }}</Label>
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
               :disabled="!filePath"
               @click.prevent="importData()"
            >
               {{ t('database.import') }}
            </Button>
         </DialogFooter>
      </DialogContent>
   </Dialog>
</template>

<script setup lang="ts">
import { ConnectionParams } from 'common/interfaces/antares';
import { decrypt } from 'common/libs/encrypter';
import { storeToRefs } from 'pinia';
import { onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import BaseUploadInput from '@/components/BaseUploadInput.vue';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { unproxify } from '@/libs/unproxify';
import { CustomIcon, SidebarElement, useConnectionsStore } from '@/stores/connections';
import { useNotificationsStore } from '@/stores/notifications';

const { t } = useI18n();
const emit = defineEmits<{
   'close': [];
}>();

const { addNotification } = useNotificationsStore();

const connectionsStore = useConnectionsStore();
const { importConnections } = connectionsStore;
const { connections } = storeToRefs(connectionsStore);

const filePath = ref('');
const fileContent = ref(null);
const isPasswordVisible = ref(false);
const isPasswordError = ref(false);
const options = ref({
   passkey: '',
   ignoreDuplicates: true
});

const closeModal = () => {
   emit('close');
};

const filesChange = (event: Event) => {
   const target = event.target as HTMLInputElement;
   const { files } = target;
   if (!files.length) return;

   const reader = new FileReader();
   reader.readAsText(files[0]);
   reader.onload = () => {
      fileContent.value = reader.result;
      filePath.value = files[0].name;
   };
};

const clearPath = () => {
   filePath.value = '';
   fileContent.value = null;
};

const importData = () => {
   if (options.value.passkey.length < 8)
      isPasswordError.value = true;
   else {
      try {
         const hash = JSON.parse(Buffer.from(fileContent.value, 'hex').toString('utf-8'));

         try {
            const importObj: {
               connections: ConnectionParams[];
               connectionsOrder: SidebarElement[];
               customIcons: CustomIcon[];
            } = JSON.parse(decrypt(hash, options.value.passkey));

            if (options.value.ignoreDuplicates) {
               const actualConnections = unproxify(connections.value).map(c => {
                  delete c.uid;

                  delete c.name;
                  delete c.password;
                  delete c.ask;

                  delete c.key;
                  delete c.cert;
                  delete c.ca;

                  delete c.sshKey;

                  return JSON.stringify(c);
               });

               const incomingConnections = unproxify<ConnectionParams[]>(importObj.connections).map(c => {
                  const uid = c.uid;
                  delete c.uid;

                  delete c.name;
                  delete c.password;
                  delete c.ask;

                  delete c.key;
                  delete c.cert;
                  delete c.ca;

                  delete c.sshKey;

                  return { uid, jsonString: JSON.stringify(c) };
               });

               const newConnectionsUid = incomingConnections
                  .filter(c => !actualConnections.includes(c.jsonString))
                  .reduce((acc, cur) => {
                     acc.push(cur.uid);
                     return acc;
                  }, [] as string[]);

               importObj.connections = importObj.connections.filter(c => newConnectionsUid.includes(c.uid));
               importObj.connectionsOrder = importObj.connectionsOrder
                  .filter(c => newConnectionsUid
                     .includes(c.uid) ||
                     (c.isFolder && c.connections.every(c => newConnectionsUid.includes(c))));
            }
            importConnections(importObj);

            addNotification({
               status: 'success',
               message: t('application.dataImportSuccess')
            });
            closeModal();
         }
         catch (error) {
            console.error(error);
            addNotification({
               status: 'error',
               message: t('application.wrongImportPassword')
            });
         }
      }
      catch (error) {
         console.error(error);
         addNotification({
            status: 'error',
            message: t('application.wrongFileFormat')
         });
      }
   }
};

const onKey = (e: KeyboardEvent) => {
   e.stopPropagation();
   if (e.key === 'Escape')
      closeModal();
};

window.addEventListener('keydown', onKey);

onBeforeUnmount(() => {
   window.removeEventListener('keydown', onKey);
});

</script>
