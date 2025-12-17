
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Admin key pour bypass RLS si besoin
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const plaque = searchParams.get('plaque');
    const permis = searchParams.get('permis');

    if (!plaque && !permis) {
        return NextResponse.json({ error: 'Plaque, Permis ou ID Usager requis' }, { status: 400 });
    }

    try {
        let driverData = null;
        let vehicleData = null;

        // --- STRATEGY 1: Lookup by PID (USR-XXX) or License Number ---
        if (permis) {
            // Case A: USR- ID (Usager)
            if (permis.startsWith('USR-')) {
                const { data: userData, error } = await supabase
                    .from('users')
                    .select('id, nom, prenom, post_nom, phone, email, login_identifier')
                    .eq('login_identifier', permis)
                    .maybeSingle();

                if (userData) {
                    driverData = {
                        user_id: userData.id,
                        full_name: `${userData.prenom} ${userData.nom} ${userData.post_nom || ''}`.trim(),
                        phone: userData.phone,
                        matricule: userData.login_identifier,
                        type: 'USAGER'
                    };
                    // Try to find a vehicle for this user
                    const { data: vParams } = await supabase.from('vehicles').select('*').eq('owner_id', userData.id).limit(1).maybeSingle();
                    if (vParams) vehicleData = vParams;
                }
            }
            // Case B: License Number (Driver)
            else {
                const { data: profile } = await supabase.from('driver_profiles').select('*').eq('license_number', permis).maybeSingle();
                if (profile) {
                    const { data: u } = await supabase.from('users').select('full_name, phone, matricule').eq('id', profile.user_id).single();
                    driverData = {
                        user_id: profile.user_id,
                        full_name: u?.full_name || 'Inconnu',
                        phone: u?.phone,
                        matricule: u?.matricule,
                        license_plate: profile.license_plate,
                        license_number: profile.license_number,
                        type: 'DRIVER'
                    };
                    vehicleData = {
                        license_plate: profile.license_plate,
                        make: profile.vehicle_brand,
                        model: profile.vehicle_model,
                        color: profile.vehicle_color
                    };
                }
            }
        }

        // --- STRATEGY 2: Lookup by Plate ---
        if (!driverData && plaque) {
            // Case A: Driver Profile
            const { data: profile } = await supabase.from('driver_profiles').select('*').eq('license_plate', plaque).maybeSingle();
            if (profile) {
                const { data: u } = await supabase.from('users').select('full_name, phone, matricule').eq('id', profile.user_id).single();
                driverData = {
                    user_id: profile.user_id,
                    full_name: u?.full_name || 'Inconnu',
                    phone: u?.phone,
                    matricule: u?.matricule,
                    license_plate: profile.license_plate,
                    license_number: profile.license_number,
                    type: 'DRIVER'
                };
                vehicleData = {
                    license_plate: profile.license_plate,
                    make: profile.vehicle_brand,
                    model: profile.vehicle_model,
                    color: profile.vehicle_color
                };
            }
            // Case B: Usager Vehicle
            else {
                const { data: v } = await supabase.from('vehicles').select('*').eq('license_plate', plaque).maybeSingle();
                if (v) {
                    const { data: u } = await supabase.from('users').select('id, nom, prenom, post_nom, phone, login_identifier').eq('id', v.owner_id).single();
                    if (u) {
                        driverData = {
                            user_id: u.id,
                            full_name: `${u.prenom} ${u.nom} ${u.post_nom || ''}`.trim(),
                            phone: u.phone,
                            matricule: u.login_identifier,
                            type: 'USAGER'
                        };
                        vehicleData = v;
                    }
                }
            }
        }

        if (!driverData) {
            return NextResponse.json({ found: false, message: 'Aucun enregistrement trouvé (Chauffeur ou Usager)' });
        }

        // --- Format Response ---
        return NextResponse.json({
            found: true,
            driver: {
                userId: driverData.user_id,
                fullName: driverData.full_name,
                phone: driverData.phone,
                matricule: driverData.matricule || 'N/A', // USR-XXX or AGT-XXX or N/A
                plate: vehicleData?.license_plate || driverData.license_plate || plaque,
                licenseNumber: driverData.license_number || (driverData.type === 'USAGER' ? driverData.matricule : 'N/A'),
                vehicle: vehicleData ? {
                    brand: vehicleData.make || vehicleData.vehicle_brand,
                    model: vehicleData.model || vehicleData.vehicle_model,
                    color: vehicleData.color || vehicleData.vehicle_color,
                    status: 'ACTIVE'
                } : null,
                type: driverData.type
            }
        });

    } catch (error) {
        console.error('Erreur lookup:', error);
        return NextResponse.json({ error: 'Erreur serveur recherche' }, { status: 500 });
    }
}
