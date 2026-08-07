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
app.use(express.static('../frontend'));

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || "https://tbgkhbmsmdfpdcjnztvz.supabase.co";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZ2toYm1zbWRmcGRjam56dHZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MTY3NDIsImV4cCI6MjA5OTk5Mjc0Mn0.159ex2E4xtfQXd_UN4kdjRCkSIhTMARwWvs7iBUrrR0";

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Gemini
const geminiApiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(geminiApiKey);

// --- Shared Helpers ---

/**
 * Clean raw JSON string returned by LLM (strip markdown backticks / code fences)
 */
function cleanJsonString(str) {
    if (!str) return '';
    let cleaned = String(str).trim();
    cleaned = cleaned.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();
    const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
        cleaned = jsonMatch[0];
    }
    // Remove trailing commas before closing braces/brackets
    cleaned = cleaned.replace(/,\s*([\}\]])/g, '$1');
    return cleaned;
}

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
    // Filter out placeholder/template keys
    const validKeys = [...new Set(keys)].filter(k =>
        k && k.length > 20 && !k.includes('YOUR_') && !k.includes('PLACEHOLDER') && !k.startsWith('AQ.')
    );
    console.log(`[API Keys] Found ${validKeys.length} valid API key(s)`);
    return validKeys;
}

async function generateAIContent(prompt, options = {}) {
    const apiKeys = getGeminiApiKeys();
    if (apiKeys.length === 0) {
        throw new Error("No GEMINI_API_KEY or GEMINI_API_KEYS found in environment variables.");
    }

    // Valid Gemini API models in order of fallback priority
    const models = [
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
        "gemini-1.5-pro"
    ];
    let lastError = null;

    const generationConfig = options.generationConfig || {};
    if (options.jsonMode) {
        generationConfig.responseMimeType = "application/json";
    }

    for (let kIdx = 0; kIdx < apiKeys.length; kIdx++) {
        const apiKey = apiKeys[kIdx];
        const keyTag = `...${apiKey.slice(-4)}`;
        const client = new GoogleGenerativeAI(apiKey);

        for (const m of models) {
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const modelObj = client.getGenerativeModel({ model: m, generationConfig });
                    const result = await modelObj.generateContent(prompt);
                    console.log(`[AI Success] Generated content using model ${m} with API Key ${kIdx + 1}/${apiKeys.length} (${keyTag})`);
                    return result;
                } catch (err) {
                    lastError = err;
                    const errMsg = err.message || '';
                    console.warn(`[AI Failover] Key ${kIdx + 1}/${apiKeys.length} (${keyTag}) | Model ${m} | Attempt ${attempt + 1} failed: ${errMsg.substring(0, 120)}`);

                    const isQuotaOrLimit = err.status === 429 ||
                        errMsg.includes('429') ||
                        errMsg.includes('Quota exceeded') ||
                        errMsg.includes('quota') ||
                        errMsg.includes('RESOURCE_EXHAUSTED') ||
                        errMsg.includes('limit');

                    // Skip deprecated/not-found models immediately, no retry
                    const isDeprecatedOrNotFound = err.status === 404 ||
                        errMsg.includes('404') ||
                        errMsg.includes('not found') ||
                        errMsg.includes('not supported');

                    // Skip invalid/forbidden API key immediately
                    const isBadKey = err.status === 403 ||
                        errMsg.includes('403') ||
                        errMsg.includes('PERMISSION_DENIED') ||
                        errMsg.includes('API key not valid') ||
                        errMsg.includes('unregistered callers');

                    if (isQuotaOrLimit || isDeprecatedOrNotFound) {
                        console.warn(`[AI Failover] ${isDeprecatedOrNotFound ? 'Model deprecated/not found' : 'Quota/Rate limit'} — skipping model ${m}`);
                        break; // Move to next model immediately
                    } else if (isBadKey) {
                        console.warn(`[AI Failover] Bad/invalid API key (${keyTag}) — skipping all models for this key`);
                        break; // Move to next key
                    } else if (attempt === 0) {
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
            }
        }
    }

    throw lastError || new Error("All Gemini API keys and fallback models were exhausted.");
}

/**
 * Sanitize brand_id for Supabase — reject mock/default IDs
 */
