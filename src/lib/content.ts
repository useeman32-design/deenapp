import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { utf8Decode, gunzipBytes } from '@/lib/gzio';

/**
 * Lazy content loader (pass 18) — reads the user's own datasets from
 * assets/content/** (the /content pack from the web app, committed as
 * .txt so Metro ships them as separate asset files instead of inlining
 * megabytes into the JS bundle).
 *
 * Everything is fetched on demand and cached; on web the assets are served
 * from /assets, on native they're bundled files resolved via expo-asset.
 */

const cache = new Map<string, unknown>();

/* NOTE: every require below is a LITERAL path — Metro resolves asset
 * modules statically, so this map must never use computed strings. */
const modules: Record<string, number> = {
  'quran/surah_1': require('../../assets/content/quran/surah_1.txt'),
  'quran/surah_2': require('../../assets/content/quran/surah_2.txt'),
  'quran/surah_3': require('../../assets/content/quran/surah_3.txt'),
  'quran/surah_4': require('../../assets/content/quran/surah_4.txt'),
  'quran/surah_5': require('../../assets/content/quran/surah_5.txt'),
  'quran/surah_6': require('../../assets/content/quran/surah_6.txt'),
  'quran/surah_7': require('../../assets/content/quran/surah_7.txt'),
  'quran/surah_8': require('../../assets/content/quran/surah_8.txt'),
  'quran/surah_9': require('../../assets/content/quran/surah_9.txt'),
  'quran/surah_10': require('../../assets/content/quran/surah_10.txt'),
  'quran/surah_11': require('../../assets/content/quran/surah_11.txt'),
  'quran/surah_12': require('../../assets/content/quran/surah_12.txt'),
  'quran/surah_13': require('../../assets/content/quran/surah_13.txt'),
  'quran/surah_14': require('../../assets/content/quran/surah_14.txt'),
  'quran/surah_15': require('../../assets/content/quran/surah_15.txt'),
  'quran/surah_16': require('../../assets/content/quran/surah_16.txt'),
  'quran/surah_17': require('../../assets/content/quran/surah_17.txt'),
  'quran/surah_18': require('../../assets/content/quran/surah_18.txt'),
  'quran/surah_19': require('../../assets/content/quran/surah_19.txt'),
  'quran/surah_20': require('../../assets/content/quran/surah_20.txt'),
  'quran/surah_21': require('../../assets/content/quran/surah_21.txt'),
  'quran/surah_22': require('../../assets/content/quran/surah_22.txt'),
  'quran/surah_23': require('../../assets/content/quran/surah_23.txt'),
  'quran/surah_24': require('../../assets/content/quran/surah_24.txt'),
  'quran/surah_25': require('../../assets/content/quran/surah_25.txt'),
  'quran/surah_26': require('../../assets/content/quran/surah_26.txt'),
  'quran/surah_27': require('../../assets/content/quran/surah_27.txt'),
  'quran/surah_28': require('../../assets/content/quran/surah_28.txt'),
  'quran/surah_29': require('../../assets/content/quran/surah_29.txt'),
  'quran/surah_30': require('../../assets/content/quran/surah_30.txt'),
  'quran/surah_31': require('../../assets/content/quran/surah_31.txt'),
  'quran/surah_32': require('../../assets/content/quran/surah_32.txt'),
  'quran/surah_33': require('../../assets/content/quran/surah_33.txt'),
  'quran/surah_34': require('../../assets/content/quran/surah_34.txt'),
  'quran/surah_35': require('../../assets/content/quran/surah_35.txt'),
  'quran/surah_36': require('../../assets/content/quran/surah_36.txt'),
  'quran/surah_37': require('../../assets/content/quran/surah_37.txt'),
  'quran/surah_38': require('../../assets/content/quran/surah_38.txt'),
  'quran/surah_39': require('../../assets/content/quran/surah_39.txt'),
  'quran/surah_40': require('../../assets/content/quran/surah_40.txt'),
  'quran/surah_41': require('../../assets/content/quran/surah_41.txt'),
  'quran/surah_42': require('../../assets/content/quran/surah_42.txt'),
  'quran/surah_43': require('../../assets/content/quran/surah_43.txt'),
  'quran/surah_44': require('../../assets/content/quran/surah_44.txt'),
  'quran/surah_45': require('../../assets/content/quran/surah_45.txt'),
  'quran/surah_46': require('../../assets/content/quran/surah_46.txt'),
  'quran/surah_47': require('../../assets/content/quran/surah_47.txt'),
  'quran/surah_48': require('../../assets/content/quran/surah_48.txt'),
  'quran/surah_49': require('../../assets/content/quran/surah_49.txt'),
  'quran/surah_50': require('../../assets/content/quran/surah_50.txt'),
  'quran/surah_51': require('../../assets/content/quran/surah_51.txt'),
  'quran/surah_52': require('../../assets/content/quran/surah_52.txt'),
  'quran/surah_53': require('../../assets/content/quran/surah_53.txt'),
  'quran/surah_54': require('../../assets/content/quran/surah_54.txt'),
  'quran/surah_55': require('../../assets/content/quran/surah_55.txt'),
  'quran/surah_56': require('../../assets/content/quran/surah_56.txt'),
  'quran/surah_57': require('../../assets/content/quran/surah_57.txt'),
  'quran/surah_58': require('../../assets/content/quran/surah_58.txt'),
  'quran/surah_59': require('../../assets/content/quran/surah_59.txt'),
  'quran/surah_60': require('../../assets/content/quran/surah_60.txt'),
  'quran/surah_61': require('../../assets/content/quran/surah_61.txt'),
  'quran/surah_62': require('../../assets/content/quran/surah_62.txt'),
  'quran/surah_63': require('../../assets/content/quran/surah_63.txt'),
  'quran/surah_64': require('../../assets/content/quran/surah_64.txt'),
  'quran/surah_65': require('../../assets/content/quran/surah_65.txt'),
  'quran/surah_66': require('../../assets/content/quran/surah_66.txt'),
  'quran/surah_67': require('../../assets/content/quran/surah_67.txt'),
  'quran/surah_68': require('../../assets/content/quran/surah_68.txt'),
  'quran/surah_69': require('../../assets/content/quran/surah_69.txt'),
  'quran/surah_70': require('../../assets/content/quran/surah_70.txt'),
  'quran/surah_71': require('../../assets/content/quran/surah_71.txt'),
  'quran/surah_72': require('../../assets/content/quran/surah_72.txt'),
  'quran/surah_73': require('../../assets/content/quran/surah_73.txt'),
  'quran/surah_74': require('../../assets/content/quran/surah_74.txt'),
  'quran/surah_75': require('../../assets/content/quran/surah_75.txt'),
  'quran/surah_76': require('../../assets/content/quran/surah_76.txt'),
  'quran/surah_77': require('../../assets/content/quran/surah_77.txt'),
  'quran/surah_78': require('../../assets/content/quran/surah_78.txt'),
  'quran/surah_79': require('../../assets/content/quran/surah_79.txt'),
  'quran/surah_80': require('../../assets/content/quran/surah_80.txt'),
  'quran/surah_81': require('../../assets/content/quran/surah_81.txt'),
  'quran/surah_82': require('../../assets/content/quran/surah_82.txt'),
  'quran/surah_83': require('../../assets/content/quran/surah_83.txt'),
  'quran/surah_84': require('../../assets/content/quran/surah_84.txt'),
  'quran/surah_85': require('../../assets/content/quran/surah_85.txt'),
  'quran/surah_86': require('../../assets/content/quran/surah_86.txt'),
  'quran/surah_87': require('../../assets/content/quran/surah_87.txt'),
  'quran/surah_88': require('../../assets/content/quran/surah_88.txt'),
  'quran/surah_89': require('../../assets/content/quran/surah_89.txt'),
  'quran/surah_90': require('../../assets/content/quran/surah_90.txt'),
  'quran/surah_91': require('../../assets/content/quran/surah_91.txt'),
  'quran/surah_92': require('../../assets/content/quran/surah_92.txt'),
  'quran/surah_93': require('../../assets/content/quran/surah_93.txt'),
  'quran/surah_94': require('../../assets/content/quran/surah_94.txt'),
  'quran/surah_95': require('../../assets/content/quran/surah_95.txt'),
  'quran/surah_96': require('../../assets/content/quran/surah_96.txt'),
  'quran/surah_97': require('../../assets/content/quran/surah_97.txt'),
  'quran/surah_98': require('../../assets/content/quran/surah_98.txt'),
  'quran/surah_99': require('../../assets/content/quran/surah_99.txt'),
  'quran/surah_100': require('../../assets/content/quran/surah_100.txt'),
  'quran/surah_101': require('../../assets/content/quran/surah_101.txt'),
  'quran/surah_102': require('../../assets/content/quran/surah_102.txt'),
  'quran/surah_103': require('../../assets/content/quran/surah_103.txt'),
  'quran/surah_104': require('../../assets/content/quran/surah_104.txt'),
  'quran/surah_105': require('../../assets/content/quran/surah_105.txt'),
  'quran/surah_106': require('../../assets/content/quran/surah_106.txt'),
  'quran/surah_107': require('../../assets/content/quran/surah_107.txt'),
  'quran/surah_108': require('../../assets/content/quran/surah_108.txt'),
  'quran/surah_109': require('../../assets/content/quran/surah_109.txt'),
  'quran/surah_110': require('../../assets/content/quran/surah_110.txt'),
  'quran/surah_111': require('../../assets/content/quran/surah_111.txt'),
  'quran/surah_112': require('../../assets/content/quran/surah_112.txt'),
  'quran/surah_113': require('../../assets/content/quran/surah_113.txt'),
  'quran/surah_114': require('../../assets/content/quran/surah_114.txt'),
  'hadith/abudawud': require('../../assets/content/hadith/abudawud.txt.gz'),
  'hadith/ahmed': require('../../assets/content/hadith/ahmed.txt.gz'),
  'hadith/aladab_almufrad': require('../../assets/content/hadith/aladab_almufrad.txt.gz'),
  'hadith/buhari': require('../../assets/content/hadith/buhari.txt.gz'),
  'hadith/bulugh_almaram': require('../../assets/content/hadith/bulugh_almaram.txt.gz'),
  'hadith/darimi': require('../../assets/content/hadith/darimi.txt.gz'),
  'hadith/ibnmajah': require('../../assets/content/hadith/ibnmajah.txt.gz'),
  'hadith/malik': require('../../assets/content/hadith/malik.txt.gz'),
  'hadith/mishkat_almasabih': require('../../assets/content/hadith/mishkat_almasabih.txt.gz'),
  'hadith/muslim': require('../../assets/content/hadith/muslim.txt.gz'),
  'hadith/nasai': require('../../assets/content/hadith/nasai.txt.gz'),
  'hadith/nawawi40': require('../../assets/content/hadith/nawawi40.txt.gz'),
  'hadith/riyad_assalihin': require('../../assets/content/hadith/riyad_assalihin.txt.gz'),
  'hadith/shamail_muhammadiyah': require('../../assets/content/hadith/shamail_muhammadiyah.txt.gz'),
  'hadith/tirmidhi': require('../../assets/content/hadith/tirmidhi.txt.gz'),
  'hadith/meta_abudawud': require('../../assets/content/hadith/meta_abudawud.txt.gz'),
  'hadith/meta_ahmed': require('../../assets/content/hadith/meta_ahmed.txt.gz'),
  'hadith/meta_aladab_almufrad': require('../../assets/content/hadith/meta_aladab_almufrad.txt.gz'),
  'hadith/meta_buhari': require('../../assets/content/hadith/meta_buhari.txt.gz'),
  'hadith/meta_bulugh_almaram': require('../../assets/content/hadith/meta_bulugh_almaram.txt.gz'),
  'hadith/meta_darimi': require('../../assets/content/hadith/meta_darimi.txt.gz'),
  'hadith/meta_ibnmajah': require('../../assets/content/hadith/meta_ibnmajah.txt.gz'),
  'hadith/meta_malik': require('../../assets/content/hadith/meta_malik.txt.gz'),
  'hadith/meta_mishkat_almasabih': require('../../assets/content/hadith/meta_mishkat_almasabih.txt.gz'),
  'hadith/meta_muslim': require('../../assets/content/hadith/meta_muslim.txt.gz'),
  'hadith/meta_nasai': require('../../assets/content/hadith/meta_nasai.txt.gz'),
  'hadith/meta_riyad_assalihin': require('../../assets/content/hadith/meta_riyad_assalihin.txt.gz'),
  'hadith/meta_shamail_muhammadiyah': require('../../assets/content/hadith/meta_shamail_muhammadiyah.txt.gz'),
  'hadith/meta_tirmidhi': require('../../assets/content/hadith/meta_tirmidhi.txt.gz'),
  'islamic/dua': require('../../assets/content/islamic/dua.txt'),
  'islamic/names99': require('../../assets/content/islamic/99names.txt'),
  'islamic/seerah': require('../../assets/content/islamic/seera_events_en.txt'),
  'islamic/quiz': require('../../assets/content/islamic/quiz_questions.txt'),
} as Record<string, number>;

