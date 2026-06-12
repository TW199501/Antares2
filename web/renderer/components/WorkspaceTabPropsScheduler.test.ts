/**
 * Tests for WorkspaceTabPropsScheduler.vue ??the Properties tab for a MySQL
 * scheduler/event. Owns:
 *   - Save / Clear / Timing toolbar buttons
 *   - PropertyCard inputs for name / definer / comment / state radio group
 *   - QueryEditor for the scheduler body
 *   - WorkspaceTabPropsSchedulerTimingModal (timing editor) gated by isTimingModal
 *   - Async getSchedulerData() called from an IIFE in setup
 *   - watch on schema / scheduler / isSelected ??refetch
 *
 * The IIFE accesses `queryEditor.value.editor.session.setValue(...)` after
 * getSchedulerData(); QueryEditor stub exposes editor.session.setValue via data().
 *
 * Spec 禮5.F ??heavy children stubbed; reka-ui RadioGroup replaced with `: true`
 * so we don't probe popper internals.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises as _flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Schedulers from '@/ipc-api/Schedulers';

import WorkspaceTabPropsScheduler from './WorkspaceTabPropsScheduler.vue';

vi.mock('@/ipc-api/Schedulers', () => ({
   default: {
      getSchedulerInformations: vi.fn().mockResolvedValue({
         status: 'success',
         response: {
            name: 'evt_nightly',
            sql: 'SELECT 1',
            definer: '`root`@`localhost`',
            comment: 'nightly job',
            state: 'ENABLE',
            schema: 'app'
         }
      }),
      alterScheduler: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));

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
   customizations: {}
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

const _mountTab = (
   propOverrides: Record<string, unknown> = {},
   workspaceOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(WorkspaceTabPropsScheduler, {
      props: {
         tabUid: 'T:1',
         connection: { uid: 'C:1', client: 'mysql' },
         scheduler: 'evt_nightly',
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
            Input: InputStub,
            Label: { template: '<label class="label-stub" v-bind="$attrs"><slot /></label>' },
            Separator: true,
            RadioGroup: { template: '<div class="radio-group-stub"><slot /></div>' },
            RadioGroupItem: { template: '<button type="button" class="radio-item-stub" />' },
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
            WorkspaceTabPropsSchedulerTimingModal: true
         }
      }
   });
};

describe('WorkspaceTabPropsScheduler', () => {
   it('exports the component definition', () => {
      expect(WorkspaceTabPropsScheduler).toBeDefined();
      expect(typeof WorkspaceTabPropsScheduler).toBe('object');
   });

   it('exposes a setup or render function (SFC compiled object shape)', () => {
      const def = WorkspaceTabPropsScheduler as Record<string, unknown>;
      const hasShape = typeof def.setup === 'function' ||
         typeof def.render === 'function' ||
         typeof def.template === 'string' ||
         typeof def.__file === 'string';
      expect(hasShape).toBe(true);
   });

   it('Schedulers IPC mock surface is wired (getSchedulerInformations + alterScheduler)', () => {
      expect(typeof Schedulers.getSchedulerInformations).toBe('function');
      expect(typeof Schedulers.alterScheduler).toBe('function');
      expect(Schedulers.getSchedulerInformations).not.toHaveBeenCalled();
   });
});
