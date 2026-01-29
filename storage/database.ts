import Dexie, { type EntityTable } from "dexie";

export interface Prospect {
  id?: number;
  platformUserId: string;
  username: string;
  fullName: string;
  profilePicUrl: string;
  isPrivate: boolean;
  isVerified: boolean;
  postCount: number;
  followerCount: number;
  followingCount: number;
  source: string; // competitor username that led us here
  fetchedAt: number;
  engagedAt: number | null;
  status: "queued" | "engaged" | "skipped" | "failed";
}

export interface ActionLog {
  id?: number;
  action: "like" | "unlike" | "follow" | "unfollow" | "harvest" | "filter";
  targetUserId: string;
  targetUsername: string;
  mediaId?: string;
  success: boolean;
  error?: string;
  timestamp: number;
}

export interface FollowerSnapshot {
  id?: number;
  snapshotDate: string; // ISO date string
  followerCount: number;
  followingCount: number;
  newFollowers: string[];
  lostFollowers: string[];
}

export interface DailySnapshot {
  id?: number;
  date: string; // ISO date: "2026-01-28"
  followerCount: number;
  followingCount: number;
  postCount: number;
  newFollowers: string[];
  lostFollowers: string[];
  netGrowth: number;
  likesToday: number;
  prospectsEngaged: number;
}

export interface ScheduledPost {
  id?: number;
  type: "photo" | "story" | "carousel";
  caption: string;
  mediaBlobs: ArrayBuffer[];
  locationId: string | null;
  scheduledAt: number;
  status: "scheduled" | "publishing" | "published" | "failed";
  publishedMediaId: string | null;
  error: string | null;
  createdAt: number;
}

export interface DMTemplate {
  id?: number;
  name: string;
  category: "welcome" | "collaboration" | "faq" | "custom";
  body: string;
  variables: string[];
  createdAt: number;
  updatedAt: number;
  usageCount: number;
}

export class AppDatabase extends Dexie {
  prospects!: EntityTable<Prospect, "id">;
  actionLogs!: EntityTable<ActionLog, "id">;
  followerSnapshots!: EntityTable<FollowerSnapshot, "id">;
  dailySnapshots!: EntityTable<DailySnapshot, "id">;
  scheduledPosts!: EntityTable<ScheduledPost, "id">;
  dmTemplates!: EntityTable<DMTemplate, "id">;

  constructor() {
    super("PlatformGrowthAutopilot");

    this.version(1).stores({
      prospects: "++id, platformUserId, username, source, status, fetchedAt",
      actionLogs: "++id, action, targetUserId, timestamp, success",
      followerSnapshots: "++id, snapshotDate",
    });

    this.version(2).stores({
      prospects: "++id, platformUserId, username, source, status, fetchedAt",
      actionLogs: "++id, action, targetUserId, timestamp, success",
      followerSnapshots: "++id, snapshotDate",
      dailySnapshots: "++id, &date",
    });

    this.version(3).stores({
      prospects: "++id, platformUserId, username, source, status, fetchedAt",
      actionLogs: "++id, action, targetUserId, timestamp, success",
      followerSnapshots: "++id, snapshotDate",
      dailySnapshots: "++id, &date",
      scheduledPosts: "++id, status, scheduledAt",
      dmTemplates: "++id, name, category",
    });
  }
}

export const db = new AppDatabase();
