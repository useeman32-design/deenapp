import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { TopBar } from '@/components/TopBar';
import { T } from '@/components/T';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { haptic } from '@/lib/haptics';
import { safeOpenUrl } from '@/lib/safeUrl';
import * as api from '@/api/client';

/**
 * Apply as a scholar (pass 89).
 *
 * Why this screen exists: until now a scholar application could ONLY be made
 * inside sign-up (src/app/(auth)/register.tsx). Anyone who joined as a normal
 * user had no way to ask to be verified, and the Ask Scholars roster stayed
 * empty ("scholar: nothing new"). This screen posts the same
 * api/auth/scholar_apply.php the register flow uses — one document required,
 * idempotent on the server while the row is pending — and shows the live
 * approval state from api/users/get_scholar_me.php, so the applicant can see
 * pending / approved / rejected and the reviewer's note.
 */

const FIELDS = ['Fiqh', 'Aqeedah', 'Hadith', 'Tafsir', 'Taharah', 'Salah', 'Zakah', 'Marriage', 'Inheritance', 'Youth'];
const MADHHABS = ['Ḥanafī', 'Mālikī', 'Shāfiʿī', 'Ḥanbalī', 'Ẓāhirī', 'None'];
const AQEEDAH = ['Ahl al-Sunnah', 'Other (explain below)'];
const STATUS_LABEL: Record<string, { text: string; color: string; icon: string }> = {
  pending: { text: 'UNDER REVIEW', color: '#E8C96A', icon: 'hourglass-half' },
  reviewing: { text: 'UNDER REVIEW', color: '#E8C96A', icon: 'hourglass-half' },
  approved: { text: 'APPROVED', color: '#4AE38F', icon: 'badge-check' },
  rejected: { text: 'REJECTED', color: '#F58FB0', icon: 'times-circle' },
};

type Doc = { uri: string; name: string } | null;

