import axios, { AxiosInstance } from 'axios';
import { ChallengeResponse, SolutionResponse, StarWarsPlanet, StarWarsCharacter, Pokemon } from '../types';
import { CONFIG } from '../config';

interface ChatMessage {
  role: string;
  content: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface SWAPIResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface SWAPICharacter {
  name: string;
  height: string;
  mass: string;
  homeworld: string;
  url: string;
}

interface PokemonAPIResponse {
  name: string;
  base_experience: number;
  height: number;
  weight: number;
}

const axiosInstance: AxiosInstance = axios.create({
  headers: {
    Authorization: `Bearer ${CONFIG.API.AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: CONFIG.API.TIMEOUT,
});

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryRequest = async <T>(
  request: () => Promise<T>,
  maxRetries: number = CONFIG.API.MAX_RETRIES
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await request();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        // Aumentar el tiempo de espera exponencialmente
        const waitTime = Math.min(1000 * Math.pow(2, i), 20000); // Máximo 20 segundos
        console.log(`Reintentando en ${waitTime}ms...`);
        await delay(waitTime);
      }
    }
  }
  
  throw lastError;
};

const validatePlanet = (planet: any): boolean => {
  if (!planet) return false;
  
  // Verificar que los campos requeridos estén presentes y sean válidos
  return planet.name !== 'unknown' &&
    planet.diameter !== 'unknown' && !isNaN(Number(planet.diameter)) &&
    planet.population !== 'unknown' && !isNaN(Number(planet.population)) &&
    planet.rotation_period !== 'unknown' && !isNaN(Number(planet.rotation_period)) &&
    planet.orbital_period !== 'unknown' && !isNaN(Number(planet.orbital_period)) &&
    planet.surface_water !== 'unknown' && !isNaN(Number(planet.surface_water));
};

const validateCharacter = (character: SWAPICharacter): boolean => {
  const height = Number(character.height);
  const mass = Number(character.mass);
  
  return character.name !== 'unknown' &&
    character.height !== 'unknown' &&
    character.mass !== 'unknown' &&
    character.homeworld !== 'unknown' &&
    !isNaN(height) && height > 0 &&
    !isNaN(mass) && mass > 0;
};

const validatePokemon = (pokemon: PokemonAPIResponse): boolean => {
  // Verificar que todos los campos requeridos estén presentes y sean válidos
  return pokemon && 
    typeof pokemon.name === 'string' && pokemon.name.length > 0 &&
    typeof pokemon.base_experience === 'number' && !isNaN(pokemon.base_experience) && pokemon.base_experience > 0 &&
    typeof pokemon.height === 'number' && !isNaN(pokemon.height) && pokemon.height > 0 &&
    typeof pokemon.weight === 'number' && !isNaN(pokemon.weight) && pokemon.weight > 0;
};

// Clase para manejar la cola de peticiones
class RequestQueue {
  private queue: (() => Promise<any>)[] = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly minDelay = 3000; // Aumentado a 5 segundos entre peticiones

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          if (timeSinceLastRequest < this.minDelay) {
            console.log(`Esperando ${this.minDelay - timeSinceLastRequest}ms antes de la siguiente petición...`);
            await delay(this.minDelay - timeSinceLastRequest);
          }
          const result = await request();
          this.lastRequestTime = Date.now();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const request = this.queue.shift();
        if (request) {
          await request();
        }
      }
    } finally {
      this.processing = false;
    }
  }
}

const requestQueue = new RequestQueue();

// Obtener challenge para test
export const getTestChallenge = async (): Promise<ChallengeResponse> => {
  return retryRequest(async () => {
    const response = await axiosInstance.get(`${CONFIG.API.BASE_URL}/challenge/test`);
    return response.data;
  });
};

// Obtener planetas válidos
export const getSwapiPlanets = async (): Promise<StarWarsPlanet[]> => {
  return retryRequest(async () => {
    try {
      const planets: StarWarsPlanet[] = [];
      
      // Obtener todos los planetas de una vez
      const response = await requestQueue.add(() => 
        axios.get(`${CONFIG.API.SWAPI_URL}/planets?limit=60`)
      );
      
      const planetDetailsPromises = response.data.results.map(async (planet: { url: string }) => {
        try {
          const detailResponse = await requestQueue.add(() => 
            axios.get(planet.url)
          );
          return detailResponse.data;
        } catch (error) {
          console.error(`Error fetching details for planet:`, error);
          return null;
        }
      });
      
      // Procesar los detalles en lotes más pequeños
      const batchSize = 5;
      for (let i = 0; i < planetDetailsPromises.length; i += batchSize) {
        const batch = planetDetailsPromises.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch);
        
        const validPlanets = batchResults
          .filter(planet => {
            if (!planet || !planet.result) {
              return false;
            }
            const isValid = validatePlanet(planet.result);
            if (!isValid) {
              console.log(`Invalid planet data: ${planet.result?.name || 'unknown'}`, planet.result);
            }
            return isValid;
          })
          .map(planet => {
            if (!planet.result) {
              return null;
            }
            return {
              name: planet.result.name || 'unknown',
              rotation_period: Number(planet.result.rotation_period) || 0,
              orbital_period: Number(planet.result.orbital_period) || 0,
              diameter: Number(planet.result.diameter) || 0,
              surface_water: Number(planet.result.surface_water) || 0,
              population: Number(planet.result.population) || 0,
            };
          })
          .filter((planet): planet is StarWarsPlanet => planet !== null);
        
        planets.push(...validPlanets);
      }
      
      console.log(`Final total of valid planets: ${planets.length}`);
      return planets;
    } catch (error) {
      console.error('Error fetching planets:', error);
      throw error;
    }
  });
};

// Obtener personajes válidos
export const getSwapiCharacters = async (): Promise<StarWarsCharacter[]> => {
  return retryRequest(async () => {
    try {
      const characters: StarWarsCharacter[] = [];
      
      // Obtener todos los personajes de una vez
      const response = await requestQueue.add(() => 
        axios.get(`${CONFIG.API.SWAPI_URL}/people?limit=82`)
      );
      
      const characterDetailsPromises = response.data.results.map(async (character: { url: string }) => {
        try {
          const detailResponse = await requestQueue.add(() => 
            axios.get(character.url)
          );
          return detailResponse.data;
        } catch (error) {
          console.error(`Error fetching details for character:`, error);
          return null;
        }
      });
      
      // Procesar los detalles en lotes más pequeños
      const batchSize = 3; // Reducido el tamaño del lote
      for (let i = 0; i < characterDetailsPromises.length; i += batchSize) {
        const batch = characterDetailsPromises.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch);
        
        const validCharacters = batchResults
          .filter(character => {
            if (!character || !character.result) {
              return false;
            }
            const isValid = validateCharacter(character.result);
            if (!isValid) {
              console.log(`Invalid character data: ${character.result?.name || 'unknown'}`, character.result);
            }
            return isValid;
          })
          .map(character => {
            if (!character.result) {
              return null;
            }
            return {
              name: character.result.name || 'unknown',
              height: Number(character.result.height) || 0,
              mass: Number(character.result.mass) || 0,
              homeworld: character.result.homeworld || 'unknown',
            };
          })
          .filter((character): character is StarWarsCharacter => character !== null);
        
        characters.push(...validCharacters);
      }
      
      console.log(`Final total of valid characters: ${characters.length}`);
      return characters;
    } catch (error) {
      console.error('Error fetching characters:', error);
      throw error;
    }
  });
};

// Obtener Pokémon válidos
export const getPokemon = async (): Promise<Pokemon[]> => {
  return retryRequest(async () => {
    try {
      const pokemons: Pokemon[] = [];
      let nextUrl: string | null = `${CONFIG.API.POKEMON_URL}?limit=1320`; // Aumentar el límite por página
      
      while (nextUrl) {
        const response: { data: {
          count: number;
          next: string | null;
          previous: string | null;
          results: { name: string; url: string }[];
        }} = await axios.get(nextUrl);
        
        console.log(`Obteniendo Pokémon de la página: ${nextUrl}`);
        
        const batchPromises = response.data.results.map(async (pokemon) => {
          try {
            const res = await axios.get<PokemonAPIResponse>(pokemon.url);
            const p = res.data;
            
            if (validatePokemon(p)) {
              console.log(`Pokémon válido obtenido: ${p.name}`, {
                base_experience: p.base_experience,
                height: p.height,
                weight: p.weight
              });
              
              return {
                name: p.name.toLowerCase(),
                base_experience: p.base_experience,
                height: p.height,
                weight: p.weight,
              };
            } else {
              console.log(`Pokémon inválido: ${p.name}`, p);
            }
          } catch (error) {
            console.error(`Error al obtener Pokémon ${pokemon.name} desde ${pokemon.url}:`, error);
          }
          return null;
        });
        
        const batchResults = await Promise.all(batchPromises);
        const validPokemon = batchResults.filter((p): p is Pokemon => p !== null);
        pokemons.push(...validPokemon);
        
        nextUrl = response.data.next;
        
        // Pequeña pausa entre páginas para evitar sobrecarga
        if (nextUrl) {
          await delay(CONFIG.RATE_LIMIT.DELAY);
        }
      }
      
      console.log(`Total Pokémon válidos obtenidos: ${pokemons.length}`);
      console.log('Lista de Pokémon:', pokemons.map(p => p.name));
      
      return pokemons;
    } catch (error) {
      console.error('Error al obtener Pokémon:', error);
      throw error;
    }
  });
};

// Enviar respuesta de solución
export const submitSolution = async (problemId: string, answer: number): Promise<SolutionResponse> => {
  if (answer === 0) {
    return {
      success: false,
      message: 'La solución no puede ser cero',
    };
  }

  return retryRequest(async () => {
    const response = await axiosInstance.post(`${CONFIG.API.BASE_URL}/challenge/solution`, {
      problemId,
      answer,
    });
    return response.data;
  });
};

// Llamada a modelo GPT
export const chatCompletion = async (messages: ChatMessage[]): Promise<OpenAIResponse> => {
  return retryRequest(async () => {
    const response = await axiosInstance.post<OpenAIResponse>(
      '/api/chat_completion',
      {
        model: 'gpt-4o-mini',
        messages,
      }
    );
    return response.data;
  });
};