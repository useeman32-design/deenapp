/**
 * Types mirroring the DeenLink OpenAPI contract
 * (api/deenlink-openapi.yaml — see repo root).
 */

export type BadgeType = 'blue' | 'green' | 'gold' | null | '';

export interface User {
  id: number;
  username: string;
  email?: string;
  full_name?: string;
  user_type?: string;
  profile_image?: string | number | null;
  profile_image_url?: string | number | null;
  bio?: string | null;
  gender?: string | null;
  country?: string | null;
  deenpoints_balance?: number;
  is_email_verified?: number;
  account_status?: string;
  verification_badge?: BadgeType;
  scholar?: Scholar | null;
  [k: string]: unknown;
}

/**
 * A scholar on the Ask-Scholars roster.
 *
 * pass 95 — this type only carried the column names of the `scholars` TABLE,
 * while api/questions/scholars.php sends the roster SHAPE (`name`, `image`,
 * `expertise[]`, `description`). The browse screen filtered on
 * `fields_of_knowledge` and read `photo` / `institute` / `madhhab`, so choosing
 * any category emptied the whole roster and no scholar ever showed a picture —
 * the owner's "the scholar I registered doesn't show / scholars are not
 * showing". Both shapes are declared here and normaliseScholar() below maps the
 * server variant onto the app variant, so the screen works against the current
 * live API and the enriched one.
 */
export interface Scholar {
  id: number;
  user_id?: number;
  name?: string | null;
  display_name?: string | null;
  username?: string | null;
  title?: string | null;
  madhhab?: string | null;
  institute?: string | null;
  aqeedah?: string | null;
  level?: string | null;
  level_label?: string | null;
  country?: string | null;
  tribe?: string | null;
  /** Comma string of the fields the scholar answers in. */
  fields_of_knowledge?: string | null;
  /** Array form sent by the roster endpoint. */
  expertise?: string[] | string | null;
  photo?: string | null;
  image?: string | null;
  profile_image_url?: string | null;
  description?: string | null;
  response_time?: string | null;
  verification_badge?: string | null;
  pending_count?: number;
  approval_status?: string | null;
  /* — the signed-in scholar's own application (get_scholar_me.php) — */
  phone?: string | null;
  other_field?: string | null;
  years_of_study?: number | null;
  teachers?: string | null;
  certificate_path?: string | null;
  certificate_url?: string | null;
  recommendation_path?: string | null;
  recommendation_url?: string | null;
  verification_links?: string | null;
  approval_notes?: string | null;
  reviewed_at?: string | null;
  created_at?: string | null;
  fields?: string[] | null;
  fields_of_knowledge_list?: string | null;
  status?: string | null;
  [k: string]: unknown;
}

export interface PostMedia {
  type?: string;
  url?: string | number;
  thumb_url?: string;
  [k: string]: unknown;
}

export interface PublicQA {
  question?: string;
  answer?: string;
  [k: string]: unknown;
}

export interface PollOption {
  id: number;
  text: string;
  votes: number;
}

export interface PostPoll {
  question?: string;
  options: PollOption[];
  /** Poll length in hours (composer picker). */
  duration?: number;
  /** pass 66-night — server polls carry whose-voted-what so the card opens voted. */
  voted?: number | null;
}

export interface Post {
  id: number;
  content_text?: string | null;
  youtube_url?: string | null;
  youtube_embed_url?: string | null;
  /* pass 83-24 — Facebook-style feed: group posts mix in, labelled */
  group_id?: number | null;
  group_name?: string | null;
  /** community image post — a picked/local photo (not a reel) */
  image_url?: string | null;
  /** community video post — a picked/local video file (not a reel) */
  video_url?: string | null;
  video_poster?: number | { uri: string } | null;
  created_at?: string;
  time_ago?: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  following_by_me?: boolean;
  is_public_qa?: boolean;
  public_qa?: PublicQA | null;
  poll?: PostPoll | null;
  user: User;
  media?: PostMedia[];
  audio_url?: string | null; /* pass 83-10c — group audio uploads */
  [k: string]: unknown;
}

export type FeedTab = 'for-you' | 'following' | 'scholars';

export interface FeedResponse {
  status: string;
  posts: Post[];
  next_cursor?: number | null;
  empty_reason?: string;
  empty_title?: string;
  empty_message?: string;
}

export interface Video {
  id: number;
  video_type?: string;
  source_type?: string;
  source_url?: string | null;
  poster_url?: string | null;
  title?: string | null;
  description?: string | null;
  duration?: string | number | null;
  view_count?: number;
  like_count?: number;
  /* pass 70 — the videos API shapes rows in camelCase (see list.php shaper) */
  videoType?: string;
  sourceUrl?: string | null;
  posterUrl?: string | null;
  accountName?: string | null;
  accountUsername?: string | null;
  accountPic?: string | null;
  likes?: number;
  comments?: number;
  views?: number;
  reposts?: number;
  likedByMe?: boolean;
  repostedByMe?: boolean;
  savedByMe?: boolean;
  [k: string]: unknown;
}

export interface Course {
  id: number;
  title?: string;
  slug?: string;
  description?: string;
  cover_image?: string | null;
  level?: string;
  lessons_count?: number;
  [k: string]: unknown;
}

export interface PrayerTimesResponse {
  status: string;
  times?: {
    fajr?: string;
    sunrise?: string;
    dhuhr?: string;
    asr?: string;
    maghrib?: string;
    isha?: string;
    [k: string]: string | undefined;
  };
  date?: string;
  [k: string]: unknown;
}
