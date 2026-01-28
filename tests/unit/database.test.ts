import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import Dexie, { type EntityTable } from "dexie";

// Re-define interfaces locally to avoid importing the module-level singleton
interface Prospect {
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
  source: string;
  fetchedAt: number;
  engagedAt: number | null;
  status: "queued" | "engaged" | "skipped" | "failed";
}

interface ActionLog {
  id?: number;
  action: "like" | "unlike" | "harvest" | "filter";
  targetUserId: string;
  targetUsername: string;
  mediaId?: string;
  success: boolean;
  error?: string;
  timestamp: number;
}

interface FollowerSnapshot {
  id?: number;
  snapshotDate: string;
  followerCount: number;
  followingCount: number;
  newFollowers: string[];
  lostFollowers: string[];
}

let testCounter = 0;

function createTestDb() {
  testCounter++;
  const db = new Dexie(`TestDB_${testCounter}`) as Dexie & {
    prospects: EntityTable<Prospect, "id">;
    actionLogs: EntityTable<ActionLog, "id">;
    followerSnapshots: EntityTable<FollowerSnapshot, "id">;
  };

  db.version(1).stores({
    prospects: "++id, igUserId, username, source, status, fetchedAt",
    actionLogs: "++id, action, targetUserId, timestamp, success",
    followerSnapshots: "++id, snapshotDate",
  });

  return db;
}

describe("AppDatabase", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(async () => {
    db.close();
    await Dexie.delete(db.name);
  });

  describe("prospects", () => {
    const makeProspect = (overrides: Partial<Prospect> = {}): Omit<Prospect, "id"> => ({
      igUserId: "12345",
      username: "testuser",
      fullName: "Test User",
      profilePicUrl: "https://example.com/pic.jpg",
      isPrivate: false,
      isVerified: false,
      postCount: 50,
      followerCount: 1000,
      followingCount: 500,
      source: "competitor1",
      fetchedAt: Date.now(),
      engagedAt: null,
      status: "queued",
      ...overrides,
    });

    it("adds a prospect and retrieves it", async () => {
      const id = await db.prospects.add(makeProspect());
      const prospect = await db.prospects.get(id);

      expect(prospect).toBeDefined();
      expect(prospect?.username).toBe("testuser");
      expect(prospect?.igUserId).toBe("12345");
    });

    it("deduplicates by igUserId via query", async () => {
      await db.prospects.add(makeProspect());
      const existing = await db.prospects
        .where("igUserId")
        .equals("12345")
        .first();

      expect(existing).toBeDefined();
      expect(existing?.username).toBe("testuser");
    });

    it("queries by status", async () => {
      await db.prospects.add(makeProspect());
      await db.prospects.add(
        makeProspect({
          igUserId: "67890",
          username: "user2",
          status: "engaged",
        }),
      );

      const queued = await db.prospects
        .where("status")
        .equals("queued")
        .toArray();
      expect(queued).toHaveLength(1);
      expect(queued[0]?.username).toBe("testuser");
    });

    it("queries prospects in FIFO order by fetchedAt", async () => {
      await db.prospects.add(
        makeProspect({ igUserId: "1", username: "first", fetchedAt: 1000 }),
      );
      await db.prospects.add(
        makeProspect({ igUserId: "2", username: "second", fetchedAt: 2000 }),
      );
      await db.prospects.add(
        makeProspect({ igUserId: "3", username: "third", fetchedAt: 3000 }),
      );

      const ordered = await db.prospects
        .where("status")
        .equals("queued")
        .sortBy("fetchedAt");

      expect(ordered[0]?.username).toBe("first");
      expect(ordered[1]?.username).toBe("second");
      expect(ordered[2]?.username).toBe("third");
    });
  });

  describe("actionLogs", () => {
    it("logs an action", async () => {
      const id = await db.actionLogs.add({
        action: "like",
        targetUserId: "12345",
        targetUsername: "testuser",
        mediaId: "media_001",
        success: true,
        timestamp: Date.now(),
      });
      const entry = await db.actionLogs.get(id);

      expect(entry).toBeDefined();
      expect(entry?.action).toBe("like");
      expect(entry?.success).toBe(true);
    });

    it("queries actions by timestamp range", async () => {
      const now = Date.now();
      await db.actionLogs.bulkAdd([
        {
          action: "like",
          targetUserId: "1",
          targetUsername: "u1",
          success: true,
          timestamp: now - 3600000,
        },
        {
          action: "like",
          targetUserId: "2",
          targetUsername: "u2",
          success: true,
          timestamp: now - 1800000,
        },
        {
          action: "like",
          targetUserId: "3",
          targetUsername: "u3",
          success: false,
          timestamp: now,
        },
      ]);

      const recent = await db.actionLogs
        .where("timestamp")
        .above(now - 2000000)
        .toArray();

      expect(recent).toHaveLength(2);
    });
  });

  describe("followerSnapshots", () => {
    it("stores and retrieves a snapshot", async () => {
      const id = await db.followerSnapshots.add({
        snapshotDate: "2026-01-28",
        followerCount: 5000,
        followingCount: 300,
        newFollowers: ["user1", "user2"],
        lostFollowers: ["user3"],
      });

      const snapshot = await db.followerSnapshots.get(id);
      expect(snapshot?.followerCount).toBe(5000);
      expect(snapshot?.newFollowers).toHaveLength(2);
    });
  });
});
