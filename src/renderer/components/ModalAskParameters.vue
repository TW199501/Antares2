<template>
   <ConfirmModal
      :confirm-text="t('general.run')"
      :cancel-text="t('general.cancel')"
      size="400"
      @confirm="runRoutine"
      @hide="closeModal"
   >
      <template #header>
         <div class="flex items-center gap-1.5">
            <BaseIcon icon-name="mdiPlay" :size="20" />
            <span class="cut-text">{{ t('database.parameters') }}: {{ localRoutine.name }}</span>
         </div>
      </template>
      <template #body>
         <form class="space-y-3" @submit.prevent="runRoutine">
            <div
               v-for="(parameter, i) in inParameters"
               :key="parameter._antares_id"
               class="grid grid-cols-[110px_1fr] items-center gap-3"
            >
               <Label
                  :for="`param-${i}`"
                  class="!text-[13px] truncate"
                  :title="parameter.name"
               >
                  {{ parameter.name }}
               </Label>
               <div class="relative w-full">
                  <input
                     :id="`param-${i}`"
                     :ref="el => { if (i === 0) firstInput = el as HTMLInputElement; }"
                     v-model="values[`${i}-${parameter.name}`]"
                     type="text"
                     :class="paramInputClass"
                  >
                  <span
                     class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] truncate max-w-[100px]"
                     :class="typeClass(parameter.type)"
                     :title="`${parameter.type} ${parameter.length}`"
                  >
                     {{ parameter.type }} {{ wrapNumber(parameter.length) }}
                  </span>
               </div>
            </div>
         </form>
      </template>
   </ConfirmModal>
</template>

<script setup lang="ts">
import { FLOAT, NUMBER } from 'common/fieldTypes';
import { FunctionInfos, RoutineInfos } from 'common/interfaces/antares';
import { computed, onBeforeUnmount, onMounted, PropType, Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '@/components/BaseConfirmModal.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import { Label } from '@/components/ui/label';
import { useFilters } from '@/composables/useFilters';

const { t } = useI18n();
const { wrapNumber } = useFilters();

const props = defineProps({
   localRoutine: Object as PropType<RoutineInfos | FunctionInfos>,
   client: String
});

const emit = defineEmits<{
   'confirm': [params: string[]];
   'close': [];
}>();

const firstInput: Ref<HTMLInputElement | null> = ref(null);
const values: Ref<Record<string, string>> = ref({});

const inParameters = computed(() => {
   return props.localRoutine.parameters.filter(param => param.context === 'IN');
});

// Shared input class for the parameter inputs. Avoids spectre's `.form-input`
// (1.8rem=36px height, padding 5/8) so we keep a clean 32px height with the
// 88px right padding reserved for the absolute-positioned type tag, matching
// the same pattern used in ModalFakerRows.
const paramInputClass =
   'box-border h-[32px] w-full rounded-md border border-input bg-background pl-2 pr-[100px] text-[13px] text-foreground ' +
   'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

const typeClass = (type: string) => {
   if (type)
      return `type-${type.toLowerCase().replaceAll(' ', '_').replaceAll('"', '')}`;
   return '';
};

const runRoutine = () => {
   const valArr = Object.keys(values.value).reduce((acc, curr, i) => {
      let qc;
      switch (props.client) {
         case 'maria':
         case 'mysql':
            qc = '"';
            break;
         case 'pg':
            qc = '\'';
            break;
         default:
            qc = '"';
      }

      const param = props.localRoutine.parameters.find(param => `${i}-${param.name}` === curr);

      const value = [...NUMBER, ...FLOAT].includes(param.type) ? values.value[curr] : `${qc}${values.value[curr]}${qc}`;
      acc.push(value);
      return acc;
   }, []);

   emit('confirm', valArr);
};

const closeModal = () => emit('close');

const onKey = (e: KeyboardEvent) => {
   e.stopPropagation();
   if (e.key === 'Escape')
      closeModal();
};

window.addEventListener('keydown', onKey);

onMounted(() => {
   setTimeout(() => {
      firstInput.value?.focus();
   }, 20);
});

onBeforeUnmount(() => {
   window.removeEventListener('keydown', onKey);
});
</script>
