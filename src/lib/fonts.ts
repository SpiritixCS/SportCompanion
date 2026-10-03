import { Big_Shoulders, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";

// Big Shoulders est variable avec un axe de taille optique : aux grandes
// tailles (chiffres, titres) le navigateur prend le dessin « Display ».
export const display = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--nf-display",
  display: "swap",
});

export const body = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--nf-body",
  display: "swap",
});

export const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--nf-mono",
  display: "swap",
});
