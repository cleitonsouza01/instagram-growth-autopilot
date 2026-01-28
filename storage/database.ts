import Dexie, { type EntityTable } from "dexie";

export interface Prospect {
  id?: number;
  igUserId: string;
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
  action: "like" | "unlike" | "harvest" | "filter";
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

export class AppDatabase extends Dexie {
  prospects!: EntityTable<Prospect, "id">;
  actionLogs!: EntityTable<ActionLog, "id">;
  followerSnapshots!: EntityTable<FollowerSnapshot, "id">;

  constructor() {
    super("InstagramGrowthAutopilot");

    this.version(1).stores({
      prospects: "++id, igUserId, username, source, status, fetchedAt",
      actionLogs: "++id, action, targetUserId, timestamp, success",
      followerSnapshots: "++id, snapshotDate",
    });
  }
}

export const db = new AppDatabase();
