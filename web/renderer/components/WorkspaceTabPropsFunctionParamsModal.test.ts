/**
 * Tests for WorkspaceTabPropsFunctionParamsModal.vue — the modal dialog
 * that edits a function's parameter list.
 *
 * The modal owns:
 *   - parametersProxy ref initialised on mount from props.localParameters
 *   - selectedParam + selectedParamObj computed lookup
 *   - addParameter (uses uidGen + workspace.dataTypes[0].types[0].name)
 *   - removeParameter / clearChanges
 *   - confirmParametersChange → emits 'parameters-update'
 *   - typeClass(type) → "type-..." className
 *   - getModalInnerHeight (DOM measurement, called onMount + on resize)
 *
 * Strategy:
 *   - Stub ConfirmModal as a slot-passthrough shell that re-emits
 *     @confirm and @hide (matching ForeignModal test's pattern).
 *   - Stub BaseSelect / Button / Input / Label / RadioGroup* as
 *     passthroughs so the param form template renders in DOM.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import WorkspaceTabPropsFunctionParamsModal from './WorkspaceTabPropsFunctionParamsModal.vue';

const baseDataTypes = [
   {
      group: 'integer',
      types: [
         { name: 'INT', length: 11 }
      ]
   },
   {
      group: 'string',
      types: [
         { name: 'VARCHAR', length: 255 }
      ]
   }
];

const baseWorkspace = {
   uid: 'C:1',
   client: 'mysql',
   dataTypes: baseDataTypes,
   customizations: {
      parametersLength: true,
      functionContext: true
   }
};

const seedParameters = () => [
   {
      _antares_id: 'P:1',
      name: 'p_uid',
      type: 'INT',
      context: 'IN',
      length: ''
   },
   {
      _antares_id: 'P:2',
      name: 'p_email',
      type: 'VARCHAR',
      context: 'OUT',
      length: '255'
   }
];

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

const BaseSelectStub = {
   name: 'BaseSelect',
   props: { modelValue: { type: [String, Number, Boolean, Object], default: null } },
   emits: ['update:modelValue'],
   template: '<div class="select-stub" :data-value="String(modelValue)" />'
};

const ButtonStub = {
   name: 'Button',
   inheritAttrs: false,
   props: { variant: { type: String, default: 'default' }, size: { type: String, default: 'default' } },
   template: '<button type="button" class="btn-stub" :data-variant="variant" v-bind="$attrs"><slot /></button>'
};

const InputStub = {
   name: 'Input',
   inheritAttrs: false,
   props: { modelValue: { type: [String, Number], default: '' } },
   emits: ['update:modelValue'],
   template: '<input class="input-stub" v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
};

const RadioGroupStub = {
   name: 'RadioGroup',
   props: { modelValue: { type: String, default: '' } },
   emits: ['update:modelValue'],
   template: '<div class="radio-group-stub" :data-value="modelValue"><slot /></div>'
};

const RadioGroupItemStub = {
   name: 'RadioGroupItem',
   props: { value: { type: String, default: '' } },
   template: '<button type="button" class="radio-item-stub" :data-value="value" />'
};

const mountModal = (
   propOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(WorkspaceTabPropsFunctionParamsModal, {
      props: {
         localParameters: seedParameters(),
         func: 'fn_pick_user',
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
            BaseSelect: BaseSelectStub,
            ConfirmModal: ConfirmModalStub,
            Button: ButtonStub,
            Input: InputStub,
            Label: { template: '<label class="label-stub" v-bind="$attrs"><slot /></label>' },
            RadioGroup: RadioGroupStub,
            RadioGroupItem: RadioGroupItemStub
         }
      }
   });
};

afterEach(() => {
   vi.clearAllMocks();
});

describe('WorkspaceTabPropsFunctionParamsModal', () => {
   it('mounts without throwing under a seeded 2-parameter list', async () => {
      expect(() => mountModal()).not.toThrow();
      await flushPromises();
   });

   it('renders the ConfirmModal shell with header showing func name', async () => {
      const wrapper = mountModal();
      await flushPromises();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(true);
      expect(wrapper.html()).toContain('database.parameters');
      expect(wrapper.html()).toContain('fn_pick_user');
   });

   it('renders one .param-row per parameter after mount populates parametersProxy', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const rows = wrapper.findAll('.param-row');
      expect(rows.length).toBe(2);
      // First row shows p_uid (and INT)
      expect(rows[0].text()).toContain('p_uid');
      expect(rows[0].text()).toContain('INT');
   });

   it('renders empty-state when localParameters is empty', async () => {
      const wrapper = mountModal({ localParameters: [] });
      await flushPromises();
      expect(wrapper.html()).toContain('database.thereAreNoParameters');
      expect(wrapper.findAll('.param-row').length).toBe(0);
   });

   it('Clear button is disabled while parametersProxy matches the prop seed', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const clearBtn = wrapper.findAll('.btn-stub').find(b => b.text().includes('general.clear'));
      expect(clearBtn).toBeTruthy();
      // No mutations yet → isChanged false → disabled forwarded via $attrs
      expect(clearBtn!.attributes('disabled')).toBeDefined();
   });

   it('confirm event from ConfirmModal emits parameters-update with the proxy list', async () => {
      const wrapper = mountModal();
      await flushPromises();
      await wrapper.find('.cm-confirm-btn').trigger('click');
      await flushPromises();
      const evt = wrapper.emitted('parameters-update');
      expect(evt).toBeTruthy();
      expect(Array.isArray(evt![0][0])).toBe(true);
      expect((evt![0][0] as unknown[]).length).toBe(2);
   });

   it('hide event from ConfirmModal forwards as a "hide" emit', async () => {
      const wrapper = mountModal();
      await flushPromises();
      await wrapper.find('.cm-hide-btn').trigger('click');
      await flushPromises();
      expect(wrapper.emitted('hide')).toBeTruthy();
   });

   it('omits the IN/OUT/INOUT radios when customizations.functionContext is false', async () => {
      const wrapper = mountModal({
         workspace: {
            ...baseWorkspace,
            customizations: { parametersLength: true, functionContext: false }
         }
      });
      await flushPromises();
      await wrapper.findAll('.param-row')[0].trigger('click');
      await flushPromises();
      expect(wrapper.findAll('.radio-group-stub').length).toBe(0);
   });
});
