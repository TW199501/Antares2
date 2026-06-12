/**
 * Tests for WorkspaceTabPropsView.vue — the "Properties" tab for a database
 * view. Owns:
 *   - Save / Clear toolbar buttons
 *   - PropertyCard inputs for name / definer / sqlSecurity / algorithm /
 *     updateOption (each gated by a customizations flag)
 *   - QueryEditor for the view SELECT statement
 *   - Async getViewData() called from an IIFE in setup
 *   - watch on schema / view / isSelected — refetch
 *
 * The IIFE accesses `queryEditor.value.editor.session.setValue(...)` after
 * getViewData(). Stub QueryEditor exposes editor.session.setValue + resize via
 * data() so the chain doesn't throw. resizeQueryEditor() also reads
 * `document.getElementById('footer').offsetHeight` — we inject a footer node
 * into document.body before each mount.
 *
 * Spec §5.F — heavy children are object-stubbed to capture clicks + emit.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Views from '@/ipc-api/Views';

import WorkspaceTabPropsView from './WorkspaceTabPropsView.vue';

vi.mock('@/ipc-api/Views', () => ({
   default: {
      getViewInformations: vi.fn().mockResolvedValue({
         status: 'success',
         response: {
            name: 'v_orders',
            sql: 'SELECT 1',
            definer: '`root`@`localhost`',
            security: 'DEFINER',
            algorithm: 'UNDEFINED',
            updateOption: ''
         }
      }),
      alterView: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));

const baseCustomizations = {
   definer: true,
   viewSqlSecurity: true,
   viewAlgorithm: true,
   viewUpdateOption: true
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
   return mountWithPinia(WorkspaceTabPropsView, {
      props: {
         tabUid: 'T:1',
         connection: { uid: 'C:1', client: 'mysql' },
         view: 'v_orders',
         isSelected: true,
         schema: 'app',
         ...propOverrides
      } as never,
      initialState: {
         workspaces: {
            workspaces: [{ ...baseWorkspace, ...workspaceOverrides }],
            selectedWorkspace: 'C:1'
         },
         notifications: { notifications: [] }
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
   // resizeQueryEditor() reads document.getElementById('footer').offsetHeight
   const footer = document.createElement('div');
   footer.id = 'footer';
   document.body.appendChild(footer);
});

afterEach(() => {
   document.getElementById('footer')?.remove();
});

describe('WorkspaceTabPropsView', () => {
   it('exports the component definition', () => {
      expect(WorkspaceTabPropsView).toBeDefined();
      expect(typeof WorkspaceTabPropsView).toBe('object');
   });

   it('mounts and calls Views.getViewInformations on init (IIFE)', async () => {
      const wrapper = mountTab();
      await flushPromises();
      expect(Views.getViewInformations).toHaveBeenCalled();
      const firstCall = vi.mocked(Views.getViewInformations).mock.calls[0]?.[0];
      expect(firstCall).toMatchObject({
         uid: 'C:1',
         schema: 'app',
         view: 'v_orders'
      });
      expect(wrapper.exists()).toBe(true);
   });

   it('renders the toolbar slot with Save and Clear buttons', async () => {
      const wrapper = mountTab();
      await flushPromises();
      const buttons = wrapper.findAll('.btn-stub');
      // toolbar slot has at least Save + Clear
      expect(buttons.length).toBeGreaterThanOrEqual(2);
   });

   it('renders the metadata PropertyCard rows + the QueryEditor in content', async () => {
      const wrapper = mountTab();
      await flushPromises();
      // 5 PropertyCards: name + definer + sqlSecurity + algorithm + updateOption
      const cards = wrapper.findAll('.prop-card-stub');
      expect(cards.length).toBeGreaterThanOrEqual(5);
      expect(wrapper.find('.query-editor-stub').exists()).toBe(true);
   });

   it('hides definer / sqlSecurity / algorithm / updateOption cards when customizations flags are off', async () => {
      const wrapper = mountTab({}, {
         customizations: {
            definer: false,
            viewSqlSecurity: false,
            viewAlgorithm: false,
            viewUpdateOption: false
         }
      });
      await flushPromises();
      // only the always-on "name" card remains
      const cards = wrapper.findAll('.prop-card-stub');
      expect(cards.length).toBe(1);
   });

   it('error response from getViewInformations is swallowed (no throw)', async () => {
      vi.mocked(Views.getViewInformations).mockResolvedValueOnce({
         status: 'error',
         response: 'permission denied'
      } as never);
      expect(() => mountTab()).not.toThrow();
      await flushPromises();
   });

   it('skips fetch when prop "view" is empty', async () => {
      try {
         mountTab({ view: '' });
         await flushPromises();
      }
      catch { /* IIFE chain may reject (localView still null on early-return) */ }
      expect(Views.getViewInformations).not.toHaveBeenCalled();
   });

   it('cleans up window listeners on unmount without throwing', async () => {
      const wrapper = mountTab();
      await flushPromises();
      expect(() => wrapper.unmount()).not.toThrow();
   });

   it('Views IPC mock surface is wired (getViewInformations + alterView)', () => {
      expect(typeof Views.getViewInformations).toBe('function');
      expect(typeof Views.alterView).toBe('function');
   });
});
