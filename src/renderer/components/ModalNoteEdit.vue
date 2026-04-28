<template>
   <ConfirmModal
      size="resize"
      :disable-autofocus="true"
      :close-on-confirm="!!localNote.note.length"
      :confirm-text="t('general.save')"
      @confirm="updateNote"
      @hide="$emit('hide')"
   >
      <template #header>
         <div class="flex items-center gap-1">
            <BaseIcon icon-name="mdiNoteEditOutline" :size="20" />
            <span>{{ t('application.editNote') }}</span>
         </div>
      </template>
      <template #body>
         <div class="space-y-3">
            <div class="grid grid-cols-3 gap-3">
               <div class="col-span-2 space-y-1.5">
                  <Label>{{ t('connection.connection') }}</Label>
                  <BaseSelect
                     v-model="localNote.cUid"
                     :options="connectionOptions"
                     option-track-by="code"
                     option-label="name"
                     @change="null"
                  />
               </div>
               <div class="col-span-1 space-y-1.5">
                  <Label>{{ t('application.tag') }}</Label>
                  <BaseSelect
                     v-model="localNote.type"
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
                     v-if="localNote.type !== 'query'"
                     class="text-[12px] font-normal text-muted-foreground leading-none"
                  >({{ t('application.markdownSupported') }})</small>
               </Label>
               <BaseTextEditor
                  v-model="localNote.note"
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
import { inject, onBeforeMount, PropType, Ref, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '@/components/BaseConfirmModal.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import BaseTextEditor from '@/components/BaseTextEditor.vue';
import { Label } from '@/components/ui/label';
import { ConnectionNote, TagCode, useScratchpadStore } from '@/stores/scratchpad';

const { t } = useI18n();
const { editNote } = useScratchpadStore();

const emit = defineEmits<{
   'hide': [];
}>();

const props = defineProps({
   note: {
      type: Object as PropType<ConnectionNote>,
      required: true
   }
});

const noteTags = inject<{code: TagCode; name: string}[]>('noteTags');
const connectionOptions = inject<{code: string; name: string}[]>('connectionOptions');

const editorMode = ref('markdown');
const localNote: Ref<ConnectionNote> = ref({
   uid: 'dummy',
   cUid: null,
   title: undefined,
   note: '',
   date: new Date(),
   type: 'note',
   isArchived: false
});

const updateNote = () => {
   if (localNote.value.note) {
      if (!localNote.value.title)// Set a default title
         localNote.value.title = `${localNote.value.type.toLocaleUpperCase()}: ${localNote.value.uid}`;

      localNote.value.date = new Date();
      editNote(localNote.value);
      emit('hide');
   }
};

watch(() => localNote.value.type, () => {
   if (localNote.value.type === 'query')
      editorMode.value = 'sql';
   else
      editorMode.value = 'markdown';
});

onBeforeMount(() => {
   localNote.value = JSON.parse(JSON.stringify(props.note));
});

</script>
