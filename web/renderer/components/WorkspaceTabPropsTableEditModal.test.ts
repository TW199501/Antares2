/**
 * Tests for WorkspaceTabPropsTableEditModal.vue ??the per-column edit/create
 * dialog opened from the table-props page. Owns:
 *   - local reactive copy of props.row (deep-cloned so edits don't mutate parent)
 *   - localLength computed get/set that routes to numLength / charLength /
 *     datePrecision / numPrecision based on the field type's group
 *   - currentFieldType lookup against props.dataTypes
 *   - isPrimaryKey / canAutoincrement / isNullable computeds keyed on indexes
 *   - toggleAutoIncrement (also clears default + nullable)
 *   - translateDescription via Ai.translateColumn IPC
 *   - applyChanges ??emit('confirm', cloned local)
 *
 * The component is wrapped in BaseConfirmModal ??same pattern as
 * WorkspaceTabPropsTableForeignModal.test.ts: stub ConfirmModal as a
 * passthrough shell exposing #header / #body slots and re-emitting confirm/hide.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises as _flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Ai from '@/ipc-api/Ai';

import WorkspaceTabPropsTableEditModal from './WorkspaceTabPropsTableEditModal.vue';

vi.mock('@/ipc-api/Ai', () => ({
   default: {
      translateColumn: vi.fn().mockResolvedValue({
         status: 'success',
         response: { description: 'mocked' }
      })
   }
}));

const baseDataTypes = [
   { group: 'integer', types: [{ name: 'INT', length: true }, { name: 'BIGINT', length: true }] },
   { group: 'string', types: [{ name: 'VARCHAR', length: true }, { name: 'TEXT' }] },
   { group: 'float', types: [{ name: 'DECIMAL', length: true, scale: true }] }
];

const baseRow = {
   name: 'user_id',
   type: 'INT',
   numLength: 11,
   charLength: null,
   numPrecision: null,
   numScale: null,
   datePrecision: null,
   nullable: false,
   default: null,
   autoIncrement: false,
   comment: 'fk to users',
   collation: '',
   charset: ''
};

const baseCustomizations = {
   autoIncrement: true,
   nullable: true,
   nullablePrimary: false,
   collation: true,
   comment: true
};

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
   emits: ['update:modelValue'],
   template: '<div class="select-stub" :data-value="String(modelValue)" />'
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

const SwitchStub = {
   name: 'Switch',
   props: {
      modelValue: { type: Boolean, default: false },
      disabled: { type: Boolean, default: false }
   },
   emits: ['update:modelValue'],
   template: '<button type="button" class="switch-stub" :data-checked="String(modelValue)" :data-disabled="String(disabled)" @click="!disabled && $emit(\'update:modelValue\', !modelValue)" />'
};

const _mountModal = (
   propOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(WorkspaceTabPropsTableEditModal, {
      props: {
         row: { ...baseRow },
         indexes: [],
         foreigns: [],
         dataTypes: baseDataTypes,
         customizations: baseCustomizations,
         mode: 'edit',
         ...propOverrides
      } as never,
      initialState: {
         settings: { locale: 'zh-TW' }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            BaseSelect: SelectStub,
            Button: ButtonStub,
            Input: InputStub,
            Label: { template: '<label class="label-stub" v-bind="$attrs"><slot /></label>' },
            Switch: SwitchStub,
            ConfirmModal: ConfirmModalStub
         }
      }
   });
};

describe('WorkspaceTabPropsTableEditModal', () => {
   it('exports the component definition', () => {
      expect(WorkspaceTabPropsTableEditModal).toBeDefined();
      expect(typeof WorkspaceTabPropsTableEditModal).toBe('object');
   });

   it('exposes a setup or render function (SFC compiled object shape)', () => {
      const def = WorkspaceTabPropsTableEditModal as Record<string, unknown>;
      const hasShape = typeof def.setup === 'function' ||
         typeof def.render === 'function' ||
         typeof def.template === 'string' ||
         typeof def.__file === 'string';
      expect(hasShape).toBe(true);
   });

   it('Ai.translateColumn import resolves to a vi.fn mock (not yet called)', () => {
      expect(typeof Ai.translateColumn).toBe('function');
      expect(Ai.translateColumn).not.toHaveBeenCalled();
   });
});
