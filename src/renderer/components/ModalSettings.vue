<template>
   <Dialog :open="true" @update:open="(v) => { if (!v) closeModal(); }">
      <!--
         Settings dialog. Shell uses shadcn Dialog + a vertical Tabs root that
         pins the tab list to a 200px sidebar on the left and gives the tab
         content the remaining 1fr column. This replaces the legacy
         spectre `.panel` / `.tab.tab-block` container that horizontally
         spread tabs across the modal header.

         Footer is intentionally omitted — every settings panel saves changes
         on field interaction (BaseSelect @change, Switch @update:checked,
         <input> @change), so a separate Apply / Cancel pair would be a no-op.
         A close affordance lives in the header instead.
      -->
      <DialogContent
         class="!max-w-[900px] !w-[900px] !max-h-[85vh] !p-0 !gap-0 flex flex-col [&>button.absolute]:!hidden"
         @escape-key-down.prevent="closeModal"
         @pointer-down-outside.prevent="closeModal"
         @interact-outside.prevent
      >
         <DialogHeader class="px-5 py-3 border-b border-border/60 bg-muted/30 flex flex-row items-center justify-between !space-y-0">
            <DialogTitle class="!text-[15px] !font-semibold flex items-center gap-1.5">
               <BaseIcon icon-name="mdiCog" :size="20" />
               <span>{{ t('application.settings') }}</span>
            </DialogTitle>
            <DialogDescription class="sr-only">
               {{ t('application.settings') }}
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
            Vertical Tabs. Reka's TabsRoot supports orientation="vertical" but
            its default TabsList styling is horizontal-flex; we override here
            with !flex-col + a fixed-width sidebar and reset the
            data-[state=active] decorations so the active item reads like a
            sidebar nav item instead of a centered horizontal tab.
         -->
         <Tabs
            v-model="selectedTab"
            orientation="vertical"
            class="flex-1 min-h-0 grid grid-cols-[200px_1fr] overflow-hidden"
         >
            <TabsList class="!flex !flex-col !items-stretch !justify-start !h-full !w-[200px] !p-2 !gap-0.5 !bg-muted/30 !rounded-none border-r border-border/60">
               <TabsTrigger
                  value="general"
                  class="!justify-start !px-3 !py-2 !text-[13px] data-[state=active]:!bg-primary/10 data-[state=active]:!text-primary"
               >
                  {{ t('application.general') }}
               </TabsTrigger>
               <TabsTrigger
                  value="themes"
                  class="!justify-start !px-3 !py-2 !text-[13px] data-[state=active]:!bg-primary/10 data-[state=active]:!text-primary"
               >
                  {{ t('application.themes') }}
               </TabsTrigger>
               <TabsTrigger
                  value="shortcuts"
                  class="!justify-start !px-3 !py-2 !text-[13px] data-[state=active]:!bg-primary/10 data-[state=active]:!text-primary"
               >
                  {{ t('application.shortcuts') }}
               </TabsTrigger>
               <TabsTrigger
                  value="data"
                  class="!justify-start !px-3 !py-2 !text-[13px] data-[state=active]:!bg-primary/10 data-[state=active]:!text-primary"
               >
                  {{ t('application.data') }}
               </TabsTrigger>
               <TabsTrigger
                  v-if="updateStatus !== 'disabled'"
                  value="update"
                  class="!justify-start !px-3 !py-2 !text-[13px] data-[state=active]:!bg-primary/10 data-[state=active]:!text-primary"
               >
                  <span class="flex items-center gap-1.5">
                     {{ t('application.update') }}
                     <span
                        v-if="hasUpdates"
                        class="inline-block h-1.5 w-1.5 rounded-full bg-primary"
                     />
                  </span>
               </TabsTrigger>
               <TabsTrigger
                  value="changelog"
                  class="!justify-start !px-3 !py-2 !text-[13px] data-[state=active]:!bg-primary/10 data-[state=active]:!text-primary"
               >
                  {{ t('application.changelog') }}
               </TabsTrigger>
               <TabsTrigger
                  value="about"
                  class="!justify-start !px-3 !py-2 !text-[13px] data-[state=active]:!bg-primary/10 data-[state=active]:!text-primary"
               >
                  {{ t('application.about') }}
               </TabsTrigger>
            </TabsList>

            <div class="overflow-y-auto p-5 max-h-[calc(85vh-60px)]">
               <TabsContent value="general" class="!mt-0 space-y-6">
                  <!--
                     "Application" section — language, page-size, table
                     auto-refresh, restore session, show table size, disable
                     blur, notification timeout. Each row is a 5/3/4 grid
                     so the label + control + helper text columns line up
                     across all rows. Helper text uses muted-foreground to
                     stay visually subordinate to the control.
                  -->
                  <section class="space-y-3">
                     <h3 class="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {{ t('application.application') }}
                     </h3>
                     <div class="grid grid-cols-[200px_240px_1fr] items-center gap-3">
                        <Label class="!text-[13px] flex items-center gap-1">
                           <BaseIcon icon-name="mdiTranslate" :size="16" />
                           {{ t('application.language') }}
                        </Label>
                        <BaseSelect
                           v-model="localLocale"
                           :options="locales"
                           option-track-by="code"
                           option-label="name"
                           @change="changeLocale(localLocale)"
                        />
                     </div>

                     <div class="grid grid-cols-[200px_240px_1fr] items-center gap-3">
                        <Label class="!text-[13px]">{{ t('application.dataTabPageSize') }}</Label>
                        <BaseSelect
                           v-model="localPageSize"
                           :options="pageSizes"
                           @change="changePageSize(+localPageSize)"
                        />
                        <span />
                     </div>

                     <div class="grid grid-cols-[200px_240px_1fr] items-center gap-3">
                        <Label class="!text-[13px] flex items-center gap-1">
                           <BaseIcon icon-name="mdiRefresh" :size="16" />
                           {{ t('application.tableAutoRefresh') }}
                        </Label>
                        <div class="flex items-stretch">
                           <Input
                              v-model.number="localTableAutoRefreshInterval"
                              type="number"
                              min="60"
                              max="3600"
                              step="1"
                              class="rounded-r-none"
                              :title="t('application.tableAutoRefreshHint')"
                              @change="onChangeAutoRefresh"
                           />
                           <span class="inline-flex items-center px-2 border border-l-0 border-input bg-muted rounded-r-md text-xs text-muted-foreground">
                              {{ t('general.seconds') }}
                           </span>
                        </div>
                        <small class="text-[11px] leading-tight text-muted-foreground">
                           {{ t('application.tableAutoRefreshDescription') }}<br>
                           {{ t('application.tableAutoRefreshHint') }}
                        </small>
                     </div>

                     <div class="grid grid-cols-[200px_240px_1fr] items-center gap-3">
                        <Label for="opt-restore-session" class="!text-[13px]">{{ t('application.restorePreviousSession') }}</Label>
                        <Switch
                           id="opt-restore-session"
                           :checked="restoreTabs"
                           @update:checked="toggleRestoreSession"
                        />
                        <span />
                     </div>

                     <div class="grid grid-cols-[200px_240px_1fr] items-center gap-3">
                        <Label for="opt-show-table-size" class="!text-[13px]">{{ t('application.showTableSize') }}</Label>
                        <Switch
                           id="opt-show-table-size"
                           :checked="showTableSize"
                           @update:checked="toggleShowTableSize"
                        />
                        <small class="text-[11px] leading-tight text-muted-foreground">
                           {{ t('application.showTableSizeDescription') }}
                        </small>
                     </div>

                     <div class="grid grid-cols-[200px_240px_1fr] items-center gap-3">
                        <Label for="opt-disable-blur" class="!text-[13px]">{{ t('application.disableBlur') }}</Label>
                        <Switch
                           id="opt-disable-blur"
                           :checked="disableBlur"
                           @update:checked="toggleDisableBlur"
                        />
                        <span />
                     </div>

                     <div class="grid grid-cols-[200px_240px_1fr] items-center gap-3">
                        <Label class="!text-[13px]">{{ t('application.notificationsTimeout') }}</Label>
                        <div class="flex items-stretch">
                           <Input
                              v-model="localTimeout"
                              type="number"
                              min="1"
                              class="rounded-r-none"
                              @focusout="checkNotificationsTimeout"
                           />
                           <span class="inline-flex items-center px-2 border border-l-0 border-input bg-muted rounded-r-md text-xs text-muted-foreground">
                              {{ t('general.seconds') }}
                           </span>
                        </div>
                        <span />
                     </div>
                  </section>

                  <section class="space-y-3">
                     <h3 class="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {{ t('application.editor') }}
                     </h3>
                     <div class="grid grid-cols-[200px_240px_1fr] items-center gap-3">
                        <Label for="opt-autocomplete" class="!text-[13px]">{{ t('application.autoCompletion') }}</Label>
                        <Switch
                           id="opt-autocomplete"
                           :checked="selectedAutoComplete"
                           @update:checked="toggleAutoComplete"
                        />
                        <span />
                     </div>
                     <div class="grid grid-cols-[200px_240px_1fr] items-center gap-3">
                        <Label for="opt-line-wrap" class="!text-[13px]">{{ t('application.wrapLongLines') }}</Label>
                        <Switch
                           id="opt-line-wrap"
                           :checked="selectedLineWrap"
                           @update:checked="toggleLineWrap"
                        />
                        <span />
                     </div>
                     <div class="grid grid-cols-[200px_240px_1fr] items-center gap-3">
                        <Label for="opt-execute-selected" class="!text-[13px]">{{ t('database.executeSelectedQuery') }}</Label>
                        <Switch
                           id="opt-execute-selected"
                           :checked="selectedExecuteSelected"
                           @update:checked="toggleExecuteSelected"
                        />
                        <span />
                     </div>
                  </section>

                  <section class="space-y-3">
                     <h3 class="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {{ t('database.resultsTable') }}
                     </h3>
                     <div class="grid grid-cols-[200px_240px_1fr] items-center gap-3">
                        <Label class="!text-[13px]">{{ t('application.defaultCopyType') }}</Label>
                        <BaseSelect
                           v-model="defaultCopyType"
                           :options="copyTypes"
                           option-track-by="code"
                           option-label="name"
                           @change="changeDefaultCopyType(defaultCopyType)"
                        />
                        <span />
                     </div>
                  </section>
               </TabsContent>

               <TabsContent value="themes" class="!mt-0 space-y-6">
                  <section class="space-y-3">
                     <h3 class="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {{ t('application.applicationTheme') }}
                     </h3>
                     <!--
                        Theme picker. 2-col grid with the chosen theme
                        getting a primary-colored ring. Click toggles the
                        store value; CSS scope class on #wrapper drives
                        spectre + Tailwind variables together.
                     -->
                     <div class="grid grid-cols-2 gap-3">
                        <button
                           type="button"
                           class="group relative aspect-video rounded-lg overflow-hidden cursor-pointer focus:outline-none transition-all"
                           :class="applicationTheme === 'dark' ? 'ring-2 ring-primary' : 'ring-1 ring-border hover:ring-primary/60'"
                           @click="changeApplicationTheme('dark')"
                        >
                           <img :src="darkPreview" class="w-full h-full object-cover">
                           <div class="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/30">
                              <BaseIcon icon-name="mdiMoonWaningCrescent" :size="40" />
                              <div class="text-sm font-semibold mt-2">
                                 {{ t('application.dark') }}
                              </div>
                           </div>
                        </button>
                        <button
                           type="button"
                           class="group relative aspect-video rounded-lg overflow-hidden cursor-pointer focus:outline-none transition-all"
                           :class="applicationTheme === 'light' ? 'ring-2 ring-primary' : 'ring-1 ring-border hover:ring-primary/60'"
                           @click="changeApplicationTheme('light')"
                        >
                           <img :src="lightPreview" class="w-full h-full object-cover">
                           <div class="absolute inset-0 flex flex-col items-center justify-center text-black bg-white/30">
                              <BaseIcon icon-name="mdiWhiteBalanceSunny" :size="40" />
                              <div class="text-sm font-semibold mt-2">
                                 {{ t('application.light') }}
                              </div>
                           </div>
                        </button>
                     </div>
                  </section>

                  <section class="space-y-3">
                     <h3 class="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {{ t('application.editorTheme') }}
                     </h3>
                     <div class="grid grid-cols-[1fr_1fr] gap-3 items-center">
                        <BaseSelect
                           v-model="localEditorTheme"
                           :options="editorThemes"
                           option-label="name"
                           option-track-by="code"
                           group-label="group"
                           group-values="themes"
                           @change="changeEditorTheme(localEditorTheme)"
                        />
                        <!--
                           Editor font-size picker. Six segmented buttons
                           act as a single-select. Active one is filled
                           default variant; others are outline.
                        -->
                        <div class="flex">
                           <Button
                              v-for="(size, idx) in fontSizes"
                              :key="size.code"
                              :variant="editorFontSize === size.code ? 'default' : 'outline'"
                              size="sm"
                              class="!h-[28px] !px-2 !text-xs !rounded-none"
                              :class="[
                                 idx === 0 ? '!rounded-l-md' : '',
                                 idx === fontSizes.length - 1 ? '!rounded-r-md' : '',
                                 idx > 0 ? '-ml-px' : ''
                              ]"
                              @click="changeEditorFontSize(size.code)"
                           >
                              {{ size.label }}
                           </Button>
                        </div>
                     </div>
                     <BaseTextEditor
                        :model-value="exampleQuery"
                        mode="sql"
                        :workspace="workspace"
                        :read-only="true"
                        :height="270"
                     />
                  </section>
               </TabsContent>

               <TabsContent value="shortcuts" class="!mt-0">
                  <ModalSettingsShortcuts />
               </TabsContent>
               <TabsContent value="data" class="!mt-0">
                  <ModalSettingsData />
               </TabsContent>
               <TabsContent value="update" class="!mt-0">
                  <ModalSettingsUpdate />
               </TabsContent>
               <TabsContent value="changelog" class="!mt-0">
                  <ModalSettingsChangelog />
               </TabsContent>

               <TabsContent value="about" class="!mt-0">
                  <div class="text-center space-y-3 py-8">
                     <img
                        :src="appLogo"
                        width="96"
                        class="mx-auto"
                     >
                     <h4 class="text-[18px] font-semibold">
                        {{ appName }}
                     </h4>
                     <p class="text-[13px] space-y-1">
                        {{ t('general.version') }} {{ appVersion }}<br>
                        <span class="inline-flex items-center gap-2 mt-2">
                           <a
                              class="inline-flex items-center gap-1 cursor-pointer hover:text-primary"
                              @click="openOutside('https://github.com/TW199501/Antares2')"
                           >
                              <BaseIcon icon-name="mdiGithub" :size="16" /> GitHub
                           </a>
                        </span>
                     </p>
                     <div class="space-y-1">
                        <small class="block text-[11px] uppercase text-muted-foreground">{{ t('general.contributors') }}:</small>
                        <div class="text-xs">
                           <small v-for="(contributor, i) in otherContributors" :key="i">{{ i !== 0 ? ', ' : '' }}{{ contributor }}</small>
                        </div>
                        <small class="block text-[11px] text-muted-foreground">{{ t('application.madeWithJS') }}</small>
                     </div>
                  </div>
               </TabsContent>
            </div>
         </Tabs>
      </DialogContent>
   </Dialog>
