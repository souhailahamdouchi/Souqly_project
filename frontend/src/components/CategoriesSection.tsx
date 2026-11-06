import {
  Smartphone,
  Shirt,
  Home,
  Watch,
  Gamepad2,
  BookOpen,
  ShoppingBag,
  Laptop,
  Sparkles,
  Baby,
  Palette,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import type { CategoryApi } from '../api/types';

interface CategoriesSectionProps {
  categories: CategoryApi[];
  activeCategory: string | null;
  onSelect: (slug: string) => void;
}

const ICONS: Array<{ keywords: string[]; icon: LucideIcon }> = [
  { keywords: ['tel', 'phone', 'gsm', 'mobile'], icon: Smartphone },
  { keywords: ['mode', 'vet', 'hab', 'textile', 'fash'], icon: Shirt },
  { keywords: ['mai', 'hous', 'decor', 'furni', 'dom'], icon: Home },
  { keywords: ['montre', 'watch', 'access'], icon: Watch },
  { keywords: ['jeu', 'game', 'console', 'jouet', 'toy'], icon: Gamepad2 },
  { keywords: ['livre', 'book', 'papeter', 'statio'], icon: BookOpen },
  { keywords: ['informat', 'electron', 'electro', 'tech', 'num'], icon: Laptop },
  { keywords: ['beaut', 'parf', 'cosmet', 'sante', 'bio'], icon: Sparkles },
  { keywords: ['enfant', 'bebe', 'baby', 'kid'], icon: Baby },
  { keywords: ['art', 'cultur', 'loisir'], icon: Palette },
  { keywords: ['aliment', 'cuis', 'food', 'epic'], icon: UtensilsCrossed },
];

function iconFor(name: string): LucideIcon {
  const lower = name.toLowerCase();
  for (const entry of ICONS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry.icon;
  }
  return ShoppingBag;
}

export default function CategoriesSection({ categories, activeCategory, onSelect }: CategoriesSectionProps) {
  const scrollToProducts = () =>
    document
      .getElementById('produits')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const roots = categories.filter((c) => c.is_active);

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-souqly-dark">Explorer par catégorie</h2>
        <button
          type="button"
          onClick={scrollToProducts}
          className="text-souqly-blue font-medium hover:underline text-sm cursor-pointer"
        >
          Voir tout
        </button>
      </div>

      {roots.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
          Aucune catégorie disponible.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {roots.map((cat) => {
            const Icon = iconFor(cat.name_fr);
            const isActive = activeCategory === cat.slug;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelect(cat.slug)}
                aria-pressed={isActive}
                title={cat.name_fr}
                className={`p-4 rounded-xl shadow-sm border transition-all flex flex-col items-center justify-center gap-3 group cursor-pointer ${
                  isActive
                    ? 'border-souqly-blue bg-blue-50 shadow-md'
                    : 'bg-white border-gray-100 hover:shadow-md hover:border-souqly-blue'
                }`}
              >
                <div
                  className={`p-3 rounded-full transition-colors duration-300 ${
                    isActive
                      ? 'bg-souqly-blue text-white'
                      : 'bg-blue-50 text-souqly-blue group-hover:bg-souqly-blue group-hover:text-white'
                  }`}
                >
                  <Icon size={24} />
                </div>
                <span
                  className={`text-sm font-semibold transition-colors truncate max-w-full ${
                    isActive ? 'text-souqly-blue' : 'text-gray-700 group-hover:text-souqly-blue'
                  }`}
                >
                  {cat.name_fr}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
