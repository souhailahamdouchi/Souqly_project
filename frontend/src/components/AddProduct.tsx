import { useEffect, useState } from 'react';
import { Save, X, ImageIcon, Link2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { catalog, vendorApi } from '../api';
import { ApiError } from '../api/client';
import type { CategoryApi } from '../api/types';

interface AddProductProps {
  onCancel?: () => void;
}

const MAX_IMAGES = 4;

export default function AddProduct({ onCancel }: AddProductProps) {
  const [categories, setCategories] = useState<CategoryApi[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    promoPrice: '',
    stock: '',
    color: '',
    size: '',
  });
  const [imageUrls, setImageUrls] = useState<string[]>(['']);
  const [errors, setErrors] = useState<{ [key in 'name' | 'description' | 'category' | 'price' | 'promoPrice' | 'stock']?: string }>({});

  useEffect(() => {
    let cancelled = false;
    catalog
      .categories()
      .then((list) => {
        if (!cancelled) setCategories(list.filter((c) => c.is_active && !c.parent_id));
      })
      .catch(() => {
        if (!cancelled) toast.error('Impossible de charger les catégories.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    const price = parseFloat(form.price);
    const promo = form.promoPrice ? parseFloat(form.promoPrice) : null;
    const stock = parseInt(form.stock, 10);

    if (form.name.trim().length < 3) next.name = 'Nom requis (3 caractères min.).';
    if (form.description.trim().length < 10) next.description = 'Description requise (10 caractères min.).';
    if (!form.category) next.category = 'Veuillez choisir une catégorie.';
    if (!Number.isFinite(price) || price <= 0) next.price = 'Prix invalide.';
    if (promo !== null && (!Number.isFinite(promo) || promo <= 0)) next.promoPrice = 'Prix promo invalide.';
    else if (promo !== null && Number.isFinite(price) && promo >= price)
      next.promoPrice = 'Le prix promo doit être inférieur au prix normal.';
    if (!Number.isInteger(stock) || stock <= 0) next.stock = 'Stock invalide (1 minimum).';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Veuillez corriger les champs en erreur.');
      return;
    }

    setBusy(true);
    try {
      const sku = `SKU-${Date.now()}`;
      const price = parseFloat(form.price);
      await vendorApi.createProduct({
        name: form.name.trim(),
        description: form.description.trim(),
        category_id: Number(form.category),
        price,
        ...(form.promoPrice ? { promo_price: parseFloat(form.promoPrice) } : {}),
        variants: [
          {
            sku,
            size: form.size.trim() || 'Standard',
            color: form.color.trim() || 'Standard',
            price,
            stock: parseInt(form.stock, 10),
          },
        ],
        images: imageUrls
          .map((u) => u.trim())
          .filter(Boolean)
          .slice(0, MAX_IMAGES)
          .map((path) => ({ path })),
      });
      toast.success('Produit créé en brouillon. Soumettez-le pour validation depuis « Mes Produits ».');
      onCancel?.();
    } catch (error) {
      if (error instanceof ApiError) {
        const fields = Object.entries(error.errors ?? {});
        if (fields.length > 0) {
          fields.forEach(([key, messages]) => {
            const first = messages?.[0];
            if (first) toast.error(`${key} : ${first}`);
          });
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error('Impossible de créer le produit dans le backend.');
      }
    } finally {
      setBusy(false);
    }
  };

  const fieldClass = (field: keyof typeof errors) =>
    `border rounded-lg px-4 py-2 focus:ring-2 focus:ring-souqly-blue focus:outline-none ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-gray-300'
    }`;

  return (
    <div className="py-8 max-w-4xl mx-auto">
      {/* En-tête de la page */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-souqly-dark">Ajouter un nouveau produit</h1>
          <p className="text-sm text-gray-500 mt-1">
            Le produit sera créé en brouillon, puis soumis à la validation de l'administration.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-500 hover:text-red-500 flex items-center gap-1 text-sm font-medium shrink-0"
        >
          <X size={18} /> Annuler
        </button>
      </div>

      <form className="space-y-6" onSubmit={(e) => void handlePublish(e)} noValidate>
        {/* SECTION 1 : Informations générales */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <h2 className="text-lg font-bold text-souqly-dark mb-4 border-b border-gray-100 pb-2">
            1. Informations générales
          </h2>

          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="p-name" className="text-sm font-medium text-gray-700">
                Nom du produit <span className="text-red-500">*</span>
              </label>
              <input
                id="p-name"
                type="text"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Ex: Casque Audio Sans Fil Bluetooth"
                className={fieldClass('name')}
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="p-desc" className="text-sm font-medium text-gray-700">
                Description détaillée <span className="text-red-500">*</span>
              </label>
              <textarea
                id="p-desc"
                rows={4}
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Décrivez votre produit, ses caractéristiques, sa garantie..."
                className={`${fieldClass('description')} resize-none`}
              />
              {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="p-category" className="text-sm font-medium text-gray-700">
                  Catégorie <span className="text-red-500">*</span>
                </label>
                <select
                  id="p-category"
                  value={form.category}
                  onChange={(e) => setField('category', e.target.value)}
                  className={`${fieldClass('category')} bg-white`}
                >
                  <option value="">Sélectionnez une catégorie</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name_fr}
                    </option>
                  ))}
                </select>
                {errors.category && <p className="text-xs text-red-500">{errors.category}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="p-color" className="text-sm font-medium text-gray-700">
                  Couleur (variante)
                </label>
                <input
                  id="p-color"
                  type="text"
                  value={form.color}
                  onChange={(e) => setField('color', e.target.value)}
                  placeholder="Ex: Noir (défaut : Standard)"
                  className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-souqly-blue focus:outline-none"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="p-size" className="text-sm font-medium text-gray-700">
                Taille (variante)
              </label>
              <input
                id="p-size"
                type="text"
                value={form.size}
                onChange={(e) => setField('size', e.target.value)}
                placeholder="Ex: 42, XL... (défaut : Standard)"
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-souqly-blue focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2 : Images (URLs) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <h2 className="text-lg font-bold text-souqly-dark mb-4 border-b border-gray-100 pb-2">
            2. Images du produit
          </h2>
          <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
            <Link2 size={13} /> Collez des URL d'images (ex: https://images.unsplash.com/...). La première sera l'affiche principale.
          </p>
          <div className="space-y-2">
            {imageUrls.map((url, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <ImageIcon size={16} className="text-gray-400" />
                  </div>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) =>
                      setImageUrls((prev) => prev.map((u, i) => (i === index ? e.target.value : u)))
                    }
                    placeholder={`URL de l'image ${index + 1}`}
                    aria-label={`URL de l'image ${index + 1}`}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-souqly-blue focus:outline-none"
                  />
                </div>
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => setImageUrls((prev) => prev.filter((_, i) => i !== index))}
                    className="text-gray-400 hover:text-red-500 shrink-0"
                    aria-label={`Retirer l'image ${index + 1}`}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {imageUrls.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => setImageUrls((prev) => [...prev, ''])}
              className="mt-3 text-sm text-souqly-blue font-medium hover:underline"
            >
              + Ajouter une image ({imageUrls.length}/{MAX_IMAGES})
            </button>
          )}
        </div>

        {/* SECTION 3 : Prix et Stock */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <h2 className="text-lg font-bold text-souqly-dark mb-4 border-b border-gray-100 pb-2">
            3. Prix &amp; Stock
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="p-price" className="text-sm font-medium text-gray-700">
                Prix normal (MAD) <span className="text-red-500">*</span>
              </label>
              <input
                id="p-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setField('price', e.target.value)}
                placeholder="0.00"
                className={fieldClass('price')}
              />
              {errors.price && <p className="text-xs text-red-500">{errors.price}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="p-promo" className="text-sm font-medium text-gray-700">
                Prix promo (MAD)
              </label>
              <input
                id="p-promo"
                type="number"
                min="0"
                step="0.01"
                value={form.promoPrice}
                onChange={(e) => setField('promoPrice', e.target.value)}
                placeholder="0.00"
                className={fieldClass('promoPrice')}
              />
              {errors.promoPrice && <p className="text-xs text-red-500">{errors.promoPrice}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="p-stock" className="text-sm font-medium text-gray-700">
                Quantité en stock <span className="text-red-500">*</span>
              </label>
              <input
                id="p-stock"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={(e) => setField('stock', e.target.value)}
                placeholder="Ex: 50"
                className={fieldClass('stock')}
              />
              {errors.stock && <p className="text-xs text-red-500">{errors.stock}</p>}
            </div>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex flex-wrap justify-end gap-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Voir mes produits
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-6 py-2.5 bg-souqly-blue hover:bg-blue-800 text-white font-medium rounded-lg flex items-center gap-2 transition-colors shadow-sm disabled:opacity-60"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {busy ? 'Création...' : 'Publier le produit'}
          </button>
        </div>
      </form>
    </div>
  );
}
