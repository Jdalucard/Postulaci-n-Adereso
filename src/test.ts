import { OpenAIService } from './services/openaiService';
import { getTestChallenge } from './services/api';

async function testMath(problem: string) {
    try {
        const interpretation = await OpenAIService.interpretProblem({ 
            id: 'test',
            problem,
            expression: '{}',
            solution: 0
        });
        
        console.log('\n=== Consulta ===');
        console.log('Problema:', problem);
        
        console.log('\n=== Datos Contextuales ===');
        console.log('Personaje de Star Wars:', interpretation.context.starWarsCharacter);
        console.log('Pokémon:', interpretation.context.pokemon);
        console.log('Planeta:', interpretation.context.starWarsPlanet);
        
        console.log('\n=== Análisis Matemático ===');
        console.log('Operación:', interpretation.operation);
        console.log('Valor 1:', interpretation.value1);
        console.log('Valor 2:', interpretation.value2);
        console.log('Solución:', interpretation.solution);
        
        console.log('\n=== Explicación Contextual ===');
        console.log(interpretation.explanation);
        
        console.log('\n' + '='.repeat(50));
        return interpretation.solution;
    } catch (error) {
        console.error('Error en la prueba:', error);
        throw error;
    }
}

async function runAllTests() {
    try {
        console.log('Obteniendo problemas desde la API...\n');
        const challenge = await getTestChallenge();
        
        console.log('Iniciando pruebas con datos de Star Wars y Pokémon...\n');
        await testMath(challenge.problem);
        
        console.log('\nPruebas completadas');
    } catch (error) {
        console.error('Error al obtener los problemas:', error);
    }
}

runAllTests().catch(console.error); 