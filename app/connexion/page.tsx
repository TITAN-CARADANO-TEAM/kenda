"use client";

import { supabaseBrowserClient } from "@/lib/supabaseBrowserClient";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const roleRedirect: Record<string, string> = {
  PASSENGER: "/usagers/espace",
  POLICE_OFFICER: "/agents/espace",
  ADMIN: "/"
};

export default function ConnexionPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/resolve-identifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim().toUpperCase() }),
      });

      if (!response.ok) {
        const message = await response.json().catch(() => null);
        throw new Error(message?.error || "Identifiant inconnu.");
      }

      const { email, role } = await response.json();

      if (role !== "PASSENGER" && role !== "POLICE_OFFICER" && role !== "ADMIN" && role !== "DRIVER") {
        throw new Error("Accès non autorisé pour ce rôle.");
      }

      const { error: signInError } =
        await supabaseBrowserClient.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        throw new Error("Mot de passe incorrect.");
      }

      const destination = roleRedirect[role] || "/";
      router.push(destination);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-white px-4 py-10 sm:px-8">
      <div className="max-w-md mx-auto border border-[#1f1f1f] rounded-2xl bg-[#0C0C0C] p-8">
        <p className="text-sm uppercase tracking-[0.25em] text-[#F0B90B]">
          Accès sécurisé
        </p>
        <h1 className="font-heading text-3xl font-semibold mt-3">
          Connectez-vous
        </h1>
        <p className="text-gray-300 mt-3 text-sm">
          Utilisez l’identifiant et le mot de passe générés lors de votre
          inscription.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="flex flex-col">
            <label className="text-sm text-gray-300 mb-1">Identifiant</label>
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="USR-0001"
              className="bg-[#151515] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#F0B90B]/50 uppercase"
              required
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-gray-300 mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
              className="bg-[#151515] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#F0B90B]/50"
              required
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#F0B90B] text-black font-semibold py-3 rounded-full transition hover:bg-[#e0b010] disabled:opacity-60"
          >
            {isLoading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          Identifiants perdus ?{" "}
          <Link
            href="/contact"
            className="text-[#F0B90B] underline underline-offset-4"
          >
            Contactez l’administration
          </Link>
        </div>
      </div>
    </div>
  );
}