function sanitizeBrandId(brand_id) {
    if (!brand_id || typeof brand_id !== 'string') return null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(brand_id)) return null;
    return brand_id;
}

// --- In-Memory Request Deduplication Cache (15-second window) ---
const recentGenerations = new Map();

function getDedupKey(req, topicStr) {
    const route = req.path || '';
    const topicClean = String(topicStr || '').toLowerCase().trim();
    const brandClean = String(req.body?.brand_id || '').trim();
    return `${route}:${brandClean}:${topicClean}`;
}

async function getExistingGeneration(dedupKey) {
    if (!dedupKey) return null;
    const entry = recentGenerations.get(dedupKey);
    if (entry && (Date.now() - entry.timestamp < 15000)) {
        console.log(`[DEDUP] Duplicate request detected for key: "${dedupKey}" within 15s`);
        if (entry.promise) {
            return await entry.promise;
        }
        return entry.result;
    }
    return null;
}

function setExistingGeneration(dedupKey, result, promise = null) {
    if (!dedupKey) return;
    recentGenerations.set(dedupKey, {
        timestamp: Date.now(),
        result: result,
        promise: promise
    });
    setTimeout(() => {
        recentGenerations.delete(dedupKey);
    }, 30000);
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

    const dedupKey = getDedupKey(req, topic);
    const existing = await getExistingGeneration(dedupKey);
    if (existing) return res.json(existing);

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

        const resObj = { success: true, post: data[0] };
        setExistingGeneration(dedupKey, resObj);
        res.json(resObj);

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

    const dedupKey = getDedupKey(req, topic || category);
    const existing = await getExistingGeneration(dedupKey);
    if (existing) return res.json(existing);

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

        const resObj = {
            success: true,
            topic: storyTitle,
            category: selectedCategory,
            post: data ? data[0] : null
        };
        setExistingGeneration(dedupKey, resObj);
        res.json(resObj);

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
    const dedupKey = getDedupKey(req, factTopic);
    const existing = await getExistingGeneration(dedupKey);
    if (existing) return res.json(existing);

    let resolveInflight;
    const inflightPromise = new Promise(resolve => { resolveInflight = resolve; });
    setExistingGeneration(dedupKey, null, inflightPromise);

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
            const resObj = { success: true, text: JSON.stringify(parsed), image_url: JSON.stringify(imageUrls), db_error: error.message };
            setExistingGeneration(dedupKey, resObj);
            if (resolveInflight) resolveInflight(resObj);
            return res.json(resObj);
        }

        const resObj = { success: true, post: data[0] };
        setExistingGeneration(dedupKey, resObj);
        if (resolveInflight) resolveInflight(resObj);
        res.json(resObj);

    } catch (err) {
        console.error("Facts Lab error:", err);
        if (resolveInflight) resolveInflight({ error: err.message });
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
        const handle = brand_context?.handle || (brand_context?.name ? `@${brand_context.name.toLowerCase().replace(/\s+/g, '')}` : '@ammaazzingg');

        if (!topic || !topic.trim()) {
            return res.status(400).json({ error: "Topic is required for Psychology Lab generation." });
        }

        const dedupKey = getDedupKey(req, topic);
        const existing = await getExistingGeneration(dedupKey);
        if (existing) return res.json(existing);

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

        const generatePrompt = `You are LabEngine-v1, an elite psychology content intelligence system for social media.

CONTENT STRUCTURE RULES — MANDATORY 8 TO 9 SLIDE DECK:
You MUST generate 8 to 9 slides. Each slide MUST focus on ONE topic only. Never pack multiple solutions onto one slide. Never use psychological jargon without explaining it in simple terms with a real-life example.

DECK FRAMEWORK:
- SLIDE 1 [HOOK_COVER]: Conversational, curiosity-driving hook title (10-20 words). A relatable real-world question or scenario. NOT a 3-word title. E.g.: "Why you feel like everyone is judging your new outfit the second you walk into a room"

- SLIDE 2 [BODY_VAL - RECOGNITION]: Make the reader feel SEEN. "You know that feeling when..." Describe the exact internal experience. Pure human recognition, no science or solutions yet.

- SLIDE 3 [BODY_VAL - THE SCIENCE]: Explain WHY the brain does this. Describe the evolutionary or neurobiological mechanism in simple, friendly terms. End with the theory/phenomenon name in brackets. E.g. "...Your brain inflates how much others notice you. This is called the Spotlight Effect [Gilovich & Savitsky, 1999]."

- SLIDE 4 [BODY_VAL - THE UNSPOKEN COST]: Emotional stakes. What does living with this unexamined pattern cost you? (Anxiety, self-censorship, avoiding opportunities, overthinking).

- SLIDE 5 [BODY_VAL - DECODING THE THEORY]: If any technical psychology terms, mechanisms, or theories were mentioned (or are central to the fix, e.g. "Decentering", "Cognitive Restructuring", "Default Mode Network", "Negativity Bias"), EXPLAIN WHAT IT MEANS IN PLAIN ENGLISH. What is it, why does it happen, and how does it manifest? Make the audience feel smart without being confused.

- SLIDE 6 [BODY_VAL - SOLUTION #1: THE MENTAL REFRAME]: Solution 1 gets its OWN dedicated slide.
  * Title: Name of Solution 1 (e.g. "Shift #1: The Spotlight Reality Check")
  * What it is: Clear explanation of the reframe.
  * Real-World Scenario Example: Give an exact "When X happens, say/think Y" example.

- SLIDE 7 [BODY_VAL - SOLUTION #2: THE IMMEDIATE ACTION]: Solution 2 gets its OWN dedicated slide.
  * Title: Name of Solution 2 (e.g. "Shift #2: The 10-Second Physical Decenter")
  * How to do it: Concrete physical or mental action step.
  * Real-World Scenario Example: Give an exact scenario of applying it in the moment.

- SLIDE 8 [BODY_VAL - SOLUTION #3: THE LONG-TERM HABIT]: Solution 3 gets its OWN dedicated slide.
  * Title: Name of Solution 3 (e.g. "Shift #3: The 48-Hour Evidence Log")
  * How to do it: Daily or weekly micro-habit.
  * Real-World Scenario Example: Give an exact scenario of how to build this habit.

- SLIDE 9 [CTA_FINAL]: Warm, relatable, human closing. Summarize the core takeaway in 1 sentence. Include a comment question OR a save prompt. (is_cta: true).

LANGUAGE RULES:
- Write like a smart, warm friend explaining human behavior over coffee.
- Short sentences. Maximum 2 per paragraph.
- NEVER use jargon like "decentering", "cognitive bias", or "reframing" without defining what it means in plain English and giving a concrete example.
- NO fluff words: "delve", "tapestry", "nuanced", "moreover", "in conclusion", "pivotal", "crucial".

Topic: "${topic}"
Target Metric: ${targetMetric}
Brand Handle: ${handle}
${brandCtx}

Audience: Ages 18-35. Self-aware, curious, ambitious. They save content that gives them practical tools for their mind.

OUTPUT FORMAT: Valid JSON only. No markdown formatting wrappers.

{
  "generation_metadata": { "topic": "${topic}", "content_type": "${contentType}", "target_metric": "${targetMetric}" },
  "carousel": {
    "enabled": ${contentType === 'CAROUSEL' ? 'true' : 'false'},
    "slides": [
      {
        "slide_number": 1,
        "type": "HOOK_COVER",
        "header_text": "${handle}",
        "title_text": "A 10-20 word conversational hook asking a relatable question or describing a real-world moment.",
        "subtitle_text": "One sentence deepening the curiosity.",
        "design_notes": "Dark background, high contrast text"
      },
      {
        "slide_number": 2,
        "type": "BODY_VAL",
        "header_text": "01 / YOU'VE FELT THIS",
        "title_text": "Short label (3-5 words)",
        "body_text": "3-4 sentences starting with 'You know that feeling when...' Describe the exact experience. Pure recognition.",
        "highlight_words": ["key emotional words"]
      },
      {
        "slide_number": 3,
        "type": "BODY_VAL",
        "header_text": "02 / THE SCIENCE",
        "title_text": "Why your brain does this",
        "body_text": "3-4 sentences explaining the brain mechanism in simple language. End with theory name in brackets.",
        "highlight_words": ["theory name"]
      },
      {
        "slide_number": 4,
        "type": "BODY_VAL",
        "header_text": "03 / THE REAL COST",
        "title_text": "What this costs you",
        "body_text": "3-4 sentences showing the emotional and practical cost of staying stuck in this pattern.",
        "highlight_words": ["cost words"]
      },
      {
        "slide_number": 5,
        "type": "BODY_VAL",
        "header_text": "04 / DECODING THE THEORY",
        "title_text": "What [Term] actually means",
        "body_text": "Explain the psychological term or mechanism in simple everyday words. Define it clearly so anyone understands it, and give a brief example.",
        "highlight_words": ["defined term"]
      },
      {
        "slide_number": 6,
        "type": "BODY_VAL",
        "header_text": "05 / SOLUTION #1",
        "title_text": "Shift #1: [Name of Mental Reframe]",
        "body_text": "Explain Solution #1 in detail. What it is, step-by-step how to do it, plus a real-world scenario example (e.g. 'When X happens, do Y'). Minimum 60 words.",
        "highlight_words": ["solution name", "action step"]
      },
      {
        "slide_number": 7,
        "type": "BODY_VAL",
        "header_text": "06 / SOLUTION #2",
        "title_text": "Shift #2: [Name of Immediate Action]",
        "body_text": "Explain Solution #2 in detail. What it is, step-by-step how to do it, plus a real-world scenario example. Minimum 60 words.",
        "highlight_words": ["solution name", "action step"]
      },
      {
        "slide_number": 8,
        "type": "BODY_VAL",
        "header_text": "07 / SOLUTION #3",
        "title_text": "Shift #3: [Name of Long-Term Habit]",
        "body_text": "Explain Solution #3 in detail. What it is, step-by-step how to do it, plus a real-world scenario example. Minimum 60 words.",
        "highlight_words": ["solution name", "habit step"]
      },
      {
        "slide_number": 9,
        "type": "CTA_FINAL",
        "header_text": "${handle}",
        "title_text": "A warm, human closing line",
        "body_text": "1-2 sentences. Single core takeaway + save prompt or question. E.g.: 'Your brain isn't broken — it just needs a new script. Save this for next time you catch yourself overthinking.'",
        "is_cta": true
      }
    ]
  },
  "single_slide": {
    "enabled": ${contentType === 'SINGLE_SLIDE' ? 'true' : 'false'},
    "quote_text": "One insight explaining the pattern and the fix in under 20 words.",
    "attribution": "${handle}"
  },
  "reel_blueprint": {
    "enabled": ${contentType === 'REEL_BLUEPRINT' ? 'true' : 'false'},
    "hook_text": "First 2 seconds — relatable recognition hook",
    "body_text": "3-7s — science + solution #1",
    "audio_prompt": "Calm voiceover",
    "background_video_prompt": "Matching B-roll",
    "audio_script": "[0:00-0:02] Hook... [0:02-0:10] Science + Solution... [0:10-0:18] CTA...",
    "video_script": "Scene 1: Hook... Scene 2: Science... Scene 3: Solution & CTA...",
    "full_script_markdown": "# REEL SCRIPT\\n\\n## HOOK: ...\\n## SCIENCE: ...\\n## FIX: ...\\n## CTA: ..."
  },
  "caption": {
    "hook": "Opening line creating instant recognition.",
    "body": "2-3 sentences explaining the science (with theory name).\\n\\n💡 3 ways to reframe it:\\n1. [Solution 1 from slide 6]\\n2. [Solution 2 from slide 7]\\n3. [Solution 3 from slide 8]",
    "cta": "Save this post to come back to when you need a mental reset.",
    "hashtags": ["#psychologyfacts", "#humanbehavior", "#mindsetshift", "#selfmastery", "#brainfacts", "#mentalhealth"]
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

        // Normalize psych output into the standard {slides, caption} format
        let normalizedSlides = [];
        if (parsed.carousel && parsed.carousel.slides) {
            let rawSlides = parsed.carousel.slides;

            // If AI returned fewer than 8 slides, auto-expand combined body/solution slides into individual slides
            if (rawSlides.length < 8 && rawSlides.length >= 2) {
                console.log(`[Psychology Lab] AI returned ${rawSlides.length} slides. Expanding into full 8-9 slide deck...`);
                let expanded = [];
                const hookSlide = rawSlides[0];
                const ctaSlide = rawSlides[rawSlides.length - 1];
                const middleSlides = rawSlides.slice(1, rawSlides.length - 1);

                expanded.push(hookSlide);

                // Add Recognition, Science, Cost, Definition, Solution 1, Solution 2, Solution 3
                let bodyPool = [];
                middleSlides.forEach(s => {
                    const text = (s.body_text || s.content || s.subtitle_text || '');
                    // Split double-paragraph or combined solution text
                    const parts = text.split(/\n\n|\n(?=[0-9]\.|Shift|Step|Solution)/i).filter(p => p.trim().length > 10);
                    if (parts.length > 1) {
                        parts.forEach((pt, pIdx) => {
                            bodyPool.push({
                                type: s.type || 'BODY_VAL',
                                header_text: s.header_text || `0${expanded.length + 1} / INSIGHT`,
                                title_text: pIdx === 0 ? (s.title_text || s.title) : `Key Practical Action #${pIdx + 1}`,
                                body_text: pt.trim()
                            });
                        });
                    } else {
                        bodyPool.push(s);
                    }
                });

                // Ensure we have at least 6 body slides before CTA
                while (bodyPool.length < 6) {
                    const last = bodyPool[bodyPool.length - 1] || hookSlide;
                    bodyPool.push({
                        type: 'BODY_VAL',
                        header_text: `0${bodyPool.length + 1} / STRATEGY`,
                        title_text: `Practical Reframe & Action Plan`,
                        body_text: `Apply this daily: When you feel this psychological trigger, take 3 slow breaths, name the cognitive pattern without judgment, and re-center on your current task.`
                    });
                }

                bodyPool.slice(0, 7).forEach(s => expanded.push(s));
                expanded.push(ctaSlide);
                rawSlides = expanded;
            }

            normalizedSlides = rawSlides.map((s, idx) => {
                let bodyContent = s.body_text || s.content || '';
                if (idx === 0 && !bodyContent && s.subtitle_text) {
                    bodyContent = s.subtitle_text;
                } else if (s.subtitle_text && bodyContent && !bodyContent.includes(s.subtitle_text)) {
                    bodyContent = `${s.subtitle_text}\n\n${bodyContent}`;
                }
                return {
                    title: s.title_text || s.title || `Slide ${idx + 1}`,
                    content: bodyContent,
                    header: s.header_text || handle,
                    image_prompt: s.design_notes || '',
                    is_cta: s.is_cta || s.type === 'CTA_FINAL' || false
                };
            });
        } else if (parsed.single_slide && parsed.single_slide.enabled) {
            normalizedSlides = [{
                title: parsed.single_slide.quote_text || 'Psychology Insight',
                content: '',
                header: parsed.single_slide.attribution || handle,
                is_cta: false
            }];
        }

        const normalizedCaption = parsed.caption || {};
        const normalizedPost = {
            slides: normalizedSlides,
            caption: {
                hook: normalizedCaption.hook || '',
                body: normalizedCaption.body || '',
                cta: normalizedCaption.cta || '',
                hashtags: {
                    niche: Array.isArray(normalizedCaption.hashtags) ? normalizedCaption.hashtags : (normalizedCaption.hashtags?.niche || []),
                    broad: normalizedCaption.hashtags?.broad || [],
                    high_intent: normalizedCaption.hashtags?.high_intent || []
                }
            }
        };

        let insertedPost = null;
        try {
            const { data: insertData, error: insertError } = await supabase
                .from('posts')
                .insert([{
                    topic: `[Psychology Lab] ${topic.substring(0, 60)}`,
                    text: JSON.stringify(normalizedPost),
                    status: 'Draft',
                    brand_id: cleanBrandId
                }])
                .select();
            if (insertData && insertData[0]) {
                postId = insertData[0].id;
                insertedPost = insertData[0];
                // Patch the returned post's text with the frontend-normalized format
                insertedPost.text = JSON.stringify(normalizedPost);
            }
            if (insertError) console.error("Supabase insert error:", insertError.message);
        } catch (e) { console.error("Insert exception:", e.message); }

        const resObj = {
            success: true,
            mode: "GENERATE",
            data: parsed,
            post_id: postId,
            post: insertedPost
        };
        setExistingGeneration(dedupKey, resObj);
        res.json(resObj);
    } catch (err) {
        console.error("Psychology Lab error:", err);
        res.status(500).json({ error: "Internal server error: " + err.message });
    }
});

