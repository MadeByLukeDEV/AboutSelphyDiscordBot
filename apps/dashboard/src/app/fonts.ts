import { Plus_Jakarta_Sans } from "next/font/google";

// Named "--font-sans" directly so it plugs into globals.css's
// `--font-sans: var(--font-sans)` indirection. "latin" already has the German
// umlauts and ß.
export const fontSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});
