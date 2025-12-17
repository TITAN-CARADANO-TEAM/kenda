"use client";

import { useEffect, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabaseBrowserClient";
import { useRouter } from "next/navigation";
import { Car, Plus, AlertCircle } from "lucide-react";
import Link from 'next/link';
import { MetadataModal } from "@/components/MetadataModal";

export default function UsagerDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddCar, setShowAddCar] = useState(false);
    const [fines, setFines] = useState<any[]>([]);
    const [loadingFines, setLoadingFines] = useState(true);

    // Modal Payment State
    const [selectedFine, setSelectedFine] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMetadata, setModalMetadata] = useState<any>(null);
    const [loadingMetadata, setLoadingMetadata] = useState(false);

    // New Vehicle Form State
    const [newCar, setNewCar] = useState({
        licensePlate: "",
        make: "",
        model: "",
        color: ""
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabaseBrowserClient.auth.getSession();
            if (!session) {
                router.push("/connexion");
                return;
            }
            setUser(session.user);
            fetchVehicles(session.user.id);
            fetchFines(session.user.id);
        };
        checkUser();
    }, [router]);

    const fetchVehicles = async (userId: string) => {
        try {
            const res = await fetch(`/api/vehicles?userId=${userId}`);
            if (res.ok) {
                const data = await res.json();
                setVehicles(data.vehicles || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchFines = async (userId: string) => {
        try {
            const res = await fetch(`/api/usagers/fines?userId=${userId}`);
            if (res.ok) {
                const data = await res.json();
                setFines(data.fines || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingFines(false);
        }
    };

    const handleRegisterVehicle = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setSubmitting(true);

        try {
            const res = await fetch("/api/vehicles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...newCar, userId: user.id })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            // Success
            setVehicles([...vehicles, data.vehicle]);
            setShowAddCar(false);
            setNewCar({ licensePlate: "", make: "", model: "", color: "" });
            alert("Véhicule enregistré avec succès !");

        } catch (error: any) {
            alert(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenPay = async (fine: any) => {
        setSelectedFine(fine);
        setLoadingMetadata(true);
        setIsModalOpen(true);
        setModalMetadata(null);

        const txHashMatch = fine.description?.match(/Blockchain TX: (\w+)/);
        const txHash = txHashMatch ? txHashMatch[1] : null;

        if (!txHash) {
            console.warn("No txHash found for fine", fine.id);
            setLoadingMetadata(false);
            return;
        }

        try {
            const BLOCKFROST_API_KEY = "preprod6eb6sa6Y14nBKQqffIGOCkDCRACxRRHd";
            const response = await fetch(
                `https://cardano-preprod.blockfrost.io/api/v0/txs/${txHash}/metadata`,
                { headers: { project_id: BLOCKFROST_API_KEY } }
            );

            if (!response.ok) throw new Error("Impossible de récupérer les métadonnées");

            const data = await response.json();
            const metadata674 = data.find((item: any) => item.label === "674");

            if (metadata674 && metadata674.json_metadata?.msg) {
                const msg = metadata674.json_metadata.msg;
                const agent = msg.find((m: string) => m.startsWith("Agent:"))?.replace("Agent: ", "") || "N/A";
                const plaque = msg.find((m: string) => m.startsWith("Plaque:"))?.replace("Plaque: ", "") || "N/A";
                const usagerLine = msg.find((m: string) => m.startsWith("Usager:") || m.startsWith("Permis:"));
                const usager = usagerLine ? usagerLine.split(": ")[1] : "N/A";
                const description = msg.find((m: string) => m.startsWith("Description:") || m.startsWith("Infraction:"))?.split(": ")[1] || "N/A";
                const montant = msg.find((m: string) => m.startsWith("Montant:"))?.replace("Montant: ", "") || "N/A";

                setModalMetadata({ agent, usager, plaque, description, montant });
            }
        } catch (error) {
            console.error("Erreur metadata:", error);
        } finally {
            setLoadingMetadata(false);
        }
    };

    if (loading) return <div className="min-h-screen bg-black text-white p-8">Chargement...</div>;

    return (
        <div className="min-h-screen bg-background text-white px-4 py-8 sm:px-8">
            <div className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <p className="text-sm uppercase tracking-[0.25em] text-[#F0B90B]">Mon Espace</p>
                        <h1 className="font-heading text-3xl font-semibold mt-1">Bonjour, {user?.user_metadata?.loginIdentifier || 'Usager'}</h1>
                    </div>
                    <button
                        onClick={() => { supabaseBrowserClient.auth.signOut(); router.push('/connexion'); }}
                        className="text-sm text-gray-400 hover:text-white"
                    >
                        Déconnexion
                    </button>
                </header>

                {/* Section Véhicules */}
                <section className="mb-12">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Car className="w-5 h-5 text-[#F0B90B]" />
                            Mes Véhicules
                        </h2>
                        <button
                            onClick={() => setShowAddCar(!showAddCar)}
                            className="flex items-center gap-2 bg-[#1f1f1f] hover:bg-[#2a2a2a] px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Ajouter un véhicule
                        </button>
                    </div>

                    {/* Formulaire Ajout */}
                    {showAddCar && (
                        <div className="bg-[#0C0C0C] border border-[#1f1f1f] rounded-xl p-6 mb-8 animate-in slide-in-from-top-4">
                            <h3 className="font-medium mb-4">Nouveau Véhicule</h3>
                            <form onSubmit={handleRegisterVehicle} className="grid gap-4 md:grid-cols-2">
                                <input
                                    placeholder="Immatriculation (ex: AB-123-CD)"
                                    required
                                    value={newCar.licensePlate}
                                    onChange={e => setNewCar({ ...newCar, licensePlate: e.target.value.toUpperCase() })}
                                    className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-3 text-sm focus:border-[#F0B90B] outline-none"
                                />
                                <input
                                    placeholder="Marque (ex: Toyota)"
                                    required
                                    value={newCar.make}
                                    onChange={e => setNewCar({ ...newCar, make: e.target.value })}
                                    className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-3 text-sm focus:border-[#F0B90B] outline-none"
                                />
                                <input
                                    placeholder="Modèle (ex: Corolla)"
                                    required
                                    value={newCar.model}
                                    onChange={e => setNewCar({ ...newCar, model: e.target.value })}
                                    className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-3 text-sm focus:border-[#F0B90B] outline-none"
                                />
                                <input
                                    placeholder="Couleur (ex: Blanc)"
                                    value={newCar.color}
                                    onChange={e => setNewCar({ ...newCar, color: e.target.value })}
                                    className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-3 text-sm focus:border-[#F0B90B] outline-none"
                                />
                                <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                                    <button type="button" onClick={() => setShowAddCar(false)} className="text-gray-400 text-sm hover:text-white">Annuler</button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="bg-[#F0B90B] text-black font-semibold px-4 py-2 rounded-lg text-sm hover:bg-[#e0b010] disabled:opacity-50"
                                    >
                                        {submitting ? 'Enregistrement...' : 'Enregistrer le véhicule'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Liste Véhicules */}
                    {vehicles.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-[#1f1f1f] rounded-xl text-gray-500 text-sm">
                            Aucun véhicule enregistré.
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {vehicles.map(v => (
                                <div key={v.id} className="bg-[#0C0C0C] border border-[#1f1f1f] p-4 rounded-xl flex justify-between items-center">
                                    <div>
                                        <h4 className="font-bold text-white">{v.license_plate}</h4>
                                        <p className="text-sm text-gray-400">{v.color} {v.make} {v.model}</p>
                                    </div>
                                    <div className="h-8 w-8 bg-[#1f1f1f] rounded-full flex items-center justify-center">
                                        <Car className="w-4 h-4 text-gray-400" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Section Contraventions (Mock pour l'instant) */}
                {/* Section Contraventions */}
                <section>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            Mes Contraventions
                        </h2>
                        <div className="text-sm text-gray-400">
                            Total Impayé: <span className="text-[#F0B90B] font-bold">{fines.filter(f => f.status !== 'PAID').reduce((sum, f) => sum + (f.amount || 0), 0).toFixed(2)} $</span>
                        </div>
                    </div>

                    {loadingFines ? (
                        <div className="text-center py-10 text-gray-500">Chargement des amendes...</div>
                    ) : fines.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-[#1f1f1f] rounded-xl text-gray-500 text-sm">
                            Aucune contravention trouvée.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {fines.map(fine => (
                                <div key={fine.id} className="bg-[#0C0C0C] border border-[#1f1f1f] p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${fine.status === 'PAID' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                                                {fine.status === 'PAID' ? 'PAYÉE' : 'IMPAYÉE'}
                                            </span>
                                            <span className="text-sm text-gray-400">Date: {new Date(fine.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <h4 className="font-bold text-white mt-1">{fine.reason || 'Infraction'}</h4>
                                        <p className="text-xs text-gray-500">Plaque: {fine.vehicle_plate || 'N/A'} • Ref: {fine.infraction_code}</p>
                                    </div>

                                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                        <p className="text-xl font-bold text-[#F0B90B]">{fine.amount} $</p>
                                        {fine.status !== 'PAID' && (
                                            <button
                                                onClick={() => handleOpenPay(fine)}
                                                className="bg-[#F0B90B] text-black text-xs font-bold px-3 py-1.5 rounded hover:bg-[#e0b010]"
                                            >
                                                PAYER
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <MetadataModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    metadata={modalMetadata}
                    isLoading={loadingMetadata}
                    contraventionId={selectedFine?.id}
                    status={selectedFine?.status}
                />

            </div>
        </div>
    );
}
