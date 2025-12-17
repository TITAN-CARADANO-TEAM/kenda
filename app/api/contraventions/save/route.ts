
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialisation du client Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentId, usagerId, txHash, infractionId, montant, plaque } = body;

    // Validation des données minimales
    if (!agentId || !txHash || !infractionId) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants (agentId, txHash, infractionId)' },
        { status: 400 }
      );
    }

    // 1. Récupérer l'UUID de l'agent (via Matricule)
    const { data: agentData, error: agentError } = await supabase
      .from('users')
      .select('id')
      .eq('matricule', agentId)
      .single();

    if (agentError || !agentData) {
      return NextResponse.json(
        { error: `Agent introuvable : ${agentId}` },
        { status: 404 }
      );
    }

    // 2. Récupérer l'UUID de l'usager (via Plaque ou Matricule)
    let offenderId = null;

    // A. Essai via Plaque d'immatriculation (Prioritaire pour la Police)
    if (plaque) {
      const { data: driverData, error: driverError } = await supabase
        .from('driver_profiles')
        .select('user_id')
        .eq('license_plate', plaque)
        .maybeSingle();

      if (driverData) {
        offenderId = driverData.user_id;
        console.log(`Chauffeur trouvé via plaque ${plaque}: ${offenderId}`);
      } else {
        // Fallback: Check vehicles table (Usagers)
        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('owner_id')
          .eq('license_plate', plaque)
          .maybeSingle();

        if (vehicleData) {
          offenderId = vehicleData.owner_id;
          console.log(`Usager trouvé via plaque ${plaque}: ${offenderId}`);
        }
      }
    }

    // B. Si pas trouvé via plaque, essai via Matricule Usager (Fallback)
    if (!offenderId && usagerId && usagerId !== 'USR-') {
      const { data: usagerData } = await supabase
        .from('users')
        .select('id')
        .eq('matricule', usagerId)
        .maybeSingle();

      if (usagerData) offenderId = usagerData.id;
    }

    // 3. Insérer la contravention
    const { data, error } = await supabase
      .from('fines')
      .insert([{
        officer_id: agentData.id,
        offender_id: offenderId,
        infraction_code: infractionId, // Mapped to the correct column name 'infraction_code' based on types
        amount: montant || 0,
        currency: 'USD',
        // reason: 'Infraction Code ' + infractionId, // Optional: fill reason if mandatory
        // Assuming 'reason' is NOT mandatory or is handled by default/trigger if missing. 
        // Checking FindRow type: reason is string (mandatory?). 
        // Let's add reason to be safe.
        reason: 'Infraction Routière',
        // on_chain_status: 'PENDING', // Removed: column missing in DB
        // tx_hash: txHash, // Removed: likely missing too based on types

        // Storing important info in existing columns
        description: `Blockchain TX: ${txHash}`, // Saving hash in description
        vehicle_plate: plaque,
        location_address: plaque ? `Vehicule: ${plaque}` : undefined,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Erreur insertion fines:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      data,
      message: offenderId
        ? 'Contravention enregistrée et liée au chauffeur.'
        : 'Contravention enregistrée (Chauffeur non identifié).'
    });

  } catch (error) {
    console.error('Erreur API Save:', error);
    return NextResponse.json(
      {
        error: 'Erreur serveur lors de l\'enregistrement',
        details: error instanceof Error ? error.message : JSON.stringify(error)
      },
      { status: 500 }
    );
  }
}
