import { chatCompletion } from "./api";
import { StarWarsPlanetResponse, StarWarsPeopleResponse, PokemonResponse, Planet, People } from "../types";

interface ChatMessage {
  role: string;
  content: string;
}

// Funciones auxiliares para sanear y validar datos

function sanitizePlanets(planets: StarWarsPlanetResponse["results"]) {
  return planets.map(p => ({
    name: p.name,
    rotation_period: Number(p.rotation_period) || 0,
    orbital_period: Number(p.orbital_period) || 0,
    diameter: Number(p.diameter) || 0,
    surface_water: Number(p.surface_water) || 0,
    population: Number(p.population) || 0,
    url: (p as any).url || "" 
  }));
}

function sanitizePeople(people: StarWarsPeopleResponse["results"]) {
  return people.map(p => ({
    name: p.name,
    height: Number(p.height) || 0,
    mass: Number(p.mass) || 0,
    homeworld: p.homeworld
  }));
}

function sanitizePokemons(pokemons: PokemonResponse["results"]) {
  return pokemons.map(p => ({
    name: p.name,
    base_experience: Number(p.base_experience) || 0,
    height: Number(p.height) || 0,
    weight: Number(p.weight) || 0,
  }));
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
      console.log("🔥 Contexto completo recibido:");
      
      // Extraer solo los campos relevantes de todos los datos
      const planetas = context.planets.results.map((p: Planet) => ({
        name: p.name,
        rotation_period: p.rotation_period,
        orbital_period: p.orbital_period,
        diameter: p.diameter,
        surface_water: p.surface_water,
        population: p.population
      }));
      
      
      const planetNameMap = new Map(
        context.planets.results.map((p: Planet) => [p.url, p.name])
      );
      
      const personajes = context.people.results.map((p: People) => ({
        name: p.name,
        height: p.height,
        mass: p.mass,
        homeworld: planetNameMap.get(p.homeworld) || p.homeworld 
      }));
      
      const pokemons = context.pokemon.results.map((p: any) => ({
        name: p.name,
        base_experience: p.base_experience,
        height: p.height,
        weight: p.weight
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
            "solution": número o null
          }
          
          Instrucciones específicas:
          1. Lee cuidadosamente el problema y sigue EXACTAMENTE el orden de las operaciones descrito.
          2. Para personajes de Star Wars:
             - Busca el personaje por nombre exacto (case-insensitive)
             - Usa el campo 'mass' para la masa
             - Si la masa es 0 o no está definida, devuelve null como solución
             - Si no encuentras el personaje, devuelve null como solución
          3. Para Pokémon:
             - Busca el Pokémon por nombre exacto (case-insensitive)
             - Usa el campo 'weight' para el peso
             - Usa el campo 'height' para la altura
             - Usa el campo 'base_experience' para la experiencia base
             - Si algún valor es 0 o no está definido, devuelve null como solución
             - Si no encuentras el Pokémon, devuelve null como solución
          4. Realiza los cálculos en el orden exacto que se describe en el problema.
          5. NO redondees ningún resultado intermedio.
          6. Mantén TODOS los decimales en cada paso del cálculo.
          7. El resultado final DEBE estar redondeado a EXACTAMENTE 10 decimales.
          8. Si el problema menciona "primero", "luego", "finalmente", etc., sigue ese orden exactamente.
          9. Las unidades deben mantenerse como están en los datos, sin conversiones.
          10. Si no puedes responder por falta de datos en el contexto, devuelve null como solución.
          11. No incluyas ningún texto fuera del JSON.
          12. La solución DEBE ser un número o null, nunca un mensaje de error.
          13. IMPORTANTE: Todas las soluciones numéricas DEBEN estar redondeadas a EXACTAMENTE 10 decimales.`,
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
