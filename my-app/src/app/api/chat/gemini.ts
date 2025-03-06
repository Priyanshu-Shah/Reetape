export async function fetchGeminiResponse(transcript: string): Promise<string> {
    try {
        console.log(transcript);
        const prompt = `Respond to the following query in a helpful, professional manner: ${transcript}`;
        const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3.2:3b",
                prompt: prompt,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error("Llama API Error: " + response.statusText);
        }

        const result = await response.json();
        console.log("Llama Response:", result);
        return result.response;
    } catch (error) {
        console.error("API Error:", error);
        return "I'm sorry, I couldn't process your request at this time.";
    }
}

// New streaming function
export async function streamGeminiResponse(transcript: string, onToken: (token: string) => void): Promise<void> {
    try {
        console.log("Streaming response for:", transcript);
        const prompt = `Respond to the following query in a helpful, professional manner: ${transcript}`;
        const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3.2:3b",
                prompt: prompt,
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error("Llama API Error: " + response.statusText);
        }

        // Process the stream
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            
            // Parse JSON chunks - Ollama returns each token as a JSON object
            const lines = chunk.split('\n').filter(Boolean);
            
            for (const line of lines) {
                try {
                    const parsedChunk = JSON.parse(line);
                    if (parsedChunk.response) {
                        onToken(parsedChunk.response);
                    }
                } catch (err) {
                    console.error("Error parsing chunk:", err);
                }
            }
        }
    } catch (error) {
        console.error("Streaming API Error:", error);
        onToken("I'm sorry, I couldn't process your request at this time.");
    }
}