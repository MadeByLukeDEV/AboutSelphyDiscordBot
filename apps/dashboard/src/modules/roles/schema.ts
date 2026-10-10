import { z } from "zod";

// Types and validation shared by the service, the actions and the client components. No server-only imports.

export const createRoleInput = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.number().int().min(0).max(0xffffff),
  hoist: z.boolean(),
  mentionable: z.boolean(),
});
export type CreateRoleInput = z.infer<typeof createRoleInput>;

export type PanelRoleView = { roleId: string; label: string; emoji: string; description: string };

export type RolePanelView = {
  id: string;
  channelId: string;
  /** Null = a draft, not posted yet. */
  messageId: string | null;
  title: string;
  description: string;
  color: number;
  style: "buttons" | "menu";
  exclusive: boolean;
  roles: PanelRoleView[];
  createdByName: string;
};

export type RolesError =
  | "forbidden"
  | "invalid"
  | "notFound"
  | "botUnavailable"
  | "channelNotFound"
  | "roleNotFound"
  | "roleNotAllowed"
  | "needsPermission"
  | "tooManyRoles"
  | "failed";

export type CreateRoleResult = { ok: true; role: { id: string; name: string; color: number } } | { ok: false; error: RolesError };

/** `posted`: the Discord message now exists (null when the panel was only saved as a draft). */
export type SavePanelResult =
  | { ok: true; panel: RolePanelView; posted: "published" | "updated" | null; postError: RolesError | null }
  | { ok: false; error: RolesError };

export type DeletePanelResult = { ok: true } | { ok: false; error: RolesError };
