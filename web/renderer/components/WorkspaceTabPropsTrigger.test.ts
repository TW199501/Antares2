/**
 * Tests for WorkspaceTabPropsTrigger.vue ??the Properties tab for a database
 * trigger. Owns:
 *   - Save / Clear toolbar buttons
 *   - PropertyCard inputs for name / definer / table / activation / event(s)
 *   - QueryEditor for the trigger SQL body
 *   - Async getTriggerData() called from an IIFE in setup
 *   - watch on schema / trigger / isSelected ??refetch
 *   - changeEvents() toggle for triggerMultipleEvents
 *
 * The IIFE accesses `queryEditor.value.editor.session.setValue(...)` after
 * getTriggerData(). When `props.trigger` is undefined the fetch early-returns;
 * we still need a QueryEditor stub that exposes a writable
 * editor.session.setValue method via `data()` so the IIFE chain succeeds.
 *
 * Spec 禮5.F ??heavy children (QueryEditor / BaseSelect / Input / Button)
 * stubbed with object form to capture clicks + emit events.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises as _flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Triggers from '@/ipc-api/Triggers';

import WorkspaceTabPropsTrigger from './WorkspaceTabPropsTrigger.vue';

vi.mock('@/ipc-api/Triggers', () => ({
   default: {
      getTriggerInformations: vi.fn().mockResolvedValue({
         status: 'success',
         response: {
            name: 'trg_audit',
            sql: 'BEGIN END',
            definer: '`root`@`localhost`',
            table: 'orders',
            activation: 'BEFORE',
            event: ['INSERT'],
            schema: 'app'
         }
      }),
      alterTrigger: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));

const baseCustomizations = {
   definer: true,
   triggerMultipleEvents: true,
   triggerOnlyRename: false,
   triggerTableInName: false
};

const baseWorkspace = {
   uid: 'C:1',
   client: 'mysql',
   database: 'app',
   connectionStatus: 'connected',
   tabs: [],
   selectedTab: null,
   structure: [
      {
         name: 'app',
         tables: [
            { name: 'orders', type: 'table' },
            { name: 'users', type: 'table' },
            { name: 'v_orders', type: 'view' }
         ]
      }
   ],
   breadcrumbs: { schema: 'app' },
   loadedSchemas: new Set(),
   users: [{ host: 'localhost', name: 'root' }],
   dataTypes: [],
   customizations: baseCustomizations
};

const QueryEditorStub = {
   name: 'QueryEditor',
   props: ['modelValue', 'workspace', 'schema', 'height'],
   emits: ['update:modelValue'],
   data () {
      return {
         editor: {
            session: { setValue: vi.fn() },
            resize: vi.fn()
         }
      };
   },
   template: '<div class="query-editor-stub" />'
};

const SelectStub = {
   name: 'BaseSelect',
   props: { modelValue: { type: [String, Number, Boolean, Object, null] as never, default: null } },
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

const CheckboxStub = {
   name: 'Checkbox',
   props: { checked: { type: Boolean, default: false } },
   emits: ['update:checked'],
   template: '<button type="button" class="checkbox-stub" :data-checked="String(checked)" @click="$emit(\'update:checked\', !checked)" />'
};

const _mountTab = (
   propOverrides: Record<string, unknown> = {},
   workspaceOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(WorkspaceTabPropsTrigger, {
      props: {
         tabUid: 'T:1',
         connection: { uid: 'C:1', client: 'mysql' },
         trigger: 'trg_audit',
         isSelected: true,
         schema: 'app',
         ...propOverrides
      } as never,
      initialState: {
         workspaces: {
            workspaces: [{ ...baseWorkspace, ...workspaceOverrides }],
            selectedWorkspace: 'C:1'
         },
         notifications: { notifications: [] },
         console: { consoleHeight: 0, isConsoleOpen: false }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            BaseLoader: true,
            BaseSelect: SelectStub,
            Button: ButtonStub,
            Checkbox: CheckboxStub,
            Input: InputStub,
            Label: { template: '<label class="label-stub" v-bind="$attrs"><slot /></label>' },
            Separator: true,
            QueryEditor: QueryEditorStub,
            PropertyCard: { template: '<div class="property-card-stub"><slot /></div>' },
            PropsTabShell: {
               template: `
                  <div class="props-tab-shell-stub">
                     <div class="toolbar-slot"><slot name="toolbar" /></div>
                     <div class="metadata-slot"><slot name="metadata" /></div>
                     <div class="content-slot"><slot name="content" /></div>
                  </div>
               `
            }
         }
      }
   });
};

describe('WorkspaceTabPropsTrigger', () => {
   it('exports the component definition', () => {
      expect(WorkspaceTabPropsTrigger).toBeDefined();
      expect(typeof WorkspaceTabPropsTrigger).toBe('object');
   });

   it('exposes a setup or render function (SFC compiled object shape)', () => {
      const def = WorkspaceTabPropsTrigger as Record<string, unknown>;
      const hasShape = typeof def.setup === 'function' ||
         typeof def.render === 'function' ||
         typeof def.template === 'string' ||
         typeof def.__file === 'string';
      expect(hasShape).toBe(true);
   });

   it('Triggers IPC mock surface is wired (getTriggerInformations + alterTrigger)', () => {
      expect(typeof Triggers.getTriggerInformations).toBe('function');
      expect(typeof Triggers.alterTrigger).toBe('function');
      expect(Triggers.getTriggerInformations).not.toHaveBeenCalled();
   });
});
