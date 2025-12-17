import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const TREASURY_ADDRESS = "addr_test1qp8kuc9tt05vmsclklzp2l8el7ry36v34ryty5357d0d8sslz9je4qjgjy7zk0thdwwpp5eqedruf7g3yc08xy4gh4hseg0x47";
const BLOCKFROST_PROJECT_ID = "preprod6eb6sa6Y14nBKQqffIGOCkDCRACxRRHd"; // sera placé dans .env

export async function POST(request: Request) {
    try {
        const { contraventionId, txHash, amount } = await request.json();

        if (!contraventionId || !txHash || !amount) {
            return NextResponse.json(
                { error: 'Données manquantes' },
                { status: 400 }
            );
        }

        // 1. Vérifier la transaction sur Blockfrost avec Retry Loop
        // La transaction peut mettre quelques secondes à apparaître dans l'API Blockfrost
        let verifyResponse;
        let attempts = 0;
        const maxAttempts = 30; // 30 tentatives max (augmenté pour gérer les délais de propagation)
        const delayMs = 2000; // 2 secondes entre chaque essai

        while (attempts < maxAttempts) {
            try {
                console.log(`📡 Tentative ${attempts + 1}/${maxAttempts} vérification Blockfrost...`);
                verifyResponse = await fetch(
                    `https://cardano-preprod.blockfrost.io/api/v0/txs/${txHash}/utxos`,
                    {
                        headers: {
                            project_id: BLOCKFROST_PROJECT_ID,
                        },
                    }
                );

                if (verifyResponse.ok) {
                    console.log("✅ Transaction trouvée sur Blockfrost !");
                    break; // Sortie de la boucle si succès
                } else if (verifyResponse.status === 404) {
                    // Si 404, on attend et on réessaie
                    console.log("⏳ Transaction pas encore visible, attente...");
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    attempts++;
                } else {
                    // Si autre erreur (ex: 500, 403), on arrête tout de suite
                    throw new Error(`Erreur Blockfrost: ${verifyResponse.status}`);
                }
            } catch (error) {
                console.error("Erreur durant la vérification:", error);
                // On continue d'essayer sauf si c'est la dernière tentative
                if (attempts === maxAttempts - 1) throw error;
                attempts++;
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        if (!verifyResponse || !verifyResponse.ok) {
            return NextResponse.json(
                { error: 'Transaction introuvable sur la blockchain après plusieurs tentatives. Veuillez réessayer dans quelques instants.' },
                { status: 400 }
            );
        }

        const utxos = await verifyResponse.json();

        // 2. Vérifier que l'argent est bien envoyé au Trésor
        // On cherche une sortie (output) qui correspond à l'adresse du Trésor
        const treasuryOutput = utxos.outputs.find(
            (output: any) => output.address === TREASURY_ADDRESS
        );

        if (!treasuryOutput) {
            return NextResponse.json(
                { error: 'Aucun paiement détecté vers le Trésor Public' },
                { status: 400 }
            );
        }

        // 3. Vérifier le montant
        // Le montant dans Blockfrost est en Lovelace (1 ADA = 1,000,000 Lovelace)
        const amountInLovelace = treasuryOutput.amount.find(
            (a: any) => a.unit === 'lovelace'
        );

        if (!amountInLovelace) {
            return NextResponse.json(
                { error: 'Aucun montant en ADA trouvé' },
                { status: 400 }
            );
        }

        const paidAmount = parseInt(amountInLovelace.quantity) / 1000000; // Conversion en ADA
        const requiredAmount = parseFloat(amount.replace(/[^0-9.]/g, '')); // Nettoyer "80 USD" -> 80

        // On accepte une petite marge d'erreur (frais, etc) ou on est strict ?
        // Ici on est strict : il faut avoir payé au moins le montant dû
        if (paidAmount < requiredAmount) {
            return NextResponse.json(
                { error: `Montant insuffisant. Reçu: ${paidAmount} ADA, Attendu: ${requiredAmount} ADA` },
                { status: 400 }
            );
        }

        // 4. Mettre à jour Supabase
        console.log(`✅ Paiement validé (${paidAmount} ADA). Mise à jour Supabase pour ID: ${contraventionId}...`);

        // On utilise supabaseAdmin pour contourner les RLS si nécessaire, mais ici on veut être sûr
        // 4. Mettre à jour Supabase
        console.log(`✅ Paiement validé (${paidAmount} ADA). Mise à jour Supabase pour ID: ${contraventionId}...`);

        const { error: updateError } = await supabaseAdmin
            .from('fines')
            .update({
                status: 'PAID',
                // payment_tx_hash: txHash, // Column might not exist in fines. If it does, great. If not, maybe skip or use other field.
                // description: ... // Could append.
                updated_at: new Date().toISOString(),
            })
            .eq('id', contraventionId);

        if (updateError) {
            console.error('❌ Erreur CRITIQUE update Supabase:', updateError);
            return NextResponse.json(
                { error: 'Erreur lors de la mise à jour de la contravention: ' + updateError.message },
                { status: 500 }
            );
        }

        console.log("🎉 Succès ! Contravention mise à jour.");
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Erreur API Pay:', error);
        return NextResponse.json(
            { error: 'Erreur serveur interne' },
            { status: 500 }
        );
    }
}
