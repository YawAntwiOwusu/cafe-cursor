"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageContext";

interface AvailabilityData {
  remaining: number;
  totalEligible: number;
  totalClaimed: number;
}

/**
 * Badge que mostra a quantidade de créditos disponíveis
 * Atualiza automaticamente a cada 30 segundos
 */
export function AvailabilityBadge() {
  const { t } = useLanguage();
  const [data, setData] = useState<AvailabilityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAvailability = async () => {
    try {
      const response = await fetch("/api/register", { method: "GET" });
      const json = await response.json();

      // Mapear resposta da API para o formato do componente
      if (json.remaining !== undefined) {
        const mappedData: AvailabilityData = {
          remaining: json.remaining,
          totalEligible: json.stats?.totalEligible || 0,
          totalClaimed: json.stats?.claimed || 0,
        };
        console.log(`📊 [BADGE] Disponibilidade atualizada:`, mappedData);
        setData(mappedData);
      }
    } catch (error) {
      console.error(`❌ [BADGE] Erro ao buscar disponibilidade:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailability();

    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchAvailability, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-4 py-2 text-sm backdrop-blur-sm">
        <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
        <span className="text-muted">{t("loading")}</span>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const available = data.remaining;
  const hasCredits = available > 0;

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-2 text-center sm:max-w-none">
      {/* Badge principal */}
      <div
        className={`inline-flex max-w-full items-center gap-2 rounded-full border px-4 py-2 text-sm backdrop-blur-sm ${
          hasCredits
            ? "border-[var(--success)]/30 bg-[var(--success)]/10"
            : "border-[var(--error)]/30 bg-[var(--error)]/10"
        }`}
      >
        <div
          className={`h-2 w-2 shrink-0 rounded-full ${
            hasCredits ? "bg-[var(--success)] animate-pulse" : "bg-[var(--error)]"
          }`}
        />
        <span className={`text-pretty ${hasCredits ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
          {hasCredits ? `${available} ${t("creditsAvailable")}` : t("noCredits")}
        </span>
      </div>

      {/* Contador de participantes */}
      {data.totalEligible > 0 && (
        <p className="max-w-xs text-pretty text-xs text-muted">
          {data.totalClaimed} {t("of")} {data.totalEligible} {t("alreadyClaimed")}
        </p>
      )}
    </div>
  );
}
