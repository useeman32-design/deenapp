import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { BackButton } from '@/components/BackButton';
import { haptic } from '@/lib/haptics';

/**
 * pass 42 — SHORT LESSONS got their own screen in the library (was an inline
 * list + sheet on the Learning hub). Structured micro-lessons written from
 * classical sources: key points, ayat and hadith with references.
 */

type Topic = { id: string; title: string; icon: string; tint: string; minutes: number; points: Array<{ h: string; b: string }> };

const TOPICS: Array<{ id: string; title: string; icon: string; tint: string; minutes: number; points: Array<{ h: string; b: string }> }> = [
  {
    id: 'tawhid', title: 'Tawhid — Oneness of Allah', icon: 'star-and-crescent', tint: '#E8C96A', minutes: 6,
    points: [
      { h: 'The three categories', b: 'Tawhid ar-Rububiyyah (Allah alone creates, owns and sustains), Tawhid al-Uluhiyyah (Allah alone deserves worship) and Tawhid al-Asma was-Sifat (His perfect names and attributes, without distortion or comparison).' },
      { h: 'The proof', b: '“Say: He is Allah, the One. Allah, the Eternal Refuge. He neither begets nor is born, nor is there to Him any equivalent.” — Surah Al-Ikhlas (112:1-4).' },
      { h: 'Why it comes first', b: 'The Prophet ﷺ spent 13 years in Makkah calling to tawhid before a single command of halal/haram — every act of worship is only accepted when it rests purely on it.' },
      { h: 'What nullifies it', b: 'Directing any worship to other than Allah — supplicating the dead, amulets seeking protection from creation, or believing anyone shares His power. Repentance restores it.' },
    ],
  },
  {
    id: 'salah', title: 'Salah — Step by Step', icon: 'mosque', tint: '#2FA46B', minutes: 8,
    points: [
      { h: 'Before you stand', b: 'Wudu, clean clothes, a clean place, covering the awrah, facing the qiblah, and the intention in the heart — then the time enters.' },
      { h: 'The opening', b: 'Raise your hands and say Allahu akbar. Open with the du’a of starting, then recite Al-Fatiha — “no prayer for the one who does not recite it” (Bukhari 756).' },
      { h: 'Ruku’ and sujud', b: 'Bow with a straight back, saying subhana rabbiyal-‘azim. Prostrate on seven bones: forehead+nose, two palms, two knees, two toes — “the closest a servant is to his Lord” (Muslim 482).' },
      { h: 'Ending', b: 'Sit for the tashahhud, send salawat on the Prophet ﷺ, and close with the taslim to the right and left. Tranquility (tuma’ninah) in every posture is obligatory — rushing can nullify it.' },
      { h: 'Common mistakes', b: 'Reciting Fatiha too fast to reflect, not straightening the back in ruku’, and standing up before settling — “Pray as you have seen me praying” (Bukhari 631).' },
    ],
  },
  {
    id: 'wudu', title: 'Wudu & Purity', icon: 'tint', tint: '#5BC8F5', minutes: 5,
    points: [
      { h: 'The obligatory acts', b: 'Wash the face, the arms to the elbows, wipe the head, wash the feet to the ankles — Surah Al-Ma’idah 5:6 — with intention, in order, without long gaps.' },
      { h: 'The Prophet’s ﷺ way', b: 'Begin with bismillah, wash the hands three times, rinse mouth and nose, then each limb three times — the whole wudu used to take him a few minutes (Bukhari 159).' },
      { h: 'What breaks it', b: 'Using the toilet, passing wind, deep sleep, and anything exiting the two private passages. Touching the opposite sex or bleeding are differing scholarly positions.' },
      { h: 'Tayammum', b: 'When water is unavailable or harmful: strike clean earth lightly with the palms, wipe the face and hands. It replaces wudu until water is found.' },
    ],
  },
  {
    id: 'ramadan', title: 'Ramadan Essentials', icon: 'moon', tint: '#AB47BC', minutes: 7,
    points: [
      { h: 'The obligation', b: '“O you who believe, fasting is prescribed for you as it was for those before you, that you may attain taqwa” — Al-Baqarah 2:183. Dawn (fajr) to sunset (maghrib).' },
      { h: 'What breaks the fast', b: 'Eating, drinking, sexual relations, deliberate vomiting — out of forgetfulness does not break it (Muslim 1155). The menstruating woman does not fast; she makes the days up later.' },
      { h: 'Suhur and iftar', b: 'Take suhur — “it contains blessing” (Bukhari 1923) — and break the fast promptly at maghrib with dates and water, beginning with du’a.' },
      { h: 'More than hunger', b: 'Guard the tongue and eyes: “Whoever does not abandon false speech, Allah has no need of his leaving food” (Bukhari 1903). Multiply recitation of the Qur’an and charity.' },
      { h: 'The last ten nights', b: 'Seek Laylatul-Qadr — “better than a thousand months” (Al-Qadr 97:3) — in the odd nights, with the du’a: “O Allah, You are Pardoning, You love pardon, so pardon me.”' },
    ],
  },
  {
    id: 'halal', title: 'Halal Earnings', icon: 'balance-scale', tint: '#FFA726', minutes: 6,
    points: [
      { h: 'The principle', b: 'Eating and feeding the family from pure earnings is half the battle of faith. “O people, Allah is Good and accepts only what is good” (Muslim 1015).' },
      { h: 'Clearly prohibited', b: 'Riba (interest) — “Allah has permitted trade and forbidden riba” (2:275); gambling, cheating in measure, stealing, and selling what you do not own in key respects.' },
      { h: 'Gray areas', b: 'When unsure, leave what doubts you for what does not (hadith of an-Nu’man ibn Bashir). Contracts must be clear on price, item and time to avoid gharar.' },
      { h: 'The barakah', b: 'A small honest income with contentment outweighs much gained dishonestly — and every dirham spent on family is charity (Muslim 998).' },
    ],
  },
  {
    id: 'dua', title: 'Du’a Etiquette', icon: 'hands-helping', tint: '#66BB6A', minutes: 5,
    points: [
      { h: 'The best times', b: 'The last third of the night, between adhan and iqamah, while prostrating, on Friday, and while fasting — when the call is most likely answered.' },
      { h: 'The best manner', b: 'Face the qiblah, praise Allah, send salawat on the Prophet ﷺ, admit your shortcomings, then ask with certainty — “each of you should ask his Lord for his needs” (Tirmidhi 2969).' },
      { h: 'What weakens it', b: 'Haste (“I prayed and was not answered”), haraam income, and a heedless heart. The answer may be averted harm, stored for the akhirah, or the very thing asked.' },
      { h: 'The universal du’a', b: '“Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire” (Al-Baqarah 2:201).' },
    ],
  },
  {
    id: 'hijri', title: 'The Hijri Calendar', icon: 'calendar-alt', tint: '#EC407A', minutes: 4,
    points: [
      { h: 'Where it starts', b: 'Year 1 marks the hijrah of the Prophet ﷺ from Makkah to Madinah (622 CE), set by Umar (RA) during his caliphate.' },
      { h: 'How it works', b: 'Twelve lunar months of 29 or 30 days — about 354 days a year, so Islamic dates move back ~11 days each solar year, rotating through every season.' },
      { h: 'The sacred months', b: 'Dhul-Qa’dah, Dhul-Hijjah, Muharram and Rajab — “so do not wrong yourselves during them” (At-Tawbah 9:36).' },
      { h: 'Moon sighting', b: 'Months begin with the sighting of the new crescent (ru’yah) or the completion of 30 days — which is why Ramadan and Eid dates can differ by a day between countries.' },
    ],
  },
  {
    id: 'janazah', title: 'The Janazah Prayer', icon: 'user-friends', tint: '#8D6E63', minutes: 6,
    points: [
      { h: 'Why it matters', b: 'A communal obligation (fard kifayah): whoever attends and prays earns a qirat of reward — “two great mountains” of it if they also bury (Muslim 945).' },
      { h: 'How it is prayed', b: 'Standing, no ruku’ or sujud: takbir, then al-Fatiha; takbir, then salawat on the Prophet ﷺ; takbir, then du’a for the deceased; final takbir, then taslim.' },
      { h: 'The core du’a', b: '“O Allah, forgive him and have mercy on him, grant him ease and pardon, honor his resting place, and make his entrance wide and wash him with water, snow and hail.”' },
      { h: 'After the prayer', b: 'The burial follows quickly; consoling the family, making du’a for the deceased and fulfilling their debts are ongoing rights.' },
    ],
  },
];

