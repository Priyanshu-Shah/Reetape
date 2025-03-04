export async function fetchGeminiResponse(transcript: string): Promise<string> {
    try {
        console.log(transcript);
        const prompt = `Respond to the following query in a helpful, professional manner: ${transcript}`;

        const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama3:3b",
                prompt: prompt,
                stream: false, // Disable streaming for compatibility
            }),
        });

        if (!response.ok) {
            throw new Error("Llama API Error: " + response.statusText);
        }

        const result = await response.json();
        console.log("Llama Response:", result);

        return result.response;
    } catch (error) {
        console.error("Llama API Error:", error);
        throw new Error("Failed to generate response");
    }
}
