import { shortcuts as defaultShortcuts } from 'common/shortcuts';
import { onMounted, onUnmounted } from 'vue';

import { useSettingsStore } from '@/stores/settings';

/**
 * Translates an Electron Accelerator key token to the equivalent KeyboardEvent.key value.
 */
function acceleratorKeyToEventKey (token: string): string {
   const map: Record<string, string> = {
      Right: 'ArrowRight',
      Left: 'ArrowLeft',
      Up: 'ArrowUp',
      Down: 'ArrowDown',
      Space: ' ',
      PageDown: 'PageDown',
      PageUp: 'PageUp',
      Home: 'Home',
      End: 'End',
      Escape: 'Escape',
      Enter: 'Enter',
      Tab: 'Tab',
      Backspace: 'Backspace',
      Delete: 'Delete'
   };
   if (map[token]) return map[token];
   if (/^F\d+$/.test(token)) return token;
   return token.toLowerCase();
}

interface ParsedShortcut {
   ctrl: boolean;
   alt: boolean;
   shift: boolean;
   key: string;
}

function parseShortcut (keys: string[]): ParsedShortcut | null {
   const raw = keys[0];
   if (!raw) return null;

   const parts = raw.split('+');
   let ctrl = false;
   let alt = false;
   let shift = false;
   let keyToken = '';

   for (const part of parts) {
      if (part === 'CommandOrControl') ctrl = true;
      else if (part === 'Alt') alt = true;
      else if (part === 'Shift') shift = true;
      else keyToken = part;
   }

   if (!keyToken) return null;
   return { ctrl, alt, shift, key: acceleratorKeyToEventKey(keyToken) };
}

function matchesEvent (e: KeyboardEvent, parsed: ParsedShortcut): boolean {
   if (parsed.ctrl !== (e.ctrlKey || e.metaKey)) return false;
   if (parsed.alt !== e.altKey) return false;
   if (parsed.shift !== e.shiftKey) return false;
   return e.key.toLowerCase() === parsed.key.toLowerCase() || e.key === parsed.key;
}

export function useShortcutDispatcher () {
   const settingsStore = useSettingsStore();

   const handleKeydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditable =
         target.tagName === 'INPUT' ||
         target.tagName === 'TEXTAREA' ||
         target.isContentEditable;

      const isAce = target.classList.contains('ace_text-input');

      if (isEditable && !isAce) return;

      const activeShortcuts =
         settingsStore.shortcuts.length > 0
            ? settingsStore.shortcuts
            : defaultShortcuts;

      for (const record of activeShortcuts) {
         const parsed = parseShortcut(record.keys);
         if (!parsed) continue;
         if (matchesEvent(e, parsed)) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent(`antares:${record.event}`));
            return;
         }
      }
   };

   onMounted(() => {
      window.addEventListener('keydown', handleKeydown);
   });

   onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown);
   });
}
