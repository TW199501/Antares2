<template>
   <!--
      Shortcut manager — used as a tab inside ModalSettings (NOT a modal of
      its own at the top-level template). Renders a header toolbar (Add /
      Restore-defaults) above a list of shortcut rows. Each row is a 3-col
      grid: event label / parsed key combo / row-hover edit+delete buttons.

      Three nested ConfirmModals (Add / Edit / Delete / RestoreDefaults) reuse
      the migrated BaseConfirmModal Dialog shell. KeyPressDetector itself is
      OUT of scope (Batch 9) and is kept untouched inside the Add/Edit modals.
   -->
   <div class="relative">
      <div class="flex justify-end gap-2 px-2 pb-3">
         <Button
            variant="outline"
            size="sm"
            class="!h-[32px] gap-1 !text-[13px]"
            @click="showAddModal"
         >
            <BaseIcon icon-name="mdiPlus" :size="18" />
            <span>{{ t('application.addShortcut') }}</span>
         </Button>
         <Button
            variant="outline"
            size="sm"
            class="!h-[32px] gap-1 !text-[13px]"
            @click="isConfirmRestoreModal = true"
         >
            <BaseIcon icon-name="mdiUndo" :size="18" />
            <span>{{ t('application.restoreDefaults') }}</span>
         </Button>
      </div>
      <!--
         Shortcut list. Header sits in a sticky-ish bar above the rows;
         each row uses its own grid so columns line up regardless of the
         parsed key markup width (parseKeys returns kbd-tagged HTML).
      -->
      <div class="container">
         <div class="grid grid-cols-[200px_1fr_180px] gap-2 px-3 py-2 border-b border-border/60 bg-muted/30 text-xs font-semibold uppercase tracking-wide">
            <div>{{ t('application.event') }}</div>
            <div>{{ t('application.key', 2) }}</div>
            <div />
         </div>
         <div class="divide-y divide-border/40">
            <div
               v-for="(shortcut, i) in shortcuts"
               :key="i"
               class="group grid grid-cols-[200px_1fr_180px] items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-muted/40"
               tabindex="0"
            >
               <div class="truncate">
                  {{ t(shortcutEvents[shortcut.event].i18n, {param: shortcutEvents[shortcut.event].i18nParam}) }}
               </div>
               <div v-html="parseKeys(shortcut.keys)" />
               <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                     variant="ghost"
                     size="sm"
                     class="!h-6 !px-1.5 !text-xs gap-1"
                     @click="showEditModal({...shortcut, index: i})"
                  >
                     <span>{{ t('general.edit') }}</span>
                     <BaseIcon icon-name="mdiPencil" :size="14" />
                  </Button>
                  <Button
                     variant="ghost"
                     size="sm"
                     class="!h-6 !px-1.5 !text-xs gap-1"
                     @click="showDeleteModal(shortcut)"
                  >
                     <span>{{ t('general.delete') }}</span>
                     <BaseIcon icon-name="mdiDeleteOutline" :size="14" />
                  </Button>
               </div>
            </div>
         </div>
      </div>
   </div>

   <ConfirmModal
      v-if="isConfirmAddModal"
      :disable-autofocus="true"
      :confirm-text="t('general.save')"
      :close-on-confirm="false"
      @confirm="addShortcut"
      @hide="closeAddModal"
   >
      <template #header>
         <div class="flex items-center gap-1">
            <BaseIcon icon-name="mdiPlus" :size="20" />
            <span>{{ t('application.addShortcut') }}</span>
         </div>
      </template>
      <template #body>
         <div class="space-y-3">
            <div class="space-y-1.5">
               <Label class="!text-[13px] font-medium">{{ t('application.event') }}</Label>
               <BaseSelect
                  v-model="shortcutToAdd.event"
                  :options="eventOptions"
               />
            </div>
            <div class="space-y-1.5">
               <Label class="!text-[13px] font-medium">{{ t('application.key', 2) }}</Label>
               <KeyPressDetector v-model="typedShortcut" />
            </div>
            <small v-if="doesShortcutExists" class="text-xs text-yellow-600 dark:text-yellow-400">{{ t('application.shortcutAlreadyExists') }}</small>
         </div>
      </template>
   </ConfirmModal>

   <ConfirmModal
      v-if="isConfirmEditModal"
      :disable-autofocus="true"
      :confirm-text="t('general.save')"
      :close-on-confirm="false"
      @confirm="editShortcut"
      @hide="closeEditModal"
   >
      <template #header>
         <div class="flex items-center gap-1">
            <BaseIcon icon-name="mdiPencil" :size="20" />
            <span>{{ t('application.editShortcut') }}</span>
         </div>
      </template>
      <template #body>
         <div class="space-y-3">
            <div class="space-y-1.5">
               <Label class="!text-[13px] font-medium">{{ t('application.event') }}</Label>
               <BaseSelect
                  v-model="shortcutToEdit.event"
                  :options="eventOptions"
                  :disabled="true"
               />
            </div>
            <div class="space-y-1.5">
               <Label class="!text-[13px] font-medium">{{ t('application.key', 2) }}</Label>
               <KeyPressDetector v-model="shortcutToEdit.keys[0]" />
            </div>
            <small v-if="doesShortcutExists" class="text-xs text-yellow-600 dark:text-yellow-400">{{ t('application.shortcutAlreadyExists') }}</small>
         </div>
      </template>
   </ConfirmModal>

   <ConfirmModal
      v-if="isConfirmDeleteModal"
      :disable-autofocus="true"
      @confirm="deleteShortcut"
      @hide="isConfirmDeleteModal = false"
   >
      <template #header>
         <div class="flex items-center gap-1">
            <BaseIcon icon-name="mdiDelete" :size="20" />
            <span>{{ t('application.deleteShortcut') }}</span>
         </div>
      </template>
      <template #body>
         <div class="text-[13px]">
            {{ t('general.deleteConfirm') }} <b>{{ t(shortcutEvents[shortcutToDelete.event].i18n, {param: shortcutEvents[shortcutToDelete.event].i18nParam}) }} (<span v-html="parseKeys(shortcutToDelete.keys)" />)</b>?
         </div>
      </template>
   </ConfirmModal>

   <ConfirmModal
      v-if="isConfirmRestoreModal"
      :disable-autofocus="true"
      @confirm="restoreDefaults"
      @hide="isConfirmRestoreModal = false"
   >
      <template #header>
         <div class="flex items-center gap-1">
            <BaseIcon icon-name="mdiUndo" :size="20" />
            <span>{{ t('application.restoreDefaults') }}</span>
         </div>
      </template>
      <template #body>
         <div class="text-[13px]">
            {{ t('application.restoreDefaultsQuestion') }}
         </div>
      </template>
   </ConfirmModal>
