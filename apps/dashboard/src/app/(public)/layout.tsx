import { LocaleSwitcher } from "@/modules/i18n/components/locale-switcher";

// The public pages (terms, privacy). No sign-in and no dashboard shell: anyone with the link can read
// them, which is what Discord and the members need. They still get the nonce CSP from the proxy and the
// security headers; they stay out of search engines like the rest of the site.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <div className="flex justify-end">
        <LocaleSwitcher />
      </div>
      <main id="content" className="flex flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
