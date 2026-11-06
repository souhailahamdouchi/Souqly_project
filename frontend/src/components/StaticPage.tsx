import { FileText, ArrowLeft } from 'lucide-react';
import type { Page } from '../types';

export default function StaticPage({
  title = "Conditions Générales de Vente",
  onNavigate,
}: {
  title?: string;
  onNavigate?: (page: Page) => void;
}) {
  return (
    <div className="py-12 max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 my-8">
      {/* En-tête de la page */}
      <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-6">
        <div className="p-3 bg-blue-50 text-souqly-blue rounded-lg shrink-0">
          <FileText size={28} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-souqly-dark min-w-0 break-words">
          {title}
        </h1>
      </div>
      
      {/* Contenu légal */}
      <div className="text-gray-600 leading-relaxed space-y-6">
        <p>Bienvenue sur <strong>SOUQLY</strong>. En utilisant notre plateforme, vous acceptez les présentes conditions générales d'utilisation.</p>
        
        <h2 className="text-xl font-bold text-souqly-dark mt-8 mb-4">1. Mentions Légales</h2>
        <p>La marketplace SOUQLY est éditée par Maghreb Commerce Group, située à Casablanca, Maroc. Directeur de la publication : Direction Générale.</p>
        
        <h2 className="text-xl font-bold text-souqly-dark mt-8 mb-4">2. Protection des données (Loi 09-08)</h2>
        <p>Conformément à la loi marocaine 09-08 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel, vous disposez d'un droit d'accès, de rectification et d'opposition aux données vous concernant.</p>
        
        <h2 className="text-xl font-bold text-souqly-dark mt-8 mb-4">3. Paiement et Livraison</h2>
        <p>Nous acceptons le paiement à la livraison (COD) ainsi que les cartes bancaires via notre partenaire sécurisé CMI. Les délais de livraison varient entre 24h et 72h selon la ville.</p>
      </div>

      <div className="mt-10 pt-6 border-t border-gray-100">
        <button
          type="button"
          onClick={() => onNavigate?.('home')}
          className="text-souqly-blue font-medium hover:underline flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft size={18} />
          Retour à l'accueil
        </button>
      </div>
    </div>
  );
}