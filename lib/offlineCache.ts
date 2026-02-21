import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export async function setCacheItem<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(entry));
  } catch {}
}

export async function getCacheItem<T>(key: string, maxAge?: number): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`cache_${key}`);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    const age = Date.now() - entry.timestamp;
    if (age > (maxAge ?? CACHE_TTL)) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export async function clearCacheItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`cache_${key}`);
  } catch {}
}

export async function clearAllCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith('cache_'));
    await AsyncStorage.multiRemove(cacheKeys);
  } catch {}
}

export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  maxAge?: number
): Promise<{ data: T; fromCache: boolean }> {
  const cached = await getCacheItem<T>(key, maxAge);
  if (cached !== null) {
    return { data: cached, fromCache: true };
  }
  try {
    const data = await fetcher();
    await setCacheItem(key, data);
    return { data, fromCache: false };
  } catch (e) {
    const stale = await getCacheItem<T>(key, Infinity);
    if (stale !== null) {
      return { data: stale, fromCache: true };
    }
    throw e;
  }
}
