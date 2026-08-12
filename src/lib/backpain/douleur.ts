function estGenante(seance: { genePendant: number; geneLendemain: number }): boolean {
  return seance.genePendant > 3 || seance.geneLendemain > 3;
}

export function checkPainEscalation(
  recentSeances: { genePendant: number; geneLendemain: number }[],
): "normal" | "repeter_cran" | "redescendre_cran" {
  const last = recentSeances[recentSeances.length - 1];
  if (!last || !estGenante(last)) return "normal";

  const secondToLast = recentSeances[recentSeances.length - 2];
  if (secondToLast && estGenante(secondToLast)) return "redescendre_cran";

  return "repeter_cran";
}
