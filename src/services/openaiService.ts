import { chatCompletion } from "./api";
import { StarWarsPlanetResponse, StarWarsPeopleResponse, PokemonResponse } from "../types";

interface ChatMessage {
  role: string;
  content: string;
}

// Función para filtrar el contexto relevante basado en el problema
const filterRelevantContext = (
  problem: string,
  planets: any[],
  people: any[],
  pokemons: any[]
) => {
  const problemLower = problem.toLowerCase();
  
  // Buscar nombres mencionados en el problema
  const mentionedPlanets = planets.filter(p => 
    problemLower.includes(p.nombre.toLowerCase())
  );
  
  const mentionedPeople = people.filter(p => 
    problemLower.includes(p.nombre.toLowerCase())
  );
  
  const mentionedPokemons = pokemons.filter(p => 
    problemLower.includes(p.nombre.toLowerCase())
  );

  return {
    planets: mentionedPlanets.length > 0 ? mentionedPlanets : planets,
    people: mentionedPeople.length > 0 ? mentionedPeople : people,
    pokemons: mentionedPokemons.length > 0 ? mentionedPokemons : pokemons
  };
};

// Función para convertir valores a números
const convertToNumbers = (data: any[]) => {
  return data.map(item => {
    const converted = { ...item };
    for (const key in converted) {
      if (typeof converted[key] === 'string' && !isNaN(Number(converted[key]))) {
        converted[key] = Number(converted[key]);
      }
    }
    return converted;
  });
};

// Función para limpiar y reparar JSON
const cleanAndParseJSON = (content: string) => {
  try {
    // Primero intentar parsear directamente
    return JSON.parse(content);
  } catch (error) {
    // Si falla, intentar limpiar y reparar
    const cleanContent = content
      .replace(/[\n\r]/g, '') // Eliminar saltos de línea
      .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":') // Añadir comillas a las claves
      .replace(/:\s*'([^']*)'/g, ':"$1"') // Reemplazar comillas simples por dobles
      .replace(/:\s*([^"',}\]]+)([,}\]])/g, ':"$1"$2') // Añadir comillas a valores sin comillas
      .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*=\s*([^,}\]]+)([,}\]])/g, '$1"$2":"$3"$4'); // Reparar formato clave=valor

    try {
      return JSON.parse(cleanContent);
    } catch (retryError) {
      console.error("🔥 Contenido que causó el error:", cleanContent);
      throw new Error("No se pudo parsear la respuesta como JSON válido");
    }
  }
};

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
      // Limpiar el estado de la IA antes de cada nueva solicitud
      const clearStateMessage: ChatMessage = {
        role: "system",
        content: "Por favor, olvida cualquier contexto o datos anteriores. Comenzaremos un nuevo problema desde cero."
      };

      // Extraer y convertir los datos
      const planetas = convertToNumbers(context.planets.results.map(p => ({
        nombre: p.name,
        periodo_rotacion: p.rotation_period,
        periodo_orbital: p.orbital_period,
        diametro: p.diameter,
        agua_superficial: p.surface_water,
        poblacion: p.population
      })));
      
      const personajes = convertToNumbers(context.people.results.map(p => ({
        nombre: p.name,
        altura: p.height,
        masa: p.mass,
        planeta_natal: p.homeworld
      })));
      
      const pokemons = convertToNumbers(context.pokemon.results.map(p => ({
        nombre: p.name,
        altura: p.height,
        peso: p.weight,
        experiencia_base: p.base_experience
      })));

      // Filtrar contexto relevante
      const relevantContext = filterRelevantContext(
        problem.problem,
        planetas,
        personajes,
        pokemons
      );

      console.log("🔥 Enviando datos a la IA:", {
        planetas: relevantContext.planets.length,
        personajes: relevantContext.people.length,
        pokemons: relevantContext.pokemons.length
      });

      const messages: ChatMessage[] = [
        clearStateMessage,
        {
          role: "system",
          content: `Eres un asistente experto en razonamiento lógico y matemático. 
          Tu objetivo es resolver problemas matemáticos usando SOLO los datos proporcionados.
          Siempre responde con un objeto JSON válido que contenga:
          - reasoning: explicación paso a paso de tu razonamiento
          - solution: el resultado numérico final o null si no hay datos suficientes
          
          Instrucciones específicas:
          1. Usa SOLO los datos proporcionados
          2. Busca nombres exactos (ignorando mayúsculas/minúsculas)
          3. Realiza cálculos en el orden exacto del problema
          4. No redondees resultados intermedios
          5. El resultado final debe tener 10 decimales
          6. Si faltan datos, devuelve null
          7. No incluyas texto fuera del JSON`
        },
        {
          role: "user",
          content: `Ejemplo de respuesta correcta:
          Problema: ¿Cuál es la altura del Pokémon llamado "pikachu"?
          Respuesta esperada:
          {
            "reasoning": "Se busca 'pikachu' en la lista de Pokémon. Se encuentra su altura: 4.",
            "solution": 4.0000000000
          }`
        },
        {
          role: "user",
          content: `Contexto disponible:
          Planetas: ${JSON.stringify(relevantContext.planets)}
          Personajes: ${JSON.stringify(relevantContext.people)}
          Pokémon: ${JSON.stringify(relevantContext.pokemons)}`
        },
        {
          role: "user",
          content: `Problema: ${problem.problem}`
        }
      ];

      const response = await chatCompletion(messages);
      const content = response.choices[0].message.content.trim();

      console.log("🔥 Respuesta recibida de la IA:", content);

      // Intentar parsear la respuesta con manejo de errores mejorado
      let parsed;
      try {
        const jsonStr = content.match(/\{[\s\S]*?\}/)?.[0];
        if (!jsonStr) {
          throw new Error("No se encontró un objeto JSON válido");
        }
        parsed = cleanAndParseJSON(jsonStr);
      } catch (error) {
        console.error("🔥 Error al parsear JSON:", error);
        throw new Error("No se pudo parsear la respuesta como JSON válido");
      }

      if (!parsed || typeof parsed !== 'object') {
        throw new Error("La respuesta no es un objeto JSON válido");
      }

      if (parsed.solution !== null && (typeof parsed.solution !== "number" || isNaN(parsed.solution))) {
        throw new Error("La solución debe ser un número válido o null si faltan datos");
      }

      // Redondear la solución a 10 decimales
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
