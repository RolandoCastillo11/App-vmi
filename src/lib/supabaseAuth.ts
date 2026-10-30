import { supabase, isSupabaseConfigured } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'shop' | 'driver' | 'cedis';
  shop_id?: string;
  shop_name?: string;
  phone?: string;
  address?: string;
  rfc?: string;
  delivery_reference?: string;
  invitation_code?: string;
  is_verified?: boolean;
  must_change_password?: boolean;
}

export interface ShopSignUpPayload {
  email: string;
  password: string;
  fullName: string;
  shopName: string;
  phone: string;
  address: string;
  rfc?: string;
  deliveryReference?: string;
  invitationCode: string;
}

// Códigos maestros de respaldo por si aún no ejecutan la migración en Supabase
const MASTER_INVITATION_CODES = ['IBARRA-VMI-2026', 'CEDIS-ALT-7701', 'CEDIS-TAM-8802', 'CEDIS-MAD-9903'];

/**
 * Valida si un folio o código de invitación de CEDIS Ibarra es auténtico y está activo
 */
export async function verifyInvitationCode(code: string): Promise<{ valid: boolean; message: string }> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, message: 'Ingresa el folio de invitación proporcionado por CEDIS Ibarra.' };
  }

  // 1. Verificar primero en la tabla de Supabase si está disponible
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('invitation_codes')
        .select('*')
        .eq('code', cleanCode)
        .eq('is_active', true)
        .maybeSingle();

      if (!error && data) {
        if (data.max_uses && data.times_used >= data.max_uses) {
          return { valid: false, message: 'Este folio de invitación ya alcanzó el límite de usos autorizados.' };
        }
        return { valid: true, message: 'Folio CEDIS Ibarra validado exitosamente.' };
      }
    } catch (e) {
      console.warn("No se pudo consultar invitation_codes en Supabase, verificando códigos maestros:", e);
    }
  }

  // 2. Validación de respaldo con códigos maestros de Almacenes Ibarra
  if (MASTER_INVITATION_CODES.includes(cleanCode)) {
    return { valid: true, message: 'Folio CEDIS Ibarra validado exitosamente.' };
  }

  return { 
    valid: false, 
    message: 'Folio no válido o no autorizado. Solicita un folio oficial a tu promotor de Almacenes Ibarra.' 
  };
}

export async function signInWithEmail(email: string, password: string): Promise<{ user: User | null; session: Session | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { user: null, session: null, error: new Error('Supabase no está configurado aún en el archivo .env') };
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // Si son credenciales oficiales establecidas y aún no corren el seed en auth.users de Supabase:
  if (error && (email === 'chofer402@ibarra.com.mx' || email === 'cedis.altamira@ibarra.com.mx') && password === 'ibarra2026') {
    const roleKey = email.includes('chofer') ? 'driver' : 'cedis';
    const profile = ESTABLISHED_PROFILES[roleKey];
    const fallbackUser: any = {
      id: profile.id,
      email: profile.email,
      user_metadata: {
        full_name: profile.full_name,
        role: profile.role,
      }
    };
    return { user: fallbackUser, session: null, error: null };
  }

  return { user: data.user, session: data.session, error };
}

/**
 * Registro seguro con validación de Folio CEDIS Ibarra y datos completos del negocio
 */
