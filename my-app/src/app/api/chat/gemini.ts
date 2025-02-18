import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY!);

export async function fetchGeminiResponse(transcript: string): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const prompt = `Respond to the following query in a helpful, professional manner: ${transcript}`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        return response.text();
    } catch (error) {
        console.error('Gemini API Error:', error);
        throw new Error('Failed to generate response');
    }
}
