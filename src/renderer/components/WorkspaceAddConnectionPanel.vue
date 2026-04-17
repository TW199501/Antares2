<template>
   <div class="connection-panel-wrapper p-relative">
      <div class="connection-panel">
         <div class="mx-auto min-w-[480px] max-w-lg rounded-md border bg-card p-5 text-card-foreground shadow-sm">
            <Tabs v-model="selectedTab">
               <TabsList class="mb-4 w-full">
                  <TabsTrigger value="general" class="flex-1">
                     {{ t('application.general') }}
                  </TabsTrigger>
                  <TabsTrigger
                     v-if="clientCustomizations.sslConnection"
                     value="ssl"
                     class="flex-1"
                  >
                     {{ t('connection.ssl') }}
                  </TabsTrigger>
                  <TabsTrigger
                     v-if="clientCustomizations.sshConnection"
                     value="ssh"
                     class="flex-1"
                  >
                     {{ t('connection.sshTunnel') }}
                  </TabsTrigger>
               </TabsList>

               <TabsContent value="general">
                  <fieldset class="m-0 flex flex-col gap-3 p-0" :disabled="isBusy">
                     <FormField v-slot="{ id }" :label="t('connection.connectionName')">
                        <input
                           :id="id"
                           ref="firstInput"
                           v-model="connection.name"
                           type="text"
                           :class="inputClass"
                        >
                     </FormField>

                     <FormField :label="t('connection.client')">
                        <BaseSelect
                           v-model="connection.client"
                           :options="clients"
                           option-track-by="slug"
                           option-label="name"
                           class="form-select"
                        />
                     </FormField>

                     <FormField
                        v-if="connection.client === 'pg'"
                        v-slot="{ id }"
                        :label="t('connection.connectionString')"
                     >
                        <input
                           :id="id"
                           ref="pgString"
                           v-model="connection.connString"
                           type="text"
                           :class="inputClass"
                        >
                     </FormField>

                     <FormField
                        v-if="!clientCustomizations.fileConnection"
                        v-slot="{ id }"
                        :label="`${t('connection.hostName')}/IP`"
                     >
                        <Input
                           :id="id"
                           v-model="connection.host"
                           type="text"
                        />
                     </FormField>

                     <FormField v-if="clientCustomizations.fileConnection" :label="t('database.database')">
                        <BaseUploadInput
                           :model-value="connection.databasePath"
                           :message="t('general.browse')"
                           @clear="pathClear('databasePath')"
                           @select="(path) => pathSelection(path, 'databasePath')"
                        />
                     </FormField>

                     <FormField
                        v-if="!clientCustomizations.fileConnection"
                        v-slot="{ id }"
                        :label="t('connection.port')"
                     >
                        <Input
                           :id="id"
                           v-model="connection.port"
                           type="number"
                           min="1"
                           max="65535"
                        />
                     </FormField>

                     <FormField
                        v-if="clientCustomizations.database"
                        v-slot="{ id }"
                        :label="t('database.database')"
                     >
                        <Input
                           :id="id"
                           v-model="connection.database"
                           type="text"
                           :placeholder="clientCustomizations.defaultDatabase"
                        />
                     </FormField>

                     <FormField
                        v-if="!clientCustomizations.fileConnection"
                        v-slot="{ id }"
                        :label="t('connection.user')"
                     >
                        <Input
                           :id="id"
                           v-model="connection.user"
                           type="text"
                           :disabled="connection.ask"
                        />
                     </FormField>

                     <FormField
                        v-if="!clientCustomizations.fileConnection"
                        v-slot="{ id }"
                        :label="t('connection.password')"
                     >
                        <Input
                           :id="id"
                           v-model="connection.password"
                           type="password"
                           :disabled="connection.ask"
                        />
                     </FormField>

                     <FormField
                        v-if="clientCustomizations.connectionSchema"
                        v-slot="{ id }"
                        :label="t('database.schema')"
                     >
                        <Input
                           :id="id"
                           v-model="connection.schema"
                           type="text"
                           :placeholder="t('general.all')"
                        />
                     </FormField>

                     <div class="flex flex-wrap gap-x-4 gap-y-2 pt-1">
                        <label v-if="clientCustomizations.readOnlyMode" class="flex cursor-pointer items-center gap-2 text-sm">
                           <Checkbox v-model:checked="connection.readonly" />
                           {{ t('connection.readOnlyMode') }}
                        </label>
                        <label v-if="!clientCustomizations.fileConnection" class="flex cursor-pointer items-center gap-2 text-sm">
                           <Checkbox v-model:checked="connection.ask" />
                           {{ t('connection.askCredentials') }}
                        </label>
                     </div>
                  </fieldset>
               </TabsContent>

               <TabsContent value="ssl">
                  <fieldset class="m-0 flex flex-col gap-3 p-0">
                     <label class="flex cursor-pointer items-center gap-2 text-sm font-medium" @click.prevent="toggleSsl">
                        <Checkbox :checked="connection.ssl" />
                        {{ t('connection.enableSsl') }}
                     </label>
                     <fieldset class="m-0 flex flex-col gap-3 border-0 p-0" :disabled="isBusy || !connection.ssl">
                        <FormField :label="t('connection.privateKey')">
                           <BaseUploadInput
                              :model-value="connection.key"
                              :message="t('general.browse')"
                              @clear="pathClear('key')"
                              @select="(path) => pathSelection(path, 'key')"
                           />
                        </FormField>
                        <FormField :label="t('connection.certificate')">
                           <BaseUploadInput
                              :model-value="connection.cert"
                              :message="t('general.browse')"
                              @clear="pathClear('cert')"
                              @select="(path) => pathSelection(path, 'cert')"
                           />
                        </FormField>
                        <FormField :label="t('connection.caCertificate')">
                           <BaseUploadInput
                              :model-value="connection.ca"
                              :message="t('general.browse')"
                              @clear="pathClear('ca')"
                              @select="(path) => pathSelection(path, 'ca')"
                           />
                        </FormField>
                        <FormField v-slot="{ id }" :label="t('connection.ciphers')">
                           <Input
                              :id="id"
                              v-model="connection.ciphers"
                              type="text"
                           />
                        </FormField>
                        <label class="flex cursor-pointer items-center gap-2 text-sm">
                           <Checkbox v-model:checked="connection.untrustedConnection" />
                           {{ t('connection.untrustedConnection') }}
                        </label>
                     </fieldset>
                  </fieldset>
               </TabsContent>

               <TabsContent value="ssh">
                  <fieldset class="m-0 flex flex-col gap-3 p-0">
                     <label class="flex cursor-pointer items-center gap-2 text-sm font-medium" @click.prevent="toggleSsh">
                        <Checkbox :checked="connection.ssh" />
                        {{ t('connection.enableSsh') }}
                     </label>
                     <fieldset class="m-0 flex flex-col gap-3 border-0 p-0" :disabled="isBusy || !connection.ssh">
                        <FormField v-slot="{ id }" :label="`${t('connection.hostName')}/IP`">
                           <Input
                              :id="id"
                              v-model="connection.sshHost"
                              type="text"
                           />
                        </FormField>
                        <FormField v-slot="{ id }" :label="t('connection.user')">
                           <Input
                              :id="id"
                              v-model="connection.sshUser"
                              type="text"
                           />
                        </FormField>
                        <FormField v-slot="{ id }" :label="t('connection.password')">
                           <Input
                              :id="id"
                              v-model="connection.sshPass"
                              type="password"
                           />
                        </FormField>
                        <FormField v-slot="{ id }" :label="t('connection.port')">
                           <Input
                              :id="id"
                              v-model="connection.sshPort"
                              type="number"
                              min="1"
                              max="65535"
                           />
                        </FormField>
                        <FormField :label="t('connection.privateKey')">
                           <BaseUploadInput
                              :model-value="connection.sshKey"
                              :message="t('general.browse')"
                              @clear="pathClear('sshKey')"
                              @select="(path) => pathSelection(path, 'sshKey')"
                           />
                        </FormField>
                        <FormField v-slot="{ id }" :label="t('connection.passphrase')">
                           <Input
                              :id="id"
                              v-model="connection.sshPassphrase"
                              type="password"
                           />
                        </FormField>
                        <FormField v-slot="{ id }" :label="t('connection.keepAliveInterval')">
                           <div class="flex items-center gap-2">
                              <Input
                                 :id="id"
                                 v-model="connection.sshKeepAliveInterval"
                                 type="number"
                                 min="1"
                                 class="flex-1"
                              />
                              <span class="whitespace-nowrap text-xs text-muted-foreground">
                                 {{ t('general.seconds') }}
                              </span>
                           </div>
                        </FormField>
                     </fieldset>
                  </fieldset>
               </TabsContent>
            </Tabs>

            <div class="mt-4 flex justify-end gap-2 border-t pt-4">
               <div
                  @mouseenter="setCancelTestButtonVisibility(true)"
                  @mouseleave="setCancelTestButtonVisibility(false)"
               >
                  <Button
                     v-if="showTestCancel && isTesting"
                     variant="secondary"
                     :title="t('general.cancel')"
                     @click="abortConnection()"
                  >
                     <BaseIcon
                        icon-name="mdiWindowClose"
                        :size="18"
                        class="mr-1"
                     />
                     {{ t('connection.testConnection') }}
                  </Button>
                  <Button
                     v-else
                     id="connection-test"
                     variant="secondary"
                     :disabled="isBusy"
                     :class="{ 'opacity-60': isTesting }"
                     @click="startTest"
                  >
                     <BaseIcon
                        icon-name="mdiLightningBolt"
                        :size="18"
                        class="mr-1"
                     />
                     {{ t('connection.testConnection') }}
                  </Button>
               </div>
               <Button
                  id="connection-save"
                  variant="default"
                  :disabled="isBusy"
                  @click="saveConnection"
               >
                  <BaseIcon
                     icon-name="mdiContentSave"
                     :size="18"
                     class="mr-1"
                  />
                  {{ t('general.save') }}
               </Button>
            </div>

            <ModalAskCredentials
               v-if="isAsking"
               @close-asking="closeAsking"
               @credentials="continueTest"
            />
         </div>
      </div>
   </div>
   <DebugConsole v-if="isConsoleOpen" />