</template>

<script setup lang="ts">
import { open } from '@tauri-apps/plugin-shell';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import BaseTextEditor from '@/components/BaseTextEditor.vue';
import ModalSettingsChangelog from '@/components/ModalSettingsChangelog.vue';
import ModalSettingsData from '@/components/ModalSettingsData.vue';
import ModalSettingsShortcuts from '@/components/ModalSettingsShortcuts.vue';
import ModalSettingsUpdate from '@/components/ModalSettingsUpdate.vue';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AvailableLocale } from '@/i18n';
import { localesNames } from '@/i18n/supported-locales';
import { useApplicationStore } from '@/stores/application';
import { type EditorFontSize, useSettingsStore } from '@/stores/settings';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const applicationStore = useApplicationStore();
const settingsStore = useSettingsStore();
const workspacesStore = useWorkspacesStore();

const {
   selectedSettingTab,
   updateStatus
} = storeToRefs(applicationStore);
const {
   locale: selectedLocale,
   dataTabLimit: pageSize,
   autoComplete: selectedAutoComplete,
   lineWrap: selectedLineWrap,
   executeSelected: selectedExecuteSelected,
   defaultCopyType: selectedCopyType,
   notificationsTimeout,
   restoreTabs,
   showTableSize,
   disableBlur,
   applicationTheme,
   editorTheme,
   editorFontSize,
   tableAutoRefreshInterval: tableAutoRefreshIntervalFromStore
} = storeToRefs(settingsStore);

