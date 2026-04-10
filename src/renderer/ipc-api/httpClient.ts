import { ref } from 'vue';

const sidecarPort = ref<number>(0);

export function setSidecarPort (port: number) {
   sidecarPort.value = port;
}

export function getSidecarPort (): number {
   return sidecarPort.value;
}

export async function apiCall<T = unknown> (path: string, params?: unknown): Promise<T> {
   const baseUrl = `http://127.0.0.1:${sidecarPort.value}`;
   const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: params ? JSON.stringify(params) : undefined
   });

   if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
   }

   return res.json();
}

export function createWebSocket (path: string): WebSocket {
   const baseUrl = `ws://127.0.0.1:${sidecarPort.value}`;
   return new WebSocket(`${baseUrl}${path}`);
}
