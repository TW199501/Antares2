<template>
   <div class="relative m-0">
      <Input
         class="!pr-8 overflow-hidden text-ellipsis [caret-color:transparent]"
         type="text"
         :model-value="pressedKeys"
         :placeholder="t('application.registerAShortcut')"
         @focus="isFocus = true"
         @blur="isFocus = false"
         @keydown.prevent.stop="onKey"
      />
      <BaseIcon
         icon-name="mdiKeyboardOutline"
         class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"
         :size="20"
      />
   </div>
</template>
<script setup lang="ts">
import { computed, PropType, Ref, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import { Input } from '@/components/ui/input';
import Application from '@/ipc-api/Application';

const { t } = useI18n();

const emit = defineEmits<{
   'update:modelValue': [value: string];
}>();

// Platform detection using browser-compatible navigator API
const isMacOS = navigator.platform.startsWith('Mac');

const props = defineProps({
   // Shortcut is represented as a plain string in renderer.
   modelValue: String as PropType<string>
});

const isFocus = ref(false);
const keyboardEvent: Ref<KeyboardEvent> = ref(null);

const pressedKeys = computed(() => {
   const keys: string[] = [];
   const singleKeysToIgnore = ['Dead', 'Backspace', 'ArrotLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
   const specialKeys = ['Control', 'Alt', 'AltGraph', 'Shift', 'Meta', 'CapsLock', 'ContextMenu', 'Escape'];
   const keysFromCode = ['Space', 'Minus', 'Equal', 'Slash', 'Quote', 'Semicolon', 'Comma', 'Period', 'Backslash', 'BracketLeft', 'BracketRight'];

   if (props.modelValue && !keyboardEvent.value)
      return props.modelValue;
   else if (keyboardEvent.value) {
      if (keyboardEvent.value.altKey)
         keys.push('Alt');
      if (keyboardEvent.value.ctrlKey)
         keys.push('Control');
      if (keyboardEvent.value.metaKey && isMacOS)
         keys.push('Command');
      if (keyboardEvent.value.shiftKey && keys.length)
         keys.push('Shift');
      if (keyboardEvent.value.code) {
         if (keys.length === 0 && (keyboardEvent.value.key.length === 1 || singleKeysToIgnore.includes(keyboardEvent.value.key)))
            return t('application.invalidShortcutMessage');
         else if (!specialKeys.includes(keyboardEvent.value.key)) {
            if (keyboardEvent.value.key === 'Dead') {
               keys.push(keyboardEvent.value.code
                  .replace('Digit', '')
                  .replace('Key', '')
                  .replace('Quote', '\'')
                  .replace('Backquote', '`'));
            }
            else if (keysFromCode.includes(keyboardEvent.value.code) || keyboardEvent.value.code.includes('Digit')) {
               keys.push(keyboardEvent.value.code
                  .replace('Quote', '\'')
                  .replace('Semicolon', ';')
                  .replace('Slash', '/')
                  .replace('Backslash', '\\')
                  .replace('BracketLeft', '[')
                  .replace('BracketRight', ']')
                  .replace('Comma', ',')
                  .replace('Period', '.')
                  .replace('Minus', '-')
                  .replace('Equal', '=')
                  .replace('Digit', '')
                  .replace('Key', ''));
            }
            else {
               keys.push(keyboardEvent.value.key.length === 1
                  ? keyboardEvent.value.key.toUpperCase()
                  : keyboardEvent.value.key
                     .replace('Arrow', '')
               );
            }
         }
         else
            return t('application.invalidShortcutMessage');
      }
   }

   return keys.join('+');
});

const onKey = (e: KeyboardEvent) => {
   e.stopPropagation();
   e.preventDefault();
   keyboardEvent.value = e;
};

watch(pressedKeys, (value) => {
   if (value !== t('application.invalidShortcutMessage'))
      emit('update:modelValue', pressedKeys.value);
});

watch(isFocus, (val) => {
   if (val)
      Application.unregisterShortcuts();
   else
      Application.reloadShortcuts();
});
</script>
