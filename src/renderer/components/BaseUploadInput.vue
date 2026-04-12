<template>
   <label class="file-uploader" @click.prevent="handleClick">
      <span class="file-uploader-message">
         <BaseIcon
            icon-name="mdiFolderOpen"
            class="mr-1 mt-1"
            :size="18"
         />{{ message }}
      </span>
      <span class="text-ellipsis file-uploader-value">
         {{ lastPart(modelValue, 19) }}
      </span>
      <BaseIcon
         v-if="modelValue"
         class="file-upload-icon-clear"
         icon-name="mdiClose"
         :size="18"
         @click.stop="clear"
      />
   </label>
</template>

<script setup lang="ts">
import { open as tauriOpen } from '@tauri-apps/plugin-dialog';

import BaseIcon from '@/components/BaseIcon.vue';
import { useFilters } from '@/composables/useFilters';

const { lastPart } = useFilters();

const props = defineProps({
   message: {
      default: 'Browse',
      type: String
   },
   filters: {
      default: () => [] as { name: string; extensions: string[] }[],
      type: Array as () => { name: string; extensions: string[] }[]
   },
   modelValue: {
      default: '',
      type: String
   }
});

const emit = defineEmits<{
   'select': [path: string];
   'clear': [];
}>();

const handleClick = async () => {
   const result = await tauriOpen({ filters: props.filters });
   if (result && typeof result === 'string')
      emit('select', result);
};

const clear = () => {
   emit('clear');
};
</script>

<style lang="scss" scoped>
.file-uploader {
  border-radius: $border-radius;
  height: 1.8rem;
  line-height: 1.2rem;
  display: flex;
  cursor: pointer;
  transition: background 0.2s, border 0.2s, box-shadow 0.2s, color 0.2s;
  position: relative;
  flex: 1 1 auto;

  .file-upload-icon-clear {
   position: absolute;
   right: 4px;
   top: 8px;
  }

  > span {
    padding: 0.25rem 0.4rem;
  }

  .file-uploader-message {
    display: flex;
    word-break: keep-all;
    border-radius: $border-radius 0 0 $border-radius;
  }

  .file-uploader-value {
    display: block;
    width: 100%;
    padding-right: 1rem;
  }

  .file-uploader-reset {
    z-index: 1;
    position: absolute;
    right: 5px;
    top: calc(50% - 8px);
  }
}

:disabled {
  .file-uploader {
    cursor: not-allowed;
    opacity: 0.5;
  }
}
</style>
