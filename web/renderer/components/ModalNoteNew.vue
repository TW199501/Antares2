<template>
   <ConfirmModal
      size="resize"
      :disable-autofocus="true"
      :close-on-confirm="!!newNote.note.length"
      :confirm-text="t('general.save')"
      @confirm="createNote"
      @hide="$emit('hide')"
   >
      <template #header>
         <div class="flex items-center gap-1">
            <BaseIcon icon-name="mdiNotePlusOutline" :size="20" />
            <span>{{ t('application.addNote') }}</span>
         </div>
      </template>
      <template #body>
         <div class="space-y-3">
            <div class="grid grid-cols-3 gap-3">
               <div class="col-span-2 space-y-1.5">
                  <Label>{{ t('connection.connection') }}</Label>
                  <BaseSelect
                     v-model="newNote.cUid"
                     :options="connectionOptions"
                     option-track-by="code"
                     option-label="name"
                     @change="null"
                  />
               </div>
               <div class="col-span-1 space-y-1.5">
                  <Label>{{ t('application.tag') }}</Label>
                  <BaseSelect
                     v-model="newNote.type"
                     :options="noteTags"
                     option-track-by="code"
                     option-label="name"
                     @change="null"
                  />
               </div>
            </div>
            <div class="space-y-1.5">
               <Label class="flex items-center gap-1.5">
                  {{ t('general.content') }}
                  <small
                     v-if="newNote.type !== 'query'"
                     class="text-xs font-normal text-muted-foreground leading-none"
                  >({{ t('application.markdownSupported') }})</small>
               </Label>
               <BaseTextEditor
                  v-model="newNote.note"
                  :mode="editorMode"
                  :show-line-numbers="false"
                  :auto-focus="true"
                  :height="400"
                  :width="640"
                  :resizable="true"
               />
            </div>
         </div>
      </template>
   </ConfirmModal>
</template>

<script lang="ts" setup>
import { uidGen } from 'common/libs/uidGen';
import { inject, Ref, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '@/components/BaseConfirmModal.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import BaseTextEditor from '@/components/BaseTextEditor.vue';
import { Label } from '@/components/ui/label';
import { ConnectionNote, TagCode, useScratchpadStore } from '@/stores/scratchpad';

const { t } = useI18n();
const { addNote } = useScratchpadStore();

const emit = defineEmits<{
   'hide': [];
}>();

const noteTags = inject<{code: TagCode; name: string}[]>('noteTags');
const selectedConnection = inject<Ref<null | string>>('selectedConnection');
const selectedTag = inject<Ref<TagCode>>('selectedTag');
const connectionOptions = inject<{code: string; name: string}[]>('connectionOptions');

const editorMode = ref('markdown');

const newNote: Ref<ConnectionNote> = ref({
   uid: uidGen('N'),
   cUid: null,
   title: undefined,
   note: '',
   date: new Date(),
   type: 'note',
   isArchived: false
});

const createNote = () => {
   if (newNote.value.note) {
      if (!newNote.value.title)// Set a default title
         newNote.value.title = `${newNote.value.type.toLocaleUpperCase()}: ${newNote.value.uid}`;

      newNote.value.date = new Date();
      addNote(newNote.value);
      emit('hide');
   }
};

watch(() => newNote.value.type, () => {
   if (newNote.value.type === 'query')
      editorMode.value = 'sql';
   else
      editorMode.value = 'markdown';
});

newNote.value.cUid = selectedConnection.value;

if (selectedTag.value !== 'all')
   newNote.value.type = selectedTag.value;

</script>
