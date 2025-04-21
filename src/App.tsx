import { useEffect, useState } from "react";
import {
  getChallenge,
  getStarWarsDataPlanets,
  getStarWarsDataPeople,
  getPokemonData,
  submitSolution,
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
  const [submissionResponse, setSubmissionResponse] = useState<{ success: boolean; message: string } | null>(null);
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
    submit: false,
  });
  const [error, setError] = useState<string | null>(null);

  const fetchReferenceData = async () => {
    try {
      setLoading((prev) => ({ ...prev, planets: true }));
      setError(null);

      //carga de datos en secuencia

      const planetsData = await getStarWarsDataPlanets();
      setStarWarsDataPlanets(planetsData);
      setLoading((prev) => ({ ...prev, planets: false }));

      setLoading((prev) => ({ ...prev, pokemon: true }));
      const pokemonData = await getPokemonData();
      setPokemonData(pokemonData);
      setLoading((prev) => ({ ...prev, pokemon: false }));

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

      const processSolution = async () => {
        try {
          const result = await OpenAIService.interpretProblem(challenge, {
            planets: starWarsDataPlanets,
            people: starWarsDataPeople,
            pokemon: pokemonData,
          });

          console.log("🔥 OpenAI Response:", result);
          setSolution(result.answer);
        } catch (error) {
          console.error("Error procesando la solución:", error);
          setError("Error al procesar la solución");
        }
      };

      processSolution();
    }
  }, [challenge, starWarsDataPlanets, starWarsDataPeople, pokemonData]);

  const handleGetData = async () => {
    // Limpiar estados anteriores
    setChallenge(null);
    setSolution(null);
    setSubmissionResponse(null);
    setStarWarsDataPlanets(null);
    setStarWarsDataPeople(null);
    setPokemonData(null);
    setError(null);

    setLoading((prev) => ({ ...prev, all: true }));
    try {
      await fetchAllData();
    } catch (error) {
      setError("Error al cargar los datos");
      console.error("❌ Error:", error);
    } finally {
      setLoading((prev) => ({ ...prev, all: false }));
    }
  };

  const handleSubmitSolution = async () => {
    if (!challenge || solution === null) {
      setSubmissionResponse({
        success: false,
        message: "No hay solución para enviar",
      });
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, submit: true }));
      
      const requestBody = {
        problem_id: challenge.id,
        answer: solution
      };
      
      console.log("🔥 JSON enviado:", JSON.stringify(requestBody, null, 2));

      const response = await submitSolution(challenge.id, solution);
      setSubmissionResponse(response);
    } catch (error) {
      console.error("❌ Error al enviar la solución:", error);
      setSubmissionResponse({
        success: false,
        message: error instanceof Error ? error.message : "Error al enviar la solución",
      });
    } finally {
      setLoading((prev) => ({ ...prev, submit: false }));
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
          <h2>Id:</h2>
          <p className="problem">{challenge?.id ?? "No disponible"}</p>
          <hr />
          <h2>Solución:</h2>
          <p className="solution">{solution ?? "Cargando..."}</p>
          
          {solution !== null && (
            <button
              onClick={handleSubmitSolution}
              disabled={!challenge || solution === null || loading.submit}
              className="submit-button"
            >
              {loading.submit ? "Enviando..." : "Enviar Solución"}
            </button>
          )}
          
          {submissionResponse && (
            <div className={`response ${submissionResponse.success ? 'success' : 'error'}`}>
              {submissionResponse.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
