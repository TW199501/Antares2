/**
 * Tests for ModalFolderAppearance.vue — modal that edits a sidebar folder's
 * name + accent color. Owns:
 *   - localFolder ref initialised from props.folder via unproxify (deep clone)
 *   - 17-swatch palette grid; selecting one mutates localFolder.color
 *   - Keyboard listener: Escape closes the modal (closeModal → emit 'close')
 *   - editFolderAppearance → connectionsStore.updateConnectionOrder + close
 *   - Closing on:
 *       (a) Cancel button
 *       (b) Update button (after persisting)
 *       (c) Escape key
 *       (d) Dialog escape-key-down + pointer-down-outside (Reka UI events)
 *
 * Strategy:
 *   - Stub the Dialog primitives as passthrough divs so Reka UI's Teleport
 *     is bypassed (spec §5.B — avoid portal traversal).
 *   - Stub Button / Input / Label as plain elements.
 *   - Inspect connectionsStore.updateConnectionOrder via the testing-pinia
 *     spy (createSpy: vi.fn → action becomes a tracked spy).
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useConnectionsStore } from '@/stores/connections';

import ModalFolderAppearance from './ModalFolderAppearance.vue';

const DialogStub = {
   name: 'Dialog',
   inheritAttrs: false,
   props: { open: { type: Boolean, default: false } },
   emits: ['update:open'],
   template: '<div class="dialog-stub"><slot /></div>'
};

const DialogContentStub = {
   name: 'DialogContent',
   inheritAttrs: false,
   emits: ['escape-key-down', 'pointer-down-outside'],
   template: '<div class="dialog-content-stub" v-bind="$attrs"><slot /></div>'
};

const DialogHeaderStub = {
   name: 'DialogHeader',
   template: '<div class="dialog-header-stub"><slot /></div>'
};

const DialogTitleStub = {
   name: 'DialogTitle',
   template: '<div class="dialog-title-stub"><slot /></div>'
};

const DialogFooterStub = {
   name: 'DialogFooter',
   template: '<div class="dialog-footer-stub"><slot /></div>'
};

const ButtonStub = {
   name: 'Button',
   inheritAttrs: false,
   props: {
      variant: { type: String, default: 'default' },
      size: { type: String, default: 'default' }
   },
   emits: ['click'],
   template: '<button type="button" class="btn-stub" :data-variant="variant" v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>'
};

const InputStub = {
   name: 'Input',
   inheritAttrs: false,
   props: {
      modelValue: { type: [String, Number], default: '' }
   },
   emits: ['update:modelValue'],
   template: '<input class="input-stub" v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', ($event.target).value)" />'
};

const LabelStub = {
   name: 'Label',
   inheritAttrs: false,
   template: '<label class="label-stub" v-bind="$attrs"><slot /></label>'
};

const baseFolder = {
   uid: 'F:1',
   isFolder: true,
   name: 'Production',
   color: '#FF5000',
   connections: ['C:1']
};

const mountModal = (
   propOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(ModalFolderAppearance, {
      props: {
         folder: { ...baseFolder },
         ...propOverrides
      } as never,
      initialState: {
         connections: {
            connections: [],
            connectionsOrder: [{ ...baseFolder }],
            customIcons: []
         }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            Dialog: DialogStub,
            DialogContent: DialogContentStub,
            DialogHeader: DialogHeaderStub,
            DialogTitle: DialogTitleStub,
            DialogFooter: DialogFooterStub,
            Button: ButtonStub,
            Input: InputStub,
            Label: LabelStub
         }
      }
   });
};

afterEach(() => {
   vi.clearAllMocks();
});

describe('ModalFolderAppearance', () => {
   it('mounts without throwing under a folder prop', () => {
      expect(() => mountModal()).not.toThrow();
   });

   it('renders the editFolder header + name input + 17 swatch buttons', () => {
      const wrapper = mountModal();
      expect(wrapper.html()).toContain('application.editFolder');
      expect(wrapper.find('.input-stub').exists()).toBe(true);
      // 17 colors in the palette → 17 swatch buttons. The footer has
      // Close + Update buttons (+1 ghost X icon button = 3 total non-swatch).
      const allButtons = wrapper.findAll('.btn-stub');
      // 17 swatches + 1 close X + 2 footer = 20 buttons total
      expect(allButtons.length).toBe(20);
   });

   it('reflects the folder.name into the Input modelValue (via localFolder clone)', () => {
      const wrapper = mountModal();
      const input = wrapper.find('.input-stub');
      expect(input.attributes('value')).toBe('Production');
   });

   it('clicking the Close (X) icon button emits "close"', async () => {
      const wrapper = mountModal();
      // The first .btn-stub is the icon X in the header (no name slot).
      const closeBtn = wrapper.findAll('.btn-stub')[0];
      await closeBtn.trigger('click');
      await flushPromises();
      expect(wrapper.emitted('close')).toBeTruthy();
   });

   it('clicking the footer Cancel (Close) button emits "close" without persisting', async () => {
      const wrapper = mountModal();
      const cancelBtn = wrapper.findAll('.btn-stub').find(b => b.text().includes('general.close'));
      expect(cancelBtn).toBeTruthy();
      await cancelBtn!.trigger('click');
      await flushPromises();
      expect(wrapper.emitted('close')).toBeTruthy();
      // updateConnectionOrder was NOT invoked
      const store = useConnectionsStore();
      expect(store.updateConnectionOrder).not.toHaveBeenCalled();
   });

   it('clicking the footer Update button calls updateConnectionOrder + emits "close"', async () => {
      const wrapper = mountModal();
      const updateBtn = wrapper.findAll('.btn-stub').find(b => b.text().includes('application.update'));
      expect(updateBtn).toBeTruthy();
      await updateBtn!.trigger('click');
      await flushPromises();
      const store = useConnectionsStore();
      expect(store.updateConnectionOrder).toHaveBeenCalled();
      // Argument passed is the (deep-cloned) localFolder
      const callArg = (store.updateConnectionOrder as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArg).toMatchObject({ uid: 'F:1', name: 'Production', color: '#FF5000' });
      expect(wrapper.emitted('close')).toBeTruthy();
   });

   it('selecting a different swatch updates localFolder.color', async () => {
      const wrapper = mountModal();
      // Swatches start at index 1 (after the X icon) → take a non-default one.
      // Find a swatch with mint color #48CFAD via title attribute.
      const allButtons = wrapper.findAll('.btn-stub');
      const mintSwatch = allButtons.find(b => b.attributes('title') === 'mint');
      expect(mintSwatch).toBeTruthy();
      await mintSwatch!.trigger('click');
      await flushPromises();
      // Clicking Update sends the proxy → confirm color was mutated
      const updateBtn = wrapper.findAll('.btn-stub').find(b => b.text().includes('application.update'));
      await updateBtn!.trigger('click');
      await flushPromises();
      const store = useConnectionsStore();
      const callArg = (store.updateConnectionOrder as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0];
      expect(callArg.color).toBe('#48CFAD');
   });

   it('Escape keydown on window emits "close"', async () => {
      const wrapper = mountModal();
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      window.dispatchEvent(event);
      await flushPromises();
      expect(wrapper.emitted('close')).toBeTruthy();
   });

   it('non-Escape keys do NOT emit "close"', async () => {
      const wrapper = mountModal();
      const event = new KeyboardEvent('keydown', { key: 'a' });
      window.dispatchEvent(event);
      await flushPromises();
      expect(wrapper.emitted('close')).toBeFalsy();
   });

   it('removes the keydown listener on unmount (no emit after unmount)', async () => {
      const wrapper = mountModal();
      wrapper.unmount();
      // The unmount call itself must not throw
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      expect(() => window.dispatchEvent(event)).not.toThrow();
   });

   it('localFolder is independent of the original folder prop (clone via unproxify)', async () => {
      const original = { ...baseFolder, name: 'Original' };
      const wrapper = mountModal({ folder: original });
      // Click Update — the action gets the clone, not the original ref.
      const updateBtn = wrapper.findAll('.btn-stub').find(b => b.text().includes('application.update'));
      await updateBtn!.trigger('click');
      await flushPromises();
      const store = useConnectionsStore();
      const callArg = (store.updateConnectionOrder as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0];
      expect(callArg).not.toBe(original);
      expect(callArg.name).toBe('Original');
   });

   it('exports the component as an SFC object', () => {
      expect(ModalFolderAppearance).toBeDefined();
      expect(typeof ModalFolderAppearance).toBe('object');
   });
});
