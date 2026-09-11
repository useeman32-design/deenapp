import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import * as api from '@/api/client';
import type { Course } from '@/api/types';
import { T } from '@/components/T';
import { PageHero } from '@/components/PageHero';
import { ChevronRightIcon, GraduationCapIcon, StarIcon } from '@/components/Icons';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';
import { useDeenPoints } from '@/components/DeenPoints';
import type { ServerCourse } from '@/api/client';

/**
 * Islamic Courses & Lectures (pass 32): the course list opens a REAL learning
 * player — a curriculum of actual lessons (lecture/reading), a reader pane,
 * and per-course progress that persists. A COURSE is a sequence of lessons; a
 * single LECTURE is one lesson inside it.
 */

type Lesson = { title: string; minutes: number; kind: 'lecture' | 'reading'; body: string[] };

const CURRICULUM: Record<string, Lesson[]> = {
  'tajwid-essentials': [
    { title: 'Why Tajwid Matters', minutes: 6, kind: 'lecture', body: ['Tajwid is the discipline of reciting the Qur’an as it was revealed to the Prophet ﷺ and preserved by successive reciters.', 'Allah says: “…and recite the Qur’an with measured recitation.” (Al-Muzzammil 73:4)', 'In this course you will learn the articulation points (makhārij), the rules of noon sākinah and mīm sākinah, elongation (madd), and stopping (waqf).'] },
    { title: 'The Articulation Points (Makhārij)', minutes: 9, kind: 'lecture', body: ['The scholars define 17 articulation points. The tongue alone carries 10 of them — which is why precise recitation takes deliberate practice.', 'Practice tip: say ق then ك back to back. Both are produced deep in the throat-mouth region, but ق is the very root of the tongue and ك slightly forward.', 'Homework: recite Al-Fatiha slowly, naming the makhraj of every letter.'] },
    { title: 'Noon Sākinah & Tanwīn: Iẓhār', minutes: 7, kind: 'reading', body: ['When noon sākinah or tanwīn meets one of the six throat letters (ء ه ع ح غ خ), the noon is pronounced clearly without a nasal hold.', 'Example: مَنْ آمَنَ — the noon is declared, not merged.'] },
    { title: 'Idghām, Iqlāb & Ikhfā', minutes: 10, kind: 'lecture', body: ['Idghām: with ي ر م ل و ن the noon merges into the next letter — with غنة in ي م و ن, without it in ل ر.', 'Iqlāb: before ب the noon turns into a mīm sound. Ikhfā’: before the remaining 15 letters the noon is lightly hidden with a nasal trace.', 'Drill: al-Baqarah 1–5 contains every one of these cases — record yourself and compare with a reciter.'] },
    { title: 'Madd (Elongation) Rules', minutes: 8, kind: 'reading', body: ['Natural madd (two counts) occurs wherever a ḥarf madd follows a vowel. Connected and separated madd stretch 4–5 counts.', 'Necessary madd (6 counts) appears in like لَا أَعْبُدُ and the lām of نَصْتَفِهِ style words — hold it steady.'] },
    { title: 'Waqf (Stopping) & Continuation', minutes: 7, kind: 'lecture', body: ['Knowing where to stop preserves meaning. مْ full stop, ⌐ permissible, لا do not stop.', 'Never stop where the sentence splits a meaning that belongs together — e.g. inside إِنَّ اللَّهَ … statements.'] },
  ],
  'fiqh-worship': [
    { title: 'Purity: Wudū Step by Step', minutes: 9, kind: 'lecture', body: ['Wudū begins with intention and Allah’s name. Wash the hands, rinse the mouth and nose, wash the face, then the arms to the elbows, wipe the head and ears, and wash the feet to the ankles.', 'The Prophet ﷺ said: “No prayer is accepted without purification.” (Bukhari 135)', 'Nullifiers include using the toilet, deep sleep, and the exit of anything from the two passages.'] },
    { title: 'The Prayer’s Conditions & Times', minutes: 8, kind: 'reading', body: ['Five prayers, each with a window: Fajr from true dawn to sunrise; Dhuhr after zenith; Asr until the sun yellows; Maghrib until twilight fades; Isha until dawn.', 'Conditions: Islam, discernment, purity, covering the awrah, facing the qiblah, and entering the time.'] },
    { title: 'The Pillars of Salah', minutes: 11, kind: 'lecture', body: ['Standing in Fajr, the opening takbīr, reciting Al-Fatiha, rukūʿ, sujūd on seven bones, sitting between prostrations, tranquility in every posture, the final tashahhud and salām.', '“Pray as you have seen me praying.” (Bukhari 631)'] },
    { title: 'Sujūd as-Sahw & Common Mistakes', minutes: 7, kind: 'lecture', body: ['Forgetfulness prostrations repair added, omitted, or doubted acts. Two prostrations before the salām when a pillar was doubted after moving past it — otherwise after.', 'Common mistakes: rushing tranquility, reciting Fatiha inaudibly in audible prayers deliberately, and cutting the first taslīm short.'] },
    { title: 'Zakat: The Purifying Due', minutes: 9, kind: 'reading', body: ['2.5% of qualifying wealth held a lunar year at or above niṣāb (85g gold or equivalent). Recipients are the eight categories of At-Tawbah 9:60.', 'Zakat al-Fitr is due before the Eid prayer — a staple measure of food for every household member.'] },
    { title: 'Fasting Ramadan: Essentials', minutes: 8, kind: 'lecture', body: ['Intention the night before, abstention from dawn to sunset, and making up missed days. The fast is voided by eating, drinking, sexual relations, deliberate vomiting — sins of the tongue break its reward.', '“Whoever fasts Ramadan with faith and seeking reward, his previous sins are forgiven.” (Bukhari 38)'] },
  ],
  seerah: [
    { title: 'The World Before the Prophet ﷺ', minutes: 9, kind: 'lecture', body: ['Sixth-century Arabia: tribal honor, poetry, trade — and idols filling the Ka’bah. Yet monotheists remained: the ḥunafā’, seekers of the faith of Ibrāhīm.', 'Understanding pre-Islamic Arabia makes the revolution of Islam measurable.'] },
    { title: 'Birth, Childhood & Young Adulthood', minutes: 8, kind: 'reading', body: ['Born in the Year of the Elephant, orphaned early, raised by his uncle Abū Ṭālib, known as al-Amīn — the trustworthy — long before prophethood.', 'His marriage to Khadījah (RA) at 25 gave him stability and unwavering support.'] },
    { title: 'Revelation & the Makkan Years', minutes: 12, kind: 'lecture', body: ['Cave Ḥirā, Jibrīl’s first command: “Read.” Thirteen years of calling to tawḥīd, persecution, boycott, and the deaths of Khadījah and Abū Ṭālib — the Year of Sorrow.', 'The Night Journey (Isrā’ & Miʿrāj) comforted the Prophet ﷺ and gave the ummah the gift of the five daily prayers.'] },
    { title: 'Hijrah & the Madinan State', minutes: 11, kind: 'lecture', body: ['The migration to Yathrib renamed Madīnah. The Constitution of Madīnah bound Muslims, Jews, and tribes into one polity with the Prophet ﷺ as arbiter.', 'Brotherhood (mu’ākhāh) paired Muhājirūn with Anṣār — the most beautiful social experiment in history.'] },
    { title: 'Badr, Uhud & the Trench', minutes: 12, kind: 'lecture', body: ['Badr (2 AH): 313 believers against ~1,000 — decisive victory by Allah’s help. Uhud (3 AH): a lesson in obedience when archers left their post. The Trench (5 AH): patience under siege.', 'Each battle carried a moral the Qur’an etched permanently.'] },
    { title: 'The Conquest & the Farewell', minutes: 10, kind: 'lecture', body: ['Makkah opened in 8 AH without battle — a general amnesty. The Farewell Pilgrimage carried the final sermon: sanctity of life and property, women’s rights, brotherhood, and the Qur’an as the inheritance.', 'The Prophet ﷺ passed in 11 AH in Madīnah, leaving no dinar — only the deen.'] },
  ],

  /* ── pass 83-29 — ten professional-grade curricula (owner: "add 10
   * professional lectures and lessons and their quizzes") ── */
  'hadith-sciences': [
    { title: 'Why Hadith Science Exists', minutes: 9, kind: 'lecture', body: ['Within a century of the Prophet ﷺ, fabricated reports circulated for politics and piety alike. The ummah answered with the most rigorous verification system ever built: every report carries an isnad — a chain of named transmitters — examined for continuity AND integrity.', '“If it were not for isnad, whoever wished would have said whatever he wished.” (Ibn al-Mubarak)'] },
    { title: 'Isnad: Chains Under the Microscope', minutes: 11, kind: 'lecture', body: ['A chain is checked link by link: did transmitter A actually meet transmitter B? Did they live in the same city? Was A truthful (‘adl) and precise (dabt)? Muḥaddithūn wrote entire biographical dictionaries — the Tabaqāt — grading thousands of scholars.', 'Connected (muttaṣil) chains are the backbone of an acceptable report; a missing link anywhere weakens the whole.'] },
    { title: 'The Five canonical Grades', minutes: 10, kind: 'lecture', body: ['Ṣaḥīḥ: connected chain of upright, precise reporters with no irregularity or hidden defect. Ḥasan: same but with lighter precision. Ḍa‘īf: falls short in one or more conditions — not a “lie”, simply unreliable evidence. Gharīb (unusual chain) and muḍṭarib (conflicting chains) are technical defects, not insults.', 'Grading is about EVIDENCE quality — the matn is then checked against the Qur’an and established Sunnah.'] },
    { title: 'The Six Books & Their Imams', minutes: 8, kind: 'reading', body: ['al-Bukhārī (Ṣaḥīḥ, ~2,602 reports after repetition screening), Muslim (Ṣaḥīḥ, prized for chain weave), Abū Dāwūd (Sunan), Tirmidhī (Jāmi‘ with legal commentary), Nasā’ī, Ibn Mājah. Each applied his own acceptance bar.', '“Sahih International” style translations of al-Bukhārī carry the imam’s silent fiqh: he often titles the chapter before the hadith — read the titles.'] },
    { title: 'Using Graded Hadith Responsibly', minutes: 7, kind: 'reading', body: ['Practical rule of thumb for students: act on ṣaḥīḥ and ḥasan freely; learn the ḍa‘īf before acting on it; virtues-of-deeds (faḍā’il) enjoy extra leniency with scholars, law (aḥkām) does not.', 'Cite properly: collection + number. “Bukhari 1234” is scholarship; “I saw online” is not.'] },
  ],
  'ulum-quran': [
    { title: 'Revelation: Wahy & the 23 Years', minutes: 9, kind: 'lecture', body: ['The Qur’an descended over 23 years — Makkan verses building creed and character, Madinan verses building law and society. Scholars count ~86 Makkan and ~28 Madinan sūrahs by dominant theme.', 'Revelation responded to real events: “They ask you about wine and gambling…” — the Qur’an shepherded a living community.'] },
    { title: 'Preservation: Memory Meets Manuscript', minutes: 10, kind: 'lecture', body: ['Memorization (ḥifẓ) and writing ran in parallel from the first revelation; Zayd ibn Thābit compiled the muṣḥaf under Abū Bakr, and ‘Uthmān standardized the copies sent to the provinces.', 'Today’s evidence: carbon-dated Ṣan‘ā’ and Birmingham folia align with the received text; millions of ḥuffāẓ are a living chain of recitation.'] },
    { title: 'Asbāb al-Nuzūl: Context of Descent', minutes: 9, kind: 'lecture', body: ['“Occasions of revelation” record the questions and incidents behind specific verses — essential for honest interpretation. “Ask the People of the Reminder” was revealed about the People of the Book when the ahl al-ṣuffah could not recall details.', 'A verse keeps its general meaning even when revealed for one case — the scholars’ maxim: consideration is for the generality of the wording, not the specificity of the cause.'] },
    { title: 'Nāsikh & Mansūkh: Abrogation', minutes: 8, kind: 'reading', body: ['A handful of rulings were superseded in-law within the Prophet’s ﷺ lifetime — e.g. the qiblah, and the gradual replacement of the step-by-step approach to night prayer. Abrogation is legislative refinement, never contradiction of creed.', 'Recognized only by clear textual or consensus evidence — not by a reader’s discomfort with a verse.'] },
    { title: 'Tafsir: Method & Levels', minutes: 11, kind: 'lecture', body: ['Tafsir bil-māthūr (by transmission): Qur’an explains Qur’an, then Sunnah, then Companions — Ibn Jarīr al-Ṭabarī’s model. Tafsir bil-ra’y (by reasoned examination): linguistics, jurisprudence, theology — al-Rāzī, Ibn Kathīr’s synthesis.', 'The professional rule: interpret with knowledge, state your sources, and hold your opinion lightly where the salaf differed.'] },
  ],
  'arabic-grammar': [
    { title: 'The Sentence: Jumla Ismiyya & Fi‘liyya', minutes: 9, kind: 'lecture', body: ['Arabic sentences come in two builds: nominal (starts with a noun: al-baytu kabīr — “the house [is] big”, with its mubtada’ and khabar) and verbal (starts with a verb: kataba al-walad — “the boy wrote”, fi‘l + fā‘il).', 'No verb “to be” in the present — the nominal sentence carries it silently. This single fact explains half of Qur’anic style.'] },
    { title: 'I‘rāb: The Four Case Endings', minutes: 10, kind: 'lecture', body: ['Every word ends marked: marfū‘ (ḍamma — subject), manṣūb (fatḥa — object), majrūr (kasra — after preposition), majzūm (sukūn — jussive). The ending is the grammar; meaning rides on it.', '“Inna and its sisters” pull the mubtada’ into manṣūb; “kāna and its sisters” push the khabar into marfū‘ — memorize the two families as teams.'] },
    { title: 'Ṣarf: The Ten Forms', minutes: 12, kind: 'lecture', body: ['From the root ف ع ل the ten awzān generate meaning: fa‘ala (do), fa‘‘ala (intensify/repeat), fā‘ala (do together/reciprocate), af‘ala (cause), tafa‘‘ala (reflexive), tafā‘ala (pretend/make), infala‘a (receive the action), ifta‘ala (reach/acquire), if‘alla (become), istaf‘ala (seek).', 'Learn the patterns with one root each and you can parse thousands of derivatives on sight.'] },
    { title: 'Parsing Your First Āyah', minutes: 9, kind: 'reading', body: ['Take “al-ḥamdu lillāhi rabbil-‘ālamīn”: al-ḥamdu — marfū‘ mubtada’, khabar omitted (“is”); lillāhi — majrūr by lām; rabb — badal (substitute) of Allāh, majrūr. Every classical text yields to this patient dissection.', 'Daily drill: parse one āyah of Juz ‘Amma in writing; fluency arrives in weeks, not years.'] },
  ],
  'halal-finance': [
    { title: 'Riba: Why It Is Different', minutes: 10, kind: 'lecture', body: ['Riba — contractual, risk-free growth on money — is the Qur’an’s most emphatically forbidden economic act (“fight Allah and His Messenger”, al-Baqarah 2:279). Its harm: wealth concentrates, risk shifts to the weak, production decays into debt spirals.', 'Distinguish riba al-nasiyya (delay premium on loans) from riba al-faḍl (unlike-for-like exchange of ribawī commodities — gold, silver, dates, salt, wheat, barley).'] },
    { title: 'Halal Contracts 101', minutes: 10, kind: 'lecture', body: ['Trade (bay‘) is blessed because you accept risk (ghurm) before gain: murābaḥa (cost-plus disclosure), mushāraka (partnership), muḍāraba (capital + labor), ijāra (leasing with ownership transfer), salam (advance payment for future delivery), istisnā‘ (manufacture-to-order).', 'A contract is voided by gharar (material uncertainty) and maysir (pure chance) — the classical definitions map cleanly onto modern derivatives.'] },
    { title: 'Mortgages, Pensions & Interest Received', minutes: 11, kind: 'lecture', body: ['Mainstream fatwa bodies (AAOIFI, EFCB) permit structured home-purchase plans (diminishing mushāraka / ijāra wa-iqtinā’) while conventional interest mortgages remain impermissible — take the halal route even if slower. Interest RECEIVED: never keep or benefit — spend it on public welfare without expectation of reward.', 'Pensions and workplace schemes: default auto-enrolment is generally excused; opt into sharia funds where offered, and take scholarly advice for your exact case.'] },
    { title: 'Crypto, Stocks & Modern Instruments', minutes: 10, kind: 'reading', body: ['Stocks of compliant businesses: permitted by the majority with screening (debt/interest-income thresholds, purify small dividends). Crypto: scholars split — as an asset it is mubāḥ unless bought on leverage or pure speculation; treat it as high-risk māl, not a lottery ticket.', 'Rule of thumb: if the gain depends on someone else’s loss by design (options, CFDs, most “yield farming”), walk away.'] },
    { title: 'Zakat & Wealth Hygiene', minutes: 8, kind: 'reading', body: ['Zakat is 2.5% on the niṣāb held a lunar year — professional hygiene: a fixed zakat date, a written liability list, and automatic monthly transfers to verified recipients. Sadaqah on top is the growth strategy of the akhirah.', '“Wealth is not diminished by charity.” (Muslim 2588)'] },
  ],
  'muslim-family': [
    { title: 'Khitbah: The Honourable Pursuit', minutes: 8, kind: 'lecture', body: ['Courtship in Islam is a transparent, family-aware inquiry: see the candidate, ask the real questions (deen, character, life goals), and keep everything ḥalāl until the contract. “Announce this marriage” — no secret engagements.', 'A proposal may not be outbid while the first is still deciding (Bukhari 2135).'] },
    { title: 'The Nikah: Contract, Mahr & Witnesses', minutes: 10, kind: 'lecture', body: ['Four pillars: consent of both parties (the bride’s explicit agreement — silence itself is consent in the Hanafi school for adults), wali involvement, two witnesses, and mahr — her property, not a refundable deposit; the Sunnah made it easy to give, honourable to be generous.', 'Conditions written into the contract bind Allah’s name — e.g. “no relocation without her agreement” is enforceable.'] },
    { title: 'Rights & Duties: The Marriage Covenant', minutes: 10, kind: 'lecture', body: ['Mutual: kindness, fidelity, consultation. His: responsible leadership and provision. Hers: trustworthy stewardship of the home and his honour. “Live with them in kindness” (al-Nisa 4:19) is the covenant’s headline.', 'The Prophet ﷺ served his family, mended his own sandals, and never struck a servant or spouse — the sunnah is service, not supremacy.'] },
    { title: 'Conflict, Counsel & the Exit Ramp', minutes: 9, kind: 'reading', body: ['Disagreement is designed for: appoint arbiters from both families (al-Nisa 4:35) before fracture. Divorce (ṭalāq) is the permitted last resort — “the most hateful of permitted things” — with ‘iddah protecting reflection, reconciliation and dignity.', 'Khul‘ (her-initiated exit) returns the mahr when the marriage cannot continue — no one is imprisoned in a covenant broken beyond repair.'] },
  ],
  'dawah-skills': [
    { title: 'The Command & the Manner', minutes: 8, kind: 'lecture', body: ['“Invite to the way of your Lord with wisdom and beautiful preaching, and argue in the best manner” (al-Naḥl 16:125) — the job description: wisdom first, gentleness always. Mūsā was sent to the tyrant Fir‘awn with “speak to him gently”.', 'You are a witness, not a judge: “Upon you is only the message.”'] },
    { title: 'Listening Before Inviting', minutes: 9, kind: 'lecture', body: ['Professional da‘wah starts with diagnosis: what does this person already believe about God, purpose, suffering? The Qur’an models tailored openings — with the mushrikūn: “Say: who provides for you from the heavens?”, with the People of the Book: common-ground first.', 'Questions beat lectures; people rarely argue with their own answers.'] },
    { title: 'The Core Message in 5 Minutes', minutes: 8, kind: 'reading', body: ['Purpose (why are we here — adh-Dhāriyāt 51:56), accountability (every deed recorded), mercy (a way back, now), and the Messenger who proves both the warning and the mercy. Keep tawḥīd the headline; side issues are side issues.', 'Plant the seed, water over time: most hearts need several honest conversations, one friendly meal, and zero pressure.'] },
    { title: 'Answering the Hard Questions', minutes: 10, kind: 'reading', body: ['“Why suffering?”, “Women’s rights?”, “Violence?”, “Science?” — the professional move: acknowledge the weight, give the principled framework, then the evidence, then park the rest humbly. Never fabricate; “I will find out and return” raises your stock.', 'Keep a written bank of answers you have verified with scholars — improvisation under pressure is how myths spread.'] },
  ],
  'prophetic-productivity': [
    { title: 'Barakah: The Economics of Time', minutes: 8, kind: 'lecture', body: ['“By time — humanity is in loss, except those who believe, do righteous deeds, counsel truth and counsel patience” (al-‘Aṣr). The Muslim’s productivity theory: output is not hours logged but barakah multiplied — small, consistent, blessed work.', '“The most beloved deeds to Allah are the most constant, even if small.” (Bukhari 6464)'] },
    { title: 'Design Your Day Around Salah', minutes: 9, kind: 'lecture', body: ['Five fixed anchors beat one fuzzy schedule: plan Fajr-to-Dhuhr as your deep-work block (the Prophet ﷺ called the early morning blessed for the ummah), Dhuhr-to-‘Asr for collaboration, and the evening for family and review. Sleep early; the pre-dawn is for the heaviest lifting of the soul.', 'Calendar method: block around prayer times weekly, not around meetings first.'] },
    { title: 'Goals, Niyyah & Weekly Review', minutes: 8, kind: 'reading', body: ['Convert intentions into one page: 3 deen goals, 3 work goals, 2 body goals, 1 relationship goal — reviewed every Friday before Jumu‘ah. Niyyah is strategy, not sentiment: “actions are by intentions” is a prioritization algorithm.', 'Say no professionally: every yes spends your only non-renewable resource.'] },
    { title: 'Focus, Phone & the Nafs', minutes: 7, kind: 'reading', body: ['The nafs negotiates in notifications. Practical sunnah of focus: phone in another room (physical distance beats willpower), 50-minute blocks, water and wudu resets, and a written shutdown ritual ending with istighfār — the mind releases what is journaled.', 'Track one number per week (deep hours, Qur’an pages, workouts) — what is measured gets mercy.'] },
  ],
  'public-speaking': [
    { title: 'The Khateeb’s Blueprint', minutes: 9, kind: 'lecture', body: ['The Prophet ﷺ’s khutbah pattern: ta‘wīdh, praise, then a compact thesis with 2–3 proofs and a du‘ā. Modern translation: hook → one sentence thesis → three points with evidence → one action → closing du‘ā. Ten minutes beats forty.', '“Whoever prays our prayer and stands between our minbar and your graves… make your khutbah brief.”'] },
    { title: 'Voice, Body & Silence', minutes: 8, kind: 'lecture', body: ['Three professional levers: pace (slow 20% under pressure), pitch (drop at the end of sentences — credibility lives there), and pause (silence after a key line installs it in memory). Feet still, hands open, eyes on faces not phones.', 'Record yourself once — you will fix in a week what years of advice never touched.'] },
    { title: 'Structure You Can Reuse Forever', minutes: 8, kind: 'reading', body: ['SCQA: Situation → Complication → Question → Answer. Works for jumu‘ah, a class, a boardroom pitch or a wedding speech. Open with the audience’s pain, not your credentials.', 'One talk, one idea. Resist the second idea; it is what makes audiences remember none.'] },
    { title: 'Handling Nerves Like a Pro', minutes: 7, kind: 'reading', body: ['Nerves are energy, not error: breathe 4-7-8 before ascending, memorize only the first 30 seconds word-perfect, and walk in with the du‘ā of Mūsā: “rab-shraḥ lī ṣadrī…” Reps in low-stakes rooms (family halaqah) build the muscle.', 'Service mindset kills stage fright: you are delivering a need, not performing a self.'] },
  ],
  'teaching-islam': [
    { title: 'Tarbiyah Before Tadrīs', minutes: 8, kind: 'lecture', body: ['The goal is not content delivered but character grown: adab precedes knowledge — the ṣaḥābah learned ten verses, applied them, then moved on. Design every lesson around one change in the learner, not one chapter covered.', 'The Prophet ﷺ repeated a sentence three times for clarity — repetition with warmth, not coverage at speed.'] },
    { title: 'Lesson Design in 30 Minutes', minutes: 9, kind: 'lecture', body: ['Professional template: Hook (a question/story, 3 min), Input (the text, 10 min), Guided practice (pairs parse/discuss, 10 min), Output (learners teach it back, 5 min), Dhikr close (2 min). One objective per lesson, written on the board.', 'Plan the question before the answer: curiosity is the syllabus glue.'] },
    { title: 'Managing Real Classrooms', minutes: 9, kind: 'reading', body: ['Relationship first: learn names day one, greet at the door, catch students doing right. Rules few, visible, and enforced calmly — the teacher’s quiet consistency is the classroom’s weather. Parents as partners: a two-line weekly note prevents a two-hour conflict.', 'For mixed ages: tier tasks, not expectations.'] },
    { title: 'Assessment Without Fear', minutes: 7, kind: 'reading', body: ['Low-stakes, high-frequency: exit tickets (one question), oral spot-checks, and a “mushaf milestone” tracker for ḥifẓ. Praise publicly the effort, correct privately the error — the sunnah of Ibn ‘Umar’s teacher: never shame the learner.', 'End each term asking: did they love this subject more than when we began?'] },
  ],
  'study-research': [
    { title: 'How Memory Actually Works', minutes: 9, kind: 'lecture', body: ['Encoding → consolidation → retrieval: forgetting is the default, retrieval is the fix. Spaced repetition (day 1, 3, 7, 21) and active recall (closed-book self-testing) outperform re-reading by multiples in every controlled study.', 'The ḥuffāẓ system is applied cognitive science: daily ṣabḥ (new), taḥfīẓ (recent), murāja‘ah (old).'] },
    { title: 'Notes That Think', minutes: 8, kind: 'lecture', body: ['Cornell layout: cues left, notes right, summary bottom — then quiz from the cues. For texts: one margin question per page in your own words. A note you never revisit is a ritual, not a tool; schedule the weekly review slot.', 'Digital or paper? The one you actually re-opens.'] },
    { title: 'Research Like a Scholar', minutes: 10, kind: 'reading', body: ['Define the question narrowly (“What did al-Nawawī grade hadith X?” not “What is hadith?”). Sources primary first, then peer-reviewed commentary, then everything else. Capture citation at capture-time — collection, book, volume, page — future-you is a different researcher.', 'Steel-man the opposing view before drafting; your argument earns its strength there.'] },
    { title: 'Exam Strategy & Serenity', minutes: 7, kind: 'reading', body: ['Past papers over highlighted textbooks: the exam’s dialect is learned from exams. Timed practice weekly, sleep as revision (consolidation is nocturnal), and du‘ā before entering — “Allāhumma lā sahla illā mā ja‘altahu sahlā.”', 'Read every question twice; marks are lost in the first reading, not the last.'] },
  ],
  default: [
    { title: 'Welcome & How to Study', minutes: 5, kind: 'lecture', body: ['Set a fixed weekly time, study with a notebook, and close every session with a duʿā for beneficial knowledge.', '“Whoever travels a path seeking knowledge, Allah eases for him a path to Paradise.” (Muslim 2699)'] },
    { title: 'Foundations', minutes: 8, kind: 'reading', body: ['Every Islamic science begins with adab: sitting with intention, respecting the teacher, and verifying sources.', 'Knowledge worshiped for its own sake is pride; sought to act upon, it is light.'] },
    { title: 'Core Content', minutes: 10, kind: 'lecture', body: ['Work through the essential texts of this subject level by level — start with summarized classics before extended commentaries.', 'Write a five-line summary after each lesson; retention multiplies.'] },
    { title: 'Application & Practice', minutes: 7, kind: 'reading', body: ['Knowledge is only profit when it changes action. Choose one point from each lesson to implement within 48 hours.', 'The salaf said: knowledge calls to action; if answered it stays, otherwise it departs.'] },
    { title: 'Review & Assessment', minutes: 6, kind: 'lecture', body: ['Self-test: explain the lesson aloud in two minutes without notes — the Feynman test of understanding.', 'Return to previous lessons monthly; spaced review beats re-reading.'] },
  ],
};

