<template>
   <div class="connection-panel flex min-h-full flex-col items-center justify-center py-6">
      <div class="mb-5 flex w-[440px] items-center gap-3 px-1 text-foreground">
         <div class="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BaseIcon icon-name="mdiDatabase" :size="26" />
         </div>
         <div class="min-w-0">
            <div class="truncate text-[18px] font-semibold tracking-tight">
               {{ localConnection.name || t('connection.editConnection') }}
            </div>
            <div class="truncate text-[13px] text-muted-foreground">
               {{ t('connection.editConnection') }}
            </div>
         </div>
      </div>
      <div class="w-[440px] rounded-lg border border-border/60 bg-card/90 p-6 text-card-foreground shadow-[0_10px_28px_-2px_rgb(0_0_0_/_0.15)]">
         <Tabs v-model="selectedTab">
            <TabsList class="mb-5 w-full bg-muted/60">
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
               <fieldset class="m-0 flex flex-col gap-[16px] p-0" :disabled="isBusy">
                  <!-- Row 1: 連線名稱 (左) + 資料庫類型 (右) -->
                  <div class="flex gap-3">
                     <FormField
                        v-slot="{ id }"
                        class="flex-1"
                        :label="t('connection.connectionName')"
                     >
                        <input
                           :id="id"
                           ref="firstInput"
                           v-model="localConnection.name"
                           type="text"
                           :class="inputClass"
                        >
                     </FormField>
                     <FormField class="flex-1" :label="t('connection.client')">
                        <BaseSelect
                           v-model="localConnection.client"
                           :options="clients"
                           option-track-by="slug"
                           option-label="name"
                        />
                     </FormField>
                  </div>

                  <!-- Row 2: 主機名/IP + 連線埠 (existing layout, unchanged for non-file clients) -->
                  <div v-if="!clientCustomizations.fileConnection" class="flex gap-3">
                     <FormField
                        v-slot="{ id }"
                        class="flex-1"
                        :label="`${t('connection.hostName')}/IP`"
                     >
                        <input
                           :id="id"
                           v-model="localConnection.host"
                           type="text"
                           :class="inputClass"
                        >
                     </FormField>
                     <FormField
                        v-slot="{ id }"
                        class="w-[120px] shrink-0"
                        :label="t('connection.port')"
                     >
                        <input
                           :id="id"
                           v-model="localConnection.port"
                           type="number"
                           min="1"
                           max="65535"
                           :class="inputClass"
                        >
                     </FormField>
                  </div>

                  <!-- File-connection (sqlite): database file path replaces host/user/etc. -->
                  <FormField
                     v-if="clientCustomizations.fileConnection"
                     :label="t('database.database')"
                  >
                     <BaseUploadInput
                        :model-value="localConnection.databasePath"
                        :message="t('general.browse')"
                        @clear="pathClear('databasePath')"
                        @select="(path) => pathSelection(path, 'databasePath')"
                     />
                  </FormField>

                  <!-- Row 3: 使用者 + 密碼 (existing layout, unchanged) -->
                  <div v-if="!clientCustomizations.fileConnection" class="flex gap-3">
                     <FormField
                        v-slot="{ id }"
                        class="flex-1"
                        :label="t('connection.user')"
                     >
                        <input
                           :id="id"
                           v-model="localConnection.user"
                           type="text"
                           :disabled="localConnection.ask"
                           :class="inputClass"
                        >
                     </FormField>
                     <FormField
                        v-slot="{ id }"
                        class="flex-1"
                        :label="t('connection.password')"
                     >
                        <input
                           :id="id"
                           v-model="localConnection.password"
                           type="password"
                           :disabled="localConnection.ask"
                           :class="inputClass"
                        >
                     </FormField>
                  </div>

                  <!-- Row 4: 資料庫 dropdown (左) + 系統庫 checkbox (右) -->
                  <div v-if="clientCustomizations.database" class="flex items-end gap-3">
                     <FormField class="flex-1" :label="t('database.database')">
                        <div class="flex gap-2">
                           <div class="flex-1 min-w-0">
                              <BaseSelect
                                 v-model="localConnection.database"
                                 :options="filteredDatabases"
                                 :placeholder="clientCustomizations.defaultDatabase || ''"
                                 :searchable="true"
                              />
                           </div>
                           <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              class="!h-[34px] !w-[34px] shrink-0"
                              :disabled="isLoadingDbs"
                              :title="t('general.refresh')"
                              @click="refreshDatabaseList"
                           >
                              <BaseIcon
                                 icon-name="mdiRefresh"
                                 :size="16"
                                 :class="{ 'animate-spin': isLoadingDbs }"
                              />
                           </Button>
                        </div>
                     </FormField>
                     <label class="flex shrink-0 cursor-pointer items-center gap-2 pb-2.5 text-sm">
                        <Checkbox v-model:checked="includeSystemDb" />
                        {{ t('database.systemDatabases') }}
                     </label>
                  </div>

                  <!-- Schema (clients that need it, e.g. pg) -->
                  <FormField
                     v-if="clientCustomizations.connectionSchema"
                     v-slot="{ id }"
                     :label="t('database.schema')"
                  >
                     <input
                        :id="id"
                        v-model="localConnection.schema"
                        type="text"
                        :placeholder="t('general.all')"
                        :class="inputClass"
                     >
                  </FormField>

                  <!-- Row 5: 連線字串 (all clients) -->
                  <FormField v-slot="{ id }" :label="t('connection.connectionString')">
                     <input
                        :id="id"
                        v-model="localConnection.connString"
                        type="text"
                        :class="inputClass"
                     >
                  </FormField>

                  <div class="flex flex-wrap gap-x-4 gap-y-2 pt-1">
                     <label v-if="clientCustomizations.readOnlyMode" class="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox v-model:checked="localConnection.readonly" />
                        {{ t('connection.readOnlyMode') }}
                     </label>
                     <label v-if="!clientCustomizations.fileConnection" class="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox v-model:checked="localConnection.ask" />
                        {{ t('connection.askCredentials') }}
                     </label>
                     <label v-if="clientCustomizations.singleConnectionMode" class="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox v-model:checked="localConnection.singleConnectionMode" />
                        {{ t('connection.singleConnection') }}
                     </label>
                  </div>
               </fieldset>
            </TabsContent>
            <TabsContent v-if="clientCustomizations.sslConnection" value="ssl">
               <fieldset class="m-0 flex flex-col gap-2 p-0" :disabled="isBusy">
                  <label class="flex cursor-pointer items-center gap-2 text-sm">
                     <Checkbox v-model:checked="localConnection.ssl" />
                     {{ t('connection.enableSsl') }}
                  </label>
                  <fieldset class="m-0 flex flex-col gap-2 p-0" :disabled="isBusy || !localConnection.ssl">
                     <FormField :label="t('connection.privateKey')">
                        <BaseUploadInput
                           :model-value="localConnection.key"
                           :message="t('general.browse')"
                           @clear="pathClear('key')"
                           @select="(path) => pathSelection(path, 'key')"
                        />
                     </FormField>
                     <FormField :label="t('connection.certificate')">
                        <BaseUploadInput
                           :model-value="localConnection.cert"
                           :message="t('general.browse')"
                           @clear="pathClear('cert')"
                           @select="(path) => pathSelection(path, 'cert')"
                        />
                     </FormField>
                     <FormField :label="t('connection.caCertificate')">
                        <BaseUploadInput
                           :model-value="localConnection.ca"
                           :message="t('general.browse')"
                           @clear="pathClear('ca')"
                           @select="(path) => pathSelection(path, 'ca')"
                        />
                     </FormField>
                     <FormField v-slot="{ id }" :label="t('connection.ciphers')">
                        <input
                           :id="id"
                           v-model="localConnection.ciphers"
                           type="text"
                           :class="inputClass"
                        >
                     </FormField>
                     <label class="flex cursor-pointer items-center gap-2 pt-1 text-sm">
                        <Checkbox v-model:checked="localConnection.untrustedConnection" />
                        {{ t('connection.untrustedConnection') }}
                     </label>
                  </fieldset>
               </fieldset>
            </TabsContent>
            <TabsContent v-if="clientCustomizations.sshConnection" value="ssh">
               <fieldset class="m-0 flex flex-col gap-2 p-0" :disabled="isBusy">
                  <label class="flex cursor-pointer items-center gap-2 text-sm">
                     <Checkbox v-model:checked="localConnection.ssh" />
                     {{ t('connection.enableSsh') }}
                  </label>
                  <fieldset class="m-0 flex flex-col gap-2 p-0" :disabled="isBusy || !localConnection.ssh">
                     <FormField v-slot="{ id }" :label="`${t('connection.hostName')}/IP`">
                        <input
                           :id="id"
                           v-model="localConnection.sshHost"
                           type="text"
                           :class="inputClass"
                        >
                     </FormField>
                     <FormField v-slot="{ id }" :label="t('connection.user')">
                        <input
                           :id="id"
                           v-model="localConnection.sshUser"
                           type="text"
                           :class="inputClass"
                        >
                     </FormField>
                     <FormField v-slot="{ id }" :label="t('connection.password')">
                        <input
                           :id="id"
                           v-model="localConnection.sshPass"
                           type="password"
                           :class="inputClass"
                        >
                     </FormField>
                     <FormField v-slot="{ id }" :label="t('connection.port')">
                        <input
                           :id="id"
                           v-model="localConnection.sshPort"
                           type="number"
                           min="1"
                           max="65535"
                           :class="inputClass"
                        >
                     </FormField>
                     <FormField :label="t('connection.privateKey')">
                        <BaseUploadInput
                           :model-value="localConnection.sshKey"
                           :message="t('general.browse')"
                           @clear="pathClear('sshKey')"
                           @select="(path) => pathSelection(path, 'sshKey')"
                        />
                     </FormField>
                     <FormField v-slot="{ id }" :label="t('connection.passphrase')">
                        <input
                           :id="id"
                           v-model="localConnection.sshPassphrase"
                           type="password"
                           :class="inputClass"
                        >
                     </FormField>
                     <FormField v-slot="{ id }" :label="t('connection.keepAliveInterval')">
                        <div class="flex items-stretch gap-2">
                           <input
                              :id="id"
                              v-model="localConnection.sshKeepAliveInterval"
                              type="number"
                              min="1"
                              :class="inputClass"
                           >
                           <span class="inline-flex items-center rounded-md border border-border/60 bg-muted px-3 text-sm text-muted-foreground">{{ t('general.seconds') }}</span>
                        </div>
                     </FormField>
                  </fieldset>
               </fieldset>
            </TabsContent>
         </Tabs>

         <div class="mt-5 flex justify-end gap-2 border-t border-border/60 pt-5">
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
               variant="secondary"
               :disabled="isBusy || !hasChanges"
               @click="saveConnection"
            >
               <BaseIcon
                  icon-name="mdiContentSave"
                  :size="18"
                  class="mr-1"
               />
               {{ t('general.save') }}
            </Button>
            <div
               @mouseenter="setCancelConnectButtonVisibility(true)"
               @mouseleave="setCancelConnectButtonVisibility(false)"
            >
               <Button
                  v-if="showConnectCancel && isConnecting"
                  variant="default"
                  :title="t('general.cancel')"
                  @click="abortConnection()"
               >
                  <BaseIcon
                     icon-name="mdiWindowClose"
                     :size="18"
                     class="mr-1"
                  />
                  {{ t('connection.connect') }}
               </Button>
               <Button
                  v-else
                  id="connection-connect"
                  variant="default"
                  :disabled="isBusy"
                  :class="{ 'opacity-60': isConnecting }"
                  @click="startConnection"
               >
                  <BaseIcon
                     icon-name="mdiConnection"
                     :size="18"
                     class="mr-1"
                  />
                  {{ t('connection.connect') }}
               </Button>
            </div>
         </div>
      </div>
      <ModalAskCredentials
         v-if="isAsking"
         @close-asking="closeAsking"
         @credentials="continueTest"
      />
   </div>
