export type ArbreId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J";

export type Prescription = { series: number; min: number; max: number; unite: "reps" | "s" | "m" };

export type Arbre = {
  id: ArbreId;
  nom: string;
  crans: { numero: number; nom: string }[];
  prescriptions: [Prescription, Prescription, Prescription, Prescription];
};

export const ARBRES: Record<ArbreId, Arbre> = {
  A: {
    id: "A",
    nom: "Charnière & ischios",
    crans: [
      { numero: 1, nom: "Hip hinge au bâton" },
      { numero: 2, nom: "Good morning élastique" },
      { numero: 3, nom: "Leg curl serviette bilatéral" },
      { numero: 4, nom: "Leg curl serviette unilatéral" },
      { numero: 5, nom: "Nordic curl excentrique assisté" },
      { numero: 6, nom: "Nordic curl excentrique complet (5 s)" },
      { numero: 7, nom: "Nordic curl remontée partielle" },
      { numero: 8, nom: "Nordic curl + gilet lesté" },
    ],
    prescriptions: [
      { series: 3, min: 8, max: 10, unite: "reps" },
      { series: 3, min: 8, max: 10, unite: "reps" },
      { series: 4, min: 6, max: 8, unite: "reps" },
      { series: 4, min: 5, max: 6, unite: "reps" },
    ],
  },
  B: {
    id: "B",
    nom: "Extension de hanche",
    crans: [
      { numero: 1, nom: "Pont fessier bilatéral" },
      { numero: 2, nom: "Pont fessier pieds surélevés" },
      { numero: 3, nom: "Pont fessier unilatéral" },
      { numero: 4, nom: "Hip thrust unilatéral, épaules surélevées" },
      { numero: 5, nom: "Hip thrust unilatéral, épaules + pied surélevés" },
      { numero: 6, nom: "Hip thrust unilatéral + charge sur le bassin" },
      { numero: 7, nom: "Hip thrust unilatéral chargé, tenue 3 s" },
    ],
    prescriptions: [
      { series: 3, min: 12, max: 15, unite: "reps" },
      { series: 4, min: 10, max: 12, unite: "reps" },
      { series: 4, min: 8, max: 10, unite: "reps" },
      { series: 4, min: 6, max: 8, unite: "reps" },
    ],
  },
  C: {
    id: "C",
    nom: "Extenseurs lombaires",
    crans: [
      { numero: 1, nom: "Superman au sol, tenue 5 s" },
      { numero: 2, nom: "Reverse hyper au bord du lit" },
      { numero: 3, nom: "Reverse hyper, tenue 3 s en haut" },
      { numero: 4, nom: "Extension prone bras tendus" },
      { numero: 5, nom: "Biering-Sørensen, tenues" },
      { numero: 6, nom: "Biering-Sørensen + gilet lesté" },
    ],
    prescriptions: [
      { series: 3, min: 10, max: 12, unite: "reps" },
      { series: 3, min: 12, max: 15, unite: "reps" },
      { series: 3, min: 30, max: 45, unite: "s" },
      { series: 4, min: 45, max: 50, unite: "s" },
    ],
  },
  D: {
    id: "D",
    nom: "Genou / unilatéral",
    crans: [
      { numero: 1, nom: "Squat poids de corps, tempo 3-1-1" },
      { numero: 2, nom: "Split squat" },
      { numero: 3, nom: "Split squat bulgare" },
      { numero: 4, nom: "Split squat bulgare + gilet" },
      { numero: 5, nom: "Pistol assisté" },
      { numero: 6, nom: "Pistol complet" },
    ],
    prescriptions: [
      { series: 3, min: 10, max: 12, unite: "reps" },
      { series: 3, min: 8, max: 10, unite: "reps" },
      { series: 4, min: 8, max: 10, unite: "reps" },
      { series: 4, min: 6, max: 8, unite: "reps" },
    ],
  },
  E: {
    id: "E",
    nom: "Tirage vertical",
    crans: [
      { numero: 1, nom: "Traction négative (descente 5 s)" },
      { numero: 2, nom: "Traction assistée élastique" },
      { numero: 3, nom: "Traction stricte" },
      { numero: 4, nom: "Traction tempo 3-1-3" },
      { numero: 5, nom: "Traction lestée" },
    ],
    prescriptions: [
      { series: 3, min: 5, max: 8, unite: "reps" },
      { series: 4, min: 6, max: 8, unite: "reps" },
      { series: 4, min: 5, max: 8, unite: "reps" },
      { series: 4, min: 4, max: 6, unite: "reps" },
    ],
  },
  F: {
    id: "F",
    nom: "Tirage horizontal",
    crans: [
      { numero: 1, nom: "Rowing inversé, corps peu incliné" },
      { numero: 2, nom: "Rowing inversé, corps plus horizontal" },
      { numero: 3, nom: "Rowing inversé, pieds surélevés" },
      { numero: 4, nom: "Rowing archer ou un bras assisté" },
      { numero: 5, nom: "Rowing inversé + gilet" },
    ],
    prescriptions: [
      { series: 3, min: 10, max: 12, unite: "reps" },
      { series: 4, min: 10, max: 12, unite: "reps" },
      { series: 4, min: 8, max: 10, unite: "reps" },
      { series: 4, min: 6, max: 8, unite: "reps" },
    ],
  },
  G: {
    id: "G",
    nom: "Poussée",
    crans: [
      { numero: 1, nom: "Pompes inclinées" },
      { numero: 2, nom: "Pompes au sol" },
      { numero: 3, nom: "Pompes déclinées ou aux anneaux" },
      { numero: 4, nom: "Dips assistés élastique" },
      { numero: 5, nom: "Dips stricts" },
      { numero: 6, nom: "Dips lestés" },
    ],
    prescriptions: [
      { series: 3, min: 10, max: 12, unite: "reps" },
      { series: 4, min: 8, max: 12, unite: "reps" },
      { series: 4, min: 6, max: 10, unite: "reps" },
      { series: 4, min: 5, max: 8, unite: "reps" },
    ],
  },
  H: {
    id: "H",
    nom: "Chaîne latérale & abducteurs",
    crans: [
      { numero: 1, nom: "Side plank genoux" },
      { numero: 2, nom: "Side plank pieds" },
      { numero: 3, nom: "Side plank + abduction jambe haute" },
      { numero: 4, nom: "Side plank + gilet" },
      { numero: 5, nom: "Copenhagen genou fléchi" },
      { numero: 6, nom: "Copenhagen jambe tendue" },
      { numero: 7, nom: "Copenhagen lesté" },
    ],
    prescriptions: [
      { series: 3, min: 20, max: 25, unite: "s" },
      { series: 3, min: 30, max: 35, unite: "s" },
      { series: 3, min: 30, max: 40, unite: "s" },
      { series: 3, min: 45, max: 50, unite: "s" },
    ],
  },
  I: {
    id: "I",
    nom: "Anti-latéral & portés",
    crans: [
      { numero: 1, nom: "Suspension à un bras, tenues" },
      { numero: 2, nom: "Suitcase carry sac à dos" },
      { numero: 3, nom: "Suitcase carry kettlebell" },
      { numero: 4, nom: "Suitcase carry lourd" },
    ],
    prescriptions: [
      { series: 3, min: 15, max: 20, unite: "s" },
      { series: 3, min: 20, max: 25, unite: "m" },
      { series: 4, min: 25, max: 30, unite: "m" },
      { series: 4, min: 30, max: 40, unite: "m" },
    ],
  },
  J: {
    id: "J",
    nom: "Core anti-extension",
    crans: [
      { numero: 1, nom: "Dead bug" },
      { numero: 2, nom: "Hollow hold" },
      { numero: 3, nom: "Hollow hang à la barre" },
      { numero: 4, nom: "Relevés de genoux suspendus" },
      { numero: 5, nom: "Relevés de jambes tendues" },
      { numero: 6, nom: "L-sit aux barres à dips" },
    ],
    prescriptions: [
      { series: 3, min: 8, max: 10, unite: "reps" },
      { series: 3, min: 8, max: 12, unite: "reps" },
      { series: 3, min: 8, max: 10, unite: "reps" },
      { series: 3, min: 6, max: 10, unite: "reps" },
    ],
  },
};
