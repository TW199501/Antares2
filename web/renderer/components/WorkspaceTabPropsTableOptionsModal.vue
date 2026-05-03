<template>
   <ConfirmModal
      :confirm-text="t('general.confirm')"
      size="medium"
      @confirm="applyChanges"
      @hide="$emit('hide')"
   >
      <template #header>
         <div class="flex items-center">
            <BaseIcon
               class="mr-1"
               icon-name="mdiTableEdit"
               :size="22"
            />
            <span class="cut-text">
               {{ t('database.editTableOptions') }} "{{ table }}"
            </span>
         </div>
      </template>
      <template #body>
         <div class="flex flex-col gap-3 px-1 py-2">
            <!-- 表名 (table name) -->
            <div class="flex flex-col gap-1">
               <Label class="!text-sm !text-muted-foreground !font-normal !m-0">
                  {{ t('general.name') }}
               </Label>
               <Input
                  v-model="local.name"
                  type="text"
                  class="!h-[32px] !text-sm"
               />
            </div>
            <!-- 描述 (table comment / description) -->
            <div v-if="customizations.comment" class="flex flex-col gap-1">
               <Label class="!text-sm !text-muted-foreground !font-normal !m-0">
                  {{ t('database.comment') }}
               </Label>
               <Input
                  v-model="local.comment"
                  type="text"
                  :placeholder="t('database.commentPlaceholder')"
                  class="!h-[32px] !text-sm"
               />
            </div>
            <!-- AutoIncrement -->
            <div v-if="customizations.autoIncrement" class="flex flex-col gap-1">
               <Label class="!text-sm !text-muted-foreground !font-normal !m-0">
                  {{ t('database.autoIncrement') }}
               </Label>
               <Input
                  v-model="local.autoIncrement"
                  type="number"
                  :disabled="local.autoIncrement === null || local.autoIncrement === undefined"
                  class="!h-[32px] !text-sm"
               />
            </div>
            <!-- Engine (MySQL) -->
            <div v-if="customizations.engines" class="flex flex-col gap-1">
               <Label class="!text-sm !text-muted-foreground !font-normal !m-0">
                  {{ t('database.engine') }}
               </Label>
               <BaseSelect
                  v-model="local.engine"
                  :options="engines"
                  option-label="name"
                  option-track-by="name"
                  class="!h-[32px] !text-sm"
               />
            </div>
            <!-- Collation: read-only (set elsewhere, just shown for context) -->
            <div v-if="customizations.collations" class="flex flex-col gap-1">
               <Label class="!text-sm !text-muted-foreground !font-normal !m-0 flex items-center gap-1.5">
                  {{ t('database.collation') }}
                  <span class="text-xs text-muted-foreground/70">({{ t('general.readOnly') }})</span>
               </Label>
               <Input
                  :model-value="local.collation || t('database.inheritFromTable')"
                  type="text"
                  readonly
                  class="!h-[32px] !text-sm bg-muted/40 cursor-not-allowed"
               />
            </div>
         </div>
      </template>
   </ConfirmModal>
</template>

<script setup lang="ts">
import { PropType, reactive } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '@/components/BaseConfirmModal.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TableOptions {
   name: string;
   comment?: string;
   autoIncrement?: number | null;
   engine?: string;
   collation?: string;
   charset?: string;
}

const { t } = useI18n();

const props = defineProps({
   options: { type: Object as PropType<TableOptions>, required: true },
   table: { type: String, default: '' },
   customizations: { type: Object, default: () => ({}) },
   engines: { type: Array, default: () => [] }
});

const emit = defineEmits<{
   'confirm': [payload: TableOptions];
   'hide': [];
}>();

// Snapshot pattern: edit on a local reactive copy, emit on confirm so the
// parent can decide whether to assign back to localOptions. Cancel = no
// emission, parent's localOptions stays at pre-modal state.
const local = reactive<TableOptions>({ ...props.options });

const applyChanges = () => {
   emit('confirm', { ...local });
};
</script>
