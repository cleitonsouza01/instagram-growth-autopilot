import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import Dexie, { type EntityTable } from "dexie";

// We test queue logic directly against a test database to avoid
// importing the module-level singleton from storage/database.ts

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

let testCounter = 0;

function createTestDb() {
  testCounter++;
  const db = new Dexie(`QueueTestDB_${testCounter}`) as Dexie & {
    prospects: EntityTable<Prospect, "id">;
  };
  db.version(1).stores({
    prospects: "++id, igUserId, username, source, status, fetchedAt",
  });
  return db;
}

function makeProspect(overrides: Partial<Prospect> = {}): Omit<Prospect, "id"> {
  return {
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
  };
}

describe("Engagement Queue Logic", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(async () => {
    db.close();
    await Dexie.delete(db.name);
  });

  describe("getNextProspect (FIFO)", () => {
    it("returns null when queue is empty", async () => {
      const next = await db.prospects
        .where("status")
        .equals("queued")
        .sortBy("fetchedAt");
      expect(next[0]).toBeUndefined();
    });

    it("returns the oldest queued prospect", async () => {
      await db.prospects.add(
        makeProspect({ igUserId: "3", username: "third", fetchedAt: 3000 }),
      );
      await db.prospects.add(
        makeProspect({ igUserId: "1", username: "first", fetchedAt: 1000 }),
      );
      await db.prospects.add(
        makeProspect({ igUserId: "2", username: "second", fetchedAt: 2000 }),
      );

      const sorted = await db.prospects
        .where("status")
        .equals("queued")
        .sortBy("fetchedAt");

      expect(sorted[0]?.username).toBe("first");
    });

    it("skips non-queued prospects", async () => {
      await db.prospects.add(
        makeProspect({
          igUserId: "1",
          username: "engaged_one",
          status: "engaged",
          fetchedAt: 1000,
        }),
      );
      await db.prospects.add(
        makeProspect({
          igUserId: "2",
          username: "queued_one",
          status: "queued",
          fetchedAt: 2000,
        }),
      );

      const sorted = await db.prospects
        .where("status")
        .equals("queued")
        .sortBy("fetchedAt");

      expect(sorted).toHaveLength(1);
      expect(sorted[0]?.username).toBe("queued_one");
    });
  });

  describe("markEngaged", () => {
    it("updates status to engaged on success", async () => {
      const id = await db.prospects.add(makeProspect({ igUserId: "1" }));
      await db.prospects.update(id, {
        status: "engaged",
        engagedAt: Date.now(),
      });

      const updated = await db.prospects.get(id);
      expect(updated?.status).toBe("engaged");
      expect(updated?.engagedAt).toBeGreaterThan(0);
    });

    it("updates status to failed on failure", async () => {
      const id = await db.prospects.add(makeProspect({ igUserId: "1" }));
      await db.prospects.update(id, { status: "failed" });

      const updated = await db.prospects.get(id);
      expect(updated?.status).toBe("failed");
    });
  });

  describe("getQueueStats", () => {
    it("counts prospects by status", async () => {
      await db.prospects.add(
        makeProspect({ igUserId: "1", status: "queued" }),
      );
      await db.prospects.add(
        makeProspect({ igUserId: "2", status: "queued" }),
      );
      await db.prospects.add(
        makeProspect({ igUserId: "3", status: "engaged" }),
      );
      await db.prospects.add(
        makeProspect({ igUserId: "4", status: "failed" }),
      );
      await db.prospects.add(
        makeProspect({ igUserId: "5", status: "skipped" }),
      );

      const queued = await db.prospects.where("status").equals("queued").count();
      const engaged = await db.prospects.where("status").equals("engaged").count();
      const failed = await db.prospects.where("status").equals("failed").count();
      const skipped = await db.prospects.where("status").equals("skipped").count();

      expect(queued).toBe(2);
      expect(engaged).toBe(1);
      expect(failed).toBe(1);
      expect(skipped).toBe(1);
    });
  });
});
