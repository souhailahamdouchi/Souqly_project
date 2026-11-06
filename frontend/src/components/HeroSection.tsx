import { ArrowRight, ShieldCheck, Truck, CreditCard } from 'lucide-react';

export default function HeroSection() {
  return (
    <div className="relative bg-gradient-to-r from-souqly-blue to-blue-900 rounded-2xl overflow-hidden mb-12 shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-16 md:py-24 relative z-10 flex flex-col items-start text-white">
        <span className="bg-souqly-orange text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
          Nouveaux arrivages
        </span>
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight max-w-xl">
          Découvrez le meilleur du commerce marocain.
        </h1>
        <p className="text-lg md:text-xl text-blue-100 mb-8 max-w-lg">
          Des milliers de produits de vos commerçants locaux, livrés directement chez vous en toute sécurité.
        </p>
        <button
          type="button"
          onClick={() =>
            document
              .getElementById('produits')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
          className="bg-souqly-orange hover:bg-orange-600 text-white font-bold py-3 px-8 rounded-lg flex items-center gap-2 transition-all transform hover:scale-105 shadow-md cursor-pointer"
        >
          Explorer le catalogue
          <ArrowRight size={20} />
        </button>

        {/* Petits arguments de confiance en bas de la bannière */}
        <div className="flex flex-wrap gap-6 mt-12 pt-6 border-t border-blue-400/30 w-full text-sm text-blue-100">
          <div className="flex items-center gap-2"><Truck size={18} className="text-souqly-orange" /> Livraison rapide</div>
          <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-souqly-orange" /> Paiement sécurisé</div>
          <div className="flex items-center gap-2"><CreditCard size={18} className="text-souqly-orange" /> Paiement à la livraison</div>
        </div>
      </div>
    </div>
  );
}