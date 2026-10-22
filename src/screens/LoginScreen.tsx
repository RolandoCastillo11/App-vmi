import { useState, useRef } from 'react';
import { Package, LogIn, Truck, Store, AlertTriangle, ExternalLink, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

export default function LoginScreen({ onLogin }: { onLogin: (role: 'driver' | 'shop') => void }) {
  const [role, setRole] = useState<'driver' | 'shop'>('shop');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const isSigningInRef = useRef(false);

  const handleGoogleLogin = async () => {
    // Prevent concurrent / duplicate requests that trigger cancelled-popup-request or internal assertion failures
    if (isSigningInRef.current) {
      return;
    }

    isSigningInRef.current = true;
    setIsSigningIn(true);
    setErrorMessage(null);
    setPopupBlocked(false);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        onLogin(role);
      }
    } catch (error: any) {
      console.warn('Google login notice:', error);
      const code = error?.code || '';
      
      if (code === 'auth/popup-blocked') {
        setPopupBlocked(true);
        setErrorMessage('El navegador bloqueó la ventana emergente de Google.');
      } else if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
        setErrorMessage('Inicio de sesión cancelado.');
      } else {
        setErrorMessage(error?.message || 'Error al conectar con Google.');
      }
    } finally {
      // Small cooldown before allowing another click
      setTimeout(() => {
        isSigningInRef.current = false;
        setIsSigningIn(false);
      }, 600);
    }
  };

  const handleDemoLogin = () => {
    onLogin(role);
  };

  return (
    <div className={cn(
      "relative flex flex-col min-h-screen max-w-md mx-auto bg-bg-main border-x border-border-subtle overflow-hidden transition-colors duration-500",
      role === 'shop' ? "role-shop" : "role-driver"
    )}>
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none" 
        style={{ backgroundImage: `linear-gradient(var(--color-role-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-role-primary) 1px, transparent 1px)`, backgroundSize: '40px 40px' }}
      ></div>

      <header className="relative flex flex-col items-center pt-16 pb-6 px-6 text-center">
        <motion.div 
          key={role}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="w-16 h-16 bg-surface-card border border-[var(--color-role-primary)]/30 rounded-2xl flex items-center justify-center mb-4 text-[var(--color-role-primary)] soft-shadow"
        >
          {role === 'shop' ? <Package className="w-8 h-8" /> : <Truck className="w-8 h-8" />}
        </motion.div>
        <motion.h1 
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-text-main tracking-tight text-2xl font-bold uppercase mb-1"
        >
          VMI RETAIL MÉXICO
        </motion.h1>
        <motion.div 
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="w-10 h-1 bg-[var(--color-role-primary)] rounded-full mb-3"
        />
        <motion.p 
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-text-muted text-xs max-w-[280px]"
        >
          {role === 'shop' ? 'Gestiona tu inventario con seguridad y reposición predictiva.' : 'Visualiza y optimiza tus rutas de entrega inteligentes.'}
        </motion.p>
      </header>

      <main className="relative flex-1 px-6 pb-6">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-surface-card/70 backdrop-blur-md p-6 rounded-[2rem] border border-border-subtle soft-shadow"
        >
          <div className="flex gap-2 p-1 bg-bg-main rounded-xl border border-border-subtle mb-5">
            <button 
              onClick={() => { setRole('shop'); setErrorMessage(null); }}
              type="button"
              className={`flex-1 py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all ${role === 'shop' ? 'bg-[var(--color-role-primary)] text-[var(--color-text-light)] soft-shadow' : 'text-text-muted hover:text-text-main'}`}
            >
              <Store size={15} /> Tienda
            </button>
            <button 
              onClick={() => { setRole('driver'); setErrorMessage(null); }}
              type="button"
              className={`flex-1 py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all ${role === 'driver' ? 'bg-[var(--color-role-primary)] text-[var(--color-text-light)] soft-shadow' : 'text-text-muted hover:text-text-main'}`}
            >
              <Truck size={15} /> Chofer
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={handleGoogleLogin}
              disabled={isSigningIn}
              type="button"
              className="w-full bg-[var(--color-role-primary)] hover:brightness-110 active:scale-[0.99] text-[var(--color-text-light)] font-bold py-3.5 rounded-xl transition-all soft-shadow flex items-center justify-center gap-2 group uppercase tracking-wider text-xs disabled:opacity-60 cursor-pointer"
            >
              {isSigningIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Conectando con Google...</span>
                </>
              ) : (
                <>
                  <span>Ingresar con Google</span>
                  <LogIn className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>

            {/* Quick Demo Access Button */}
            <button
              onClick={handleDemoLogin}
              type="button"
              className="w-full bg-bg-main hover:bg-surface-hover active:scale-[0.99] text-text-main border border-border-subtle font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs"
            >
              <Sparkles className="w-4 h-4 text-[var(--color-role-primary)]" />
              <span>Explorar en Modo Demo ({role === 'shop' ? 'Tienda' : 'Chofer'})</span>
            </button>
          </div>

          {/* Feedback & Popup-blocked assistance */}
          <AnimatePresence>
            {popupBlocked && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex flex-col gap-2"
              >
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Ventana emergente bloqueada</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  El navegador bloqueó la ventana de Google por seguridad del marco. Puedes abrir la app en una pestaña completa para iniciar sesión con Google sin restricciones:
                </p>
                <div className="flex gap-2 mt-1">
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] uppercase tracking-wider transition-colors"
                  >
                    <span>Abrir en pestaña nueva</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    onClick={handleGoogleLogin}
                    type="button"
                    className="px-3 py-1.5 rounded-lg border border-amber-500/40 hover:bg-amber-500/20 text-[10px] font-bold uppercase tracking-wider transition-colors"
                  >
                    Reintentar
                  </button>
                </div>
              </motion.div>
            )}

            {!popupBlocked && errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="mt-3 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs text-center font-medium"
              >
                {errorMessage}
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-center text-text-muted text-[11px] mt-6">
            Ambiente seguro con Firebase &amp; Gemini
          </p>
        </motion.div>
      </main>

      <footer className="relative mt-auto py-8 px-6 bg-surface-card/50 backdrop-blur-md border-t border-border-subtle">
        <p className="text-center text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-6 font-mono">
          VMI LOGISTICS RETAIL MX
        </p>
      </footer>
    </div>
  );
}