</template>

<script setup lang="ts">
import customizations from 'common/customizations';
import { ConnectionParams } from 'common/interfaces/antares';
import { computed, Prop, Ref, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import BaseUploadInput from '@/components/BaseUploadInput.vue';
import ModalAskCredentials from '@/components/ModalAskCredentials.vue';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Connection from '@/ipc-api/Connection';
import { useConnectionsStore } from '@/stores/connections';
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const props = defineProps({
   connection: Object as Prop<ConnectionParams>
});

const { editConnection } = useConnectionsStore();
const { addNotification } = useNotificationsStore();
const { connectWorkspace } = useWorkspacesStore();

const clients = [
   { name: 'MySQL', slug: 'mysql' },
   { name: 'MariaDB', slug: 'maria' },
   { name: 'PostgreSQL', slug: 'pg' },
   { name: 'SQL Server', slug: 'mssql' },
   { name: 'SQLite', slug: 'sqlite' }
];

const inputClass = 'flex h-[34px] w-full rounded-md border border-input bg-secondary px-3 text-[13px] text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

const firstInput: Ref<HTMLInputElement> = ref(null);
const localConnection: Ref<ConnectionParams & { connString: string }> = ref(null);
const isConnecting = ref(false);
const isTesting = ref(false);
const isAsking = ref(false);
const showTestCancel = ref(false);
const showConnectCancel = ref(false);
const abortController: Ref<AbortController> = ref(new AbortController());
const selectedTab = ref('general');

// Database dropdown state. Populated lazily via the new
// /api/connection/listDatabases endpoint (ephemeral connect → list →
// disconnect) so users can pick a real database before saving the
// connection. `includeSystemDb` is a client-side filter — server returns the
// full list and we hide system DBs by default to avoid accidentally connecting
// to master/template/etc. which is rarely what users want.
const dbList = ref<string[]>([]);
const isLoadingDbs = ref(false);
const includeSystemDb = ref(false);

const SYSTEM_DBS: Record<string, string[]> = {
   mssql: ['master', 'model', 'msdb', 'tempdb', 'distribution', 'reportserver', 'reportservertempdb'],
   mysql: ['mysql', 'information_schema', 'performance_schema', 'sys'],
   maria: ['mysql', 'information_schema', 'performance_schema', 'sys'],
   pg: ['postgres', 'template0', 'template1'],
   sqlite: []
};

const filteredDatabases = computed(() => {
   if (includeSystemDb.value) return dbList.value;
   const sys = SYSTEM_DBS[localConnection.value?.client] ?? [];
   return dbList.value.filter(d => !sys.includes(d.toLowerCase()));
});

const refreshDatabaseList = async () => {
   if (isLoadingDbs.value) return;
   isLoadingDbs.value = true;
   try {
      const { status, response } = await Connection.listDatabases(localConnection.value);
      if (status === 'success' && Array.isArray(response))
         dbList.value = response;
      else
         addNotification({ status: 'error', message: typeof response === 'string' ? response : 'listDatabases failed' });
   }
   catch (err) {
      addNotification({ status: 'error', message: (err as Error).message ?? String(err) });
   }
   finally {
      isLoadingDbs.value = false;
   }
};

const clientCustomizations = computed(() => {
   return customizations[localConnection.value.client];
});

const isBusy = computed(() => {
   return isConnecting.value || isTesting.value;
});

const hasChanges = computed(() => {
   return JSON.stringify(props.connection) !== JSON.stringify(localConnection.value);
});

// Auto-sync `includeSystemDb` checkbox to whether the currently-selected
// database is a system DB for this client. Without this, opening a saved
// connection that has e.g. `database: "master"` shows the system-DB checkbox
// unchecked while the field displays a system DB — internally inconsistent.
const isSelectedDbSystem = (): boolean => {
   const c = localConnection.value;
   if (!c?.database) return false;
   const sys = SYSTEM_DBS[c.client] ?? [];
   return sys.includes(c.database.toLowerCase());
};

watch(() => props.connection, () => {
   localConnection.value = JSON.parse(JSON.stringify(props.connection));
   includeSystemDb.value = isSelectedDbSystem();
}, { immediate: true });

const startConnection = async (): Promise<void> => {
   await saveConnection();
   isConnecting.value = true;

   if (localConnection.value.ask)
      isAsking.value = true;
   else {
      await connectWorkspace(localConnection.value, { signal: abortController.value.signal }).catch((): void => undefined);
      isConnecting.value = false;
   }
};

// Mirror backend `server/Connections/ConnectionConfigBuilder.cs` so the user
// can see / copy the actual connection string after a successful test. The
// field is read-only metadata on the backend (ConnString is stored but never
// re-parsed; the real connection always derives from individual fields), so
// this is purely for display / sharing purposes.
const buildConnString = (c: { client: string; host?: string; port?: number; database?: string; user?: string; password?: string; ssl?: boolean; untrustedConnection?: boolean; databasePath?: string }): string => {
   const parts: string[] = [];
   const pwd = c.password ? '***' : '';
   switch (c.client) {
      case 'mssql':
         parts.push(`Server=${c.host},${c.port}`);
         if (c.database) parts.push(`Database=${c.database}`);
         parts.push(`User Id=${c.user}`, `Password=${pwd}`);
         if (c.ssl) {
            parts.push('Encrypt=true');
            if (c.untrustedConnection) parts.push('TrustServerCertificate=true');
         }
         else parts.push('Encrypt=false', 'TrustServerCertificate=true');
         parts.push('Application Name=Antares2');
         return parts.join(';') + ';';
      case 'mysql':
      case 'maria':
         parts.push(`Server=${c.host}`, `Port=${c.port}`);
         if (c.database) parts.push(`Database=${c.database}`);
         parts.push(`Uid=${c.user}`, `Pwd=${pwd}`, 'ConnectionTimeout=10');
         parts.push(c.ssl ? 'SslMode=Required' : 'SslMode=None');
         return parts.join(';') + ';';
      case 'pg':
         parts.push(`Host=${c.host}`, `Port=${c.port}`);
         if (c.database) parts.push(`Database=${c.database}`);
         parts.push(`Username=${c.user}`, `Password=${pwd}`, 'Application Name=Antares2');
         if (c.ssl) parts.push('SSL Mode=Require');
         return parts.join(';') + ';';
      case 'sqlite':
         return `Data Source=${c.databasePath || c.database || ''};`;
      default:
         return '';
   }
};

const startTest = async () => {
   isTesting.value = true;

   if (localConnection.value.ask)
      isAsking.value = true;
   else {
      try {
         const res = await Connection.makeTest(localConnection.value);
         if (res.status === 'error')
            addNotification({ status: 'error', message: res.response.message || res.response.toString() });
         else if (res.status === 'success') {
            addNotification({ status: 'success', message: t('connection.connectionSuccessfullyMade') });
            // Populate the displayable connection string after a verified test
            // so the user can copy it. Password is masked as `***`.
            localConnection.value.connString = buildConnString(localConnection.value);
         }
      }
      catch (err) {
         addNotification({ status: 'error', message: err.stack });
      }

      isTesting.value = false;
   }
};

const setCancelTestButtonVisibility = (val: boolean) => {
   showTestCancel.value = val;
};

const setCancelConnectButtonVisibility = (val: boolean) => {
   showConnectCancel.value = val;
};

const abortConnection = (): void => {
   abortController.value.abort();
   Connection.abortConnection(localConnection.value.uid);
   isTesting.value = false;
   isConnecting.value = false;
   abortController.value = new AbortController();
};

const continueTest = async (credentials: {user: string; password: string }) => { // if "Ask for credentials" is true
   isAsking.value = false;
   const params = Object.assign({}, localConnection.value, credentials);
   try {
      if (isConnecting.value) {
         const params = Object.assign({}, props.connection, credentials);
         await connectWorkspace(params, { signal: abortController.value.signal }).catch((): void => undefined);
         isConnecting.value = false;
      }
      else {
         const res = await Connection.makeTest(params);
         if (res.status === 'error')
            addNotification({ status: 'error', message: res.response.message || res.response.toString() });
         else if (res.status === 'success')
            addNotification({ status: 'success', message: t('connection.connectionSuccessfullyMade') });
      }
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   isTesting.value = false;
};

const saveConnection = () => {
   return editConnection(localConnection.value);
};

const closeAsking = () => {
   isTesting.value = false;
   isAsking.value = false;
   isConnecting.value = false;
};

const pathSelection = (path: string, name: keyof ConnectionParams) => {
   (localConnection.value as unknown as Record<string, string>)[name] = path;
};

const pathClear = (name: keyof ConnectionParams) => {
   (localConnection.value as unknown as Record<string, string>)[name] = '';
};

localConnection.value = JSON.parse(JSON.stringify(props.connection));
</script>
