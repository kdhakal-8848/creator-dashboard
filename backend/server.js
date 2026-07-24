import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import Parser from 'rss-parser';

global.WebSocket = WebSocket;

dotenv.config();

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
function buildImageUrl(imagePrompt) {
    const enhancedPrompt = `${imagePrompt}, stunning high resolution photography, cinematic lighting, 8k, ultra-detailed`;
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}`;
}

/**
 * Build an array of per-slide image URLs from parsed slide data.
 * Last slide (CTA) gets null.
 */
function buildImageUrls(slides) {
    return slides.map((slide, i) => {
        const isCTA = slide.is_cta === true || i === slides.length - 1;
        if (isCTA) return null;
        const prompt = slide.image_prompt || `${slide.title} vivid photography`;
        return buildImageUrl(prompt);
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
    const { topic, contentType, promptTemplate, brand_id, brand_context } = req.body;

    if (!topic || !contentType) {
        return res.status(400).json({ error: "Missing topic or contentType" });
    }

    const brandCtx = getBrandContextBlock(brand_context);

    try {
        console.log(`[/generate] [${contentType}] topic: "${topic}"`);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        let prompt;

        if (promptTemplate) {
            // User's custom prompt — respect it but append brand context and structured format note
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
- Slide 1: HIGH-CONTRAST HOOK — title creates a curiosity gap (e.g., "How Nepal's Rivers Shape Its Economy"). Content is the most compelling single takeaway. image_prompt: dramatic wide-angle visual related to topic.
- Slides 2-N-1: ONE idea per slide, max 40 words body, scannable bullet-style. Include a unique image_prompt for each.
- FINAL SLIDE: CTA only. Set "is_cta": true. Title: "Save This for Your Exam! 📌". Content: "Read the caption for the full breakdown ↓\\n\\nFollow ${brand_context?.handle || '@CreatorsDen'} for daily Loksewa prep." NO image_prompt on this slide.

Return ONLY valid JSON, no markdown. Use this exact schema:
${SLIDE_SCHEMA}`;
        }

        const result = await model.generateContent(prompt);
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
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `You are an expert Loksewa content creator. Rewrite the following carousel content based on user feedback.${brandCtx}

Topic: "${topic}"
Current Content: ${currentText}
User Feedback: "${note}"

Incorporate the feedback precisely. Return ONLY valid JSON matching this schema (no markdown):
${SLIDE_SCHEMA}`;

        const result = await model.generateContent(prompt);
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
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        let prompt = `You are an expert AI Video Prompt Engineer. Convert the following research into video generation prompts for Sora or Runway.\n\nResearch:\n${originalResearch}\n\n`;
        if (format === 'single') {
            prompt += `Create one single, continuous, highly detailed prompt (visuals, lighting, motion, style).`;
        } else {
            prompt += `Create exactly ${splits || 4} separate scene prompts. Label them "Scene 1:", "Scene 2:", etc. For each: exact visuals, lighting, camera movement.`;
        }

        const result = await model.generateContent(prompt);
        res.json({ prompts: result.response.text() });
    } catch (err) {
        console.error("Video generation error:", err);
        res.status(500).json({ error: "Failed to generate video prompts" });
    }
});

// ============================================================
// POST /generate-news — News Lab
// ============================================================
const rssParser = new Parser();

