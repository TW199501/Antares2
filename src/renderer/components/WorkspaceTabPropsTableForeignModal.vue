<template>
   <ConfirmModal
      :confirm-text="t('general.confirm')"
      size="medium"
      class="options-modal"
      @confirm="confirmForeignsChange"
      @hide="$emit('hide')"
   >
      <template #header>
         <div class="flex items-center">
            <BaseIcon
               class="mr-1"
               icon-name="mdiKeyLink"
               :size="24"
            />
            <span class="cut-text">{{ t('database.foreignKeys') }} "{{ table }}"</span>
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
                        @click="addForeign"
                     >
                        <BaseIcon
                           class="mr-1"
                           icon-name="mdiLinkPlus"
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
                        v-for="foreign in foreignProxy"
                        :key="foreign._antares_id"
                        class="tile flex items-center gap-2 px-2 py-1 mb-1 rounded-md cursor-pointer"
                        :class="{'selected-element': selectedForeignID === foreign._antares_id}"
                        @click="selectForeign($event, foreign._antares_id)"
                     >
                        <BaseIcon
                           class="shrink-0"
                           icon-name="mdiKeyLink"
                           :size="22"
                        />
                        <div class="flex-1 min-w-0">
                           <div class="text-[14px] truncate">
                              {{ foreign.constraintName }}
                           </div>
                           <small class="text-[12px] text-muted-foreground flex items-center">
                              <BaseIcon
                                 class="mr-1"
                                 icon-name="mdiLinkVariant"
                                 :size="14"
                              />
                              <div class="fk-details-wrapper">
                                 <span v-if="foreign.table !== ''" class="fk-details">
                                    <BaseIcon
                                       class="mr-1"
                                       icon-name="mdiTable"
                                       :size="14"
                                       :style="'min-width:14px'"
                                    />
                                    <span>{{ foreign.table }}.{{ foreign.field }}</span>
                                 </span>
                                 <span v-if="foreign.refTable !== ''" class="fk-details">
                                    <BaseIcon
                                       class="mr-1"
                                       icon-name="mdiTable"
                                       :size="14"
                                       :style="'min-width:14px'"
                                    />
                                    <span>{{ foreign.refTable }}.{{ foreign.refField }}</span>
                                 </span>
                              </div>
                           </small>
                        </div>
                        <Button
                           variant="ghost"
                           size="icon"
                           class="tile-action !h-[24px] !w-[24px] remove-field"
                           :title="t('general.delete')"
                           @click.prevent="removeIndex(foreign._antares_id)"
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

            <div class="col-span-7 pl-2">
               <form
                  v-if="selectedForeignObj"
                  :style="{ height: modalInnerHeight + 'px'}"
                  class="flex flex-col gap-3"
               >
                  <div class="grid grid-cols-[100px_1fr] items-center gap-2">
                     <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0">
                        {{ t('general.name') }}
                     </Label>
                     <Input
                        v-model="selectedForeignObj.constraintName"
                        type="text"
                        class="!h-[32px] !text-[14px]"
                     />
                  </div>
                  <div class="grid grid-cols-[100px_1fr] items-start gap-2">
                     <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0 mt-1.5">
                        {{ t('database.field', 1) }}
                     </Label>
                     <div class="fields-list flex flex-col gap-1 pt-1">
                        <label
                           v-for="(field, i) in fields"
                           :key="`${field.name}-${i}`"
                           class="flex items-center gap-2 cursor-pointer text-[14px]"
                        >
                           <Checkbox
                              :model-value="selectedForeignObj.field === field.name"
                              @update:model-value="toggleField(field.name)"
                           />
                           <span>{{ field.name }}</span>
                        </label>
                     </div>
                  </div>
                  <div class="grid grid-cols-[100px_1fr] items-center gap-2">
                     <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0">
                        {{ t('database.referenceTable') }}
                     </Label>
                     <BaseSelect
                        v-model="selectedForeignObj.refTable"
                        :options="schemaTables"
                        option-label="name"
                        option-track-by="name"
                        class="[&_.select-base]:!h-[32px] [&_.select-base]:!text-[14px]"
                        @change="reloadRefFields"
                     />
                  </div>
                  <div class="grid grid-cols-[100px_1fr] items-start gap-2">
                     <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0 mt-1.5">
                        {{ t('database.referenceField') }}
                     </Label>
                     <div class="fields-list flex flex-col gap-1 pt-1">
                        <label
                           v-for="(field, i) in refFields[selectedForeignID]"
                           :key="`${field.name}-${i}`"
                           class="flex items-center gap-2 cursor-pointer text-[14px]"
                        >
                           <Checkbox
                              :model-value="selectedForeignObj.refField === field.name && selectedForeignObj.refTable === field.table"
                              @update:model-value="toggleRefField(field.name)"
                           />
                           <span>{{ field.name }}</span>
                        </label>
                     </div>
                  </div>
                  <div class="grid grid-cols-[100px_1fr] items-center gap-2">
                     <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0">
                        {{ t('database.onUpdate') }}
                     </Label>
                     <BaseSelect
                        v-model="selectedForeignObj.onUpdate"
                        :options="foreignActions"
                        class="[&_.select-base]:!h-[32px] [&_.select-base]:!text-[14px]"
                     />
                  </div>
                  <div class="grid grid-cols-[100px_1fr] items-center gap-2">
                     <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0">
                        {{ t('database.onDelete') }}
                     </Label>
                     <BaseSelect
                        v-model="selectedForeignObj.onDelete"
                        :options="foreignActions"
                        class="[&_.select-base]:!h-[32px] [&_.select-base]:!text-[14px]"
                     />
                  </div>
               </form>

               <div v-if="!foreignProxy.length" class="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                  <BaseIcon
                     icon-name="mdiKeyLink"
                     :size="48"
                  />
                  <p class="text-[16px]">
                     {{ t('database.thereAreNoForeign') }}
                  </p>
                  <Button @click="addForeign">
                     {{ t('database.createNewForeign') }}
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
import Tables from '@/ipc-api/Tables';
import { useNotificationsStore } from '@/stores/notifications';

