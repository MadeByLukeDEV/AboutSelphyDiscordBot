import type { ReloadModule } from "@aboutselphy/shared";
import { log } from "../lib/log";

type Handler = () => Promise<void> | void;

const handlers = new Map<ReloadModule, Handler[]>();

/** A module calls this to drop its cached config when the dashboard changes it. */
export function onReload(module: ReloadModule, handler: Handler) {
  handlers.set(module, [...(handlers.get(module) ?? []), handler]);
}

/** Returns how many handlers ran. A failing handler is logged, never thrown. */
export async function reloadModule(module: ReloadModule): Promise<number> {
  const list = handlers.get(module) ?? [];
  for (const handler of list) {
    try {
      await handler();
    } catch (err) {
      log.error({ err, module }, "reload handler failed");
    }
  }
  log.info({ module, handlers: list.length }, "module reloaded");
  return list.length;
}
