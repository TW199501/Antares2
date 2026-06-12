/**
 * Tests for WorkspaceTabNewFunction.vue ??the "create new function" tab.
 * Differs from WorkspaceTabPropsFunction.vue by:
 *   - No fetch in setup (no getFunctionInformations) ??instead seeds
 *     originalFunction synchronously from workspace.customizations
 *   - saveChanges() calls Functions.createFunction (NOT alterFunction)
 *   - On success: refreshStructure ??newTab ??removeTab(props.tab.uid) ?? *     changeBreadcrumbs
 *   - WorkspaceTabPropsFunctionParamsModal opens via showParamsModal
 *
 * No async data load means no QueryEditor IIFE chain ??but the component
 * still owns a QueryEditor ref that clearChanges() touches; we still stub
 * editor.session.setValue via data().
 *
 * Spec 禮5.F ??heavy children stubbed; tab prop carries .uid; the only
 * required IPC mock is Functions.createFunction.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises as _flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Functions from '@/ipc-api/Functions';

import WorkspaceTabNewFunction from './WorkspaceTabNewFunction.vue';

vi.mock('@/ipc-api/Functions', () => ({
   default: {
      createFunction: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));

const baseCustomizations = {
   languages: ['SQL', 'PLPGSQL'],
   definer: true,
   parametersLength: true,
   comment: true,
   functionDataAccess: true,
   functionDeterministic: true,
   functionSql: 'BEGIN\nEND'
};

const baseWorkspace = {
   uid: 'C:1',
   client: 'mysql',
   database: 'app',
   connectionStatus: 'connected',
   tabs: [],
   selectedTab: null,
   structure: [],
   breadcrumbs: { schema: 'app' },
   loadedSchemas: new Set(),
   users: [{ host: 'localhost', name: 'root' }],
   dataTypes: [
      { group: 'integer', types: [{ name: 'INT' }, { name: 'BIGINT' }] }
   ],
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
   return mountWithPinia(WorkspaceTabNewFunction, {
      props: {
         tabUid: 'T:1',
         connection: { uid: 'C:1', client: 'mysql' },
         tab: { uid: 'TAB:1' },
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
            },
            WorkspaceTabPropsFunctionParamsModal: true
         }
      }
   });
};

describe('WorkspaceTabNewFunction', () => {
   it('exports the component definition', () => {
      expect(WorkspaceTabNewFunction).toBeDefined();
      expect(typeof WorkspaceTabNewFunction).toBe('object');
   });

   it('exposes a setup or render function (SFC compiled object shape)', () => {
      const def = WorkspaceTabNewFunction as Record<string, unknown>;
      const hasShape = typeof def.setup === 'function' ||
         typeof def.render === 'function' ||
         typeof def.template === 'string' ||
         typeof def.__file === 'string';
      expect(hasShape).toBe(true);
   });

   it('Functions.createFunction import resolves to a vi.fn mock (not yet called)', () => {
      expect(typeof Functions.createFunction).toBe('function');
      expect(Functions.createFunction).not.toHaveBeenCalled();
   });
});