</template>
<script setup lang="ts">
import { shortcutEvents, ShortcutRecord } from 'common/shortcuts';
import { storeToRefs } from 'pinia';
import { computed, Ref, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '@/components/BaseConfirmModal.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useFilters } from '@/composables/useFilters';
import Application from '@/ipc-api/Application';
import { useSettingsStore } from '@/stores/settings';

import KeyPressDetector from './KeyPressDetector.vue';

const { parseKeys } = useFilters();

const { t } = useI18n();

// Platform detection using browser-compatible navigator API
const isMacOS = navigator.platform.startsWith('Mac');
// Derive platform string for shortcut records
const currentPlatform = isMacOS ? 'darwin' : (navigator.platform.startsWith('Win') ? 'win32' : 'linux');

const isConfirmRestoreModal = ref(false);
const isConfirmAddModal = ref(false);
const isConfirmEditModal = ref(false);
const isConfirmDeleteModal = ref(false);
const doesShortcutExists = ref(false);
const shortcutToAdd: Ref<ShortcutRecord> = ref({ event: undefined, keys: [], os: [currentPlatform] });
const shortcutToEdit: Ref<ShortcutRecord & { index: number }> = ref(null);
const shortcutToDelete: Ref<ShortcutRecord> = ref(null);
const typedShortcut = ref('');

const settingsStore = useSettingsStore();
const { shortcuts } = storeToRefs(settingsStore);

const eventOptions = computed(() => {
   return Object.keys(shortcutEvents)
      .map(key => {
         return { value: key, label: t(shortcutEvents[key].i18n, { param: shortcutEvents[key].i18nParam }) };
      })
      .sort((a, b) => {
         if (a.label < b.label) return -1;
         if (a.label > b.label) return 1;
         return 0;
      });
});

const restoreDefaults = () => {
   isConfirmRestoreModal.value = false;
   return Application.restoreDefaultShortcuts();
};

const showAddModal = () => {
   shortcutToAdd.value.event = eventOptions.value[0].value;
   isConfirmAddModal.value = true;
};

const closeAddModal = () => {
   typedShortcut.value = '';
   doesShortcutExists.value = false;
   shortcutToAdd.value = { event: undefined, keys: [], os: [currentPlatform] };
   isConfirmAddModal.value = false;
};

const showEditModal = (shortcut: ShortcutRecord & { index: number }) => {
   shortcut = {
      ...shortcut,
      keys: [shortcut.keys[0].replaceAll('CommandOrControl', isMacOS ? 'Command' : 'Control')]
   };
   shortcutToEdit.value = shortcut;
   isConfirmEditModal.value = true;
};

const editShortcut = () => {
   const index = shortcutToEdit.value.index;
   delete shortcutToEdit.value.index;
   shortcutToEdit.value.index = undefined;

   shortcuts.value[index] = shortcutToEdit.value;

   isConfirmEditModal.value = false;
   return Application.updateShortcuts(shortcuts.value);
};

const closeEditModal = () => {
   typedShortcut.value = '';
   doesShortcutExists.value = false;
   shortcutToEdit.value = null;
   isConfirmEditModal.value = false;
};

const addShortcut = () => {
   if (!typedShortcut.value.length || doesShortcutExists.value) return;
   shortcutToAdd.value.keys = [typedShortcut.value.replaceAll(isMacOS ? 'Command' : 'Control', 'CommandOrControl')];
   const filteredShortcuts = [shortcutToAdd.value, ...shortcuts.value];

   isConfirmAddModal.value = false;
   return Application.updateShortcuts(filteredShortcuts);
};

const showDeleteModal = (shortcut: ShortcutRecord) => {
   isConfirmDeleteModal.value = true;
   shortcutToDelete.value = shortcut;
};

const deleteShortcut = () => {
   const filteredShortcuts = shortcuts.value.filter(s => (
      shortcutToDelete.value.keys.toString() !== s.keys.toString()
   ));

   isConfirmDeleteModal.value = false;
   return Application.updateShortcuts(filteredShortcuts);
};

watch(typedShortcut, () => {
   doesShortcutExists.value = shortcuts.value.some(s => (
      s.keys.some(k => (
         k.replaceAll('CommandOrControl', isMacOS ? 'Command' : 'Control') === typedShortcut.value
      ))
   ));
});
</script>
