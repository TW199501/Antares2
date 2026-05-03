/**
 * Returns a safe, human-readable error message without exposing internal
 * stack traces or file-system paths to API callers.
 */
export function safeErrorMessage (err: unknown): string {
   if (err instanceof Error) return err.message;
   return String(err);
}