// ============================================================
// POST /generate-mcq — MCQ Video Lab Generator Endpoint
// ============================================================
app.post('/generate-mcq', async (req, res) => {
    try {
        const { topic, question_count, difficulty, language, brand_id, brand_context } = req.body;
        const mcqTopic = topic || "Loksewa General Knowledge & Geography of Nepal";
        const count = parseInt(question_count) || 3;
        const level = difficulty || "Medium";
        const targetLanguage = language || "Nepali";
        const brandCtx = getBrandContextBlock(brand_context);

        const dedupKey = getDedupKey(req, `mcq_${mcqTopic}_${count}_${level}_${targetLanguage}`);
        const existing = await getExistingGeneration(dedupKey);
        if (existing) return res.json(existing);

        let resolveInflight;
        const inflightPromise = new Promise(resolve => { resolveInflight = resolve; });
        setExistingGeneration(dedupKey, null, inflightPromise);

        console.log(`[/generate-mcq] "${mcqTopic}", ${count} questions, Level: ${level}, Lang: ${targetLanguage}`);

        const prompt = `You are an expert educational content engine for Loksewa and Competitive Exams.${brandCtx}

Create a set of ${count} high-converting Multiple Choice Questions (MCQ) for video reels.
Topic: "${mcqTopic}"
Difficulty Level: ${level}
Language: ${targetLanguage}

CRITICAL RULES:
- Generate EXACTLY ${count} questions.
- Each question MUST have EXACTLY 4 options (labeled A., B., C., D.).
- The question must be crisp, highly engaging, and clear for video formats (10-30 words).
- Specify the 0-based index of the correct option (0 for A, 1 for B, 2 for C, 3 for D).
- Provide a rich, highly detailed, fascinating, and educational explanation for the correct answer (40-80 words) including key historical context or background facts.
- All text MUST be written in ${targetLanguage}.

OUTPUT FORMAT: Valid JSON only. No markdown wrappers.

{
  "topic": "${mcqTopic}",
  "language": "${targetLanguage}",
  "questions": [
    {
      "id": 1,
      "question": "Question text here?",
      "options": [
        "A. Option 1",
        "B. Option 2",
        "C. Option 3",
        "D. Option 4"
      ],
      "correct_index": 1,
      "correct_option": "B. Option 2",
      "explanation": "Rich detailed explanation of why this answer is correct, with background facts and key learning takeaway."
    }
  ]
}`;

        const aiRes = await generateAIContent(prompt, { jsonMode: true });
        let rawText = aiRes.response.text();
        rawText = cleanJsonString(rawText);
        // Additional sanitization for control characters and unicode issues
        rawText = rawText.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
        // Remove any BOM or zero-width chars
        rawText = rawText.replace(/[\uFEFF\u200B-\u200D\u2060]/g, '');

        let parsed;
        try {
            parsed = JSON.parse(rawText);
        } catch (pe) {
            console.error("JSON parse error in /generate-mcq:", pe.message, "Raw:", rawText.substring(0, 200));
            try {
                // Attempt JSON repair
                const sanitized = rawText
                    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
                    .replace(/,\s*}/g, '}')
                    .replace(/,\s*\]/g, ']');
                parsed = JSON.parse(sanitized);
            } catch(e2) {
                console.error("JSON repair failed, building safe fallback object:", e2.message);
                parsed = {
                    topic: mcqTopic,
                    language: targetLanguage,
                    questions: [
                        {
                            id: 1,
                            question: `[${mcqTopic}] ${targetLanguage === 'Nepali' ? 'नेपाल लोकसेवा परीक्षासम्बन्धी महत्वपूर्ण प्रश्न' : 'Important Loksewa Exam Question'}`,
                            options: [
                                "A. " + (targetLanguage === 'Nepali' ? "विकल्प १" : "Option 1"),
                                "B. " + (targetLanguage === 'Nepali' ? "विकल्प २" : "Option 2"),
                                "C. " + (targetLanguage === 'Nepali' ? "विकल्प ३" : "Option 3"),
                                "D. " + (targetLanguage === 'Nepali' ? "विकल्प ४" : "Option 4")
                            ],
                            correct_index: 0,
                            correct_option: "A. " + (targetLanguage === 'Nepali' ? "विकल्प १" : "Option 1"),
                            explanation: targetLanguage === 'Nepali' ? "यस प्रश्नको विस्तृत व्याख्या यहाँ प्रस्तुत गरिएको छ।" : "Detailed explanation for this answer is presented here."
                        }
                    ]
                };
            }
        }

        const cleanBrandId = sanitizeBrandId(brand_id);
        let postId = null;
        let insertedPost = null;

        try {
            const { data: insertData, error: insertError } = await supabase
                .from('posts')
                .insert([{
                    topic: `[MCQ Video] ${mcqTopic.substring(0, 50)}`,
                    text: JSON.stringify(parsed),
                    status: 'Draft',
                    brand_id: cleanBrandId
                }])
                .select();

            if (insertData && insertData[0]) {
                postId = insertData[0].id;
                insertedPost = insertData[0];
            }
            if (insertError) console.error("Supabase insert error for MCQ:", insertError.message);
        } catch (e) { console.error("Insert exception in MCQ:", e.message); }

        const resObj = {
            success: true,
            mcq_data: parsed,
            post_id: postId,
            post: insertedPost
        };

        if (resolveInflight) resolveInflight(resObj);
        setExistingGeneration(dedupKey, resObj);
        res.json(resObj);

    } catch (err) {
        console.error("MCQ Lab error:", err);
        res.status(500).json({ error: "Internal server error: " + err.message });
    }
});