</template>

<script setup lang="ts">
import customizations from 'common/customizations';
import { ConnectionParams } from 'common/interfaces/antares';
import { uidGen } from 'common/libs/uidGen';
import { storeToRefs } from 'pinia';
import { computed, Ref, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import BaseUploadInput from '@/components/BaseUploadInput.vue';
import DebugConsole from '@/components/DebugConsole.vue';
import ModalAskCredentials from '@/components/ModalAskCredentials.vue';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Connection from '@/ipc-api/Connection';
import { useConnectionsStore } from '@/stores/connections';
import { useConsoleStore } from '@/stores/console';
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const { addConnection } = useConnectionsStore();
const { addNotification } = useNotificationsStore();
const workspacesStore = useWorkspacesStore();
const { isConsoleOpen } = storeToRefs(useConsoleStore());

const { connectWorkspace, selectWorkspace } = workspacesStore;

const clients = [
   { name: 'MySQL', slug: 'mysql' },
   { name: 'MariaDB', slug: 'maria' },
   { name: 'PostgreSQL', slug: 'pg' },
   { name: 'SQL Server', slug: 'mssql' },
   { name: 'SQLite', slug: 'sqlite' },
   { name: 'Firebird SQL', slug: 'firebird' }
];

// Shadcn-equivalent class for raw <input> (used only when a template ref to the DOM node is required)
const inputClass = 'flex h-9 w-full rounded-md border border-input bg-secondary px-3 py-1 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

const connection = ref({
   name: '',
   client: 'mysql',
   host: '127.0.0.1',
   database: null,
   databasePath: '',
   port: null,
   user: null,
   password: '',
   ask: false,
   readonly: false,
   uid: uidGen('C'),
   ssl: false,
   cert: '',
   key: '',
   ca: '',
   ciphers: '',
   untrustedConnection: false,
   ssh: false,
   sshHost: '',
   sshUser: '',
   sshPass: '',
   sshPassphrase: null,
   sshKey: '',
   sshPort: 22,
   sshKeepAliveInterval: 1800,
   connString: ''
}) as Ref<ConnectionParams & { connString: string }>;

const firstInput: Ref<HTMLInputElement> = ref(null);
const isConnecting = ref(false);
const isTesting = ref(false);
const isAsking = ref(false);
const showTestCancel = ref(false);
const abortController: Ref<AbortController> = ref(new AbortController());
const selectedTab = ref('general');

const clientCustomizations = computed(() => {
   return customizations[connection.value.client];
});

const isBusy = computed(() => {
   return isConnecting.value || isTesting.value;
});

watch(() => connection.value.client, () => {
   connection.value.user = clientCustomizations.value.defaultUser;
   connection.value.port = clientCustomizations.value.defaultPort;
   connection.value.database = clientCustomizations.value.defaultDatabase;
});

const setDefaults = () => {
   connection.value.user = clientCustomizations.value.defaultUser;
   connection.value.port = clientCustomizations.value.defaultPort;
   connection.value.database = clientCustomizations.value.defaultDatabase;
};

const setCancelTestButtonVisibility = (val: boolean) => {
   showTestCancel.value = val;
};

const startTest = async () => {
   isTesting.value = true;

   if (connection.value.ask)
      isAsking.value = true;
   else {
      try {
         const res = await Connection.makeTest(connection.value);
         if (res.status === 'error')
            addNotification({ status: 'error', message: res.response.message || res.response.toString() });
         else if (res.status === 'success')
            addNotification({ status: 'success', message: t('connection.connectionSuccessfullyMade') });
      }
      catch (err) {
         addNotification({ status: 'error', message: err.stack });
      }

      isTesting.value = false;
   }
};

const abortConnection = (): void => {
   abortController.value.abort();
   Connection.abortConnection(connection.value.uid);
   isTesting.value = false;
   isConnecting.value = false;
   abortController.value = new AbortController();
};

const continueTest = async (credentials: { user: string; password: string }) => { // if "Ask for credentials" is true
   isAsking.value = false;
   const params = Object.assign({}, connection.value, credentials);

   try {
      if (isConnecting.value) {
         await connectWorkspace(params, { signal: abortController.value.signal }).catch(() => undefined);
         isConnecting.value = false;
      }
      else {
         const res = await Connection.makeTest(params);
         if (res.status === 'error')
            addNotification({ status: 'error', message: res.response.message || res.response.toString() });
         else
            addNotification({ status: 'success', message: t('connection.connectionSuccessfullyMade') });
      }
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   isTesting.value = false;
};

const saveConnection = async () => {
   await addConnection(connection.value);
   selectWorkspace(connection.value.uid);
};

const closeAsking = () => {
   isTesting.value = false;
   isAsking.value = false;
};

const toggleSsl = () => {
   connection.value.ssl = !connection.value.ssl;
};

const toggleSsh = () => {
   connection.value.ssh = !connection.value.ssh;
};

const pathSelection = (path: string, name: keyof ConnectionParams) => {
   (connection.value as unknown as Record<string, string>)[name] = path;
};

const pathClear = (name: keyof ConnectionParams) => {
   (connection.value as unknown as Record<string, string>)[name] = '';
};

setDefaults();

setTimeout(() => {
   if (firstInput.value) firstInput.value.focus();
}, 200);
</script>

<style lang="scss" scoped>
.connection-panel {
  margin-left: auto;
  margin-right: auto;
  margin-bottom: 0.5rem;
  margin-top: 1.5rem;
}
</style>
