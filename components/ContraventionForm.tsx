import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

interface Infraction {
  id: string;
  nom: string;
  tarif_usd: number;
}

interface ContraventionData {
  agentId: string;
  plaque: string;
  numeroPermis: string; // Updated
  infractionId: string;
  montant: number;
}

interface Props {
  onSubmit: (data: ContraventionData) => void;
}

export default function ContraventionForm({ onSubmit }: Props) {
  const [infractions, setInfractions] = useState<Infraction[]>([]);
  const [selectedInfraction, setSelectedInfraction] = useState<Infraction | null>(null);

  // State definitions moved to top
  const [formData, setFormData] = useState<ContraventionData>({
    agentId: 'AGT-',
    plaque: '',
    numeroPermis: '', // Updated
    infractionId: '',
    montant: 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Nouveau state pour la recherche plaque
  const [isCheckingPlaque, setIsCheckingPlaque] = useState(false);
  const [driverInfo, setDriverInfo] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/infractions');
        if (res.ok) setInfractions(await res.json());
      } catch (e) { console.error(e); }
    }
    load();
  }, []);

  const handleInfractionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const infractionId = e.target.value;
    const infraction = infractions.find(i => i.id === infractionId);

    if (infraction) {
      setSelectedInfraction(infraction);
      setFormData({
        ...formData,
        infractionId: infraction.id,
        montant: infraction.tarif_usd
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    // Gestion spéciale pour les champs avec préfixe
    if (name === 'agentId') {
      // Ne garder que les chiffres après le préfixe
      const numbersOnly = value.replace(/\D/g, '');
      setFormData({ ...formData, [name]: `AGT-${numbersOnly}` });
    } else if (name === 'numeroPermis') {
      // Nettoyage ou formatage si nécessaire (pour l'instant brut)
      setFormData({ ...formData, [name]: value });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const checkDriver = async (field: 'plaque' | 'permis') => {
    const value = field === 'plaque' ? formData.plaque : formData.numeroPermis;
    if (!value || value.length < 3) return;

    setIsCheckingPlaque(true);
    setDriverInfo(null);

    try {
      const param = field === 'plaque' ? `plaque=${value}` : `permis=${value}`;
      const res = await fetch(`/api/drivers/lookup?${param}`);
      const data = await res.json();

      if (data.found && data.driver) {
        setDriverInfo(data.driver);

        // Auto-complete fields
        setFormData(prev => ({
          ...prev,
          plaque: data.driver.plate || prev.plaque,
          numeroPermis: data.driver.licenseNumber || prev.numeroPermis
        }));

        toast.success(`Chauffeur identifié : ${data.driver.fullName}`);
      } else {
        toast('Aucun véhicule/chauffeur trouvé', { icon: '⚠️' });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckingPlaque(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!/^AGT-\d+$/.test(formData.agentId)) {
      setError("Veuillez entrer un numéro d'agent valide (ex: AGT-123)");
      return;
    }

    // Validation Permis (Optionnel ou format spécifique si besoin)
    // Ici on laisse libre pour l'instant

    if (!formData.infractionId) {
      setError("Veuillez sélectionner une infraction");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/contraventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: formData.agentId.replace('AGT-', ''),
          plaque: formData.plaque,
          // note: usager field removed from API payload as per request since we rely on plaque/permis
          infractionId: formData.infractionId,
          infractionName: selectedInfraction?.nom || 'Infraction inconnue', // Pour description claire
          montant: formData.montant,
          permis: formData.numeroPermis // Contient soit Permis soit USR-XXX
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Une erreur est survenue lors de la création de la transaction');
      }

      // Stocker le hash de la transaction
      if (result.txHash) {
        setTxHash(result.txHash);
        toast.success('Transaction blockchain réussie ! Vous pouvez maintenant enregistrer dans la base de données.');
      } else {
        throw new Error('Aucun hash de transaction reçu');
      }

    } catch (error) {
      console.error('Erreur:', error);
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue';
      setError(errorMessage);
      toast.error(`Erreur: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fonction pour enregistrer dans la base de données
  const handleSaveToDatabase = async () => {
    if (!txHash) {
      toast.error('Aucune transaction à enregistrer');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch('/api/contraventions/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: formData.agentId,
          permis: formData.numeroPermis,
          infractionId: formData.infractionId,
          montant: formData.montant,
          plaque: formData.plaque,
          txHash,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de l\'enregistrement dans la base de données');
      }

      toast.success('Contravention enregistrée avec succès dans la base de données !');

      // Réinitialiser le formulaire après un enregistrement réussi
      setFormData({
        agentId: 'AGT-',
        plaque: '',
        numeroPermis: '',
        infractionId: '',
        montant: 0,
      });
      setSelectedInfraction(null);
      setTxHash(null);

    } catch (error) {
      console.error('Erreur lors de l\'enregistrement:', error);
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue lors de l\'enregistrement';
      setSaveError(errorMessage);
      toast.error(`Erreur: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.25em] text-[#F0B90B]">
          Formulaire
        </p>
        <h1 className="text-2xl font-semibold text-white">
          Création d&apos;une contravention
        </h1>
        <p className="text-gray-400 text-sm">
          Remplissez les détails de l&apos;infraction. Tous les champs sont obligatoires.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 bg-[#0A0A0A] p-6 rounded-2xl border border-[#1f1f1f]"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="agentId" className="block text-sm font-medium text-[#F0B90B] mb-1.5">
              Agent ID
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">AGT-</span>
              <input
                type="text"
                id="agentId"
                name="agentId"
                value={formData.agentId}
                onChange={handleChange}
                required
                className="w-full bg-[#0A0A0A] border border-[#1f1f1f] text-white text-sm rounded-lg focus:ring-2 focus:ring-[#F0B90B]/50 focus:border-[#F0B90B] block pl-12 pr-3 py-2.5 transition-all duration-200"
                placeholder="123456"
              />
            </div>
          </div>

          <div>
            <label htmlFor="plaque" className="block text-sm font-medium text-[#F0B90B] mb-1.5">
              Plaque d'immatriculation
            </label>
            <input
              type="text"
              id="plaque"
              name="plaque"
              value={formData.plaque}
              onChange={handleChange}
              onBlur={() => checkDriver('plaque')}
              required
              className="bg-[#0A0A0A] border border-[#1f1f1f] text-white text-sm rounded-lg focus:ring-2 focus:ring-[#F0B90B]/50 focus:border-[#F0B90B] block w-full p-2.5 transition-all duration-200"
              placeholder="AB-123-CD"
            />
            {isCheckingPlaque && <p className="text-xs text-[#F0B90B] mt-1">Recherche du véhicule...</p>}
            {driverInfo && (
              <div className="mt-2 p-3 bg-[#1a1a1a] rounded-lg border border-green-900/50">
                <p className="text-sm text-green-400 font-medium">✅ Chauffeur identifié</p>
                <p className="text-xs text-gray-300">Nom : <span className="text-white font-semibold">{driverInfo.fullName}</span></p>
                {driverInfo.vehicle && (
                  <p className="text-xs text-gray-300">Véhicule : {driverInfo.vehicle.color} {driverInfo.vehicle.brand} {driverInfo.vehicle.model}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="numeroPermis" className="block text-sm font-medium text-[#F0B90B] mb-1.5">
              Numéro de Permis ou ID Usager
            </label>
            <div className="relative">
              {/* Prefix removed */}
              <input
                type="text"
                id="numeroPermis"
                name="numeroPermis"
                value={formData.numeroPermis || ''}
                onChange={handleChange}
                onBlur={() => checkDriver('permis')}
                className="w-full bg-[#0A0A0A] border border-[#1f1f1f] text-white text-sm rounded-lg focus:ring-2 focus:ring-[#F0B90B]/50 focus:border-[#F0B90B] block pl-4 pr-3 py-2.5 transition-all duration-200"
                placeholder="Ex: 123456 ou USR-0001"
              />
            </div>
          </div>


          <div>
            <label htmlFor="montant" className="block text-sm font-medium text-[#F0B90B] mb-1.5">
              Montant de l'amende (USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="text"
                id="montant"
                name="montant"
                value={formData.montant ? formData.montant.toFixed(2) : ''}
                readOnly
                className="w-full bg-[#0A0A0A] border border-[#1f1f1f] text-white text-sm rounded-lg block pl-8 pr-3 py-2.5 bg-opacity-50 cursor-not-allowed"
                placeholder="Sélectionnez d'abord une infraction"
              />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="infraction" className="block text-sm font-medium text-[#F0B90B] mb-1.5">
            Sélectionnez l'infraction
          </label>
          <select
            id="infraction"
            name="infraction"
            value={formData.infractionId}
            onChange={handleInfractionChange}
            required
            className="w-full bg-[#0A0A0A] border border-[#1f1f1f] text-white text-sm rounded-lg focus:ring-2 focus:ring-[#F0B90B]/50 focus:border-[#F0B90B] p-2.5 transition-all duration-200"
          >
            <option value="">Sélectionnez une infraction</option>
            {infractions.map((infraction) => (
              <option key={infraction.id} value={infraction.id}>
                {infraction.nom} - {infraction.tarif_usd} USD
              </option>
            ))}
          </select>
          {selectedInfraction && (
            <div className="mt-2 p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
              <p className="text-sm text-gray-300">
                <span className="font-medium text-[#F0B90B]">Description :</span> {selectedInfraction.nom}
              </p>
              <p className="text-sm text-gray-300 mt-1">
                <span className="font-medium text-[#F0B90B]">Référence :</span> #{selectedInfraction.id}
              </p>
            </div>
          )}
        </div>

        {/* Affichage des erreurs */}
        {error && (
          <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
            {error}
          </div>
        )}

        {saveError && (
          <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
            {saveError}
          </div>
        )}

        <div className="pt-6 space-y-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full ${isSubmitting
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-[#F0B90B] hover:bg-[#F0B90B]/90'
              } text-black font-medium rounded-lg text-sm px-5 py-3 text-center transition-all duration-200 flex items-center justify-center gap-2`}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Enregistrement en cours...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                    clipRule="evenodd"
                  />
                </svg>
                Créer la contravention
              </>
            )}
          </button>

          {txHash && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800">Transaction blockchain réussie !</p>
                  <p className="text-xs text-green-600 mt-1 break-all">
                    <span className="font-medium">Hash :</span> {txHash}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveToDatabase}
                  disabled={isSaving}
                  className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-sm px-4 py-2.5 text-center inline-flex items-center justify-center gap-2 transition-colors duration-200"
                >
                  {isSaving ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Enregistrer dans la base de données
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>

  );
}
