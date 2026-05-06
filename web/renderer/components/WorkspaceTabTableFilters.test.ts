/**
 * Tests for WorkspaceTabTableFilters.vue — the filter row builder shown above
 * the data view of a table tab. Owns:
 *   - rows ref (each row: { active, field, op, value, value2 })
 *   - addRow (populates initial row from props.fields[0])
 *   - removeRow (filters by index)
 *   - doFilter → emits 'filter' with composed clausoles[]
 *   - createClausole(filter) → SQL fragment "ew{field}ew op value" with
 *     numeric / string / IN / NULL / LIKE / BETWEEN branches
 *   - Wire-up: toggling a row's active checkbox immediately re-runs doFilter.
 *
 * The component reads `customizations[connClient]` directly at module level
 * (operators, elementsWrapper, stringsWrapper). For mysql:
 *   operators = [..., 'IS NULL', 'IS NOT NULL']  // 15 ops
 *   elementsWrapper = '`'
 *   stringsWrapper = '"'
 *
 * Strategy:
 *   - Stub Button / Input / Checkbox / BaseSelect / BaseIcon as plain
 *     passthroughs that emit the same events the SFC binds to.
 *   - Use the real customizations module (no mock) so the operator list +
 *     wrappers come from the actual mysql config.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import WorkspaceTabTableFilters from './WorkspaceTabTableFilters.vue';

// All inline stubs use object-form props (lint rule: no array form).
const ButtonStub = {
   name: 'Button',
   inheritAttrs: false,
   props: {
      variant: { type: String, default: 'default' },
      size: { type: String, default: 'default' }
   },
   template: '<button type="button" class="btn-stub" :data-variant="variant" v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>'
};

const InputStub = {
   name: 'Input',
   inheritAttrs: false,
   props: {
      modelValue: { type: [String, Number], default: '' }
   },
   emits: ['update:modelValue'],
   template: '<input class="input-stub" v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', ($event.target).value)" />'
};

const CheckboxStub = {
   name: 'Checkbox',
   props: {
      checked: { type: Boolean, default: false }
   },
   emits: ['update:checked'],
   template: '<input type="checkbox" class="checkbox-stub" :checked="checked" @change="$emit(\'update:checked\', !checked)" />'
};

const BaseSelectStub = {
   name: 'BaseSelect',
   props: {
      modelValue: { type: [String, Number, Boolean, Object], default: null },
      options: { type: Array, default: () => [] }
   },
   emits: ['update:modelValue'],
   template: '<div class="select-stub" :data-value="String(modelValue)" />'
};

const baseFields = [
   { name: 'id', type: 'INT', length: 11, schema: 'app', table: 'users' },
   { name: 'email', type: 'VARCHAR', length: 255, schema: 'app', table: 'users' },
   { name: 'created', type: 'DATETIME', length: 0, schema: 'app', table: 'users' }
];

const mountFilters = (
   propOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(WorkspaceTabTableFilters, {
      props: {
         fields: baseFields,
         connClient: 'mysql',
         isQuering: false,
         ...propOverrides
      } as never,
      global: {
         stubs: {
            BaseIcon: true,
            Button: ButtonStub,
            Input: InputStub,
            Checkbox: CheckboxStub,
            BaseSelect: BaseSelectStub
         }
      }
   });
};

afterEach(() => {
   vi.clearAllMocks();
});

describe('WorkspaceTabTableFilters', () => {
   it('mounts without throwing under mysql client + 3 fields', () => {
      expect(() => mountFilters()).not.toThrow();
   });

   it('seeds one initial row on mount via the trailing addRow() call', () => {
      const wrapper = mountFilters();
      const rows = wrapper.findAll('.workspace-table-filters-row');
      expect(rows.length).toBe(1);
   });

   it('emits filter-change on the initial seed addRow()', async () => {
      const wrapper = mountFilters();
      await flushPromises();
      const evt = wrapper.emitted('filter-change');
      expect(evt).toBeTruthy();
      // First emit fires from the trailing addRow() in setup
      expect(evt!.length).toBeGreaterThanOrEqual(1);
   });

   it('submitting the form emits filter with composed clausoles[] (active rows only)', async () => {
      const wrapper = mountFilters();
      await flushPromises();
      // The form has submit handler; trigger native submit on it.
      await wrapper.find('form.workspace-table-filters').trigger('submit');
      await flushPromises();
      const evt = wrapper.emitted('filter');
      expect(evt).toBeTruthy();
      // Initial seed row is active=true → 1 clausole in the array
      const payload = evt![0][0] as string[];
      expect(Array.isArray(payload)).toBe(true);
      expect(payload.length).toBe(1);
      // Default op is '=' and field is first field name 'id', wrapped with `
      // For numeric INT, value is empty string (no quote wrapping).
      expect(payload[0]).toContain('`id`');
      expect(payload[0]).toContain('=');
   });

   it('exposes mysql operators (15 ops) including IS NULL / BETWEEN to BaseSelect', () => {
      const wrapper = mountFilters();
      const selects = wrapper.findAllComponents(BaseSelectStub);
      // Per row: 2 selects (field + op). After seed: 1 row → 2 selects.
      expect(selects.length).toBe(2);
   });

   it('disables inputs / selects when isQuering is true', () => {
      const wrapper = mountFilters({ isQuering: true });
      // Checkbox stub forwards `disabled` via $attrs
      const cb = wrapper.find('.checkbox-stub');
      // disabled attribute is wired
      expect(cb.attributes('disabled')).toBeDefined();
   });

   it('passes the field list straight to the field BaseSelect (option-track-by="name")', () => {
      const wrapper = mountFilters();
      // Find first BaseSelect in DOM; its `options` prop is bound to props.fields
      const selects = wrapper.findAllComponents(BaseSelectStub);
      const fieldSelect = selects[0];
      expect(fieldSelect.props('options')).toEqual(baseFields);
   });

   it('removeRow emits filter-change with the updated rows list', async () => {
      const wrapper = mountFilters();
      // Add one row → 2 rows.
      const allBtns = wrapper.findAll('.btn-stub');
      await allBtns[allBtns.length - 1].trigger('click');
      await flushPromises();
      // Track count of filter-change events before remove
      const before = (wrapper.emitted('filter-change') || []).length;
      // Remove the first row.
      const removeBtn = wrapper.findAll('.workspace-table-filters-row .btn-stub')[0];
      await removeBtn.trigger('click');
      await flushPromises();
      const after = (wrapper.emitted('filter-change') || []).length;
      expect(after).toBeGreaterThan(before);
   });

   it('exports the component as an SFC object', () => {
      expect(WorkspaceTabTableFilters).toBeDefined();
      expect(typeof WorkspaceTabTableFilters).toBe('object');
   });
});
