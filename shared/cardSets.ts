import { CardSet, SymbolItem } from './types';
import { SYMBOLS, SYMBOLS_HARD, SYMBOLS_INSANE } from '../constants';

// Helper to create PNG-based SymbolItem array
export function createPngSymbols(
  setFolder: string,
  imageNames: string[]
): SymbolItem[] {
  if (imageNames.length !== 57) {
    throw new Error(
      `PNG card set must have exactly 57 images, got ${imageNames.length}`
    );
  }

  return imageNames.map((name, index) => ({
    id: index,
    char: '', // No emoji fallback for PNG sets
    name: name.replace(/-/g, ' ').replace(/\.png$/, ''), // "polar-bear.png" -> "polar bear"
    imageUrl: `/cardsets/${setFolder}/${name}`,
  }));
}

// ============================================
// PNG CARD SETS
// ============================================

// Number Set: 1.png through 57.png
const NUMBER_SET_IMAGES = Array.from({ length: 57 }, (_, i) => `${i + 1}.png`);
export const SYMBOLS_NUMBER_SET = createPngSymbols('number-set', NUMBER_SET_IMAGES);

export const CARD_SET_NUMBERS: CardSet = {
  id: 'numbers',
  name: 'Numbers',
  description: 'Simple numbers 1-57 - great for testing PNG support!',
  symbols: SYMBOLS_NUMBER_SET,
  isBuiltIn: true,
};

// Marvel Comics Set: 57 Marvel character chibi PNGs
const MARVEL_COMICS_IMAGES = [
  'ant-man-chibi.png',
  'apocalypse-(en-sabah-nur)-chibi.png',
  'beast-(hank-mccoy)-chibi.png',
  'black-panther-chibi.png',
  'black-widow-(natasha-romanoff)-chibi.png',
  'blade-chibi.png',
  'captain-america-chibi.png',
  'captain-marvel-(carol-danvers)-chibi.png',
  'cyclops-chibi.png',
  'daredevil-chibi.png',
  'deadpool-chibi.png',
  'doctor-doom-chibi.png',
  'doctor-octopus-(otto-octavius)-chibi.png',
  'doctor-strange-chibi.png',
  'drax-the-destroyer-chibi.png',
  'elektra-(elektra-natchios)-chibi.png',
  'falcon-(sam-wilson)-chibi.png',
  'galactus-chibi.png',
  'gambit-chibi.png',
  'gamora-chibi.png',
  'ghost-rider-chibi.png',
  'green-goblin-(norman-osborn)-chibi.png',
  'groot-chibi.png',
  'hawkeye-chibi.png',
  'hela-chibi.png',
  'hulk-chibi.png',
  'human-torch-(johnny-storm)-chibi.png',
  'invisible-woman-(sue-storm)-chibi.png',
  'iron-man-chibi.png',
  'jean-grey-chibi.png',
  'jessica-jones-chibi.png',
  'kingpin-(wilson-fisk)-chibi.png',
  'loki-chibi.png',
  'magneto-chibi.png',
  'moon-knight-(marc-spector)-chibi.png',
  'ms.-marvel-(kamala-khan)-chibi.png',
  'mystique-(raven-darkhölme)-chibi.png',
  'nebula-chibi.png',
  'nightcrawler-(kurt-wagner)-chibi.png',
  'quicksilver-chibi.png',
  'rocket-raccoon-chibi.png',
  'rogue-(anna-marie)-chibi.png',
  'sabretooth-(victor-creed)-chibi.png',
  'scarlet-witch-chibi.png',
  'she-hulk-chibi.png',
  'spiderman-chibi.png',
  'storm-chibi.png',
  'thanos-chibi.png',
  'the-punisher-chibi.png',
  'the-thing-(ben-grimm)-chibi.png',
  'thor-chibi.png',
  'venom-(eddie-brock)-chibi.png',
  'vision-chibi.png',
  'war-machine-(james-rhodes)-chibi.png',
  'wasp-chibi.png',
  'winter-soldier-(bucky-barnes)-chibi.png',
  'wolverine-chibi.png',
];
export const SYMBOLS_MARVEL_COMICS = createPngSymbols('marvel-comics', MARVEL_COMICS_IMAGES);

export const CARD_SET_MARVEL: CardSet = {
  id: 'marvel',
  name: 'Heroes & Villains',
  description: 'Chibi-style superheroes and villains',
  symbols: SYMBOLS_MARVEL_COMICS,
  isBuiltIn: true,
};

// Built-in card sets (non-editable)
export const BUILT_IN_CARD_SETS: CardSet[] = [
  {
    id: 'children',
    name: "Children's",
    description: 'Friendly animals and objects - perfect for young players',
    symbols: SYMBOLS,
    isBuiltIn: true,
  },
  {
    id: 'christmas',
    name: 'Christmas',
    description: 'Festive holiday themed symbols',
    symbols: SYMBOLS_HARD,
    isBuiltIn: true,
  },
  {
    id: 'smiley',
    name: 'Insanity',
    description: 'All yellow faces - extremely challenging!',
    symbols: SYMBOLS_INSANE,
    isBuiltIn: true,
  },
  CARD_SET_NUMBERS,
  CARD_SET_MARVEL,
];

// Default card set ID
export const DEFAULT_CARD_SET_ID = 'children';

// Get only built-in card sets
export function getBuiltInCardSets(): CardSet[] {
  return BUILT_IN_CARD_SETS;
}

// Helper to get a built-in card set by ID
// Note: For custom sets, use the customSymbols from GameConfig instead
export function getCardSetById(id: string): CardSet | undefined {
  return BUILT_IN_CARD_SETS.find(set => set.id === id);
}

// Get symbols for a built-in card set (with fallback to default)
// Note: For custom sets, use the customSymbols from GameConfig instead
export function getSymbolsForCardSet(cardSetId: string): SymbolItem[] {
  const cardSet = getCardSetById(cardSetId);
  return cardSet?.symbols ?? SYMBOLS;
}
