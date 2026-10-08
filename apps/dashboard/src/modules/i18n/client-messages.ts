import "server-only";
import { getMessages } from "next-intl/server";

type Messages = Awaited<ReturnType<typeof getMessages>>;

/**
 * Only the namespaces the layout's client components use are sent to the
 * browser. A new client component calling useTranslations("X") needs "X" added
 * where this is called (src/app/layout.tsx), or it renders raw keys.
 */
export async function clientMessages(namespaces: string[]): Promise<Messages> {
  const all = (await getMessages()) as Record<string, unknown>;
  return Object.fromEntries(namespaces.filter((n) => n in all).map((n) => [n, all[n]])) as Messages;
}