const lessonsFor = (c: Course): Lesson[] => CURRICULUM[c.slug ?? ''] ?? CURRICULUM.default;

/* ── pass 42 — COURSE QUIZZES: 5 questions per curriculum. A quiz session is
 *   Q→A with instant feedback + explanation, then a score card; best score
 *   persists per course under dl.courses.quiz.v1. */
type QuizQ = { q: string; a: string[]; correct: number; why: string };
const QUIZZES: Record<string, QuizQ[]> = {
  'tajwid-essentials': [
    { q: 'How many articulation points (makhārij) do the scholars define?', a: ['10', '14', '17', '21'], correct: 2, why: '17 in total — and the tongue alone carries 10 of them.' },
    { q: 'Before which letter does noon sākinah turn into a mīm sound (iqlāb)?', a: ['ب', 'م', 'و', 'ن'], correct: 0, why: 'Iqlāb: before ب the noon is converted into a hidden mīm.' },
    { q: 'Iẓhār applies when noon sākinah meets…', a: ['the letters ي ر م ل و ن', 'the six throat letters', 'ب only', 'any letter'], correct: 1, why: 'With ء ه ع ح غ خ the noon is pronounced clearly, no nasal hold.' },
    { q: 'How long is the necessary madd (madd lāzim) held?', a: ['2 counts', '4 counts', '5 counts', '6 counts'], correct: 3, why: 'Necessary madd is held steady for six counts.' },
    { q: 'Idghām WITHOUT ghunnah occurs with which two letters?', a: ['ل ر', 'ي م', 'و ن', 'ب م'], correct: 0, why: 'ل and ر merge with no nasal trace; ي م و ن merge with ghunnah.' },
    { q: 'Which two letters always carry a ghunnah (nasalisation)?', a: ['ن and م', 'ب and ت', 'س and ش', 'ك and ل'], correct: 0, why: 'Noon and mīm are the letters of ghunnah — ikhfā and idghām bi-ghunnah lean on them.' },
    { q: 'Which group is the qalqalah (echo/bounce) group?', a: ['ق ط ب ج د', 'ي ر م ل و ن', 'ء ه ع ح غ خ', 'ص ض ط ظ'], correct: 0, why: 'Qāf, ṭāʾ, bāʾ, jīm, dāl — qūṭub-jad — bounce when sākin.' },
    { q: 'How many throat (ḥalqī) letters does iẓhār ḥalqī apply to?', a: ['Four', 'Six', 'Eight', 'Ten'], correct: 1, why: 'The six throat letters ء ه ع ح غ خ pronounce the noon sākinah clearly.' },
    { q: 'Ikhfā is pronounced with…', a: ['the noon fully clear', 'a hidden noon with a 2-count ghunnah', 'full merge into the next letter', 'a 6-count hold'], correct: 1, why: 'The noon disappears into a ghunnah held about two counts.' },
    { q: 'The word tajwīd itself means…', a: ['to recite quickly', 'to make beautiful / do well', 'to memorise', 'to translate'], correct: 1, why: 'From jawwada — to make good and beautiful: giving every letter its right.' },
  ],
  'fiqh-worship': [
    { q: 'What is the zakat rate on qualifying wealth?', a: ['1%', '2.5%', '5%', '10%'], correct: 1, why: '2.5% after a lunar year at or above niṣāb (85g gold or equivalent).' },
    { q: 'The window of which prayer ends when "the sun yellows"?', a: ['Dhuhr', 'Asr', 'Maghrib', 'Isha'], correct: 1, why: 'Asr lasts until the sun yellows and weakens.' },
    { q: 'Sujūd is made on how many bones (body parts)?', a: ['5', '6', '7', '8'], correct: 2, why: 'Seven: forehead+nose, two palms, two knees, two toes.' },
    { q: 'When is Zakat al-Fitr due?', a: ['any day of Ramadan', 'before the Eid prayer', 'on Eid day itself', 'at the next Ramadan'], correct: 1, why: 'A staple measure of food per household member, before the Eid prayer.' },
    { q: '"Whoever fasts Ramadan with faith and seeking reward…" — his previous sins are…', a: ['lightened', 'doubled in record', 'forgiven', 'awaited'], correct: 2, why: '…his previous sins are forgiven. (Bukhari 38)' },
    { q: 'How many rakʿahs are in the fard of Maghrib?', a: ['Two', 'Three', 'Four', 'Five'], correct: 1, why: 'Maghrib is three — the odd-shaped prayer at the day’s end.' },
    { q: 'Witr is…', a: ['obligatory like Fajr', 'an odd-numbered, emphasised sunnah', 'only in Ramadan', 'two rakʿahs exactly'], correct: 1, why: '“Allah is witr and loves witr” — the night ends with an odd number, commonly three.' },
    { q: 'How many fard prayers does each day hold?', a: ['Three', 'Four', 'Five', 'Six'], correct: 2, why: 'Fajr, Ẓuhr, ʿAṣr, Maghrib, ʿIshāʾ — the day’s five anchors.' },
    { q: 'Tayammum is made with…', a: ['any water found', 'clean earth/dust wiped on the face and hands', 'sand only in the desert', 'a wet cloth'], correct: 1, why: '“…then seek clean earth and wipe your faces and hands” (al-Māʾidah 5:6).' },
    { q: 'Jumuʿah replaces which daily prayer?', a: ['Fajr', 'ʿAṣr', 'Ẓuhr', 'ʿIshāʾ'], correct: 2, why: 'The Friday congregation stands in place of Ẓuhr on Friday.' },
  ],
  seerah: [
    { q: 'The Prophet ﷺ was born in…', a: ['the Year of the Elephant', 'the Year of Sorrow', 'the Year of the Trench', 'the Year of Delegation'], correct: 0, why: 'The Year the Elephant — Abrahah’s failed march on the Ka’bah.' },
    { q: 'How many believers fought at Badr?', a: ['313', '700', '1,000', '3,000'], correct: 0, why: '313 against roughly a thousand — victory by Allah’s help.' },
    { q: 'The "Year of Sorrow" marks the deaths of…', a: ['Hamzah & Ja’far', 'Khadījah & Abū Ṭālib', 'Umm Kulthūm & Ibrāhīm', 'ʿUthmān & ʿUmar'], correct: 1, why: 'Khadījah (RA) and his uncle Abū Ṭālib — the two great supports.' },
    { q: 'Which event gave the ummah the five daily prayers?', a: ['the Hijrah', 'Isrā’ & Miʿrāj', 'the Farewell Pilgrimage', 'the Conquest of Makkah'], correct: 1, why: 'The Night Journey — a gift from the fifty to the five.' },
    { q: 'Makkah was opened in which year?', a: ['6 AH', '8 AH', '10 AH', '11 AH'], correct: 1, why: '8 AH — bloodless, with a general amnesty.' },
  ],

  'hadith-sciences': [
    { q: 'What two qualities must every transmitter in a sahih chain possess?', a: ['Wealth and age', 'Uprightness (‘adl) and precision (dabt)', 'Travel and teachership', 'Poetry and lineage'], correct: 1, why: '‘Adl (integrity) + dabt (accuracy) are the twin pillars of acceptance.' },
    { q: 'A report with a missing link in its chain is classified as…', a: ['Munqaṭi‘ — disconnected', 'Mutawātir', 'Ṣaḥīḥ', 'Marfū‘'], correct: 0, why: 'A broken chain (munqaṭi‘/mursal in some usages) fails the connection condition.' },
    { q: 'Ḥasan differs from ṣaḥīḥ mainly in…', a: ['The topic', 'Reporter precision', 'Length', 'The city of origin'], correct: 1, why: 'ḥasan meets all conditions but with a lighter degree of precision (ṭabaqat al-mutaqaddimīn).' },
    { q: 'Which collection is prized for weaving multiple chains per report?', a: ['Sunan Ibn Mājah', 'Ṣaḥīḥ Muslim', 'Muwaṭṭa’', 'Musnad Aḥmad'], correct: 1, why: 'Muslim’s iṭrāf technique reinforces each matn with parallel chains.' },
    { q: 'A ḍa‘īf hadith is best described as…', a: ['A deliberate lie', 'A report whose chain or text fails one or more tests', 'A Qur’anic verse', 'A Companion’s opinion'], correct: 1, why: 'ḍa‘f = shortfall in the evidence conditions, not an accusation of lying.' },
    { q: 'The chain of narrators of a hadith is called the…', a: ['matn', 'isnād', 'tarjama', 'sharḥ'], correct: 1, why: 'Isnād = the chain; matn = the text itself.' },
    { q: 'A ṣaḥīḥ hadith requires an unbroken chain of…', a: ['any narrators', 'just and precise narrators', 'Qurashi narrators only', 'one city’s scholars'], correct: 1, why: 'ʿAdl (upright) and ḍābiṭ (precise) at every link, with no hidden defect.' },
    { q: 'Which book is called the most authentic book after the Book of Allah?', a: ['Ṣaḥīḥ Muslim', 'Muwaṭṭaʾ Mālik', 'Ṣaḥīḥ al-Bukhārī', 'Sunan Abū Dāwūd'], correct: 2, why: 'al-Bukhārī’s Ṣaḥīḥ holds that distinction in the ummah’s assessment.' },
    { q: 'Mutawātir is a hadith narrated by…', a: ['one Companion', 'two narrators per level', 'so many at every level that conspiracy is impossible', 'only hadith scholars'], correct: 2, why: 'Mass transmission yields certainty — the Qurʾān itself reaches us this way.' },
    { q: 'Ṣaḥīḥ Muslim is especially praised for…', a: ['the shortest chains only', 'connected chains and care over hidden defects (ʿilal)', 'containing only duʿā', 'ordering by narrator name'], correct: 1, why: 'Muslim’s ṣaḥīḥ is known for its pathways (ṭuruq) and ʿilal precision.' },
  ],
  'ulum-quran': [
    { q: 'Roughly how many years did the revelation span?', a: ['10', '13', '23', '40'], correct: 2, why: 'From Cave Ḥirā’ (610 CE) to the Farewell Pilgrimage (632 CE) — 23 years.' },
    { q: 'Who compiled the first muṣḥaf under Abū Bakr?', a: ['Umar ibn al-Khaṭṭāb', 'Zayd ibn Thābit', 'Ali ibn Abī Ṭālib', '‘Uthmān ibn ‘Affān'], correct: 1, why: 'Zayd led the committee that gathered the Qur’an shortly after Yamāmah.' },
    { q: 'Asbāb al-nuzūl studies…', a: ['Recitation melodies', 'The occasions behind verses', 'Manuscript inks', 'Verse counts'], correct: 1, why: 'Knowing the occasion guards interpretation against invention.' },
    { q: 'Naskh (abrogation) is valid only when…', a: ['A reader dislikes the earlier ruling', 'Clear textual or consensus evidence establishes it', 'Two verses differ in wording', 'A new century begins'], correct: 1, why: 'It is a legislative act fixed by evidence, not sentiment.' },
    { q: 'The first level of tafsir by transmission explains the Qur’an with…', a: ['Poetry first', 'Qur’an, then Sunnah, then Companions', 'Modern science', 'Personal dreams'], correct: 1, why: 'That hierarchy is the method of al-Ṭabarī and the muḥaddithūn.' },
    { q: 'Makkan sūrahs predominantly build…', a: ['civil law', 'creed, character and the hereafter', 'inheritance shares', 'treaty templates'], correct: 1, why: 'Early revelation centres on tawḥīd, purification and accountability; law grows in Madinah.' },
    { q: 'The longest sūrah of the Qurʾān is…', a: ['Āl ʿImrān', 'al-Baqarah', 'al-Nisāʾ', 'al-Anʿām'], correct: 1, why: 'al-Baqarah — and Satan flees a house where it is recited (Muslim 780).' },
    { q: 'Revelation began with…', a: ['al-Fātiḥah', 'al-ʿAlaq 1–5 — “Iqra”', 'al-Muddaththir', 'al-Fīl'], correct: 1, why: '“Read, in the name of your Lord…” — the first verses in the cave of Ḥirāʾ.' },
    { q: '“The seven oft-repeated” (al-sabʿ al-mathānī) is understood by many scholars to be…', a: ['al-Fātiḥah', 'the seven long sūrahs', 'the seven qirāʾāt', 'seven takbīrs'], correct: 0, why: 'A well-known interpretation identifies it with the Opening — repeated in every rakʿah.' },
    { q: 'The Qurʾān began descending in the month of…', a: ['Rajab', 'Shaʿbān', 'Ramaḍān', 'Shawwāl'], correct: 2, why: '“The month of Ramaḍān in which the Qurʾān was sent down” (al-Baqarah 2:185).' },
  ],
  'arabic-grammar': [
    { q: '“Al-baytu kabīrun” is which sentence type?', a: ['Fi‘liyya', 'Ismiyya', 'Shartiyya', 'Amriyya'], correct: 1, why: 'Nominal: mubtada’ (al-baytu) + khabar (kabīrun).' },
    { q: 'The manṣūb case ending is…', a: ['Ḍamma', 'Fatḥa', 'Kasra', 'Sukūn'], correct: 1, why: 'Objects (maf‘ūl bih) and adverbs take fatḥa.' },
    { q: '“Inna and its sisters” do what to the mubtada’?', a: ['Make it majrūr', 'Make it manṣūb (ism inna)', 'Delete it', 'Make it marfū‘'], correct: 1, why: 'Inna changes the case to fatḥa and is called ismuhā.' },
    { q: 'Form فاعل (fā‘ala) most often adds the meaning of…', a: ['Seeking', 'Doing together / reciprocating', 'Becoming', 'Intensifying'], correct: 1, why: 'kātaba = correspond (write to each other); musāraha = greet one another.' },
    { q: '“Lillāhi” in “al-ḥamdu lillāhi” is…', a: ['Marfū‘', 'Manṣūb', 'Majrūr', 'Majzūm'], correct: 2, why: 'The lām of possession jarrs the noun — kasrah.' },
    { q: 'In “kataba al-waladu”, al-waladu is…', a: ['the object (mafʿūl)', 'the doer (fāʿil), marfūʿ', 'a prepositional attachment', 'an adjective'], correct: 1, why: 'Verbal sentences open with the verb; the fāʿil follows in the rafʿ case.' },
    { q: 'A preposition (ḥarf jarr) drops its noun into…', a: ['rafʿ (ḍamma)', 'naṣb (fatḥa)', 'jarr (kasra)', 'jazm (sukūn)'], correct: 2, why: 'Min, ilā, ʿan, ʿalā, fī… each pulls its noun into majrūr.' },
    { q: '“Inna and its sisters” turn the mubtadaʾ into…', a: ['marfūʿ', 'manṣūb', 'majrūr', 'majzūm'], correct: 1, why: 'Inna emphasises and pulls the subject to naṣb; the khabar stays marfūʿ.' },
    { q: 'The sound masculine dual in rafʿ ends with…', a: ['a wāw', 'alif-nūn', 'yāʾ-nūn', 'tāʾ'], correct: 1, why: 'Two students = ṭālibāni in rafʿ; ṭālibayni in naṣb/jarr.' },
    { q: 'The root letters of kitāb are…', a: ['ك ت ب', 'ك ت ا', 'ب ت ك', 'ك س ب'], correct: 0, why: 'Kāf-tāʾ-bāʾ generates kataba, maktab, maktabah, kātib…' },
  ],
  'halal-finance': [
    { q: 'The zakat rate on qualifying held wealth is…', a: ['1%', '2.5%', '5%', '10%'], correct: 1, why: '2.5% after one lunar year at or above niṣāb.' },
    { q: 'Riba al-faḍl concerns…', a: ['Delay in repayment', 'Unequal exchange of ribawī commodities', 'Renting homes', 'Partnership profits'], correct: 1, why: 'Like-for-like, hand-to-hand in ribawī items (gold, silver, six foods).' },
    { q: 'A cost-plus disclosed resale contract is called…', a: ['Ijāra', 'Murābaḥa', 'Salam', 'Muḍāraba'], correct: 1, why: 'The seller discloses cost and marks up transparently.' },
    { q: 'Interest received by mistake should be…', a: ['Kept as income', 'Donated to public welfare without reward expectation', 'Returned to the bank manager', 'Used for private gifts'], correct: 1, why: 'Purify it out of your wealth; do not benefit personally.' },
    { q: 'A contract voided by material uncertainty is called…', a: ['Gharar', 'Rahn', 'Hawāla', 'Wakāla'], correct: 0, why: 'Gharar (excessive uncertainty) invalidates the exchange.' },
    { q: 'Swapping 12g of gold for 15g of gold on the spot is…', a: ['a profitable trade', 'ribā al-faḍl — impermissible', 'permitted with a witness', 'only discouraged'], correct: 1, why: 'Same commodity, unequal amounts, same sitting — the classic ribā al-faḍl case.' },
    { q: 'Gharar in a contract means…', a: ['hidden profit', 'material uncertainty', 'late delivery', 'foreign currency'], correct: 1, why: 'The Prophet ﷺ forbade the sale of al-gharar — subject unclear or not in the seller’s control.' },
    { q: 'Murābaḥah is…', a: ['a partnership in labour', 'a cost-plus sale with honest disclosure', 'a gift loan', 'an insurance pool'], correct: 1, why: 'The seller states cost and mark-up; no deception, no compounding.' },
    { q: 'IJārah differs from a conventional lease chiefly in that…', a: ['no rent is charged', 'it can end in ownership transfer and the lessor carries asset risk', 'rent compounds monthly', 'it needs no contract'], correct: 1, why: 'Ijāra wa-iqtināʾ paths rent toward ownership while risk stays with the owner.' },
    { q: 'Interest received by mistake must be…', a: ['kept as luck', 'spent on public welfare without seeking reward', 'returned to the bank', 'reinvested'], correct: 1, why: 'Never benefit from it personally — dispose of it in charity, without expecting ajr.' },
  ],
  'muslim-family': [
    { q: 'Which of these is a pillar of the nikah contract?', a: ['A wedding feast', 'Two witnesses', 'Matching outfits', 'A wali’s speech length'], correct: 1, why: 'Consent, wali, witnesses and mahr are the classical pillars/conditions.' },
    { q: 'The mahr belongs to…', a: ['The groom’s family', 'The bride', 'The couple jointly', 'The imam'], correct: 1, why: 'It is her exclusive property, given before or after consummation.' },
    { q: 'When two proposals arrive, the Sunnah is…', a: ['Highest bidder wins', 'The first proposal decides before a second is accepted', 'Lottery', 'The imam chooses'], correct: 1, why: 'Do not propose over a brother’s proposal until he withdraws or permits (Bukhari 2135).' },
    { q: 'Before fracture, al-Nisa 4:35 prescribes…', a: ['Immediate divorce', 'Arbiters from both families', 'Silence for a year', 'Community vote'], correct: 1, why: 'A ḥakam from each side to seek reconciliation.' },
    { q: 'Khul‘ means…', a: ['A groom’s gift', 'Her-initiated dissolution, usually returning the mahr', 'A second wife', 'The wedding sermon'], correct: 1, why: 'It ends the marriage when continuation harms the spouses.' },
    { q: 'The mahr belongs to…', a: ['the couple jointly', 'the wife', 'the bride’s wali', 'the masjid'], correct: 1, why: 'Her exclusive property — “give them their mahr in kindness” (al-Nisāʾ 4:4).' },
    { q: 'A nikāḥ requires at minimum…', a: ['one witness', 'two witnesses', 'four witnesses', 'a qāḍī'], correct: 1, why: 'Two witnesses for the contract — “when you contract a marriage…”.' },
    { q: 'Ṭalāq is described as…', a: ['the first resort', 'neutral', 'the most hateful of permitted things', 'forbidden outright'], correct: 2, why: 'Lawful as a last resort when repair fails — never a first weapon.' },
    { q: 'The ʿiddah after a revocable ṭalāq (non-pregnant wife) is…', a: ['one month', 'three menstrual cycles', 'four months and ten days', 'one year'], correct: 1, why: '“…divorced women wait three qurūʾ” (al-Baqarah 2:228) — room to reflect and return.' },
    { q: 'While a proposal is still being considered, another man may…', a: ['outbid it', 'not propose on the same terms until it is declined', 'propose secretly', 'send gifts to sway her'], correct: 1, why: '“Do not propose over the proposal of your brother” (Bukhārī 2135).' },
  ],
  'dawah-skills': [
    { q: 'The da‘wah job description of al-Naḥl 16:125 is…', a: ['Debate to win', 'Wisdom, beautiful preaching, best-mannered argument', 'Silent example only', 'Punishment'], correct: 1, why: 'Ḥikmah, ḥusnat al-maw‘iẓah, mujādalah bil-latī hiya aḥsan.' },
    { q: 'Allah told Mūsā to speak to Fir‘awn…', a: ['With proof texts', 'Gently', 'Through signs only', 'Via a letter'], correct: 1, why: '“Qūlā lahu qawlan layyinā” (Ṭāhā 20:44) — even to the tyrant.' },
    { q: 'The most professional opening with a stranger is…', a: ['Their sins', 'Their existing beliefs and questions', 'Your biography', 'Church history'], correct: 1, why: 'Diagnose before prescribing — the Qur’anic model with every audience.' },
    { q: 'When you do not know an answer you should…', a: ['Improvise confidently', 'Promise to verify and return', 'Change topic', 'Quote a rumour'], correct: 1, why: 'Honesty preserves trust — and your own credibility.' },
    { q: 'The headline of every da‘wah conversation is…', a: ['Politics', 'Tawḥīd', 'Fiqh differences', 'End-times signs'], correct: 1, why: 'Every prophet began with worship Allah alone.' },
    { q: '“Speak to him gently” (Ṭā-Hā 20:44) was the instruction to Mūsā about…', a: ['Banū Isrāʾīl', 'Firʿawn', 'his brother Hārūn', 'the magicians'], correct: 1, why: 'Even the tyrant was addressed softly — gentleness is strategy, not weakness.' },
    { q: 'The headline of every daʿwah conversation is…', a: ['politics', 'tawḥīd', 'fiqh differences', 'history'], correct: 1, why: 'Keep the main thing the main thing: pure worship of Allah alone.' },
    { q: 'When asked something you cannot answer, the professional move is…', a: ['improvise confidently', 'say “I will find out and come back”', 'change the topic', 'quote without a source'], correct: 1, why: 'Honesty raises your stock; fabrication spreads myths in your name.' },
    { q: '“Upon you is only the message” (ar-Raʿd 13:40) teaches the dāʿī to…', a: ['deliver and leave results to Allah', 'argue until agreement', 'count conversions', 'avoid questions'], correct: 0, why: 'Guidance is Allah’s act; your role is faithful, gentle delivery.' },
    { q: 'The Qurʾān’s model openings with strangers usually begin with…', a: ['common ground and questions', 'condemnation', 'genealogy', 'warnings only'], correct: 0, why: '“Who provides for you from the heavens?” — questions people answer for themselves.' },
  ],
  'prophetic-productivity': [
    { q: 'Sūrat al-‘Aṣr’s exception clause lists…', a: ['Faith, righteous deeds, truth, patience', 'Sleep, food, exercise', 'Wealth, health, fame', 'Travel, trade, rest'], correct: 0, why: 'Īmān, ṣāliḥāt, mutual counsel of ḥaqq and ṣabr.' },
    { q: '“The most beloved deeds to Allah are…”', a: ['The largest projects', 'The most constant, even if small', 'The most public', 'The most expensive'], correct: 1, why: 'Bukhari 6464 — consistency is the strategy.' },
    { q: 'The deep-work block the Sunnah honours most is…', a: ['After Isha', 'Early morning (Fajr onward)', 'Mid-afternoon', 'Late night shopping'], correct: 1, why: '“Allah bless my ummah in its early morning.” (Tirmidhi 1212)' },
    { q: '“Actions are by intentions” functions as…', a: ['A creed only', 'A prioritization algorithm', 'A poem', 'A fast-breaking rule'], correct: 1, why: 'Bukhari 1 — it orders your goals by why.' },
    { q: 'The professional defence against notifications is…', a: ['Stronger willpower', 'Physical distance from the phone', 'Louder ringtones', 'More apps'], correct: 1, why: 'Environment design beats self-control.' },
    { q: '“The most beloved deeds to Allah are…”', a: ['the largest projects', 'the most constant, even if small', 'the ones done in Ramadan', 'only the hidden ones'], correct: 1, why: 'Consistency outperforms intensity — the engine of barakah (Bukhārī 6464).' },
    { q: '“Actions are but by intentions” opens which collection?', a: ['Muslim', 'Bukhārī — narrated by ʿUmar', 'Abū Dāwūd', 'Ibn Mājah'], correct: 1, why: 'Hadith #1 of al-Bukhārī — the ummah’s prioritisation algorithm.' },
    { q: 'The lesson’s weekly review lands on…', a: ['Sunday night', 'Friday, before Jumuʿah', 'the new month', 'any Monday'], correct: 1, why: 'Jumuʿah is the ummah’s built-in weekly reset.' },
    { q: 'Sūrat al-ʿAṣr names the escape from loss as…', a: ['wealth and status', 'belief, righteous deeds, counselling truth and patience', 'knowledge alone', 'seclusion'], correct: 1, why: 'Four traits, one guarantee: “except those who believe and do righteous deeds…”' },
    { q: '“Allah made the early hours blessed for my ummah” guides us to…', a: ['skip breakfast', 'put deep work in the morning', 'work nights only', 'avoid planning'], correct: 1, why: 'Fajr-to-Ẓuhr is the day’s prime block — guard it for what matters most.' },
  ],
  'public-speaking': [
    { q: 'The Prophet’s ﷺ khutbah pattern is best summarized as…', a: ['Long stories', 'Compact: praise, thesis, proofs, action, du‘ā', 'Q&A only', 'Poetry'], correct: 1, why: 'He ﷺ spoke with precision and brevity that could be counted.' },
    { q: 'Where does credibility live in the voice?', a: ['Falling pitch at sentence ends', 'Loudest volume', 'Highest pitch', 'Fastest pace'], correct: 0, why: 'Downward completion signals certainty.' },
    { q: 'SCQA stands for…', a: ['Situation, Complication, Question, Answer', 'Speech, Clap, Quote, Applause', 'Story, Claim, Joke, Ask', 'Style, Content, Quality, Audience'], correct: 0, why: 'Minto’s structure — a reusable skeleton for any talk.' },
    { q: 'A pause after a key line…', a: ['Shows forgetfulness', 'Installs the line in memory', 'Must be avoided', 'Wastes time only'], correct: 1, why: 'Silence is the speaker’s highlighter.' },
    { q: 'Best practice for nerves before ascending?', a: ['Suppress all feeling', 'Breathing drills + memorized opening + du‘ā of Mūsā', 'Caffeine', 'Rehearsing the whole talk again'], correct: 1, why: 'Rabbi-shraḥ lī ṣadrī — Ṭāhā 20:25–28.' },
    { q: 'The Sunnah’s guidance on khutbah length is…', a: ['the longer the better', 'make it brief and heartfelt', 'exactly 40 minutes', 'there is none'], correct: 1, why: 'The Prophet ﷺ kept prayers short and khutbahs compact — “…make your khutbah brief”.' },
    { q: 'SCQA stands for…', a: ['Story, Claim, Quote, Appeal', 'Situation, Complication, Question, Answer', 'Summary, Conclusion, Query, Action', 'Style, Content, Quality, Audience'], correct: 1, why: 'Open with the audience’s reality, name the tension, ask the question, deliver the answer.' },
    { q: 'The most powerful place for a pause is…', a: ['before you start', 'right after a key line', 'during transitions only', 'at the very end only'], correct: 1, why: 'Silence after the point installs it in memory.' },
    { q: 'Stage nerves are best treated as…', a: ['a defect to hide', 'energy to direct', 'a reason to avoid speaking', 'purely physical'], correct: 1, why: 'Reframed arousal sharpens delivery — breathe, own the first 30 seconds, serve.' },
    { q: 'Mūsā’s duʿā before facing Firʿawn was…', a: ['“Rabbi-shraḥ lī ṣadrī…”', '“Rabbanā ātinā…”', '“Ḥasbunā Allāh…”', '“Allāhumma innaka ʿafuww…”'], correct: 0, why: 'Ṭā-Hā 25–28: widen my chest, ease my task, loosen my tongue.' },
  ],
  'teaching-islam': [
    { q: 'The salaf’s method of learning verses was…', a: ['Ten verses, learn AND act, then continue', 'Whole Qur’an in a week', 'Memorize tafsir first', 'Listen only'], correct: 0, why: '‘Abdullāh ibn Mas‘ūd: “knowledge of the Qur’an came with practice”.' },
    { q: 'A professional lesson plan starts from…', a: ['The textbook page', 'One behavioural objective', 'The whiteboard colour', 'Homework'], correct: 1, why: 'Design the change in the learner, then pick content.' },
    { q: 'The Prophet ﷺ repeated sentences…', a: ['Once', 'Three times for clarity', 'Never', 'Until asked'], correct: 1, why: 'Bukhari 95 — repetition with warmth.' },
    { q: 'Classroom management rests on…', a: ['Loudest voice', 'Calm consistency and relationship', 'Surprise tests', 'No rules'], correct: 1, why: 'The teacher’s constancy is the classroom’s weather.' },
    { q: 'For mixed-ability rooms, tier the…', a: ['Expectations', 'Tasks', 'Attendance', 'Seating only'], correct: 1, why: 'Every learner meets the same objective at reachable steps.' },
    { q: 'The ṣaḥābah’s study rhythm was…', a: ['the whole Qurʾān at once', 'ten verses — learn, apply, then move on', 'one sūrah per year', 'listening only'], correct: 1, why: 'Depth before coverage — knowledge that is lived, not just heard.' },
    { q: 'The Prophet ﷺ would repeat an important sentence…', a: ['once', 'three times', 'seven times', 'never'], correct: 1, why: 'Repetition with warmth — clarity is the teacher’s duty.' },
    { q: 'A well-designed lesson has…', a: ['as many objectives as possible', 'one clear objective', 'no objectives', 'only revision'], correct: 1, why: 'One change in the learner per lesson — written on the board.' },
    { q: 'The Sunnah of correction is…', a: ['correct publicly to warn others', 'praise in public, correct in private', 'never correct', 'grade harshly'], correct: 1, why: 'Dignity preserved keeps the heart teachable.' },
    { q: 'An “exit ticket” is…', a: ['a permission slip', 'a one-question low-stakes check at the end', 'a punishment', 'an attendance sheet'], correct: 1, why: 'High-frequency, low-stakes checks beat exam fear.' },
  ],
  'study-research': [
    { q: 'The most evidence-backed study technique is…', a: ['Re-reading', 'Highlighting', 'Active recall with spaced repetition', 'Listening to lectures twice'], correct: 2, why: 'Retrieval practice + spacing dominate the literature.' },
    { q: 'The Cornell note layout includes…', a: ['Cues, notes, summary', 'Drawings only', 'One giant paragraph', 'Colour codes only'], correct: 0, why: 'Left cues quiz the right-side notes; bottom summarizes.' },
    { q: 'Primary sources should be consulted…', a: ['Last', 'First, before commentary', 'Never', 'Only online'], correct: 1, why: 'Commentary interprets the primary; it never replaces it.' },
    { q: 'Citation details should be captured…', a: ['At writing time', 'At capture time', 'At submission', 'Never'], correct: 1, why: 'Future-you cannot reconstruct the page number.' },
    { q: 'Consolidation of memory happens largely…', a: ['While napping in class', 'During sleep', 'While eating', 'During exercise only'], correct: 1, why: 'Sleep is revision — protect it before exams.' },
    { q: 'Which beats re-reading in controlled studies?', a: ['highlighting', 'active recall (closed-book self-testing)', 'copying notes', 'listening twice'], correct: 1, why: 'Retrieval strengthens memory; recognition feels easy and teaches little.' },
    { q: 'A classic spaced-repetition ladder is…', a: ['day 1, 3, 7, 21', 'hourly', 'only before exams', 'once ever'], correct: 0, why: 'Review at expanding intervals — the ḥifẓ system in cognitive-science clothing.' },
    { q: 'The Cornell cue column exists to…', a: ['store dates', 'quiz yourself from', 'record grades', 'summarise the teacher'], correct: 1, why: 'Cover the notes, answer the cues — the page becomes a test bank.' },
    { q: 'Citations should be captured…', a: ['at writing time', 'at capture time', 'never', 'only for books'], correct: 1, why: 'Future-you is a different researcher — volume/page at the moment of saving.' },
    { q: 'The fastest way to learn an exam’s “dialect” is…', a: ['reading the textbook again', 'past papers under time', 'group discussion only', 'highlighting'], correct: 1, why: 'Timed past-paper practice trains format, pacing and the marking scheme.' },
  ],
  default: [
    { q: 'Every Islamic science begins with…', a: ['memorisation', 'adab', 'debate', 'isnad drawing'], correct: 1, why: 'Adab: intention, respect for the teacher, verified sources.' },
    { q: 'The Prophet ﷺ said whoever travels a path seeking knowledge, Allah eases for him a path to…', a: ['provision', 'Paradise', 'forgiveness', 'honour'], correct: 1, why: '…a path to Paradise. (Muslim 2699)' },
    { q: 'Which study habit multiplies retention, per the course?', a: ['re-reading ten times', 'a five-line summary after each lesson', 'listening while walking', 'group chats'], correct: 1, why: 'Write five lines after each lesson — retrieval beats re-reading.' },
    { q: 'The salaf said knowledge calls to…', a: ['authority', 'action', 'wealth', 'fame'], correct: 1, why: 'It calls to action; if answered it stays, otherwise it departs.' },
    { q: 'The "Feynman test" of understanding is to…', a: ['read aloud fast', 'explain it in two minutes without notes', 'memorise the headings', 'teach only seniors'], correct: 1, why: 'Explain the lesson aloud in two minutes, notes closed.' },
    { q: 'Every study session should close with…', a: ['a snack', 'a duʿā for beneficial knowledge', 'a new topic', 'social media'], correct: 1, why: 'The course opens and closes with duʿā — barakah is the method.' },
    { q: 'Before extended commentaries, start with…', a: ['summarized classics', 'the hardest book', 'translator prefaces only', 'podcasts'], correct: 0, why: 'Level by level: summaries first, then the extended texts.' },
    { q: 'Knowledge sought for its own sake becomes…', a: ['pride — sought to act upon, it is light', 'wealth', 'fame', 'nothing'], correct: 0, why: 'The adab of knowledge: it is a lamp, not a trophy.' },
    { q: 'Choose one point from each lesson and implement it within…', a: ['48 hours', 'a semester', 'never', 'Ramadan only'], correct: 0, why: 'Knowledge profits by action — 48 hours keeps the nafs honest.' },
    { q: 'Monthly review of previous lessons beats…', a: ['reading them once and moving on', 'teaching others', 'taking notes', 'listening'], correct: 0, why: 'Spaced review — the sunnah of the huffāẓ and of cognitive science.' },
  ],
};
/* pass 72 — server course → player lessons (flattened across modules) */
const stripHtml = (h: string) =>
  h.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n').trim();
