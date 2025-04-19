import {
  ChallengeResponse,
  StarWarsPlanet,
  StarWarsCharacter,
  Pokemon,
} from "../types";
import { chatCompletion } from "./api";

interface ChatMessage {
  role: string;
  content: string;
}

interface ProblemContext {
  starWarsPlanets: StarWarsPlanet[];
  starWarsCharacters: StarWarsCharacter[];
  pokemons: Pokemon[];
}

interface ProblemAnswer {
  problem_id: string;
  answer: number;
}

export class OpenAIService {
  static async interpretProblem(
    problem: ChallengeResponse & { context?: ProblemContext }
  ): Promise<ProblemAnswer> {
    try {
      // Validate required data
      if (!problem.context) {
        throw new Error("El contexto del problema es requerido");
      }

      const { starWarsPlanets, starWarsCharacters, pokemons } = problem.context;

      if (!starWarsPlanets || starWarsPlanets.length === 0) {
        throw new Error("Se requieren datos de planetas de Star Wars");
      }

      if (!starWarsCharacters || starWarsCharacters.length === 0) {
        throw new Error("Se requieren datos de personajes de Star Wars");
      }

      if (!pokemons || pokemons.length === 0) {
        throw new Error("Se requieren datos de Pokémon");
      }

      // Validate that each entity has required properties
      const validateEntity = (entity: any, type: string, requiredProps: string[]) => {
        if (!entity) return;
        const missingProps = requiredProps.filter(prop => !(prop in entity));
        if (missingProps.length > 0) {
          throw new Error(`Faltan propiedades requeridas para ${type}: ${missingProps.join(', ')}`);
        }
      };

      // Validate planets
      starWarsPlanets.forEach(planet => 
        validateEntity(planet, 'planeta', ['name', 'population', 'diameter'])
      );

      // Validate characters
      starWarsCharacters.forEach(character => 
        validateEntity(character, 'personaje', ['name', 'height', 'mass'])
      );

      // Validate pokemons
      pokemons.forEach(pokemon => 
        validateEntity(pokemon, 'pokémon', ['name', 'weight', 'height'])
      );

      const messages: ChatMessage[] = [
        {
          role: "developer",
          content: `Eres un asistente experto en resolver problemas de razonamiento lógico y matemático.
        Tu objetivo es analizar el enunciado del problema y responder directamente lo que se pregunta, utilizando solo los datos proporcionados en la sección de contexto (planetas, personajes y Pokémon).
        
        Tu salida DEBE ser un objeto JSON válido con este formato exacto:
        {
          "reasoning": "explicación paso a paso de cómo llegaste al resultado final",
          "solution": número
        }
        
        Importante:
        - NO realices suposiciones ni cálculos que no estén justificados por la pregunta.
        - Asegúrate de que el número en "solution" sea exactamente la respuesta final que se solicita en el problema.
        - Si el problema pregunta por el peso de un Pokémon, responde con ese valor directamente. Si pregunta por un cálculo, haz solo ese cálculo.
        - Si no puedes responder por falta de datos, explica por qué y devuelve null en "solution".
        - No incluyas ningún texto fuera del JSON.`,
        },
        {
          role: "user",
          content: `Problema: ${problem.problem}
          
Datos disponibles:
Planetas: ${JSON.stringify(problem.context?.starWarsPlanets || [])}
Personajes: ${JSON.stringify(problem.context?.starWarsCharacters || [])}
Pokémon: ${JSON.stringify(problem.context?.pokemons || [])}

Por favor, analiza el problema y proporciona la solución numérica precisa usando los datos proporcionados.`,
        },
      ];

      const response = await chatCompletion(messages);
      const content = response.choices[0].message.content.trim();

      console.log("OpenAI raw response:", content);

      // Extraer solo el primer objeto JSON válido que aparece
      const jsonMatch = content.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        throw new Error("No se encontró un objeto JSON válido en la respuesta");
      }

      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      if (
        parsed.solution !== null &&
        (typeof parsed.solution !== "number" || isNaN(parsed.solution))
      ) {
        throw new Error(
          "La solución debe ser un número válido o null si faltan datos"
        );
      }

      return {
        problem_id: problem.id,
        answer: parsed.solution,
      };
    } catch (error) {
      console.error("Error interpreting problem with OpenAI:", error);
      throw error;
    }
  }
}
