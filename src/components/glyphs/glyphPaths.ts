// Généré depuis design/v1/pictos.html (planche validée par Mathis le 2026-10-04).
// Chemins internes d'un <svg viewBox="0 0 24 24"> : constantes du dépôt, jamais de donnée utilisateur.
import type { MovementFamily } from "@/lib/trophies/movementFamily";

export const FAMILY_GLYPHS: Record<MovementFamily, string> = {
  pull: "<path d=\"M3 4h18\"/><path d=\"M8 4v5M16 4v5\"/><circle cx=\"12\" cy=\"11\" r=\"2.4\"/><path d=\"M12 13.5v5M9 21l3-2.5 3 2.5\"/>", // Tirage
  push: "<path d=\"M3 17h18\"/><circle cx=\"5.5\" cy=\"12\" r=\"2\"/><path d=\"M7.5 12.5l9 2.5M9 14v3M16 15v2\"/>", // Poussée
  dip: "<path d=\"M4 13h5M15 13h5M6 13v8M18 13v8\"/><circle cx=\"12\" cy=\"5\" r=\"2.2\"/><path d=\"M12 7.5v6M9 13l3-2 3 2M10.5 20l1.5-3 1.5 3\"/>", // Dips
  squat: "<circle cx=\"11\" cy=\"4.5\" r=\"2.2\"/><path d=\"M11 7v5l5 1.5-1 6.5M11 12l-4 3 1 5M4 21h16\"/>", // Jambes
  core: "<path d=\"M3 18h18\"/><circle cx=\"19\" cy=\"11.5\" r=\"2\"/><path d=\"M17 12.5L5 15M5 15v3M14 13.2v4.8\"/>", // Gainage
  handstand: "<path d=\"M3 21h18\"/><path d=\"M9 21v-4M15 21v-4\"/><circle cx=\"12\" cy=\"13.5\" r=\"2.2\"/><path d=\"M12 11V5M10 3l2 2 2-2\"/>", // Équilibre
  lever: "<path d=\"M3 4h18\"/><path d=\"M10 4v5.4\"/><circle cx=\"7.6\" cy=\"9.4\" r=\"2\"/><path d=\"M10 9.4h10.5\"/>", // Lever
  other: "<circle cx=\"12\" cy=\"4.5\" r=\"2.2\"/><path d=\"M12 7v7M12 14l-3 6.5M12 14l3 6.5M7.5 10h9\"/>", // Autre (repli)
};

