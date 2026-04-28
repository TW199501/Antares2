<template>
   <ConfirmModal
      :confirm-text="t('general.confirm')"
      size="medium"
      class="options-modal"
      @confirm="confirmIndexesChange"
      @hide="$emit('hide')"
   >
      <template #header>
         <div class="flex items-center">
            <BaseIcon
               class="mr-1"
               icon-name="mdiKey"
               :rotate="45"
               :size="24"
            />
            <span class="cut-text">{{ t('database.indexes') }} "{{ table }}"</span>
         </div>
      </template>
      <template #body>
         <div class="grid grid-cols-12 gap-0">
            <div class="col-span-5">
               <div class="flex flex-col" :style="{ height: modalInnerHeight + 'px'}">
                  <div class="flex items-center gap-2 mb-2">
                     <Button
                        variant="secondary"
                        size="sm"
                        class="!h-[28px]"
                        @click="addIndex"
                     >
                        <BaseIcon
                           class="mr-1"
                           icon-name="mdiKeyPlus"
                           :size="18"
                        />
                        <span>{{ t('general.add') }}</span>
                     </Button>
                     <Button
                        variant="secondary"
                        size="sm"
                        class="!h-[28px]"
                        :title="t('database.clearChanges')"
                        :disabled="!isChanged"
                        @click.prevent="clearChanges"
                     >
                        <BaseIcon
                           class="mr-1"
                           icon-name="mdiDeleteSweep"
                           :size="18"
                        />
                        <span>{{ t('general.clear') }}</span>
                     </Button>
                  </div>
                  <div ref="indexesPanel" class="flex-1 overflow-auto pr-1">
                     <div
                        v-for="index in indexesProxy"
                        :key="index._antares_id"
                        class="flex items-center gap-2 px-2 py-1 mb-1 rounded-md cursor-pointer"
                        :class="{'selected-element': selectedIndexID === index._antares_id}"
                        @click="selectIndex($event, index._antares_id)"
                     >
                        <BaseIcon
                           class="column-key shrink-0"
                           icon-name="mdiKey"
                           :class="`key-${index.type}`"
                           :size="22"
                        />
                        <div class="flex-1 min-w-0">
                           <div class="text-sm truncate">
                              {{ index.name }}
                           </div>
                           <div class="text-xs text-muted-foreground">
                              {{ index.type }} · {{ index.fields.length }} {{ t('database.field', index.fields.length) }}
                           </div>
                        </div>
                        <Button
                           variant="ghost"
                           size="icon"
                           class="tile-action !h-[24px] !w-[24px] remove-field"
                           :title="t('general.delete')"
                           @click.prevent="removeIndex(index._antares_id)"
                        >
                           <BaseIcon
                              icon-name="mdiClose"
                              :size="16"
                           />
                        </Button>
                     </div>
                  </div>
               </div>
            </div>

            <div class="col-span-7 pl-2 editor-col">
               <form
                  v-if="selectedIndexObj"
                  :style="{ height: modalInnerHeight + 'px'}"
                  class="flex flex-col gap-3"
               >
                  <div class="grid grid-cols-[100px_1fr] items-center gap-2">
                     <Label class="!text-sm !text-muted-foreground !font-normal !m-0">
                        {{ t('general.name') }}
                     </Label>
                     <Input
                        v-model="selectedIndexObj.name"
                        type="text"
                        class="!h-[32px] !text-sm"
                     />
                  </div>
                  <div class="grid grid-cols-[100px_1fr] items-center gap-2">
                     <Label class="!text-sm !text-muted-foreground !font-normal !m-0">
                        {{ t('database.type') }}
                     </Label>
                     <BaseSelect
                        v-model="selectedIndexObj.type"
                        :options="indexTypes"
                        :option-disabled="(opt: any) => opt === 'PRIMARY' && hasPrimary"
                        class="!h-[32px] !text-sm"
                     />
                  </div>
                  <div class="grid grid-cols-[100px_1fr] items-start gap-2">
                     <Label class="!text-sm !text-muted-foreground !font-normal !m-0 mt-1.5">
                        {{ t('database.field', fields.length) }}
                     </Label>
                     <div class="fields-list flex flex-col gap-1 pt-1">
                        <label
                           v-for="(field, i) in fields"
                           :key="`${field.name}-${i}`"
                           class="flex items-center gap-2 cursor-pointer text-sm"
                        >
                           <Checkbox
                              :model-value="selectedIndexObj.fields.some((f: string) => f === field.name)"
                              @update:model-value="toggleField(field.name)"
                           />
                           <span>{{ field.name }}</span>
                        </label>
                     </div>
                  </div>
               </form>
               <div v-if="!indexesProxy.length" class="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                  <BaseIcon
                     icon-name="mdiKeyOutline"
                     :size="48"
                  />
                  <p class="text-base">
                     {{ t('database.thereAreNoIndexes') }}
                  </p>
                  <Button @click="addIndex">
                     {{ t('database.createNewIndex') }}
                  </Button>
               </div>
            </div>
         </div>
      </template>
   </ConfirmModal>
