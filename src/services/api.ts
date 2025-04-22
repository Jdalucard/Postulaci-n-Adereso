import axios, { AxiosInstance } from "axios";
import {
  StarWarsPlanetResponse,
  StarWarsPeopleResponse,
  PokemonResponse,
  People,
  Planet,
} from "../types";

import { CONFIG } from "../config";

interface SolutionResponse {
  success: boolean;
  message: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface ChatMessage {
  role: string;
  content: string;
}

const axiosInstance: AxiosInstance = axios.create({
  headers: {
    Authorization: `Bearer ${CONFIG.API.AUTH_TOKEN}`,
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

interface SWAPIPlanet {
  url: string;
  name: string;
  rotation_period: string;
  orbital_period: string;
  diameter: string;
  surface_water: string;
  population: string;
}

interface SWAPIPerson {
  url: string;
  name: string;
  height: string;
  mass: string;
  homeworld: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Variables para almacenar los datos ya obtenidos
let cachedPlanets: StarWarsPlanetResponse | null = null;
let cachedPeople: StarWarsPeopleResponse | null = null;
let cachedPokemon: PokemonResponse | null = null;

export const getStarWarsDataPlanets = async (): Promise<StarWarsPlanetResponse> => {
  if (cachedPlanets) {
    console.log("🔥 Usando datos de planetas ya obtenidos");
    return cachedPlanets;
  }

  let allPlanets: Planet[] = [];
  let nextUrl = `${CONFIG.API.SWAPI_URL}/planets`;

  while (nextUrl) {
    const response = await axios.get(nextUrl);
    const planets = response.data.results.map((planet: SWAPIPlanet) => ({
      uid: planet.url.split("/").slice(-2, -1)[0],
      name: planet.name,
      rotation_period: parseInt(planet.rotation_period) || 0,
      orbital_period: parseInt(planet.orbital_period) || 0,
      diameter: parseInt(planet.diameter) || 0,
      surface_water: parseInt(planet.surface_water) || 0,
      population: parseInt(planet.population) || 0,
      url: planet.url
    }));

    allPlanets = [...allPlanets, ...planets];
    nextUrl = response.data.next;
    if (nextUrl) {
      await delay(500);
    }
  }

  cachedPlanets = { results: allPlanets };
  console.log("🔥 Fetched new Planets Data");
  return cachedPlanets;
};

export const getStarWarsDataPeople = async (): Promise<StarWarsPeopleResponse> => {
  if (cachedPeople) {
    console.log("🔥 Usando datos de personajes ya obtenidos");
    return cachedPeople;
  }

  let allPeople: People[] = [];
  let nextUrl = `${CONFIG.API.SWAPI_URL}/people`;

  while (nextUrl) {
    const response = await axios.get(nextUrl);
    const people = response.data.results.map((person: SWAPIPerson) => ({
      uid: person.url.split("/").slice(-2, -1)[0],
      name: person.name,
      height: parseInt(person.height) || 0,
      mass: parseInt(person.mass) || 0,
      homeworld: person.homeworld,
    }));

    allPeople = [...allPeople, ...people];
    nextUrl = response.data.next;
    if (nextUrl) {
      await delay(500);
    }
  }

  cachedPeople = { results: allPeople };
  console.log("🔥 Fetched new People Data");
  return cachedPeople;
};

export const getPokemonData = async (): Promise<PokemonResponse> => {
  if (cachedPokemon) {
    console.log("🔥 Usando datos de Pokémon ya obtenidos");
    return cachedPokemon;
  }

  const response = await axios.get(`${CONFIG.API.POKEMON_URL}?limit=1302`);
  const pokemon = await Promise.all(
    response.data.results.map(async (pokemon: { url: string }) => {
      await delay(1000);
      const pokemonDetails = await axios.get(pokemon.url);
      return {
        name: pokemonDetails.data.name,
        base_experience: parseInt(pokemonDetails.data.base_experience) || 0,
        height: parseInt(pokemonDetails.data.height) || 0,
        weight: parseInt(pokemonDetails.data.weight) || 0,
      };
    })
  );

  cachedPokemon = {
    count: response.data.count,
    next: response.data.next,
    previous: response.data.previous,
    results: pokemon,
  };
  console.log("🔥 Fetched new Pokemon Data");
  return cachedPokemon;
};

const retryRequest = async <T>(request: () => Promise<T>, maxRetries = 3): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await request();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await delay(1000 * (i + 1));
    }
  }
  throw new Error('Max retries reached');
};

// Enviar respuesta de solución
export const submitSolution = async (
  problemId: string,
  answer: number
): Promise<SolutionResponse> => {
  return retryRequest(async () => {
    const response = await axiosInstance.post(
      `${CONFIG.API.BASE_URL}/challenge/solution`,
      {
        problem_id: problemId,
        answer,
      }
    );
    return response.data;
  });
};

// Llamada a modelo GPT
export const chatCompletion = async (
  messages: ChatMessage[]
): Promise<OpenAIResponse> => {
  return retryRequest(async () => {
    const response = await axiosInstance.post<OpenAIResponse>(
      `${CONFIG.API.BASE_URL}/chat_completion`,
      {
        model: "gpt-4o-mini",
        messages,
      }
    );
    return response.data;
  });
};

export const getChallenge = async () => {
  const response = await axiosInstance.get(`${CONFIG.API.BASE_URL}/challenge/test`);
  return response.data;
};
