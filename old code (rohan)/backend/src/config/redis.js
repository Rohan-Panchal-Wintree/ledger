import Redis from "ioredis";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

class MemoryCacheClient {
  constructor() {
    this.store = new Map();
    this.status = "ready";
  }

  async connect() {
    this.status = "ready";
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, mode, ttlSeconds) {
    const expiresAt = mode === "EX" ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async del(...keys) {
    keys.flat().forEach((key) => this.store.delete(key));
  }

  multi() {
    const operations = [];
    const chain = {
      incr: (key) => {
        operations.push(async () => {
          const currentValue = Number((await this.get(key)) || 0) + 1;
          const existing = this.store.get(key);
          this.store.set(key, {
            value: String(currentValue),
            expiresAt: existing?.expiresAt || null
          });
        });
        return chain;
      },
      expire: (key, ttlSeconds) => {
        operations.push(async () => {
          const existingValue = await this.get(key);
          if (existingValue !== null) {
            this.store.set(key, {
              value: existingValue,
              expiresAt: Date.now() + ttlSeconds * 1000
            });
          }
        });
        return chain;
      },
      exec: async () => {
        for (const operation of operations) {
          await operation();
        }
      }
    };
    return chain;
  }
}

const createRedisClient = () =>
  new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    retryStrategy: () => null
  });

const realRedisClient = createRedisClient();
const memoryCacheClient = new MemoryCacheClient();

realRedisClient.on("connect", () => logger.info("Redis connected"));
realRedisClient.on("error", (error) => logger.error({ error }, "Redis error"));

export let redisClient = realRedisClient;

export const connectRedis = async () => {
  try {
    if (realRedisClient.status !== "ready") {
      await realRedisClient.connect();
    }
    redisClient = realRedisClient;
  } catch (error) {
    if (env.NODE_ENV === "production") {
      throw error;
    }

    redisClient = memoryCacheClient;
    logger.warn(
      { redisUrl: env.REDIS_URL },
      "Redis unavailable. Falling back to in-memory cache for local development"
    );
  }
};
