// What to log about a caught error: its name and, if present, its code
// (Prisma's P2002, Node's ECONNREFUSED ...). Never the whole object: database
// errors can echo query details or the values being written.
export function errorInfo(error: unknown, { message = false }: { message?: boolean } = {}) {
  if (!(error instanceof Error)) return { name: typeof error };
  const code = (error as { code?: unknown }).code;
  return {
    name: error.name,
    ...(typeof code === "string" ? { code } : {}),
    // Only for errors whose messages are built to be safe (platform clients).
    ...(message ? { message: error.message } : {}),
  };
}
