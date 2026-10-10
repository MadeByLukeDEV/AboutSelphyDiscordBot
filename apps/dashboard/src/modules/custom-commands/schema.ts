// Types shared by the service, the actions and the client components. No server-only imports.

export type CustomCommandRow = { id: string; name: string; response: string; ephemeral: boolean; enabled: boolean; uses: number; createdByName: string };
export type CustomCommandError = "forbidden" | "invalid" | "badName" | "alreadyExists" | "tooMany" | "notFound" | "failed";
export type SaveCustomCommandResult = { ok: true; botNotified: boolean } | { ok: false; error: CustomCommandError };
