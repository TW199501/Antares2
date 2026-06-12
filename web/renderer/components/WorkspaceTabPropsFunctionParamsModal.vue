<template>
   <ConfirmModal
      :confirm-text="t('general.confirm')"
      size="medium"
      @confirm="confirmParametersChange"
      @hide="$emit('hide')"
   >
      <template #header>
         <div class="flex items-center">
            <BaseIcon
               class="mr-1 shrink-0"
               icon-name="mdiDotsHorizontal"
               :size="22"
            />
            <span class="truncate">{{ t('database.parameters') }} "{{ func }}"</span>
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
                        @click="addParameter"
                     >
                        <BaseIcon
                           class="mr-1"
                           icon-name="mdiPlus"
                           :size="16"
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
                           :size="16"
                        />
                        <span>{{ t('general.clear') }}</span>
                     </Button>
                  </div>
                  <div ref="parametersPanel" class="flex-1 overflow-auto pr-1">
                     <div
                        v-for="param in parametersProxy"
                        :key="param._antares_id"
                        class="param-row flex items-center gap-2 px-2 py-1 mb-1 rounded-md cursor-pointer"
                        :class="{'selected-element': selectedParam === param._antares_id}"
                        @click="selectParameter($event, param._antares_id)"
                     >
                        <BaseIcon
                           icon-name="mdiHexagon"
                           :class="typeClass(param.type)"
                           :size="22"
                           class="shrink-0"
                        />
                        <div class="flex-1 min-w-0">
                           <div class="text-sm truncate">
                              {{ param.name }}
                           </div>
                           <div class="text-xs text-muted-foreground truncate">
                              {{ param.type }}{{ param.length ? `(${param.length})` : '' }} · {{ param.context }}
                           </div>
                        </div>
                        <Button
                           variant="ghost"
                           size="icon"
                           class="param-action !h-[24px] !w-[24px] remove-field"
                           :title="t('general.delete')"
                           @click.prevent="removeParameter(param._antares_id)"
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
                  v-if="selectedParamObj"
                  :style="{ height: modalInnerHeight + 'px'}"
                  class="flex flex-col gap-3"
               >
                  <div class="grid grid-cols-[100px_1fr] items-center gap-2">
                     <Label class="!text-sm !text-muted-foreground !font-normal !m-0">
                        {{ t('general.name') }}
                     </Label>
                     <Input
                        v-model="selectedParamObj.name"
                        type="text"
                        class="!h-[32px] !text-sm"
                     />
                  </div>
                  <div class="grid grid-cols-[100px_1fr] items-center gap-2">
                     <Label class="!text-sm !text-muted-foreground !font-normal !m-0">
                        {{ t('database.type') }}
                     </Label>
                     <BaseSelect
                        v-model="selectedParamObj.type"
                        class="uppercase !h-[32px] !text-sm"
                        :options="workspace.dataTypes"
                        group-label="group"
                        group-values="types"
                        option-label="name"
                        option-track-by="name"
                     />
                  </div>
                  <div v-if="customizations.parametersLength" class="grid grid-cols-[100px_1fr] items-center gap-2">
                     <Label class="!text-sm !text-muted-foreground !font-normal !m-0">
                        {{ t('database.length') }}
                     </Label>
                     <Input
                        v-model="selectedParamObj.length"
                        type="number"
                        min="0"
                        class="!h-[32px] !text-sm"
                     />
                  </div>
                  <div v-if="customizations.functionContext" class="grid grid-cols-[100px_1fr] items-start gap-2">
                     <Label class="!text-sm !text-muted-foreground !font-normal !m-0 mt-1.5">
                        {{ t('database.context') }}
                     </Label>
                     <RadioGroup v-model="selectedParamObj.context" class="flex flex-col gap-1.5 pt-1">
                        <label class="flex items-center gap-2 cursor-pointer text-sm">
                           <RadioGroupItem value="IN" /> IN
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer text-sm">
                           <RadioGroupItem value="OUT" /> OUT
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer text-sm">
                           <RadioGroupItem value="INOUT" /> INOUT
                        </label>
                     </RadioGroup>
                  </div>
               </form>
               <div v-if="!parametersProxy.length" class="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                  <BaseIcon
                     icon-name="mdiDotsHorizontal"
                     :size="48"
                  />
                  <p class="text-[15px]">
                     {{ t('database.thereAreNoParameters') }}
                  </p>
                  <Button @click="addParameter">
                     {{ t('database.createNewParameter') }}
                  </Button>
               </div>
            </div>
         </div>
      </template>
   </ConfirmModal>
