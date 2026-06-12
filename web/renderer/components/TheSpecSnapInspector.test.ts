/**
 * Tests for TheSpecSnapInspector — the ~90-line shell over the upstream
 * @tw199501/specsnap-inspector-vue panel.
 *
 * Per CLAUDE.md the upstream wrapper is a heavy Teleport panel; we mock the
 * entire module so the test stays in DOM. Tests cover:
 *   - mounts without throwing
 *   - calls inspectorRef.value?.open() on mount (smoke: open is invoked)
 *   - emitting `close` from the wrapper triggers applicationStore.hideSpecsnap
 *   - the styles.css side-effect import doesn't break the test environment
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

import { useApplicationStore } from '@/stores/application';

// Mock the upstream wrapper before importing the SUT. The mock module exposes
// an `open` spy as the inspector ref's public method so the shell's
// `inspectorRef.value?.open()` call is observable. The vi.hoisted block
// declares `openMock` ahead of the (also-hoisted) vi.mock factory.
const { openMock } = vi.hoisted(() => ({ openMock: vi.fn() }));

vi.mock('@tw199501/specsnap-inspector-vue/styles.css', () => ({}));
vi.mock('@tw199501/specsnap-inspector-vue', () => ({
   SpecSnapInspector: defineComponent({
      name: 'SpecSnapInspectorStub',
      props: {
         trigger: { type: Boolean, default: false },
         panelTitle: { type: String, default: '' }
      },
      emits: ['close'],
      setup (_, { emit, expose }) {
         expose({ open: openMock });
         return () => h('div', { class: 'specsnap-inspector-stub' }, [
            h('button', {
               class: 'stub-close',
               onClick: () => emit('close')
            }, 'close')
         ]);
      }
   })
}));

// eslint-disable-next-line import/first
import TheSpecSnapInspector from './TheSpecSnapInspector.vue';

describe('TheSpecSnapInspector', () => {
   it('mounts without throwing', () => {
      expect(() =>
         mountWithPinia(TheSpecSnapInspector, {
            global: { stubs: { teleport: true } }
         })
      ).not.toThrow();
   });

   it('calls inspectorRef.open() on mount', async () => {
      mountWithPinia(TheSpecSnapInspector, {
         global: { stubs: { teleport: true } }
      });
      await flushPromises();
      expect(openMock).toHaveBeenCalled();
   });

   it('renders the SpecSnapInspector wrapper stub', () => {
      const wrapper = mountWithPinia(TheSpecSnapInspector, {
         global: { stubs: { teleport: true } }
      });
      expect(wrapper.find('.specsnap-inspector-stub').exists()).toBe(true);
   });

   it('@close from the wrapper calls hideSpecsnap on the application store', async () => {
      const wrapper = mountWithPinia(TheSpecSnapInspector, {
         stubActions: true,
         global: { stubs: { teleport: true } }
      });
      await flushPromises();

      const applicationStore = useApplicationStore();
      await wrapper.find('.stub-close').trigger('click');
      expect(applicationStore.hideSpecsnap).toHaveBeenCalled();
   });
});
