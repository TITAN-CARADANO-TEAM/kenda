import { supabaseAdmin } from "./supabaseAdmin";

export type Infraction = {
  id: string; // Changed from number to string (UUID)
  nom: string;
  description: string;
  vehicule: string;
  tarif_usd: number;
};

export async function fetchInfractions(): Promise<Infraction[]> {
  const { data, error } = await supabaseAdmin
    .from("infraction_types")
    .select("*")
    .order("label", { ascending: true });

  if (error) {
    console.error("[fetchInfractions] error", error);
    return [];
  }

  // Mapper les données du nouveau schéma vers l'ancien format UI
  return (data ?? []).map((row: any) => ({
    id: row.id,
    nom: row.label,
    description: `Code: ${row.code} - Sévérité: ${row.severity}`,
    vehicule: "Tous véhicules", // Valeur par défaut car pas dans le nouveau schéma
    tarif_usd: row.price_usd
  }));
}

