import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as api from '@/api/client';
import type { Course } from '@/api/types';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { Surface } from '@/components/Surface';
import { ChevronRightIcon, GraduationCapIcon, MedalIcon, PlayIcon, SparkleIcon } from '@/components/Icons';

export default function Learning() {
  const { theme } = useTheme();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    api.courses().then(setCourses);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Learning" subtitle="Courses, quiz & DeenLink AI" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        {/* Featured tiles */}
        <View style={{ flexDirection: 'row', gap: 9, marginBottom: 20 }}>
          <Pressable
            onPress={() => router.push('/tools/quiz')}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: theme.card,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: theme.border,
              padding: 15,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.goldSoft, alignItems: 'center', justifyContent: 'center' }}>
              <MedalIcon size={19} color={theme.accent} />
            </View>
            <T v="h3" style={{ marginTop: 10 }}>Quiz</T>
            <T v="caption" style={{ marginTop: 3, lineHeight: 16 }}>Test your deen knowledge</T>
          </Pressable>
          <Pressable
            onPress={() => {}}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: theme.card,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: theme.border,
              padding: 15,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <SparkleIcon size={19} color={theme.accent} />
            </View>
            <T v="h3" style={{ marginTop: 10 }}>DeenLink AI</T>
            <T v="caption" style={{ marginTop: 3, lineHeight: 16 }}>Ask, learn, get answers</T>
          </Pressable>
        </View>

        {/* Courses */}
        <T v="h2" style={{ marginBottom: 11 }}>
          Courses
        </T>
        {courses.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => {}}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.card,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: theme.border,
              padding: 13,
              marginBottom: 9,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                backgroundColor: theme.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <GraduationCapIcon size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <T v="h3">{c.title ?? 'Course'}</T>
              <T v="caption" style={{ marginTop: 3, lineHeight: 16 }}>
                {c.level ?? 'All levels'} · {c.lessons_count ?? 0} lessons
              </T>
            </View>
            <ChevronRightIcon size={15} color={theme.subtext} />
          </Pressable>
        ))}

        <Surface style={{ marginTop: 6, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
          <PlayIcon size={18} color={theme.primary} />
          <T v="caption" style={{ flex: 1, marginLeft: 10, lineHeight: 16 }}>
            {api.isLive() ? 'Lessons sync with your account progress.' : 'Offline — demo courses. Connects to /api/courses/*.'}
          </T>
        </Surface>
      </ScrollView>
    </View>
  );
}
