
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
    try {
        const { fineId, method = 'SIMULATED' } = await request.json();

        if (!fineId) {
            return NextResponse.json({ error: "Fine ID requis" }, { status: 400 });
        }

        console.log(`Paiement amende ${fineId} via ${method}`);

        // Simulation de paiement (ou intégration future)
        // On met à jour le statut directement.
        const { data, error } = await supabase
            .from('fines')
            .update({
                status: 'PAID',
                updated_at: new Date().toISOString()
                // payment_method: method 
            })
            .eq('id', fineId)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, fine: data });

    } catch (error: any) {
        console.error('Payment error:', error);
        return NextResponse.json({ error: "Erreur lors du paiement: " + error.message }, { status: 500 });
    }
}
