import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import Parser from 'rss-parser';

global.WebSocket = WebSocket;

// Load environment variables (from .env locally, from Render dashboard in production)
dotenv.config();

const app = express();
const port = process.env.PORT || 5680;

app.use(cors());
app.use(express.json());

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || "https://tbgkhbmsmdfpdcjnztvz.supabase.co";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZ2toYm1zbWRmcGRjam56dHZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MTY3NDIsImV4cCI6MjA5OTk5Mjc0Mn0.159ex2E4xtfQXd_UN4kdjRCkSIhTMARwWvs7iBUrrR0";

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

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Loksewa Backend is running' });
});

app.post('/generate', async (req, res) => {
    const { topic, contentType, promptTemplate, brand_id } = req.body;

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

        // Sanitize brand_id for database insertion (ignore default-brand / mock IDs)
        const cleanBrandId = (brand_id && typeof brand_id === 'string' && !brand_id.startsWith('default') && !brand_id.startsWith('mock')) ? brand_id : null;

        // 2. Insert into Supabase
        const { data, error } = await supabase
            .from('posts')
            .insert([
                { 
                    topic: `[${contentType}] ${topic}`, 
                    text: text, 
                    status: 'Draft',
                    image_url: generatedImageUrl,
                    brand_id: cleanBrandId
                }
            ])
            .select();

        if (error) {
            console.error("Supabase Error:", error);
            // Still return generated content even if DB insert fails
            return res.json({ success: true, text: text, image_url: generatedImageUrl, db_error: error.message });
        }

        console.log("Successfully generated and saved post:", data[0].id);
        res.json({ success: true, post: data[0] });

    } catch (err) {
        console.error("Server Error:", err);
        res.status(500).json({ error: "Internal server error: " + err.message });
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

const rssParser = new Parser();

// --- Generate News Lab Endpoint ---
app.post('/generate-news', async (req, res) => {
    const { brand_id, language, contentType } = req.body;
    const targetLanguage = language || "English";
    const templateStyle = contentType || "Standard News Summary";

    try {
        console.log(`Fetching weird news for News Lab`);
        
        // Try multiple RSS feeds in order of preference
        const RSS_FEEDS = [
            'https://feeds.bbci.co.uk/news/world/rss.xml',   // BBC World News
            'https://www.theguardian.com/world/rss',           // The Guardian World
            'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' // NYT World
        ];
        
        let feed = null;
        let feedError = null;
        for (const feedUrl of RSS_FEEDS) {
            try {
                feed = await rssParser.parseURL(feedUrl);
                if (feed.items && feed.items.length > 0) break;
            } catch (e) {
                feedError = e;
                console.warn(`RSS feed ${feedUrl} failed:`, e.message);
            }
        }
        
        if (!feed || !feed.items || feed.items.length === 0) {
            return res.status(500).json({ error: "No news found in any RSS feed: " + (feedError?.message || 'unknown') });
        }

        // Pick a random recent news item
        const newsItem = feed.items[Math.floor(Math.random() * Math.min(10, feed.items.length))];
        const newsTitle = newsItem.title;
        const newsLink = newsItem.link;
        const newsContent = newsItem.contentSnippet || newsItem.content || '';

        console.log(`Selected weird news: ${newsTitle}`);
        
        // 1. Generate content with Gemini
        let text = "";
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const prompt = `You are an expert social media content creator. Create an engaging news post about the following international news story.
The output format and writing style MUST be tailored to this specific style: "${templateStyle}".

Title: ${newsTitle}
Summary: ${newsContent}

Format the output strictly as a JSON object with the following schema:
{
  "slides": [
    {
      "title": "Short catchy title for slide",
      "content": "Content for the slide"
    }
  ],
  "caption": "Engaging caption for social media including hashtags. MUST INCLUDE EXACTLY 'Source: ${newsLink}' at the end of the caption."
}
Do NOT include markdown formatting like \`\`\`json around the response. Return ONLY valid JSON. Make it 3-5 slides.
IMPORTANT: The generated text inside the JSON (both slides and caption) MUST be written in ${targetLanguage}.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        text = response.text();

        // Try to parse to ensure it's valid JSON
        try {
            JSON.parse(text);
        } catch (e) {
            console.error("Gemini returned invalid JSON for news", text);
            return res.status(500).json({ error: "AI generated invalid JSON" });
        }

        // Generate AI image URL using pollinations.ai
        const cleanTitle = newsTitle.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 100);
        const generatedImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanTitle + " realistic photography cinematic lighting weird funny")}`;

        // Sanitize brand_id for database insertion (ignore default-brand / mock IDs)
        const cleanBrandId = (brand_id && typeof brand_id === 'string' && !brand_id.startsWith('default') && !brand_id.startsWith('mock')) ? brand_id : null;

        // 2. Insert into Supabase
        const { data, error } = await supabase
            .from('posts')
            .insert([
                { 
                    topic: `[News Lab] ${newsTitle.substring(0, 50)}...`, 
                    text: text, 
                    status: 'Draft',
                    image_url: generatedImageUrl,
                    brand_id: cleanBrandId
                }
            ])
            .select();

        if (error) {
            console.error("Supabase Error:", error);
            return res.json({ success: true, text: text, image_url: generatedImageUrl, db_error: error.message });
        }

        console.log("Successfully generated and saved News Lab post:", data[0].id);
        res.json({ success: true, post: data[0] });

    } catch (err) {
        console.error("News Lab Error:", err);
        res.status(500).json({ error: "Internal server error: " + err.message });
    }
});

// --- Generate Facts Lab Endpoint ---
app.post('/generate-facts', async (req, res) => {
    const { topic, language, slide_count, brand_id } = req.body;
    const targetLanguage = language || "English";
    const count = parseInt(slide_count) || 5;
    const factTopic = topic || "Sharks are older than trees";

    try {
        console.log(`Generating Facts Lab carousel for: ${factTopic}`);
        
        let text = "";
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const prompt = `You are an expert social media facts content creator for Instagram. Create a viral, high-converting facts carousel on the topic: "${factTopic}".

CRITICAL SLIDE STRUCTURE REQUIREMENT:
- Slide 1 MUST be a high-converting cover hook. The title MUST be "Did You Know?" or "Mind-Blowing Fact:" and the content MUST be a bold hook statement (e.g., "Sharks are 100 million years older than trees!").
- Slides 2 to ${count - 1} MUST break down the topic with fascinating details, evolutionary context, timeline, or mind-blowing stats.
- Slide ${count} MUST be an engaging call to action asking users to double tap, share, or follow for daily facts.

Format the output strictly as a JSON object with the following schema:
{
  "slides": [
    {
      "title": "Short catchy title for slide",
      "content": "Content for the slide"
    }
  ],
  "caption": "Engaging Instagram caption summarizing the fact, asking a question to boost comments, and including 10 high-ranking hashtags."
}
Do NOT include markdown formatting like \`\`\`json around the response. Return ONLY valid JSON.
IMPORTANT: The generated text inside the JSON (both slides and caption) MUST be written in ${targetLanguage}.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        text = response.text();

        // Try to parse to ensure it's valid JSON
        try {
            JSON.parse(text);
        } catch (e) {
            console.error("Gemini returned invalid JSON for facts", text);
            return res.status(500).json({ error: "AI generated invalid JSON" });
        }

        // Generate AI image URL using pollinations.ai
        const cleanTopic = factTopic.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 100);
        const generatedImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanTopic + " stunning high resolution photography detailed vibrant cinematic 8k")}`;

        // Sanitize brand_id for database insertion (ignore default-brand / mock IDs)
        const cleanBrandId = (brand_id && typeof brand_id === 'string' && !brand_id.startsWith('default') && !brand_id.startsWith('mock')) ? brand_id : null;

        // Insert into Supabase
        const { data, error } = await supabase
            .from('posts')
            .insert([
                { 
                    topic: `[Facts Lab] ${factTopic.substring(0, 50)}`, 
                    text: text, 
                    status: 'Draft',
                    image_url: generatedImageUrl,
                    brand_id: cleanBrandId
                }
            ])
            .select();

        if (error) {
            console.error("Supabase Error:", error);
            return res.json({ success: true, text: text, image_url: generatedImageUrl, db_error: error.message });
        }

        console.log("Successfully generated and saved Facts Lab post:", data[0].id);
        res.json({ success: true, post: data[0] });

    } catch (err) {
        console.error("Facts Lab Error:", err);
        res.status(500).json({ error: "Internal server error: " + err.message });
    }
});

app.listen(port, () => {
    console.log(`Loksewa Backend is running on port ${port}`);
    console.log(`Ready to generate content!`);
});
