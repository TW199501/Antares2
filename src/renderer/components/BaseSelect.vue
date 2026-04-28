<template>
   <!-- searchable=true → Combobox (filter input) -->
   <Combobox
      v-if="searchable"
      v-model="internalValue"
      :open="isOpen"
      :disabled="disabled"
      :class="dropdownClass"
      @update:model-value="onUpdate"
      @update:open="onOpenChange"
   >
      <ComboboxAnchor :class="['select-base', wrapperClass]">
         <ComboboxInput
            :tabindex="tabindex"
            :placeholder="placeholderOrCurrent"
            :display-value="(v: any) => currentOptionLabel"
            :disabled="disabled"
            class="select-base__input !h-8 !text-[13px]"
         />
         <ComboboxTrigger
            class="select-base__trigger"
            :disabled="disabled"
            tabindex="-1"
         >
            <BaseIcon
               icon-name="mdiChevronDown"
               :size="16"
               class="text-muted-foreground"
            />
         </ComboboxTrigger>
      </ComboboxAnchor>
      <ComboboxList :class="['select-base__list', dropdownClass]">
         <ComboboxEmpty>{{ noResultsText }}</ComboboxEmpty>
         <template v-for="(group, gIdx) in normalizedOptions" :key="group.id">
            <ComboboxGroup>
               <ComboboxLabel v-if="group.$type === 'group' && group.label">
                  {{ group.label }}
               </ComboboxLabel>
               <ComboboxItem
                  v-for="(opt, oIdx) in group.children"
                  :key="opt.id"
                  :value="opt.value"
                  :disabled="opt.disabled"
                  @select="(e: Event) => onItemSelect(e, opt)"
               >
                  <slot
                     name="option"
                     :option="opt.$data"
                     :index="getFlatIndex(gIdx, oIdx)"
                  >
                     {{ opt.label }}
                  </slot>
                  <ComboboxItemIndicator />
               </ComboboxItem>
            </ComboboxGroup>
         </template>
      </ComboboxList>
   </Combobox>

   <!-- searchable=false → Select (no filter) -->
   <Select
      v-else
      v-model="internalValue"
      :disabled="disabled"
      @update:model-value="onUpdate"
      @update:open="onOpenChange"
   >
      <SelectTrigger
         :tabindex="tabindex"
         :class="['select-base', wrapperClass]"
      >
         <SelectValue :placeholder="placeholderOrCurrent">
            {{ currentOptionLabel }}
         </SelectValue>
      </SelectTrigger>
      <SelectContent :class="['select-base__list', dropdownClass]">
         <template v-for="(group, gIdx) in normalizedOptions" :key="group.id">
            <SelectGroup>
               <SelectLabel v-if="group.$type === 'group' && group.label">
                  {{ group.label }}
               </SelectLabel>
               <SelectItem
                  v-for="(opt, oIdx) in group.children"
                  :key="opt.id"
                  :value="opt.value"
                  :disabled="opt.disabled"
               >
                  <slot
                     name="option"
                     :option="opt.$data"
                     :index="getFlatIndex(gIdx, oIdx)"
                  >
                     {{ opt.label }}
                  </slot>
               </SelectItem>
            </SelectGroup>
         </template>
      </SelectContent>
   </Select>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useAttrs, watch } from 'vue';

import BaseIcon from '@/components/BaseIcon.vue';
import {
   Combobox,
   ComboboxAnchor,
   ComboboxEmpty,
   ComboboxGroup,
   ComboboxInput,
   ComboboxItem,
   ComboboxItemIndicator,
   ComboboxLabel,
   ComboboxList,
   ComboboxTrigger
} from '@/components/ui/combobox';
import {
   Select,
   SelectContent,
   SelectGroup,
   SelectItem,
   SelectLabel,
   SelectTrigger,
   SelectValue
} from '@/components/ui/select';

defineOptions({
   name: 'BaseSelect',
   inheritAttrs: true
});

interface NormalizedOption {
   $type: 'option';
   id: string;
   value: any;
   label: string;
   disabled: boolean;
   $data: any;
}
interface NormalizedGroup {
   $type: 'group';
   id: string;
   label: string;
   children: NormalizedOption[];
}

const props = withDefaults(defineProps<{
   modelValue?: string | number | object | boolean | null;
   value?: string | number | object | boolean | null;
   searchable?: boolean;
   preserveSearch?: boolean;
   tabindex?: number;
   options?: any[];
   optionTrackBy?: string |((opt: any) => any);
   optionLabel?: string | ((opt: any) => string);
   optionDisabled?: (opt: any) => boolean;
   groupLabel?: string;
   groupValues?: string;
   closeOnSelect?: boolean;
   animation?: string;
   dropdownOffsets?: { top?: number; left?: number };
   dropdownClass?: string;
   disabled?: boolean;
   maxVisibleOptions?: number;
   dropdownMatchParent?: boolean;
   placeholder?: string;
}>(), {
   searchable: true,
   preserveSearch: false,
   tabindex: 0,
   options: () => [],
   optionTrackBy: 'value',
   optionLabel: 'label',
   closeOnSelect: true,
   animation: 'fade-slide-down',
   dropdownOffsets: () => ({ top: 10, left: 0 }),
   disabled: false,
   maxVisibleOptions: 100,
   dropdownMatchParent: false,
   placeholder: ''
});

const emit = defineEmits<{
   'update:modelValue': [value: any];
   'select': [opt: any];
   'open': [];
   'close': [];
   'change': [opt: any];
   'blur': [];
}>();

const attrs = useAttrs();

// Internal state
const internalValue = ref<any>(props.modelValue !== undefined ? props.modelValue : props.value);
const isOpen = ref(false);

