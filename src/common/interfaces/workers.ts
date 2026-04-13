export type WorkerControlEvent = 'start' | 'abort' | 'init' | 'cancel'
export type WorkerProgressEvent = 'export-progress' | 'import-progress' | 'query-error'
export type WorkerTerminalEvent = 'end' | 'cancel' | 'error'
export type WorkerEvent = WorkerControlEvent | WorkerProgressEvent | WorkerTerminalEvent

export interface WorkerControlMessage<T = Record<string, unknown>> {
   type: WorkerControlEvent;
   params?: T;
}

export interface WorkerProgressMessage<T = unknown> {
   type: WorkerProgressEvent;
   payload: T;
}

export interface WorkerTerminalMessage<T = unknown> {
   type: WorkerTerminalEvent;
   payload?: T;
}

export type WorkerIpcMessage<T = unknown> =
   | WorkerControlMessage
   | WorkerProgressMessage<T>
   | WorkerTerminalMessage<T>