// Exercices de la famille « other », chacun avec son picto dédié.
export const EXERCISE_GLYPHS: Record<string, string> = {
  "biceps-curls": "<circle cx=\"10\" cy=\"4.5\" r=\"2\"/><path d=\"M10 7v7M10 14l-2 6.5M10 14l2 6.5\"/><path d=\"M10 8.5l1.6 3.6 3.4-3.6\"/><path d=\"M13.6 8.4h3.4\"/>", // Biceps curls
  "burpees": "<circle cx=\"12\" cy=\"6\" r=\"2\"/><path d=\"M12 8.5v5.5M12 9.5L8.5 4.5M12 9.5l3.5-5M12 14l-3 4M12 14l3 4\"/><path d=\"M5 21.5h14\"/><path d=\"M19.5 15v3.5M18 17l1.5 1.5L21 17\"/>", // Burpees
  "calf-raises": "<circle cx=\"10\" cy=\"4\" r=\"2\"/><path d=\"M10 6.5v7.5M10 14l-1.5 4.5h-2M10 14l1.5 4.5h-2\"/><path d=\"M4 21h11\"/><path d=\"M19 20v-6M17 16l2-2 2 2\"/>", // Calf raises
  "dragon-lifts": "<path d=\"M2.5 20h8.5M4 20v1.5M9.5 20v1.5\"/><circle cx=\"4.5\" cy=\"16.8\" r=\"1.9\"/><path d=\"M3 14.6l1.7 1.6\"/><path d=\"M6.6 16.6L20.5 5\"/>", // Dragon lifts
  "hanging-bent-knees-raises": "<path d=\"M3 4h18\"/><path d=\"M9.5 4v4.5M14.5 4v4.5\"/><circle cx=\"12\" cy=\"10\" r=\"2.2\"/><path d=\"M12 12.5v4l4.5-2.6 1.2 4.6\"/>", // Hanging bent knees raises
  "hanging-knee-raises": "<path d=\"M3 4h18\"/><path d=\"M9.5 4v4.5M14.5 4v4.5\"/><circle cx=\"12\" cy=\"10\" r=\"2.2\"/><path d=\"M12 12.5v4h5v4\"/>", // Hanging knee raises
  "hefesto-curls": "<path d=\"M3 4h18\"/><path d=\"M10 4L7.8 8.2 10 11.2\"/><circle cx=\"12.7\" cy=\"10\" r=\"1.9\"/><path d=\"M10 11.2L18.5 20.5\"/>", // Hefesto curls
  "icecream-makers": "<path d=\"M3 4h18\"/><path d=\"M12 4v5.4\"/><circle cx=\"9.6\" cy=\"9.4\" r=\"1.9\"/><path d=\"M12 9.4h8.5\"/><path d=\"M12 11v9\" stroke-dasharray=\"1.5 2.5\"/><path d=\"M14 19.6a7.5 7.5 0 0 0 5.6-6.4\"/><path d=\"M18 14.6l1.6-1.4 1.4 1.6\"/>", // Icecream makers
  "inverted-deadlift": "<path d=\"M3 4h12\"/><path d=\"M11.5 4v4.5\"/><circle cx=\"11.5\" cy=\"10.8\" r=\"1.9\"/><path d=\"M11.5 8.5L16 13L19.3 2.5\"/>", // Inverted deadlift
  "one-leg-dragon-negatives": "<path d=\"M2.5 20h8.5M4 20v1.5M9.5 20v1.5\"/><circle cx=\"4.5\" cy=\"16.8\" r=\"1.9\"/><path d=\"M3 14.6l1.7 1.6\"/><path d=\"M6.6 16.6L13 11.2L20.5 5\"/><path d=\"M13 11.2L17 12.8L19.6 9.6\"/>", // One leg dragon negatives
  "pike-walks": "<path d=\"M3 20h18\"/><path d=\"M6 20L12 9L18 20\"/><circle cx=\"7.6\" cy=\"15.6\" r=\"1.8\"/><path d=\"M15 4.5h5M18 2.5l2 2-2 2\"/>", // Pike walks
  "side-bar-raises": "<path d=\"M3 4h18\"/><path d=\"M9.5 4v4.5M14.5 4v4.5\"/><circle cx=\"12\" cy=\"10\" r=\"2.2\"/><path d=\"M12 12.5v4.5L19.5 13\"/>", // Side bar raises
  "supported-triceps-extensions": "<path d=\"M13 12.5h8M20 12.5v8\"/><path d=\"M3 20.5h4\"/><circle cx=\"15.6\" cy=\"7.4\" r=\"1.9\"/><path d=\"M4.5 20.5L13.6 9\"/><path d=\"M13.6 9l2.6 3.5\"/>", // Supported triceps extensions
  "triceps-extensions": "<path d=\"M14.5 9h7M20.5 9v12\"/><path d=\"M3 21h4\"/><circle cx=\"14.2\" cy=\"5.4\" r=\"1.9\"/><path d=\"M5 21l7.6-14\"/><path d=\"M12.6 7l2.3 3.4 2.6-1.4\"/>", // Triceps extensions
  "triceps-extensions-on-ground": "<path d=\"M3 20h18\"/><circle cx=\"5\" cy=\"11.5\" r=\"1.9\"/><path d=\"M6.8 12.6L20 17.5\"/><path d=\"M6.8 12.6l2.2 3.2H4.5\"/>", // Triceps extensions on ground
};
