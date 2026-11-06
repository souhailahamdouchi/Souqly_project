import { useState } from 'react';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Store,
  Phone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

type Fields = 'name' | 'email' | 'phone' | 'password' | 'password_confirmation' | 'shop_name';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function AuthPage({ onSuccess }: { onSuccess?: (user: { roles?: Array<{ name: string }> | null; vendor?: unknown } | null) => void }) {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isVendor, setIsVendor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    password_confirmation: '',
    shop_name: '',
  });
  const [errors, setErrors] = useState<Partial<Record<Fields, string>>>({});

  const setField = (field: Fields, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const toggleMode = () => {
    setIsLogin((v) => !v);
    setShowPassword(false);
    setErrors({});
  };

  const validate = (): boolean => {
    const next: Partial<Record<Fields, string>> = {};

    if (!isLogin && form.name.trim().length < 3) {
      next.name = 'Veuillez saisir votre nom complet (3 caractères min.).';
    }
    if (!EMAIL_RE.test(form.email.trim())) {
      next.email = 'Adresse e-mail invalide.';
    }
    if (form.password.length < 6) {
      next.password = 'Le mot de passe doit contenir au moins 6 caractères.';
    }
    if (!isLogin) {
      if (form.password_confirmation !== form.password) {
        next.password_confirmation = 'Les deux mots de passe ne correspondent pas.';
      }
      if (isVendor && form.shop_name.trim().length < 3) {
        next.shop_name = 'Veuillez saisir le nom de votre boutique (3 caractères min.).';
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Veuillez corriger les champs en erreur.');
      return;
    }

    setBusy(true);
    try {
      if (isLogin) {
        const user = await login(form.email.trim(), form.password);
        toast.success('Connexion réussie ! Bienvenue.');
        onSuccess?.(user);
      } else {
        const user = await register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          password_confirmation: form.password_confirmation,
          phone: form.phone.replace(/\s/g, '') || undefined,
          role: isVendor ? 'vendor' : 'client',
          shop_name: isVendor ? form.shop_name.trim() : undefined,
        });
        toast.success(
          isVendor
            ? 'Compte vendeur créé ! Votre boutique sera activée après validation par l\'administration.'
            : 'Compte créé avec succès ! Bienvenue sur SOUQLY.',
        );
        onSuccess?.(user);
      }
      setForm({ name: '', email: '', phone: '', password: '', password_confirmation: '', shop_name: '' });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.errors) {
          Object.keys(error.errors).forEach((key) => {
            const first = error.errors?.[key]?.[0];
            if (first && ['name', 'email', 'phone', 'password', 'password_confirmation', 'shop_name'].includes(key)) {
              setErrors((prev) => ({ ...prev, [key as Fields]: first }));
            }
          });
          toast.error('Veuillez corriger les champs en erreur.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error('Impossible de contacter le serveur.');
      }
    } finally {
      setBusy(false);
    }
  };

  const inputClass = (field: Fields) =>
    `w-full border rounded-lg py-2.5 focus:ring-2 focus:ring-souqly-blue focus:border-souqly-blue outline-none transition-all ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-gray-300'
    }`;

  return (
    <div className="min-h-[70vh] flex rounded-2xl overflow-hidden shadow-xl bg-white my-8">
      {/* COLONNE GAUCHE : Branding / Image (Caché sur mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-souqly-blue relative flex-col justify-center items-center p-10 xl:p-12 text-center overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>

        <div className="relative z-10">
          <h1 className="text-4xl font-extrabold text-white mb-6">Rejoignez SOUQLY</h1>
          <p className="text-blue-100 text-lg mb-8 leading-relaxed">
            La plus grande marketplace marocaine. Achetez auprès de vos commerçants locaux ou
            vendez vos propres produits en toute simplicité.
          </p>
          <img
            src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=500&q=80"
            alt="Shopping"
            loading="lazy"
            className="rounded-2xl shadow-2xl mx-auto w-3/4 max-h-[35vh] object-cover"
          />
        </div>
      </div>

      {/* COLONNE DROITE : Formulaire */}
      <div className="w-full lg:w-1/2 p-6 sm:p-8 md:p-12 flex flex-col justify-center min-w-0">
        {/* En-tête du formulaire */}
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-souqly-dark mb-2">
            {isLogin ? 'Bon retour parmi nous !' : 'Créer un compte'}
          </h2>
          <p className="text-gray-500">
            {isLogin
              ? 'Entrez vos identifiants pour accéder à votre compte.'
              : 'Achetez ou vendez sur la plus grande marketplace du Royaume.'}
          </p>
        </div>

        <form className="space-y-5" onSubmit={(e) => void handleSubmit(e)} noValidate>
          {/* Type de compte (inscription) */}
          {!isLogin && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsVendor(false)}
                aria-pressed={!isVendor}
                className={`flex items-center justify-center gap-2 border rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  !isVendor ? 'border-souqly-blue bg-blue-50 text-souqly-blue' : 'border-gray-300 text-gray-500'
                }`}
              >
                <User size={16} /> Client
              </button>
              <button
                type="button"
                onClick={() => setIsVendor(true)}
                aria-pressed={isVendor}
                className={`flex items-center justify-center gap-2 border rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  isVendor ? 'border-souqly-blue bg-blue-50 text-souqly-blue' : 'border-gray-300 text-gray-500'
                }`}
              >
                <Store size={16} /> Vendeur
              </button>
            </div>
          )}

          {/* Champ Nom (Seulement en mode Inscription) */}
          {!isLogin && (
            <div className="flex flex-col gap-1">
              <label htmlFor="auth-name" className="text-sm font-medium text-gray-700">
                {isVendor ? "Nom du responsable" : 'Nom complet'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={18} className="text-gray-400" />
                </div>
                <input
                  id="auth-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="Ex: Sohan Enigma"
                  autoComplete="name"
                  className={`${inputClass('name')} pl-10 pr-4`}
                />
              </div>
              {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
            </div>
          )}

          {/* Boutique (vendeurs) */}
          {!isLogin && isVendor && (
            <div className="flex flex-col gap-1">
              <label htmlFor="auth-shop" className="text-sm font-medium text-gray-700">
                Nom de la boutique
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Store size={18} className="text-gray-400" />
                </div>
                <input
                  id="auth-shop"
                  type="text"
                  value={form.shop_name}
                  onChange={(e) => setField('shop_name', e.target.value)}
                  placeholder="Ex: Électro Casa"
                  className={`${inputClass('shop_name')} pl-10 pr-4`}
                />
              </div>
              {errors.shop_name && <p className="text-xs text-red-500">{errors.shop_name}</p>}
            </div>
          )}

          {/* Champ Email */}
          <div className="flex flex-col gap-1">
            <label htmlFor="auth-email" className="text-sm font-medium text-gray-700">
              Adresse e-mail
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail size={18} className="text-gray-400" />
              </div>
              <input
                id="auth-email"
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="vous@exemple.com"
                autoComplete="email"
                className={`${inputClass('email')} pl-10 pr-4`}
              />
            </div>
            {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
          </div>

          {/* Téléphone (inscription) */}
          {!isLogin && (
            <div className="flex flex-col gap-1">
              <label htmlFor="auth-phone" className="text-sm font-medium text-gray-700">
                Téléphone <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone size={18} className="text-gray-400" />
                </div>
                <input
                  id="auth-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="Ex: 0612345678"
                  autoComplete="tel"
                  className={`${inputClass('phone')} pl-10 pr-4`}
                />
              </div>
              {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
            </div>
          )}

          {/* Champ Mot de passe */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center gap-3">
              <label htmlFor="auth-password" className="text-sm font-medium text-gray-700">
                Mot de passe
              </label>
              {isLogin && (
                <button
                  type="button"
                  onClick={() => toast('La réinitialisation par e-mail arrivera prochainement.')}
                  className="text-sm text-souqly-blue hover:underline shrink-0"
                >
                  Mot de passe oublié ?
                </button>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400" />
              </div>
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setField('password', e.target.value)}
                placeholder="•••••••"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                className={`${inputClass('password')} pl-10 pr-10`}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-souqly-dark"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
          </div>

          {/* Confirmation du mot de passe (inscription) */}
          {!isLogin && (
            <div className="flex flex-col gap-1">
              <label htmlFor="auth-password-confirm" className="text-sm font-medium text-gray-700">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input
                  id="auth-password-confirm"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password_confirmation}
                  onChange={(e) => setField('password_confirmation', e.target.value)}
                  placeholder="•••••••"
                  autoComplete="new-password"
                  className={`${inputClass('password_confirmation')} pl-10 pr-4`}
                />
              </div>
              {errors.password_confirmation && (
                <p className="text-xs text-red-500">{errors.password_confirmation}</p>
              )}
            </div>
          )}

          {/* Bouton de soumission */}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-souqly-blue hover:bg-blue-800 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-md mt-6 disabled:opacity-60"
          >
            {isLogin ? 'Se connecter' : "S'inscrire"}
            <ArrowRight size={20} />
          </button>
        </form>

        {/* Lien pour basculer entre Login et Register */}
        <div className="mt-8 text-center text-sm text-gray-600">
          {isLogin ? "Vous n'avez pas de compte ?" : 'Vous avez déjà un compte ?'}
          <button
            onClick={toggleMode}
            className="ml-2 font-bold text-souqly-orange hover:underline"
          >
            {isLogin ? 'Créer un compte' : 'Se connecter'}
          </button>
        </div>
      </div>
    </div>
  );
}
