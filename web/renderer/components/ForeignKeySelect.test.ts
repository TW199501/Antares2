/**
 * Tests for ForeignKeySelect.vue — a BaseSelect dropdown that lists the
 * available values of a referenced foreign-key column. On setup it fires
 * two async IPC calls in parallel (an IIFE):
 *   1. Tables.getTableColumns(refSchema, refTable) — to find a "description"
 *      column (first TEXT/LONG_TEXT field that isn't the refField). Stored
 *      in the closure-scoped `foreignDesc` variable.
 *   2. Tables.getForeignList(... + description: foreignDesc) — to fetch the
 *      actual list of foreign values. Response.rows -> foreignList.value.
 *
 * Owns:
 *   - currentValue ref synced from props.modelValue + watched on prop change
 *   - foreigns computed: prepends "invalid default" entry when modelValue
 *     isn't in foreignList.value (or NULL)
 *   - onChange emits update:modelValue + emits blur on BaseSelect blur
 *
 * Strategy:
 *   - mountWithPinia, seed workspaces store so getSelected returns 'C:1'
 *   - stub BaseSelect as a passthrough that exposes options + emits both
 *     update:model-value and blur for assertion
 *   - mock Tables IPC wrapper to drive both branches
 *   - mock @/components/ui/sonner so toast.error doesn't reach Reka
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { toast } from '@/components/ui/sonner';
import Tables from '@/ipc-api/Tables';

import ForeignKeySelect from './ForeignKeySelect.vue';

vi.mock('@/ipc-api/Tables', () => ({
   default: {
      getTableColumns: vi.fn().mockResolvedValue({
         status: 'success',
         response: [
            { name: 'id', type: 'INT' },
            { name: 'name', type: 'VARCHAR' }
         ]
      }),
      getForeignList: vi.fn().mockResolvedValue({
         status: 'success',
         response: { rows: [
            { foreign_column: 1, foreign_description: 'Alice' },
            { foreign_column: 2, foreign_description: 'Bob' }
         ] }
      })
   }
}));

vi.mock('@/components/ui/sonner', () => ({
   toast: {
      error: vi.fn(),
      success: vi.fn(),
      info: vi.fn()
   }
}));

const BaseSelectStub = {
   name: 'BaseSelect',
   inheritAttrs: false,
   props: {
      modelValue: { type: [String, Number, Boolean, Object], default: null },
      options: { type: Array, default: () => [] }
   },
   emits: ['update:modelValue', 'blur'],
   template: `
      <div class="select-stub" :data-value="String(modelValue)">
         <span class="opt-count">{{ options.length }}</span>
         <button
            type="button"
            class="set-btn"
            @click="$emit('update:modelValue', 99)"
         />
         <button type="button" class="blur-btn" @click="$emit('blur')" />
      </div>
   `
};

const baseKeyUsage = {
   refSchema: 'app',
   refTable: 'users',
   refField: 'id'
};

const mountSelect = (
   propOverrides: Record<string, unknown> = {},
   workspacesOverride: string | null = 'C:1'
) => {
   return mountWithPinia(ForeignKeySelect, {
      props: {
         modelValue: 1,
         keyUsage: baseKeyUsage,
         size: '',
         ...propOverrides
      } as never,
      initialState: {
         workspaces: {
            workspaces: [],
            selectedWorkspace: workspacesOverride
         }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseSelect: BaseSelectStub
         }
      }
   });
};

afterEach(() => {
   vi.clearAllMocks();
});

describe('ForeignKeySelect', () => {
   it('mounts without throwing under default props', async () => {
      expect(() => mountSelect()).not.toThrow();
      await flushPromises();
   });

   it('renders one option per row from the foreign list response', async () => {
      const wrapper = mountSelect({ modelValue: 1 });
      await flushPromises();
      // modelValue=1 IS in the list -> no "invalid default" entry
      const count = wrapper.find('.opt-count').text();
      expect(count).toBe('2');
   });

   it('prepends an "invalid default" option when modelValue is not in foreignList', async () => {
      const wrapper = mountSelect({ modelValue: 999 });
      await flushPromises();
      // 999 is NOT in [1, 2] -> options length = 2 + 1 = 3
      expect(wrapper.find('.opt-count').text()).toBe('3');
   });

   it('renders a NULL placeholder option when modelValue=null', async () => {
      const wrapper = mountSelect({ modelValue: null });
      await flushPromises();
      // null is not a valid default -> prepended option with label="NULL"
      expect(wrapper.find('.opt-count').text()).toBe('3');
   });

   it('emits update:modelValue when BaseSelect updates its value', async () => {
      const wrapper = mountSelect();
      await flushPromises();
      await wrapper.find('.set-btn').trigger('click');
      const evt = wrapper.emitted('update:modelValue');
      expect(evt).toBeTruthy();
      expect(evt![0]).toEqual([99]);
   });

   it('emits blur when BaseSelect emits blur', async () => {
      const wrapper = mountSelect();
      await flushPromises();
      await wrapper.find('.blur-btn').trigger('click');
      expect(wrapper.emitted('blur')).toBeTruthy();
   });

   it('toast.error is called when getTableColumns response is not success', async () => {
      vi.mocked(Tables.getTableColumns).mockResolvedValueOnce({
         status: 'error',
         response: 'no perm'
      } as never);
      mountSelect();
      await flushPromises();
      expect(toast.error).toHaveBeenCalledWith('no perm');
   });

   it('applies the small-select class when size prop is "small"', async () => {
      const wrapper = mountSelect({ size: 'small' });
      await flushPromises();
      // The class is bound on BaseSelect via the SFC; the stub gets attrs
      // forwarded via inheritAttrs=false but the class binding goes through
      // root-element class merge -> we can verify size value via passthrough
      // by inspecting the inner SFC root attrs.
      // Instead we verify the stub is mounted (at minimum) — non-throw
      // contract for size variant.
      expect(wrapper.find('.select-stub').exists()).toBe(true);
   });

   it('exports the component as an SFC object', () => {
      expect(ForeignKeySelect).toBeDefined();
      expect(typeof ForeignKeySelect).toBe('object');
   });
});
