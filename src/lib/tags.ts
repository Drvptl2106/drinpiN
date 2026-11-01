// Ready-made words for tagging pieces quickly. Your own past tags are suggested too.
import type { Category } from './types';

export const SUGGESTIONS: Record<Category, string[]> = {
  top: ['kurti', 'shirt', 't-shirt', 'crop top', 'blouse', 'tank top', 'corset top', 'sweater'],
  bottom: ['jeans', 'wide-leg trousers', 'palazzo', 'skirt', 'cargo pants', 'shorts', 'salwar'],
  dress: ['maxi dress', 'midi dress', 'saree', 'lehenga', 'co-ord set', 'anarkali', 'jumpsuit'],
  outerwear: ['denim jacket', 'blazer', 'shrug', 'trench coat', 'leather jacket', 'cardigan'],
  shoes: ['sneakers', 'kolhapuri', 'block heels', 'juttis', 'loafers', 'flats', 'boots'],
  accessory: ['tote bag', 'jhumkas', 'sunglasses', 'watch', 'hoops', 'belt', 'scarf', 'claw clip'],
  other: ['dupatta', 'scrunchie', 'perfume', 'nail colour']
};

// Tapping a colour puts it in front of the piece name ("white" + "kurti").
export const COLOURS = ['white', 'black', 'beige', 'brown', 'blue', 'denim', 'pink', 'red', 'green', 'yellow', 'grey', 'printed'];
