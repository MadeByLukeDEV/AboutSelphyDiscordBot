"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// Class-based theming (globals.css's `.dark {}` block), system default, manual
// override persisted by next-themes. Pass `nonce`: next-themes injects an
// inline script to apply the theme before paint.
//
// The script is rendered as a runnable <script> on the server (with the CSP
// nonce). When React creates the element on the client instead (after a render
// error or remount) it never runs, and React 19 warns "Encountered a script
// tag while rendering React component". A non-JavaScript type in the browser
// marks it as a data block. Don't remove this (same fix as Main/Social/Auth).
const SCRIPT_PROPS = {
  type: typeof window === "undefined" ? "text/javascript" : "application/json",
};

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      scriptProps={SCRIPT_PROPS}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
