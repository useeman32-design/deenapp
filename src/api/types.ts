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

export interface Scholar {
  id: number;
  user_id?: number;
  display_name?: string | null;
  title?: string | null;
  madhhab?: string | null;
  institute?: string | null;
  fields_of_knowledge?: string | null;
  approval_status?: string | null;
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
}

export interface Post {
  id: number;
  content_text?: string | null;
  youtube_url?: string | null;
  youtube_embed_url?: string | null;
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
