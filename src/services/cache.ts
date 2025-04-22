import { Planet, People } from '../types';

interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize?: number; // Maximum size in bytes
}

const cacheConfigs = {
  planets: {
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    maxSize: 1024 * 1024, // 1MB
  },
  people: {
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    maxSize: 1024 * 1024, // 1MB
  },
  pokemon: {
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    maxSize: 2 * 1024 * 1024, // 2MB
  }
};

interface CacheItem<T> {
  data: T;
  timestamp: number;
  version: number;
}

const CACHE_VERSION = 1;

// Función para reducir datos de Pokémon
const reducePokemonData = (data: any) => {
  if (!data || !data.results) return data;
  
  return {
    ...data,
    results: data.results.map((p: any) => ({
      id: p.id,
      name: p.name,
      height: p.height,
      weight: p.weight,
      sprites: p.sprites?.front_default,
      types: p.types?.map((t: any) => t.type.name)
    }))
  };
};

// Función para comprimir datos
const compressData = (data: any): string => {
  try {
    // Reducir datos de Pokémon siempre
    if (data?.results?.[0]?.sprites) {
      data = reducePokemonData(data);
    }
    
    const jsonString = JSON.stringify(data);
    return jsonString;
  } catch (error) {
    console.error('Error compressing data:', error);
    return JSON.stringify(data);
  }
};

// Función para descomprimir datos
const decompressData = (compressedData: string): any => {
  try {
    const parsed = JSON.parse(compressedData);
    return parsed;
  } catch (error) {
    console.error('Error decompressing data:', error);
    return null;
  }
};

export const getFromCache = <T>(key: keyof typeof cacheConfigs): T | null => {
  try {
    const cachedItem = localStorage.getItem(`cache_${key}`);
    if (!cachedItem) {
      console.log(`No cached data found for ${key}`);
      return null;
    }

    const decompressedData = decompressData(cachedItem);
    if (!decompressedData) {
      console.log(`Invalid cached data for ${key}`);
      localStorage.removeItem(`cache_${key}`);
      return null;
    }

    const { data, timestamp, version } = decompressedData;
    const now = Date.now();
    const config = cacheConfigs[key];

    // Check if cache is expired
    if (now - timestamp > config.ttl) {
      console.log(`Cache expired for ${key}`);
      localStorage.removeItem(`cache_${key}`);
      return null;
    }

    // Check if cache version is outdated
    if (version !== CACHE_VERSION) {
      console.log(`Cache version outdated for ${key}`);
      localStorage.removeItem(`cache_${key}`);
      return null;
    }

    console.log(`Successfully retrieved cached data for ${key}`);
    return data;
  } catch (error) {
    console.error(`Error reading cache for ${key}:`, error);
    return null;
  }
};

export const saveToCache = <T>(key: keyof typeof cacheConfigs, data: T): void => {
  try {
    if (!data) {
      console.error(`Attempted to cache null/undefined data for ${key}`);
      return;
    }

    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION
    };
    
    const serializedData = JSON.stringify(cacheItem);
    
    // Check if data exceeds max size
    const config = cacheConfigs[key];
    if (config.maxSize && serializedData.length > config.maxSize) {
      console.warn(`Data exceeds max size for ${key}, attempting to reduce`);
      if (key === 'pokemon') {
        const reducedData = reducePokemonData(data);
        const reducedCacheItem: CacheItem<T> = {
          data: reducedData as T,
          timestamp: Date.now(),
          version: CACHE_VERSION
        };
        const reducedSerializedData = JSON.stringify(reducedCacheItem);
        if (reducedSerializedData.length <= config.maxSize) {
          localStorage.setItem(`cache_${key}`, reducedSerializedData);
          console.log(`Successfully cached reduced data for ${key}`);
          return;
        }
      }
      console.error(`Data still too large after reduction for ${key}`);
      return;
    }

    localStorage.setItem(`cache_${key}`, serializedData);
    console.log(`Successfully cached data for ${key}`);
  } catch (error) {
    console.error(`Error saving cache for ${key}:`, error);
  }
}; 