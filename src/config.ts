export const CONFIG = {
  API: {
    BASE_URL: '/api',
    SWAPI_URL: 'https://swapi.py4e.com/api/',
    POKEMON_URL: 'https://pokeapi.co/api/v2/pokemon?limit=1302',
    OPENAI_URL: 'https://recruiting.adere.so/chat_completion',
    AUTH_TOKEN: 'd1e864e2-cad4-4b10-b6be-49755d7175fc',
    TIMEOUT: 10000, 
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, 
  },
  PAGINATION: {
    DEFAULT_LIMIT: 10,
  },
  RATE_LIMIT: {
    DELAY: 200, 
  },
} as const; 