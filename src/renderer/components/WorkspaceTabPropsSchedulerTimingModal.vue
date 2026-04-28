<template>
   <ConfirmModal
      :confirm-text="t('general.confirm')"
      size="400"
      :disable-autofocus="true"
      @confirm="confirmOptionsChange"
      @hide="$emit('hide')"
   >
      <template #header>
         <div class="flex items-center">
            <BaseIcon
               class="mr-1 shrink-0"
               icon-name="mdiTimer"
               :size="22"
            />
            <span class="truncate">{{ t('database.timing') }} "{{ localOptions.name }}"</span>
         </div>
      </template>
      <template #body>
         <form class="flex flex-col gap-3">
            <div class="grid grid-cols-[120px_1fr] items-center gap-2">
               <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0">
                  {{ t('database.execution') }}
               </Label>
               <BaseSelect
                  v-model="optionsProxy.execution"
                  :options="['EVERY', 'ONCE']"
                  class="!h-[32px] !text-[14px]"
               />
            </div>

            <template v-if="optionsProxy.execution === 'EVERY'">
               <div class="grid grid-cols-[120px_1fr] items-center gap-2">
                  <span />
                  <div class="flex gap-2">
                     <Input
                        v-model="optionsProxy.every[0]"
                        type="text"
                        class="!h-[32px] !text-[14px] flex-1"
                        @keypress="isNumberOrMinus($event)"
                     />
                     <BaseSelect
                        v-model="optionsProxy.every[1]"
                        class="uppercase !h-[32px] !text-[14px] flex-[2]"
                        :options="['YEAR',
                                   'QUARTER',
                                   'MONTH',
                                   'WEEK',
                                   'DAY',
                                   'HOUR',
                                   'MINUTE',
                                   'SECOND',
                                   'YEAR_MONTH',
                                   'DAY_HOUR',
                                   'DAY_MINUTE',
                                   'DAY_SECOND',
                                   'HOUR_MINUTE',
                                   'HOUR_SECOND',
                                   'MINUTE_SECOND']"
                     />
                  </div>
               </div>
               <div class="grid grid-cols-[120px_1fr] items-center gap-2">
                  <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0">
                     {{ t('database.starts') }}
                  </Label>
                  <div class="flex items-center gap-2">
                     <Checkbox v-model:checked="hasStart" />
                     <Input
                        v-model="optionsProxy.starts"
                        v-mask="'####-##-## ##:##:##'"
                        type="text"
                        class="!h-[32px] !text-[14px] flex-1"
                     />
                     <BaseIcon
                        icon-name="mdiCalendar"
                        :size="18"
                        class="text-muted-foreground"
                     />
                  </div>
               </div>
               <div class="grid grid-cols-[120px_1fr] items-center gap-2">
                  <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0">
                     {{ t('database.ends') }}
                  </Label>
                  <div class="flex items-center gap-2">
                     <Checkbox v-model:checked="hasEnd" />
                     <Input
                        v-model="optionsProxy.ends"
                        v-mask="'####-##-## ##:##:##'"
                        type="text"
                        class="!h-[32px] !text-[14px] flex-1"
                     />
                     <BaseIcon
                        icon-name="mdiCalendar"
                        :size="18"
                        class="text-muted-foreground"
                     />
                  </div>
               </div>
            </template>
            <template v-else>
               <div class="grid grid-cols-[120px_1fr] items-center gap-2">
                  <span />
                  <div class="flex items-center gap-2">
                     <Input
                        v-model="optionsProxy.at"
                        v-mask="'####-##-## ##:##:##'"
                        type="text"
                        class="!h-[32px] !text-[14px] flex-1"
                     />
                     <BaseIcon
                        icon-name="mdiCalendar"
                        :size="18"
                        class="text-muted-foreground"
                     />
                  </div>
               </div>
            </template>

            <div class="grid grid-cols-[120px_1fr] items-center gap-2">
               <span />
               <label class="flex items-center gap-2 cursor-pointer text-[14px]">
                  <Checkbox v-model:checked="optionsProxy.preserve" />
                  {{ t('database.preserveOnCompletion') }}
               </label>
            </div>
         </form>
      </template>
   </ConfirmModal>
</template>

<script setup lang="ts">
import { EventInfos } from 'common/interfaces/antares';
import moment from 'moment';
import { Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '@/components/BaseConfirmModal.vue';
import BaseIcon from '@/components/BaseIcon.vue';
import BaseSelect from '@/components/BaseSelect.vue';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const { t } = useI18n();

const props = defineProps({
   localOptions: Object,
   workspace: Object
});

const emit = defineEmits<{
   'hide': [];
   'options-update': [options: EventInfos];
}>();

const optionsProxy: Ref<EventInfos> = ref({} as EventInfos);
const hasStart = ref(false);
const hasEnd = ref(false);

const confirmOptionsChange = () => {
   if (!hasStart.value) optionsProxy.value.starts = '';
   if (!hasEnd.value) optionsProxy.value.ends = '';

   emit('options-update', optionsProxy.value);
};

const isNumberOrMinus = (event: KeyboardEvent) => {
   if (!/\d/.test(event.key) && event.key !== '-')
      return event.preventDefault();
};

optionsProxy.value = JSON.parse(JSON.stringify(props.localOptions));

hasStart.value = !!optionsProxy.value.starts;
hasEnd.value = !!optionsProxy.value.ends;

if (!optionsProxy.value.at) optionsProxy.value.at = moment().format('YYYY-MM-DD HH:mm:ss');
if (!optionsProxy.value.starts) optionsProxy.value.starts = moment().format('YYYY-MM-DD HH:mm:ss');
if (!optionsProxy.value.ends) optionsProxy.value.ends = moment().format('YYYY-MM-DD HH:mm:ss');
if (!optionsProxy.value.every.length) optionsProxy.value.every = ['1', 'DAY'];

</script>
