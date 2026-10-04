import { redirect } from "next/navigation";

// L'édition du programme vit maintenant sur /tracking (feuille « Modifier le jour »).
export default function TrackingProgrammePage() {
  redirect("/tracking");
}