const { getSelected: selectedWorkspace } = storeToRefs(workspacesStore);

const {
   changeLocale,
   changePageSize,
   changeRestoreTabs,
   changeDisableBlur,
   changeAutoComplete,
   changeLineWrap,
   changeExecuteSelected,
   changeApplicationTheme,
   changeEditorTheme,
   changeEditorFontSize,
   updateNotificationsTimeout,
   changeDefaultCopyType,
   changeShowTableSize,
   changeTableAutoRefreshInterval
} = settingsStore;
const {
   hideSettingModal: closeModal,
   appName,
   appVersion
} = applicationStore;
const { getWorkspace } = workspacesStore;

const pageSizes = [30, 40, 100, 250, 500, 1000];
const contributors = import.meta.env?.VITE_APP_CONTRIBUTORS || '';
const appLogo = new URL('../images/logo.png', import.meta.url).href;
const darkPreview = new URL('../images/dark.png', import.meta.url).href;
const lightPreview = new URL('../images/light.png', import.meta.url).href;
const exampleQuery = `-- This is an example
SELECT
    employee.id,
    employee.first_name,
    employee.last_name,
    SUM(DATEDIFF("SECOND", call.start, call.end)) AS call_duration
FROM call
INNER JOIN employee ON call.employee_id = employee.id
GROUP BY
    employee.id,
    employee.first_name,
    employee.last_name
ORDER BY
    employee.id ASC;
`;