const serverLessons = (sc: ServerCourse): Lesson[] =>
  ((sc.modules ?? []).flatMap((m) => (m.lessons ?? []).map((l) => ({
    title: l.title,
    minutes: parseInt(String(l.duration_label ?? ''), 10) || 4,
    kind: (l.video_url || l.lesson_type === 'video' ? 'lecture' : 'reading') as Lesson['kind'],
    body: stripHtml(String(l.content_html ?? '')).split(/\n{2,}/).filter(Boolean),
  })))) as Lesson[];
const serverLessonIds = (sc: ServerCourse): number[] =>
  (sc.modules ?? []).flatMap((m) => (m.lessons ?? []).map((l) => l.id));

const quizFor = (c: Course): QuizQ[] => QUIZZES[c.slug ?? ''] ?? QUIZZES.default;

export default function Courses() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [courses, setCourses] = useState<Course[]>([]);
  const [tab, setTab] = useState('All');
  const [openCourse, setOpenCourse] = useState<Course | null>(null);
  /* per-course progress: { [courseId]: number[] (completed lesson indexes) } */
  const [progress, setProgress] = useState<Record<string, number[]>>({});

  /* pass 72 — live course detail (modules, access, certificates) */
  const dp = useDeenPoints();
  const [serverCourse, setServerCourse] = useState<ServerCourse | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.courses()
      .then((c) => { setCourses(c); })
      .finally(() => setLoading(false));
    storage.getItem('dl.courses.progress.v1').then((r) => {
      try { setProgress(JSON.parse(r ?? '{}')); } catch {}
    }).catch(() => {});
  }, []);

  const openCourseCta = (c: Course) => {
    haptic.selection();
    setServerCourse(null);
    setOpenCourse(c);
    if (!api.isLive()) return;
    void api.courseGet(c.id).then((sc) => {
      if (!sc) return;
      setServerCourse(sc);
      if (sc.user_state && sc.user_state.is_enrolled === false) {
        void api.courseEnroll(c.id).then((e) => { if (e) setServerCourse(e); });
      }
    });
  };

  const doUnlock = () => {
    if (!serverCourse) return;
    setUnlocking(true);
    void api.courseUnlockPoints(serverCourse.id).then((res) => {
      setUnlocking(false);
      if (!res.ok) { Alert.alert('Could not unlock', res.message ?? 'Try again in a moment.'); return; }
      if (res.balance != null) void dp.sync(res.balance);
      const cid = serverCourse.id;
      void api.courseGet(cid).then((sc) => {
        if (!sc) return;
        setServerCourse(sc);
        if (sc.user_state && sc.user_state.is_enrolled === false) {
          void api.courseEnroll(cid).then((e) => { if (e) setServerCourse(e); });
        }
      });
    });
  };

  const toggleDone = (courseId: number, li: number) => {
    haptic.light();
    let nextCount = 0;
    setProgress((prev) => {
      const cur = prev[courseId] ?? [];
      const next = cur.includes(li) ? cur.filter((x) => x !== li) : [...cur, li];
      nextCount = next.length;
      const out = { ...prev, [courseId]: next };
      storage.setItem('dl.courses.progress.v1', JSON.stringify(out)).catch(() => {});
      return out;
    });
    /* pass 72 — record the completion on the server too (certificate engine) */
    if (api.isLive() && serverCourse && serverCourse.id === courseId) {
      const lid = serverLessonIds(serverCourse)[li];
      if (lid != null) {
        void api.courseCompleteLesson(courseId, lid).then((res) => {
          if (!res.ok) return;
          const cert = res.certificate as { certificate_no?: string; verification_code?: string } | null;
          const code = cert?.verification_code ?? cert?.certificate_no;
          const total = serverLessonIds(serverCourse).length;
          if (code && nextCount >= total) {
            Alert.alert('Certificate earned 🎓', `Your certificate no. is ${cert?.certificate_no ?? code} · verification code ${code}. Keep it safe — anyone can verify it on DeenLink.`);
          }
        });
      }
    }
  };

  /* web parity: course tabs — all / tafsir / fiqh / aqeedah / arabic / tauhid */
  const TABS = ['All', 'Tafsir', 'Fiqh', 'Aqeedah', 'Arabic', 'Tauhid'];
  const list = useMemo(
    () => (tab === 'All' ? courses : courses.filter((c) => ((c.category as string | undefined) ?? 'Other') === tab || (tab === 'Arabic' && (c.category as string | undefined) === 'Qur’an'))),
    [courses, tab],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <PageHero title="Islamic Courses & Lectures" heading="Learn Step by Step" sub="Courses, lessons & lectures — with progress" icon={GraduationCapIcon} height={220} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, gap: 6 }}>
          {TABS.map((t) => {
            const on = tab === t;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: on ? 'rgba(74,227,143,0.5)' : theme.border, backgroundColor: on ? 'rgba(46,204,113,0.12)' : theme.card, paddingHorizontal: 12, paddingVertical: 7 }}
              >
                {t !== 'All' ? <FontAwesome5 name={{ Tafsir: 'book-open', Fiqh: 'balance-scale', Aqeedah: 'landmark', Arabic: 'language', Tauhid: 'star-and-crescent' }[t] as never} size={9} color={theme.primary} /> : null}
                <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: on ? theme.primary : theme.subtext }}>{t.toUpperCase()}</T>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{ paddingTop: 12, paddingLeft: 16, paddingRight: 16, gap: 12 }}>
          {/* pass 36 — loading skeleton while courses load (slow networks) */}
          {loading && !list.length ? (
            <>
              {[...Array(4)].map((_, i) => (
                <View key={i} style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, gap: 10, opacity: 1 - i * 0.15 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: isDark ? 'rgba(242,247,243,0.07)' : 'rgba(20,36,28,0.06)' }} />
                    <View style={{ flex: 1, gap: 7 }}>
                      <View style={{ height: 11, borderRadius: 6, width: '58%', backgroundColor: isDark ? 'rgba(242,247,243,0.07)' : 'rgba(20,36,28,0.06)' }} />
                      <View style={{ height: 9, borderRadius: 5, width: '76%', backgroundColor: isDark ? 'rgba(242,247,243,0.05)' : 'rgba(20,36,28,0.04)' }} />
                    </View>
                  </View>
                  <View style={{ height: 9, borderRadius: 5, width: '92%', backgroundColor: isDark ? 'rgba(242,247,243,0.05)' : 'rgba(20,36,28,0.04)' }} />
                  <View style={{ height: 5, borderRadius: 3, width: '100%', backgroundColor: isDark ? 'rgba(242,247,243,0.06)' : 'rgba(20,36,28,0.05)' }} />
                </View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 4 }}>
                <ActivityIndicator size="small" color={isDark ? '#4AE38F' : '#1D6F42'} />
                <T v="caption" style={{ fontSize: 10.5, color: theme.subtext }}>Loading courses…</T>
              </View>
            </>
          ) : null}
          {list.map((c) => {
            const lessons = lessonsFor(c);
            const done = (progress[c.id] ?? []).length;
            const pct = Math.round((done / lessons.length) * 100);
            return (
              <Pressable
                key={c.id}
                onPress={() => openCourseCta(c)}
                style={({ pressed }) => ({ backgroundColor: theme.card, borderRadius: 16, padding: 16, opacity: pressed ? 0.9 : 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: theme.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <GraduationCapIcon size={22} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="h3">{c.title ?? 'Course'}</T>
                    <T v="caption" style={{ marginTop: 3 }}>
                      {(c.category as string | undefined) ?? 'Course'} · {c.level ?? 'All levels'} · {lessons.length} lessons
                    </T>
                  </View>
                  <ChevronRightIcon size={16} color={theme.subtext} />
                </View>
                {c.description ? (
                  <T v="caption" style={{ marginTop: 10, lineHeight: 17 }}>
                    {c.description}
                  </T>
                ) : null}
                {/* progress */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 11 }}>
                  <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: theme.border, overflow: 'hidden' }}>
                    <View style={{ width: `${pct}%`, height: 5, backgroundColor: isDark ? '#4AE38F' : '#1D6F42' }} />
                  </View>
                  <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>{done}/{lessons.length}{done > 0 ? ` · ${pct}%` : ''}</T>
                </View>
              </Pressable>
            );
          })}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <StarIcon size={14} color={theme.accent} />
            <T v="caption" style={{ flex: 1 }}>
              {api.isLive() ? 'Progress syncs with your DeenLink account.' : 'Progress is saved on this device.'}
            </T>
          </View>
        </View>
      </ScrollView>

      {openCourse ? <CoursePlayer course={openCourse} progress={progress[openCourse.id] ?? []} onToggle={(li) => toggleDone(openCourse.id, li)} onClose={() => { setOpenCourse(null); setServerCourse(null); }} server={serverCourse} onUnlock={doUnlock} unlocking={unlocking} /> : null}
    </View>
  );
}

