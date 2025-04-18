export interface ChallengeResponse {
  id: string;
  problem: string;
  expression: string;
  solution: number;
 
}

export interface SolutionResponse {
  success: boolean;
  message: string;
}

export interface StarWarsPlanet {
  name: string;
  rotation_period: number;
  orbital_period: number;
  diameter: number;
  surface_water: number;
  population: number;
}

export interface StarWarsCharacter {
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