const localLocale: Ref<AvailableLocale> = ref(null);
const defaultCopyType: Ref<string> = ref(null);
const localPageSize: Ref<number> = ref(null);
const localTimeout: Ref<number> = ref(null);
const localEditorTheme: Ref<string> = ref(null);
const localTableAutoRefreshInterval: Ref<number> = ref(null);
const selectedTab: Ref<string> = ref('general');

const fontSizes: Array<{ code: EditorFontSize; label: string }> = [
   { code: 'xsmall', label: '10px' },
   { code: 'small', label: '12px' },
   { code: 'medium', label: '14px' },
   { code: 'large', label: '16px' },
   { code: 'xlarge', label: '18px' },
   { code: 'xxlarge', label: '20px' }
];

const editorThemes = computed(() => [
   {
      group: t('application.light'),
      themes: [
         { code: 'chrome', name: 'Chrome' },
         { code: 'clouds', name: 'Clouds' },
         { code: 'crimson_editor', name: 'Crimson Editor' },
         { code: 'dawn', name: 'Dawn' },
         { code: 'dreamweaver', name: 'Dreamweaver' },
         { code: 'eclupse', name: 'Eclipse' },
         { code: 'github', name: 'GitHub' },
         { code: 'iplastic', name: 'IPlastic' },
         { code: 'solarized_light', name: 'Solarized Light' },
         { code: 'textmate', name: 'TextMate' },
         { code: 'tomorrow', name: 'Tomorrow' },
         { code: 'xcode', name: 'Xcode' },
         { code: 'kuroir', name: 'Kuroir' },
         { code: 'katzenmilch', name: 'KatzenMilch' },
         { code: 'sqlserver', name: 'SQL Server' }
      ]
   },
   {
      group: t('application.dark'),
      themes: [
         { code: 'ambiance', name: 'Ambiance' },
         { code: 'chaos', name: 'Chaos' },
         { code: 'clouds_midnight', name: 'Clouds Midnight' },
         { code: 'dracula', name: 'Dracula' },
         { code: 'cobalt', name: 'Cobalt' },
         { code: 'gruvbox', name: 'Gruvbox' },
         { code: 'gob', name: 'Green on Black' },
         { code: 'idle_fingers', name: 'Idle Fingers' },
         { code: 'kr_theme', name: 'krTheme' },
         { code: 'merbivore', name: 'Merbivore' },
         { code: 'mono_industrial', name: 'Mono Industrial' },
         { code: 'monokai', name: 'Monokai' },
         { code: 'nord_dark', name: 'Nord Dark' },
         { code: 'pastel_on_dark', name: 'Pastel on Dark' },
         { code: 'solarized_dark', name: 'Solarized Dark' },
         { code: 'terminal', name: 'Terminal' },
         { code: 'tomorrow_night', name: 'Tomorrow Night' },
         { code: 'tomorrow_night_blue', name: 'Tomorrow Night Blue' },
         { code: 'tomorrow_night_bright', name: 'Tomorrow Night Bright' },
         { code: 'tomorrow_night_eighties', name: 'Tomorrow Night 80s' },
         { code: 'twilight', name: 'Twilight' },
         { code: 'vibrant_ink', name: 'Vibrant Ink' }
      ]
   }
]);

