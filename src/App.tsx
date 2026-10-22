import { useState, useEffect } from 'react';
import { Home, ShoppingBag, Package, FileText, User as UserIcon, Truck, LogOut } from 'lucide-react';
import { cn } from './lib/utils';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import InventoryScreen from './screens/InventoryScreen';
import CatalogScreen from './screens/CatalogScreen';
import OrderScreen from './screens/OrderScreen';
import RouteScreen from './screens/RouteScreen';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';

type Screen = 'login' | 'dashboard' | 'catalog' | 'inventory' | 'orders' | 'profile' | 'route';
type UserRole = 'shop' | 'driver' | null;

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [role, setRole] = useState<UserRole>(null);
  const [user, setUser] = useState<FirebaseUser | null>(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      const savedRole = localStorage.getItem('vmi_user_role') as UserRole;
      if (currentUser && savedRole && currentScreen === 'login') {
        setRole(savedRole);
        setCurrentScreen(savedRole === 'driver' ? 'route' : 'dashboard');
      }
    });
    return () => unsubscribe();
  }, [currentScreen]);

  const shopNavItems = [
    { id: 'dashboard', icon: Home, label: 'Inicio' },
    { id: 'catalog', icon: ShoppingBag, label: 'Pedido' },
    { id: 'inventory', icon: Package, label: 'Almacén' },
    { id: 'orders', icon: FileText, label: 'Historial' },
    { id: 'profile', icon: UserIcon, label: 'Perfil' },
  ] as const;

  const driverNavItems = [
    { id: 'route', icon: Truck, label: 'Ruta' },
    { id: 'orders', icon: FileText, label: 'Entregas' },
    { id: 'profile', icon: UserIcon, label: 'Perfil' },
  ] as const;

  const activeNavItems = role === 'driver' ? driverNavItems : shopNavItems;

  const handleLogin = (selectedRole: 'driver' | 'shop') => {
    localStorage.setItem('vmi_user_role', selectedRole);
    setRole(selectedRole);
    setCurrentScreen(selectedRole === 'driver' ? 'route' : 'dashboard');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Sign out notice:", e);
    }
    localStorage.removeItem('vmi_user_role');
    setRole(null);
    setCurrentScreen('login');
  };

  if (currentScreen === 'login') {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className={cn(
      "relative flex flex-col h-screen max-w-md mx-auto bg-bg-main border-x border-border-subtle overflow-hidden transition-colors duration-500",
      role === 'shop' ? "role-shop" : "role-driver"
    )}>
      <div className="flex-1 overflow-y-auto w-full no-scrollbar pb-24">
        {currentScreen === 'dashboard' && <DashboardScreen onNavigate={setCurrentScreen as any} />}
        {currentScreen === 'catalog' && <CatalogScreen />}
        {currentScreen === 'inventory' && <InventoryScreen />}
        {currentScreen === 'orders' && <OrderScreen />}
        {currentScreen === 'route' && <RouteScreen />}
        {currentScreen === 'profile' && (
          <div className="p-6 flex flex-col items-center justify-center h-full">
            <div className="w-24 h-24 rounded-full bg-surface-card border border-[var(--color-role-primary)]/10 flex items-center justify-center mb-4 soft-shadow overflow-hidden">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={48} className="text-[var(--color-role-primary)]" />
              )}
            </div>
            <h2 className="text-xl font-bold mb-1 text-text-main">
              {user?.displayName || (role === 'driver' ? 'Chofer #402' : 'Abarrotes Lupita')}
            </h2>
            <p className="text-text-muted text-sm mb-2 font-mono">
              {user?.email || (role === 'driver' ? 'EMP-D-402' : 'SHP-MTR-832')}
            </p>
            <span className="text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider bg-[var(--color-role-primary)]/10 text-[var(--color-role-primary)] mb-8 border border-[var(--color-role-primary)]/20">
              {role === 'driver' ? 'Rol: Conductor Logístico' : 'Rol: Tienda de Abarrotes'}
            </span>
            <button 
              onClick={handleLogout}
              className="bg-surface-card border border-border-subtle text-danger px-8 py-3 rounded-xl font-bold hover:bg-danger/10 transition-colors soft-shadow flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        )}
      </div>

      <nav className="absolute bottom-0 w-full z-40 bg-surface-card/80 backdrop-blur-xl border-t border-border-subtle pt-3 pb-8 px-6">
        <div className="flex justify-around items-center relative">
          {activeNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentScreen(item.id as Screen)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-14 transition-colors",
                currentScreen === item.id ? "text-[var(--color-role-primary)]" : "text-text-muted hover:text-text-main"
              )}
            >
              {item.id === 'inventory' || item.id === 'route' ? (
                 <div className="relative -top-5">
                    <div className="h-14 w-14 rounded-xl bg-[var(--color-role-primary)] flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all outline outline-4 outline-bg-main text-[var(--color-text-light)]">
                       <item.icon className="h-7 w-7" />
                    </div>
                 </div>
              ) : (
                <item.icon className={cn("h-6 w-6", currentScreen === item.id && "drop-shadow-sm")} />
              )}
              {item.id !== 'inventory' && item.id !== 'route' && (
                <span className="text-[9px] font-bold uppercase tracking-wider mt-1">{item.label}</span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

