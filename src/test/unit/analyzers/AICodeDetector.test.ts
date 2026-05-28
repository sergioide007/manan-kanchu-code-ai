import { AICodeDetector } from '../../../analyzers/AICodeDetector';

const HUMAN_CODE = `
function fibonacci(n: number): number {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}
`;

const AI_CODE = `
/**
 * @description This function calculates the sum of two numbers.
 * @param {number} a - The first number to add
 * @param {number} b - The second number to add
 * @returns {number} The sum of a and b
 */
// This function handles the addition operation
// Initialize the result variable
// Helper function to perform basic arithmetic
function handleSubmit(a: number, b: number): number {
  // Create the result by adding the two numbers
  const result = a + b;
  // Return the calculated result
  return result;
}

// Helper function to validate inputs
function validateEmail(email: string): boolean {
  return email.includes('@');
}

// This method handles the data fetching operation
async function fetchData(url: string): Promise<unknown> {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}

// A simple function that formats the date
function formatDate(date: Date): string {
  return date.toISOString();
}
`;

describe('AICodeDetector', () => {
  const detector = new AICodeDetector(null, 0.4, 0.6);

  it('returns a score between 0 and 1', async () => {
    const result = await detector.analyzeCode(HUMAN_CODE, 'test.ts');
    expect(result.aiScore).toBeGreaterThanOrEqual(0);
    expect(result.aiScore).toBeLessThanOrEqual(1);
  });

  it('scores AI-style code higher than human code', async () => {
    const humanResult = await detector.analyzeCode(HUMAN_CODE, 'human.ts');
    const aiResult = await detector.analyzeCode(AI_CODE, 'ai.ts');
    expect(aiResult.heuristicScore).toBeGreaterThan(humanResult.heuristicScore);
  });

  it('includes file path in result', async () => {
    const result = await detector.analyzeCode(HUMAN_CODE, 'myFile.ts');
    expect(result.filePath).toBe('myFile.ts');
  });

  it('counts lines correctly', async () => {
    const result = await detector.analyzeCode(HUMAN_CODE, 'test.ts');
    expect(result.linesTotal).toBe(HUMAN_CODE.split('\n').length);
  });

  it('produces indicators with scores in [0,1]', async () => {
    const result = await detector.analyzeCode(AI_CODE, 'test.ts');
    for (const indicator of result.indicators) {
      expect(indicator.score).toBeGreaterThanOrEqual(0);
      expect(indicator.score).toBeLessThanOrEqual(1);
    }
  });

  it('creates a finding when score exceeds threshold', async () => {
    const result = await detector.analyzeCode(AI_CODE, 'test.ts');
    if (result.aiScore >= 0.65) {
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.findings[0].category).toBe('ai-generated');
    }
  });

  it('includes analysisModel in result', async () => {
    const result = await detector.analyzeCode(HUMAN_CODE, 'test.ts');
    expect(result.analysisModel).toBe('heuristic-only');
  });
});
