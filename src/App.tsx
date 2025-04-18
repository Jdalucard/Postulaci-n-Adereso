import { useState, useEffect, useCallback } from "react";
import {
  getTestChallenge,
  submitSolution,
  getSwapiPlanets,
  getSwapiCharacters,
  getPokemon,
} from "./services/api";
import {
  ChallengeResponse,
  SolutionResponse,
  StarWarsPlanet,
  StarWarsCharacter,
  Pokemon,
} from "./types";
import { OpenAIService } from "./services/openaiService";
import "./App.css";

interface ProblemContext {
  starWarsPlanets: StarWarsPlanet[];
  starWarsCharacters: StarWarsCharacter[];
  pokemons: Pokemon[];
}

interface ExtendedChallengeResponse extends ChallengeResponse {
  context?: ProblemContext;
}

interface ProblemAnswer {
  problem_id: string;
  answer: number;
}

function App() {
  const [challenge, setChallenge] = useState<ExtendedChallengeResponse | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [solutionResponse, setSolutionResponse] =
    useState<SolutionResponse | null>(null);
  const [calculatedSolution, setCalculatedSolution] = useState<number | null>(
    null
  );
  const [interpretation, setInterpretation] = useState<ProblemAnswer | null>(
    null
  );

  const formatNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null) return "0.0000000000";
    return num.toFixed(10);
  };

  const handleSubmit = async () => {
    if (!challenge || calculatedSolution === null) return;

    try {
      setLoading(true);
      setError(null);
      const response = await submitSolution(challenge.id, calculatedSolution);
      setSolutionResponse(response);
    } catch (err) {
      setError("Error submitting solution");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChallenge = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setSolutionResponse(null);
      setCalculatedSolution(null);
      setInterpretation(null);

      // Obtener el problema principal
      const challengeData = await getTestChallenge();
      console.log("Received challenge data:", challengeData);
      setChallenge(challengeData);

      // Obtener datos adicionales
      const [planets, characters, pokemons] = await Promise.all([
        getSwapiPlanets(),
        getSwapiCharacters(),
        getPokemon(),
      ]);

      const context: ProblemContext = {
        starWarsPlanets: planets,
        starWarsCharacters: characters,
        pokemons: pokemons,
      };

      // Procesar el problema con OpenAI
      const interpretation = await OpenAIService.interpretProblem({
        ...challengeData,
        context,
      });

      setInterpretation(interpretation);
      setCalculatedSolution(interpretation.answer);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChallenge();
  }, [fetchChallenge]);

  return (
    <div className="App">
      <h1>Adereso Challenge</h1>

      {loading && <p>Loading challenge...</p>}

      {error && <p className="error">{error}</p>}

      {challenge && (
        <div className="challenge-container">
          <h2>id</h2>
          <p>{challenge.id}</p>
          <h2>Problem:</h2>
          <p>{challenge.problem}</p>
          <h2>solution:</h2>
          <p>{challenge.solution}</p>

          <hr />
          {interpretation && (
            <div className="solution-container">
              <h2>Solution:</h2>
              <p className="solution-value">
                {formatNumber(interpretation.answer)}
              </p>

              <button onClick={handleSubmit} disabled={loading}>
                Submit Solution
              </button>
              {solutionResponse && (
                <span
                  className={`response ${
                    solutionResponse.success ? "success" : "error"
                  }`}
                >
                  {solutionResponse.message}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <button onClick={fetchChallenge} disabled={loading}>
        {loading ? "Loading..." : "Get New Challenge"}
      </button>
    </div>
  );
}

export default App;
