import { buildAuthEmail } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  identifier: z
    .string()
    .min(3)
    .regex(/^[A-Za-z]{3}-\d{4}$/),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Identifiant invalide." },
        { status: 400 }
      );
    }

    const { identifier } = parsed.data;
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("matricule", identifier)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { error: "Compte introuvable." },
        { status: 404 }
      );
    }

    const email = buildAuthEmail(identifier);

    return NextResponse.json({
      email,
      role: data.role,
    });
  } catch (error) {
    console.error("[AUTH_RESOLVE_IDENTIFIER]", error);
    return NextResponse.json(
      { error: "Impossible de vérifier l'identifiant." },
      { status: 500 }
    );
  }
}

