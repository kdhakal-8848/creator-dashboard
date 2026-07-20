import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

global.WebSocket = WebSocket;

// Load environment variables from the parent directory's .env file
dotenv.config({ path: '../.env' });

const app = express();
const port = 5680; // Changed to 5680 to avoid collision with the old server process

app.use(cors());
app.use(express.json());

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Gemini
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey || geminiApiKey === 'YOUR_GEMINI_API_KEY') {
    console.error("Missing GEMINI_API_KEY in .env");
}
const genAI = new GoogleGenerativeAI(geminiApiKey);

app.post('/generate', async (req, res) => {
    const { topic, contentType, promptTemplate } = req.body;

    if (!topic || !contentType) {
        return res.status(400).json({ error: "Missing topic or contentType" });
    }

    try {
        console.log(`Generating [${contentType}] for topic: ${topic}`);
        
        // 1. Generate content with Gemini
        let text = "";
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            
            let prompt = `You are an expert Loksewa (Public Service Commission Nepal) content creator.
Generate content based on the following parameters:
Topic: ${topic}
Content Type: ${contentType}

Format the output strictly as a JSON object with the following schema:
{
  "slides": [
    {
      "title": "Short title for the slide",
      "content": "Content for the slide"
    }
  ],
  "caption": "Engaging caption for social media including hashtags"
}
Do NOT include markdown formatting like \`\`\`json around the response. Return ONLY valid JSON.`;

            if (promptTemplate) {
                // Replace tokens if user provided a template
                prompt = promptTemplate.replace(/\$\{topic\}/g, topic).replace(/\$\{contentType\}/g, contentType);
            }

            const result = await model.generateContent(prompt);
            const response = await result.response;
            text = response.text();
        } catch (geminiError) {
            console.error("Gemini API failed, using fallback content:", geminiError.message);
            text = JSON.stringify({
                slides: [
                    { title: "Loksewa Tayari", content: `Topic: ${topic}\n\nContent Type: ${contentType}` },
                    { title: "Details", content: "(Note: This is fallback content because the Gemini API request failed. Please check your API key.)" }
                ],
                caption: `Test your knowledge on ${topic}! #Loksewa #PSC #Nepal`
            });
        }

        // Generate AI image URL using free pollinations.ai API
        const generatedImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(topic + " high quality photography")}`;

        // 2. Insert into Supabase
        const { data, error } = await supabase
            .from('posts')
            .insert([
                { 
                    topic: `[${contentType}] ${topic}`, 
                    text: text, 
                    status: 'Draft',
                    image_url: generatedImageUrl
                }
            ])
            .select();

        let postData;
        if (error) {
            console.error("Supabase Error (Fallback to Mock Data):", error);
            postData = {
                id: Date.now().toString(),
                topic: `[${contentType}] ${topic}`,
                text: text,
                status: 'Draft',
                image_url: generatedImageUrl,
                updated_at: new Date().toISOString()
            };
        } else {
            postData = data[0];
            console.log("Successfully generated and saved post:", postData.id);
        }

        res.status(200).json({ success: true, post: postData });

    } catch (err) {
        console.error("Server Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// --- Refine Endpoint ---
app.post('/refine', async (req, res) => {
    const { topic, currentText, note } = req.body;

    if (!topic || !currentText || !note) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        console.log(`Refining content for topic: ${topic}`);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const prompt = `You are an expert Loksewa content creator. The user rejected the following generated content for the topic "${topic}".
        
Original Content:
${currentText}

User Rejection Note:
"${note}"

Please rewrite the content incorporating the user's feedback. You MUST return strictly a JSON object matching this schema, without markdown formatting:
{
  "slides": [ { "title": "...", "content": "..." } ],
  "caption": "..."
}`;

        const result = await model.generateContent(prompt);
        const text = await result.response.text();

        res.json({ text: text });
    } catch (err) {
        console.error("Refine Error:", err);
        res.status(500).json({ error: "Failed to refine content" });
    }
});

// --- Generate Video Endpoint ---
app.post('/generate-video', async (req, res) => {
    const { originalResearch, format, splits } = req.body;

    if (!originalResearch || !format) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        console.log(`Generating Video Prompts, Format: ${format}`);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        let prompt = `You are an expert AI Video Prompt Engineer. Convert the following research into video generation prompts for an AI Video Generator (like Sora or Runway).
Research:
${originalResearch}

`;
        if (format === 'single') {
            prompt += `Create one single, continuous, highly detailed prompt that encapsulates this entire research into a coherent video scene. Focus on visuals, lighting, motion, and style.`;
        } else {
            prompt += `Create exactly ${splits || 4} separate scene prompts. Label them sequentially (e.g., "Scene 1:", "Scene 2:"). For each scene, describe the exact visual details, lighting, and camera movement.`;
        }

        const result = await model.generateContent(prompt);
        const text = await result.response.text();

        res.json({ prompts: text });
    } catch (err) {
        console.error("Video Generation Error:", err);
        res.status(500).json({ error: "Failed to generate video prompts" });
    }
});

app.listen(port, () => {
    console.log(`Loksewa Backend is running on http://localhost:${port}`);
    console.log(`Ready to generate content!`);
});
