
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: "UserId requis" }, { status: 400 });
    }

    try {
        const { data: fines, error } = await supabase
            .from('fines')
            .select('*')
            .eq('offender_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Optional: Enhance with proper infraction names if needed, 
        // but for now return raw data.

        return NextResponse.json({ fines });

    } catch (error) {
        console.error('Fetch fines error:', error);
        return NextResponse.json({ error: "Erreur récupération amendes" }, { status: 500 });
    }
}
