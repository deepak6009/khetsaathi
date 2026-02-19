import { users, type InsertUser, type User } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(phone: string): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;
  upsertUser(data: InsertUser): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  async getUser(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user || undefined;
  }

  async createUser(data: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async upsertUser(data: InsertUser): Promise<User> {
    const existing = await this.getUser(data.phone);
    if (existing) {
      if (data.language) {
        const [updated] = await db.update(users).set({ language: data.language }).where(eq(users.phone, data.phone)).returning();
        return updated;
      }
      return existing;
    }
    return this.createUser(data);
  }
}

export const storage = new DatabaseStorage();
