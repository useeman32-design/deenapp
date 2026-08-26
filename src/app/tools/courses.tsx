import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import * as api from '@/api/client';
import type { Course } from '@/api/types';
import { T } from '@/components/T';
import { PageHero } from '@/components/PageHero';
import { ChevronRightIcon, GraduationCapIcon, StarIcon } from '@/components/Icons';

export default function Courses() {
  const { theme } = useTheme();
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    api.courses().then(setCourses);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <PageHero title="Islamic Courses" heading="Learn Step by Step" sub="Structured courses with free certificates" icon={GraduationCapIcon} height={220} />
        <View style={{ paddingTop: 20, paddingLeft: 16, paddingRight: 16, gap: 12 }}>
          {courses.map((c) => (
            <View
              key={c.id}
              style={{
                backgroundColor: theme.card,
                borderRadius: 16,
                padding: 16,
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 3 },
                elevation: 2,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 14,
                    backgroundColor: theme.primarySoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <GraduationCapIcon size={22} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <T v="h3">{c.title ?? 'Course'}</T>
                  <T v="caption" style={{ marginTop: 3 }}>
                    {c.level ?? 'All levels'} · {c.lessons_count ?? 0} lessons
                  </T>
                </View>
                <ChevronRightIcon size={16} color={theme.subtext} />
              </View>
              {c.description ? (
                <T v="caption" style={{ marginTop: 10, lineHeight: 17 }}>
                  {c.description}
                </T>
              ) : null}
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <StarIcon size={14} color={theme.accent} />
            <T v="caption" style={{ flex: 1 }}>
              {api.isLive() ? 'Progress syncs with your DeenLink account.' : 'Offline — demo courses.'}
            </T>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