</template>

<script setup lang="ts">
import { uidGen } from 'common/libs/uidGen';
import { computed, onMounted, onUnmounted, Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '@/components/BaseConfirmModal.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const { t } = useI18n();

const props = defineProps({
   localParameters: {
      type: Array,
      default: () => []
   },
   func: String,
   workspace: Object
});

const emit = defineEmits<{
   'hide': [];
   'parameters-update': [parameters: any[]];
}>();

const parametersPanel: Ref<HTMLDivElement> = ref(null);
const parametersProxy = ref([]);
const selectedParam = ref('');
const modalInnerHeight = ref(400);
const i = ref(1);

const selectedParamObj = computed(() => {
   return parametersProxy.value.find(param => param._antares_id === selectedParam.value);
});

const isChanged = computed(() => {
   return JSON.stringify(props.localParameters) !== JSON.stringify(parametersProxy.value);
});

const customizations = computed(() => {
   return props.workspace.customizations;
});

const typeClass = (type: string) => {
   if (type)
      return `type-${type.toLowerCase().replaceAll(' ', '_').replaceAll('"', '')}`;
   return '';
};

const confirmParametersChange = () => {
   emit('parameters-update', parametersProxy.value);
};

const selectParameter = (event: MouseEvent, uid: string) => {
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   if (selectedParam.value !== uid && !(event.target as any).classList.contains('remove-field'))
      selectedParam.value = uid;
};

const getModalInnerHeight = () => {
   const modalBody = document.querySelector('[data-modal-body]');
   if (modalBody)
      modalInnerHeight.value = modalBody.clientHeight - (parseFloat(getComputedStyle(modalBody).paddingTop) + parseFloat(getComputedStyle(modalBody).paddingBottom));
};

const addParameter = () => {
   const newUid = uidGen();
   parametersProxy.value = [...parametersProxy.value, {
      _antares_id: newUid,
      name: `param${i.value++}`,
      type: props.workspace.dataTypes[0].types[0].name,
      context: 'IN',
      length: ''
   }];

   if (parametersProxy.value.length === 1)
      resetSelectedID();

   setTimeout(() => {
      parametersPanel.value.scrollTop = parametersPanel.value.scrollHeight + 60;
      selectedParam.value = newUid;
   }, 20);
};

const removeParameter = (uid: string) => {
   parametersProxy.value = parametersProxy.value.filter(param => param._antares_id !== uid);

   if (parametersProxy.value.length && selectedParam.value === uid)
      resetSelectedID();
};

const clearChanges = () => {
   parametersProxy.value = JSON.parse(JSON.stringify(props.localParameters));
   i.value = parametersProxy.value.length + 1;

   if (!parametersProxy.value.some(param => param.name === selectedParam.value))
      resetSelectedID();
};

const resetSelectedID = () => {
   selectedParam.value = parametersProxy.value.length ? parametersProxy.value[0]._antares_id : '';
};

onMounted(() => {
   parametersProxy.value = JSON.parse(JSON.stringify(props.localParameters));
   i.value = parametersProxy.value.length + 1;

   if (parametersProxy.value.length)
      resetSelectedID();

   getModalInnerHeight();
   window.addEventListener('resize', getModalInnerHeight);
});

onUnmounted(() => {
   window.removeEventListener('resize', getModalInnerHeight);
});
</script>

<style lang="scss" scoped>
.param-row {
  opacity: 0.5;
  transition: background 0.2s, opacity 0.2s;

  .param-action {
    opacity: 0;
    transition: opacity 0.2s;
  }

  &:hover {
    background: rgb(255 255 255 / 0.04);

    .param-action {
      opacity: 1;
    }
  }

  &.selected-element {
    opacity: 1;
    background: rgb(255 255 255 / 0.06);
  }
}

.remove-field svg {
  pointer-events: none;
}
</style>
