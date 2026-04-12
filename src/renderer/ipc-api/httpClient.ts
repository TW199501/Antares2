import { ref } from 'vue';

const sidecarPort = ref<number>(0);
let noConnectionHandler: ((uid: string) => void) | null = null;

export function setSidecarPort (port: number) {
   sidecarPort.value = port;
}

export function getSidecarPort (): number {
   return sidecarPort.value;
}

export function setNoConnectionHandler (handler: (uid: string) => void) {
   noConnectionHandler = handler;
}

export async function apiCall<T = unknown> (path: string, params?: unknown): Promise<T> {
   const port = sidecarPort.value || 5555;
   const baseUrl = `http://127.0.0.1:${port}`;
   const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: params ? JSON.stringify(params) : undefined
   });

   if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
   }

   const data = await res.json() as T;

   // Auto-reconnect if the sidecar lost the connection (e.g. after a restart)
   if (
      data &&
      typeof data === 'object' &&
      (data as Record<string, unknown>).status === 'error' &&
      typeof (data as Record<string, unknown>).response === 'string' &&
      ((data as Record<string, unknown>).response as string).includes('No active connection')
   ) {
      const uid = params && typeof params === 'object' ? (params as Record<string, unknown>).uid as string : undefined;
      if (uid && noConnectionHandler) noConnectionHandler(uid);
   }

   return data;
}

export function createWebSocket (path: string): WebSocket {
   const baseUrl = `ws://127.0.0.1:${sidecarPort.value}`;
   return new WebSocket(`${baseUrl}${path}`);
}