export default function Lessons() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const list = needle ? TOPICS.filter((t) => t.title.toLowerCase().includes(needle) || t.points.some((p) => (p.h + p.b).toLowerCase().includes(needle))) : TOPICS;

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      {/* header + search */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <T v="h2" style={{ fontWeight: '900', fontSize: 19, color: d.text }}>Short Lessons</T>
          <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>{TOPICS.length} micro-lessons · {TOPICS.reduce((n, t) => n + t.points.length, 0)} key points</T>
        </View>
      </View>
      <View style={{ marginHorizontal: 16, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 12, height: 42 }}>
        <FontAwesome5 name="search" size={11} color={d.faint} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search lessons…" placeholderTextColor={d.faint} style={{ flex: 1, fontSize: 13, color: d.text, fontFamily: 'Poppins-Medium' }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 9 }}>
          {list.map((t) => (
            <Pressable
              key={t.id}
              accessibilityLabel={`topic ${t.title}`}
              onPress={() => { haptic.selection(); setTopic(t); }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: `${t.tint}44`, backgroundColor: `${t.tint}0D`, padding: 13, opacity: pressed ? 0.82 : 1 })}
            >
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: `${t.tint}22`, borderWidth: 1, borderColor: `${t.tint}66`, alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name={t.icon as never} size={16} color={t.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="bodyS" style={{ fontWeight: '800', fontSize: 13, color: d.text }}>{t.title}</T>
                <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 2 }}>{t.points.length} key points · {t.minutes} min read</T>
              </View>
              <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
            </Pressable>
          ))}
          {!list.length ? <T v="caption" style={{ textAlign: 'center', color: d.faint, padding: 18 }}>No lessons match “{q}”.</T> : null}
        </View>
      </ScrollView>

      {/* lesson reader sheet */}
      <Modal visible={!!topic} transparent animationType="slide" onRequestClose={() => setTopic(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.6)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setTopic(null)} />
          <View style={{ backgroundColor: isDark ? '#0C1712' : '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: `${topic?.tint ?? '#E8C96A'}55`, maxHeight: '86%', paddingBottom: 26 }}>
            <View style={{ alignItems: 'center', paddingTop: 12, marginBottom: 10 }}>
              <View style={{ width: 42, height: 4.5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)' }} />
            </View>
            {topic ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 18, marginBottom: 12 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: `${topic.tint}22`, borderWidth: 1, borderColor: `${topic.tint}66`, alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name={topic.icon as never} size={16} color={topic.tint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="h3" style={{ fontSize: 15.5, fontWeight: '900', color: d.text }}>{topic.title}</T>
                    <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>{topic.points.length} key points · {topic.minutes} min · Short Lessons</T>
                  </View>
                  <Pressable onPress={() => setTopic(null)} accessibilityLabel="close topic" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(20,36,28,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name="times" size={11} color={d.subtext} />
                  </Pressable>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 11, paddingBottom: 8 }}>
                  {topic.points.map((pt, i) => (
                    <View key={i} style={{ borderRadius: 14, borderWidth: 1, borderColor: `${topic.tint}33`, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(20,36,28,0.02)', padding: 13 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        <View style={{ width: 20, height: 20, borderRadius: 7, backgroundColor: `${topic.tint}22`, alignItems: 'center', justifyContent: 'center' }}>
                          <T v="caption" style={{ fontSize: 9, fontWeight: '900', color: topic.tint }}>{i + 1}</T>
                        </View>
                        <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: d.text }}>{pt.h}</T>
                      </View>
                      <T v="bodyS" style={{ fontSize: 12, lineHeight: 18.5, color: d.subtext }}>{pt.b}</T>
                    </View>
                  ))}
                  <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', marginTop: 4, lineHeight: 14 }}>Reviewed against the Qur’an and the major hadith collections. For rulings, confirm with a qualified scholar.</T>
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}