</template>

<script setup lang="ts">
import { TableField } from 'common/interfaces/antares';
import { uidGen } from 'common/libs/uidGen';
import { computed, onMounted, onUnmounted, Prop, Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '@/components/BaseConfirmModal.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const { t } = useI18n();

const props = defineProps({
   localIndexes: Array,
   table: String,
   fields: Array as Prop<TableField[]>,
   workspace: Object,
   indexTypes: Array
});

const emit = defineEmits<{
   'hide': [];
   'indexes-update': [indexes: any[]];
}>();

const indexesPanel: Ref<HTMLDivElement> = ref(null);
const indexesProxy = ref([]);
const selectedIndexID = ref('');
const modalInnerHeight = ref(400);

const selectedIndexObj = computed(() => indexesProxy.value.find(index => index._antares_id === selectedIndexID.value));
const isChanged = computed(() => JSON.stringify(props.localIndexes) !== JSON.stringify(indexesProxy.value));
const hasPrimary = computed(() => indexesProxy.value.some(index => ['PRIMARY', 'PRIMARY KEY'].includes(index.type)));

const confirmIndexesChange = () => {
   indexesProxy.value = indexesProxy.value.filter(index => index.fields.length);
   emit('indexes-update', indexesProxy.value);
};

const selectIndex = (event: MouseEvent, id: string) => {
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   if (selectedIndexID.value !== id && !(event.target as any).classList.contains('remove-field'))
      selectedIndexID.value = id;
};

const getModalInnerHeight = () => {
   const modalBody = document.querySelector('.modal-body');
   if (modalBody)
      modalInnerHeight.value = modalBody.clientHeight - (parseFloat(getComputedStyle(modalBody).paddingTop) + parseFloat(getComputedStyle(modalBody).paddingBottom));
};

const addIndex = () => {
   const uid = uidGen();
   indexesProxy.value = [...indexesProxy.value, {
      _antares_id: uid,
      name: `INDEX_${uid.substring(0, 4)}`,
      fields: [],
      type: props.workspace.customizations.primaryAsIndex ? props.indexTypes[0] : props.indexTypes[1]
   }];

   if (indexesProxy.value.length === 1)
      resetSelectedID();

   setTimeout(() => {
      indexesPanel.value.scrollTop = indexesPanel.value.scrollHeight + 60;
      selectedIndexID.value = uid;
   }, 20);
};

const removeIndex = (id: string) => {
   indexesProxy.value = indexesProxy.value.filter(index => index._antares_id !== id);

   if (selectedIndexID.value === id && indexesProxy.value.length)
      resetSelectedID();
};

const clearChanges = () => {
   indexesProxy.value = JSON.parse(JSON.stringify(props.localIndexes));
   if (!indexesProxy.value.some(index => index._antares_id === selectedIndexID.value))
      resetSelectedID();
};

const toggleField = (field: string) => {
   indexesProxy.value = indexesProxy.value.map(index => {
      if (index._antares_id === selectedIndexID.value) {
         if (index.fields.includes(field))
            index.fields = index.fields.filter((f: string) => f !== field);
         else
            index.fields.push(field);
      }
      return index;
   });
};

const resetSelectedID = () => {
   selectedIndexID.value = indexesProxy.value.length ? indexesProxy.value[0]._antares_id : '';
};

onMounted(() => {
   indexesProxy.value = JSON.parse(JSON.stringify(props.localIndexes));

   if (indexesProxy.value.length)
      resetSelectedID();

   getModalInnerHeight();
   window.addEventListener('resize', getModalInnerHeight);
});

onUnmounted(() => {
   window.removeEventListener('resize', getModalInnerHeight);
});
</script>

<style lang="scss" scoped>
.tile {
  border-radius: $border-radius;
  opacity: 0.5;
  transition: background 0.2s;
  transition: opacity 0.2s;

  .tile-action {
    opacity: 0;
    transition: opacity 0.2s;
  }

  &:hover {
    .tile-action {
      opacity: 1;
    }
  }

  &.selected-element {
    opacity: 1;
    background: var(--accent);
  }
}

.fields-list {
  max-height: 300px;
  overflow: auto;
}

.remove-field svg {
  pointer-events: none;
}
</style>
