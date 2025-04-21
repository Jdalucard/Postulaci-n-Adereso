import { chatCompletion } from "./api";
import { StarWarsPlanetResponse, StarWarsPeopleResponse, PokemonResponse } from "../types";

interface ChatMessage {
  role: string;
  content: string;
}

export class OpenAIService {
  static async interpretProblem(
    problem: { id: string; problem: string },
    context: {
      planets: StarWarsPlanetResponse;
      people: StarWarsPeopleResponse;
      pokemon: PokemonResponse;
    }
  ) {
    try {
      // Log del contexto para debugging
      console.log("🔥 Contexto completo recibido:");
      
      // Extraer solo los campos relevantes de todos los datos
      const planetas = context.planets.results.map(p => ({
        nombre: p.name,
        periodo_rotacion: p.rotation_period,
        periodo_orbital: p.orbital_period,
        diametro: p.diameter,
        agua_superficial: p.surface_water,
        poblacion: p.population
      }));
      
      const personajes = context.people.results.map(p => ({
        nombre: p.name,
        altura: p.height,
        masa: p.mass,
        planeta_natal: p.homeworld
      }));
      
      const pokemons = context.pokemon.results.map(p => ({
        nombre: p.name,
        altura: p.height,
        peso: p.weight,
        experiencia_base: p.base_experience
      }));

      console.log("Planetas:", planetas);
      console.log("Personajes:", personajes);
      console.log("Pokémon:", pokemons);

      const messages: ChatMessage[] = [
        {
          role: "developer",
          content: `Eres un asistente experto en resolver problemas de razonamiento lógico y matemático.
          Tu objetivo es analizar el enunciado del problema y responder directamente lo que se pregunta, utilizando SOLO los datos proporcionados en el contexto.

          Contexto disponible:
          - Planetas de Star Wars: ${JSON.stringify(planetas)}
          - Personajes de Star Wars: ${JSON.stringify(personajes)}
          - Pokémon: ${JSON.stringify(pokemons)}
          
          Tu salida DEBE ser un objeto JSON válido con este formato exacto:
          {
            "reasoning": "explicación paso a paso de cómo llegaste al resultado final usando los datos del contexto",
            "solution": número
          }
          
          Importante:
          - SOLO usa los datos proporcionados en el contexto.
          - NO realices suposiciones ni cálculos que no estén justificados por los datos del contexto.
          - Asegúrate de que el número en "solution" sea exactamente la respuesta final que se solicita en el problema.
          - Si el problema pregunta por el peso de un Pokémon, responde con ese valor directamente del contexto. Si pregunta por un cálculo, haz solo ese cálculo con los datos disponibles.
          - Si no puedes responder por falta de datos en el contexto, explica por qué y devuelve null en "solution".
          - No incluyas ningún texto fuera del JSON.`,
        },
        {
          role: "user",
          content: `Problema: ${problem.problem}
          
          Por favor, analiza el problema y proporciona la solución numérica precisa usando SOLO los datos del contexto proporcionado.`,
        },
      ];

      const response = await chatCompletion(messages);
      const content = response.choices[0].message.content.trim();

      console.log("OpenAI raw response:", content);

      const jsonMatch = content.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        throw new Error("No se encontró un objeto JSON válido en la respuesta");
      }

      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      if (parsed.solution !== null && (typeof parsed.solution !== "number" || isNaN(parsed.solution))) {
        throw new Error("La solución debe ser un número válido o null si faltan datos");
      }

      // Redondear la solución a 10 decimales si es un número decimal
      const roundedSolution = parsed.solution !== null ? 
        Math.round(parsed.solution * 10000000000) / 10000000000 : 
        null;

      return {
        problem_id: problem.id,
        answer: roundedSolution,
        reasoning: parsed.reasoning
      };
    } catch (error) {
      console.error("Error interpreting problem with OpenAI:", error);
      throw error;
    }
  }
}
