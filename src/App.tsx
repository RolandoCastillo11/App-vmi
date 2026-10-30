import { useState, useEffect, useMemo } from 'react';
import { Home, ShoppingBag, Package, FileText, User as UserIcon, Truck, LogOut, Building2, MessageCircle, Store, MapPin, Phone, ShieldCheck, ArrowLeft, Bell } from 'lucide-react';
import { cn } from './lib/utils';
import { sendLocalPushNotification } from './lib/pushNotifications';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import InventoryScreen from './screens/InventoryScreen';
import CatalogScreen from './screens/CatalogScreen';
import OrderScreen from './screens/OrderScreen';
import RouteScreen from './screens/RouteScreen';
import ShopDeliveryTrackingScreen from './screens/ShopDeliveryTrackingScreen';
import CedisScreen from './screens/CedisScreen';
import WhatsAppBotModal from './components/WhatsAppBotModal';
import ChangeTemporaryPasswordModal from './components/ChangeTemporaryPasswordModal';
import InstallAppBanner from './components/InstallAppBanner';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { onSupabaseAuthStateChange, signOutSupabase, getUserProfile, UserProfile } from './lib/supabaseAuth';

type Screen = 'login' | 'dashboard' | 'catalog' | 'inventory' | 'orders' | 'profile' | 'route' | 'cedis';
type UserRole = 'shop' | 'driver' | 'cedis' | null;