function pcmToWav(pcmBuffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
    const header = Buffer.alloc(44);
    const dataSize = pcmBuffer.length;
    const blockAlign = numChannels * bitsPerSample / 8;
    const byteRate = sampleRate * blockAlign;

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmBuffer]);
}

// ============================================================
// POST /generate-tts — Gemini AI Native Text-to-Speech Endpoint
// ============================================================
app.post('/generate-tts', async (req, res) => {
    try {
        const { text, language } = req.body;
        if (!text) return res.status(400).json({ error: "Text is required for TTS synthesis" });

        const lang = language || 'Nepali';
        const langCodeMap = {
            'Nepali': 'ne',
            'English': 'en',
            'Hindi': 'hi'
        };
        const targetLangCode = langCodeMap[lang] || 'ne';

        // Use existing Gemini API Key!
        const geminiApiKey = process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY || process.env.GOOGLE_TTS_API_KEY;

        if (geminiApiKey) {
            try {
                const ttsModel = 'gemini-2.5-flash-preview-tts';
                const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent?key=${geminiApiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: `Read this text aloud naturally with clear pronunciation and warm intonation: ${text.substring(0, 500)}` }]
                        }],
                        generationConfig: {
                            responseModalities: ['AUDIO'],
                            speechConfig: {
                                voiceConfig: {
                                    prebuiltVoiceConfig: {
                                        voiceName: 'Kore'
                                    }
                                }
                            }
                        }
                    })
                });

                const gData = await gRes.json();
                if (gRes.ok && gData.candidates && gData.candidates[0]?.content?.parts) {
                    const audioPart = gData.candidates[0].content.parts.find(p => p.inlineData && p.inlineData.data);
                    if (audioPart) {
                        const pcmBuf = Buffer.from(audioPart.inlineData.data, 'base64');
                        const wavBuf = pcmToWav(pcmBuf, 24000);
                        const wavBase64 = wavBuf.toString('base64');
                        console.log(`[/generate-tts] Successfully synthesized Gemini AI voice (${lang}, ${wavBuf.length} bytes)`);
                        return res.json({
                            success: true,
                            audio_url: `data:audio/wav;base64,${wavBase64}`,
                            provider: 'gemini_ai_tts'
                        });
                    }
                } else {
                    console.warn("Gemini API TTS response warning:", JSON.stringify(gData).substring(0, 180));
                }
            } catch (ge) {
                console.warn("Gemini Native TTS failed, falling back:", ge.message);
            }
        }

        // Fallback: Natural Voice Engine Stream URL
        const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.substring(0, 300))}&tl=${targetLangCode}&client=tw-ob`;
        res.json({
            success: true,
            audio_url: fallbackUrl,
            provider: 'google_voice_stream'
        });

    } catch (err) {
        console.error("TTS endpoint error:", err);
        res.status(500).json({ error: "TTS generation failed: " + err.message });
    }
});

app.listen(port, () => {
    console.log(`Creator's Den Backend v2.0 running on port ${port}`);
});

