"use client";

import { RegisterForm } from "@/components/RegisterForm";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/components/LanguageContext";

/**
 * Landing page for Cursor Ghana Meetup - Builders Day Edition with Cursor Team
 * Estilo minimalista inspirado no Luma
 */
export default function Home() {
  const { t } = useLanguage();

  return (
    <main className="relative flex min-h-dvh flex-col items-center px-4 pb-10 pt-20 sm:pt-24">
      {/* Fundo com grid */}
      <div className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-40" />

      {/* Seletor de idioma - fixo no topo direito */}
      <div className="fixed right-4 top-4 z-50">
        <LanguageSelector />
      </div>

      <div className="flex w-full max-w-lg flex-col items-center">
        {/* Header */}
        <header className="mb-8 w-full text-center animate-fade-in sm:mb-10">
          {/* Logo Oficial do Cursor - Cubo 3D */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center sm:mb-8 sm:h-20 sm:w-20">
            <svg
              className="h-12 w-12 sm:h-16 sm:w-16"
              viewBox="0 0 466.73 532.09"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M457.43,125.94L244.42,2.96c-6.84-3.95-15.28-3.95-22.12,0L9.3,125.94c-5.75,3.32-9.3,9.46-9.3,16.11v247.99c0,6.65,3.55,12.79,9.3,16.11l213.01,122.98c6.84,3.95,15.28,3.95,22.12,0l213.01-122.98c5.75-3.32,9.3-9.46,9.3-16.11v-247.99c0-6.65-3.55-12.79-9.3-16.11ZM444.05,151.99l-205.63,356.16c-1.39,2.4-5.06,1.42-5.06-1.36v-233.21c0-4.66-2.49-8.97-6.53-11.31L24.87,145.67c-2.4-1.39-1.42-5.06,1.36-5.06h411.26c5.84,0,9.49,6.33,6.57,11.39Z"
                fill="currentColor"
                className="text-foreground"
              />
            </svg>
          </div>

          {/* Badge de disponibilidade — altura fixa evita saltos de layout */}
          <div className="mb-5 flex min-h-[4.5rem] flex-col items-center justify-center sm:mb-6">
            <AvailabilityBadge />
          </div>

          {/* Título */}
          <h1 className="mb-3 text-balance text-3xl font-bold tracking-tight sm:mb-4 sm:text-4xl lg:text-5xl">
            {t("title")}
          </h1>

          {/* Subtítulo */}
          <p className="mx-auto max-w-md text-pretty text-sm text-muted sm:text-base">
            {t("subtitle")}
            <br />
            <span className="font-medium text-foreground">{t("cta")}</span>
          </p>
        </header>

        {/* Formulário de cadastro */}
        <section
          className="w-full animate-slide-up"
          style={{ animationDelay: "0.1s" }}
        >
          <RegisterForm />
        </section>

        {/* Footer */}
        <footer
          className="mt-10 w-full text-center animate-fade-in sm:mt-14"
          style={{ animationDelay: "0.2s" }}
        >
          {/* Créditos */}
          <div className="flex flex-col items-center gap-3">
            <p className="max-w-sm text-pretty text-sm text-muted">
              {t("madeBy")}{" "}
              <span className="font-semibold text-foreground">{t("ambassadors")}</span>
            </p>
            <p className="text-xs text-muted/70">{t("ambassadorTitle")}</p>

            {/* Powered by Cursor */}
            <div className="mt-2 flex items-center gap-2 rounded-full border border-border bg-background/50 px-4 py-2 backdrop-blur-sm sm:mt-4">
              <span className="text-xs text-muted">{t("poweredBy")}</span>
              <svg
                className="h-4 w-4 shrink-0"
                viewBox="0 0 466.73 532.09"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M457.43,125.94L244.42,2.96c-6.84-3.95-15.28-3.95-22.12,0L9.3,125.94c-5.75,3.32-9.3,9.46-9.3,16.11v247.99c0,6.65,3.55,12.79,9.3,16.11l213.01,122.98c6.84,3.95,15.28,3.95,22.12,0l213.01-122.98c5.75-3.32,9.3-9.46,9.3-16.11v-247.99c0-6.65-3.55-12.79-9.3-16.11ZM444.05,151.99l-205.63,356.16c-1.39,2.4-5.06,1.42-5.06-1.36v-233.21c0-4.66-2.49-8.97-6.53-11.31L24.87,145.67c-2.4-1.39-1.42-5.06,1.36-5.06h411.26c5.84,0,9.49,6.33,6.57,11.39Z"
                  fill="currentColor"
                  className="text-foreground"
                />
              </svg>
              <span className="text-xs font-semibold text-foreground">Cursor</span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
