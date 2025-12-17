import { NextResponse } from 'next/server';
import { sendToBlockchain } from '@/lib/blockchain';

export async function POST(request: Request) {
  try {
    const contraventionData = await request.json();

    // Validation des données
    // Usager n'est plus obligatoire ici car peut être inconnu à ce stade
    if (!contraventionData.agentId || !contraventionData.plaque || !contraventionData.infractionId) {
      return NextResponse.json(
        { error: 'Tous les champs (Agent, Plaque, Infraction) sont obligatoires' },
        { status: 400 }
      );
    }

    // Envoi sur la blockchain
    const txHash = await sendToBlockchain({
      agent: contraventionData.agentId,
      plaque: contraventionData.plaque,
      permisOrUsager: contraventionData.permis, // USR-XXX ou Permis
      // usager: legacy ignored
      infraction: contraventionData.infractionId,
      infractionName: contraventionData.infractionName, // Added
      montant: contraventionData.montant || 0,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      txHash
    });

  } catch (error) {
    console.error('Erreur lors de l\'envoi sur la blockchain:', error);
    return NextResponse.json(
      {
        error: 'Erreur lors de l\'envoi sur la blockchain',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}
