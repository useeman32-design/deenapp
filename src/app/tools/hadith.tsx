import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { HADITH_CATEGORIES, HADITHS, type Hadith } from '@/data/hadith';
import { useTheme } from '@/context/ThemeContext';
import { ArchCard } from '@/components/ArchCard';
import { Surface } from '@/components/Surface';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { Chip } from '@/components/Chip';
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

  const list = useMemo(() => HADITHS.filter((h) => tab === 'All' || h.book === tab), [tab]);
  const [h0] = HADITHS;

  const Row = ({ h }: { h: Hadith }) => (
    <Surface style={{ padding: 15, marginBottom: 10 }}>
      <T v="arabic" style={{ textAlign: 'right' }}>
        {h.arabic}
      </T>
      <T v="bodyS" style={{ marginTop: 10, lineHeight: 20 }}>
        {h.translation}
      </T>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 }}>
        <T v="meta" style={{ letterSpacing: 0.5 }}>
          {h.source} · {h.number}
        </T>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <ShareIcon size={15} color={theme.subtext} />
          <BookmarkIcon size={15} color={theme.subtext} />
        </View>
      </View>
    </Surface>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.dash.bg }}>
      <TopBar
        title="Hadith"
        right={
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <SearchIcon size={20} color={theme.subtext} />
            <FilterIcon size={17} color={theme.subtext} />
          </View>
        }
      />
      <FlatList
        data={list}
        keyExtractor={(h) => h.id}
        renderItem={({ item }) => <Row h={item} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 34 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Source tabs */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {TABS.map((t) => (
                <Chip key={t} label={t} active={tab === t} onPress={() => setTab(t)} />
              ))}
            </View>

            {/* Daily hadith */}
            <ArchCard archHeight={48} strokeColor={theme.accent} strokeWidth={1.2} padding={16}>
              <T v="meta" color="accent" uppercase style={{ textAlign: 'center', letterSpacing: 1.2 }}>
                Daily hadith
              </T>
              <T v="arabicL" style={{ textAlign: 'center', marginTop: 14 }}>
                {h0.arabic}
              </T>
              <T v="bodyS" style={{ marginTop: 12, fontStyle: 'italic', textAlign: 'center' }}>
                {h0.translation}
              </T>
              <T v="caption" style={{ marginTop: 6, textAlign: 'center' }}>
                {h0.source} {h0.number}
              </T>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 10 }}>
                <ShareIcon size={16} color={theme.subtext} />
                <BookmarkIcon size={16} color={theme.subtext} />
              </View>
            </ArchCard>

            {/* Categories */}
            <T v="h3" style={{ marginTop: 20, marginBottom: 10 }}>Categories</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {HADITH_CATEGORIES.map((c) => {
                const Icon = CAT_ICON[c.icon];
                const count = HADITHS.filter((h) => h.category === c.id).length;
                return (
                  <Surface key={c.id} soft style={{ flex: 1, minWidth: '46%', padding: 12, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: theme.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={17} color={theme.primary} />
                    </View>
                    <View style={{ marginLeft: 10 }}>
                      <T v="bodyS" style={{ fontWeight: '700' }}>{c.label}</T>
                      <T v="caption" style={{ marginTop: 1 }}>{count} hadiths</T>
                    </View>
                  </Surface>
                );
              })}
            </View>

            <T v="h3" style={{ marginTop: 20, marginBottom: 10 }}>
              {tab === 'All' ? 'All hadiths' : tab}
            </T>
          </View>
        }
        ListFooterComponent={
          <T v="caption" style={{ textAlign: 'center', marginTop: 8, lineHeight: 17 }}>
            Demo set — connects to your /hadith endpoint with the full collections.
          </T>
        }
      />
    </View>
  );
}