const locales = computed(() => {
   const locales = [];
   for (const locale of Object.keys(localesNames))
      locales.push({ code: locale, name: localesNames[locale] });

   return locales.sort((a, b) => (a.name.localeCompare(b.name)));
});

const copyTypes = computed(() => [
   { code: 'cell', name: t('database.cell') },
   { code: 'html', name: t('database.table') },
   { code: 'json', name: 'JSON' },
   { code: 'csv', name: 'CSV' },
   { code: 'sql', name: 'SQL insert' }
]);

const hasUpdates = computed(() => ['available', 'downloading', 'downloaded', 'link'].includes(updateStatus.value));

const workspace = computed(() => {
   return getWorkspace(selectedWorkspace.value);
});

const otherContributors = computed(() => {
   return contributors
      .split(',')
      .sort((a, b) => a.toLowerCase().trim().localeCompare(b.toLowerCase()));
});

const openOutside = async (link: string) => {
   await open(link);
};

const checkNotificationsTimeout = () => {
   if (!localTimeout.value)
      localTimeout.value = 10;

   updateNotificationsTimeout(+localTimeout.value);
};

const onKey = (e: KeyboardEvent) => {
   e.stopPropagation();
   if (e.key === 'Escape')
      closeModal();
};

const toggleRestoreSession = () => {
   changeRestoreTabs(!restoreTabs.value);
};

const toggleShowTableSize = () => {
   changeShowTableSize(!showTableSize.value);
};

const toggleDisableBlur = () => {
   changeDisableBlur(!disableBlur.value);
};

const toggleAutoComplete = () => {
   changeAutoComplete(!selectedAutoComplete.value);
};

const toggleLineWrap = () => {
   changeLineWrap(!selectedLineWrap.value);
};

const toggleExecuteSelected = () => {
   changeExecuteSelected(!selectedExecuteSelected.value);
};

const onChangeAutoRefresh = () => {
   changeTableAutoRefreshInterval(+localTableAutoRefreshInterval.value || 0);
};

localLocale.value = selectedLocale.value;
defaultCopyType.value = selectedCopyType.value;
localPageSize.value = pageSize.value as number;
localTimeout.value = notificationsTimeout.value as number;
localEditorTheme.value = editorTheme.value as string;
localTableAutoRefreshInterval.value = tableAutoRefreshIntervalFromStore.value as number;
selectedTab.value = selectedSettingTab.value;
window.addEventListener('keydown', onKey);

onBeforeUnmount(() => {
   window.removeEventListener('keydown', onKey);
});
</script>
