import React, { useState, useRef } from 'react';
import { 
  LogIn, 
  Truck, 
  Store, 
  AlertTriangle, 
  RefreshCw, 
  Sparkles, 
  Building2, 
  Database, 
  KeyRound, 
  Mail, 
  UserPlus, 
  ShieldCheck,
  Phone,
  MapPin,
  FileBadge,
  Compass,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut } from 'firebase/auth';
import { isSupabaseConfigured } from '../lib/supabase';
import { 
  signInWithEmail, 
  registerShopWithSupabase, 
  verifyInvitationCode, 
  ShopSignUpPayload 
} from '../lib/supabaseAuth';
import GoogleSignInModal from '../components/GoogleSignInModal';
import CompleteProfileModal, { ShopProfileData } from '../components/CompleteProfileModal';
import InstallAppBanner from '../components/InstallAppBanner';

export default function LoginScreen({ onLogin }: { onLogin: (role: 'driver' | 'shop' | 'cedis', customUser?: any) => void }) {
  const [role, setRole] = useState<'driver' | 'shop' | 'cedis'>('shop');
  const [authMode, setAuthMode] = useState<'demo' | 'supabase'>('demo');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [isCompleteProfileOpen, setIsCompleteProfileOpen] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<{ id: string; email: string; name: string; picture?: string } | null>(null);
  
  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration form state (Expanded fields)
  const [invitationCode, setInvitationCode] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [codeVerified, setCodeVerified] = useState<boolean | null>(null);
  const [codeFeedback, setCodeFeedback] = useState<string | null>(null);
  
  const [shopName, setShopName] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [rfc, setRfc] = useState('');
  const [deliveryReference, setDeliveryReference] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const isSubmittingRef = useRef(false);

  // Validar Folio de Invitación en tiempo real
  const handleVerifyCode = async () => {
    if (!invitationCode.trim()) {
      setCodeVerified(false);
      setCodeFeedback('Ingresa un folio de invitación.');
      return;
    }
    setIsVerifyingCode(true);
    setCodeFeedback(null);
    try {
      const result = await verifyInvitationCode(invitationCode);
      setCodeVerified(result.valid);
      setCodeFeedback(result.message);
    } catch {
      setCodeVerified(false);
      setCodeFeedback('Error al validar el folio.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // 1. Supabase Submit (Login o Registro Seguro)
  const handleSupabaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Registro
    if (isRegisterMode) {
      if (role !== 'shop') {
        setErrorMessage('Por seguridad de la red logística, únicamente las Tiendas con folio oficial pueden registrarse.');
        return;
      }

      if (!invitationCode.trim()) {
        setErrorMessage('El folio de invitación de CEDIS Ibarra es obligatorio.');
        return;
      }
      if (!shopName.trim() || !fullName.trim() || !phone.trim() || !address.trim()) {
        setErrorMessage('Por favor completa todos los datos obligatorios de la tienda.');
        return;
      }
      if (!email.trim() || !password || password.length < 6) {
        setErrorMessage('Ingresa un correo válido y contraseña de al menos 6 caracteres.');
        return;
      }

      setIsSubmitting(true);
      try {
        const payload: ShopSignUpPayload = {
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          shopName: shopName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          rfc: rfc.trim() || undefined,
          deliveryReference: deliveryReference.trim() || undefined,
          invitationCode: invitationCode.trim(),
        };

        const { user, error } = await registerShopWithSupabase(payload);
        if (error) {
          setErrorMessage(error.message);
        } else if (user) {
          setSuccessMessage('¡Tienda afiliada con éxito! Ingresando...');
          setTimeout(() => onLogin('shop'), 1200);
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Error al registrar tienda.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Login normal con correo
    if (!email.trim() || !password) {
      setErrorMessage('Por favor ingresa tu correo y contraseña.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { user, error } = await signInWithEmail(email.trim(), password);
      if (error) {
        setErrorMessage(error.message);
      } else if (user) {
        onLogin(role);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al iniciar sesión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Escuchar mensaje de autenticación de la pestaña/ventana de Google real
  React.useEffect(() => {
    // Revisar si regresó de redirección directa de Google en la misma pestaña
    const pendingGoogleStr = localStorage.getItem('vmi_pending_google_user');
    if (pendingGoogleStr) {
      try {
        localStorage.removeItem('vmi_pending_google_user');
        const parsed = JSON.parse(pendingGoogleStr);
        if (parsed?.email) {
          processGoogleUser(parsed);
        }
      } catch {}
    }

    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS' && event.data?.user) {
        processGoogleUser(event.data.user);
      }
      if (event.data?.type === 'GOOGLE_AUTH_ERROR') {
        setErrorMessage(`Error de Google: ${event.data?.error || 'Acceso no concedido'}`);
      }
    };

    window.addEventListener('message', handleAuthMessage);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('vmi_google_auth_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'GOOGLE_AUTH_SUCCESS' && event.data?.user) {
          processGoogleUser(event.data.user);
        }
      };
    } catch {}

    return () => {
      window.removeEventListener('message', handleAuthMessage);
      if (bc) bc.close();
    };
  }, [role]);

  const processGoogleUser = (gUser: { id: string; email: string; name: string; picture?: string; idToken?: string }) => {
    const cleanEmail = gUser.email.toLowerCase();

    // Sincronizar credencial con Firebase si viene idToken
    if (gUser.idToken) {
      try {
        const credential = GoogleAuthProvider.credential(gUser.idToken);
        signInWithCredential(auth, credential).catch(() => {});
      } catch {}
    }

    // 1. Si es chofer o CEDIS: son personal corporativo ya registrado
    if (cleanEmail.includes('chofer') || role === 'driver') {
      onLogin('driver', {
        id: 'd0000000-0000-0000-0000-000000000402',
        email: cleanEmail,
        displayName: 'Carlos Mendoza (Chofer #402)',
        photoURL: gUser.picture
      });
      return;
    }

    if (cleanEmail.includes('cedis') || role === 'cedis') {
      onLogin('cedis', {
        id: 'c0000000-0000-0000-0000-000000000001',
        email: cleanEmail,
        displayName: 'Ing. Roberto Garza (CEDIS Altamira)',
        photoURL: gUser.picture
      });
      return;
    }

    // 2. Para tienda: verificar si ya completó su perfil antes
    const savedProfileStr = localStorage.getItem('vmi_profile_' + cleanEmail);
    if (savedProfileStr) {
      try {
        const savedProfile: ShopProfileData = JSON.parse(savedProfileStr);
        // "luego ya solo le dio google, abre pestaña, le doy a mi correo y ya inica automaticamente"
        onLogin('shop', {
          id: gUser.id,
          email: cleanEmail,
          displayName: savedProfile.shopName,
          photoURL: gUser.picture
        });
        return;
      } catch {}
    }

    // 3. Si es la primera vez que ingresa con este correo de Google:
    // "que ingreso y me dice completa perfil"
    setPendingGoogleUser(gUser);
    setIsCompleteProfileOpen(true);
  };

  const handleProfileSaved = (profileData: ShopProfileData) => {
    localStorage.setItem('vmi_profile_' + profileData.email.toLowerCase(), JSON.stringify(profileData));
    setIsCompleteProfileOpen(false);

    onLogin('shop', {
      id: pendingGoogleUser?.id || `user-${Date.now()}`,
      email: profileData.email,
      displayName: profileData.shopName,
      photoURL: pendingGoogleUser?.picture
    });
  };

  // 2. Google Login Oficial Real (Firebase Google Auth -> accounts.google.com)
  const handleGoogleLogin = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);
    setPopupBlocked(false);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        processGoogleUser({
          id: result.user.uid,
          email: result.user.email || '',
          name: result.user.displayName || result.user.email?.split('@')[0] || 'Usuario Google',
          picture: result.user.photoURL || undefined
        });
      }
    } catch (error: any) {
      console.warn('Google login notice:', error);
      const code = error?.code || '';
      if (code === 'auth/unauthorized-domain') {
        setErrorMessage(
          'Dominio "localhost" no autorizado en Firebase Console. Agrega "localhost" en Firebase Console > Authentication > Settings > Dominios autorizados para habilitar la ventana de Google.'
        );
      } else if (code === 'auth/popup-blocked') {
        setPopupBlocked(true);
        setErrorMessage('El navegador bloqueó la ventana emergente de Google.');
      } else if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
        setErrorMessage('Inicio de sesión cancelado.');
      } else {
        setErrorMessage(error?.message || 'Error al conectar con Google.');
      }
    } finally {
      setTimeout(() => {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }, 500);
    }
  };

  const handleCloseCompleteProfile = () => {
    setIsCompleteProfileOpen(false);
    setPendingGoogleUser(null);
    localStorage.removeItem('vmi_pending_google_user');
    signOut(auth).catch(() => {});
  };

  const handleDemoLogin = () => {
    // 1. Limpiar cualquier sesión o usuario fantasma de Google o Firebase no registrado
    signOut(auth).catch(() => {});
    localStorage.removeItem('vmi_pending_google_user');
    setPendingGoogleUser(null);
    setIsCompleteProfileOpen(false);

    // 2. Enviar explícitamente el usuario correspondiente al rol demo
    if (role === 'shop') {
      onLogin('shop', {
        id: 'demo-shop-01',
        email: 'tienda.donlupe@ibarra.com.mx',
        displayName: 'Abarrotes Don Lupe',
        photoURL: null
      });
    } else if (role === 'driver') {
      onLogin('driver', {
        id: 'd0000000-0000-0000-0000-000000000402',
        email: 'chofer402@ibarra.com.mx',
        displayName: 'Carlos Mendoza (Chofer #402)',
        photoURL: null
      });
    } else {
      onLogin('cedis', {
        id: 'c0000000-0000-0000-0000-000000000001',
        email: 'cedis.altamira@ibarra.com.mx',
        displayName: 'Ing. Roberto Garza (CEDIS Altamira)',
        photoURL: null
      });
    }
  };

  const getRoleClass = () => {
    if (role === 'cedis') return 'role-cedis';
    if (role === 'driver') return 'role-driver';
    return 'role-shop';
  };

  return (
    <div className={cn(
      "relative flex flex-col min-h-screen max-w-md mx-auto bg-bg-main border-x border-border-subtle overflow-hidden transition-colors duration-500",
      getRoleClass()
    )}>
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none" 
        style={{ backgroundImage: `linear-gradient(var(--color-role-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-role-primary) 1px, transparent 1px)`, backgroundSize: '40px 40px' }}
      ></div>

      <header className="relative flex flex-col items-center pt-8 pb-3 px-6 text-center">
        {/* Corporate status badge */}
        <div className="flex items-center gap-2 mb-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            <ShieldCheck size={11} />
            <span>Red Comercial en Línea</span>
          </div>
        </div>

        <motion.div 
          key={role}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="w-14 h-14 bg-surface-card border border-[var(--color-role-primary)]/30 rounded-2xl flex items-center justify-center mb-2 text-[var(--color-role-primary)] soft-shadow"
        >
          {role === 'shop' && <Store className="w-7 h-7" />}
          {role === 'driver' && <Truck className="w-7 h-7" />}
          {role === 'cedis' && <Building2 className="w-7 h-7" />}
        </motion.div>
        
        <h1 className="text-text-main tracking-tight text-lg font-bold uppercase mb-0.5">
          ALMACENES IBARRA
        </h1>
        <span className="text-[11px] font-bold text-[var(--color-role-primary)] uppercase tracking-wider mb-2">
          CEDIS Altamira • Portal de Operaciones
        </span>

        <div className="w-10 h-1 bg-[var(--color-role-primary)] rounded-full mb-2" />
        <p className="text-text-muted text-xs max-w-[300px]">
          {role === 'shop' && 'Tienda: Pedidos anticipados y control de inventario.'}
          {role === 'driver' && 'Repartidor: Hoja de ruta y entregas del día.'}
          {role === 'cedis' && 'CEDIS: Indicadores operativos, despacho y logística.'}
        </p>
      </header>

      <main className="relative flex-1 px-5 pb-6">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-surface-card/85 backdrop-blur-md p-5 rounded-2xl border border-border-subtle soft-shadow"
        >
          {/* Role selector */}
          <div className="flex gap-1 p-1 bg-bg-main rounded-xl border border-border-subtle mb-4">
            <button 
              onClick={() => { 
                setRole('shop'); 
                setErrorMessage(null); 
                setEmail('tienda.donlupe@ibarra.com.mx');
                setPassword('ibarra2026');
              }}
              type="button"
              className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${role === 'shop' ? 'bg-[var(--color-role-primary)] text-[var(--color-text-light)] soft-shadow' : 'text-text-muted hover:text-text-main'}`}
            >
              <Store size={13} /> Tienda
            </button>
            <button 
              onClick={() => { 
                setRole('driver'); 
                setErrorMessage(null); 
                setIsRegisterMode(false);
                setEmail('chofer402@ibarra.com.mx');
                setPassword('ibarra2026');
              }}
              type="button"
              className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${role === 'driver' ? 'bg-[var(--color-role-primary)] text-[var(--color-text-light)] soft-shadow' : 'text-text-muted hover:text-text-main'}`}
            >
              <Truck size={13} /> Chofer
            </button>
            <button 
              onClick={() => { 
                setRole('cedis'); 
                setErrorMessage(null); 
                setIsRegisterMode(false);
                setEmail('cedis.altamira@ibarra.com.mx');
                setPassword('ibarra2026');
              }}
              type="button"
              className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${role === 'cedis' ? 'bg-[var(--color-role-primary)] text-[var(--color-text-light)] soft-shadow' : 'text-text-muted hover:text-text-main'}`}
            >
              <Building2 size={13} /> CEDIS
            </button>
          </div>

          {/* Mode switch: Acceso Directo vs Correo y Contraseña */}
          <div className="flex border-b border-border-subtle pb-3 mb-4 gap-4 text-xs font-bold">
            <button
              onClick={() => { setAuthMode('demo'); setErrorMessage(null); }}
              className={cn(
                "pb-1 border-b-2 transition-all cursor-pointer",
                authMode === 'demo'
                  ? "border-[var(--color-role-primary)] text-[var(--color-role-primary)]"
                  : "border-transparent text-text-muted hover:text-text-main"
              )}
            >
              Acceso Directo
            </button>
            <button
              onClick={() => { setAuthMode('supabase'); setErrorMessage(null); }}
              className={cn(
                "pb-1 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer",
                authMode === 'supabase'
                  ? "border-[var(--color-role-primary)] text-[var(--color-role-primary)]"
                  : "border-transparent text-text-muted hover:text-text-main"
              )}
            >
              <span>Correo y Contraseña</span>
            </button>
          </div>

          {authMode === 'demo' ? (
            <div className="flex flex-col gap-3">
              {/* Tarjeta de Personal Preestablecido para Chofer y CEDIS */}
              {role !== 'shop' ? (
                <div className="p-3 bg-bg-main rounded-xl border border-border-subtle text-left space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[var(--color-role-primary)] uppercase flex items-center gap-1">
                      <ShieldCheck size={12} /> Personal Institucional Registrado
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      Nómina Activa
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 pt-0.5">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-role-primary)]/10 text-[var(--color-role-primary)] flex items-center justify-center font-bold shrink-0">
                      {role === 'driver' ? <Truck size={16} /> : <Building2 size={16} />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-main">
                        {role === 'driver' ? 'Carlos Mendoza • Chofer #402' : 'Ing. Roberto Garza • CEDIS Altamira'}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        {role === 'driver' ? 'Unidad Ford Cargo 2024 (TM-402-IB)' : 'Jefatura de Operaciones Logísticas'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-bg-main rounded-xl border border-border-subtle text-left text-[11px] text-text-muted flex items-center justify-between">
                  <span>Sucursal Afiliada: <strong>Abarrotes Don Lupe</strong></span>
                  <span className="text-[9px] font-mono font-bold text-[var(--color-role-primary)]">Tampico Centro</span>
                </div>
              )}

              <button
                onClick={handleDemoLogin}
                type="button"
                className="w-full bg-[var(--color-role-primary)] hover:brightness-110 active:scale-[0.99] text-[var(--color-text-light)] font-bold py-3.5 rounded-xl transition-all soft-shadow flex items-center justify-center gap-2 uppercase tracking-wider text-xs cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Entrar como {role === 'shop' ? 'Tienda Don Lupe' : role === 'driver' ? 'Chofer #402 (Carlos Mendoza)' : 'CEDIS Altamira (Ing. Garza)'}</span>
              </button>

              <button 
                onClick={handleGoogleLogin}
                disabled={isSubmitting}
                type="button"
                className="w-full bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-850 active:scale-[0.99] text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-slate-700 font-semibold py-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2.5 text-xs cursor-pointer"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-[var(--color-role-primary)]" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                )}
                <span>Continuar con Google</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSupabaseSubmit} className="flex flex-col gap-3">
              {/* Información de Personal Oficial Preestablecido si es Chofer o CEDIS */}
              {role !== 'shop' && (
                <div className="p-3 bg-bg-main rounded-xl border border-border-subtle text-left space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[var(--color-role-primary)] uppercase flex items-center gap-1">
                      <ShieldCheck size={12} /> Cuenta Oficial Almacenes Ibarra
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      Pre-registrado
                    </span>
                  </div>
                  <p className="text-xs font-bold text-text-main">
                    {role === 'driver' ? 'Carlos Mendoza • Chofer #402' : 'Ing. Roberto Garza • CEDIS Altamira'}
                  </p>
                  <p className="text-[10px] text-text-muted">
                    {role === 'driver' ? 'Unidad Ford Cargo (TM-402-IB) • Ruta DVRP' : 'Despacho y Reabastecimiento VMI'}
                  </p>
                  <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-border-subtle/60">
                    <span className="font-mono text-text-muted font-bold">
                      {role === 'driver' ? 'chofer402@ibarra.com.mx' : 'cedis.altamira@ibarra.com.mx'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(role === 'driver' ? 'chofer402@ibarra.com.mx' : 'cedis.altamira@ibarra.com.mx');
                        setPassword('ibarra2026');
                      }}
                      className="text-[var(--color-role-primary)] font-bold hover:underline cursor-pointer"
                    >
                      Restaurar credencial
                    </button>
                  </div>
                </div>
              )}

              {/* MODO REGISTRO: Formulario de seguridad y datos de tienda */}
              {isRegisterMode ? (
                <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
                  {/* Folio de Seguridad CEDIS Ibarra */}
                  <div className="p-3 rounded-xl bg-bg-main border border-border-subtle">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-text-main uppercase flex items-center gap-1.5">
                        <FileBadge size={13} className="text-[var(--color-role-primary)]" />
                        <span>Folio CEDIS Ibarra *</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setInvitationCode('IBARRA-VMI-2026');
                          setCodeVerified(true);
                          setCodeFeedback('Folio corporativo validado.');
                        }}
                        className="text-[9px] text-[var(--color-role-primary)] underline font-bold cursor-pointer"
                      >
                        Autocompletar Folio
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={invitationCode}
                        onChange={(e) => {
                          setInvitationCode(e.target.value.toUpperCase());
                          setCodeVerified(null);
                        }}
                        placeholder="Ej. IBARRA-VMI-2026"
                        className="flex-1 px-3 py-2 text-xs font-mono rounded-lg bg-surface-card border border-border-subtle uppercase text-text-main focus:outline-none focus:border-[var(--color-role-primary)]"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyCode}
                        disabled={isVerifyingCode}
                        className="px-3 py-2 text-[10px] font-bold rounded-lg bg-surface-hover border border-border-subtle hover:bg-[var(--color-role-primary)]/10 text-text-main cursor-pointer"
                      >
                        {isVerifyingCode ? <RefreshCw size={12} className="animate-spin" /> : 'Validar'}
                      </button>
                    </div>
                    {codeFeedback && (
                      <p className={cn("text-[10px] mt-1.5 flex items-center gap-1", codeVerified ? "text-emerald-600 font-semibold" : "text-danger")}>
                        {codeVerified ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                        <span>{codeFeedback}</span>
                      </p>
                    )}
                  </div>

                  {/* Nombre Comercial y RFC */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">Nombre de Tienda *</label>
                      <div className="relative">
                        <Store className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-text-muted" />
                        <input
                          type="text"
                          value={shopName}
                          onChange={(e) => setShopName(e.target.value)}
                          placeholder="Abarrotes Don Lupe"
                          className="w-full pl-8 pr-2 py-2 text-xs rounded-xl bg-bg-main border border-border-subtle text-text-main focus:outline-none focus:border-[var(--color-role-primary)]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">RFC (Opcional)</label>
                      <input
                        type="text"
                        value={rfc}
                        onChange={(e) => setRfc(e.target.value.toUpperCase())}
                        placeholder="XAXX010101000"
                        className="w-full px-2.5 py-2 text-xs rounded-xl bg-bg-main border border-border-subtle uppercase text-text-main focus:outline-none focus:border-[var(--color-role-primary)]"
                      />
                    </div>
                  </div>

                  {/* Encargado y Teléfono / WhatsApp */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">Encargado *</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Don Guadalupe Reyes"
                        className="w-full px-2.5 py-2 text-xs rounded-xl bg-bg-main border border-border-subtle text-text-main focus:outline-none focus:border-[var(--color-role-primary)]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">WhatsApp / Tel *</label>
                      <div className="relative">
                        <Phone className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-text-muted" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="(833) 123-4567"
                          className="w-full pl-8 pr-2 py-2 text-xs rounded-xl bg-bg-main border border-border-subtle text-text-main focus:outline-none focus:border-[var(--color-role-primary)]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dirección de entrega */}
                  <div>
                    <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">Dirección de entrega *</label>
                    <div className="relative">
                      <MapPin className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-text-muted" />
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Calle Juárez #201, Col. Centro, Tampico"
                        className="w-full pl-8 pr-2 py-2 text-xs rounded-xl bg-bg-main border border-border-subtle text-text-main focus:outline-none focus:border-[var(--color-role-primary)]"
                      />
                    </div>
                  </div>

                  {/* Referencia de reparto para chofer */}
                  <div>
                    <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">Referencia para Chofer</label>
                    <div className="relative">
                      <Compass className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-text-muted" />
                      <input
                        type="text"
                        value={deliveryReference}
                        onChange={(e) => setDeliveryReference(e.target.value)}
                        placeholder="Frente a la primaria, portón verde"
                        className="w-full pl-8 pr-2 py-2 text-xs rounded-xl bg-bg-main border border-border-subtle text-text-main focus:outline-none focus:border-[var(--color-role-primary)]"
                      />
                    </div>
                  </div>

                  {/* Correo y Contraseña */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">Correo de Acceso *</label>
                      <div className="relative">
                        <Mail className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-text-muted" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="tienda@ibarra.com.mx"
                          className="w-full pl-8 pr-2 py-2 text-xs rounded-xl bg-bg-main border border-border-subtle text-text-main focus:outline-none focus:border-[var(--color-role-primary)]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">Contraseña *</label>
                      <div className="relative">
                        <KeyRound className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-text-muted" />
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-8 pr-2 py-2 text-xs rounded-xl bg-bg-main border border-border-subtle text-text-main focus:outline-none focus:border-[var(--color-role-primary)]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* MODO LOGIN SIMPLE */
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-text-muted uppercase mb-1 block">Correo electrónico</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 w-4 h-4 text-text-muted" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="usuario@ibarra.com.mx"
                        className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-bg-main border border-border-subtle text-text-main focus:outline-none focus:border-[var(--color-role-primary)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-text-muted uppercase mb-1 block">Contraseña</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-text-muted" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-bg-main border border-border-subtle text-text-main focus:outline-none focus:border-[var(--color-role-primary)]"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || (isRegisterMode && role !== 'shop')}
                className="w-full mt-2 bg-[var(--color-role-primary)] hover:brightness-110 active:scale-[0.99] text-[var(--color-text-light)] font-bold py-3.5 rounded-xl transition-all soft-shadow flex items-center justify-center gap-2 uppercase tracking-wider text-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : isRegisterMode ? (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Registrar Tienda con Folio</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Iniciar Sesión</span>
                  </>
                )}
              </button>

              {role === 'shop' ? (
                <div className="flex justify-between items-center text-[11px] mt-1 pt-1 border-t border-border-subtle/50">
                  <button
                    type="button"
                    onClick={() => { setIsRegisterMode(!isRegisterMode); setErrorMessage(null); }}
                    className="text-[var(--color-role-primary)] hover:underline font-semibold cursor-pointer"
                  >
                    {isRegisterMode ? '← Volver a Iniciar Sesión' : '¿Nueva tienda? Regístrate con folio CEDIS'}
                  </button>
                </div>
              ) : (
                <div className="text-center text-[10px] text-text-muted mt-1 pt-1 border-t border-border-subtle/50">
                  Operador interno asignado por Almacenes Ibarra. Datos ya establecidos.
                </div>
              )}
            </form>
          )}

          {/* Feedback Alerts */}
          <AnimatePresence>
            {popupBlocked && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs"
              >
                Ventana bloqueada. Por favor abre la app en pestaña completa.
              </motion.div>
            )}

            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="mt-3 p-2.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs text-center font-medium"
              >
                {errorMessage}
              </motion.div>
            )}

            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs text-center font-medium flex items-center justify-center gap-1.5"
              >
                <ShieldCheck size={14} />
                <span>{successMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <InstallAppBanner variant="compact" />

          <p className="text-center text-text-muted text-[10px] mt-3 font-mono">
            ALMACENES IBARRA • CEDIS ALTAMIRA
          </p>
        </motion.div>
      </main>

      <footer className="relative mt-auto py-4 px-6 bg-surface-card/50 backdrop-blur-md border-t border-border-subtle">
        <p className="text-center text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] font-mono">
          ALMACENES IBARRA S.A. DE C.V.
        </p>
      </footer>

      <GoogleSignInModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        currentRole={role}
        onSuccess={(detectedRole, userObj) => {
          if (detectedRole !== 'shop') {
            onLogin(detectedRole, userObj);
          } else {
            processGoogleUser({
              id: userObj.id,
              email: userObj.email,
              name: userObj.displayName,
              picture: userObj.photoURL
            });
          }
        }}
      />

      <CompleteProfileModal
        isOpen={isCompleteProfileOpen}
        googleUser={pendingGoogleUser}
        onSaveProfile={handleProfileSaved}
        onClose={handleCloseCompleteProfile}
      />
    </div>
  );
}