export async function registerShopWithSupabase(
  payload: ShopSignUpPayload
): Promise<{ user: User | null; session: Session | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { user: null, session: null, error: new Error('Supabase no está configurado aún en el archivo .env') };
  }

  // 1. Validar Folio de Invitación por seguridad
  const codeCheck = await verifyInvitationCode(payload.invitationCode);
  if (!codeCheck.valid) {
    return { user: null, session: null, error: new Error(codeCheck.message) };
  }

  // 2. Crear usuario en Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        role: 'shop',
        full_name: payload.fullName,
        shop_name: payload.shopName,
        phone: payload.phone,
      },
    },
  });

  if (error) {
    return { user: null, session: null, error };
  }

  if (data.user) {
    const userId = data.user.id;
    const shopId = `shp-${Math.random().toString(36).substring(2, 9)}`;

    // 3. Crear registro de tienda física para entregas logísticas
    try {
      await supabase.from('shops').insert({
        id: shopId,
        name: payload.shopName,
        lat: 22.2500 + (Math.random() - 0.5) * 0.08, // Coordenadas aproximadas zona Tampico/Madero
        lng: -97.8500 + (Math.random() - 0.5) * 0.08,
        address: payload.address,
        contact: `${payload.fullName} (${payload.phone})`,
        phone: payload.phone,
        rfc: payload.rfc || null,
        delivery_reference: payload.deliveryReference || null,
        owner_id: userId,
      });
    } catch (shopErr) {
      console.warn("Aviso al crear tienda física vinculada:", shopErr);
    }

    // 4. Guardar perfil completo en `profiles`
    try {
      await supabase.from('profiles').upsert({
        id: userId,
        email: payload.email,
        full_name: payload.fullName,
        role: 'shop',
        shop_id: shopId,
        shop_name: payload.shopName,
        phone: payload.phone,
        address: payload.address,
        rfc: payload.rfc || null,
        delivery_reference: payload.deliveryReference || null,
        invitation_code: payload.invitationCode.trim().toUpperCase(),
        is_verified: true,
      });
    } catch (profileErr) {
      console.warn("Aviso al guardar perfil en profiles:", profileErr);
    }

    // 5. Registrar uso del folio en invitation_codes
    try {
      await supabase.rpc('increment_invitation_code', { code_val: payload.invitationCode.trim().toUpperCase() });
    } catch {
      // Si la RPC no existe aún, actualizamos directamente
      try {
        await supabase
          .from('invitation_codes')
          .update({ times_used: 1 })
          .eq('code', payload.invitationCode.trim().toUpperCase());
      } catch (incErr) {
        console.warn("Aviso al incrementar uso de folio:", incErr);
      }
    }
  }

  return { user: data.user, session: data.session, error: null };
}

export async function signOutSupabase() {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.auth.signOut();
  if (error) console.error("Error signing out from Supabase:", error);
}

export async function getCurrentSupabaseUser(): Promise<User | null> {
  if (!isSupabaseConfigured) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export const ESTABLISHED_PROFILES: Record<'driver' | 'cedis' | 'shop', UserProfile> = {
  driver: {
    id: 'd0000000-0000-0000-0000-000000000402',
    email: 'chofer402@ibarra.com.mx',
    full_name: 'Carlos Mendoza',
    role: 'driver',
    phone: '8334021100',
    is_verified: true,
  },
  cedis: {
    id: 'c0000000-0000-0000-0000-000000000001',
    email: 'cedis.altamira@ibarra.com.mx',
    full_name: 'Ing. Roberto Garza',
    role: 'cedis',
    phone: '8332601000',
    is_verified: true,
  },
  shop: {
    id: 'shp-0000-0000-0000-000000000001',
    email: 'tienda.donlupe@ibarra.com.mx',
    full_name: 'D. Lupe Reyes',
    shop_name: 'Abarrotes Don Lupe',
    role: 'shop',
    phone: '8331002030',
    address: 'Zona Centro, Tampico',
    is_verified: true,
  }
};

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    if (userId.includes('402') || userId === 'driver') return ESTABLISHED_PROFILES.driver;
    if (userId.includes('cedis') || userId === 'cedis') return ESTABLISHED_PROFILES.cedis;
    return null;
  }
  return data as UserProfile;
}

export function onSupabaseAuthStateChange(callback: (user: User | null, session: Session | null) => void) {
  if (!isSupabaseConfigured) {
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null, session);
  });
}

export async function updateUserPasswordAndClearFlag(newPassword: string, userId: string) {
  if (!isSupabaseConfigured) throw new Error('Supabase no está configurado');
  
  const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
  if (authError) throw authError;

  await supabase.from('profiles').update({ must_change_password: false }).eq('id', userId);
  return { success: true };
}
