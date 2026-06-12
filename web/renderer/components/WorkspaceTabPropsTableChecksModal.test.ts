/**
 * Tests for WorkspaceTabPropsTableChecksModal.vue — the table-check editor
 * dialog opened from the table-props tab. Owns:
 *   - checksProxy initialised from a deep-clone of props.localChecks on mount
 *   - selectedCheckID with selectedCheckObj computed
 *   - addCheck / removeCheck / clearChanges / resetSelectedID
 *   - confirmChecksChange filters non-empty clauses + emits 'checks-update'
 *   - selectCheck (skip when target has class 'remove-field')
 *
 * The component is mostly prop-driven. ConfirmModal is replaced with a
 * passthrough shell that re-emits @confirm and @hide so we can drive both
 * terminations without hitting reka-ui internals.
 *
 * Spec §5.A — we don't probe data-state attributes; we exercise stubs.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import WorkspaceTabPropsTableChecksModal from './WorkspaceTabPropsTableChecksModal.vue';

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

const InputStub = {
   name: 'Input',
   inheritAttrs: false,
   props: { modelValue: { type: [String, Number, null] as never, default: '' } },
   emits: ['update:modelValue'],
   template: '<input class="input-stub" v-bind="$attrs" :value="modelValue" />'
};

const ButtonStub = {
   name: 'Button',
   inheritAttrs: false,
   emits: ['click'],
   template: '<button type="button" class="btn-stub" v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>'
};

const baseWorkspace = {
   uid: 'C:1',
   client: 'mysql'
};

const seedChecks = () => [
   { _antares_id: 'CHK:1', name: 'CHK_amount_pos', clause: 'amount > 0' },
   { _antares_id: 'CHK:2', name: 'CHK_status', clause: 'status IN (\'A\',\'B\')' }
];

const mountModal = (
   propOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(WorkspaceTabPropsTableChecksModal, {
      props: {
         localChecks: seedChecks(),
         table: 'orders',
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
            Button: ButtonStub,
            Input: InputStub,
            Label: { template: '<label class="label-stub" v-bind="$attrs"><slot /></label>' },
            ConfirmModal: ConfirmModalStub
         }
      }
   });
};

describe('WorkspaceTabPropsTableChecksModal', () => {
   it('mounts without throwing when seeded with checks', async () => {
      expect(() => mountModal()).not.toThrow();
      await flushPromises();
   });

   it('renders the ConfirmModal shell with header containing the table name', async () => {
      const wrapper = mountModal();
      await flushPromises();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(true);
      expect(wrapper.html()).toContain('database.tableChecks');
      expect(wrapper.html()).toContain('orders');
   });

   it('renders one row per check from props.localChecks', async () => {
      const wrapper = mountModal();
      await flushPromises();
      expect(wrapper.html()).toContain('CHK_amount_pos');
      expect(wrapper.html()).toContain('CHK_status');
      expect(wrapper.html()).toContain('amount &gt; 0');
   });

   it('renders the empty state when localChecks is an empty array', async () => {
      const wrapper = mountModal({ localChecks: [] });
      await flushPromises();
      expect(wrapper.html()).toContain('database.thereAreNoTableChecks');
      expect(wrapper.html()).toContain('database.createNewCheck');
   });

   it('Clear button is disabled when checksProxy matches localChecks (no edits)', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const clearBtn = wrapper.findAll('.btn-stub').find(b => b.text().includes('general.clear'));
      expect(clearBtn).toBeTruthy();
      expect(clearBtn!.attributes('disabled')).toBeDefined();
   });

   it('Add button is enabled and visible regardless of state', async () => {
      const wrapper = mountModal({ localChecks: [] });
      await flushPromises();
      const addBtn = wrapper.findAll('.btn-stub').find(b => b.text().includes('general.add'));
      expect(addBtn).toBeTruthy();
      // No disabled attribute on Add
      expect(addBtn!.attributes('disabled')).toBeUndefined();
   });

   it('hide event from ConfirmModal forwards as a "hide" emit', async () => {
      const wrapper = mountModal();
      await flushPromises();
      await wrapper.find('.cm-hide-btn').trigger('click');
      await flushPromises();
      expect(wrapper.emitted('hide')).toBeTruthy();
   });

   it('confirm event emits checks-update with the seeded checks (filtered to non-empty clauses)', async () => {
      const wrapper = mountModal();
      await flushPromises();
      await wrapper.find('.cm-confirm-btn').trigger('click');
      await flushPromises();
      const events = wrapper.emitted('checks-update');
      expect(events).toBeTruthy();
      const payload = events![0][0] as Array<{ name: string; clause: string }>;
      expect(payload.length).toBe(2);
      expect(payload.map(c => c.name)).toContain('CHK_amount_pos');
   });

   it('confirm filters out checks with empty/whitespace clauses', async () => {
      const wrapper = mountModal({
         localChecks: [
            { _antares_id: 'CHK:1', name: 'CHK_keep', clause: 'a > 0' },
            { _antares_id: 'CHK:2', name: 'CHK_drop', clause: '   ' }
         ]
      });
      await flushPromises();
      await wrapper.find('.cm-confirm-btn').trigger('click');
      await flushPromises();
      const events = wrapper.emitted('checks-update');
      expect(events).toBeTruthy();
      const payload = events![0][0] as Array<{ name: string; clause: string }>;
      expect(payload.length).toBe(1);
      expect(payload[0].name).toBe('CHK_keep');
   });

   it('initial selection (when checks present) populates the editor form', async () => {
      const wrapper = mountModal();
      await flushPromises();
      // The form is rendered when selectedCheckObj is non-null. The first
      // check is auto-selected via resetSelectedID() in onMounted.
      expect(wrapper.find('form').exists()).toBe(true);
      // Name + checkClause labels must appear in the form column
      expect(wrapper.html()).toContain('general.name');
      expect(wrapper.html()).toContain('database.checkClause');
   });

   it('renders the empty-state Add button when no checks exist', async () => {
      const wrapper = mountModal({ localChecks: [] });
      await flushPromises();
      // Empty state CTA: createNewCheck inside its own button (no form)
      expect(wrapper.find('form').exists()).toBe(false);
      expect(wrapper.html()).toContain('database.createNewCheck');
   });

   it('exports the component definition', () => {
      expect(WorkspaceTabPropsTableChecksModal).toBeDefined();
      expect(typeof WorkspaceTabPropsTableChecksModal).toBe('object');
   });
});
