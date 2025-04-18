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
        await delay(CONFIG.API.RETRY_DELAY);
      }
    }
  }
  
  throw lastError;
};

const validatePlanet = (planet: { properties: {
  name: string;
  rotation_period: string;
  orbital_period: string;
  diameter: string;
  surface_water: string;
  population: string;
} }): boolean => {
  if (!planet || !planet.properties) return false;
  
  const { properties } = planet;
  return ['rotation_period', 'orbital_period', 'diameter', 'surface_water', 'population']
    .every(key => properties[key as keyof typeof properties] !== 'unknown' && 
                  !isNaN(Number(properties[key as keyof typeof properties])));
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
      let nextUrl: string | null = `${CONFIG.API.SWAPI_URL}/planets?limit=100`;
      
      while (nextUrl) {
        const response: { data: {
          count: number;
          next: string | null;
          previous: string | null;
          results: Array<{
            uid: string;
            name: string;
            url: string;
          }>;
        }} = await axios.get(nextUrl);
        
        console.log(`Fetching planets from: ${nextUrl}`);
        console.log(`Total planets in this batch: ${response.data.results.length}`);
        
        const planetDetailsPromises = response.data.results.map(async (planet) => {
          try {
            const detailResponse = await axios.get(planet.url);
            return detailResponse.data;
          } catch (error) {
            console.error(`Error fetching details for planet ${planet.name}:`, error);
            return null;
          }
        });
        
        const planetDetails = await Promise.all(planetDetailsPromises);
        
        const validPlanets = planetDetails
          .filter(planet => {
            if (!planet || !planet.result || !planet.result.properties) {
              console.log('Invalid planet structure:', planet);
              return false;
            }
            const isValid = validatePlanet(planet.result);
            if (!isValid) {
              console.log(`Invalid planet data: ${planet.result?.properties?.name || 'unknown'}`, planet.result?.properties);
            }
            return isValid;
          })
          .map(planet => {
            if (!planet.result.properties) {
              console.log('Missing properties for planet:', planet);
              return null;
            }
            const planetData = {
              name: planet.result.properties.name || 'unknown',
              rotation_period: Number(planet.result.properties.rotation_period) || 0,
              orbital_period: Number(planet.result.properties.orbital_period) || 0,
              diameter: Number(planet.result.properties.diameter) || 0,
              surface_water: Number(planet.result.properties.surface_water) || 0,
              population: Number(planet.result.properties.population) || 0,
            };
            console.log(`Valid planet: ${planetData.name}`, planetData);
            return planetData;
          })
          .filter((planet): planet is StarWarsPlanet => planet !== null);
        
        planets.push(...validPlanets);
        console.log(`Total valid planets so far: ${planets.length}`);
        
        nextUrl = response.data.next;
        if (nextUrl) {
          await delay(CONFIG.RATE_LIMIT.DELAY);
        }
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
    const response = await axios.get<SWAPIResponse<SWAPICharacter>>(`${CONFIG.API.SWAPI_URL}/people`);
    const characters = response.data.results
      .filter(validateCharacter)
      .slice(0, CONFIG.PAGINATION.DEFAULT_LIMIT)
      .map(c => ({
        name: c.name,
        height: Number(c.height),
        mass: Number(c.mass),
        homeworld: c.homeworld,
      }));

    console.log('Characters fetched:', characters);
    return characters;
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