interface AppUser {
  id?: string | null;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [role, setRole] = useState<UserRole>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);

  useEffect(() => {
    // 0. Restaurar sesión guardada de usuario personalizado si existe
    const savedCustomUser = localStorage.getItem('vmi_custom_user');
    if (savedCustomUser) {
      try {
        const parsed = JSON.parse(savedCustomUser);
        if (parsed?.email) setUser(parsed);
      } catch {}
    }

    // 1. Firebase Auth listener
    const unsubscribeFirebase = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        const cleanEmail = currentUser.email?.toLowerCase() || '';
        const savedProfileStr = cleanEmail ? localStorage.getItem('vmi_profile_' + cleanEmail) : null;
        const savedRole = localStorage.getItem('vmi_user_role') as UserRole;

        // Solo restaurar la sesión automáticamente si ya completó su registro de perfil y tiene rol guardado
        if (savedProfileStr && savedRole) {
          try {
            const savedProfile = JSON.parse(savedProfileStr);
            setUser({
              id: currentUser.uid,
              email: currentUser.email,
              displayName: savedProfile.shopName || currentUser.displayName,
              photoURL: currentUser.photoURL,
            });
            setRole(savedRole);
            if (savedRole === 'cedis') setCurrentScreen('cedis');
            else if (savedRole === 'driver') setCurrentScreen('route');
            else setCurrentScreen('dashboard');
          } catch {}
        } else {
          // Si el usuario recargó la página y NUNCA completó su perfil de tienda:
          // Cerrar la sesión de Firebase para evitar usuarios fantasmas que contaminen la cuenta demo
          signOut(auth).catch(() => {});
          const savedCustom = localStorage.getItem('vmi_custom_user');
          if (!savedCustom) {
            setUser(null);
          }
        }
      }
    });

    // 2. Supabase Auth listener
    const { data: { subscription: supabaseSub } } = onSupabaseAuthStateChange(async (sbUser) => {
      if (sbUser) {
        setUser({
          id: sbUser.id,
          email: sbUser.email,
          displayName: sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0],
          photoURL: sbUser.user_metadata?.avatar_url || null,
        });

        // Fetch user profile or metadata for role
        const profile = await getUserProfile(sbUser.id);
        setCurrentProfile(profile);
        if (profile?.must_change_password) {
          setMustChangePassword(true);
        }

        const assignedRole = (profile?.role || sbUser.user_metadata?.role || localStorage.getItem('vmi_user_role') || 'shop') as UserRole;
        
        if (assignedRole) {
          localStorage.setItem('vmi_user_role', assignedRole);
          setRole(assignedRole);
          if (assignedRole === 'cedis') setCurrentScreen('cedis');
          else if (assignedRole === 'driver') setCurrentScreen('route');
          else setCurrentScreen('dashboard');
        }
      }
    });

    return () => {
      unsubscribeFirebase();
      supabaseSub.unsubscribe();
    };
  }, [currentScreen]);

  const shopNavItems = [
    { id: 'dashboard', icon: Home, label: 'Inicio' },
    { id: 'catalog', icon: ShoppingBag, label: 'Pedido' },
    { id: 'route', icon: Truck, label: 'Entrega' },
    { id: 'inventory', icon: Package, label: 'Almacén' },
    { id: 'orders', icon: FileText, label: 'Historial' },
    { id: 'profile', icon: UserIcon, label: 'Perfil' },
  ] as const;

  const driverNavItems = [
    { id: 'route', icon: Truck, label: 'Ruta' },
    { id: 'orders', icon: FileText, label: 'Entregas' },
    { id: 'profile', icon: UserIcon, label: 'Perfil' },
  ] as const;

  const cedisNavItems = [
    { id: 'cedis', icon: Building2, label: 'CEDIS' },
    { id: 'route', icon: Truck, label: 'Ruta' },
    { id: 'orders', icon: FileText, label: 'Despacho' },
    { id: 'profile', icon: UserIcon, label: 'Perfil' },
  ] as const;

  const activeNavItems = role === 'cedis' ? cedisNavItems : role === 'driver' ? driverNavItems : shopNavItems;

  const handleLogin = (selectedRole: 'driver' | 'shop' | 'cedis', customUser?: AppUser) => {
    localStorage.setItem('vmi_user_role', selectedRole);
    setRole(selectedRole);

    const resolvedUser: AppUser = customUser || (
      selectedRole === 'cedis' ? {
        id: 'c0000000-0000-0000-0000-000000000001',
        email: 'cedis.altamira@ibarra.com.mx',
        displayName: 'Ing. Roberto Garza (CEDIS Altamira)',
        photoURL: null
      } : selectedRole === 'driver' ? {
        id: 'd0000000-0000-0000-0000-000000000402',
        email: 'chofer402@ibarra.com.mx',
        displayName: 'Carlos Mendoza (Chofer #402)',
        photoURL: null
      } : {
        id: 'demo-shop-01',
        email: 'tienda.donlupe@ibarra.com.mx',
        displayName: 'Abarrotes Don Lupe',
        photoURL: null
      }
    );

    setUser(resolvedUser);
    localStorage.setItem('vmi_custom_user', JSON.stringify(resolvedUser));

    if (selectedRole === 'cedis') setCurrentScreen('cedis');
    else if (selectedRole === 'driver') setCurrentScreen('route');
    else setCurrentScreen('dashboard');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Sign out notice (Firebase):", e);
    }
    try {
      await signOutSupabase();
    } catch (e) {
      console.warn("Sign out notice (Supabase):", e);
    }
    localStorage.removeItem('vmi_user_role');
    localStorage.removeItem('vmi_custom_user');
    localStorage.removeItem('vmi_pending_google_user');
    setRole(null);
    setUser(null);
    setCurrentProfile(null);
    setMustChangePassword(false);
    setCurrentScreen('login');
  };

  if (currentScreen === 'login') {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const getContainerClass = () => {
    if (role === 'cedis') return "max-w-xl role-cedis";
    if (role === 'driver') return "max-w-md role-driver";
    return "max-w-md role-shop";
  };

  return (
    <div className={cn(
      "relative flex flex-col h-screen mx-auto bg-bg-main border-x border-border-subtle overflow-hidden transition-colors duration-500",
      getContainerClass()
    )}>
      <div className="flex-1 overflow-y-auto w-full no-scrollbar pb-24">
        {currentScreen === 'dashboard' && (
          <DashboardScreen 
            onNavigate={setCurrentScreen as any} 
            shopName={user?.displayName || currentProfile?.shop_name || 'Abarrotes Don Lupe'}
          />
        )}
        {currentScreen === 'catalog' && <CatalogScreen />}
        {currentScreen === 'inventory' && <InventoryScreen />}
        {currentScreen === 'orders' && <OrderScreen />}
        {currentScreen === 'route' && (
          role === 'shop' ? (
            <ShopDeliveryTrackingScreen 
              shopName={currentProfile?.shop_name || user?.displayName || 'Abarrotes Don Lupe'}
              shopAddress={currentProfile?.address || 'Zona Centro, Tampico'}
              onNavigateToCatalog={() => setCurrentScreen('catalog')}
            />
          ) : (
            <RouteScreen />
          )
        )}
        {currentScreen === 'cedis' && <CedisScreen onNavigate={setCurrentScreen as any} />}
        {currentScreen === 'profile' && (() => {
          const savedShopProfile = user?.email ? (() => {
            try {
              const raw = localStorage.getItem('vmi_profile_' + user.email.toLowerCase());
              return raw ? JSON.parse(raw) : null;
            } catch { return null; }
          })() : null;

          const shopDisplayName = user?.displayName || currentProfile?.shop_name || savedShopProfile?.shopName || 'Abarrotes Don Lupe';
          const ownerDisplayName = savedShopProfile?.ownerName || currentProfile?.full_name || 'Guadalupe Reyes';
          const addressDisplay = savedShopProfile?.address || currentProfile?.address || 'Zona Centro, Tampico, Tamps.';
          const phoneDisplay = savedShopProfile?.phone || currentProfile?.phone || '833 214 5500';

          return (
            <div className="p-5 flex flex-col min-h-full">
              {/* Header con botón atrás */}
              <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-5">
                <button
                  onClick={() => setCurrentScreen(role === 'cedis' ? 'cedis' : role === 'driver' ? 'route' : 'dashboard')}
                  className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-main transition-colors cursor-pointer"
                >
                  <ArrowLeft size={16} />
                  <span>Volver</span>
                </button>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-role-primary)] font-mono">
                  Mi Perfil VMI
                </span>
                <div className="w-12" />
              </div>

              {/* Tarjeta de Usuario Principal */}
              <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 mb-4 soft-shadow flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-surface-hover border-2 border-[var(--color-role-primary)]/30 flex items-center justify-center mb-3 overflow-hidden shadow-sm">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : role === 'cedis' ? (
                    <Building2 size={36} className="text-[var(--color-role-primary)]" />
                  ) : role === 'driver' ? (
                    <Truck size={36} className="text-[var(--color-role-primary)]" />
                  ) : (
                    <Store size={36} className="text-[var(--color-role-primary)]" />
                  )}
                </div>

                <h2 className="text-lg font-bold text-text-main">
                  {role === 'shop' ? shopDisplayName : role === 'cedis' ? 'CEDIS Altamira - Operaciones' : 'Carlos Mendoza (Chofer #402)'}
                </h2>
                
                <p className="text-xs text-text-muted font-mono mt-0.5">
                  {user?.email || (role === 'cedis' ? 'cedis.altamira@ibarra.com.mx' : role === 'driver' ? 'chofer402@ibarra.com.mx' : 'tienda.donlupe@ibarra.com.mx')}
                </p>

                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-role-primary)]/10 text-[var(--color-role-primary)] border border-[var(--color-role-primary)]/20">
                  <ShieldCheck size={12} />
                  <span>
                    {role === 'cedis' ? 'Gerencia Logística CEDIS' : role === 'driver' ? 'Conductor Logístico Oficial' : 'Tienda Asociada a Red VMI'}
                  </span>
                </div>
              </div>

              {/* Detalles de la Tienda / Operación */}
              {role === 'shop' && (
                <div className="bg-surface-card border border-border-subtle rounded-2xl p-4 mb-4 space-y-3 soft-shadow text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                    Información Operativa de la Tienda
                  </span>
                  
                  <div className="flex items-start gap-2.5">
                    <UserIcon size={14} className="text-[var(--color-role-primary)] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-text-muted text-[10px] block font-medium">Propietario / Encargado:</span>
                      <span className="font-semibold text-text-main">{ownerDisplayName}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Phone size={14} className="text-[var(--color-role-primary)] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-text-muted text-[10px] block font-medium">Teléfono / WhatsApp:</span>
                      <span className="font-semibold text-text-main">{phoneDisplay}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <MapPin size={14} className="text-[var(--color-role-primary)] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-text-muted text-[10px] block font-medium">Dirección de Entrega:</span>
                      <span className="font-semibold text-text-main">{addressDisplay}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-muted">
                    <span>Suministro y Reabastecimiento:</span>
                    <span className="font-semibold text-text-main">CEDIS Altamira (Ruta Diaria)</span>
                  </div>
                </div>
              )}

              {/* Botón de Instalación de App Nativa (PWA) */}
              <InstallAppBanner variant="card" />

              {/* Tarjeta de Notificaciones Push Nativas */}
              <div className="bg-surface-card border border-border-subtle rounded-2xl p-4 mb-4 soft-shadow flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                    <Bell size={20} />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 font-mono block">
                      Alertas en Tiempo Real
                    </span>
                    <p className="text-xs font-bold text-text-main">
                      Notificaciones en el Dispositivo
                    </p>
                    <p className="text-[10px] text-text-muted">
                      Avisos de llegada de camión, stock crítico y entregas.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sendLocalPushNotification({
                      title: 'Notificaciones Activas 🔔',
                      body:
                        role === 'driver'
                          ? 'Ruta Tampico-Madero sincronizada con CEDIS Altamira.'
                          : role === 'cedis'
                            ? 'Monitoreo de flota y liquidaciones en tiempo real activo.'
                            : 'Te avisaremos cuando el Camión #402 esté por llegar a tu tienda.',
                      tag: 'vmi-test-push',
                    });
                  }}
                  className="px-3.5 py-2 rounded-xl bg-bg-main border border-border-subtle hover:border-[var(--color-role-primary)] text-text-main font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer shrink-0"
                >
                  Activar Avisos
                </button>
              </div>

              {/* Botón de Cerrar Sesión Prominente */}
              <div className="mt-auto pt-4 pb-2">
                <button 
                  onClick={handleLogout}
                  className="w-full bg-red-500/10 hover:bg-red-500/20 active:scale-[0.99] border border-red-500/30 text-red-600 dark:text-red-400 py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      <nav className="absolute bottom-0 w-full z-40 bg-surface-card/90 backdrop-blur-xl border-t border-border-subtle pt-2 pb-6 px-2">
        <div className="flex justify-around items-center relative">
          {activeNavItems.map((item) => {
            const isElevated = (role === 'driver' && item.id === 'route') || (role === 'cedis' && item.id === 'cedis');
            return (
              <button
                key={item.id}
                onClick={() => setCurrentScreen(item.id as Screen)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 transition-colors relative",
                  role === 'shop' ? "w-12 py-1" : "w-16 py-1",
                  currentScreen === item.id ? "text-[var(--color-role-primary)] font-semibold" : "text-text-muted hover:text-text-main"
                )}
              >
                {isElevated ? (
                  <div className="relative -top-5">
                    <div className="h-14 w-14 rounded-2xl bg-[var(--color-role-primary)] flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all outline outline-4 outline-bg-main text-[var(--color-text-light)]">
                      <item.icon className="h-7 w-7" />
                    </div>
                  </div>
                ) : (
                  <item.icon className={cn("h-5 w-5", currentScreen === item.id && "scale-110 drop-shadow-sm")} />
                )}
                {!isElevated && (
                  <span className={cn(
                    "text-[9px] uppercase tracking-wider mt-0.5",
                    currentScreen === item.id ? "font-bold text-[var(--color-role-primary)]" : "font-medium"
                  )}>
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
      {/* Botón Flotante de WhatsApp Bot VMI (Solo para rol tienda y fuera de la pantalla de entrega) */}
      {role === 'shop' && currentScreen !== 'route' && (
        <div className="absolute bottom-22 right-4 z-30">
          <button
            type="button"
            onClick={() => setIsWhatsAppOpen(true)}
            className="relative group flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white py-2.5 px-3.5 rounded-full shadow-lg shadow-emerald-500/25 border-2 border-white dark:border-slate-800 transition-all cursor-pointer hover:shadow-xl"
          >
            <div className="relative">
              <MessageCircle size={22} className="fill-white/20" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-white animate-ping" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-white" />
            </div>
            <span className="text-xs font-bold tracking-wide hidden sm:inline-block">Pedir por WhatsApp</span>
          </button>
        </div>
      )}

      <WhatsAppBotModal 
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        onNavigateToOrders={() => setCurrentScreen('orders')}
        shopName={user?.displayName || (role === 'cedis' ? 'CEDIS Altamira' : 'Abarrotes Don Lupe')}
      />

      {mustChangePassword && user?.id && user?.email && (
        <ChangeTemporaryPasswordModal
          userId={user.id}
          userEmail={user.email}
          shopName={currentProfile?.shop_name}
          onSuccess={() => setMustChangePassword(false)}
        />
      )}
    </div>
  );
}

