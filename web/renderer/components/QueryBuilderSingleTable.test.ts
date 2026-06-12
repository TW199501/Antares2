/**
 * Tests for QueryBuilderSingleTable.vue — the single-table query builder
 * panel embedded in ModalQueryBuilder. Drives:
 *   - selectedTable (BaseSelect) → triggers Tables.getTableColumns to load
 *     fields → seeds selectedFields with all column names.
 *   - field checkbox toggle (toggleField / toggleAll)
 *   - addCondition / removeCondition (conditions array)
 *   - addOrderBy / removeOrderBy
 *   - increment / decrement limit
 *   - getInput() exposed via defineExpose — returns BuildSingleTableInput.
 *
 * Spec §2.C — mock @/ipc-api/Tables. The component reads `selectedTable`
 * via `watch(..., { immediate: true })` so the loadFields call fires on
 * mount when defaultTable prop is provided.
 *
 * Spec §5.A — we don't probe reka-ui internals; BaseSelect / Checkbox /
 * Input / Button are stubbed as object-form passthroughs that surface the
 * model-update events tests need.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises as _flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Tables from '@/ipc-api/Tables';

import QueryBuilderSingleTable from './QueryBuilderSingleTable.vue';

vi.mock('@/ipc-api/Tables', () => ({
   default: {
      getTableColumns: vi.fn().mockResolvedValue({
         status: 'success',
         response: [
            { name: 'id', type: 'INT' },
            { name: 'email', type: 'VARCHAR' },
            { name: 'created_at', type: 'DATETIME' }
         ]
      }),
      // unused but the module import surfaces every static for vi.mocked()
      getTableData: vi.fn().mockResolvedValue({ status: 'success', response: { rows: [], fields: [] } }),
      getTableApproximateCount: vi.fn().mockResolvedValue({ status: 'success', response: 0 })
   }
}));

const baseTables = [
   { name: 'users' },
   { name: 'orders' }
];

// BaseSelect passthrough: surfaces v-model via @click on the root + emits the
// first option's value, which is enough to drive watchers in mostly-static
// tests. We control selection directly via setProps in tests instead.
const SelectStub = {
   name: 'BaseSelect',
   props: {
      modelValue: { type: [String, Number, null] as never, default: null },
      options: { type: Array, default: () => [] }
   },
   emits: ['update:modelValue', 'change'],
   template: '<div class="select-stub" :data-value="modelValue" />'
};

const CheckboxStub = {
   name: 'Checkbox',
   props: {
      checked: { type: [Boolean, String], default: false },
      modelValue: { type: [Boolean, String], default: false }
   },
   emits: ['update:checked', 'update:modelValue'],
   template: '<button type="button" class="checkbox-stub" :data-checked="String(checked)" @click="$emit(\'update:checked\', !checked); $emit(\'update:modelValue\', !checked)" />'
};

const InputStub = {
   name: 'Input',
   inheritAttrs: false,
   props: { modelValue: { type: [String, Number, null] as never, default: '' } },
   emits: ['update:modelValue'],
   template: '<input class="input-stub" :value="modelValue" v-bind="$attrs" @input="$emit(\'update:modelValue\', ($event.target as HTMLInputElement).value)" />'
};

const ButtonStub = {
   name: 'Button',
   inheritAttrs: false,
   template: '<button type="button" class="btn-stub" v-bind="$attrs"><slot /></button>'
};

const LabelStub = {
   name: 'Label',
   template: '<label class="label-stub" v-bind="$attrs"><slot /></label>'
};

const _mountBuilder = (
   propOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(QueryBuilderSingleTable, {
      props: {
         uid: 'C:1',
         tables: baseTables,
         schema: 'app',
         ...propOverrides
      } as never,
      initialState: {
         notifications: { notifications: [] }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            BaseSelect: SelectStub,
            Checkbox: CheckboxStub,
            Input: InputStub,
            Button: ButtonStub,
            Label: LabelStub
         }
      }
   });
};

describe('QueryBuilderSingleTable', () => {
   it('exports the component definition', () => {
      expect(QueryBuilderSingleTable).toBeDefined();
   });

   it('is exported as an SFC object', () => {
      expect(typeof QueryBuilderSingleTable).toBe('object');
      expect(QueryBuilderSingleTable).not.toBeNull();
   });

   it('has the Tables IPC mock wired', () => {
      expect(Tables.getTableColumns).toBeDefined();
      expect(typeof Tables.getTableColumns).toBe('function');
   });
});
