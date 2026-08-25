import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { HADITH_CATEGORIES, HADITHS } from '@/data/hadith';
import { useTheme } from '@/context/ThemeContext';
import { ArchCard } from '@/components/ArchCard';
import { TopBar } from '@/components/TopBar';
import {
  BookmarkIcon,
  FilterIcon,
  HeartIcon,
  HomeIcon,
  MosqueIcon,
  SearchIcon,
  ShareIcon,
  ShieldIcon,
} from '@/components/Icons';

const TABS = ['All', 'Sahih Bukhari', 'Sahih Muslim', 'Other'] as const;

const CAT_ICON: Record<string, (p: { size?: number; color?: string }) => React.ReactNode> = {
  shield: ShieldIcon,
  mosque: MosqueIcon,
  heart: HeartIcon,
  home: HomeIcon,
};

export default function Hadith() {
  const { theme } = useTheme();
  const [tab, setTab] = useState<(typeof TABS)[number]>('All');

  const list = useMemo(
    () => HADITHS.filter((h) => tab === 'All' || h.book === tab),
    [tab],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar
        title="Hadith"
        right={
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <SearchIcon size={20} color={theme.subtext} />
            <FilterIcon size={18} color={theme.subtext} />
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        {/* Source tabs */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {TABS.map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={{
                paddingHorizontal: 13,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: tab === t ? theme.primary : theme.card,
                borderWidth: 1,
                borderColor: tab === t ? theme.primary : theme.border,
              }}
            >
              <Text style={{ color: tab === t ? '#fff' : theme.subtext, fontWeight: '700', fontSize: 12 }}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {/* Daily hadith */}
        <ArchCard archHeight={46} strokeColor={theme.accent} strokeWidth={1.2}>
          <Text style={{ color: theme.subtext, fontSize: 10.5, fontWeight: '800', letterSpacing: 1, textAlign: 'center' }}>
            DAILY HADITH
          </Text>
          <Text style={{ color: theme.text, fontSize: 21, textAlign: 'center', marginTop: 14, lineHeight: 34 }}>
            {HADITHS[0].arabic}
          </Text>
          <Text style={{ color: theme.subtext, fontSize: 12.5, marginTop: 12, fontStyle: 'italic', textAlign: 'center' }}>
            {HADITHS[0].translation}
          </Text>
          <Text style={{ color: theme.subtext, fontSize: 11.5, marginTop: 6, textAlign: 'center' }}>
            {HADITHS[0].source} {HADITHS[0].number}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: 10 }}>
            <ShareIcon size={17} color={theme.subtext} />
            <BookmarkIcon size={17} color={theme.subtext} />
          </View>
        </ArchCard>

        {/* Categories */}
        <Text style={{ color: theme.heading, fontSize: 15, fontWeight: '800', marginTop: 20, marginBottom: 10 }}>
          Categories
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {HADITH_CATEGORIES.map((c) => {
            const Icon = CAT_ICON[c.icon];
            const count = HADITHS.filter((h) => h.category === c.id).length;
            return (
              <View
                key={c.id}
                style={{
                  flex: 1,
                  minWidth: '46%',
                  backgroundColor: theme.card,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: theme.border,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: theme.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={17} color={theme.primary} />
                </View>
                <View style={{ marginLeft: 10 }}>
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12.5 }}>{c.label}</Text>
                  <Text style={{ color: theme.subtext, fontSize: 11, marginTop: 1 }}>{count} Hadiths</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* List */}
        <Text style={{ color: theme.heading, fontSize: 15, fontWeight: '800', marginTop: 20, marginBottom: 10 }}>
          {tab === 'All' ? 'All Hadiths' : tab}
        </Text>
        {list.map((h) => (
          <View
            key={h.id}
            style={{
              backgroundColor: theme.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
              padding: 14,
              marginBottom: 9,
            }}
          >
            <Text style={{ color: theme.text, fontSize: 16, textAlign: 'right', lineHeight: 27 }}>{h.arabic}</Text>
            <Text style={{ color: theme.text, fontSize: 13, marginTop: 9, lineHeight: 19 }}>{h.translation}</Text>
            <Text style={{ color: theme.subtext, fontSize: 11.5, marginTop: 7 }}>
              {h.source} {h.number}
            </Text>
          </View>
        ))}
        <Text style={{ color: theme.subtext, fontSize: 11, textAlign: 'center', marginTop: 6 }}>
          Demo set — connects to your /hadith endpoint with the full collections.
        </Text>
      </ScrollView>
    </View>
  );
}