export default function ScholarApplyScreen() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const { user: me } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [institute, setInstitute] = useState('');
  const [years, setYears] = useState('');
  const [teachers, setTeachers] = useState('');
  const [madhhab, setMadhhab] = useState<string>('Ḥanafī');
  const [aqeedah, setAqeedah] = useState<string>('Ahl al-Sunnah');
  const [fields, setFields] = useState<string[]>([]);
  const [fieldsOther, setFieldsOther] = useState('');
  const [proof, setProof] = useState<Doc>(null);
  const [letter, setLetter] = useState<Doc>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mine, setMine] = useState<Record<string, unknown> | null>(null);
  const [loadingState, setLoadingState] = useState(true);
  const [aqeedahOther, setAqeedahOther] = useState('');

  const accent = isDark ? '#4AE38F' : '#1D6F42';
  const loggedIn = Boolean((me as { id?: number } | null)?.id);

  const loadMine = useCallback(async () => {
    if (!loggedIn) { setLoadingState(false); return; }
    const r = await api.scholarStatus().catch(() => ({ ok: false, scholar: null as Record<string, unknown> | null }));
    setMine(r.scholar ?? null);
    if (r.scholar) {
      /* pass 95 — this only ever restored four of the fields, so a rejected
       * applicant fixing his application saw a half-empty form ("the info is
       * half of the registration"). Every submitted value is restored now:
       * name, madhhab, aqeedah, teachers, phone, institute, years, fields. */
      setDisplayName(String(r.scholar.display_name ?? ''));
      setInstitute(String(r.scholar.institute ?? ''));
      setPhone(String(r.scholar.phone ?? ''));
      setTeachers(String(r.scholar.teachers ?? ''));
      const mh = String(r.scholar.madhhab ?? '');
      if (mh && MADHHABS.includes(mh)) { setMadhhab(mh); }
      const aq = String(r.scholar.aqeedah ?? '');
      if (aq) { setAqeedah(AQEEDAH.includes(aq) ? aq : AQEEDAH[1]); if (!AQEEDAH.includes(aq)) { setAqeedahOther(aq); } }
      const y = Number(r.scholar.years_of_study ?? 0);
      if (y > 0) { setYears(String(y)); }
      const raw = r.scholar.fields_of_knowledge;
      const arr = Array.isArray(raw)
        ? (raw as unknown[]).map(String)
        : typeof raw === 'string'
          ? (() => { try { const p = JSON.parse(raw || '[]'); return Array.isArray(p) ? (p as unknown[]).map(String) : String(raw).split(',').map((s) => s.trim()); } catch { return String(raw).split(',').map((s) => s.trim()); } })()
          : [];
      const list = arr.map((s) => String(s).trim()).filter(Boolean);
      setFields(list.filter((x) => FIELDS.includes(x)));
      setFieldsOther(list.filter((x) => !FIELDS.includes(x)).join(', '));
    }
    setLoadingState(false);
  }, [loggedIn]);

  useEffect(() => { void loadMine(); }, [loadMine]);
  useEffect(() => {
    if (!displayName) { setDisplayName(String((me as { full_name?: string } | null)?.full_name ?? '')); }
  }, [me, displayName]);

  const status = String(mine?.approval_status ?? '').toLowerCase();
  const alreadyApproved = status === 'approved';

  const pick = async (which: 'proof' | 'letter') => {
    haptic.light();
    try {
      const { launchImageLibraryAsync } = await import('expo-image-picker');
      const res = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: false });
      if (res.canceled || !res.assets?.length) { return; }
      const a = res.assets[0];
      const doc = { uri: a.uri, name: a.fileName || `${which}.jpg` };
      if (which === 'proof') { setProof(doc); } else { setLetter(doc); }
      setMsg(null);
    } catch {
      setMsg({ ok: false, text: 'Your phone did not let the app open the gallery — pick a photo of the document instead of a PDF.' });
    }
  };

  const valid = displayName.trim().length > 2 && (proof !== null || letter !== null);
  const notes = String(mine?.approval_notes ?? '').trim();

  const banner = useMemo(() => {
    if (loadingState) { return null; }
    if (!mine) { return null; }
    const tone = alreadyApproved ? accent : status === 'rejected' ? '#F58FB0' : '#E8C96A';
    const label = alreadyApproved
      ? 'Approved — you are on the scholar roster.'
      : status === 'rejected'
        ? 'Not approved. Read the note below, fix the application and send it again.'
        : 'With the verification team. They review the document you attached after your email is confirmed.';
    return (
      <View style={{ borderRadius: 17, borderWidth: 1, borderColor: tone + '66', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', padding: 14, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <FontAwesome5 name={alreadyApproved ? 'badge-check' : status === 'rejected' ? 'exclamation-circle' : 'hourglass-half'} size={13} color={tone} />
          <T v="caption" style={{ fontSize: 10.5, fontWeight: '900', letterSpacing: 0.6, color: tone }}>APPLICATION · {status.toUpperCase() || 'PENDING'}</T>
        </View>
        <T v="bodyS" style={{ fontSize: 12, lineHeight: 18, color: d.text, marginTop: 7 }}>{label}</T>
        {notes ? <T v="bodyS" style={{ fontSize: 11.5, lineHeight: 17, color: d.subtext, marginTop: 6 }}>Note: {notes}</T> : null}
        {!alreadyApproved ? (
          <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 8 }}>
            Re-sending updates the same application — it does not create a second queue ticket.
          </T>
        ) : (
          <Pressable onPress={() => { haptic.light(); router.push('/tools/scholar-inbox'); }} style={{ marginTop: 11, alignSelf: 'flex-start', borderRadius: 11, backgroundColor: accent, paddingHorizontal: 13, paddingVertical: 9 }}>
            <T v="caption" style={{ fontSize: 10.5, fontWeight: '900', color: '#04170D' }}>Open my scholar desk</T>
          </Pressable>
        )}
      </View>
    );
  }, [loadingState, mine, status, alreadyApproved, accent, isDark, d, notes]);

  const send = async () => {
    if (!valid || busy) { return; }
    haptic.light();
    setBusy(true);
    setMsg(null);
    const all = [...fields, ...fieldsOther.split(',').map((x) => x.trim()).filter(Boolean)];
    const out = await api.scholarApply({
      display_name: displayName.trim(),
      phone: phone.trim() || undefined,
      fields: all,
      other_field: undefined,
      madhhab: madhhab === 'None' ? undefined : madhhab,
      institute: institute.trim() || undefined,
      years: years ? Number(years) || undefined : undefined,
      teachers: teachers.trim() || undefined,
      /* pass 95 — "Other (explain below)" needs its own box; joining the
       * teacher names into the aqeedah field (the old behaviour) corrupted
       * both answers. */
      aqeedah: aqeedah === 'Other (explain below)' ? (aqeedahOther.trim() || 'Other') : aqeedah,
      proof,
      letter,
    }).catch((e: unknown) => ({ ok: false, message: String(e) }));
    setBusy(false);
    if (out.ok) {
      setMsg({ ok: true, text: 'Sent. Your application and document are with the verification team — this page now shows their decision.' });
      void loadMine();
    } else {
      setMsg({ ok: false, text: out.message || 'Could not upload. Check your connection and send it again — nothing is lost.' });
    }
  };

  const input = (f: boolean) => ({
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 13,
    color: d.text,
    backgroundColor: d.bgSoft,
    borderColor: f ? accent : d.cardBorder,
  });
  const [focus, setFocus] = useState<string | null>(null);
  const chip = (on: boolean) => ({
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderColor: on ? accent : d.cardBorder,
    backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.14)' : 'rgba(29,111,66,0.08)') : 'transparent',
  });
  const Label = ({ children }: { children: string }) => (
    <T v="caption" style={{ fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6, color: d.faint, marginTop: 14, marginBottom: 6 }}>{children}</T>
  );

  /* pass 95 — owner: "the in-review application still opens EDITABLE — make it
   * view-only, show exactly what he submitted, and show the FULL items; a
   * rejected one must show Rejected".
   *
   * While an application is with the verification team (or has been approved)
   * this screen is now a read-only summary of the whole registration — every
   * field the applicant filled, the documents he uploaded (openable) and the
   * reviewer's note. Only a REJECTED application falls through to the form,
   * because that is the one case where he must be able to fix and resend. */
  const inReviewOrApproved = status === 'pending' || status === 'reviewing' || alreadyApproved;

  if (mine && inReviewOrApproved) {
    const str = (k: string) => {
      const v = mine[k];
      return typeof v === 'string' ? v.trim() : v == null ? '' : String(v);
    };
    const fieldList = Array.isArray(mine.fields)
      ? (mine.fields as unknown[]).map(String).filter((x) => x.trim() !== '')
      : str('fields_of_knowledge_list').split(',').map((x) => x.trim()).filter(Boolean);
    const badge = STATUS_LABEL[status] ?? STATUS_LABEL.pending;
    const badgeColor = !isDark && badge.color === '#4AE38F' ? '#1D6F42' : badge.color;
    const certUrl = str('certificate_url') || str('certificate_path');
    const recUrl = str('recommendation_url') || str('recommendation_path');
    const when = (v: string) => {
      if (!v) return '';
      const t = Date.parse(v.replace(' ', 'T'));
      return Number.isNaN(t) ? v : new Date(t).toLocaleDateString();
    };
    const rows: Array<[string, string]> = [
      ['SCHOLAR NAME SHOWN TO THE COMMUNITY', str('display_name') || str('title')],
      ['FIELDS YOU ANSWER IN', fieldList.join(', ')],
      ['OTHER FIELD', str('other_field')],
      ['SCHOOL / INSTITUTE', str('institute')],
      ['YEARS OF STUDY', str('years_of_study')],
      ['MAIN SCHOOL OF LAW', str('madhhab')],
      ['AQEEDAH', str('aqeedah')],
      ['TEACHERS', str('teachers')],
      ['PHONE', str('phone')],
      ['SUBMITTED', when(str('created_at'))],
      ['REVIEWED', when(str('reviewed_at'))],
    ];
    return (
      <View style={{ flex: 1, backgroundColor: d.bg }}>
        <TopBar showBack title={alreadyApproved ? 'My scholar account' : 'My scholar application'} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: (insets.bottom ?? 0) + 40 }}>
          <View style={{ borderRadius: 17, borderWidth: 1, borderColor: badgeColor + '66', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', padding: 14, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <FontAwesome5 name={badge.icon as never} size={13} color={badgeColor} />
              <T v="caption" style={{ fontSize: 10.5, fontWeight: '900', letterSpacing: 0.6, color: badgeColor }}>{badge.text}</T>
            </View>
            <T v="bodyS" style={{ fontSize: 12, lineHeight: 18, color: d.text, marginTop: 7 }}>
              {alreadyApproved
                ? 'Approved — you are on the scholar roster. This is what the community sees about you.'
                : 'This is exactly what you submitted. It stays read-only while the verification team reviews it — nothing here can be changed from the app.'}
            </T>
          </View>

          <T v="caption" style={{ fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6, color: d.faint, marginBottom: 8 }}>WHAT YOU SUBMITTED</T>
          <View style={{ borderRadius: 17, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 14, paddingVertical: 4 }}>
            {rows.filter(([, v]) => String(v).trim() !== '').map(([label, value], i, arr) => (
              <View key={label} style={{ paddingVertical: 11, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: d.cardBorder }}>
                <T v="caption" style={{ fontSize: 9, fontWeight: '900', letterSpacing: 0.5, color: d.faint }}>{label}</T>
                <T v="bodyS" style={{ fontSize: 13, lineHeight: 19, color: d.text, marginTop: 3 }}>{String(value)}</T>
              </View>
            ))}
            {fieldList.length === 0 ? (
              <View style={{ paddingVertical: 11 }}>
                <T v="caption" style={{ fontSize: 9, fontWeight: '900', letterSpacing: 0.5, color: d.faint }}>FIELDS YOU ANSWER IN</T>
                <T v="bodyS" style={{ fontSize: 12, color: d.faint, marginTop: 3 }}>Not recorded on this application.</T>
              </View>
            ) : null}
          </View>

          <T v="caption" style={{ fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6, color: d.faint, marginTop: 16, marginBottom: 8 }}>DOCUMENTS</T>
          {certUrl || recUrl ? (
            <View style={{ flexDirection: 'row', gap: 9 }}>
              {certUrl ? (
                <Pressable onPress={() => { haptic.selection(); safeOpenUrl(certUrl); }} style={{ flex: 1, borderRadius: 13, borderWidth: 1, borderColor: accent, padding: 12 }}>
                  <FontAwesome5 name="file-alt" size={14} color={accent} />
                  <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: d.text, marginTop: 7 }}>Certificate / ijāzah</T>
                  <T v="caption" style={{ fontSize: 9.5, color: accent, marginTop: 3 }}>Open document</T>
                </Pressable>
              ) : null}
              {recUrl ? (
                <Pressable onPress={() => { haptic.selection(); safeOpenUrl(recUrl); }} style={{ flex: 1, borderRadius: 13, borderWidth: 1, borderColor: accent, padding: 12 }}>
                  <FontAwesome5 name="file-signature" size={14} color={accent} />
                  <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: d.text, marginTop: 7 }}>Recommendation</T>
                  <T v="caption" style={{ fontSize: 9.5, color: accent, marginTop: 3 }}>Open document</T>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={{ borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bgSoft, padding: 12 }}>
              <T v="caption" style={{ fontSize: 10.5, color: d.faint }}>No document is attached to this application on the server.</T>
            </View>
          )}

          {str('approval_notes') ? (
            <View style={{ marginTop: 16, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(232,201,106,0.5)', backgroundColor: isDark ? 'rgba(232,201,106,0.08)' : 'rgba(212,175,55,0.07)', padding: 12 }}>
              <T v="caption" style={{ fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5, color: '#E8C96A' }}>NOTE FROM THE REVIEW TEAM</T>
              <T v="bodyS" style={{ fontSize: 12, lineHeight: 18, color: d.text, marginTop: 5 }}>{str('approval_notes')}</T>
            </View>
          ) : null}

          {alreadyApproved ? (
            <Pressable onPress={() => { haptic.light(); router.push('/tools/scholar-inbox'); }} style={{ marginTop: 18, borderRadius: 14, backgroundColor: accent, paddingVertical: 14, alignItems: 'center' }}>
              <T v="caption" style={{ fontSize: 12.5, fontWeight: '900', letterSpacing: 0.4, color: '#04170D' }}>Open my scholar desk</T>
            </Pressable>
          ) : (
            <T v="caption" style={{ fontSize: 10, lineHeight: 15, color: d.faint, marginTop: 16 }}>
              The verification team reviews the document you attached. You will get an email at {str('email') || 'your address'} when a decision is made.
            </T>
          )}
        </ScrollView>
      </View>
    );
  }

  if (!loggedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: d.bg }}>
        <TopBar showBack title="Apply as a scholar" />
        <View style={{ padding: 20 }}>
          <T v="h3" style={{ fontSize: 16, fontWeight: '800', color: d.text }}>Sign in first</T>
          <T v="bodyS" style={{ fontSize: 12.5, lineHeight: 19, color: d.subtext, marginTop: 8 }}>
            Scholar applications are tied to a verified DeenLink account. Sign in (or create an account and choose “Scholar” during sign-up), then come back here to send your qualifications.
          </T>
          <Pressable onPress={() => { haptic.light(); router.push('/(auth)/login'); }} style={{ marginTop: 16, alignSelf: 'flex-start', borderRadius: 12, backgroundColor: accent, paddingHorizontal: 15, paddingVertical: 11 }}>
            <T v="caption" style={{ fontSize: 11.5, fontWeight: '900', color: '#04170D' }}>Sign in</T>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar showBack title="Apply as a scholar" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: (insets.bottom ?? 0) + 90 }} keyboardShouldPersistTaps="handled">
          <T v="bodyS" style={{ fontSize: 12, lineHeight: 18, color: d.subtext, marginBottom: 14 }}>
            DeenLink answers are given by people with studied credentials. Send your qualifications and one document — a certificate, an ijāzah, or a letter from a teacher or institute — and the verification team will review it. Approved scholars appear in the Ask Scholars roster and receive questions in the app.
          </T>

          {banner}

          <Label>SCHOLAR NAME SHOWN TO THE COMMUNITY</Label>
          <TextInput value={displayName} onChangeText={setDisplayName} placeholder="Shaykh / Ustādh name" placeholderTextColor={d.faint} style={input(focus === 'n')} onFocus={() => setFocus('n')} onBlur={() => setFocus(null)} />

          <Label>FIELDS YOU ANSWER IN</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {FIELDS.map((f) => {
              const on = fields.includes(f);
              return (
                <Pressable key={f} onPress={() => { haptic.selection(); setFields(on ? fields.filter((x) => x !== f) : [...fields, f]); }} style={chip(on)}>
                  <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: on ? accent : d.subtext }}>{on ? '✓ ' : ''}{f}</T>
                </Pressable>
              );
            })}
          </View>
          <TextInput value={fieldsOther} onChangeText={setFieldsOther} placeholder="Anything else, comma separated (optional)" placeholderTextColor={d.faint} style={{ ...input(focus === 'fo'), marginTop: 9 }} onFocus={() => setFocus('fo')} onBlur={() => setFocus(null)} />

          <Label>SCHOOL / INSTITUTE</Label>
          <TextInput value={institute} onChangeText={setInstitute} placeholder="e.g. Islamic University of Madinah, Al-Azhar, local halaqah" placeholderTextColor={d.faint} style={input(focus === 'i')} onFocus={() => setFocus('i')} onBlur={() => setFocus(null)} />

          <Label>YEARS OF STUDY</Label>
          <TextInput value={years} onChangeText={(t) => setYears(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="7" placeholderTextColor={d.faint} style={{ ...input(focus === 'y'), maxWidth: 120 }} onFocus={() => setFocus('y')} onBlur={() => setFocus(null)} />

          <Label>MAIN SCHOOL OF LAW</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {MADHHABS.map((m) => (
              <Pressable key={m} onPress={() => { haptic.selection(); setMadhhab(m); }} style={chip(madhhab === m)}>
                <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: madhhab === m ? accent : d.subtext }}>{m}</T>
              </Pressable>
            ))}
          </View>

          <Label>AQeedah</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {AQEEDAH.map((a) => (
              <Pressable key={a} onPress={() => { haptic.selection(); setAqeedah(a); }} style={chip(aqeedah === a)}>
                <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: aqeedah === a ? accent : d.subtext }}>{aqeedah === a ? '✓ ' : ''}{a}</T>
              </Pressable>
            ))}
          </View>

          {aqeedah === 'Other (explain below)' ? (
            <>
              <Label>IF NOT AHL AL-SUNNAH, EXPLAIN</Label>
              <TextInput
                value={aqeedahOther}
                onChangeText={setAqeedahOther}
                placeholder="Describe it in your own words"
                placeholderTextColor={d.faint}
                style={{ ...input(focus === 'ao'), minHeight: 64, textAlignVertical: 'top' }}
                onFocus={() => setFocus('ao')}
                onBlur={() => setFocus(null)}
              />
            </>
          ) : null}

          <Label>TEACHERS (WHO YOU STUDIED WITH)</Label>
          <TextInput value={teachers} onChangeText={setTeachers} multiline placeholder="Names, one per line" placeholderTextColor={d.faint} style={{ ...input(focus === 't'), minHeight: 76, textAlignVertical: 'top' }} onFocus={() => setFocus('t')} onBlur={() => setFocus(null)} />

          <Label>PHONE (OPTIONAL, FOR THE REVIEW TEAM)</Label>
          <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+234…" placeholderTextColor={d.faint} style={input(focus === 'p')} onFocus={() => setFocus('p')} onBlur={() => setFocus(null)} />

          {/* pass 90 — owner: "remove the dawah platforms from there, links to
           * dawah platforms are not required". A scholar is verified by what
           * they studied and who vouches for them, not by their channel count. */}

          <Label>DOCUMENT — CERTIFICATE, IJĀZAH OR RECOMMENDATION LETTER</Label>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            {([['proof', 'Certificate / ijāzah', proof], ['letter', 'Recommendation letter', letter]] as const).map(([which, label, doc]) => (
              <Pressable key={which} onPress={() => void pick(which as 'proof' | 'letter')} style={{ flex: 1, borderRadius: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: doc ? accent : d.cardBorder, backgroundColor: doc ? (isDark ? 'rgba(46,204,113,0.1)' : 'rgba(29,111,66,0.06)') : d.bgSoft, padding: 12 }}>
                <FontAwesome5 name={doc ? 'check-circle' : 'file-upload'} size={14} color={doc ? accent : d.faint} />
                <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: d.text, marginTop: 7 }}>{label}</T>
                <T v="caption" numberOfLines={1} style={{ fontSize: 9.5, color: d.faint, marginTop: 3 }}>{doc ? doc.name : 'photo · optional'}</T>
              </Pressable>
            ))}
          </View>
          <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 8, lineHeight: 15 }}>
            One readable photo is enough. A clear picture of a paper certificate works — the team only needs to be able to read it.
          </T>

          {msg ? (
            <View style={{ marginTop: 14, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, borderColor: msg.ok ? accent : '#F58FB0' }}>
              <T v="caption" style={{ fontSize: 11, lineHeight: 16, color: msg.ok ? accent : '#F58FB0' }}>{msg.text}</T>
            </View>
          ) : null}

          <Pressable
            disabled={!valid || busy}
            onPress={() => void send()}
            style={{ marginTop: 18, borderRadius: 14, backgroundColor: valid && !busy ? accent : isDark ? 'rgba(255,255,255,0.08)' : '#d7d7d7', paddingVertical: 14, alignItems: 'center', opacity: valid ? 1 : 0.7 }}
          >
            {busy ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color="#04170D" />
                <T v="caption" style={{ fontSize: 12, fontWeight: '900', color: '#04170D' }}>Uploading your document…</T>
              </View>
            ) : (
              <T v="caption" style={{ fontSize: 12.5, fontWeight: '900', letterSpacing: 0.4, color: valid ? '#04170D' : d.faint }}>
                {mine ? 'Send the updated application' : 'Send my application'}
              </T>
            )}
          </Pressable>
          {!valid ? (
            <T v="caption" style={{ fontSize: 10.5, color: d.faint, textAlign: 'center', marginTop: 9 }}>
              {displayName.trim().length > 2 ? 'Attach one document to send the application.' : 'Add the name the community will see, and one document.'}
            </T>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
