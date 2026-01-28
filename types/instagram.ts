export interface UserProfile {
  pk: string;
  username: string;
  full_name: string;
  biography: string;
  profile_pic_url: string;
  is_private: boolean;
  is_verified: boolean;
  media_count: number;
  follower_count: number;
  following_count: number;
  external_url: string | null;
}

export interface FollowerInfo {
  pk: string;
  username: string;
  full_name: string;
  profile_pic_url: string;
  is_private: boolean;
  is_verified: boolean;
}

export interface MediaItem {
  id: string;
  pk: string;
  media_type: number; // 1=photo, 2=video, 8=carousel
  caption: { text: string } | null;
  like_count: number;
  comment_count: number;
  taken_at: number;
  has_liked: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  next_max_id: string | null;
  has_more: boolean;
}

export interface FriendshipStatus {
  following: boolean;
  followed_by: boolean;
  blocking: boolean;
  is_private: boolean;
  incoming_request: boolean;
  outgoing_request: boolean;
}

export interface LikeResponse {
  status: "ok" | "fail";
  spam?: boolean;
}
