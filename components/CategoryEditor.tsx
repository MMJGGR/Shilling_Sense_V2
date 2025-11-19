
import React from 'react';
import { Category } from '../types';

interface CategoryEditorProps {
  value: Category;
  onChange: (newCategory: Category) => void;
  onBlur: () => void;
  categories: Category[];
}

const CategoryEditor: React.FC<CategoryEditorProps> = ({ value, onChange, onBlur, categories }) => {
  const datalistId = React.useId();
  return (
    <>
      <input
        list={datalistId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoFocus
        className="block w-full rounded-md border-brand-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green sm:text-sm p-1"
      />
      <datalist id={datalistId}>
        {categories.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>
    </>
  );
};

export default CategoryEditor;
