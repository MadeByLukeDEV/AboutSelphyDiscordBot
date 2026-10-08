import { prisma } from "@aboutselphy/db";
import { registerCommands } from "../src/register-commands";

try {
  console.log(await registerCommands(true));
} finally {
  await prisma.$disconnect();
}
