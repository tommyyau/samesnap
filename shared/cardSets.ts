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

// Great Outdoors Set: 57 outdoor gear and adventure PNGs
const GREAT_OUTDOORS_IMAGES = [
  '016281_cha_furry_flying_hat_acc_ss23_01__45355.png',
  '016884_kha_mtlc_pln_water_bottle_w_kb_1l_har_ss25_01.png',
  '018519_yel_rash_vest_men_ss24_01.png',
  '018903_yel_force_jacket_men_aw23_02.png',
  '021498_cob_aruba_swim_short_men_ss25_02.png',
  '022025_gre_field_extreme_vibram_waterproof_walking_shoe_ftw_ss24_double_01.png',
  '022323_bla_combination_padlock_har_aw23_01.png',
  '022533_pin_festival_2person_ss25_01.png',
  '023097_cob_raptor_kids_snow_jacket_kid_ss24_02__47250.png',
  '023147_bei_ohio_womens_thermal_fleece_lined_snow_boot_ftw_aw24_01.png',
  '023156_dpu_basecamp_250_sleeping_bag_aw24_01.png',
  '023345_dte_nevis_womens_fur_lined_fleece_jacket_wms_aw24_02__52319.png',
  '023485_lil_raso_womens_fleece_wms_ss23_02.png',
  '023578_nav_isocool_mid_calf_hiker_sock_acc_ss23_01.png',
  '023933_one_compass_har_aw23_01.png',
  '023965_pur_orchid_print_ss_womens_dress_wms_ss25_02.png',
  '024187_mir_tortolla_sunglasses_acc_ss24_01__56221.png',
  '025105_tea_endurance_stripe_womens_ss_tee_wms_ss25_01.png',
  '025440_kha_alaskan_womens_3_in_1_long_waterproof_jacket_wms_aw23_01.png',
  '025480_ofw_willow_brushed_flannel_slim_fit_ls_womens_shirt_wms_ss25_01.png',
  '025569_lgr_thinsulate_fairisle_womens_glove_acc_aw22_01.png',
  '025771_nav_printed_wms_great_british_weather_t_shirt_wms_ss25_01.png',
  '028715_lil_borg_lined_kids_knitted_character_trapper_acc_aw22_01__07992.png',
  '029309_iri_florence_kids_long_padded_jacket_kid_aw24_04.png',
  '030227_bty_9_led_rubber_mini_torch_har_ss25_01.png',
  '031472_whi_snowflake_wms_extreme_waterproof_thermal_snow_boot_ftw_aw23_06.png',
  '034729_dgn_pace_20l_har_aw24_01.png',
  '035129_red_santorini_printed_wrap_wms_uv_protective_dress_wms_ss25_01__83653.png',
  '035312_kha_explorer_womens_capri_wms_ss24_01.png',
  '036241_red_pocket_first_aid_kit_har_aw24_01.png',
  '037179_mxd_fluff_bomb_kids_fleece_lined_beanie_acc_ss24_04__94973.png',
  '037388_mxd_large_rainbow_umbrella_har_ss25_01.png',
  '041738_kha_ankle_womens_rubber_wellie_ftw_aw24_01__52067.png',
  '042482_jbl_blackout_plain_womens_sports_bra_wms_aw23_01__20817.png',
  '044284_pur_xootz_skateboard_22_inch_ss21_1.png',
  '049646_blu_animal_brett_mens_stripe_boardshorts_anl_ss25_06__85269.png',
  '052972_bpi_mwh_extreme_waterproof_kids_ski_glove_acc_aw25_01__82270.png',
  '053030_bla_adventurer_womens_waterproof_walking_boot_ftw_aw24_01.png',
  '053035_lgr_lakeside_womens_trail_waterproof_running_shoe_ftw_ss24_01__43337.png',
  '053043_blu_dusk_ii_ski_pant_men_aw24_01__14660.png',
  '053085_lpu_cloud_printed_kids_waterproof_all_in_one_snowsuit_kid_aw24_02.png',
  '053319_pur_traveller_60l_20l_har_aw24_02.png',
  '055257_bor_cosy_blanket_scarf_acc_aw24_01__31868.png',
  '055623_bro_sydney_womens_tortoise_sunglasses_acc_ss24_01__34181.png',
  '056132_mxd_4_person_cutlery_set_har_ss24_02__85548.png',
  '056183_yel_ava_kids_tiered_dress_kid_ss25_01.png',
  '056237_kha_alaskan_exterme_3_in_1_waterproof_jacket_men_aw24_01.png',
  '056277_bro_stowe_waterproof_thermal_snow_boot_ftw_aw24_01__35433.png',
  '056905_nav_animal_push_lid_water_bottle_700ml_animal_ss25_01.png',
  '057796_nav_bookworm_backpack_15l_har_ss25_02__01958.png',
  '058209_bpi_mwh_aspen_women_waterproof_ski_jacket_tec_aw25_09.png',
  '058264_grn_mwh_rechargeable_cob_lantern_har_aw25_01__04320.png',
  '058488_nav_animal_regional_baseball_cap_cromer_anl_ss25_01__66806.png',
  '059090_whi_mwh_womens_padded_ski_jacket_and_pant_set_tec_aw25_07.png',
  '060875_kha_cosy_wrap_ii_womens_extreme_down_jacket_wms_aw24_01__82399.png',
  '318636_source_1756886987.png',
  'gftmw1_red_gift_cards_ss18_4.png',
];
export const SYMBOLS_GREAT_OUTDOORS = createPngSymbols('great-outdoors', GREAT_OUTDOORS_IMAGES);

export const CARD_SET_GREAT_OUTDOORS: CardSet = {
  id: 'great-outdoors',
  name: 'Great Outdoors',
  description: 'Outdoor gear and adventure equipment',
  symbols: SYMBOLS_GREAT_OUTDOORS,
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
  CARD_SET_GREAT_OUTDOORS,
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
