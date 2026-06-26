"use client";

import { useState, FormEvent } from "react";
import { useLanguage } from "./LanguageContext";

type FormStatus = "idle" | "loading" | "success" | "error";

interface RegisterResult {
  success: boolean;
  message?: string;
  error?: string;
  code?: string;
  credit?: string;
  isExisting?: boolean;
  isTest?: boolean;
  user?: {
    name: string;
    email: string;
    company?: string;
  };
}

/**
 * Formulário de cadastro para obter crédito do Cursor
 * Apenas usuários elegíveis (aprovados no evento) podem se cadastrar
 */
export function RegisterForm() {
  const { t, locale } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [result, setResult] = useState<RegisterResult | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setResult(null);

    console.log(`📤 [FORM] Enviando cadastro: ${email}`);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: name.trim(), 
          email: email.trim(),
          locale: locale, // Enviar idioma actual para el email
        }),
      });

      const data: RegisterResult = await response.json();

      if (data.success) {
        console.log(`✅ [FORM] Cadastro bem-sucedido`);
        setStatus("success");
        setResult(data);
      } else {
        console.log(`⚠️ [FORM] Erro: ${data.error} (code: ${data.code})`);
        setStatus("error");
        setResult(data);
      }
    } catch (error) {
      console.error(`❌ [FORM] Erro de rede:`, error);
      setStatus("error");
      setResult({
        success: false,
        error: t("networkError"),
        code: "NETWORK_ERROR",
      });
    }
  };

  const handleCopyLink = async () => {
    if (result?.credit) {
      await navigator.clipboard.writeText(result.credit);
      console.log(`📋 [FORM] Link copiado para área de transferência`);
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setResult(null);
    setName("");
    setEmail("");
  };

  // Mapear códigos de erro para traduções
  const getErrorMessage = (code?: string, originalError?: string): string => {
    switch (code) {
      case "NOT_ELIGIBLE":
        return t("notEligible");
      case "NOT_APPROVED":
        return t("notApproved");
      case "NO_CREDITS":
        return t("noCreditsAvailable");
      case "NETWORK_ERROR":
        return t("networkError");
      default:
        return originalError || t("networkError");
    }
  };

  // Vista de sucesso
  if (status === "success" && result?.credit) {
    return (
      <div className="mx-auto w-full max-w-md animate-fade-in">
        <div className="rounded-2xl border border-border bg-background p-6 sm:p-8">
          {/* Ícone de sucesso */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success)]/10">
            <svg
              className="h-8 w-8 text-[var(--success)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h2 className="mb-2 text-center text-xl font-semibold">
            {result.isExisting ? t("alreadyHaveCredit") : t("successTitle")}
          </h2>

          <p className="mb-6 text-center text-sm text-muted">
            {t("congratsMessage")}
          </p>

          {/* Info do usuário */}
          {result.user && (
            <div className="mb-4 rounded-xl border border-border bg-foreground/5 p-3">
              <p className="text-sm">
                <span className="text-muted">{t("registeredAs")} </span>
                <span className="font-medium">{result.user.name}</span>
              </p>
              {result.user.company && (
                <p className="text-xs text-muted mt-1">{result.user.company}</p>
              )}
            </div>
          )}

          {/* Badge de teste */}
          {result.isTest && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                {t("testWarning")}
              </p>
            </div>
          )}

          {/* Link do crédito */}
          <div className="mb-4 overflow-hidden rounded-xl border border-border bg-background p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
              {t("yourCredit")}
            </p>
            <p className="break-all font-mono text-xs leading-relaxed sm:text-sm">{result.credit}</p>
          </div>

          {/* Botões de ação */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleCopyLink}
              className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-foreground/5"
            >
              {t("copyLink")}
            </button>
            <a
              href={result.credit}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-xl bg-foreground px-4 py-3 text-center text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              {t("useCredit")}
            </a>
          </div>

          {/* Botón compartir en X */}
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(t("shareMessage"))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-black px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-80"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            {t("shareOnX")}
          </a>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          {t("saveLink")}
        </p>

        {/* Notificación de email */}
        <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[var(--success)]/20 bg-[var(--success)]/5 px-4 py-3">
          <span className="text-sm text-[var(--success)]">{t("emailSent")}</span>
        </div>
      </div>
    );
  }

  // Formulário de cadastro
  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-md animate-fade-in">
      <div className="rounded-2xl border border-border bg-background p-6 sm:p-8">
        {/* Campo Nome */}
        <div className="mb-4">
          <label
            htmlFor="name"
            className="mb-2 block text-sm font-medium"
          >
            {t("nameLabel")}
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            required
            disabled={status === "loading"}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:border-foreground focus:outline-none disabled:opacity-50"
          />
        </div>

        {/* Campo Email */}
        <div className="mb-6">
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium"
          >
            {t("emailLabel")}
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            required
            disabled={status === "loading"}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:border-foreground focus:outline-none disabled:opacity-50"
          />
          <p className="mt-2 text-xs text-muted">
            {t("emailHint")}
          </p>
        </div>

        {/* Mensagem de erro */}
        {status === "error" && result && (
          <div className="mb-4 rounded-xl border border-[var(--error)]/20 bg-[var(--error)]/5 p-4">
            <p className="text-sm text-[var(--error)]">
              {getErrorMessage(result.code, result.error)}
            </p>
            {result.code === "NOT_ELIGIBLE" && (
              <p className="mt-2 text-xs text-muted">
                {t("thinkError")}
              </p>
            )}
            {result.code === "NOT_APPROVED" && (
              <p className="mt-2 text-xs text-muted">
                {t("pendingApproval")}
              </p>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="mt-3 text-xs text-foreground underline underline-offset-2 hover:no-underline"
            >
              {t("tryAnotherEmail")}
            </button>
          </div>
        )}

        {/* Botão de cadastro */}
        <button
          type="submit"
          disabled={status === "loading" || !name.trim() || !email.trim()}
          className="w-full rounded-xl bg-foreground px-4 py-3 font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="h-4 w-4 spinner"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              {t("submitting")}
            </span>
          ) : (
            t("submitButton")
          )}
        </button>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        {t("footerNote")}
        <br />
        {t("onePerPerson")}
      </p>
    </form>
  );
}
