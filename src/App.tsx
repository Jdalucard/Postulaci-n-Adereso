import { useEffect, useState } from "react";
import {
  getChallenge,
  getStarWarsDataPlanets,
  getStarWarsDataPeople,
  getPokemonData,
} from "./services/api";
import { OpenAIService } from "./services/openaiService";

import {
  StarWarsPlanetResponse,
  StarWarsPeopleResponse,
  PokemonResponse,
  People,
  Planet,
  Pokemon,
} from "./types";
import "./App.css";

interface Challenge {
  id: string;
  problem: string;
  solution?: number;
}

function App() {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [solution, setSolution] = useState<number | null>(null);
  const [starWarsDataPlanets, setStarWarsDataPlanets] =
    useState<StarWarsPlanetResponse | null>(null);
  const [starWarsDataPeople, setStarWarsDataPeople] =
    useState<StarWarsPeopleResponse | null>(null);
  const [pokemonData, setPokemonData] = useState<PokemonResponse | null>(null);
  const [loading, setLoading] = useState({
    planets: false,
    people: false,
    pokemon: false,
    challenge: false,
  });
  const [error, setError] = useState<string | null>(null);

  const fetchReferenceData = async () => {
    try {
      setLoading((prev) => ({ ...prev, planets: true }));
      setError(null);

      // Cargar planetas primero
      const planetsData = await getStarWarsDataPlanets();
      setStarWarsDataPlanets(planetsData);
      setLoading((prev) => ({ ...prev, planets: false }));

      // Luego cargar personajes
      setLoading((prev) => ({ ...prev, pokemon: true }));
      const pokemonData = await getPokemonData();
      setPokemonData(pokemonData);
      setLoading((prev) => ({ ...prev, pokemon: false }));

      // Finalmente cargar Pokémon

      setLoading((prev) => ({ ...prev, people: true }));
      const peopleData = await getStarWarsDataPeople();
      setStarWarsDataPeople(peopleData);
      setLoading((prev) => ({ ...prev, people: false }));

      return true;
    } catch (error) {
      setError(
        "Error al cargar los datos de referencia. Por favor, intente de nuevo más tarde."
      );
      console.error("❌ Error:", error);
      return false;
    }
  };

  const fetchChallengeData = async () => {
    try {
      setLoading((prev) => ({ ...prev, challenge: true }));
      const challengeData = await getChallenge();
      setChallenge(challengeData);
      setLoading((prev) => ({ ...prev, challenge: false }));
    } catch (error) {
      setError("Error al cargar el desafío");
      console.error("❌ Error:", error);
    }
  };

  const fetchAllData = async () => {
    const referenceDataLoaded = await fetchReferenceData();
    if (referenceDataLoaded) {
      await fetchChallengeData();
    }
  };

  useEffect(() => {
    if (challenge && starWarsDataPlanets && starWarsDataPeople && pokemonData) {
      console.log("🔥 Challenge:", challenge);
      console.log("🔥 Planets Data:", starWarsDataPlanets.results);
      console.log("🔥 People Data:", starWarsDataPeople.results);
      console.log("🔥 Pokemon Data:", pokemonData.results);

      OpenAIService.interpretProblem(challenge, {
        planets: starWarsDataPlanets,
        people: starWarsDataPeople,
        pokemon: pokemonData
      }).then(result => {
        console.log("🔥 OpenAI Response:", result);
        setSolution(result.answer);
      });
    }
  }, [challenge, starWarsDataPlanets, starWarsDataPeople, pokemonData]);

  const handleGetData = async () => {
    setLoading(prev => ({ ...prev, all: true }));
    setError(null);
    try {
      await fetchAllData();
    } catch (error) {
      setError("Error al cargar los datos");
      console.error("❌ Error:", error);
    } finally {
      setLoading(prev => ({ ...prev, all: false }));
    }
  };

  const isLoading = Object.values(loading).some((value) => value);

  return (
    <div className="container">
      <h1>🔥 Desafío Adereso</h1>

      <button
        onClick={handleGetData}
        disabled={isLoading}
        className="challenge-button"
      >
        {isLoading ? "Cargando..." : "Obtener Todos los Datos"}
      </button>

      {error && <p className="error">{error}</p>}

      {loading.planets && <p>Cargando planetas...</p>}
      {loading.people && <p>Cargando personajes...</p>}
      {loading.pokemon && <p>Cargando Pokémon...</p>}
      {loading.challenge && <p>Cargando desafío...</p>}

      {challenge && (
        <div className="challenge-container">
          <h2>Id:</h2>
          <p className="problem">{challenge.id}</p>
          <hr />
          <h2>Problema:</h2>
          <p className="problem">{challenge.problem}</p>
          <h2>Solución:</h2>
          <p className="solution">{challenge.solution}</p>
        </div>
      )}

      <div className="data-grid-container">
        <div className="data-section">
          <h2>Solución:</h2>
          <p className="solution">{solution ?? 'Cargando...'}</p>
        </div>
      </div>

  {/*     <div className="data-grid-container">
        {starWarsDataPeople && (
          <div className="data-section">
            <h2>Personajes de Star Wars</h2>
            <div className="data-grid">
              {starWarsDataPeople.results.map((person: People) => (
                <div key={person.uid} className="data-card">
                  <h3>{person.name}</h3>
                  <p>Altura: {person.height} cm</p>
                  <p>Peso: {person.mass} kg</p>
                  <p>
                    Planeta Natal:{" "}
                    {starWarsDataPlanets?.results.find(
                      (planet) => planet.url === person.homeworld
                    )?.name || "Desconocido"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {starWarsDataPlanets && (
          <div className="data-section">
            <h2>Planetas de Star Wars</h2>
            <div className="data-grid">
              {starWarsDataPlanets.results.map((planet: Planet) => (
                <div key={planet.uid} className="data-card">
                  <h3>{planet.name}</h3>
                  <p>Período de Rotación: {planet.rotation_period} horas</p>
                  <p>Período Orbital: {planet.orbital_period} días</p>
                  <p>Diámetro: {planet.diameter} km</p>
                  <p>Agua Superficial: {planet.surface_water}%</p>
                  <p>Población: {planet.population}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {pokemonData && (
          <div className="data-section">
            <h2>Pokémon</h2>
            <div className="data-grid">
              {pokemonData.results.map((pokemon: Pokemon) => (
                <div key={pokemon.name} className="data-card">
                  <h3>{pokemon.name}</h3>
                  <p>Experiencia Base: {pokemon.base_experience}</p>
                  <p>Altura: {pokemon.height} dm</p>
                  <p>Peso: {pokemon.weight} hg</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div> */}
    </div>
  );
}

export default App;

