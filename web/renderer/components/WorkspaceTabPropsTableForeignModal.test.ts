/**
 * Tests for WorkspaceTabPropsTableForeignModal.vue — the foreign-key editor
 * dialog opened from the table-props tab. Owns:
 *   - foreignProxy (deep-cloned localKeyUsage on mount)
 *   - selectedForeignID with selectedForeignObj computed
 *   - addForeign / removeIndex / clearChanges
 *   - toggleField / toggleRefField
 *   - getRefFields → Tables.getTableColumns for the reference table
 *   - reloadRefFields on refTable change
 *   - confirmForeignsChange filters + emits 'foreigns-update'
 *
 * The component is mostly prop-driven. Stub ConfirmModal as a passthrough
 * shell that exposes the #header / #body slots and re-emits @confirm /
 * @hide so tests can drive both terminations.
 *
 * Spec §5.A — we don't probe reka-ui internals; ConfirmModal is replaced by
 * a slot-passthrough shell.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Tables from '@/ipc-api/Tables';

import WorkspaceTabPropsTableForeignModal from './WorkspaceTabPropsTableForeignModal.vue';

vi.mock('@/ipc-api/Tables', () => ({
   default: {
      getTableColumns: vi.fn().mockResolvedValue({
         status: 'success',
         response: [
            { name: 'id', type: 'INT', table: 'users' },
            { name: 'email', type: 'VARCHAR', table: 'users' }
         ]
      })
   }
}));

const baseFields = [
   { name: 'user_id', type: 'INT', comment: 'fk owner' },
   { name: 'order_no', type: 'VARCHAR' }
];

const baseSchemaTables = [
   { name: 'users' },
   { name: 'orders' }
];

const baseWorkspace = {
   uid: 'C:1',
   client: 'mysql',
   customizations: {
      foreignActions: ['CASCADE', 'SET NULL', 'NO ACTION', 'RESTRICT']
   }
};

const seedKeyUsage = () => [
   {
      _antares_id: 'FK:1',
      constraintName: 'FK_orders_user',
      refSchema: 'app',
      table: 'orders',
      refTable: 'users',
      field: 'user_id',
      refField: 'id',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
   }
];

// Pass-through shell for BaseConfirmModal: exposes header + body slots and
// re-emits the two events the SFC emits up.
const ConfirmModalStub = {
   name: 'ConfirmModal',
   inheritAttrs: false,
   emits: ['confirm', 'hide'],
   template: `
      <div class="confirm-modal-stub" v-bind="$attrs">
         <div class="cm-header"><slot name="header" /></div>
         <div data-modal-body class="cm-body"><slot name="body" /></div>
         <button type="button" class="cm-confirm-btn" @click="$emit('confirm')">confirm</button>
         <button type="button" class="cm-hide-btn" @click="$emit('hide')">hide</button>
      </div>
   `
};

const SelectStub = {
   name: 'BaseSelect',
   props: { modelValue: { type: [String, Number, null] as never, default: null } },
   emits: ['update:modelValue', 'change'],
   template: '<div class="select-stub" :data-value="String(modelValue)" />'
};

const CheckboxStub = {
   name: 'Checkbox',
   props: { modelValue: { type: Boolean, default: false } },
   emits: ['update:modelValue'],
   template: '<button type="button" class="checkbox-stub" :data-checked="String(modelValue)" @click="$emit(\'update:modelValue\', !modelValue)" />'
};

const InputStub = {
   name: 'Input',
   inheritAttrs: false,
   props: { modelValue: { type: [String, Number, null] as never, default: '' } },
   emits: ['update:modelValue'],
   template: '<input class="input-stub" v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', ($event.target as HTMLInputElement).value)" />'
};

const ButtonStub = {
   name: 'Button',
   inheritAttrs: false,
   template: '<button type="button" class="btn-stub" v-bind="$attrs"><slot /></button>'
};

const mountModal = (
   propOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(WorkspaceTabPropsTableForeignModal, {
      props: {
         localKeyUsage: seedKeyUsage(),
         connection: { uid: 'C:1', client: 'mysql' },
         table: 'orders',
         schema: 'app',
         schemaTables: baseSchemaTables,
         fields: baseFields,
         workspace: baseWorkspace,
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
            Button: ButtonStub,
            Checkbox: CheckboxStub,
            Input: InputStub,
            Label: { template: '<label class="label-stub" v-bind="$attrs"><slot /></label>' },
            ConfirmModal: ConfirmModalStub
         }
      }
   });
};

describe('WorkspaceTabPropsTableForeignModal', () => {
   it('mounts without throwing under a seeded keyUsage', async () => {
      expect(() => mountModal()).not.toThrow();
      await flushPromises();
   });

   it('renders the ConfirmModal shell with header + body slots', async () => {
      const wrapper = mountModal();
      await flushPromises();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(true);
      expect(wrapper.html()).toContain('database.foreignKeys');
      // Table name appears in the header
      expect(wrapper.html()).toContain('orders');
   });

   it('renders one row per foreign key in foreignProxy after mount', async () => {
      const wrapper = mountModal();
      await flushPromises();
      // The FK list rows have the constraint name FK_orders_user
      expect(wrapper.html()).toContain('FK_orders_user');
   });

   it('renders the empty-state hint when localKeyUsage is empty', async () => {
      const wrapper = mountModal({ localKeyUsage: [] });
      await flushPromises();
      expect(wrapper.html()).toContain('database.thereAreNoForeign');
   });

   it('Clear button is disabled when foreignProxy matches localKeyUsage', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const clearBtn = wrapper.findAll('.btn-stub').find(b => b.text().includes('general.clear'));
      expect(clearBtn).toBeTruthy();
      // No changes yet → isChanged false → disabled forwarded via $attrs
      expect(clearBtn!.attributes('disabled')).toBeDefined();
   });

   it('calls Tables.getTableColumns on mount when a FK already has a refTable', async () => {
      mountModal();
      await flushPromises();
      expect(Tables.getTableColumns).toHaveBeenCalled();
      const firstCall = vi.mocked(Tables.getTableColumns).mock.calls[0]?.[0];
      expect(firstCall).toMatchObject({
         uid: 'C:1',
         schema: 'app',
         table: 'users'
      });
   });

   it('does NOT call Tables.getTableColumns when the seeded FK has no refTable', async () => {
      mountModal({
         localKeyUsage: [
            {
               _antares_id: 'FK:N',
               constraintName: 'FK_new',
               refSchema: 'app',
               table: 'orders',
               refTable: '',
               field: '',
               refField: '',
               onUpdate: 'CASCADE',
               onDelete: 'CASCADE'
            }
         ]
      });
      await flushPromises();
      expect(Tables.getTableColumns).not.toHaveBeenCalled();
   });

   it('hide event from ConfirmModal forwards as a "hide" emit', async () => {
      const wrapper = mountModal();
      await flushPromises();
      await wrapper.find('.cm-hide-btn').trigger('click');
      await flushPromises();
      expect(wrapper.emitted('hide')).toBeTruthy();
   });

   it('error response from Tables.getTableColumns is swallowed (no throw)', async () => {
      vi.mocked(Tables.getTableColumns).mockResolvedValueOnce({
         status: 'error',
         response: 'permission denied'
      } as never);
      expect(() => mountModal()).not.toThrow();
      await flushPromises();
   });

   it('rejected getTableColumns is also swallowed (mount stays alive)', async () => {
      vi.mocked(Tables.getTableColumns).mockRejectedValueOnce(new Error('boom'));
      const wrapper = mountModal();
      await flushPromises();
      expect(wrapper.exists()).toBe(true);
   });
});