/* ── the learning player: curriculum list ⇄ lesson reader ── */
function CoursePlayer({ course, progress, onToggle, onClose, server, onUnlock, unlocking }: { course: Course; progress: number[]; onToggle: (li: number) => void; onClose: () => void; server?: ServerCourse | null; onUnlock?: () => void; unlocking?: boolean }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [li, setLi] = useState<number | null>(null);
  /* pass 72 — real modules beat the bundled curriculum when they exist */
  const lessons = server?.modules?.length ? serverLessons(server) : lessonsFor(course);
  const locked = !!(server && server.access_type === 'deenpoints' && server.user_state && server.user_state.has_access === false);
  if (locked) {
    return (
      <Modal visible animationType="slide" onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top + 8, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.4)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="lock" size={24} color="#B8870B" />
          </View>
          <T v="h2" style={{ marginTop: 18, fontWeight: '900' }}>{course.title}</T>
          <T v="body" style={{ marginTop: 8, color: theme.subtext, textAlign: 'center' }}>
            This course unlocks with {server?.deen_points_cost ?? 0} DeenPoints. Your balance: {server?.user_state?.deenpoints_balance ?? 0} pts.
          </T>
          <Pressable onPress={() => { haptic.light(); onUnlock?.(); }} disabled={unlocking}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, paddingVertical: 14, paddingHorizontal: 26, borderRadius: 14, backgroundColor: isDark ? '#4AE38F' : '#1D6F42', opacity: pressed || unlocking ? 0.7 : 1 })}>
            {unlocking ? <ActivityIndicator size="small" color="#0E1410" /> : <FontAwesome5 name="unlock" size={12} color="#0E1410" />}
            <T v="button" style={{ fontSize: 13, fontWeight: '900', color: '#0E1410' }}>{unlocking ? 'UNLOCKING…' : 'UNLOCK COURSE'}</T>
          </Pressable>
          <Pressable onPress={onClose} style={{ marginTop: 14, paddingVertical: 10 }}>
            <T v="caption" style={{ fontWeight: '700' }}>Maybe later</T>
          </Pressable>
        </View>
      </Modal>
    );
  }
  /* pass 42 — quiz session state */
  const [quizOn, setQuizOn] = useState(false);
  const [qi, setQi] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [best, setBest] = useState(0);
  const quiz = quizFor(course);
  useEffect(() => {
    (async () => {
      try {
        const all = JSON.parse((await storage.getItem('dl.courses.quiz.v1')) ?? '{}');
        setBest(all[course.slug ?? course.id.toString()]?.best ?? 0);
      } catch {}
    })();
  }, [course]);
  const saveQuiz = async (sc: number) => {
    setBest((b) => Math.max(b, sc));
    try {
      const all = JSON.parse((await storage.getItem('dl.courses.quiz.v1')) ?? '{}');
      const k = course.slug ?? course.id.toString();
      const cur = all[k] ?? { best: 0, tries: 0 };
      all[k] = { best: Math.max(cur.best, sc), tries: cur.tries + 1 };
      await storage.setItem('dl.courses.quiz.v1', JSON.stringify(all));
    } catch {}
  };
  const startQuiz = () => { haptic.selection(); setQuizOn(true); setQi(0); setPick(null); setScore(0); setFinished(false); };
  const done = progress.length;
  const pct = Math.round((done / lessons.length) * 100);
  const nextIdx = lessons.findIndex((_, i) => !progress.includes(i));

  return (
    <Modal visible animationType="slide" onRequestClose={() => (quizOn ? setQuizOn(false) : li != null ? setLi(null) : onClose())}>
      <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top + 8 }}>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10 }}>
          <Pressable onPress={() => { haptic.selection(); if (quizOn) setQuizOn(false); else if (li != null) setLi(null); else onClose(); }} style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name={quizOn ? 'chevron-left' : li != null ? 'chevron-left' : 'times'} size={13} color={theme.primary} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T v="h3" numberOfLines={1} style={{ fontWeight: '800' }}>{quizOn ? (finished ? 'Quiz complete' : `Quiz · Q${qi + 1} of ${quiz.length}`) : li != null ? lessons[li].title : course.title}</T>
            <T v="caption" numberOfLines={1} style={{ marginTop: 1 }}>{quizOn ? (finished ? `Score ${score}/${quiz.length} · best ${Math.max(best, score)}` : `${course.title} · question ${qi + 1}`) : li != null ? `${lessons[li].kind === 'lecture' ? 'Lecture' : 'Reading'} · ${lessons[li].minutes} min` : `${done}/${lessons.length} lessons · ${pct}% complete`}</T>
          </View>
          <View style={{ minWidth: 44, height: 26, borderRadius: 9, borderWidth: 1.5, borderColor: pct === 100 ? 'rgba(212,175,55,0.6)' : theme.border, backgroundColor: pct === 100 ? 'rgba(212,175,55,0.12)' : theme.card, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
            <T v="caption" style={{ fontSize: 10, fontWeight: '900', color: pct === 100 ? '#B8870B' : theme.primary }}>{pct}%</T>
          </View>
        </View>
        {/* thin progress bar */}
        <View style={{ height: 4, backgroundColor: theme.border }}>
          <View style={{ width: `${pct}%`, height: 4, backgroundColor: pct === 100 ? '#D4AF37' : isDark ? '#4AE38F' : '#1D6F42' }} />
        </View>

        {quizOn ? (
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
            {finished ? (
              <View style={{ alignItems: 'center', paddingTop: 26 }}>
                <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 2.5, borderColor: score === quiz.length ? 'rgba(212,175,55,0.7)' : isDark ? 'rgba(74,227,143,0.6)' : 'rgba(29,111,66,0.5)', backgroundColor: score === quiz.length ? 'rgba(212,175,55,0.1)' : isDark ? 'rgba(46,204,113,0.08)' : 'rgba(29,111,66,0.06)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name={score === quiz.length ? 'trophy' : 'award'} size={30} color={score === quiz.length ? '#B8870B' : isDark ? '#4AE38F' : '#1D6F42'} />
                </View>
                <T v="h2" style={{ marginTop: 16, fontWeight: '900' }}>{score === quiz.length ? 'Perfect score!' : score >= quiz.length - 1 ? 'Well done!' : 'Keep studying'}</T>
                <T v="body" style={{ marginTop: 5, color: theme.subtext, textAlign: 'center' }}>You scored {score} of {quiz.length}{best > score ? ` · your best is ${best}` : score > best ? ' · a new best!' : ''}</T>
                <Pressable onPress={startQuiz} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22, width: '100%', paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: isDark ? '#4AE38F' : '#1D6F42', opacity: pressed ? 0.85 : 1 })}>
                  <FontAwesome5 name="redo" size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
                  <T v="button" style={{ fontSize: 13, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>RETRY QUIZ</T>
                </Pressable>
                <Pressable onPress={() => setQuizOn(false)} style={{ marginTop: 10, paddingVertical: 12 }}>
                  <T v="caption" style={{ fontWeight: '700' }}>Back to lessons</T>
                </Pressable>
              </View>
            ) : (
              <View>
                {/* quiz progress dots */}
                <View style={{ flexDirection: 'row', gap: 5, marginBottom: 16 }}>
                  {quiz.map((_, k) => (
                    <View key={k} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: k < qi ? (isDark ? '#4AE38F' : '#1D6F42') : k === qi ? 'rgba(212,175,55,0.8)' : theme.border }} />
                  ))}
                </View>
                <T v="h3" style={{ fontSize: 17, fontWeight: '800', lineHeight: 25 }}>{quiz[qi].q}</T>
                <T v="caption" style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginTop: 14, marginBottom: 9 }}>CHOOSE ONE</T>
                {quiz[qi].a.map((opt, k) => {
                  const chosen = pick === k;
                  const reveal = pick != null;
                  const isRight = k === quiz[qi].correct;
                  return (
                    <Pressable
                      key={k}
                      disabled={reveal}
                      onPress={() => { haptic.selection(); setPick(k); if (isRight) setScore((x) => x + 1); }}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 14, borderWidth: 1.5, borderColor: reveal ? (isRight ? 'rgba(74,227,143,0.75)' : chosen ? 'rgba(239,68,68,0.65)' : theme.border) : chosen ? 'rgba(212,175,55,0.6)' : theme.border, backgroundColor: reveal ? (isRight ? 'rgba(46,204,113,0.1)' : chosen ? 'rgba(239,68,68,0.07)' : theme.card) : theme.card, padding: 13, marginBottom: 9, opacity: pressed ? 0.85 : 1 })}
                    >
                      <View style={{ width: 28, height: 28, borderRadius: 9, borderWidth: 1.5, borderColor: reveal ? (isRight ? 'rgba(74,227,143,0.75)' : chosen ? 'rgba(239,68,68,0.65)' : theme.border) : theme.border, alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesome5 name={reveal ? (isRight ? 'check' : chosen ? 'times' : 'circle') : 'circle'} size={11} color={reveal ? (isRight ? '#2FA866' : chosen ? '#EF4444' : theme.subtext) : theme.subtext} />
                      </View>
                      <T v="bodyS" style={{ flex: 1, fontSize: 13.5, fontWeight: '600', color: reveal && isRight ? (isDark ? '#7CE8A8' : '#166534') : theme.text }}>{opt}</T>
                    </Pressable>
                  );
                })}
                {pick != null ? (
                  <View style={{ borderRadius: 13, borderWidth: 1, borderColor: pick === quiz[qi].correct ? 'rgba(74,227,143,0.4)' : 'rgba(239,68,68,0.35)', backgroundColor: pick === quiz[qi].correct ? 'rgba(46,204,113,0.07)' : 'rgba(239,68,68,0.05)', padding: 12, marginTop: 4 }}>
                    <T v="caption" style={{ fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5, color: pick === quiz[qi].correct ? (isDark ? '#4AE38F' : '#1D6F42') : '#EF4444' }}>{pick === quiz[qi].correct ? 'CORRECT' : 'NOT QUITE'}</T>
                    <T v="bodyS" style={{ fontSize: 12.5, marginTop: 4, color: theme.text }}>{quiz[qi].why}</T>
                    <Pressable
                      onPress={() => { haptic.selection(); if (qi + 1 < quiz.length) { setQi(qi + 1); setPick(null); } else { setFinished(true); saveQuiz(score); } }}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 12, borderRadius: 12, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', opacity: pressed ? 0.85 : 1 })}
                    >
                      <FontAwesome5 name={qi + 1 < quiz.length ? 'arrow-right' : 'flag-checkered'} size={12} color="#fff" />
                      <T v="button" style={{ fontSize: 12.5, fontWeight: '800' }}>{qi + 1 < quiz.length ? 'NEXT QUESTION' : 'SEE RESULTS'}</T>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            )}
          </ScrollView>
        ) : li == null ? (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 9 }} showsVerticalScrollIndicator={false}>
            {/* continue card */}
            {nextIdx >= 0 && pct > 0 ? (
              <Pressable onPress={() => { haptic.selection(); setLi(nextIdx); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)', backgroundColor: isDark ? 'rgba(46,204,113,0.1)' : 'rgba(29,111,66,0.06)', padding: 13 }}>
                <FontAwesome5 name="play-circle" size={22} color={isDark ? '#4AE38F' : '#1D6F42'} />
                <View style={{ flex: 1 }}>
                  <T v="caption" style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.5, color: isDark ? '#4AE38F' : '#1D6F42' }}>CONTINUE</T>
                  <T v="bodyS" numberOfLines={1} style={{ fontWeight: '700', fontSize: 12.5, marginTop: 2 }}>{lessons[nextIdx].title}</T>
                </View>
                <ChevronRightIcon size={14} color={theme.subtext} />
              </Pressable>
            ) : null}
            {/* pass 42 — course quiz launcher */}
            <Pressable onPress={startQuiz} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: 'rgba(212,175,55,0.09)', padding: 13, opacity: pressed ? 0.85 : 1 })}>
              <View style={{ width: 34, height: 34, borderRadius: 11, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.55)', backgroundColor: 'rgba(212,175,55,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="graduation-cap" size={14} color="#B8870B" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="bodyS" style={{ fontWeight: '800', fontSize: 13 }}>Course quiz</T>
                <T v="caption" style={{ fontSize: 10, marginTop: 2 }}>{quiz.length} questions{best > 0 ? ` · best ${best}/${quiz.length}` : ' · test yourself'}</T>
              </View>
              <ChevronRightIcon size={14} color={theme.subtext} />
            </Pressable>
            {lessons.map((l, i) => {
              const isDone = progress.includes(i);
              return (
                <Pressable key={i} onPress={() => { haptic.selection(); setLi(i); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: isDone ? 'rgba(212,175,55,0.4)' : theme.border, backgroundColor: theme.card, padding: 13, opacity: pressed ? 0.85 : 1 })}>
                  <View style={{ width: 34, height: 34, borderRadius: 11, borderWidth: 1.5, borderColor: isDone ? 'rgba(212,175,55,0.55)' : theme.border, backgroundColor: isDone ? 'rgba(212,175,55,0.12)' : theme.card, alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name={isDone ? 'check' : l.kind === 'lecture' ? 'chalkboard-teacher' : 'book-open'} size={13} color={isDone ? '#B8870B' : theme.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T v="bodyS" style={{ fontWeight: '700', fontSize: 13 }}>{l.title}</T>
                    <T v="caption" style={{ fontSize: 10, marginTop: 2 }}>{l.kind === 'lecture' ? 'Lecture' : 'Reading'} · {l.minutes} min</T>
                  </View>
                  <ChevronRightIcon size={14} color={theme.subtext} />
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <View style={{ borderRadius: 9, backgroundColor: theme.primarySoft, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 9, paddingVertical: 4 }}>
                <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: theme.primary }}>LESSON {li + 1} OF {lessons.length}</T>
              </View>
              <View style={{ flex: 1 }} />
              <T v="caption" style={{ fontSize: 10, color: theme.subtext }}>{lessons[li].minutes} min</T>
            </View>
            {lessons[li].body.map((p, k) => (
              <T key={k} v="body" style={{ fontSize: 14.5, lineHeight: 24, color: theme.text, marginBottom: 13 }}>{p}</T>
            ))}
            <Pressable
              onPress={() => { onToggle(li); if (li + 1 < lessons.length) setLi(li + 1); else { setLi(null); } }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 8, paddingVertical: 15, borderRadius: 15, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', opacity: pressed ? 0.85 : 1 })}
            >
              <FontAwesome5 name={progress.includes(li) ? 'check' : 'check-circle'} size={13} color="#fff" />
              <T v="button" style={{ fontSize: 13.5, fontWeight: '800' }}>{progress.includes(li) ? 'COMPLETED — NEXT LESSON' : 'MARK COMPLETE & CONTINUE'}</T>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
