// The shape of a saved outfit, and the fixed lists used across the app.

export const CATEGORIES = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  top: 'Top', bottom: 'Bottom', dress: 'Dress', outerwear: 'Outerwear',
  shoes: 'Shoes', accessory: 'Accessory', other: 'Other'
};

export const STATUSES = ['wishlist', 'owned', 'bought'] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = { wishlist: 'Wishlist', owned: 'Owned', bought: 'Bought' };

export interface Piece {
  category: Category;
  name: string;
}

export interface Outfit {
  id: string;
  url: string;
  title: string;
  note: string;
  status: Status;
  pieces: Piece[];
  budget: string;
  // Preview picture. null = not looked up yet, '' = looked up but the site had none.
  image: string | null;
  created_at: string;
  updated_at: string;
  // Set when deleted (so other devices find out); otherwise null.
  deleted_at: string | null;
}

// What you fill in when saving; the app adds the id and dates.
export type OutfitInput = Pick<Outfit, 'url'> & Partial<Omit<Outfit, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>;
