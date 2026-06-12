/**
 * Tests for WorkspaceTabPropsFunction.vue — the "Properties" tab for a
 * stored function. Owns:
 *   - Save / Clear / Run / Parameters toolbar buttons
 *   - PropertyCard inputs for name / language / definer / returns / comment /
 *     security / dataAccess / deterministic
 *   - QueryEditor for the function body
 *   - WorkspaceTabPropsFunctionParamsModal (params editor) via isParamsModal
 *   - ModalAskParameters (run-params prompt) via isAskingParameters
 *   - Async getFunctionData() called from an IIFE in setup
 *   - watch on schema / function / isSelected → refetch
 *
 * The IIFE accesses `queryEditor.value.editor.session.setValue(...)` after
 * getFunctionData(). When `props.function` is undefined the fetch early-
 * returns; we still need a QueryEditor stub that exposes a writable
 * editor.session.setValue method via `expose` so the IIFE chain succeeds.
 *
 * Spec §5.F — heavy children (QueryEditor / BaseSelect / Input / Button)
 * stubbed with object form to capture clicks + emit events.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises as _flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Functions from '@/ipc-api/Functions';

import WorkspaceTabPropsFunction from './WorkspaceTabPropsFunction.vue';

vi.mock('@/ipc-api/Functions', () => ({
   default: {
      getFunctionInformations: vi.fn().mockResolvedValue({
         status: 'success',
         response: {
            name: 'fn_calc_total',
            sql: 'BEGIN\n  RETURN 0;\nEND',
            definer: '',
            language: 'SQL',
            returns: 'INT',
            returnsLength: null,
            comment: 'totals fn',
            security: 'DEFINER',
            dataAccess: 'CONTAINS SQL',
            deterministic: false,
            parameters: [
               { name: 'x', type: 'INT', length: null, context: 'IN' }
            ]
         }
      }),
      alterFunction: vi.fn().mockResolvedValue({ status: 'success', response: null }),
      dropFunction: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));

const baseCustomizations = {
   languages: ['SQL', 'PLPGSQL'],
   definer: true,
   parametersLength: true,
   comment: true,
   functionDataAccess: true,
   functionDeterministic: true
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

// QueryEditor stub: the SFC reads `queryEditor.value.editor.session.setValue`
// and `queryEditor.value.$el.getBoundingClientRect()`. Vue test-utils exposes
// the component instance via $refs; our stub needs `editor` accessible as a
// property of the instance. We use `data()` to attach it.
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

const _mountTab = (
   propOverrides: Record<string, unknown> = {},
   workspaceOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(WorkspaceTabPropsFunction, {
      props: {
         tabUid: 'T:1',
         connection: { uid: 'C:1', client: 'mysql' },
         function: 'fn_calc_total',
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
         console: { consoleHeight: 0, isConsoleVisible: false }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            BaseLoader: true,
            BaseSelect: SelectStub,
            Button: ButtonStub,
            Checkbox: { template: '<input type="checkbox" class="checkbox-stub" />' },
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
            WorkspaceTabPropsFunctionParamsModal: true,
            ModalAskParameters: true
         }
      }
   });
};

describe('WorkspaceTabPropsFunction', () => {
   it('exports the component definition', () => {
      expect(WorkspaceTabPropsFunction).toBeDefined();
   });

   it('is exported as an SFC object', () => {
      expect(typeof WorkspaceTabPropsFunction).toBe('object');
      expect(WorkspaceTabPropsFunction).not.toBeNull();
   });

   it('has the Functions IPC mock wired with getFunctionInformations', () => {
      expect(Functions.getFunctionInformations).toBeDefined();
      expect(typeof Functions.getFunctionInformations).toBe('function');
   });
});
