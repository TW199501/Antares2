<template>
   <BaseContextMenu
      :context-event="contextEvent"
      @close-context="closeContext"
   >
      <div class="context-element">
         <span class="flex items-center gap-1.5 text-foreground">
            <BaseIcon
               icon-name="mdiKeyPlus"
               :size="18"
            />
            {{ t('database.createNewIndex') }}
         </span>
         <BaseIcon
            icon-name="mdiChevronRight"
            :size="18"
         />
         <div class="context-submenu">
            <div
               v-for="index in indexTypes"
               :key="index"
               class="context-element"
               :class="{'disabled': index === 'PRIMARY' && hasPrimary}"
               @click="addNewIndex(index)"
            >
               <span class="flex items-center gap-1.5 text-foreground">
                  <BaseIcon
                     class="column-key pr-1"
                     :class="`key-${index}`"
                     icon-name="mdiKey"
                     :rotate="45"
                     :size="20"
                  />
                  {{ index }}
               </span>
            </div>
         </div>
      </div>
      <div v-if="indexes.length" class="context-element">
         <span class="flex items-center gap-1.5 text-foreground">
            <BaseIcon
               icon-name="mdiKeyArrowRight"
               :size="18"
            />
            {{ t('database.addToIndex') }}
         </span>
         <BaseIcon
            icon-name="mdiChevronRight"
            :size="18"
         />
         <div class="context-submenu">
            <div
               v-for="index in indexes"
               :key="index.name"
               class="context-element"
               :class="{'disabled': index.fields.includes(selectedField.name)}"
               @click="addToIndex(index._antares_id)"
            >
               <span class="flex items-center gap-1.5 text-foreground">
                  <BaseIcon
                     class="column-key pr-1"
                     :class="`key-${index.type}`"
                     icon-name="mdiKey"
                     :rotate="45"
                     :size="20"
                  />
                  {{ index.name }}
               </span>
            </div>
         </div>
      </div>
      <div class="context-element" @click="duplicateField">
         <span class="flex items-center gap-1.5 text-foreground">
            <BaseIcon
               icon-name="mdiContentDuplicate"
               :size="18"
            />
            {{ t('general.duplicate') }}
         </span>
      </div>
      <div class="context-element" @click="deleteField">
         <span class="flex items-center gap-1.5 text-destructive">
            <BaseIcon
               icon-name="mdiDelete"
               :size="18"
            />
            {{ t('database.deleteField') }}
         </span>
      </div>
   </BaseContextMenu>
</template>

<script setup lang="ts">
import { TableIndex } from 'common/interfaces/antares';
import { computed, Prop } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseContextMenu from '@/components/BaseContextMenu.vue';
import BaseIcon from '@/components/BaseIcon.vue';

const { t } = useI18n();

const props = defineProps({
   contextEvent: MouseEvent,
   indexes: Array as Prop<TableIndex[]>,
   indexTypes: Array as Prop<string[]>,
   selectedField: Object
});

const emit = defineEmits<{
   'close-context': [];
   'duplicate-selected': [];
   'delete-selected': [];
   'add-new-index': [payload: { field: string; index: string }];
   'add-to-index': [payload: { field: string; index: string }];
}>();

const hasPrimary = computed(() => props.indexes.some(index => index.type === 'PRIMARY'));

const closeContext = () => {
   emit('close-context');
};

const duplicateField = () => {
   emit('duplicate-selected');
   closeContext();
};

const deleteField = () => {
   emit('delete-selected');
   closeContext();
};

const addNewIndex = (index: string) => {
   emit('add-new-index', { field: props.selectedField.name, index });
   closeContext();
};

const addToIndex = (index: string) => {
   emit('add-to-index', { field: props.selectedField.name, index });
   closeContext();
};
</script>