const { t } = useI18n();

const props = defineProps({
   localKeyUsage: Array,
   connection: Object,
   table: String,
   schema: String,
   schemaTables: Array,
   fields: Array as Prop<TableField[]>,
   workspace: Object
});

const emit = defineEmits<{
   'foreigns-update': [foreigns: any[]];
   'hide': [];
}>();

const { addNotification } = useNotificationsStore();

const indexesPanel: Ref<HTMLDivElement> = ref(null);
const foreignProxy = ref([]);
const selectedForeignID = ref('');
const modalInnerHeight = ref(400);
const refFields = ref({} as Record<string, TableField[]>);

const foreignActions = computed(() => props.workspace.customizations.foreignActions);
const selectedForeignObj = computed(() => foreignProxy.value.find(foreign => foreign._antares_id === selectedForeignID.value));
const isChanged = computed(() => JSON.stringify(props.localKeyUsage) !== JSON.stringify(foreignProxy.value));

const confirmForeignsChange = () => {
   foreignProxy.value = foreignProxy.value.filter(foreign =>
      foreign.field &&
      foreign.refField &&
      foreign.table &&
      foreign.refTable
   );
   emit('foreigns-update', foreignProxy.value);
};

const selectForeign = (event: MouseEvent, id: string) => {
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   if (selectedForeignID.value !== id && !(event.target as any).classList.contains('remove-field')) {
      selectedForeignID.value = id;
      getRefFields();
   }
};

const getModalInnerHeight = () => {
   const modalBody = document.querySelector('[data-modal-body]');
   if (modalBody)
      modalInnerHeight.value = modalBody.clientHeight - (parseFloat(getComputedStyle(modalBody).paddingTop) + parseFloat(getComputedStyle(modalBody).paddingBottom));
};

const addForeign = () => {
   const uid = uidGen();
   foreignProxy.value = [...foreignProxy.value, {
      _antares_id: uid,
      constraintName: `FK_${uid.substring(0, 4)}`,
      refSchema: props.schema,
      table: props.table,
      refTable: '',
      field: '',
      refField: '',
      onUpdate: foreignActions.value[0],
      onDelete: foreignActions.value[0]
   }];

   if (foreignProxy.value.length === 1)
      resetSelectedID();

   setTimeout(() => {
      indexesPanel.value.scrollTop = indexesPanel.value.scrollHeight + 60;
      selectedForeignID.value = uid;
   }, 20);
};

const removeIndex = (id: string) => {
   foreignProxy.value = foreignProxy.value.filter(foreign => foreign._antares_id !== id);

   if (selectedForeignID.value === id && foreignProxy.value.length)
      resetSelectedID();
};

const clearChanges = () => {
   foreignProxy.value = JSON.parse(JSON.stringify(props.localKeyUsage));
   if (!foreignProxy.value.some(foreign => foreign._antares_id === selectedForeignID.value))
      resetSelectedID();
};

const toggleField = (field: string) => {
   foreignProxy.value = foreignProxy.value.map(foreign => {
      if (foreign._antares_id === selectedForeignID.value)
         foreign.field = field;

      return foreign;
   });
};

const toggleRefField = (field: string) => {
   foreignProxy.value = foreignProxy.value.map(foreign => {
      if (foreign._antares_id === selectedForeignID.value)
         foreign.refField = field;

      return foreign;
   });
};

const resetSelectedID = () => {
   selectedForeignID.value = foreignProxy.value.length ? foreignProxy.value[0]._antares_id : '';
};

const getRefFields = async () => {
   if (!selectedForeignObj.value.refTable) return;

   const params = {
      uid: props.connection.uid,
      schema: selectedForeignObj.value.refSchema,
      table: selectedForeignObj.value.refTable
   };

   try { // Field data
      const { status, response } = await Tables.getTableColumns(params);
      if (status === 'success') {
         refFields.value = {
            ...refFields.value,
            [selectedForeignID.value]: response
         };
      }
      else
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }
};

const reloadRefFields = () => {
   selectedForeignObj.value.refField = '';
   getRefFields();
};

onMounted(() => {
   foreignProxy.value = JSON.parse(JSON.stringify(props.localKeyUsage));

   if (foreignProxy.value.length)
      resetSelectedID();

   if (selectedForeignObj.value)
      getRefFields();

   getModalInnerHeight();
   window.addEventListener('resize', getModalInnerHeight);
});

onUnmounted(() => {
   window.removeEventListener('resize', getModalInnerHeight);
});
</script>

<style lang="scss" scoped>
.tile {
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
  max-height: 90px;
  overflow: auto;
}

.remove-field svg {
  pointer-events: none;
}

.fk-details-wrapper {
  max-width: calc(100% - 1rem);

  .fk-details {
    display: flex;
    line-height: 1;
    align-items: baseline;
    align-items: center;

    > span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: block;
      padding-bottom: 2px;
    }
  }
}

</style>
