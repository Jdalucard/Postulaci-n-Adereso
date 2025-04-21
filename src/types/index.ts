export interface Planet {
  uid: string;
  name: string;
  rotation_period: number;
  orbital_period: number;
  diameter: number;
  surface_water: number;
  population: number;
  url: string;
}

export interface People {
  uid: string;
  name: string;
  height: number;
  mass: number;
  homeworld: string;
}

export interface Pokemon {
  name: string;
  base_experience: number;
  height: number;
  weight: number;
}

export interface StarWarsPlanetResponse {
  results: Planet[];
}

export interface StarWarsPeopleResponse {
  results: People[];
}

export interface PokemonResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Pokemon[];
}

export interface Challenge {
  problem: string;
  solution: number;
  id: string;
} 