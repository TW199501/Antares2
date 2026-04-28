<template>
   <ConfirmModal
      :confirm-text="t('general.confirm')"
      size="medium"
      class="options-modal"
      @confirm="confirmChecksChange"
      @hide="$emit('hide')"
   >
      <template #header>
         <div class="flex items-center">
            <BaseIcon
               class="mr-1"
               icon-name="mdiTableCheck"
               :size="24"
            />
            <span class="cut-text">{{ t('database.tableChecks') }} "{{ table }}"</span>
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
                        @click="addCheck"
                     >
                        <BaseIcon
                           class="mr-1"
                           icon-name="mdiCheckboxMarkedCirclePlusOutline"
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
                  <div ref="checksPanel" class="flex-1 overflow-auto pr-1">
                     <div
                        v-for="check in checksProxy"
                        :key="check._antares_id"
                        class="flex items-center gap-2 px-2 py-1 mb-1 rounded-md cursor-pointer"
                        :class="{'selected-element': selectedCheckID === check._antares_id}"
                        @click="selectCheck($event, check._antares_id)"
                     >
                        <BaseIcon
                           class="column-key shrink-0"
                           icon-name="mdiCheckboxMarkedCircleOutline"
                           :size="22"
                        />
                        <div class="flex-1 min-w-0">
                           <div class="text-[14px] truncate">
                              {{ check.name }}
                           </div>
                           <div class="text-[12px] text-muted-foreground truncate">
                              {{ check.clause }}
                           </div>
                        </div>
                        <Button
                           variant="ghost"
                           size="icon"
                           class="tile-action !h-[24px] !w-[24px] remove-field"
                           :title="t('general.delete')"
                           @click.prevent="removeCheck(check._antares_id)"
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
                  v-if="selectedCheckObj"
                  :style="{ height: modalInnerHeight + 'px'}"
                  class="flex flex-col gap-3"
               >
                  <div class="grid grid-cols-[100px_1fr] items-center gap-2">
                     <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0">
                        {{ t('general.name') }}
                     </Label>
                     <Input
                        v-model="selectedCheckObj.name"
                        type="text"
                        class="!h-[32px] !text-[14px]"
                     />
                  </div>
                  <div class="grid grid-cols-[100px_1fr] items-start gap-2">
                     <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0 mt-1.5">
                        {{ t('database.checkClause') }}
                     </Label>
                     <textarea
                        v-model="selectedCheckObj.clause"
                        rows="5"
                        class="w-full rounded-md border border-input bg-background px-3 py-2 text-[14px] text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        style="resize: vertical;"
                     />
                  </div>
               </form>
               <div v-if="!checksProxy.length" class="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                  <BaseIcon
                     icon-name="mdiCheckboxMarkedCircleOutline"
                     :size="48"
                  />
                  <p class="text-[16px]">
                     {{ t('database.thereAreNoTableChecks') }}
                  </p>
                  <Button @click="addCheck">
                     {{ t('database.createNewCheck') }}
                  </Button>
               </div>
            </div>
         </div>
      </template>
   </ConfirmModal>
</template>

<script setup lang="ts">
import { TableCheck } from 'common/interfaces/antares';
import { uidGen } from 'common/libs/uidGen';
import { computed, onMounted, onUnmounted, Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '@/components/BaseConfirmModal.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const { t } = useI18n();

const props = defineProps({
   localChecks: Array,
   table: String,
   workspace: Object
});

const emit = defineEmits<{
   'hide': [];
   'checks-update': [checks: TableCheck[]];
}>();

const checksPanel: Ref<HTMLDivElement> = ref(null);
const checksProxy: Ref<TableCheck[]> = ref([]);
const selectedCheckID = ref('');
const modalInnerHeight = ref(400);

const selectedCheckObj = computed(() => checksProxy.value.find(index => index._antares_id === selectedCheckID.value));
const isChanged = computed(() => JSON.stringify(props.localChecks) !== JSON.stringify(checksProxy.value));

const confirmChecksChange = () => {
   const filteredChecks = checksProxy.value.filter(check => check.clause.trim().length);
   emit('checks-update', filteredChecks);
};

const selectCheck = (event: MouseEvent, id: string) => {
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   if (selectedCheckID.value !== id && !(event.target as any).classList.contains('remove-field'))
      selectedCheckID.value = id;
};

const getModalInnerHeight = () => {
   const modalBody = document.querySelector('.modal-body');
   if (modalBody)
      modalInnerHeight.value = modalBody.clientHeight - (parseFloat(getComputedStyle(modalBody).paddingTop) + parseFloat(getComputedStyle(modalBody).paddingBottom));
};

const addCheck = () => {
   const uid = uidGen();
   checksProxy.value = [...checksProxy.value, {
      _antares_id: uid,
      name: `CHK_${uid.substring(0, 4)}`,
      clause: ''
   }];

   if (checksProxy.value.length === 1)
      resetSelectedID();

   setTimeout(() => {
      checksPanel.value.scrollTop = checksPanel.value.scrollHeight + 60;
      selectedCheckID.value = uid;
   }, 20);
};

const removeCheck = (id: string) => {
   checksProxy.value = checksProxy.value.filter(index => index._antares_id !== id);

   if (selectedCheckID.value === id && checksProxy.value.length)
      resetSelectedID();
};

const clearChanges = () => {
   checksProxy.value = JSON.parse(JSON.stringify(props.localChecks));
   if (!checksProxy.value.some(index => index._antares_id === selectedCheckID.value))
      resetSelectedID();
};

const resetSelectedID = () => {
   selectedCheckID.value = checksProxy.value.length ? checksProxy.value[0]._antares_id : '';
};

onMounted(() => {
   checksProxy.value = JSON.parse(JSON.stringify(props.localChecks));

   if (checksProxy.value.length)
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