watch(() => props.modelValue, (v) => {
   internalValue.value = v;
});
watch(() => props.value, (v) => {
   if (props.modelValue === undefined) internalValue.value = v;
});

// `class` from $attrs may contain spectre form-select / size hints; we just
// forward it onto the root primitive so legacy callers' styling continues to work.
const wrapperClass = computed(() => attrs.class as any);

// Helpers (kept compatible with legacy `_guess` signature in old BaseSelect)
const _guess = (key: 'optionTrackBy' | 'optionLabel' | 'optionDisabled', item: any): any => {
   const accessor = props[key];
   if (typeof accessor === 'function') return accessor(item);
   if (typeof accessor === 'string') return item && item[accessor] !== undefined ? item[accessor] : item;
   return item;
};
const getOptionValue = (opt: any) => _guess('optionTrackBy', opt);
const getOptionLabel = (opt: any) => String(_guess('optionLabel', opt) ?? '');
const getOptionDisabled = (opt: any) => _guess('optionDisabled', opt) === true;

// Normalize options into [{ $type: 'group', children: [{ $type: 'option' }] }]
const normalizedOptions = computed<NormalizedGroup[]>(() => {
   const result: NormalizedGroup[] = [];
   const flatChildren: NormalizedOption[] = [];

   for (const curr of props.options) {
      if (props.groupValues && curr && curr[props.groupValues] && curr[props.groupValues].length) {
         const groupLabel = String(curr[props.groupLabel as string] ?? '');
         result.push({
            $type: 'group',
            id: `group-${groupLabel}-${result.length}`,
            label: groupLabel,
            children: curr[props.groupValues].map((el: any, idx: number) => {
               const val = getOptionValue(el);
               return {
                  $type: 'option' as const,
                  id: `opt-${groupLabel}-${idx}-${stringifyKey(val)}`,
                  value: val,
                  label: getOptionLabel(el),
                  disabled: getOptionDisabled(el),
                  $data: el
               };
            })
         });
      }
      else {
         const val = getOptionValue(curr);
         flatChildren.push({
            $type: 'option',
            id: `opt-flat-${flatChildren.length}-${stringifyKey(val)}`,
            value: val,
            label: getOptionLabel(curr),
            disabled: getOptionDisabled(curr),
            $data: curr
         });
      }
   }

   if (flatChildren.length) {
      result.unshift({
         $type: 'group',
         id: 'group-flat',
         label: '',
         children: flatChildren
      });
   }

   return result;
});

const stringifyKey = (v: any): string => {
   if (v === null || v === undefined) return 'nil';
   if (typeof v === 'object') {
      try {
         return JSON.stringify(v);
      }
      catch {
         return String(v);
      }
   }
   return String(v);
};

// Compute current label (for placeholder fallback / Select display).
const currentOptionLabel = computed(() => {
   for (const g of normalizedOptions.value) {
      const found = g.children.find((opt) => sameValue(opt.value, internalValue.value));
      if (found) return found.label;
   }
   return '';
});

const sameValue = (a: any, b: any): boolean => {
   if (a === b) return true;
   if (a == null || b == null) return false;
   if (typeof a === 'object' && typeof b === 'object') {
      try {
         return JSON.stringify(a) === JSON.stringify(b);
      }
      catch {
         return false;
      }
   }
   return false;
};

const placeholderOrCurrent = computed(() => currentOptionLabel.value || props.placeholder);

// Plain English fallback — does not introduce a new i18n key.
// Will be replaced by an i18n key once the migration to shadcn is complete.
const noResultsText = 'No results';

// Index helper for the `option` slot signature compatibility.
const getFlatIndex = (gIdx: number, oIdx: number) => {
   let count = 0;
   for (let i = 0; i < gIdx; i++) count += normalizedOptions.value[i].children.length;
   return count + oIdx;
};

// Bridge update events back to legacy emits.
const onUpdate = (val: any) => {
   internalValue.value = val;
   emit('update:modelValue', val);
   const matchedOpt = findMatched(val);
   emit('select', matchedOpt ?? val);
   emit('change', matchedOpt ?? val);
};

const findMatched = (val: any): any => {
   for (const g of normalizedOptions.value) {
      const f = g.children.find((opt) => sameValue(opt.value, val));
      if (f) return f.$data;
   }
   return undefined;
};

const onItemSelect = (_e: Event, opt: NormalizedOption) => {
   // ComboboxItem already triggers update:modelValue via root; this hook is
   // kept for callers that may subscribe to per-item @select in the future.
   if (opt.disabled) {
      // intentionally noop for disabled items
   }
};

// Open/close lifecycle → emit 'open' / 'close' / 'blur' (best-effort).
const onOpenChange = (open: boolean) => {
   if (open === isOpen.value) return;
   isOpen.value = open;
   if (open) emit('open');
   else {
      emit('close');
      emit('blur');
   }
};

onMounted(() => {
   // Touch reactive deps so initial render is consistent.
   const _ = normalizedOptions.value;
   if (_.length < 0) { /* unreachable */ }
});
</script>

<style lang="scss" scoped>
/* Keep a thin wrapper so legacy ".form-select" / "small-select" classes from
   callers still receive the BaseSelect baseline behavior without re-introducing
   spectre styling. */
.select-base {
   display: inline-flex;
   align-items: center;
   width: 100%;
   position: relative;

   &__input {
      width: 100%;
      padding-right: 24px;
   }

   &__trigger {
      position: absolute;
      right: 4px;
      top: 50%;
      transform: translateY(-50%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 22px;
      width: 22px;
      padding: 0;
      background: transparent;
      border: 0;
      cursor: pointer;
      pointer-events: auto;

      &:disabled {
         cursor: not-allowed;
         opacity: 0.5;
      }
   }

   &__list {
      max-height: 300px;
   }
}
</style>
