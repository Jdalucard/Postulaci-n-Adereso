import { ChallengeResponse, StarWarsPlanet, StarWarsCharacter, Pokemon } from '../types';
import { chatCompletion } from './api';

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
  static async interpretProblem(problem: ChallengeResponse & { context?: ProblemContext }): Promise<ProblemAnswer> {
    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `Eres un asistente experto en resolver problemas matemáticos. 
          Debes analizar el problema y proporcionar una solución numérica precisa. toma en cuenta que debes poner en contexto todo el problema e interpretar la preguntas que se realiza  con los datos disponible para que obtengas el contexto correcto.
          Tu respuesta DEBE ser un objeto JSON válido con exactamente este formato:
          {
            "reasoning": "tu razonamiento detallado aquí",
            "solution": número
          }
          NO incluyas ningún otro texto fuera del objeto JSON.`
        },
        {
          role: 'user',
          content: `Problema: ${problem.problem}
          
          Datos disponibles:
          Planetas: ${JSON.stringify(problem.context?.starWarsPlanets || [])}
          Personajes: ${JSON.stringify(problem.context?.starWarsCharacters || [])}
          Pokémon: ${JSON.stringify(problem.context?.pokemons || [])}
          
          Por favor, analiza el problema y proporciona la solución numérica precisa usando los datos proporcionados.`
        }
      ];

      const response = await chatCompletion(messages);
      const content = response.choices[0].message.content.trim();
      
      console.log('OpenAI raw response:', content);
      
      // Extraer el JSON de la respuesta
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se encontró un objeto JSON válido en la respuesta');
      }
      
      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      
      if (typeof parsed.solution !== 'number' || isNaN(parsed.solution)) {
        throw new Error('La solución debe ser un número válido');
      }

      return {
        problem_id: problem.id,
        answer: parsed.solution
      };
    } catch (error) {
      console.error('Error interpreting problem with OpenAI:', error);
      throw error;
    }
  }
} 