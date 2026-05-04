/**
 * Tests for BaseMap.
 *
 * Wraps Leaflet (`leaflet` npm package) which is entirely DOM-dependent —
 * happy-dom can't satisfy its `L.map(id)` getBoundingClientRect / canvas needs,
 * so the whole `leaflet` module is mocked at module scope. Tests verify the
 * wrapper's mount-time wiring: which Leaflet constructors get called with
 * which geometry derived from the `points` prop. We do NOT exercise tile
 * loading, projection math, or any Leaflet internal — that's the lib's
 * responsibility, not ours.
 */
import { mount } from '@vue/test-utils';
import * as L from 'leaflet';
import { describe, expect, it, vi } from 'vitest';

import BaseMap from './BaseMap.vue';

const mapMock = {
   setMaxBounds: vi.fn(),
   fitBounds: vi.fn(),
   addLayer: vi.fn(),
   remove: vi.fn()
};
const geoJsonMock = {
   addTo: vi.fn(() => geoJsonMock),
   getBounds: vi.fn(() => ({}))
};
const tileLayerMock = { addTo: vi.fn(() => tileLayerMock) };
const attributionMock = { addTo: vi.fn(() => attributionMock) };

vi.mock('leaflet', () => {
   const L = {
      map: vi.fn(() => mapMock),
      geoJSON: vi.fn(() => geoJsonMock),
      tileLayer: vi.fn(() => tileLayerMock),
      circleMarker: vi.fn(),
      latLng: vi.fn((a: number, b: number) => ({ lat: a, lng: b })),
      latLngBounds: vi.fn(() => ({})),
      control: { attribution: vi.fn(() => attributionMock) }
   };
   return { ...L, default: L };
});

describe('BaseMap', () => {
   it('mounts without throwing for a single point', () => {
      expect(() =>
         mount(BaseMap, {
            props: { points: { x: 10, y: 20 } }
         })
      ).not.toThrow();
   });

   it('initializes a Leaflet map on mount', () => {
      mount(BaseMap, { props: { points: { x: 10, y: 20 } } });
      expect(L.map).toHaveBeenCalledTimes(1);
      // First arg should be the element id used in the template
      expect((L.map as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('map');
   });

   it('centers on the provided single point [y, x]', () => {
      mount(BaseMap, { props: { points: { x: 10, y: 20 } } });
      const opts = (L.map as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
      // Source: center.value = [points.y, points.x]
      expect(opts.center).toEqual([20, 10]);
      expect(opts.zoom).toBe(15);
   });

   it('fits bounds (no explicit center) when points is an array (lineString case)', () => {
      mount(BaseMap, {
         props: {
            points: [
               { x: 1, y: 2 },
               { x: 3, y: 4 }
            ]
         }
      });
      // For arrays, source falls through center.value (null) → fitBounds is called
      expect(mapMock.fitBounds).toHaveBeenCalled();
   });

   it('passes a tileLayer and applies max bounds', () => {
      mount(BaseMap, { props: { points: { x: 0, y: 0 } } });
      expect(L.tileLayer).toHaveBeenCalled();
      expect(mapMock.setMaxBounds).toHaveBeenCalled();
   });

   it('builds a geoJSON layer once with the configured marker style options', () => {
      mount(BaseMap, { props: { points: { x: 1, y: 2 } } });
      expect(L.geoJSON).toHaveBeenCalledTimes(1);
      const styleArg = (L.geoJSON as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
      // The wrapper passes a function-style `style` and a `pointToLayer` callback
      expect(typeof styleArg.style).toBe('function');
      expect(typeof styleArg.pointToLayer).toBe('function');
   });
});
