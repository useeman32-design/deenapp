import { align, bare, keepMarks } from './eng.mjs';
const run = (name, exp, spokenRaw, want) => {
  const toks = spokenRaw.split(/\s+/).filter(x => x.trim()).map(t => [bare(t), keepMarks(t)]).filter(([b]) => b.length > 0);
  const E = exp.split(/\s+/).map(bare);
  const EM = exp.split(/\s+/).map(keepMarks);
  const { states } = align(E, toks.map(t => t[0]), EM, toks.map(t => t[1]));
  const got = states.join(',');
  console.log((got === want ? 'PASS' : 'FAIL') + ` ${name}: ${got}`);
  return got === want;
};
let n = 0, p = 0;
const t = (name, exp, sp, want) => { n++; p += run(name, exp, sp, want); };
/* 1. correct recitation with full marks */
t('correct + full marks', 'قُلْ هُوَ اللَّهُ أَحَدٌ', 'قُلْ هُوَ اللَّهُ أَحَدٌ', 'ok,ok,ok,ok');
/* 2. wasl vowel slip aamanu→aaminu — must be WRONG */
t('aamanu→aaminu flagged', 'صَدَقُوا آمَنُوا', 'صَدَقُوا آمِنُوا', 'ok,wrong');
/* 3. kafaru→kufiru — must be WRONG */
t('kafaru→kufiru flagged', 'الَّذِينَ كَفَرُوا', 'الَّذِينَ كُفِرُوا', 'ok,wrong');
/* 4. rahim→malik substitution — letters differ, WRONG */
t('rahim→malik not ok (hidden → wrong at settle)', 'الرَّحِيمِ', 'الْمَلِكِ', 'hidden');
/* 5. unmarked transcript (no harakat) — lenient, letters ok */
t('unmarked lenient', 'قُلْ هُوَ اللَّهُ أَحَدٌ', 'قل هو الله احد', 'ok,ok,ok,ok');
/* 6. case-ending variation tolerated (final letter marks ignored) */
t('ending i\'rab ok', 'الْعَالَمِينَ', 'الْعَالَمِينُ', 'ok');
/* 7. partial marks: only one vocalized letter → no judgement */
t('single-mark lenient', 'الْحَمْدُ لِلَّهِ', 'الْحَمْدُ لله', 'ok,ok');
/* 8. skip-ahead: wrong word then correct next */
t('skip-ahead marks wrong', 'قُلْ هُوَ اللَّهُ أَحَدٌ', 'قُلْ اللَّهُ أَحَدٌ', 'ok,wrong,ok,ok');
console.log(`${p}/${n} engine unit tests passed`);
process.exit(p === n ? 0 : 1);