app.post('/generate-news', async (req, res) => {
    const { brand_id, language, contentType, brand_context } = req.body;
    const targetLanguage = language || "English";
    const templateStyle = contentType || "Standard News Summary";
    const brandCtx = getBrandContextBlock(brand_context);

    try {
        console.log(`[/generate-news] style: "${templateStyle}", lang: ${targetLanguage}`);

        // Try multiple RSS feeds in order of preference
        const RSS_FEEDS = [
            'https://feeds.bbci.co.uk/news/world/rss.xml',
            'https://www.theguardian.com/world/rss',
            'https://rss.nytimes.com/services/xml/rss/nyt/World.xml'
        ];

        let feed = null;
        let feedError = null;
        for (const feedUrl of RSS_FEEDS) {
            try {
                feed = await rssParser.parseURL(feedUrl);
                if (feed.items && feed.items.length > 0) break;
            } catch (e) {
                feedError = e;
                console.warn(`RSS ${feedUrl} failed:`, e.message);
            }
        }

        if (!feed || !feed.items || feed.items.length === 0) {
            return res.status(500).json({ error: "No news found: " + (feedError?.message || 'unknown') });
        }

        const newsItem = feed.items[Math.floor(Math.random() * Math.min(10, feed.items.length))];
        const newsTitle = newsItem.title;
        const newsLink = newsItem.link;
        const newsContent = newsItem.contentSnippet || newsItem.content || '';

        console.log(`Selected news: "${newsTitle}"`);

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const handle = brand_context?.handle || '@CreatorsDen';

        const prompt = `You are an expert social media content creator.${brandCtx}

Create an engaging carousel post about this international news story.
Style: "${templateStyle}"
Title: ${newsTitle}
Summary: ${newsContent}
Source URL: ${newsLink}

CAROUSEL NARRATIVE FRAMEWORK (STRICT):
- Slide 1: HOOK — shocking or intriguing angle on this story. image_prompt: photojournalistic scene related to story.
- Slides 2-3: KEY FACTS — one key fact or angle per slide, max 40 words. Unique image_prompt per slide.
- Slide 4 (FINAL CTA): Set "is_cta": true. Title: "What Do You Think? 🤔". Content: "Read caption for full story + source link ↓\\n\\nFollow ${handle} for daily world news." NO image_prompt.

Write all slide text in ${targetLanguage}. The source URL MUST appear in the caption CTA.

Return ONLY valid JSON (no markdown):
${SLIDE_SCHEMA}`;

        const result = await model.generateContent(prompt);
        let text = result.response.text().trim().replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            console.error("Gemini invalid JSON for /generate-news:", text.substring(0, 300));
            return res.status(500).json({ error: "AI returned invalid JSON" });
        }

        // Append source to caption CTA if not already there
        if (parsed.caption && parsed.caption.cta && !parsed.caption.cta.includes(newsLink)) {
            parsed.caption.cta += `\n\nSource: ${newsLink}`;
        }

        const imageUrls = buildImageUrls(parsed.slides);
        const cleanBrandId = sanitizeBrandId(brand_id);

        const { data, error } = await supabase
            .from('posts')
            .insert([{
                topic: `[News Lab] ${newsTitle.substring(0, 60)}`,
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

        console.log("Saved News Lab post:", data[0].id);
        res.json({ success: true, post: data[0] });

    } catch (err) {
        console.error("News Lab error:", err);
        res.status(500).json({ error: "Internal server error: " + err.message });
    }
});

// ============================================================
// POST /generate-facts — Facts Lab
// ============================================================
app.post('/generate-facts', async (req, res) => {
    const { topic, language, slide_count, brand_id, brand_context } = req.body;
    const targetLanguage = language || "English";
    const count = parseInt(slide_count) || 5;
    const factTopic = topic || "Sharks are older than trees";
    const brandCtx = getBrandContextBlock(brand_context);
    const handle = brand_context?.handle || '@CreatorsDen';

    try {
        console.log(`[/generate-facts] "${factTopic}", ${count} slides, ${targetLanguage}`);

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `You are an expert Instagram facts content creator.${brandCtx}

Create a viral, high-converting Instagram facts carousel.
Topic: "${factTopic}"
Total Slides: ${count}
Language: ${targetLanguage}

MANDATORY SLIDE STRUCTURE:
- Slide 1 (HOOK): Title MUST be "Did You Know? 🤯" (or localized equivalent). Content: the single most SHOCKING fact (max 15 words). image_prompt: dramatic wide-angle visual that makes the fact tangible.
- Slides 2 to ${count - 1} (FACTS): ONE mind-blowing fact per slide. Max 35 words body. Bold key numbers/stats. Each must have a unique, specific image_prompt.
- Slide ${count} (CTA — MANDATORY): Set "is_cta": true. Title: "Follow for Daily Facts! 🔥". Content: "Read caption for the full breakdown ↓\\n\\nFollow ${handle} for a new mind-blowing fact every day." DO NOT include image_prompt for this slide.

TYPOGRAPHY & COPY RULES:
- Headlines: 80pt+ impact — short, punchy, high contrast
- Body: max 35 words, scannable. Use line breaks for rhythm.
- Numbers and stats should be bolded in text (use ** for emphasis markers)

ALL text (titles, content, caption) MUST be written in ${targetLanguage}.

Return ONLY valid JSON (no markdown):
${SLIDE_SCHEMA}`;

        const result = await model.generateContent(prompt);
        let text = result.response.text().trim().replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            console.error("Gemini invalid JSON for /generate-facts:", text.substring(0, 300));
            return res.status(500).json({ error: "AI returned invalid JSON" });
        }

        // Enforce CTA on last slide regardless of AI compliance
        if (parsed.slides && parsed.slides.length > 0) {
            const lastSlide = parsed.slides[parsed.slides.length - 1];
            lastSlide.is_cta = true;
            delete lastSlide.image_prompt;
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

app.listen(port, () => {
    console.log(`Creator's Den Backend v2.0 running on port ${port}`);
});