/* pass 33: the hadith books ship gzipped (87MB → 16MB — the workspace
 * outgrew its storage budget). Browsers unzip via DecompressionStream; on
 * native (future APK) a JS gunzip (pako) must be wired before the .txt.gz
 * assets are usable there. */
async function gunzipResponse(r: Response): Promise<string> {
  if (typeof DecompressionStream === 'undefined') throw new Error('content: DecompressionStream unavailable');
  const stream = r.body?.pipeThrough(new DecompressionStream('gzip'));
  if (!stream) throw new Error('content: no body to decompress');
  return await new Response(stream).text();
}

async function loadJSON<T>(key: string): Promise<T> {
  if (cache.has(key)) return cache.get(key) as T;
  const mod = modules[key];
  if (mod == null) throw new Error(`content: unknown key ${key}`);
  let text: string;
  if (Platform.OS !== 'web') {
    /* pass 34b — native (Expo Go): assets land as local files; Hermes has no
     * fetch(file://) nor DecompressionStream → read bytes via expo-file-system
     * and inflate the .gz packs with pako. */
    const a = Asset.fromModule(mod);
    await a.downloadAsync().catch(() => {});
    const local = (a as unknown as { localUri?: string }).localUri ?? (a as unknown as { uri: string }).uri;
    const buf = await new File(local.replace(/^file:\/\//, '')).arrayBuffer();
    const bytes = new Uint8Array(buf);
    text = utf8Decode(key.startsWith('hadith/') ? gunzipBytes(bytes) : bytes);
  } else {
    const a = Asset.fromModule(mod);
    await a.downloadAsync().catch(() => {});
    const url = (a as unknown as { uri?: string; localUri?: string }).localUri ?? (a as unknown as { uri: string }).uri;
    const r = await fetch(url);
    text = key.startsWith('hadith/') ? await gunzipResponse(r) : await r.text();
  }
  const data = JSON.parse(text) as T;
  cache.set(key, data);
  return data;
}

/* ---------- quran ---------- */
export type ContentAyah = { ayah: number; arabic: string; english: string; hausa: string };
export type SurahContent = { surah: number; hasBasmallah: boolean; basmallah: string; verses: ContentAyah[] };

export const loadSurah = (n: number) => loadJSON<SurahContent>(`quran/surah_${n}`);

/* ---------- hadith ---------- */
export type MetaChapter = { chapter_number: number; arabic: string; english: string; hadith_count: number };
export type BookMeta = { book: string; generated_at: string; chapters: MetaChapter[] };
export type ContentHadith = {
  collection: string;
  chapter_number: number;
  chapter_name: { id: number; bookId: number; arabic: string; english: string };
  hadith_number: number | null;
  arabic: string;
  english?: string;
  grade?: string;
};

export const loadBookMeta = (book: string) => loadJSON<BookMeta>(`hadith/meta_${book}`);
export const loadBook = (book: string) => loadJSON<ContentHadith[]>(`hadith/${book}`);

/* ---------- islamic ---------- */
/* real shape of the user's Hisn al-Muslim pack (pass 22): every part has
 * arabic + transliteration + translation + repeat + AUDIO (hisnmuslim https) */
export type ContentDuaText = {
  ID: number;
  ARABIC_TEXT: string;
  /** transliteration */
  LANGUAGE_ARABIC_TRANSLATED_TEXT?: string;
  /** translation */
  TRANSLATED_TEXT?: string;
  ENGLISH_TEXT?: string;
  TRANSLITERATION?: string;
  REPEAT?: number;
  AUDIO?: string;
};
export type ContentDua = { ID: number; TITLE: string; AUDIO_URL?: string; TEXT: ContentDuaText[] };
export type DuaPack = Record<string, ContentDua[]>;

export const loadDuas = () => loadJSON<DuaPack>('islamic/dua');
export const loadNames99 = () =>
  loadJSON<{ data: { names: Array<{ number: number; name: string; transliteration: string; translation: string; meaning: string; audio: string }> } }>('islamic/names99');
export const loadSeerah = () =>
  loadJSON<Array<{ event_id: number; title: string; hijri_year: string; gregorian_year: number; details: string }>>('islamic/seerah');
export const loadQuiz = () =>
  loadJSON<Array<{ question: string; options: string[]; correct: number; explanation?: string }>>('islamic/quiz');
