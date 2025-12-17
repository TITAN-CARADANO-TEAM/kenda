
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, make, model, color, licensePlate } = body;

        if (!userId || !licensePlate) {
            return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
        }

        // Insert vehicle
        const { data, error } = await supabase
            .from('vehicles')
            .insert([{
                owner_id: userId,
                make,
                model,
                color,
                license_plate: licensePlate
            }])
            .select()
            .single();

        if (error) {
            // Handle unique constraint violation
            if (error.code === '23505') {
                return NextResponse.json({ error: "Ce véhicule est déjà enregistré." }, { status: 409 });
            }
            throw error;
        }

        return NextResponse.json({ success: true, vehicle: data });

    } catch (error) {
        console.error('Vehicle Error:', error);
        return NextResponse.json({ error: "Erreur enregistrement véhicule" }, { status: 500 });
    }
}

export async function GET(request: Request) {
    // Can be used to list vehicles for a user
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: "UserId requis" }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('owner_id', userId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ vehicles: data });
}
