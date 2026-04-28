<template>
   <div
      id="footer"
      :class="[lightColors.includes(accentColor) ? 'text-dark' : 'text-light']"
      :style="`background-color: ${accentColor};`"
   >
      <div class="footer-left-elements">
         <ul class="footer-elements">
            <li class="footer-element">
               <BaseIcon
                  icon-name="mdiServer"
                  class="mr-1"
                  :size="18"
               />
               <small>{{ versionString }}</small>
            </li>
            <li v-if="connectionInfos && connectionInfos.readonly" class="footer-element">
               <BaseIcon
                  icon-name="mdiLock"
                  class="mr-1"
                  :size="18"
               />
               <small>{{ t('connection.readOnlyMode') }}</small>
            </li>
            <li v-if="connectionInfos && connectionInfos.ssl" class="footer-element">
               <BaseIcon
                  icon-name="mdiShieldKey"
                  class="mr-1"
                  :size="18"
               />
               <small>SSL</small>
            </li>
            <li v-if="connectionInfos && connectionInfos.ssh" class="footer-element">
               <BaseIcon
                  icon-name="mdiConsoleNetwork"
                  class="mr-1"
                  :size="18"
               />
               <small>SSH</small>
            </li>
         </ul>
      </div>

      <div v-if="activePager" class="footer-center-elements">
         <button
            type="button"
            class="footer-pager-chip"
            :disabled="!activePager.hasPrev"
            :title="t('application.previousResultsPage')"
            @click="activePager.onPrev()"
         >
            <BaseIcon icon-name="mdiSkipPrevious" :size="18" />
         </button>
         <span class="footer-pager-page">{{ activePager.page }}</span>
         <button
            type="button"
            class="footer-pager-chip"
            :disabled="!activePager.hasNext"
            :title="t('application.nextResultsPage')"
            @click="activePager.onNext()"
         >
            <BaseIcon icon-name="mdiSkipNext" :size="18" />
         </button>
         <DropdownMenu>
            <DropdownMenuTrigger as-child>
               <button
                  type="button"
                  class="footer-pager-chip footer-pager-export"
                  :disabled="activePager.isQuering"
                  :title="t('database.export')"
               >
                  <BaseIcon icon-name="mdiFileExport" :size="18" />
                  <span>{{ t('database.export') }}</span>
                  <BaseIcon icon-name="mdiMenuDown" :size="14" />
               </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top">
               <DropdownMenuItem @select="activePager.onExport('json')">
                  JSON
               </DropdownMenuItem>
               <DropdownMenuItem @select="activePager.onExport('csv')">
                  CSV
               </DropdownMenuItem>
               <DropdownMenuItem @select="activePager.onExport('php')">
                  {{ t('application.phpArray') }}
               </DropdownMenuItem>
               <DropdownMenuItem @select="activePager.onExport('sql')">
                  SQL INSERT
               </DropdownMenuItem>
            </DropdownMenuContent>
         </DropdownMenu>
      </div>

      <div class="footer-right-elements">
         <ul class="footer-elements">
            <li class="footer-element footer-link" @click="toggleConsole()">
               <BaseIcon
                  icon-name="mdiConsoleLine"
                  class="mr-1"
                  :size="18"
               />
               <small>{{ t('application.console') }}</small>
            </li>
            <li
               class="footer-element footer-link"
               :title="t('application.reportABug')"
               @click="openOutside('https://github.com/TW199501/Antares2/issues')"
            >
               <BaseIcon icon-name="mdiBug" :size="18" />
            </li>
            <li
               class="footer-element footer-link"
               :title="t('application.about')"
               @click="showSettingModal('about')"
            >
               <BaseIcon icon-name="mdiInformationOutline" :size="18" />
            </li>
         </ul>
      </div>
   </div>
</template>

