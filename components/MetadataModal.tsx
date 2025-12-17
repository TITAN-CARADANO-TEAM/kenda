"use client";

import { X, Wallet } from "lucide-react";
import { BrowserWallet, Transaction } from "@meshsdk/core";
import { useState } from "react";
import { convertToLovelace } from "@/lib/utils";

interface TransactionMetadata {
    agent: string;
    usager: string;
    plaque: string;
    description: string;
    montant: string;
}

interface MetadataModalProps {
    isOpen: boolean;
    onClose: () => void;
    metadata: TransactionMetadata | null;
    isLoading: boolean;
    contraventionId: string;
    status: "active" | "payed" | "PAID"; // Adapter pour PAID
}

export function MetadataModal({ isOpen, onClose, metadata, isLoading, contraventionId, status }: MetadataModalProps) {
    const [isPaying, setIsPaying] = useState(false);

    const handlePayment = async () => {
        if (!metadata?.montant) return;
        setIsPaying(true);

        try {
            // 1. Détecter les wallets
            console.log("🔍 Détection des wallets...");
            const wallets = await BrowserWallet.getAvailableWallets();
            console.log("Wallets trouvés:", wallets);

            if (wallets.length === 0) {
                alert("Aucun wallet Cardano détecté. Veuillez installer Nami, Eternal ou Lace.");
                setIsPaying(false);
                return;
            }

            // Pour le MVP, on prend le premier wallet trouvé (souvent Nami)
            // Amélioration future : Afficher une liste de choix
            const walletName = wallets[0].id; // ex: "nami"
            console.log("Connexion au wallet:", walletName);

            // 2. Connecter le wallet
            const wallet = await BrowserWallet.enable(walletName);
            console.log("✅ Wallet connecté");

            // 3. Préparer la transaction
            const TREASURY_ADDRESS = "addr_test1qp8kuc9tt05vmsclklzp2l8el7ry36v34ryty5357d0d8sslz9je4qjgjy7zk0thdwwpp5eqedruf7g3yc08xy4gh4hseg0x47";
            const amountInLovelace = await convertToLovelace(metadata.montant);
            console.log("💰 Montant:", metadata.montant, "->", amountInLovelace, "Lovelace");

            console.log("🏗️ Construction de la transaction...");
            const tx = new Transaction({ initiator: wallet });
            tx.sendLovelace(TREASURY_ADDRESS, amountInLovelace);

            const unsignedTx = await tx.build();
            console.log("📝 Transaction construite, demande de signature...");

            const signedTx = await wallet.signTx(unsignedTx);
            console.log("✍️ Transaction signée, envoi au réseau...");

            const txHash = await wallet.submitTx(signedTx);
            console.log("🚀 Transaction envoyée ! Hash:", txHash);

            // 4. Valider côté serveur
            console.log("📡 Envoi à l'API pour validation...");
            const response = await fetch('/api/contraventions/pay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contraventionId,
                    txHash,
                    amount: metadata.montant
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Erreur de validation");
            }

            alert("Paiement réussi ! La contravention a été régularisée.");
            onClose();
            window.location.reload(); // Pour rafraîchir le statut

        } catch (error) {
            console.error("Erreur paiement:", error);
            alert("Le paiement a échoué : " + (error instanceof Error ? error.message : "Erreur inconnue"));
        } finally {
            setIsPaying(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="w-full max-w-lg rounded-2xl border border-[#2f2f2f] bg-[#050505] p-8 shadow-xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                    aria-label="Fermer"
                >
                    <X size={24} />
                </button>

                <p className="text-sm uppercase tracking-[0.25em] text-[#F0B90B]">
                    Détails de la transaction
                </p>
                <h3 className="font-heading text-2xl mt-3">Métadonnées Blockchain</h3>
                <p className="text-gray-400 mt-2 text-sm">
                    Informations enregistrées sur Cardano
                </p>

                <div className="mt-6">
                    {isLoading && (
                        <div className="text-center py-8">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#F0B90B]"></div>
                            <p className="text-gray-400 mt-4 text-sm">Chargement des métadonnées...</p>
                        </div>
                    )}

                    {!isLoading && !metadata && (
                        <div className="text-center py-8">
                            <p className="text-red-400">Impossible de récupérer les métadonnées</p>
                        </div>
                    )}

                    {!isLoading && metadata && (
                        <div className="space-y-4">
                            {/* Grille 4 colonnes pour les infos courtes */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="aspect-square flex flex-col items-center justify-center border border-[#1f1f1f] rounded-xl bg-[#0A0A0A] p-2 text-center hover:border-[#F0B90B]/30 transition-colors">
                                    <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">Agent</p>
                                    <p className="text-white font-mono text-sm font-medium">{metadata.agent}</p>
                                </div>

                                <div className="aspect-square flex flex-col items-center justify-center border border-[#1f1f1f] rounded-xl bg-[#0A0A0A] p-2 text-center hover:border-[#F0B90B]/30 transition-colors">
                                    <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">Usager</p>
                                    <p className="text-white font-mono text-sm font-medium">{metadata.usager}</p>
                                </div>

                                <div className="aspect-square flex flex-col items-center justify-center border border-[#1f1f1f] rounded-xl bg-[#0A0A0A] p-2 text-center hover:border-[#F0B90B]/30 transition-colors">
                                    <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">Plaque</p>
                                    <p className="text-white font-mono text-sm font-medium">{metadata.plaque}</p>
                                </div>

                                <div className="aspect-square flex flex-col items-center justify-center border border-[#1f1f1f] rounded-xl bg-[#0A0A0A] p-2 text-center hover:border-[#F0B90B]/30 transition-colors">
                                    <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">Montant</p>
                                    <p className="text-[#F0B90B] font-mono text-sm font-bold">{metadata.montant}</p>
                                </div>
                            </div>

                            {/* Description en pleine largeur */}
                            <div className="border border-[#1f1f1f] rounded-2xl p-5 bg-[#0A0A0A] hover:border-[#F0B90B]/30 transition-colors">
                                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Description</p>
                                <p className="text-white font-mono text-sm">{metadata.description}</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-8 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-[#1f1f1f] text-white font-semibold py-3 rounded-xl hover:bg-[#2a2a2a] transition-colors"
                    >
                        Fermer
                    </button>

                    {metadata && (
                        (status === "payed" || status === "PAID") ? (
                            <button
                                disabled
                                className="flex-1 bg-green-500/20 text-green-500 font-semibold py-3 rounded-xl border border-green-500/30 flex items-center justify-center gap-2 cursor-not-allowed"
                            >
                                <Wallet size={18} />
                                ✅ Déjà payé
                            </button>
                        ) : (
                            <button
                                onClick={handlePayment}
                                disabled={isPaying}
                                className="flex-1 bg-[#F0B90B] text-black font-semibold py-3 rounded-xl hover:bg-[#e0b010] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPaying ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                                        Traitement...
                                    </>
                                ) : (
                                    <>
                                        <Wallet size={18} />
                                        Payer {metadata.montant}
                                    </>
                                )}
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
