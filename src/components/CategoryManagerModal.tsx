import React, { useState } from 'react';
import { CategoryItem } from '../types';
import { X, Plus, Trash2, Edit2, Tag, Check, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CategoryManagerModalProps {
  isOpen: boolean;
  type: 'income' | 'expense';
  categories: CategoryItem[];
  onClose: () => void;
  onSaveCategory: (category: CategoryItem) => Promise<void>;
  onDeleteCategory: (categoryId: string, type: 'income' | 'expense') => Promise<void>;
}

const PRESET_COLORS = [
  '#10B981', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6',
  '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#06B6D4',
  '#A855F7', '#64748B'
];

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  type,
  categories,
  onClose,
  onSaveCategory,
  onDeleteCategory,
}) => {
  const [newCatName, setNewCatName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const currentCategories = categories.filter((c) => c.type === type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setIsSubmitting(true);
    const catObj: CategoryItem = {
      id: editingCategory ? editingCategory.id : (type === 'income' ? 'inc_' : 'exp_') + Date.now(),
      name: newCatName.trim(),
      type: type,
      color: selectedColor,
      icon: 'Tag',
      is_default: editingCategory ? editingCategory.is_default : false,
    };

    await onSaveCategory(catObj);
    setNewCatName('');
    setEditingCategory(null);
    setIsSubmitting(false);
  };

  const handleStartEdit = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setNewCatName(cat.name);
    setSelectedColor(cat.color || PRESET_COLORS[0]);
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setNewCatName('');
    setSelectedColor(PRESET_COLORS[0]);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Pengurus Jenis {type === 'income' ? 'Duit Masuk (Income)' : 'Duit Keluar (Expense)'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tambah, ubahsuai nama atau warna kategori mengikut keperluan anda.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            
            {/* Add / Edit Input Form */}
            <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {editingCategory ? '✏️ Kemaskini Kategori' : '+ Tambah Kategori Baru'}
                </span>
                {editingCategory && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-[11px] text-slate-500 hover:underline"
                  >
                    Batal Kemaskini
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  required
                  placeholder={`cth: ${type === 'income' ? 'Elaun Kerja Lebih Masa' : 'Barangan Elektrik'}`}
                  className="flex-1 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingCategory ? 'Simpan' : 'Tambah'}</span>
                </button>
              </div>

              {/* Color Palette */}
              <div>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
                  Warna Label:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                        selectedColor === c ? 'scale-110 border-slate-900 dark:border-white' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </form>

            {/* List of Existing Categories */}
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
                Senarai Kategori Sedia Ada ({currentCategories.length}):
              </span>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {currentCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: cat.color || '#10B981' }}
                      />
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {cat.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(cat)}
                        title="Edit Kategori"
                        className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm(`Padam kategori "${cat.name}"?`)) {
                            await onDeleteCategory(cat.id, type);
                          }
                        }}
                        title="Padam Kategori"
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Selesai
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
