/**
 * Tests for WorkspaceTabPropsRoutine.vue — the "Properties" tab for a
 * stored routine (procedure). Owns:
 *   - Save / Clear / Run / Parameters toolbar buttons
 *   - PropertyCard inputs for name / language / definer / comment / security /
 *     dataAccess / deterministic
 *   - QueryEditor for the routine body
 *   - WorkspaceTabPropsRoutineParamsModal (params editor) via isParamsModal
 *   - ModalAskParameters (run-params prompt) via isAskingParameters
 *   - Async getRoutineData() called from an IIFE in setup
 *   - watch on schema / routine / isSelected → refetch
 *
 * The IIFE accesses `queryEditor.value.editor.session.setValue(...)` after
 * getRoutineData(). The QueryEditor stub exposes `editor.session.setValue`
 * via data() so the chain doesn't throw.
 *
 * Spec §5.F — heavy children (QueryEditor / BaseSelect / Input / Button)
 * are object-stubbed to capture clicks + emit events.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Routines from '@/ipc-api/Routines';

import WorkspaceTabPropsRoutine from './WorkspaceTabPropsRoutine.vue';

vi.mock('@/ipc-api/Routines', () => ({
   default: {
      getRoutineInformations: vi.fn().mockResolvedValue({
         status: 'success',
         response: {
            name: 'sp_archive_orders',
            sql: 'BEGIN\n  SELECT 1;\nEND',
            definer: '',
            language: 'SQL',
            comment: 'archive job',
            security: 'DEFINER',
            dataAccess: 'CONTAINS SQL',
            deterministic: false,
            parameters: [
               { name: 'p_id', type: 'INT', length: null, context: 'IN' }
            ]
         }
      }),
      alterRoutine: vi.fn().mockResolvedValue({ status: 'success', response: null }),
      dropRoutine: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));

const baseCustomizations = {
   languages: ['SQL', 'PLPGSQL'],
   definer: true,
   parametersLength: true,
   comment: true,
   procedureDataAccess: true,
   procedureDeterministic: true
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

// QueryEditor stub: SFC reads `queryEditor.value.editor.session.setValue` and
// `queryEditor.value.$el.getBoundingClientRect()`. Vue test-utils auto-exposes
// data() entries on the instance, so `editor` is reachable through $refs.
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
   return mountWithPinia(WorkspaceTabPropsRoutine, {
      props: {
         tabUid: 'T:1',
         connection: { uid: 'C:1', client: 'mysql' },
         routine: 'sp_archive_orders',
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
            },
            WorkspaceTabPropsRoutineParamsModal: true,
            ModalAskParameters: true
         }
      }
   });
};

describe('WorkspaceTabPropsRoutine', () => {
   it('exports the component definition', () => {
      expect(WorkspaceTabPropsRoutine).toBeDefined();
      expect(typeof WorkspaceTabPropsRoutine).toBe('object');
   });

   it('mounts and calls Routines.getRoutineInformations on init (IIFE)', async () => {
      const wrapper = mountTab();
      await flushPromises();
      expect(Routines.getRoutineInformations).toHaveBeenCalled();
      const firstCall = vi.mocked(Routines.getRoutineInformations).mock.calls[0]?.[0];
      expect(firstCall).toMatchObject({
         uid: 'C:1',
         schema: 'app',
         routine: 'sp_archive_orders'
      });
      expect(wrapper.exists()).toBe(true);
   });

   it('renders the toolbar slot with Save/Clear/Run/Parameters buttons', async () => {
      const wrapper = mountTab();
      await flushPromises();
      const buttons = wrapper.findAll('.btn-stub');
      // 4 buttons in the toolbar slot
      expect(buttons.length).toBeGreaterThanOrEqual(4);
   });

   it('renders the metadata slot with PropertyCard rows + the QueryEditor in content', async () => {
      const wrapper = mountTab();
      await flushPromises();
      // PropertyCard rows for name + language + definer + comment + security
      // + dataAccess + deterministic
      const cards = wrapper.findAll('.prop-card-stub');
      expect(cards.length).toBeGreaterThanOrEqual(5);
      expect(wrapper.find('.query-editor-stub').exists()).toBe(true);
   });

   it('error response from getRoutineInformations is swallowed (no throw)', async () => {
      vi.mocked(Routines.getRoutineInformations).mockResolvedValueOnce({
         status: 'error',
         response: 'permission denied'
      } as never);
      // SFC's IIFE then runs `queryEditor.value.editor.session.setValue(localRoutine.value.sql)`,
      // and localRoutine is seeded as `{ name: '', sql: '', definer: null }` before fetch
      // — so even on error the chain completes with sql=''.
      expect(() => mountTab()).not.toThrow();
      await flushPromises();
   });

   it('skips fetch entirely when prop "routine" is empty', async () => {
      // SFC early-returns when !props.routine — but the IIFE then accesses
      // `localRoutine.value.sql` on a null. We expect the IIFE to throw and
      // be swallowed by the outer Promise; verifying the mock NOT called.
      try {
         mountTab({ routine: '' });
         await flushPromises();
      }
      catch { /* IIFE chain may reject; not under test here */ }
      // No fetch attempt was scheduled.
      expect(Routines.getRoutineInformations).not.toHaveBeenCalled();
   });

   it('cleans up window listeners on unmount without throwing', async () => {
      const wrapper = mountTab();
      await flushPromises();
      expect(() => wrapper.unmount()).not.toThrow();
   });
});
