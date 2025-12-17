import { buildAuthEmail } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Buffer } from "node:buffer";

export const runtime = "nodejs";

const usagerSchema = z.object({
  nom: z.string().min(2),
  postNom: z.string().min(2),
  prenom: z.string().min(2),
  statutMatrimonial: z.string().min(2),
  adresse: z.string().min(5),
  telephone: z.string().min(6),
  email: z.string().email(),
});

const PASSWORD_MIN = 5;
const PASSWORD_MAX = 10;
const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789";
const DOCUMENTS_BUCKET = "usagers-documents";
let bucketInitialized = false;

function generatePassword() {
  const length =
    Math.floor(Math.random() * (PASSWORD_MAX - PASSWORD_MIN + 1)) +
    PASSWORD_MIN;
  let password = "";
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * PASSWORD_ALPHABET.length);
    password += PASSWORD_ALPHABET[index];
  }
  return password;
}

async function ensureBucketExists() {
  if (bucketInitialized) {
    return;
  }

  const { data } = await supabaseAdmin.storage.getBucket(DOCUMENTS_BUCKET);
  if (!data) {
    const { error: bucketError } = await supabaseAdmin.storage.createBucket(
      DOCUMENTS_BUCKET,
      {
        public: false,
      }
    );

    if (bucketError && !bucketError.message.includes("already exists")) {
      throw bucketError;
    }
  }
  bucketInitialized = true;
}

async function uploadDocument(
  file: File,
  loginIdentifier: string,
  label: string
) {
  await ensureBucketExists();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const extension = file.name.split(".").pop() ?? "bin";
  const path = `${loginIdentifier}/${label}-${Date.now()}.${extension}`;

  const { data, error } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return data.path;
}

async function generateLoginIdentifier() {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("matricule")
    .eq("role", "PASSENGER")
    .order("matricule", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (!data?.matricule) {
    return "USR-0001";
  }

  const [, numberPart] = data.matricule.split("-");
  const nextNumber = parseInt(numberPart, 10) + 1;
  return `USR-${nextNumber.toString().padStart(4, "0")}`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const parsed = usagerSchema.safeParse({
      nom: formData.get("nom"),
      postNom: formData.get("postNom"),
      prenom: formData.get("prenom"),
      statutMatrimonial: formData.get("statutMatrimonial"),
      adresse: formData.get("adresse"),
      telephone: formData.get("telephone"),
      email: formData.get("email"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Champs invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      nom,
      postNom,
      prenom,
      statutMatrimonial,
      adresse,
      telephone,
      email: contactEmail,
    } = parsed.data;

    const carteIdentiteFile = formData.get("carteIdentite");
    const permisConduireFile = formData.get("permisConduire");

    const loginIdentifier = await generateLoginIdentifier();
    const password = generatePassword();
    const authEmail = buildAuthEmail(loginIdentifier);

    let carteIdentitePath: string | null = null;
    if (carteIdentiteFile instanceof File && carteIdentiteFile.size > 0) {
      carteIdentitePath = await uploadDocument(
        carteIdentiteFile,
        loginIdentifier,
        "carte-identite"
      );
    }

    let permisConduirePath: string | null = null;
    if (permisConduireFile instanceof File && permisConduireFile.size > 0) {
      permisConduirePath = await uploadDocument(
        permisConduireFile,
        loginIdentifier,
        "permis-conduire"
      );
    }

    // Check for existing user first to handle retries/collisions gracefully
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", authEmail)
      .maybeSingle();

    let userId = existingUser?.id;

    if (!userId) {
      // Try to find in Auth if not in DB (edge case: auth exists but public.users insert failed)
      // Actually, we can just try createUser and catch email_exists, verify via listUsers?
      // Simpler: duplicate Agent Logic.

      // Actually, listUsers by email to be sure.
      const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers();
      const existingAuth = authUsers.find(u => u.email === authEmail);

      if (existingAuth) {
        userId = existingAuth.id;
        console.log(`[AUTH UPDATE] IDs match. Updating password for ${authEmail}. PWD: ${password}`);
        await supabaseAdmin.auth.admin.updateUserById(userId, { password, email_confirm: true });
      } else {
        const {
          data: authData,
          error: authError,
        } = await supabaseAdmin.auth.admin.createUser({
          email: authEmail,
          email_confirm: true,
          password,
          user_metadata: {
            role: "PASSENGER",
            matricule: loginIdentifier,
            full_name: `${prenom} ${nom} ${postNom || ''}`.trim(),
            nom,
            postNom,
            prenom,
            adresse,
            telephone,
            statutMatrimonial,
            contactEmail,
            carteIdentitePath,
            permisConduirePath
          },
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("Auth user creation failed");
        userId = authData.user.id;
        console.log(`[AUTH CREATE] Created ${authEmail}. PWD: ${password}`);
        userId = authData.user.id;
      }
    } else {
      // User exists in DB, update password
      // We need finding Auth User ID from DB User ID (which are same)
      console.log(`[DB EXIST] Updating password for user ${userId}. PWD: ${password}`);
      await supabaseAdmin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    }

    const { error: insertError } = await supabaseAdmin.from("users").upsert({
      id: userId,
      role: "PASSENGER",
      matricule: loginIdentifier,
      full_name: `${prenom} ${nom} ${postNom || ''}`.trim(),
      phone: telephone,
      email: contactEmail, // This maps to 'email' column in UserRow if it exists separately from Auth email. Usually yes.
      is_verified: true,
    }, { onConflict: 'id' });

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      loginIdentifier,
      password,
    });
  } catch (error) {
    console.error("[USAGER_CREATION]", error);
    return NextResponse.json(
      { error: "Une erreur inattendue est survenue." },
      { status: 500 }
    );
  }
}

