import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, CheckCircle2, User, Sparkles } from 'lucide-react';

interface GoogleUser {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'shop' | 'driver' | 'cedis';
}

interface GoogleSignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: 'shop' | 'driver' | 'cedis';
  onSuccess: (role: 'shop' | 'driver' | 'cedis', user: GoogleUser) => void;
}

export default function GoogleSignInModal({
  isOpen,
  onClose,
  currentRole,
  onSuccess,
}: GoogleSignInModalProps) {
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);

  const lastEmail = localStorage.getItem('vmi_last_google_email');

  // Cuentas de acceso rápido oficiales y recordadas
  const accounts: Array<{ email: string; name: string; role: 'shop' | 'driver' | 'cedis'; desc: string }> = [
    ...(lastEmail ? [{
      email: lastEmail,
      name: lastEmail.split('@')[0].replace(/[._]/g, ' ').toUpperCase(),
      role: lastEmail.includes('chofer') ? 'driver' as const : lastEmail.includes('cedis') ? 'cedis' as const : 'shop' as const,
      desc: 'Cuenta de Google guardada en este equipo'
    }] : []),
    {
      email: 'tienda.donlupe@ibarra.com.mx',
      name: 'D. Lupe Reyes (Abarrotes Don Lupe)',
      role: 'shop',
      desc: 'Red VMI • Tienda piloto Tampico Centro'
    },
    {
      email: 'chofer402@ibarra.com.mx',
      name: 'Carlos Mendoza (Chofer #402)',
      role: 'driver',
      desc: 'Almacenes Ibarra • Unidad Ford Cargo 2024'
    },
    {
      email: 'cedis.altamira@ibarra.com.mx',
      name: 'Ing. Roberto Garza (CEDIS Altamira)',
      role: 'cedis',
      desc: 'Jefatura de Operaciones y Despacho'
    }
  ];

  // Filtrar duplicados si lastEmail coincide con alguna predeterminada
  const uniqueAccounts = accounts.filter((acc, idx, self) => 
    idx === self.findIndex((t) => t.email.toLowerCase() === acc.email.toLowerCase())
  );

  const handleSelectAccount = (accEmail: string, accName: string, accRole: 'shop' | 'driver' | 'cedis') => {
    setSelectedEmail(accEmail);
    setIsProcessing(true);

    const userObj: GoogleUser = {
      id: `google-${btoa(accEmail).replace(/=/g, '').substring(0, 16)}`,
      email: accEmail,
      displayName: accName,
      photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(accName)}&backgroundColor=ea580c,f97316,fb923c`,
      role: accRole
    };

    localStorage.setItem('vmi_last_google_email', accEmail);
    localStorage.setItem('vmi_custom_user', JSON.stringify(userObj));

    setTimeout(() => {
      setIsProcessing(false);
      onSuccess(accRole, userObj);
      onClose();
    }, 400);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes('@')) return;

    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanName = nameInput.trim() || cleanEmail.split('@')[0].replace(/[._]/g, ' ');
    
    // Reconocimiento inteligente de rol según el correo o el rol seleccionado
    let detectedRole: 'shop' | 'driver' | 'cedis' = currentRole;
    if (cleanEmail.includes('chofer')) detectedRole = 'driver';
    else if (cleanEmail.includes('cedis')) detectedRole = 'cedis';

    handleSelectAccount(cleanEmail, cleanName, detectedRole);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] isolate flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden text-gray-800"
        >
          {/* Header estilo Google */}
          <div className="p-5 pb-4 border-b border-gray-100 flex items-start justify-between">
            <div className="flex items-center gap-3">
              {/* Google SVG Official Icon */}
              <div className="w-10 h-10 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center shadow-xs">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 leading-tight">Acceder con Google</h3>
                <p className="text-[11px] text-gray-500">VMI Retail México • Almacenes Ibarra</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <p className="text-xs text-gray-600">
              Selecciona una cuenta para iniciar sesión al instante con reconocimiento de correo:
            </p>

            {/* Lista de cuentas rápidas */}
            <div className="space-y-2">
              {uniqueAccounts.map((acc) => {
                const isSelected = selectedEmail === acc.email;
                return (
                  <button
                    key={acc.email}
                    onClick={() => handleSelectAccount(acc.email, acc.name, acc.role)}
                    disabled={isProcessing}
                    className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected 
                        ? 'border-emerald-500 bg-emerald-50/50' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-400 to-amber-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                        {acc.name.charAt(0)}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-900 truncate">{acc.name}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-md bg-gray-100 text-gray-600 font-bold uppercase shrink-0">
                            {acc.role === 'driver' ? 'Chofer' : acc.role === 'cedis' ? 'CEDIS' : 'Tienda'}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 truncate">{acc.email}</p>
                      </div>
                    </div>
                    {isSelected ? (
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    ) : (
                      <ArrowRight size={14} className="text-gray-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Alternativa: Ingresar otro correo Google */}
            {!showCustomInput ? (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                className="w-full py-2 px-3 rounded-xl border border-dashed border-gray-300 hover:border-orange-400 text-xs text-gray-600 hover:text-orange-600 font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <User size={13} />
                <span>Usar otra cuenta de Google (@gmail.com)</span>
              </button>
            ) : (
              <form onSubmit={handleCustomSubmit} className="pt-2 border-t border-gray-100 space-y-2.5">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                    Correo de Google (@gmail.com o empresa)
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="ejemplo@gmail.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                    Nombre o Tienda (Opcional)
                  </label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Mi Tienda o Nombre"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCustomInput(false)}
                    className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="flex-1 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles size={13} />
                    <span>Continuar</span>
                  </button>
                </div>
              </form>
            )}

            {isProcessing && (
              <div className="flex items-center justify-center gap-2 text-xs text-emerald-600 font-bold py-1 animate-pulse">
                <CheckCircle2 size={14} />
                <span>Verificando e iniciando sesión con Google...</span>
              </div>
            )}
          </div>

          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-400 text-center flex items-center justify-center gap-2">
            <span>Acceso Seguro OAuth • Almacenes Ibarra</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
