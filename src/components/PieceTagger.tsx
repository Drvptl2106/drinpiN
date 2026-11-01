// Quick piece tagging: tap a colour, then a piece ("white" → "kurti") and it's added.
// Typing works too; the category is guessed from the words ("sneakers" → Shoes).
import { useMemo } from 'react';
import { CATEGORIES, CATEGORY_LABELS, type Category, type Piece } from '../lib/types';
import { COLOURS, SUGGESTIONS } from '../lib/tags';
import { IconClose } from './icons';

// Words that give away a piece's category. Checked in this order, so "shirt dress" counts as a dress.
const KEYWORDS: [Category, string[]][] = [
  ['dress', ['dress', 'saree', 'sari', 'lehenga', 'gown', 'co-ord', 'coord', 'jumpsuit', 'anarkali', 'kaftan', 'romper']],
  ['outerwear', ['jacket', 'blazer', 'coat', 'shrug', 'cardigan', 'overshirt', 'shacket', 'hoodie']],
  ['shoes', ['shoe', 'sneaker', 'heel', 'sandal', 'kolhapuri', 'jutti', 'boot', 'loafer', 'flats', 'mule', 'slipper', 'chappal', 'stiletto', 'wedges']],
  ['accessory', ['bag', 'tote', 'earring', 'jhumka', 'sunglass', 'watch', 'belt', 'scarf', 'ring', 'necklace', 'bracelet', 'hoops', 'clip', 'cap', 'hat', 'bangle', 'anklet', 'chain']],
  ['bottom', ['jeans', 'trouser', 'pants', 'skirt', 'shorts', 'palazzo', 'legging', 'salwar', 'jogger', 'culottes', 'dhoti']],
  ['top', ['top', 'tee', 't-shirt', 'tshirt', 'kurti', 'kurta', 'shirt', 'blouse', 'sweater', 'tank', 'corset', 'bralette', 'cami', 'polo', 'sweatshirt']]
];

export function guessCategory(name: string): Category | null {
  const text = name.toLowerCase();
  for (const [category, words] of KEYWORDS) {
    if (words.some((w) => new RegExp(`(^|[^a-z])${w}`).test(text))) return category;
  }
  return null;
}

const MIXED = ['kurti', 'jeans', 'saree', 'co-ord set', 'sneakers', 'tote bag', 'denim jacket', 'jhumkas'];

interface Props {
  pieces: Piece[];
  onChange: (pieces: Piece[]) => void;
  draft: string;
  onDraft: (text: string) => void;
  category: Category | null;
  onCategory: (c: Category | null) => void;
  recent: Piece[]; // pieces from your other outfits, newest first
}

export function PieceTagger({ pieces, onChange, draft, onDraft, category, onCategory, recent }: Props) {
  const suggestions = useMemo(() => {
    const already = new Set(pieces.map((p) => p.name.toLowerCase()));
    // Up to 6 of your own recent tags first, so the common ones still show.
    const mine = recent.filter((p) => !category || p.category === category).map((p) => p.name).slice(0, 6);
    const base = category ? SUGGESTIONS[category] : MIXED;
    const seen = new Set<string>();
    return [...mine, ...base]
      .filter((n) => {
        const key = n.toLowerCase();
        if (seen.has(key) || already.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 12);
  }, [pieces, recent, category]);

  function add(raw: string, preferred?: Category | null) {
    const name = raw.replace(/\s+/g, ' ').trim();
    if (!name) return;
    const cat = category ?? preferred ?? guessCategory(name) ?? 'other';
    onChange([...pieces, { category: cat, name }]);
    onDraft('');
  }

  function tapColour(colour: string) {
    const words = draft.trim().split(' ').filter(Boolean);
    if (words.length && COLOURS.includes(words[0])) words.shift(); // swap colours, don't stack them
    onDraft([colour, ...words].join(' ') + ' ');
  }

  function tapSuggestion(name: string) {
    const prefix = draft.trim();
    const fromCategory = CATEGORIES.find((c) => SUGGESTIONS[c].includes(name)) ?? guessCategory(name);
    add(prefix ? `${prefix} ${name}` : name, fromCategory);
  }

  const example = category ? SUGGESTIONS[category][0] : 'kurti';
  return (
    <div className="field">
      <span className="field-label" id="pieces-label">Pieces you liked</span>
      <span className="field-hint">Tag each one to find it in shops. You can skip this and do it later.</span>

      {pieces.length > 0 && (
        <div className="tagged" aria-labelledby="pieces-label">
          {pieces.map((p, i) => (
            <span className="tagged-piece" key={i + p.name}>
              <small>{CATEGORY_LABELS[p.category]}</small>
              <span>{p.name}</span>
              <button type="button" aria-label={`Remove ${p.name}`} onClick={() => onChange(pieces.filter((_, j) => j !== i))}>
                <IconClose />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="composer">
        <div className="chip-row" role="group" aria-label="Category">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" className="chip small" aria-pressed={category === c} onClick={() => onCategory(category === c ? null : c)}>
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <div className="input-group">
          <input
            className="input"
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add(draft);
              }
            }}
            placeholder={`e.g. white ${example}`}
            aria-label="Piece name"
            enterKeyHint="done"
            autoCapitalize="none"
          />
          <button type="button" className="btn dark" disabled={!draft.trim()} onClick={() => add(draft)}>
            Add
          </button>
        </div>
        <div className="composer-sub">Colour</div>
        <div className="chip-row">
          {COLOURS.map((c) => (
            <button key={c} type="button" className="chip small" onClick={() => tapColour(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="composer-sub">Tap to add</div>
        <div className="chip-row">
          {suggestions.map((s) => (
            <button key={s} type="button" className="chip small ghost" onClick={() => tapSuggestion(s)}>
              + {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
