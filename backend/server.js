import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import Parser from 'rss-parser';

global.WebSocket = WebSocket;

dotenv.config();
dotenv.config({ path: '../.env' });

const app = express();
const port = process.env.PORT || 5680;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || "https://tbgkhbmsmdfpdcjnztvz.supabase.co";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZ2toYm1zbWRmcGRjam56dHZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MTY3NDIsImV4cCI6MjA5OTk5Mjc0Mn0.159ex2E4xtfQXd_UN4kdjRCkSIhTMARwWvs7iBUrrR0";

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Gemini
const geminiApiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(geminiApiKey);

// --- Shared Helpers ---

/**
 * Generate a Pollinations.ai image URL from a descriptive prompt
 */
function buildImageUrl(imagePrompt, seed) {
    const enhancedPrompt = `${imagePrompt}, stunning high resolution photography, cinematic lighting, 8k, ultra-detailed`;
    const randomSeed = seed !== undefined ? seed : Math.floor(Math.random() * 999999);
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?seed=${randomSeed}&nologo=true&width=1080&height=1350`;
}

/**
 * Build an array of per-slide image URLs from parsed slide data.
 * Last slide (CTA) gets null. Each slide gets a unique seed.
 */
function buildImageUrls(slides) {
    const baseSeed = Math.floor(Math.random() * 90000) + 10000;
    return slides.map((slide, i) => {
        const isCTA = slide.is_cta === true || i === slides.length - 1;
        if (isCTA) return null;
        const prompt = slide.image_prompt || `${slide.title} vivid photography`;
        return buildImageUrl(prompt, baseSeed + i * 1000);
    });
}

/**
 * Inject active brand context into a Gemini prompt
 */
function getBrandContextBlock(brandContext) {
    if (!brandContext || Object.keys(brandContext).length === 0) return '';
    const lines = ['\n\nACTIVE BRAND CONTEXT — apply this voice and identity throughout all generated text:'];
    if (brandContext.name)         lines.push(`• Brand Name: ${brandContext.name}`);
    if (brandContext.handle)       lines.push(`• Handle: ${brandContext.handle}`);
    if (brandContext.narrative)    lines.push(`• Brand Narrative: ${brandContext.narrative}`);
    if (brandContext.toneOfVoice)  lines.push(`• Tone of Voice: ${brandContext.toneOfVoice} — write in this tone throughout`);
    if (brandContext.icp)          lines.push(`• Target Audience (ICP): ${brandContext.icp}`);
    return lines.join('\n');
}

/**
 * Shared JSON schema description for structured output
 */
const SLIDE_SCHEMA = `{
  "slides": [
    {
      "title": "Short punchy slide title (max 8 words)",
      "content": "Slide body copy (max 40 words, scannable)",
      "image_prompt": "Detailed image generation prompt for this specific slide's visual (omit ONLY for the CTA final slide)",
      "is_cta": false
    }
  ],
  "caption": {
    "hook": "Scroll-stopping first line — creates curiosity gap or bold claim (1-2 sentence max)",
    "body": "Value-packed summary expanding on the slide points (2-4 sentences)",
    "cta": "Primary call-to-action matching the final slide directive",
    "hashtags": {
      "niche": ["#NicheTag1", "#NicheTag2", "#NicheTag3", "#NicheTag4", "#NicheTag5"],
      "broad": ["#BroadTag1", "#BroadTag2", "#BroadTag3"],
      "high_intent": ["#HighIntent1", "#HighIntent2", "#HighIntent3"]
    }
  }
}`;

// Function to collect all configured Gemini API keys
function getGeminiApiKeys() {
    const keys = [];
    if (process.env.GEMINI_API_KEYS) {
        keys.push(...process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(Boolean));
    }
    if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY.trim());
    if (process.env.GEMINI_API_KEY_2) keys.push(process.env.GEMINI_API_KEY_2.trim());
    if (process.env.GEMINI_API_KEY_3) keys.push(process.env.GEMINI_API_KEY_3.trim());
    if (process.env.GEMINI_API_KEY_4) keys.push(process.env.GEMINI_API_KEY_4.trim());
    if (process.env.GEMINI_API_KEY_5) keys.push(process.env.GEMINI_API_KEY_5.trim());
    return [...new Set(keys)].filter(Boolean);
}

async function generateAIContent(prompt) {
    const apiKeys = getGeminiApiKeys();
    if (apiKeys.length === 0) {
        throw new Error("No GEMINI_API_KEY or GEMINI_API_KEYS found in environment variables.");
    }

    const models = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.0-flash-exp", "gemini-1.5-flash-latest"];
    let lastError = null;

    for (let kIdx = 0; kIdx < apiKeys.length; kIdx++) {
        const apiKey = apiKeys[kIdx];
        const keyTag = `...${apiKey.slice(-4)}`;
        const client = new GoogleGenerativeAI(apiKey);

        for (const m of models) {
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const modelObj = client.getGenerativeModel({ model: m });
                    const result = await modelObj.generateContent(prompt);
                    return result;
                } catch (err) {
                    lastError = err;
                    const errMsg = err.message || '';
                    console.warn(`[AI Failover] Key ${kIdx + 1}/${apiKeys.length} (${keyTag}) | Model ${m} | Attempt ${attempt + 1} failed: ${errMsg.substring(0, 120)}`);

                    const isQuotaOrLimit = err.status === 429 || 
                        errMsg.includes('429') || 
                        errMsg.includes('Quota exceeded') || 
                        errMsg.includes('quota') || 
                        errMsg.includes('limit') || 
                        errMsg.includes('token');

                    if (isQuotaOrLimit) {
                        console.warn(`[AI Failover] Quota/Token limit hit on key (${keyTag}). Switching to next available API key...`);
                        break;
                    } else if (attempt === 0) {
                        await new Promise(r => setTimeout(r, 1500));
                    }
                }
            }

            const isQuotaError = lastError && (lastError.status === 429 || lastError.message?.includes('429') || lastError.message?.includes('Quota') || lastError.message?.includes('quota'));
            if (isQuotaError) {
                break;
            }
        }
    }

    throw lastError || new Error("All Gemini API keys and models failed.");
}

/**
 * Sanitize brand_id for Supabase — reject mock/default IDs
 */
function sanitizeBrandId(brand_id) {
    if (!brand_id || typeof brand_id !== 'string') return null;
    if (brand_id.startsWith('default') || brand_id.startsWith('mock') || brand_id.startsWith('new-')) return null;
    return brand_id;
}

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Loksewa Backend is running', version: '2.0.0' });
});

// ============================================================
// POST /generate — Manual Content Lab
// ============================================================
app.post('/generate', async (req, res) => {
    const { topic, contentType, promptTemplate, brand_id, brand_context, brand_snapshot } = req.body;

    if (!topic || !contentType) {
        return res.status(400).json({ error: "Missing topic or contentType" });
    }

    try {
        console.log(`[/generate] [${contentType}] topic: "${topic}"`);
        const brandCtx = getBrandContextBlock(brand_context);
        let prompt;
        if (promptTemplate) {
            prompt = promptTemplate
                .replace(/\$\{topic\}/g, topic)
                .replace(/\$\{contentType\}/g, contentType);
            prompt += brandCtx;
            prompt += `\n\nIMPORTANT: Format output as JSON matching this schema exactly (no markdown wrapping):\n${SLIDE_SCHEMA}`;
        } else {
            prompt = `You are an expert Loksewa (Nepal Public Service Commission) social media content creator.${brandCtx}

Create a viral, educational Instagram carousel on the following:
Topic: ${topic}
Content Type: ${contentType}

CAROUSEL NARRATIVE FRAMEWORK (STRICT):
- Slide 1: INTRODUCTION — Be creative and write something related to the topic in short. The body part on this first slide can be a bit longer. DO NOT just write a mind-blowing fact. Include a highly descriptive image_prompt.
- Slides 2-N-1: CORE IDEAS — ONE distinct idea per slide. CRITICAL RULE: EVERY SINGLE SLIDE MUST HAVE COMPLETELY UNIQUE AND DIFFERENT TEXT. DO NOT REPEAT TEXT. Include a completely unique image_prompt for each slide.
- FINAL SLIDE: CTA only. Set "is_cta": true. Title: "Follow @ammaazzingg 📌". Content: "Read the caption for the full breakdown ↓\n\nFollow ${brand_context?.handle || '@ammaazzingg'} for daily updates." NO image_prompt on this slide.

Return ONLY valid JSON, no markdown. Use this exact schema:
${SLIDE_SCHEMA}`;
        }

        const result = await generateAIContent(prompt);
        let text = result.response.text().trim();

        // Strip markdown fences if present
        text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            console.error("Gemini invalid JSON for /generate:", text.substring(0, 300));
            return res.status(500).json({ error: "AI returned invalid JSON" });
        }

        if (brand_snapshot) {
            parsed.brand_snapshot = brand_snapshot;
        }

        const imageUrls = buildImageUrls(parsed.slides);

        const cleanBrandId = sanitizeBrandId(brand_id);
        const { data, error } = await supabase
            .from('posts')
            .insert([{
                topic: `[${contentType}] ${topic}`,
                text: JSON.stringify(parsed),
                status: 'Draft',
                image_url: JSON.stringify(imageUrls),
                brand_id: cleanBrandId
            }])
            .select();

        if (error) {
            console.error("Supabase error:", error);
            return res.json({ success: true, text: JSON.stringify(parsed), image_url: JSON.stringify(imageUrls), db_error: error.message });
        }

        console.log("Saved post:", data[0].id);
        res.json({ success: true, post: data[0] });

    } catch (err) {
        console.error("Server error /generate:", err);
        res.status(500).json({ error: "Internal server error: " + err.message });
    }
});

// ============================================================
// POST /refine — Reject & Refine
// ============================================================
app.post('/refine', async (req, res) => {
    const { topic, currentText, note, brand_context } = req.body;

    if (!topic || !currentText || !note) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const brandCtx = getBrandContextBlock(brand_context);

    try {
        const prompt = `You are an expert Loksewa content creator. Rewrite the following carousel content based on user feedback.${brandCtx}

Topic: "${topic}"
Current Content: ${currentText}
User Feedback: "${note}"

Incorporate the feedback precisely. Return ONLY valid JSON matching this schema (no markdown):
${SLIDE_SCHEMA}`;

        const result = await generateAIContent(prompt);
        let text = result.response.text().trim().replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

        res.json({ text });
    } catch (err) {
        console.error("Refine error:", err);
        res.status(500).json({ error: "Failed to refine content" });
    }
});

// ============================================================
// POST /generate-video — Video Prompts
// ============================================================
app.post('/generate-video', async (req, res) => {
    const { originalResearch, format, splits } = req.body;

    if (!originalResearch || !format) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        let prompt = `You are an expert AI Video Prompt Engineer. Convert the following research into video generation prompts for Sora or Runway.\n\nResearch:\n${originalResearch}\n\n`;
        if (format === 'single') {
            prompt += `Create one single, continuous, highly detailed prompt (visuals, lighting, motion, style).`;
        } else {
            prompt += `Create exactly ${splits || 4} separate scene prompts. Label them "Scene 1:", "Scene 2:", etc. For each: exact visuals, lighting, camera movement.`;
        }

        const result = await generateAIContent(prompt);
        res.json({ prompts: result.response.text() });
    } catch (err) {
        console.error("Video generation error:", err);
        res.status(500).json({ error: "Failed to generate video prompts" });
    }
});

// ============================================================
// POST /generate-news — News Lab
// ============================================================
app.post('/generate-news', async (req, res) => {
    const { topic, category, brand_id, language, contentType, brand_context, slide_count, brand_snapshot } = req.body;
    const targetLanguage = language || "English";
    const templateStyle = contentType || "Standard News Summary";
    const selectedCategory = category || "Weird & Bizarre News (Worldwide)";
    const brandCtx = getBrandContextBlock(brand_context);
    const requestedSlides = parseInt(slide_count) === 1 ? 1 : 4;
    const handle = brand_context?.handle || '@ammaazzingg';

    try {
        console.log(`[/generate-news] topic: "${topic || 'auto'}", category: "${selectedCategory}", style: "${templateStyle}", lang: ${targetLanguage}, slides: ${requestedSlides}`);

        let storyTitle = topic ? topic.trim() : "";
        let storyContent = "";
        let storyLink = "https://news.google.com";

        if (!storyTitle) {
            // Automatic Generation based on Category
            let feedUrls = [
                'https://feeds.bbci.co.uk/news/world/rss.xml',
                'https://www.theguardian.com/world/rss',
                'https://rss.nytimes.com/services/xml/rss/nyt/World.xml'
            ];

            if (selectedCategory.includes('Nepal')) {
                feedUrls = [
                    'https://kathmandupost.com/rss',
                    'https://myrepublica.nagariknetwork.com/rss',
                    'https://thehimalayantimes.com/rss'
                ];
            } else if (selectedCategory.includes('Good News')) {
                feedUrls = ['https://www.goodnewsnetwork.org/feed/'];
            } else if (selectedCategory.includes('Science') || selectedCategory.includes('Discovery')) {
                feedUrls = ['https://www.sciencedaily.com/rss/all.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml'];
            } else if (selectedCategory.includes('Health')) {
                feedUrls = ['https://rss.nytimes.com/services/xml/rss/nyt/Health.xml'];
            } else if (selectedCategory.includes('Tech') || selectedCategory.includes('Information')) {
                feedUrls = ['https://feeds.feedburner.com/TechCrunch/', 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml'];
            } else if (selectedCategory.includes('Economy') || selectedCategory.includes('Finance')) {
                feedUrls = ['https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', 'https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml'];
            }

            let feed = null;
            for (const feedUrl of feedUrls) {
                try {
                    feed = await rssParser.parseURL(feedUrl);
                    if (feed.items && feed.items.length > 0) break;
                } catch (e) {
                    console.warn(`RSS ${feedUrl} failed:`, e.message);
                }
            }

            if (feed && feed.items && feed.items.length > 0) {
                const newsItem = feed.items[Math.floor(Math.random() * Math.min(10, feed.items.length))];
                storyTitle = newsItem.title || "Recent News Story";
                storyLink = newsItem.link || storyLink;
                storyContent = newsItem.contentSnippet || newsItem.content || '';
            } else {
                storyTitle = `Top Story in ${selectedCategory}`;
                storyContent = `Latest developments in ${selectedCategory}`;
            }
        }

        console.log(`Final story focus: "${storyTitle}" (Requested Slides: ${requestedSlides})`);

        const narrativeFramework = requestedSlides === 1 ? `SINGLE SLIDE NEWS CARD FRAMEWORK (STRICT):
- Return EXACTLY 1 slide in the "slides" array.
- Slide 1: Complete 1-card News Flash. Include an attention-grabbing headline as "title", a comprehensive 2-3 sentence news breakdown as "content", and a highly descriptive "image_prompt" related to the story.` : `CAROUSEL NARRATIVE FRAMEWORK (STRICT):
- Return EXACTLY 4 slides in the "slides" array.
- Slide 1: INTRODUCTION — Be creative and write something related to the news story in short. Include a highly descriptive image_prompt.
- Slides 2-3: KEY FACTS — key breakdown or timeline per slide. CRITICAL RULE: EVERY SINGLE SLIDE MUST HAVE COMPLETELY UNIQUE AND DIFFERENT TEXT. DO NOT REPEAT TEXT. Include a unique image_prompt for each slide.
- Slide 4 (FINAL CTA): Set "is_cta": true. Title: "What Do You Think? 🤔". Content: "Read caption for full story + source link ↓\n\nFollow ${handle} for daily updates." NO image_prompt.`;

        const topicDirective = topic ? `CRITICAL MANDATE: The user explicitly specified the topic: "${storyTitle}". The ENTIRE news post (titles, content, image prompts) MUST be 100% strictly about "${storyTitle}". DO NOT introduce unrelated news.` : `Topic / Story Title: ${storyTitle}`;

        const prompt = `You are an expert social media news content creator.${brandCtx}

${topicDirective}
Category / Context: ${selectedCategory}
Summary Context: ${storyContent || 'Generate a compelling breakdown of this topic.'}
Style: "${templateStyle}"
Source Link: ${storyLink}
Total Slides Required: EXACTLY ${requestedSlides} slide(s).

${narrativeFramework}

Write all slide text in ${targetLanguage}.

Return ONLY valid JSON (no markdown):
${SLIDE_SCHEMA}`;

        const result = await generateAIContent(prompt);
        let text = result.response.text().trim().replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            console.error("Gemini invalid JSON for /generate-news:", text.substring(0, 300));
            return res.status(500).json({ error: "AI returned invalid JSON" });
        }

        if (brand_snapshot) {
            parsed.brand_snapshot = brand_snapshot;
        }

        // STRICT ENFORCEMENT: Enforce exact slide count requested by user
        if (parsed.slides && Array.isArray(parsed.slides)) {
            if (requestedSlides === 1) {
                parsed.slides = parsed.slides.slice(0, 1);
                if (parsed.slides[0]) {
                    parsed.slides[0].is_cta = false;
                    if (!parsed.slides[0].image_prompt) {
                        parsed.slides[0].image_prompt = `${storyTitle} news visual`;
                    }
                }
            } else if (parsed.slides.length > 4) {
                parsed.slides = parsed.slides.slice(0, 4);
            }
        }

        const imageUrls = buildImageUrls(parsed.slides);
        const cleanBrandId = sanitizeBrandId(brand_id);
        const insertObj = {
            topic: `[News Lab] ${storyTitle.substring(0, 60)}`,
            text: JSON.stringify(parsed),
            status: 'Draft',
            image_url: JSON.stringify(imageUrls)
        };
        if (cleanBrandId) insertObj.brand_id = cleanBrandId;

        const { data, error } = await supabase
            .from('posts')
            .insert([insertObj])
            .select();

        if (error) {
            console.error("Supabase news error:", error);
            return res.json({
                success: true,
                topic: storyTitle,
                category: selectedCategory,
                text: JSON.stringify(parsed),
                image_url: JSON.stringify(imageUrls),
                db_error: error.message
            });
        }

        res.json({
            success: true,
            topic: storyTitle,
            category: selectedCategory,
            post: data ? data[0] : null
        });

    } catch (error) {
        console.error("Error in /generate-news:", error);
        res.status(500).json({ error: error.message || "Failed to generate news content" });
    }
});

// ============================================================
// POST /generate-facts — Facts Lab
// ============================================================
app.post('/generate-facts', async (req, res) => {
    const { topic, language, slide_count, brand_id, brand_context, brand_snapshot } = req.body;
    const targetLanguage = language || "English";
    const count = parseInt(slide_count) || 5;
    const factTopic = topic || "Sharks are older than trees";
    const brandCtx = getBrandContextBlock(brand_context);
    const handle = brand_context?.handle || '@ammaazzingg';
    try {
        console.log(`[/generate-facts] "${factTopic}", ${count} slides, ${targetLanguage}`);

        let prompt;
        if (count === 1) {
            prompt = `You are an expert Instagram facts content creator.${brandCtx}

Create a single viral, high-converting Instagram fact slide.
Topic: "${factTopic}"
Language: ${targetLanguage}

MANDATORY SLIDE STRUCTURE:
- EXACTLY 1 SLIDE. No hook slide, no CTA slide.
- Title MUST be a short, bold, fascinating statement about the topic itself (max 10 words).
- Content: The most fascinating fact (max 35 words).
- image_prompt: dramatic wide-angle visual that makes the fact tangible.
- Do NOT set "is_cta": true.

TYPOGRAPHY & COPY RULES:
- Headlines: short, punchy, high contrast
- Body: max 35 words, scannable. Use line breaks for rhythm.
- Numbers and stats should be bolded in text (use ** for emphasis markers)

ALL text MUST be written in ${targetLanguage}.

Return ONLY valid JSON (no markdown):
${SLIDE_SCHEMA}`;
        } else {
            prompt = `You are an expert Instagram facts content creator.${brandCtx}

Create a viral, high-converting Instagram facts carousel.
Topic: "${factTopic}"
Total Slides: ${count}
Language: ${targetLanguage}

MANDATORY SLIDE STRUCTURE:
- Slide 1 (HOOK): Title MUST be a short, bold, fascinating statement about the topic itself (Example: "Sharks are older than trees!"). NEVER use generic clickbait titles. Content: the single most fascinating fact (max 15 words). image_prompt: dramatic wide-angle visual that makes the fact tangible.
- Slides 2 to ${count - 1} (FACTS): ONE fascinating fact per slide. Max 35 words body. Bold key numbers/stats. Each must have a unique, specific image_prompt.
- Slide ${count} (CTA — MANDATORY): Set "is_cta": true. Title: "Follow @ammaazzingg 🔥". Content: "Read caption for the full breakdown ↓\n\nFollow ${handle} for new fascinating facts every day." DO NOT include image_prompt for this slide.

TYPOGRAPHY & COPY RULES:
- Headlines: 80pt+ impact — short, punchy, high contrast
- Body: max 35 words, scannable. Use line breaks for rhythm.
- Numbers and stats should be bolded in text (use ** for emphasis markers)

ALL text (titles, content, caption) MUST be written in ${targetLanguage}.

Return ONLY valid JSON (no markdown):
${SLIDE_SCHEMA}`;
        }

        const result = await generateAIContent(prompt);
        let text = result.response.text().trim().replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            console.error("Gemini invalid JSON for /generate-facts:", text.substring(0, 300));
            return res.status(500).json({ error: "AI returned invalid JSON" });
        }

        // Enforce title clean-up for Slide 1: strip generic meta-phrases
        if (parsed.slides && parsed.slides.length > 0) {
            let slide1Title = parsed.slides[0].title || '';
            slide1Title = slide1Title.replace(/Did You Know\??/gi, '')
                                     .replace(/Mind[- ]blowing facts?/gi, '')
                                     .replace(/Mind[- ]blowing/gi, '')
                                     .replace(/Amazing Facts?/gi, '')
                                     .replace(/Crazy Facts?/gi, '')
                                     .replace(/^Facts About /gi, '')
                                     .replace(/Facts Lab/gi, '')
                                     .trim();
            if (!slide1Title || slide1Title.length < 3) {
                slide1Title = factTopic.replace(/facts?/gi, '').trim();
            }
            parsed.slides[0].title = slide1Title;

            if (count > 1) {
                const lastSlide = parsed.slides[parsed.slides.length - 1];
                lastSlide.is_cta = true;
                delete lastSlide.image_prompt;
            } else {
                parsed.slides = parsed.slides.slice(0, 1);
            }
        }

        if (brand_snapshot) {
            parsed.brand_snapshot = brand_snapshot;
        }

        const imageUrls = buildImageUrls(parsed.slides);
        const cleanBrandId = sanitizeBrandId(brand_id);

        const { data, error } = await supabase
            .from('posts')
            .insert([{
                topic: `[Facts Lab] ${factTopic.substring(0, 60)}`,
                text: JSON.stringify(parsed),
                status: 'Draft',
                image_url: JSON.stringify(imageUrls),
                brand_id: cleanBrandId
            }])
            .select();

        if (error) {
            console.error("Supabase error:", error);
            return res.json({ success: true, text: JSON.stringify(parsed), image_url: JSON.stringify(imageUrls), db_error: error.message });
        }

        console.log("Saved Facts Lab post:", data[0].id, "Image URLs:", imageUrls.length, "slides");
        res.json({ success: true, post: data[0] });

    } catch (err) {
        console.error("Facts Lab error:", err);
        res.status(500).json({ error: "Internal server error: " + err.message });
    }
});


// ============================================================
// LabEngine-v1: Psychology & Mind Content Intelligence Endpoint
// ============================================================
app.post('/generate-psych', async (req, res) => {
    try {
        const { mode, topic, content_type, target_metric, brand_context, brand_id } = req.body;
        const brandCtx = getBrandContextBlock(brand_context);
        const handle = brand_context?.handle || '@amazingfacts.lab';

        if (!topic || !topic.trim()) {
            return res.status(400).json({ error: "Topic is required for Psychology Lab generation." });
        }

        const isResearchMode = (mode || '').toUpperCase() === 'RESEARCH';

        if (isResearchMode) {
            const researchPrompt = `You are the primary engine behind "LabEngine-v1", an automated content intelligence system for psychological and mind topics.

Goal: Perform psychological research on the topic: "${topic}".
Audience: "The Curious Optimizer" (Ages 18-35). Introspective, ambitious, seeking to understand human nature.

Output a structured Markdown report with the exact sections below:
1. Topic Overview & Scientific Basis
2. Psychological Mechanism Explained
3. Why Viewers Care (Emotional & Relational Drivers)
4. 3 Angle Hook Ideas for Content Generation
5. Virality Rating (1-10) with reasoning.

Keep facts grounded in real cognitive science, behavioral psychology, or neurobiology. Do not write superficial fluff.`;

            const aiRes = await generateAIContent(researchPrompt);
            const rawText = aiRes.response.text();

            return res.json({
                success: true,
                mode: "RESEARCH",
                markdown: rawText
            });
        }

        // GENERATE MODE
        const targetMetric = (target_metric || 'SAVES').toUpperCase();
        const contentType = (content_type || 'CAROUSEL').toUpperCase();

        const generatePrompt = `You are the primary engine behind "LabEngine-v1", an automated content intelligence system for psychological and mind topics.

Your goal is to generate social media content designed to maximize ${targetMetric === 'SHARES' ? 'DM SHARES (relational recognition)' : 'SAVES (high utility & reference)'}.

Topic: "${topic}"
Target Metric: ${targetMetric}
Content Type: ${contentType}
Handle/Brand: ${handle}
${brandCtx}

Audience: "The Curious Optimizer" (Ages 18-35). Introspective, ambitious, seeking to understand human nature.
Visual Style: Dark mode (#0B0C10 background), off-white high contrast text, minimal clean typography.

CONTENT RESILIENCE RULES:
- Hooks must create an open cognitive loop within 2 seconds.
- Grounded in real cognitive science, behavioral psychology, or neurobiology.
- Never write superficial fluff; frame facts as quiet revelations.
- Focus heavily on triggers that urge users to ${targetMetric}.

OUTPUT REQUIREMENT:
You MUST output ONLY valid JSON matching the exact schema below without any markdown wrappers (no \`\`\`json or \`\`\`):

{
  "generation_metadata": {
    "topic": "${topic}",
    "content_type": "${contentType}",
    "target_metric": "${targetMetric}"
  },
  "carousel": {
    "enabled": ${contentType === 'CAROUSEL' ? 'true' : 'false'},
    "slides": [
      {
        "slide_number": 1,
        "type": "HOOK_COVER",
        "header_text": "${handle}",
        "title_text": "Hook Title",
        "subtitle_text": "Sub-hook statement",
        "design_notes": "Dark background, high contrast title text"
      },
      {
        "slide_number": 2,
        "type": "BODY_VAL",
        "header_text": "01 / THE MECHANISM",
        "title_text": "Concept Name",
        "body_text": "Clear explanation of the psychology principle.",
        "highlight_words": ["words", "to", "highlight"]
      },
      {
        "slide_number": 3,
        "type": "BODY_VAL",
        "header_text": "02 / THE TRIGGER",
        "title_text": "Behavioral Pattern",
        "body_text": "Deep insight into cognitive response.",
        "highlight_words": ["key", "insight"]
      },
      {
        "slide_number": 4,
        "type": "CTA_FINAL",
        "header_text": "RESEARCH LAB",
        "title_text": "Actionable Takeaway",
        "body_text": "Save this to remember it later. Follow ${handle} for daily insights.",
        "is_cta": true
      }
    ]
  },
  "single_slide": {
    "enabled": ${contentType === 'SINGLE_SLIDE' ? 'true' : 'false'},
    "quote_text": "Powerful single psychology insight or quote",
    "attribution": "${handle}"
  },
  "reel_blueprint": {
    "enabled": ${contentType === 'REEL_BLUEPRINT' ? 'true' : 'false'},
    "hook_text": "On-screen text (0-2s)",
    "body_text": "On-screen text (2-7s)",
    "audio_prompt": "Voiceover / background audio style",
    "background_video_prompt": "Visual loop video description"
  },
  "caption": {
    "hook": "First line of caption",
    "body": "2-4 sentence deep dive explaining the psychology",
    "cta": "Primary CTA sentence",
    "hashtags": ["#psychologyfacts", "#humanbehavior", "#brainfacts", "#cognitivescience", "#mindfacts"]
  }
}`;

        const aiRes = await generateAIContent(generatePrompt);
        let rawText = aiRes.response.text();
        rawText = cleanJsonString(rawText);

        let parsed;
        try {
            parsed = JSON.parse(rawText);
        } catch (pe) {
            console.error("JSON parse error in /generate-psych:", pe.message, "Raw:", rawText.substring(0, 200));
            return res.status(500).json({ error: "Failed to parse structured JSON output: " + pe.message });
        }

        const cleanBrandId = sanitizeBrandId(brand_id);
        let postId = null;
        try {
            const { data, error } = await supabase
                .from('posts')
                .insert([{
                    topic: `[Psychology Lab] ${topic.substring(0, 60)}`,
                    text: JSON.stringify(parsed),
                    status: 'Draft',
                    brand_id: cleanBrandId
                }])
                .select();
            if (data && data[0]) postId = data[0].id;
        } catch (e) {}

        res.json({
            success: true,
            mode: "GENERATE",
            data: parsed,
            post_id: postId
        });
    } catch (err) {
        console.error("Psychology Lab error:", err);
        res.status(500).json({ error: "Internal server error: " + err.message });
    }
});

app.listen(port, () => {
    console.log(`Creator's Den Backend v2.0 running on port ${port}`);
});
