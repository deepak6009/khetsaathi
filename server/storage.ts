import { users, otps, type InsertUser, type User } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(phone: string): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;
  upsertUser(data: InsertUser): Promise<User>;
  saveOtp(phone: string, code: string, expiresAt: Date): Promise<void>;
  getOtp(phone: string): Promise<{ code: string; expiresAt: Date; attempts: number } | undefined>;
  incrementOtpAttempts(phone: string): Promise<void>;
  deleteOtp(phone: string): Promise<void>;
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

  async saveOtp(phone: string, code: string, expiresAt: Date): Promise<void> {
    await db.delete(otps).where(eq(otps.phone, phone));
    await db.insert(otps).values({ phone, code, expiresAt, attempts: 0 });
  }

  async getOtp(phone: string): Promise<{ code: string; expiresAt: Date; attempts: number } | undefined> {
    const [otp] = await db.select().from(otps).where(eq(otps.phone, phone));
    if (!otp) return undefined;
    return { code: otp.code, expiresAt: otp.expiresAt, attempts: otp.attempts || 0 };
  }

  async incrementOtpAttempts(phone: string): Promise<void> {
    const otp = await this.getOtp(phone);
    if (otp) {
      await db.update(otps).set({ attempts: otp.attempts + 1 }).where(eq(otps.phone, phone));
    }
  }

  async deleteOtp(phone: string): Promise<void> {
    await db.delete(otps).where(eq(otps.phone, phone));
  }
}

export const storage = new DatabaseStorage();
