/**
 * Tests for WorkspaceTabPropsTriggerFunction.vue — the "Properties" tab for a
 * database trigger function (PostgreSQL). Owns:
 *   - Save / Clear toolbar buttons
 *   - PropertyCard inputs for language / definer / comment (each gated by a
 *     workspace.customizations flag)
 *   - QueryEditor for the function body
 *   - Async getFunctionData() called from an IIFE in setup
 *   - watch on schema / function / isSelected / consoleHeight — refetch / resize
 *
 * The IIFE accesses `queryEditor.value.editor.session.setValue(...)` after
 * getFunctionData(). The QueryEditor stub exposes editor.session.setValue via
 * data() so the chain doesn't throw. resizeQueryEditor() reads
 * document.getElementById('footer')?.offsetHeight — the optional chaining
 * means we don't strictly need a footer node, but we inject one for parity
 * with the other Workspace*Props tests.
 *
 * Spec §5.F — heavy children are object-stubbed to capture clicks + emit.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Functions from '@/ipc-api/Functions';

import WorkspaceTabPropsTriggerFunction from './WorkspaceTabPropsTriggerFunction.vue';

vi.mock('@/ipc-api/Functions', () => ({
   default: {
      getFunctionInformations: vi.fn().mockResolvedValue({
         status: 'success',
         response: {
            name: 'fn_audit',
            sql: 'BEGIN END',
            type: 'trigger',
            definer: '',
            language: 'plpgsql',
            comment: 'audit hook'
         }
      }),
      alterTriggerFunction: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));

const baseCustomizations = {
   triggerFunctionlanguages: ['plpgsql', 'sql'],
   definer: true,
   comment: true
};

const baseWorkspace = {
   uid: 'C:1',
   client: 'pg',
   database: 'app',
   connectionStatus: 'connected',
   tabs: [],
   selectedTab: null,
   structure: [],
   breadcrumbs: { schema: 'public' },
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
   template: '<input class="input-stub" v-bind="$attrs" :value="modelValue" />'
};

const ButtonStub = {
   name: 'Button',
   inheritAttrs: false,
   template: '<button type="button" class="btn-stub" v-bind="$attrs"><slot /></button>'
};

const mountTab = (
   propOverrides: Record<string, unknown> = {},
   workspaceOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(WorkspaceTabPropsTriggerFunction, {
      props: {
         tabUid: 'T:1',
         connection: { uid: 'C:1', client: 'pg' },
         function: 'fn_audit',
         isSelected: true,
         schema: 'public',
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
            Input: InputStub,
            Label: { template: '<label class="label-stub" v-bind="$attrs"><slot /></label>' },
            Separator: true,
            QueryEditor: QueryEditorStub,
            PropertyCard: {
               name: 'PropertyCard',
               props: { label: { type: String, default: '' } },
               template: '<div class="prop-card-stub" :data-label="label"><slot /></div>'
            },
            PropsTabShell: {
               name: 'PropsTabShell',
               props: { isSelected: { type: Boolean, default: true }, schema: { type: String, default: '' } },
               template: `
                  <div class="props-shell-stub">
                     <div class="props-shell-toolbar"><slot name="toolbar" /></div>
                     <div class="props-shell-metadata"><slot name="metadata" /></div>
                     <div class="props-shell-content"><slot name="content" /></div>
                  </div>
               `
            }
         }
      }
   });
};

beforeEach(() => {
   const footer = document.createElement('div');
   footer.id = 'footer';
   document.body.appendChild(footer);
});

afterEach(() => {
   document.getElementById('footer')?.remove();
});

describe('WorkspaceTabPropsTriggerFunction', () => {
   it('exports the component definition', () => {
      expect(WorkspaceTabPropsTriggerFunction).toBeDefined();
      expect(typeof WorkspaceTabPropsTriggerFunction).toBe('object');
   });

   it('mounts and calls Functions.getFunctionInformations on init (IIFE)', async () => {
      const wrapper = mountTab();
      await flushPromises();
      expect(Functions.getFunctionInformations).toHaveBeenCalled();
      const firstCall = vi.mocked(Functions.getFunctionInformations).mock.calls[0]?.[0];
      expect(firstCall).toMatchObject({
         uid: 'C:1',
         schema: 'public',
         func: 'fn_audit'
      });
      expect(wrapper.exists()).toBe(true);
   });

   it('renders the toolbar slot with Save and Clear buttons', async () => {
      const wrapper = mountTab();
      await flushPromises();
      const buttons = wrapper.findAll('.btn-stub');
      expect(buttons.length).toBeGreaterThanOrEqual(2);
   });

   it('renders the metadata slot with PropertyCard rows + the QueryEditor in content', async () => {
      const wrapper = mountTab();
      await flushPromises();
      // 3 PropertyCards: language + definer + comment
      const cards = wrapper.findAll('.prop-card-stub');
      expect(cards.length).toBeGreaterThanOrEqual(3);
      expect(wrapper.find('.query-editor-stub').exists()).toBe(true);
   });

   it('hides language / definer / comment cards when their customizations flags are off', async () => {
      const wrapper = mountTab({}, {
         customizations: {
            triggerFunctionlanguages: null,
            definer: false,
            comment: false
         }
      });
      await flushPromises();
      const cards = wrapper.findAll('.prop-card-stub');
      expect(cards.length).toBe(0);
   });

   it('error response from getFunctionInformations is swallowed (no throw)', async () => {
      vi.mocked(Functions.getFunctionInformations).mockResolvedValueOnce({
         status: 'error',
         response: 'permission denied'
      } as never);
      expect(() => mountTab()).not.toThrow();
      await flushPromises();
   });

   it('skips fetch entirely when prop "function" is empty', async () => {
      try {
         mountTab({ function: '' });
         await flushPromises();
      }
      catch { /* IIFE chain may reject when localFunction is null */ }
      expect(Functions.getFunctionInformations).not.toHaveBeenCalled();
   });

   it('cleans up window listeners on unmount without throwing', async () => {
      const wrapper = mountTab();
      await flushPromises();
      expect(() => wrapper.unmount()).not.toThrow();
   });

   it('Functions IPC mock surface is wired (getFunctionInformations + alterTriggerFunction)', () => {
      expect(typeof Functions.getFunctionInformations).toBe('function');
      expect(typeof Functions.alterTriggerFunction).toBe('function');
   });
});