<script setup lang="ts">
import { open } from '@tauri-apps/plugin-shell';
import { storeToRefs } from 'pinia';
import { computed, ComputedRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { hexToRGBA } from '@/libs/hexToRgba';
import { useApplicationStore } from '@/stores/application';
import { useConnectionsStore } from '@/stores/connections';
import { useConsoleStore } from '@/stores/console';
import { useTablePagerStore } from '@/stores/tablePager';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

interface DatabaseInfos {// TODO: temp
   name: string;
   number: string;
   arch: string;
   os: string;
}

const applicationStore = useApplicationStore();
const workspacesStore = useWorkspacesStore();
const connectionsStore = useConnectionsStore();
const tablePagerStore = useTablePagerStore();

const { activePager } = storeToRefs(tablePagerStore);

const lightColors = ['#FFCE54', '#FDA50F', '#BEBDB8', '#48CFAD'];

const { getSelected: workspaceUid } = storeToRefs(workspacesStore);
const { toggleConsole } = useConsoleStore();

const { showSettingModal } = applicationStore;
const { getWorkspace } = workspacesStore;
const { getConnectionFolder, getConnectionByUid } = connectionsStore;

const workspace = computed(() => getWorkspace(workspaceUid.value));
const accentColor = computed(() => {
   if (getConnectionFolder(workspaceUid.value)?.color)
      return getConnectionFolder(workspaceUid.value).color;
   // Brand primary from pencil-new.pen / tailwind.css --primary. Was legacy
   // Antares orange #E36929 — the old value ignored the design token and
   // drifted every time the brand color changed.
   return '#FF5000';
});
const connectionInfos = computed(() => getConnectionByUid(workspaceUid.value));
const version: ComputedRef<DatabaseInfos> = computed(() => {
   return getWorkspace(workspaceUid.value) ? workspace.value.version : null;
});

const versionString = computed(() => {
   if (version.value)
      return `${version.value.name} ${version.value.number} (${version.value.arch} ${version.value.os})`;
   return '';
});

watch(accentColor, () => {
   changeAccentColor();
});

const openOutside = async (link: string) => open(link);
const changeAccentColor = () => {
   document.querySelector<HTMLBodyElement>(':root').style.setProperty('--primary-color', accentColor.value);
   document.querySelector<HTMLBodyElement>(':root').style.setProperty('--primary-color-shadow', hexToRGBA(accentColor.value, 0.2));
};

changeAccentColor();
</script>

<style lang="scss">
  #footer {
    height: $footer-height;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 0.2rem;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;

    // Force text color to cascade past spectre's body / small defaults.
    // .text-light / .text-dark are set on #footer by accent-color logic.
    &.text-light,
    &.text-light small,
    &.text-light .footer-element {
      color: #fff;
    }

    &.text-dark,
    &.text-dark small,
    &.text-dark .footer-element {
      color: #3b4351;
    }

    .footer-elements {
      list-style: none;
      margin: 0;
      display: flex;
      align-items: center;

      .footer-element {
        height: $footer-height;
        display: flex;
        align-items: center;
        padding: 0 0.4rem;
        margin: 0;

        &.footer-link {
          cursor: pointer;
          transition: background 0.2s;
        }
      }
    }

    // Center block: absolutely centered so it stays mid-footer regardless
    // of how wide the left version string or right console/bug buttons grow.
    .footer-center-elements {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      height: $footer-height;
      display: flex;
      align-items: center;
      gap: 2px;
      font-size: 12px;

      // Darker-primary chip on the lighter primary footer.
      // White icon + text shows clearly without inverting the surface
      // hierarchy. --primary-color-dark is already defined in main.scss
      // as the brand color mixed with 30% black.
      .footer-pager-chip {
        height: 24px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 0 8px;
        background: var(--primary-color-dark);
        border: 0;
        border-radius: 4px;
        color: #fff;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: background 0.15s, opacity 0.15s;

        &:hover:not(:disabled) {
          background: color-mix(in srgb, var(--primary-color), #000 45%);
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        &.footer-pager-export {
          margin-left: 8px;
        }
      }

      .footer-pager-page {
        min-width: 28px;
        text-align: center;
        font-weight: 700;
        padding: 0 8px;
        background: var(--primary-color-dark);
        border-radius: 4px;
        color: #fff;
        height: 24px;
        line-height: 24px;
      }
    }
  }
</style>
