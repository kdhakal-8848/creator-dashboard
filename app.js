import { CONFIG } from './config.js';
var psychCanvas = null;
var currentPsychSlides = [];
var currentPsychSlideIndex = 0;
var psychCurrentMode = 'GENERATE';
var psychLabListenersBound = false;
var isGeneratingPsych = false;

var CANVAS_W = 1080;
var CANVAS_H = 1350;
var PREVIEW_W = 400;
var PREVIEW_H = 500;
var CANVAS_ZOOM = PREVIEW_W / CANVAS_W;

var CURRENT_ASPECT_RATIO = '4:5';

function setCanvasAspectRatio(ratio) {
    CURRENT_ASPECT_RATIO = ratio || '4:5';
    if (CURRENT_ASPECT_RATIO === '1:1') {
        CANVAS_H = 1080;
    } else if (CURRENT_ASPECT_RATIO === '9:16') {
        CANVAS_H = 1920;
    } else {
        CANVAS_H = 1350; // 4:5
    }
    PREVIEW_H = Math.round(PREVIEW_W * (CANVAS_H / CANVAS_W));
    CANVAS_ZOOM = PREVIEW_W / CANVAS_W;

    if (fabricCanvas) {
        fabricCanvas.setDimensions({ width: PREVIEW_W, height: PREVIEW_H });
        fabricCanvas.setZoom(CANVAS_ZOOM);
    }
    if (freeformCanvas) {
        freeformCanvas.setDimensions({ width: PREVIEW_W, height: PREVIEW_H });
        freeformCanvas.setZoom(CANVAS_ZOOM);
    }

    const aspectSel = document.getElementById('canvas-aspect-selector');
    if (aspectSel && aspectSel.value !== CURRENT_ASPECT_RATIO) {
        aspectSel.value = CURRENT_ASPECT_RATIO;
    }
}
window.setCanvasAspectRatio = setCanvasAspectRatio;

var fabricCanvas = null;
var studioCanvas = null;
var freeformCanvas = null;
var currentEditingId = null;
var currentSlides = [];
var currentSlideIndex = 0;
var currentImageUrls = [];
var canvasHistory = [];
var canvasHistoryPointer = -1;

let slideRenderVersion = 0;
let isRenderingSlide = false;







const DEFAULT_PROMPT_TEMPLATE = `You are an expert Loksewa (Public Service Commission Nepal) content creator.
Generate content based on the following parameters:
Topic: \${topic}
Content Type: \${contentType}

Format the output strictly as a JSON object with the following schema:
{
  "slides": [
    {
      "title": "Short title for the slide",
      "content": "Content for the slide",
      "image_prompt": "Visual description for this slide's background (omit for CTA slide)",
      "is_cta": false
    }
  ],
  "caption": {
    "hook": "Scroll-stopping first line",
    "body": "Value-packed summary (2-4 sentences)",
    "cta": "Primary call to action",
    "hashtags": {
      "niche": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
      "broad": ["#tag1", "#tag2", "#tag3"],
      "high_intent": ["#tag1", "#tag2", "#tag3"]
    }
  }
}
Do NOT include markdown formatting. Return ONLY valid JSON.`;

let currentPromptTemplate = localStorage.getItem('loksewa_prompt_template') || DEFAULT_PROMPT_TEMPLATE;

// ============================================================
// MOCK DATA
// ============================================================
let defaultMockPosts = [
    { id: '1', topic: 'Geography of Nepal', text: JSON.stringify({ slides: [{ title: "Geography of Nepal", content: "Nepal is a landlocked country in South Asia.", image_prompt: "Himalayan mountain range Nepal aerial photography" }, { title: "Himalayas", content: "Home to 8 of the 10 highest peaks in the world.", image_prompt: "Mount Everest summit clouds dramatic photography" }, { title: "Follow for More! 🔥", content: "Read caption for full breakdown ↓\n\nFollow @LoksewaPro for daily prep.", is_cta: true }], caption: { hook: "Nepal sits on top of the world — literally. 🏔️", body: "8 of the 10 highest peaks on Earth are in Nepal, including Everest.", cta: "Follow for daily Loksewa prep tips!", hashtags: { niche: ["#Loksewa", "#LoksewaTayari", "#PSCNepal"], broad: ["#Nepal", "#Himalayas"], high_intent: ["#LoKsewaPreperation", "#CivilService"] } } }), image_url: JSON.stringify(["https://image.pollinations.ai/prompt/Himalayan%20mountains", "https://image.pollinations.ai/prompt/Mount%20Everest", null]), status: 'Draft', updated_at: new Date().toISOString() },
    { id: '2', topic: 'Constitution of Nepal', text: JSON.stringify({ slides: [{ title: "Constitution of Nepal", content: "Promulgated on 20 September 2015.", image_prompt: "Nepal constitution document official photography" }, { title: "Follow for More! 🔥", content: "Follow @LoksewaPro for daily prep.", is_cta: true }], caption: { hook: "Nepal's constitution is one of the most comprehensive in South Asia.", body: "Promulgated in 2015, it established Nepal as a federal democratic republic.", cta: "Follow for more constitutional law breakdowns!", hashtags: { niche: ["#Loksewa", "#ConstitutionNepal"], broad: ["#Nepal", "#Law"], high_intent: ["#LoksewaExam"] } } }), image_url: JSON.stringify(["https://image.pollinations.ai/prompt/Nepal%20constitution", null]), status: 'Approved', updated_at: new Date().toISOString() },
];

let mockPosts = JSON.parse(localStorage.getItem('loksewa_mock_posts')) || defaultMockPosts;
function saveMockPosts() { if (isMockMode) localStorage.setItem('loksewa_mock_posts', JSON.stringify(mockPosts)); }

// ============================================================
// BRANDING STATE — Expanded Model with Narrative/Tone/ICP
// ============================================================
let allBrands = [
    {
        id: "bfd851c5-2eb8-458f-af70-9c549896a5f8",
        name: "AMMAAZZINGG",
        handle: "@ammaazzingg",
        logoUrl: "assets/images/logo.png",
        headerAssetUrl: "",
        facebookUrl: "https://facebook.com",
        instagramUrl: "https://instagram.com",
        tiktokUrl: "https://tiktok.com",
        linkedinUrl: "https://linkedin.com",
        primaryColor: "#003366",
        secondaryColor: "#cc0000",
        accentColor: "#f59e0b",
        bgColor: "#0f0c29",
        headingFont: "Inter",
        bodyFont: "Inter",
        narrative: "Creating fascinating facts, news breakdowns, and viral daily carousels.",
        toneOfVoice: "Engaging & Authoritative",
        icp: "General Knowledge & Social Media Enthusiasts",
        customTitleSize: "100",
        customTitleY: "50",
        customContentY: "70",
        customBgOpacity: "85",
        customBgColor: "#000000",
        themePreset: "theme-default",
        showPagination: true
    },
    {
        id: "default-brand",
        name: "CREATOR'S DEN",
        handle: "@ammaazzingg",
        logoUrl: "assets/images/logo.png",
        headerAssetUrl: "",
        facebookUrl: "https://business.facebook.com",
        instagramUrl: "https://instagram.com",
        tiktokUrl: "https://tiktok.com",
        linkedinUrl: "https://linkedin.com",
        primaryColor: "#1e3c72",
        secondaryColor: "#2a5298",
        accentColor: "#f59e0b",
        bgColor: "#0f0c29",
        headingFont: "Inter",
        bodyFont: "Inter",
        narrative: "",
        toneOfVoice: "Educational & Authoritative",
        icp: "",
        customTitleSize: "100",
        customTitleY: "50",
        customContentY: "70",
        customBgOpacity: "85",
        customBgColor: "#000000",
        themePreset: "theme-default",
        showPagination: true
    }
];
let activeBrandId = allBrands[0].id;
let currentBranding = allBrands[0];


const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5680'
    : (CONFIG.N8N_MANUAL_WEBHOOK_URL ? CONFIG.N8N_MANUAL_WEBHOOK_URL.replace(/\/generate$/, '') : 'https://loksewa-backend-ah2s.onrender.com');

const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;

let supabase = null;
let isMockMode = false;
let isGuest = false;
let currentUser = null;
window.isGuest = false;

function getSupabaseClient() {
    if (supabase) return supabase;
    const createClientFn = window.supabase?.createClient || window.createClient;
    if (createClientFn && SUPABASE_URL && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
        try {
            supabase = createClientFn(SUPABASE_URL, SUPABASE_ANON_KEY);
            return supabase;
        } catch (e) {
            console.error("Supabase client init error:", e);
        }
    }
    return null;
}

// Initial session check
const initialClient = getSupabaseClient();
if (initialClient) {
    try {
        initialClient.auth.getSession().then(({ data, error }) => {
            if (error && error.message && error.message.includes('Invalid API key')) {
                console.warn("Invalid Supabase API key detected!");
                return;
            }
            if (data && data.session) {
                handleAuthChange(data.session);
            }
        }).catch(e => {
            console.warn("getSession error:", e);
        });

        initialClient.auth.onAuthStateChange((_event, session) => {
            if (session) {
                handleAuthChange(session);
            }
        });
    } catch (e) {
        console.warn("AuthStateChange error:", e);
    }
}

function handleAuthChange(session) {
    if (session) {
        currentUser = session.user;
        window.currentUser = currentUser;
        isMockMode = false;
        isGuest = false;
        window.isGuest = false;

        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';

        let nameParam = "AD";
        if (currentUser && currentUser.email) {
            const emailParts = currentUser.email.split('@')[0];
            nameParam = emailParts.substring(0, 2).toUpperCase();
            if (currentUser.user_metadata && currentUser.user_metadata.display_name) {
                nameParam = currentUser.user_metadata.display_name.substring(0, 2).toUpperCase();
            }
        }
        document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${nameParam}&background=random`;

        if (supabase) {
            supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
                if (data && (data.currentLevel === 'aal2' || data.nextLevel === 'aal2')) {
                    const mfaText = document.getElementById('mfa-status-text');
                    const mfaBtn = document.getElementById('enroll-mfa-btn');
                    if (mfaText) { mfaText.innerText = 'Enabled'; mfaText.style.color = 'var(--color-success-fg)'; }
                    if (mfaBtn) mfaBtn.style.display = 'none';
                }
            }).catch(() => {});
        }

        fetchBrands();
        loadDashboardStats();
    } else if (!isGuest && !isMockMode) {
        currentUser = null;
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }
}

// --- Auth UI Helpers ---
function showLoginError(msg) {
    const fb = document.getElementById('login-feedback');
    if (!fb) return;
    fb.innerHTML = msg;
    fb.style.cssText = 'color:#f87171;background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.4);padding:10px 14px;border-radius:8px;font-size:14px;margin-top:8px;display:block;';
}
function showLoginSuccess(msg) {
    const fb = document.getElementById('login-feedback');
    if (!fb) return;
    fb.innerHTML = msg;
    fb.style.cssText = 'color:#34d399;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.4);padding:10px 14px;border-radius:8px;font-size:14px;margin-top:8px;display:block;';
}
function setLoginLoading(on) {
    const btn = document.getElementById('login-btn');
    const fb = document.getElementById('login-feedback');
    if (btn) btn.disabled = on;
    if (on && fb) {
        fb.innerHTML = '⏳ Signing in...';
        fb.style.cssText = 'color:rgba(255,255,255,0.6);background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);padding:10px 14px;border-radius:8px;font-size:14px;margin-top:8px;display:block;';
    } else if (!on && fb && fb.innerHTML === '⏳ Signing in...') {
        fb.innerHTML = '';
        fb.style.display = 'none';
    }
}

// --- Auth UI ---
let isSigningIn = false;

async function handleLoginAction(e) {
    if (e) e.preventDefault();
    if (isSigningIn) return;
    isSigningIn = true;

    const emailEl = document.getElementById('login-email');
    const passEl = document.getElementById('login-password');
    const email = emailEl ? emailEl.value.trim() : '';
    const password = passEl ? passEl.value : '';

    if (!email || !password) {
        showLoginError('Please enter your email and password.');
        isSigningIn = false;
        return;
    }

    setLoginLoading(true);

    const client = getSupabaseClient();
    if (!client) {
        showLoginError('Authentication service failed to initialize. Please refresh.');
        setLoginLoading(false);
        isSigningIn = false;
        return;
    }

    try {
        isMockMode = false;
        isGuest = false;
        window.isGuest = false;

        const { data, error } = await client.auth.signInWithPassword({ email, password });

        if (error) {
            console.error("Supabase Auth Error:", error.message);
            showLoginError(error.message || 'Invalid email or password.');
            return;
        }

        if (data && data.session) {
            showLoginSuccess('✅ Signed in! Loading dashboard...');
            setTimeout(() => {
                handleAuthChange(data.session);
            }, 100);
            return;
        } else {
            showLoginError('Sign in failed: No active session returned.');
        }

    } catch (err) {
        console.error("Sign-in exception:", err);
        showLoginError('Sign in error: ' + (err.message || err));
    } finally {
        setLoginLoading(false);
        isSigningIn = false;
    }
}

// Guest Mode Handler
function handleGuestLogin(e) {
    if (e) e.preventDefault();
    window.isGuest = true;
    isGuest = true;
    isMockMode = true;
    showLoginSuccess('⚡ Access Granted (Demo Mode)');
    setTimeout(() => {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        fetchBrands();
        loadDashboardStats();
    }, 100);
}

window.handleLoginAction = handleLoginAction;
window.handleGuestLogin = handleGuestLogin;

// Failproof Auth Listener Initialization
function setupAuthListeners() {
    document.getElementById('login-btn')?.addEventListener('click', handleLoginAction);
    document.getElementById('signin-form')?.addEventListener('submit', handleLoginAction);
    document.getElementById('guest-btn')?.addEventListener('click', handleGuestLogin);
    document.getElementById('guest-login-btn')?.addEventListener('click', handleGuestLogin);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupAuthListeners();
        initPsychLab();
        initDesignStudio();
    });
} else {
    setupAuthListeners();
    initPsychLab();
    initDesignStudio();
}

// Global Event Delegation so sign-in click NEVER fails
document.addEventListener('click', (e) => {
    const target = e.target;
    if (!target) return;
    if (target.id === 'guest-login-btn' || target.id === 'guest-btn' || target.closest('#guest-login-btn') || target.closest('#guest-btn')) {
        handleGuestLogin(e);
    }
});

// Sign Out Handler
document.getElementById('sign-out-btn')?.addEventListener('click', async () => {
    isGuest = false;
    if (!isMockMode && supabase) {
        await supabase.auth.signOut();
    }
    handleAuthChange(null);
});

// Password Reset
const forgotLink = document.getElementById('forgot-password-link');
const backToSigninBtn = document.getElementById('back-to-signin-btn');
const sendResetBtn = document.getElementById('send-reset-btn');
if (forgotLink) forgotLink.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('signin-card').style.display = 'none'; document.getElementById('reset-password-card').style.display = 'block'; });
if (backToSigninBtn) backToSigninBtn.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('reset-password-card').style.display = 'none'; document.getElementById('signin-card').style.display = 'block'; });
if (sendResetBtn) sendResetBtn.addEventListener('click', async () => {
    const email = document.getElementById('reset-email').value.trim();
    const fb = document.getElementById('reset-feedback');
    if (!email) { fb.innerText = "Please enter your email."; fb.style.color = "var(--color-danger-fg)"; return; }
    fb.innerText = "Sending reset link..."; fb.style.color = "var(--color-fg-muted)";
    if (isMockMode) { setTimeout(() => { fb.innerText = "Mock Mode: Email sent!"; fb.style.color = "var(--color-success-fg)"; }, 600); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
    if (error) { fb.innerText = error.message; fb.style.color = "var(--color-danger-fg)"; }
    else { fb.innerText = "Reset link sent! Check your inbox."; fb.style.color = "var(--color-success-fg)"; }
});

document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (isMockMode) {
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
        ['login-email', 'login-password'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('login-feedback').innerText = '';
    } else {
        await supabase.auth.signOut();
    }
});

// ============================================================
// PROMPT TEMPLATES
// ============================================================
function getBrandContext(brand = currentBranding) {
    return {
        name: brand.name,
        handle: brand.handle,
        narrative: brand.narrative || '',
        toneOfVoice: brand.toneOfVoice || '',
        icp: brand.icp || ''
    };
}

async function fetchBrands() {
    if (!isMockMode) {
        const { data, error } = await supabase.from('brands').select('*').order('created_at', { ascending: true });
        if (!error && data && data.length > 0) {
            allBrands = data.map(dbBrand => ({
                id: dbBrand.id,
                name: dbBrand.name,
                handle: dbBrand.handle,
                primaryColor: dbBrand.primary_color,
                secondaryColor: dbBrand.secondary_color,
                accentColor: dbBrand.template_settings?.accentColor || '#f59e0b',
                bgColor: dbBrand.template_settings?.bgColor || '#0f0c29',
                headingFont: dbBrand.template_settings?.headingFont || 'Inter',
                bodyFont: dbBrand.template_settings?.bodyFont || 'Inter',
                narrative: dbBrand.template_settings?.narrative || '',
                toneOfVoice: dbBrand.template_settings?.toneOfVoice || 'Educational & Authoritative',
                icp: dbBrand.template_settings?.icp || '',
                logoUrl: dbBrand.logo_url,
                headerAssetUrl: dbBrand.header_asset_url || dbBrand.template_settings?.headerAssetUrl || '',
                facebookUrl: dbBrand.social_links?.facebookUrl || '',
                instagramUrl: dbBrand.social_links?.instagramUrl || '',
                tiktokUrl: dbBrand.social_links?.tiktokUrl || '',
                linkedinUrl: dbBrand.social_links?.linkedinUrl || '',
                customTitleSize: dbBrand.template_settings?.customTitleSize || '100',
                customTitleY: dbBrand.template_settings?.customTitleY || '50',
                customContentY: dbBrand.template_settings?.customContentY || '70',
                customBgOpacity: dbBrand.template_settings?.customBgOpacity || '85',
                customBgColor: dbBrand.template_settings?.customBgColor || '#000000',
                themePreset: dbBrand.template_settings?.themePreset || 'theme-default',
                showPagination: dbBrand.template_settings?.showPagination !== false
            }));
            if (!allBrands.find(b => b.id === activeBrandId)) activeBrandId = allBrands[0].id;
            currentBranding = allBrands.find(b => b.id === activeBrandId) || allBrands[0];
        }
    }
    populateBrandSelectors();
    updateBrandVisuals(currentBranding);
    loadSavedTemplatesSelector();
}

function populateBrandSelectors() {
    const selectors = ['brand-selector', 'manual-brand', 'queue-brand-filter', 'news-brand', 'facts-brand', 'psych-brand-select', 'canvas-brand-selector', 'mcq-brand'];
    selectors.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const currentVal = sel.value;
        sel.innerHTML = '';
        if (id === 'queue-brand-filter') {
            const opt = document.createElement('option'); opt.value = 'All'; opt.innerText = 'All Brands'; sel.appendChild(opt);
        }
        allBrands.forEach(b => {
            const opt = document.createElement('option'); opt.value = b.id; opt.innerText = b.name; sel.appendChild(opt);
        });
        if (['brand-selector', 'manual-brand', 'news-brand', 'facts-brand', 'psych-brand-select', 'canvas-brand-selector', 'mcq-brand'].includes(id)) {
            sel.value = activeBrandId || (allBrands[0] ? allBrands[0].id : '');
        } else if (currentVal) {
            sel.value = currentVal;
        }

        if (!sel.dataset.boundBrandChange) {
            sel.dataset.boundBrandChange = 'true';
            sel.addEventListener('change', (e) => {
                const selectedId = e.target.value;
                if (id === 'queue-brand-filter') return;
                activeBrandId = selectedId;
                const found = allBrands.find(b => b.id === selectedId);
                if (found) {
                    currentBranding = found;
                    updateBrandVisuals(currentBranding);
                    selectors.forEach(otherId => {
                        if (otherId !== id && otherId !== 'queue-brand-filter') {
                            const otherSel = document.getElementById(otherId);
                            if (otherSel) otherSel.value = selectedId;
                        }
                    });
                    if (typeof updateSlidePreview === 'function' && document.getElementById('editor-view')?.classList.contains('active-view')) {
                        updateSlidePreview();
                    }
                }
            });
        }
    });
}

function updateBrandVisuals(brand = currentBranding) {
    if (!brand) return;
    if (brand.primaryColor) document.documentElement.style.setProperty('--brand-primary', brand.primaryColor);
    if (brand.secondaryColor) document.documentElement.style.setProperty('--brand-secondary', brand.secondaryColor);
}

// ============================================================
// NAVIGATION
// ============================================================
function switchView(targetViewId, linkElement = null) {
    const navLinks = document.querySelectorAll('.nav-links a');
    const views = document.querySelectorAll('.view');
    navLinks.forEach(l => l.classList.remove('active'));
    views.forEach(v => v.classList.remove('active-view'));

    const matchingLink = linkElement || document.querySelector(`.nav-links a[data-target="${targetViewId}"]`);
    if (matchingLink) {
        matchingLink.classList.add('active');
        const h1 = document.querySelector('.topbar h1');
        if (h1) h1.textContent = matchingLink.textContent.trim();
    }

    const targetView = document.getElementById(targetViewId);
    if (targetView) targetView.classList.add('active-view');

    if (targetViewId === 'home-view') loadDashboardStats();
    if (targetViewId === 'queue-view') loadQueue();
    if (targetViewId === 'video-view') loadVideoQueue();
    if (targetViewId === 'settings-view') loadSettings();
    if (targetViewId === 'branding-view') loadBrandingView();
    if (targetViewId === 'canvas-view') initDesignStudio();
    if (targetViewId === 'psych-view') initPsychLab();
    if (targetViewId === 'mcq-video-view') {
        try { initMCQVideoStudio(); } catch (err) { console.error("initMCQVideoStudio error:", err); }
    }
    if (targetViewId === 'video-brief-view') {
        try { initVideoBriefStudio(); } catch (err) { console.error("initVideoBriefStudio error:", err); }
    }

    syncTemplateDropdowns();
}

window.switchView = switchView;

document.addEventListener('click', (e) => {
    const link = e.target.closest('.nav-links a[data-target]');
    if (link) {
        e.preventDefault();
        const targetViewId = link.getAttribute('data-target');
        switchView(targetViewId, link);
    }
});
        
        // Save As New Template
        function setupCanvasTemplateListeners() {
    if (window.canvasTemplateListenersAttached) return;
    window.canvasTemplateListenersAttached = true;
    document.getElementById('canvas-save-new-template')?.addEventListener('click', () => {
            const customTemplates = JSON.parse(localStorage.getItem('loksewa_custom_templates') || '[]');
            const name = prompt("Enter a name for your new template:", "Custom Template " + (customTemplates.length + 1));
            if (!name || !name.trim()) return;

            const templateId = 'custom_tmpl_' + Date.now();
            const templateNames = JSON.parse(localStorage.getItem('loksewa_template_names') || '{}');
            const overrides = JSON.parse(localStorage.getItem('loksewa_template_overrides') || '{}');

            const tmplOverrides = { extraObjects: [] };
            freeformCanvas.getObjects().forEach(obj => {
                if (obj.customType && !obj.isExtraOverride) {
                    tmplOverrides[obj.customType] = {
                        left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY,
                        width: obj.width, height: obj.height, fill: obj.fill, fontSize: obj.fontSize,
                        opacity: obj.opacity, angle: obj.angle
                    };
                } else if (obj.isExtraOverride) {
                    tmplOverrides.extraObjects.push(obj.toObject(['isExtraOverride', 'customType']));
                }
            });

            const basePreset = document.getElementById('canvas-base-template')?.value || 'template-classic';
            customTemplates.push({ id: templateId, name: name.trim(), basePreset });
            templateNames[templateId] = name.trim();
            overrides[templateId] = tmplOverrides;

            localStorage.setItem('loksewa_custom_templates', JSON.stringify(customTemplates));
            localStorage.setItem('loksewa_template_names', JSON.stringify(templateNames));
            localStorage.setItem('loksewa_template_overrides', JSON.stringify(overrides));

            syncTemplateDropdowns();
            document.getElementById('canvas-base-template').value = templateId;
            showToast(`Template "${name.trim()}" saved!`);
        });

        // Rename Template
        document.getElementById('canvas-rename-template')?.addEventListener('click', () => {
            const selectEl = document.getElementById('canvas-base-template');
            const templateId = selectEl?.value;
            if (!templateId) {
                alert("Please select a template to rename.");
                return;
            }

            const templateNames = JSON.parse(localStorage.getItem('loksewa_template_names') || '{}');
            const defaultObj = DEFAULT_PRESETS.find(p => p.id === templateId);
            const currentName = templateNames[templateId] || (defaultObj ? defaultObj.defaultName : templateId);

            const newName = prompt("Rename template:", currentName);
            if (!newName || !newName.trim() || newName.trim() === currentName) return;

            templateNames[templateId] = newName.trim();
            localStorage.setItem('loksewa_template_names', JSON.stringify(templateNames));

            const customTemplates = JSON.parse(localStorage.getItem('loksewa_custom_templates') || '[]');
            const ct = customTemplates.find(t => t.id === templateId);
            if (ct) {
                ct.name = newName.trim();
                localStorage.setItem('loksewa_custom_templates', JSON.stringify(customTemplates));
            }

            syncTemplateDropdowns();
            selectEl.value = templateId;
            showToast(`Renamed template to "${newName.trim()}"`);
        });

        // Delete Template / Reset Overrides
        document.getElementById('canvas-delete-template')?.addEventListener('click', () => {
            const selectEl = document.getElementById('canvas-base-template');
            const templateId = selectEl?.value;
            if (!templateId) {
                alert("Please select a template to delete.");
                return;
            }

            const customTemplates = JSON.parse(localStorage.getItem('loksewa_custom_templates') || '[]');
            const templateNames = JSON.parse(localStorage.getItem('loksewa_template_names') || '{}');
            const overrides = JSON.parse(localStorage.getItem('loksewa_template_overrides') || '{}');
            const defaultObj = DEFAULT_PRESETS.find(p => p.id === templateId);
            const currentName = templateNames[templateId] || (defaultObj ? defaultObj.defaultName : templateId);

            const isCustom = customTemplates.some(t => t.id === templateId);

            if (isCustom) {
                if (confirm(`Are you sure you want to delete custom template "${currentName}" permanently?`)) {
                    const updatedCustom = customTemplates.filter(t => t.id !== templateId);
                    delete templateNames[templateId];
                    delete overrides[templateId];

                    localStorage.setItem('loksewa_custom_templates', JSON.stringify(updatedCustom));
                    localStorage.setItem('loksewa_template_names', JSON.stringify(templateNames));
                    localStorage.setItem('loksewa_template_overrides', JSON.stringify(overrides));

                    syncTemplateDropdowns();
                    selectEl.value = 'template-classic';
                    selectEl.dispatchEvent(new Event('change'));
                    showToast(`Deleted template "${currentName}"`);
                }
            } else {
                if (confirm(`Reset custom overrides for built-in template "${currentName}" back to factory defaults?`)) {
                    delete overrides[templateId];
                    delete templateNames[templateId];
                    localStorage.setItem('loksewa_template_overrides', JSON.stringify(overrides));
                    localStorage.setItem('loksewa_template_names', JSON.stringify(templateNames));

                    syncTemplateDropdowns();
                    selectEl.value = templateId;
                    selectEl.dispatchEvent(new Event('change'));
                    showToast(`Reset overrides for "${currentName}"`);
                }
            }
        });

        loadCanvasBrandOptions();
        if (window.feather) feather.replace();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupCanvasTemplateListeners);
} else {
    setupCanvasTemplateListeners();
}

// ============================================================
// DATA HELPERS
// ============================================================
async function getPosts() {
    if (window.isMockMode || isMockMode) return mockPosts;
    const { data, error } = await supabase.from('posts').select('*').order('updated_at', { ascending: false });
    if (error) {
        console.error("DB error:", error.message);
        return mockPosts;
    }
    return data;
}
window.getPosts = getPosts;

function formatDate(isoString) { return new Date(isoString).toLocaleString(); }

// Parse image_url — handles both old (string) and new (JSON array) formats
function parseImageUrls(image_url) {
    if (!image_url) return [];
    try {
        const parsed = JSON.parse(image_url);
        if (Array.isArray(parsed)) return parsed;
        return [image_url]; // old format: single URL
    } catch {
        return [image_url]; // old format: single URL string
    }
}

// Parse the post text — handles both old (plain text) and new (structured JSON) formats
function parsePostText(text) {
    try {
        let parsed = typeof text === 'string' ? JSON.parse(text) : text;
        if (!parsed) return { slides: [], caption: '' };

        let slides = [];
        if (Array.isArray(parsed.slides) && parsed.slides.length > 0) {
            slides = parsed.slides;
        } else if (parsed.carousel && Array.isArray(parsed.carousel.slides)) {
            slides = parsed.carousel.slides.map((s, idx) => ({
                title: s.title_text || s.title || `Slide ${idx + 1}`,
                content: s.body_text || s.content || '',
                header: s.header_text || (currentBranding?.handle || '@ammaazzingg'),
                is_cta: s.is_cta || s.type === 'CTA_FINAL' || false
            }));
        } else if (parsed.single_slide && (parsed.single_slide.quote_text || parsed.single_slide.title)) {
            slides = [{
                title: parsed.single_slide.quote_text || parsed.single_slide.title || 'Psychology Insight',
                content: parsed.single_slide.content || '',
                header: parsed.single_slide.attribution || (currentBranding?.handle || '@ammaazzingg'),
                is_cta: false
            }];
        } else if (parsed.data && parsed.data.carousel && Array.isArray(parsed.data.carousel.slides)) {
            slides = parsed.data.carousel.slides.map((s, idx) => ({
                title: s.title_text || s.title || `Slide ${idx + 1}`,
                content: s.body_text || s.content || '',
                header: s.header_text || (currentBranding?.handle || '@ammaazzingg'),
                is_cta: s.is_cta || s.type === 'CTA_FINAL' || false
            }));
        }

        const normalizedSlides = slides.map((s, idx) => ({
            title: s.title || s.title_text || `Slide ${idx + 1}`,
            content: s.content || s.body_text || '',
            header: s.header || s.header_text || (currentBranding?.handle || '@ammaazzingg'),
            is_cta: s.is_cta || false,
            ...s
        }));

        return {
            slides: normalizedSlides,
            caption: parsed.caption || (parsed.data && parsed.data.caption) || '',
            brand_snapshot: parsed.brand_snapshot || null,
            brand_id: parsed.brand_id || null
        };
    } catch {
        return { slides: [{ title: "Content", content: String(text) }], caption: text };
    }
}

// ============================================================
// 1. DASHBOARD
// ============================================================
async function loadDashboardStats() {
    const posts = await getPosts();
    document.getElementById('stat-drafts').innerText = posts.filter(p => p.status === 'Draft').length;
    document.getElementById('stat-approved').innerText = posts.filter(p => p.status === 'Approved').length;
    document.getElementById('stat-published').innerText = posts.filter(p => p.status === 'Published').length;
    document.getElementById('stat-failed').innerText = posts.filter(p => p.status === 'Failed').length;
    const tbody = document.getElementById('recent-activity-table');
    tbody.innerHTML = '';
    posts.slice(0, 5).forEach(post => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${post.topic}</strong></td>
            <td><span class="status-badge status-${post.status}">${post.status}</span></td>
            <td>${formatDate(post.updated_at)}</td>
            <td>
                <button class="btn-secondary" onclick="window.openEditor('${post.id}')" style="padding:4px 10px;font-size:12px;">Edit</button>
                <button class="btn-secondary" onclick="window.deletePost('${post.id}')" style="padding:4px 8px;font-size:12px;color:var(--color-danger-fg);"><i data-feather="trash-2" style="width:12px;height:12px;"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    if (window.feather) feather.replace();
}

// ============================================================
// 2. QUEUE VIEW
// ============================================================
async function loadQueue() {
    const posts = await getPosts();
    const grid = document.getElementById('queue-grid');
    if (!grid) return;
    const statusFilter = document.getElementById('status-filter')?.value || 'All';
    const brandFilter = document.getElementById('queue-brand-filter')?.value || 'All';
    grid.innerHTML = '';
    let filtered = posts;
    if (statusFilter !== 'All') filtered = filtered.filter(p => p.status === statusFilter);
    if (brandFilter !== 'All') filtered = filtered.filter(p => p.brand_id === brandFilter || (!p.brand_id && brandFilter === 'All'));
    filtered.forEach(post => {
        const imageUrls = parseImageUrls(post.image_url);
        const firstImage = imageUrls[0] || 'https://via.placeholder.com/400x500?text=No+Image';
        const postBrand = allBrands.find(b => b.id === post.brand_id);
        const bName = postBrand ? postBrand.name : "Creator's Den";
        let titlePreview = post.topic;
        const card = document.createElement('div');
        card.className = 'content-card';
        card.innerHTML = `
            <div class="content-card-img" style="background-image:url('${firstImage}'); cursor:pointer;" onclick="window.openEditor('${post.id}')"></div>
            <div class="content-card-body">
                <div class="content-card-title">${post.topic} <span style="background:#eaeef2;color:#656d76;font-size:11px;padding:2px 6px;border-radius:10px;font-weight:500;">${bName}</span></div>
                <div class="content-card-meta">
                    <select class="status-badge status-${post.status}" onchange="window.updatePostStatus('${post.id}', this.value)" style="border:none;cursor:pointer;font-weight:600;padding:3px 20px 3px 8px;appearance:auto;">
                        <option value="Draft" ${post.status==='Draft'?'selected':''}>Draft</option>
                        <option value="Approved" ${post.status==='Approved'?'selected':''}>Approved</option>
                        <option value="Queued" ${post.status==='Queued'?'selected':''}>Queued</option>
                        <option value="Published" ${post.status==='Published'?'selected':''}>Published</option>
                        <option value="Failed" ${post.status==='Failed'?'selected':''}>Failed</option>
                    </select>
                    <div style="display:flex;gap:4px;">
                        <button class="btn-primary" onclick="window.openEditor('${post.id}')" style="padding:5px 12px;font-size:13px;">Edit</button>
                        <button class="btn-secondary" onclick="window.deletePost('${post.id}')" style="padding:5px 8px;font-size:13px;color:var(--color-danger-fg);"><i data-feather="trash-2" style="width:13px;height:13px;"></i></button>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
    if (window.feather) feather.replace();
}

document.getElementById('status-filter')?.addEventListener('change', loadQueue);
document.getElementById('queue-brand-filter')?.addEventListener('change', loadQueue);

window.updatePostStatus = async (id, newStatus) => {
    if (isMockMode) {
        const i = mockPosts.findIndex(p => p.id === id);
        if (i > -1) { mockPosts[i].status = newStatus; saveMockPosts(); }
    } else {
        await supabase.from('posts').update({ status: newStatus }).eq('id', id);
    }
    loadQueue();
};

window.deletePost = async (id) => {
    if (!confirm('Delete this post?')) return;
    if (isMockMode) { mockPosts = mockPosts.filter(p => p.id !== id); saveMockPosts(); }
    else await supabase.from('posts').delete().eq('id', id);
    loadQueue();
    loadDashboardStats();
};

// ============================================================
// 3. FABRIC.JS CANVAS ENGINE
// ============================================================





// ============================================================
// TEXT SCALING & ASPECT RATIO PROTECTION (Prevent Elongation)
// ============================================================
function attachTextScalingProtection(canvas) {
    if (!canvas) return;

    const protectObject = (obj) => {
        if (!obj) return;
        if (obj.type === 'textbox' || obj.type === 'i-text') {
            obj.setControlVisible('mt', false);
            obj.setControlVisible('mb', false);
            if (obj.scaleX !== 1 || obj.scaleY !== 1) {
                const scale = Math.max(obj.scaleX || 1, obj.scaleY || 1);
                obj.set({
                    fontSize: Math.max(10, Math.round((obj.fontSize || 30) * scale)),
                    width: Math.max(50, (obj.width || 300) * (obj.scaleX || 1)),
                    scaleX: 1,
                    scaleY: 1
                });
                obj.setCoords();
            }
        }
    };

    canvas.getObjects().forEach(protectObject);
    canvas.on('object:added', (e) => protectObject(e.target));

    canvas.on('object:scaling', (e) => {
        const obj = e.target;
        if (obj && (obj.type === 'textbox' || obj.type === 'i-text')) {
            const corner = e.transform ? e.transform.corner : null;
            if (corner === 'ml' || corner === 'mr') {
                const newWidth = Math.max(50, obj.width * obj.scaleX);
                obj.set({
                    width: newWidth,
                    scaleX: 1,
                    scaleY: 1
                });
            } else {
                const scale = Math.max(obj.scaleX, obj.scaleY);
                const newFontSize = Math.max(10, Math.round((obj.fontSize || 30) * scale));
                const newWidth = Math.max(50, obj.width * scale);
                obj.set({
                    fontSize: newFontSize,
                    width: newWidth,
                    scaleX: 1,
                    scaleY: 1
                });
            }
            obj.setCoords();
            canvas.renderAll();
        }
    });

    canvas.on('object:modified', (e) => {
        const obj = e.target;
        if (obj && (obj.type === 'textbox' || obj.type === 'i-text')) {
            if (obj.scaleX !== 1 || obj.scaleY !== 1) {
                const scale = Math.max(obj.scaleX, obj.scaleY);
                obj.set({
                    fontSize: Math.max(10, Math.round((obj.fontSize || 30) * scale)),
                    width: Math.max(50, obj.width * scale),
                    scaleX: 1,
                    scaleY: 1
                });
                obj.setCoords();
                canvas.renderAll();
            }
        }
    });
}

function initFabricCanvas() {
    if (fabricCanvas) { fabricCanvas.dispose(); fabricCanvas = null; }
    const canvasEl = document.getElementById('slide-canvas');
    if (!canvasEl) return;

    fabricCanvas = new fabric.Canvas('slide-canvas', {
        width: PREVIEW_W,
        height: PREVIEW_H,
        selection: true,
        preserveObjectStacking: true,
        backgroundColor: '#1a1a2e'
    });
    window.fabricCanvas = fabricCanvas;
    attachTextScalingProtection(fabricCanvas);

    // Scale all coordinates: objects are placed in virtual 1080x1350 space
    fabricCanvas.setZoom(CANVAS_ZOOM);

    // Track history for undo/redo & sync canvas text to current slide state
    fabricCanvas.on('object:modified', () => { syncFabricCanvasToCurrentSlide(); saveCanvasHistory(); });
    fabricCanvas.on('object:added', () => saveCanvasHistory());
    fabricCanvas.on('object:removed', () => saveCanvasHistory());
    fabricCanvas.on('text:changed', () => syncFabricCanvasToCurrentSlide());

    // Update format panel on selection
    fabricCanvas.on('selection:created', onCanvasSelection);
    fabricCanvas.on('selection:updated', onCanvasSelection);
    fabricCanvas.on('selection:cleared', () => {});
    
    // Double click on placeholder/image triggers upload
    fabricCanvas.on('mouse:down', (e) => {
        if (e.target && (e.target.customType === 'image-placeholder-bg' || e.target.customType === 'single-image' || e.target.customType === 'background-image' || e.target.customType === 'facts-image')) {
            const now = new Date().getTime();
            if (e.target.lastClickTime && now - e.target.lastClickTime < 400) {
                document.getElementById('image-upload')?.click();
            }
            e.target.lastClickTime = now;
        }
    });

    // Native Drag and Drop for images
    const canvasContainer = document.getElementById('slide-canvas')?.parentElement;
    if (canvasContainer) {
        canvasContainer.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
        canvasContainer.addEventListener('drop', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        currentImageUrls[currentSlideIndex] = ev.target.result;
                        const editorImg = document.getElementById('editor-image');
                        if (editorImg) editorImg.src = ev.target.result;
                        updateSlidePreview();
                    };
                    reader.readAsDataURL(file);
                }
            }
        });
    }
}


// ============================================================
// TEMPLATE MANAGEMENT SYSTEM (Save As New, Rename, Delete & Sync)
// ============================================================
const DEFAULT_PRESETS = [
    { id: 'template-classic', defaultName: 'Classic Template' },
    { id: 'tpl_news_editorial', defaultName: '📰 Loksewa News Editorial' },
    { id: 'tpl_gamified_quiz', defaultName: '🎯 Loksewa Gamified Quiz' },
    { id: 'tpl_curiosity_hook', defaultName: '🧠 Psychology Curiosity Hook' },
    { id: 'tpl_editorial_quote', defaultName: '🏛️ Political Literacy Quote' },
    { id: 'tpl_structured_list', defaultName: '📊 Structured Infographic List' },
    { id: 'template-psych-dark', defaultName: 'Psychology Dark Mode' },
    { id: 'template-psych-quote', defaultName: 'Psychology Insight Quote' },
    { id: 'template-bold', defaultName: 'Bold Typography' },
    { id: 'template-glass', defaultName: 'Glassmorphism' },
    { id: 'template-visual', defaultName: 'Visual Centric' },
    { id: 'template-minimal', defaultName: 'Dark Minimal' },
    { id: 'template-bright-minimal', defaultName: 'Bright Minimal' },
    { id: 'template-blue-border', defaultName: 'Blue Border' },
    { id: 'template-news-image', defaultName: 'News (Image)' },
    { id: 'template-news-text', defaultName: 'News (Text)' },
    { id: 'template-news-single-image', defaultName: 'News (Single Image)' },
    { id: 'template-facts-single', defaultName: 'Facts (Single Statement)' }
];

function saveCanvasLayoutOverrides(canvas, templateName) {
    if (!canvas) return;
    const overridesStr = localStorage.getItem('loksewa_template_overrides');
    const overrides = overridesStr ? JSON.parse(overridesStr) : {};

    const activePreset = templateName || document.getElementById('template-selector')?.value || document.getElementById('canvas-base-template')?.value || 'template-classic';
    const tmplOverrides = overrides[activePreset] || { extraObjects: [] };
    tmplOverrides.extraObjects = [];

    canvas.getObjects().forEach(obj => {
        const cType = obj.customType || (obj.isPlaceholder ? obj.isPlaceholder : null);
        if (cType && !obj.isExtraOverride) {
            tmplOverrides[cType] = {
                left: obj.left,
                top: obj.top,
                scaleX: obj.scaleX !== undefined ? obj.scaleX : 1,
                scaleY: obj.scaleY !== undefined ? obj.scaleY : 1,
                width: obj.width,
                height: obj.height,
                fill: obj.fill,
                fontSize: obj.fontSize,
                opacity: obj.opacity !== undefined ? obj.opacity : 1,
                angle: obj.angle || 0,
                rx: obj.rx,
                ry: obj.ry
            };

            if (cType === 'header-asset') {
                const hStyle = {
                    left: obj.left, top: obj.top,
                    scaleX: obj.scaleX !== undefined ? obj.scaleX : 1,
                    scaleY: obj.scaleY !== undefined ? obj.scaleY : 1,
                    width: obj.width, height: obj.height,
                    opacity: obj.opacity !== undefined ? obj.opacity : 1,
                    angle: obj.angle || 0
                };
                currentBranding.headerAssetStyle = hStyle;
                try { localStorage.setItem('loksewa_brand_identity', JSON.stringify(currentBranding)); } catch(e){}
                
                if (Array.isArray(allBrands)) {
                    const brandIdx = allBrands.findIndex(b => b.id === currentBranding.id);
                    if (brandIdx > -1) {
                        allBrands[brandIdx].headerAssetStyle = hStyle;
                        try { localStorage.setItem('loksewa_custom_brands', JSON.stringify(allBrands)); } catch(e){}
                    }
                }
            }
        } else if (obj.isExtraOverride || (!obj.isPlaceholder && !obj.customType)) {
            try {
                tmplOverrides.extraObjects.push(obj.toObject(['isExtraOverride', 'customType']));
            } catch(e){}
        }
    });

    overrides[activePreset] = tmplOverrides;
    if (activePreset !== 'template-custom') {
        overrides['template-custom'] = tmplOverrides;
    }
    try { localStorage.setItem('loksewa_template_overrides', JSON.stringify(overrides)); } catch(e){}
}

function syncTemplateDropdowns() {
    const customTemplates = JSON.parse(localStorage.getItem('loksewa_custom_templates') || '[]');
    const cdTemplates = JSON.parse(localStorage.getItem('cd_templates') || '[]');
    const customNames = JSON.parse(localStorage.getItem('loksewa_template_names') || '{}');

    cdTemplates.forEach(cdt => {
        if (cdt.name && !customTemplates.some(ct => ct.id === cdt.name || ct.name === cdt.name)) {
            customTemplates.push({ id: cdt.name, name: cdt.name });
        }
    });

    const selectors = [
        document.getElementById('canvas-base-template'),
        document.getElementById('template-selector')
    ];

    selectors.forEach(selectEl => {
        if (!selectEl) return;
        const currentVal = selectEl.value;
        selectEl.innerHTML = '';

        if (selectEl.id === 'canvas-base-template') {
            const blankOpt = document.createElement('option');
            blankOpt.value = '';
            blankOpt.textContent = 'None (Blank)';
            selectEl.appendChild(blankOpt);
        }

        const groupBuiltin = document.createElement('optgroup');
        groupBuiltin.label = 'Built-in Presets';
        DEFAULT_PRESETS.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = customNames[p.id] || p.defaultName;
            groupBuiltin.appendChild(opt);
        });
        selectEl.appendChild(groupBuiltin);

        if (customTemplates.length > 0) {
            const groupCustom = document.createElement('optgroup');
            groupCustom.label = 'Custom Saved Templates';
            customTemplates.forEach(ct => {
                const opt = document.createElement('option');
                opt.value = ct.id;
                opt.textContent = customNames[ct.id] || ct.name || ct.id;
                groupCustom.appendChild(opt);
            });
            selectEl.appendChild(groupCustom);
        }

        if (currentVal) selectEl.value = currentVal;
    });
}

function initDesignStudio() {
    if (freeformCanvas) { freeformCanvas.dispose(); freeformCanvas = null; }
    const canvasEl = document.getElementById('freeform-canvas');
    if (!canvasEl) return;

    freeformCanvas = new fabric.Canvas('freeform-canvas', {
        width: PREVIEW_W,
        height: PREVIEW_H,
        selection: true,
        preserveObjectStacking: true,
        backgroundColor: '#ffffff'
    });
    window.freeformCanvas = freeformCanvas;
    freeformCanvas.setZoom(CANVAS_ZOOM);
    attachTextScalingProtection(freeformCanvas);

    freeformCanvas.on('selection:created', onCanvasLabSelection);
    freeformCanvas.on('selection:updated', onCanvasLabSelection);
    freeformCanvas.on('selection:cleared', () => {
        const panel = document.getElementById('canvas-props-panel');
        const empty = document.getElementById('canvas-props-empty');
        if (panel && empty) { panel.style.display = 'none'; empty.style.display = 'block'; }
    });

    if (!window.__designStudioEventsAttached) {
        document.getElementById('canvas-base-template')?.addEventListener('change', (e) => {
            const baseTemplate = e.target.value;
            const brandId = document.getElementById('canvas-brand-selector')?.value;
            const brand = allBrands.find(b => b.id === brandId) || allBrands[0] || currentBranding;
            
            if (baseTemplate) {
                const realSelector = document.getElementById('template-selector');
                const oldVal = realSelector ? realSelector.value : null;
                if (realSelector) {
                    const opt = document.createElement('option');
                    opt.value = baseTemplate;
                    realSelector.appendChild(opt);
                    realSelector.value = baseTemplate;
                }
                
                const dummyData = {
                    title: "Your Catchy Headline Here",
                    content: "This is a placeholder for your body text. It will be replaced with real content during generation.",
                    is_cta: false
                };
                
                renderFabricSlide(dummyData, 0, null, brand, freeformCanvas).then(() => {
                    if (realSelector && oldVal !== null) realSelector.value = oldVal;
                });
            }
        });

        document.getElementById('canvas-save-overrides')?.addEventListener('click', () => {
            const baseTemplate = document.getElementById('canvas-base-template')?.value || document.getElementById('template-selector')?.value || 'template-classic';
            const activeC = freeformCanvas || studioCanvas || fabricCanvas;
            saveCanvasLayoutOverrides(activeC, baseTemplate);
            showToast('Layout overrides saved for ' + baseTemplate);
        });
        window.__designStudioEventsAttached = true;
    }

    loadCanvasBrandOptions();
    
    // Attach dragover and drop listeners to canvas wrapper for Drag & Drop
    const wrapper = document.querySelector('.studio-canvas-wrapper');
    if (wrapper && !wrapper.__dropBound) {
        wrapper.__dropBound = true;
        wrapper.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        wrapper.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!freeformCanvas) return;

            const rect = wrapper.getBoundingClientRect();
            const clientX = e.clientX - rect.left;
            const clientY = e.clientY - rect.top;
            const pointer = freeformCanvas.getPointer(e);
            const pointerX = pointer ? pointer.x : CANVAS_W / 2;
            const pointerY = pointer ? pointer.y : CANVAS_H / 2;

            // Handle dropped local files (Image Files)
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        fabric.Image.fromURL(evt.target.result, (img) => {
                            img.set({ left: pointerX, top: pointerY, originX: 'center', originY: 'center', isExtraOverride: true });
                            img.scaleToWidth(350);
                            freeformCanvas.add(img);
                            freeformCanvas.setActiveObject(img);
                        });
                    };
                    reader.readAsDataURL(file);
                    return;
                }
            }

            // Handle dropped palette items
            const elemType = e.dataTransfer.getData('text/plain');
            if (elemType) {
                addCanvasElement(elemType, pointerX, pointerY);
            }
        });
    }

    setTimeout(() => {
        const baseSelector = document.getElementById('canvas-base-template');
        if (baseSelector) {
            if (!baseSelector.value) baseSelector.value = 'template-classic';
            baseSelector.dispatchEvent(new Event('change'));
        }
    }, 50);
}

function syncFabricCanvasToCurrentSlide() {
    if (!fabricCanvas || !currentSlides[currentSlideIndex]) return;
    if (isRenderingSlide) return; // Prevent overwriting state with an incomplete render
    // Only sync if canvas has objects (avoid syncing after a clear)
    const objects = fabricCanvas.getObjects();
    if (objects.length === 0) return;

    if (!currentSlides[currentSlideIndex].objectStyles) {
        currentSlides[currentSlideIndex].objectStyles = {};
    }

    let updated = false;
    objects.forEach((obj, idx) => {
        const style = {
            left: obj.left, top: obj.top, width: obj.width, height: obj.height, fontSize: obj.fontSize,
            fill: obj.fill, scaleX: obj.scaleX !== undefined ? obj.scaleX : 1, scaleY: obj.scaleY !== undefined ? obj.scaleY : 1,
            angle: obj.angle || 0, originX: obj.originX || 'left', originY: obj.originY || 'top',
            fontWeight: obj.fontWeight, fontStyle: obj.fontStyle, textAlign: obj.textAlign,
            opacity: obj.opacity !== undefined ? obj.opacity : 1
        };

        const key = obj.customType || obj.isPlaceholder || obj.id || `obj_${idx}`;
        currentSlides[currentSlideIndex].objectStyles[key] = style;

        if (obj.isPlaceholder === 'title' || obj.customType === 'title') {
            if (obj.text !== undefined) currentSlides[currentSlideIndex].title = obj.text;
            currentSlides[currentSlideIndex].titleStyle = style;
            updated = true;
        } else if (obj.isPlaceholder === 'body' || obj.customType === 'body') {
            if (obj.text !== undefined) currentSlides[currentSlideIndex].content = obj.text;
            currentSlides[currentSlideIndex].bodyStyle = style;
            updated = true;
        } else if (obj.customType === 'header-asset') {
            currentSlides[currentSlideIndex].headerAssetStyle = style;
            updated = true;
        } else if (obj.customType === 'brand-logo') {
            currentSlides[currentSlideIndex].brandLogoStyle = style;
            updated = true;
        } else if (obj.customType === 'brand-handle') {
            currentSlides[currentSlideIndex].brandHandleStyle = style;
            updated = true;
        } else if (obj.customType === 'cta-label') {
            if (obj.text !== undefined) currentSlides[currentSlideIndex].ctaLabelText = obj.text;
            currentSlides[currentSlideIndex].ctaLabelStyle = style;
            updated = true;
        } else if (obj.customType === 'cta-btn-bg') {
            currentSlides[currentSlideIndex].ctaBtnBgStyle = style;
            updated = true;
        } else if (obj.customType === 'cta-btn-text') {
            if (obj.text !== undefined) currentSlides[currentSlideIndex].ctaBtnTextContent = obj.text;
            currentSlides[currentSlideIndex].ctaBtnTextStyle = style;
            updated = true;
        } else if (['facts-image', 'image-placeholder-bg', 'single-image', 'background-image'].includes(obj.customType)) {
            currentSlides[currentSlideIndex].imageStyle = style;
            updated = true;
        } else {
            updated = true;
        }
    });
    if (!updated) return;
    // Also update the form inputs if they exist
    const titleIn = document.getElementById(`slide-title-${currentSlideIndex}`);
    const contentIn = document.getElementById(`slide-content-${currentSlideIndex}`);
    if (titleIn) titleIn.value = currentSlides[currentSlideIndex].title || '';
    if (contentIn) contentIn.value = currentSlides[currentSlideIndex].content || '';
}
window.syncFabricCanvasToCurrentSlide = syncFabricCanvasToCurrentSlide;

function saveCanvasHistory() {
    if (!fabricCanvas) return;
    const json = JSON.stringify(fabricCanvas.toJSON(['isPlaceholder', 'customType']));
    canvasHistory = canvasHistory.slice(0, canvasHistoryPointer + 1);
    canvasHistory.push(json);
    if (canvasHistory.length > 30) canvasHistory.shift();
    canvasHistoryPointer = canvasHistory.length - 1;
}

function onCanvasSelection() {
    const obj = fabricCanvas.getActiveObject();
    if (!obj) return;
    const fontSizeInput = document.getElementById('fmt-font-size');
    const colorInput = document.getElementById('fmt-color');
    const fontColorInput = document.getElementById('editor-font-color');
    if (fontSizeInput && obj.fontSize) fontSizeInput.value = Math.round(obj.fontSize);
    if (colorInput && obj.fill) colorInput.value = fabricColorToHex(obj.fill);
    if (fontColorInput && obj.fill) fontColorInput.value = fabricColorToHex(obj.fill);
}

function fabricColorToHex(color) {
    if (!color || color === '') return '#ffffff';
    if (color.startsWith('#')) return color;
    try {
        const c = new fabric.Color(color);
        return '#' + c.toHex();
    } catch { return '#ffffff'; }
}

const BRAND_TOKENS = {
    loksewa: {
        id: 'loksewa',
        name: 'Loksewa Nepal',
        handle: '@loksewa_prep',
        logoUrl: 'assets/icons/icon-192.png',
        verified: true,
        headerStyle: 'pinned-bar',
        headerHeight: 96,
        bgPrimary: '#FFFFFF',
        bgSecondary: '#F1F5F9',
        headerBg: '#0F3D5C',
        headerText: '#FFFFFF',
        accentPrimary: '#0F3D5C',
        accentSecondary: '#E8A93C',
        textHeading: '#0B1B2B',
        textBody: '#1F2937',
        textCaption: '#64748B',
        fontHeading: 'Noto Sans Devanagari, Inter, sans-serif',
        fontBody: 'Noto Sans Devanagari, Inter, sans-serif',
        fontMono: 'Roboto Condensed, Noto Sans, sans-serif',
        radiusCard: 20,
        safeMargin: 60
    },
    political_literacy: {
        id: 'political_literacy',
        name: 'Political Literacy',
        handle: '@CIVIC_LITERACY_NP',
        logoUrl: 'assets/icons/icon-192.png',
        verified: true,
        headerStyle: 'inset-hairline',
        headerHeight: 72,
        bgPrimary: '#FAF9F6',
        bgSecondary: '#EFEDE7',
        headerBg: 'transparent',
        headerText: '#1A1A1A',
        accentPrimary: '#7A1F2B',
        accentSecondary: '#4A5A48',
        textHeading: '#111111',
        textBody: '#333333',
        textCaption: '#7A7A7A',
        fontHeading: 'Source Serif 4, Lora, Georgia, serif',
        fontBody: 'Source Sans 3, Inter, sans-serif',
        fontMono: 'Inter, sans-serif',
        radiusCard: 8,
        safeMargin: 60
    },
    psychology: {
        id: 'psychology',
        name: 'Psychology & Mind Facts',
        handle: '@AMAZINGFACTS.LAB',
        logoUrl: 'assets/icons/icon-192.png',
        verified: true,
        headerStyle: 'floating-pill',
        headerHeight: 56,
        bgPrimary: '#0B0E14',
        bgSecondary: 'rgba(21, 26, 36, 0.7)',
        headerBg: 'rgba(255, 255, 255, 0.08)',
        headerText: '#F5F5F7',
        accentPrimary: '#8B7FD6',
        accentSecondary: '#5FB3B3',
        accentGlow: '#C9BFFF',
        textHeading: '#FFFFFF',
        textBody: '#D6D9E0',
        textCaption: '#8B949E',
        fontHeading: 'Fraunces, Outfit, sans-serif',
        fontBody: 'Satoshi, Inter, sans-serif',
        fontMono: 'Inter, monospace',
        radiusCard: 28,
        safeMargin: 60
    },
    claude: {
        id: 'claude',
        name: 'Claude Template',
        handle: '@claude',
        logoUrl: 'assets/icons/icon-192.png',
        verified: true,
        headerStyle: 'inset-hairline',
        headerHeight: 72,
        bgPrimary: '#faf9f5',
        bgSecondary: '#e8e6dc',
        headerBg: 'transparent',
        headerText: '#141413',
        accentPrimary: '#d97757',
        accentSecondary: '#6a9bcc',
        textHeading: '#141413',
        textBody: '#141413',
        textCaption: '#b0aea5',
        fontHeading: 'Poppins, Arial, sans-serif',
        fontBody: 'Lora, Georgia, serif',
        fontMono: 'ui-monospace, SFMono-Regular, monospace',
        radiusCard: 16,
        safeMargin: 60
    }
};

// --- CORE RENDER FUNCTION: Render one slide to the Fabric canvas ---
async function renderFabricSlide(slideData, slideIndex, imageUrl, brand, targetCanvas = null) {
    slideRenderVersion++;
    const myRenderVersion = slideRenderVersion;
    isRenderingSlide = true;

    if (!targetCanvas) {
        if (!fabricCanvas) initFabricCanvas();
        targetCanvas = fabricCanvas;
    }
    if (!targetCanvas) {
        if (slideRenderVersion === myRenderVersion) isRenderingSlide = false;
        return;
    }

    targetCanvas.clear();

    const templateSelector = document.getElementById('template-selector');
    const selectedPreset = templateSelector?.value || brand?.themePreset || 'template-classic';

    const isCTA = slideData.is_cta === true || slideIndex === currentSlides.length - 1;
    const primaryColor = brand?.primaryColor || '#1e3c72';
    const secondaryColor = brand?.secondaryColor || '#2a5298';
    const accentColor = brand?.accentColor || '#f59e0b';
    const brandName = brand?.name || "Creator's Den";
    const handle = brand?.handle || '@ammaazzingg';
    const headingFont = brand?.headingFont || 'Inter';
    const bodyFont = brand?.bodyFont || 'Inter';

    let bgColor = primaryColor;
    if (selectedPreset === 'tpl_news_editorial') bgColor = BRAND_TOKENS.loksewa.bgPrimary;
    if (selectedPreset === 'tpl_gamified_quiz') bgColor = BRAND_TOKENS.loksewa.bgPrimary;
    if (selectedPreset === 'tpl_curiosity_hook') bgColor = BRAND_TOKENS.psychology.bgPrimary;
    if (selectedPreset === 'tpl_editorial_quote') bgColor = BRAND_TOKENS.political_literacy.bgPrimary;
    if (selectedPreset === 'tpl_structured_list') bgColor = BRAND_TOKENS.political_literacy.bgPrimary;
    if (selectedPreset === 'template-bold') bgColor = '#0d0d0d';
    if (selectedPreset === 'template-glass') bgColor = '#0a192f';
    if (selectedPreset === 'template-visual') bgColor = '#0f172a';
    if (selectedPreset === 'template-minimal') bgColor = '#121218';
    if (selectedPreset === 'template-bright-minimal') bgColor = '#f8f9fa';
    if (selectedPreset === 'template-blue-border') bgColor = '#f0f8ff';
    if (selectedPreset === 'template-news-image') bgColor = '#090d16';
    if (selectedPreset === 'template-news-text') bgColor = '#0b1120';
    if (selectedPreset === 'template-news-single-image') bgColor = '#0f172a';
    if (selectedPreset === 'template-facts-single') bgColor = '#f8f9fa';
    if (selectedPreset === 'template-custom' && brand?.customBgColor) bgColor = brand.customBgColor;

    // Override with explicit brand background color if set to something other than the default dark blue
    if (brand?.bgColor && brand.bgColor.toLowerCase() !== '#0f0c29' && selectedPreset !== 'template-custom') {
        bgColor = brand.bgColor;
    }

    targetCanvas.backgroundColor = bgColor;
    const bgPicker = document.getElementById('editor-bg-color');
    if (bgPicker && bgColor) bgPicker.value = fabricColorToHex(bgColor);
    
    const showLogo = (document.getElementById('toggle-brand-logo-tb')?.checked ?? document.getElementById('toggle-brand-logo')?.checked) !== false;
    const showHandle = (document.getElementById('toggle-brand-handle-tb')?.checked ?? document.getElementById('toggle-brand-handle')?.checked) !== false;
    const showHeaderAsset = document.getElementById('toggle-brand-header-asset')?.checked !== false;
    const showPagination = (document.getElementById('toggle-slide-numbers-tb')?.checked ?? document.getElementById('toggle-slide-numbers')?.checked) !== false;
    const showSwipe = document.getElementById('toggle-swipe-indicator')?.checked !== false;
    const showNewsBreaking = document.getElementById('toggle-news-breaking')?.checked !== false;

    const addObjects = () => {
        // --- 1. Overlay Layer ---
        let overlayFill = 'rgba(0,0,0,0.65)';
        if (selectedPreset === 'tpl_news_editorial') overlayFill = 'rgba(15, 23, 42, 0.65)';
        if (selectedPreset === 'tpl_gamified_quiz') overlayFill = 'rgba(15, 12, 41, 0.75)';
        if (selectedPreset === 'tpl_curiosity_hook') overlayFill = 'rgba(11, 12, 16, 0.85)';
        if (selectedPreset === 'tpl_editorial_quote') overlayFill = 'rgba(10, 17, 40, 0.90)';
        if (selectedPreset === 'tpl_structured_list') overlayFill = 'rgba(15, 23, 42, 0.90)';
        if (selectedPreset === 'template-bold') overlayFill = 'rgba(10,10,10,0.85)';
        if (selectedPreset === 'template-glass') overlayFill = 'rgba(10, 25, 47, 0.75)';
        if (selectedPreset === 'template-visual') overlayFill = 'rgba(0,0,0,0.25)';
        if (selectedPreset === 'template-minimal') overlayFill = 'rgba(18,18,24,0.85)';
        if (selectedPreset === 'template-bright-minimal') overlayFill = 'rgba(255,255,255,0.05)';
        if (selectedPreset === 'template-facts-single') overlayFill = 'rgba(255,255,255,0)';
        if (selectedPreset === 'template-fb-minimal-1' || selectedPreset === 'template-fb-minimal-2') overlayFill = 'rgba(0,0,0,0.45)';
        if (selectedPreset === 'template-news-image') overlayFill = 'rgba(9, 13, 22, 0.45)';
        if (selectedPreset === 'template-news-text') overlayFill = 'rgba(11, 17, 32, 0.95)';
        if (selectedPreset === 'template-custom' && brand?.customBgOpacity) {
            const hex = (brand.customBgColor || '#000000').replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16) || 0;
            const g = parseInt(hex.substring(2, 4), 16) || 0;
            const b = parseInt(hex.substring(4, 6), 16) || 0;
            const a = (brand.customBgOpacity || 85) / 100;
            overlayFill = `rgba(${r},${g},${b},${a})`;
        }

        if (isCTA) {
            overlayFill = new fabric.Gradient({
                type: 'linear', gradientUnits: 'pixels',
                coords: { x1: 0, y1: 0, x2: 0, y2: CANVAS_H },
                colorStops: [{ offset: 0, color: primaryColor }, { offset: 1, color: secondaryColor }]
            });
        }

        const overlay = new fabric.Rect({
            left: 0, top: 0,
            width: CANVAS_W, height: CANVAS_H,
            fill: overlayFill,
            selectable: false, evented: false, customType: 'overlay'
        });
        targetCanvas.add(overlay);

        // --- 2. Header Bar / Top Strip ---
        const minimalPresets = ['template-minimal', 'template-bright-minimal', 'template-blue-border', 'template-fb-minimal-1', 'template-fb-minimal-2'];
        if (!minimalPresets.includes(selectedPreset) && selectedPreset !== 'template-visual' && selectedPreset !== 'template-news-image' && selectedPreset !== 'template-news-text' && selectedPreset !== 'template-facts-single') {
            const defaultHeaderFill = selectedPreset === 'template-bold' ? '#141414' : 'rgba(0,0,0,0.4)';
            const headerBar = new fabric.Rect({
                left: 0, top: 0,
                width: CANVAS_W, height: 135,
                fill: defaultHeaderFill,
                selectable: true, evented: true, customType: 'header-bar'
            });

            // Check template overrides for header-bar
            const overridesStr = localStorage.getItem('loksewa_template_overrides');
            if (overridesStr) {
                try {
                    const overrides = JSON.parse(overridesStr);
                    if (overrides[selectedPreset] && overrides[selectedPreset]['header-bar']) {
                        const hStyle = overrides[selectedPreset]['header-bar'];
                        headerBar.set({
                            left: hStyle.left !== undefined ? hStyle.left : 0,
                            top: hStyle.top !== undefined ? hStyle.top : 0,
                            width: hStyle.width !== undefined ? hStyle.width : CANVAS_W,
                            height: hStyle.height !== undefined ? hStyle.height : 135,
                            scaleX: hStyle.scaleX !== undefined ? hStyle.scaleX : 1,
                            scaleY: hStyle.scaleY !== undefined ? hStyle.scaleY : 1,
                            fill: hStyle.fill || defaultHeaderFill
                        });
                    }
                } catch(e) {}
            }
            targetCanvas.add(headerBar);
            
            const headerPicker = document.getElementById('canvas-header-bg-color');
            if (headerPicker) headerPicker.value = fabricColorToHex(headerBar.fill);
        }


        // --- 3. Brand Logo (Moveable, ON/OFF toggleable) ---
        if (showLogo && brand?.logoUrl) {
            fabric.Image.fromURL(brand.logoUrl, (img) => {
                if (img && img.width > 0) {
                    const targetSize = 56;
                    let scaleX = targetSize / (img.height || targetSize);
                    let scaleY = scaleX;
                    let left = 80;
                    let top = (minimalPresets.includes(selectedPreset)) ? 42 : 36;

                    // Apply saved overrides for brand-logo
                    const overridesStr = localStorage.getItem('loksewa_template_overrides');
                    if (overridesStr) {
                        try {
                            const overrides = JSON.parse(overridesStr);
                            if (overrides[selectedPreset] && overrides[selectedPreset]['brand-logo']) {
                                const lStyle = overrides[selectedPreset]['brand-logo'];
                                if (typeof lStyle.left === 'number') left = lStyle.left;
                                if (typeof lStyle.top === 'number') top = lStyle.top;
                                if (typeof lStyle.scaleX === 'number') scaleX = lStyle.scaleX;
                                if (typeof lStyle.scaleY === 'number') scaleY = lStyle.scaleY;
                            }
                        } catch(e) {}
                    }

                    img.set({
                        left: left,
                        top: top,
                        scaleX: scaleX,
                        scaleY: scaleY,
                        selectable: true,
                        evented: true,
                        customType: 'brand-logo',
                        isPlaceholder: 'brand-logo'
                    });
                    targetCanvas.add(img);
                    targetCanvas.bringToFront(img);
                    targetCanvas.renderAll();
                }
            }, { crossOrigin: 'anonymous' });
        }

        // --- 4. Brand Name / Handle in Header (Moveable, ON/OFF toggleable) ---
        if (showHandle) {
            const brandTextLeft = (showLogo && brand?.logoUrl) ? 150 : (selectedPreset === 'template-bold' ? 90 : 80);
            const brandText = new fabric.IText(brandName, {
                left: brandTextLeft,
                top: (minimalPresets.includes(selectedPreset)) ? 52 : 44,
                fontSize: selectedPreset === 'template-bold' ? 38 : 36,
                fontWeight: '700',
                fill: selectedPreset === 'template-bold' ? '#ffd700' : (selectedPreset === 'template-bright-minimal' || selectedPreset === 'template-blue-border' ? '#111827' : '#ffffff'),
                fontFamily: headingFont,
                selectable: true,
                evented: true,
                customType: 'brand-handle'
            });
            if (slideData.brandHandleStyle) {
                brandText.set(slideData.brandHandleStyle);
            }
            targetCanvas.add(brandText);
        }

        // --- 5. Brand Header Asset (Moveable, ON/OFF toggleable) ---
        const assetUrl = brand?.headerAssetUrl || brand?.logoUrl;
        if (showHeaderAsset && assetUrl) {
            const loadOpts = assetUrl.startsWith('data:') ? {} : { crossOrigin: 'anonymous' };
            fabric.Image.fromURL(assetUrl, (img) => {
                if (img && img.width > 0) {
                    const targetH = 65;
                    const targetW = 350;
                    const defaultScale = Math.min(targetH / img.height, targetW / img.width) * 0.90;
                    img.set({
                        left: 80,
                        top: 67.5,
                        originX: 'left',
                        originY: 'center',
                        scaleX: defaultScale, scaleY: defaultScale,
                        selectable: true, evented: true,
                        customType: 'header-asset'
                    });
                    // Check template overrides and brand headerAssetStyle for header-asset
                    const overridesStr = localStorage.getItem('loksewa_template_overrides');
                    let haStyle = null;
                    if (overridesStr) {
                        try {
                            const overrides = JSON.parse(overridesStr);
                            if (overrides[selectedPreset] && overrides[selectedPreset]['header-asset']) {
                                haStyle = overrides[selectedPreset]['header-asset'];
                            } else if (overrides['template-custom'] && overrides['template-custom']['header-asset']) {
                                haStyle = overrides['template-custom']['header-asset'];
                            }
                        } catch(e) {}
                    }
                    if (!haStyle && brand?.headerAssetStyle) haStyle = brand.headerAssetStyle;
                    if (!haStyle && slideData.headerAssetStyle) haStyle = slideData.headerAssetStyle;

                    const finalLeft = (haStyle && haStyle.left !== undefined) ? haStyle.left : 80;
                    const finalTop = (haStyle && haStyle.top !== undefined) ? haStyle.top : 67.5;
                    const finalScaleX = (haStyle && haStyle.scaleX !== undefined) ? haStyle.scaleX : defaultScale;
                    const finalScaleY = (haStyle && haStyle.scaleY !== undefined) ? haStyle.scaleY : defaultScale;
                    const finalOpacity = (haStyle && haStyle.opacity !== undefined) ? haStyle.opacity : 1;
                    const finalAngle = (haStyle && haStyle.angle !== undefined) ? haStyle.angle : 0;

                    img.set({
                        left: finalLeft,
                        top: finalTop,
                        originX: 'left',
                        originY: 'center',
                        scaleX: finalScaleX,
                        scaleY: finalScaleY,
                        opacity: finalOpacity,
                        angle: finalAngle,
                        selectable: true, evented: true,
                        customType: 'header-asset'
                    });

                    targetCanvas.add(img);
                    targetCanvas.bringToFront(img);
                    targetCanvas.renderAll();
                } else {
                    console.warn('[Header Asset] Image loaded but has no width, URL starts with:', assetUrl.substring(0, 40));
                }
            }, loadOpts);
        }

        // --- 6. Accent Line ---
        if (selectedPreset !== 'template-minimal' && selectedPreset !== 'template-fb-minimal-1' && selectedPreset !== 'template-fb-minimal-2') {
            const defaultFill = selectedPreset === 'template-bold' ? '#ffd700' : (selectedPreset === 'template-bright-minimal' ? '#2563eb' : accentColor);
            const topAccent = new fabric.Rect({
                left: selectedPreset === 'template-bold' ? 90 : 80,
                top: selectedPreset === 'template-bright-minimal' ? 110 : 135,
                width: selectedPreset === 'template-bold' ? 260 : (selectedPreset === 'template-bright-minimal' ? CANVAS_W - 160 : 200),
                height: selectedPreset === 'template-bold' ? 8 : (selectedPreset === 'template-bright-minimal' ? 4 : 6),
                fill: defaultFill, rx: 4, ry: 4,
                selectable: true, evented: true, customType: 'top-accent'
            });

            const overridesStr = localStorage.getItem('loksewa_template_overrides');
            if (overridesStr) {
                try {
                    const overrides = JSON.parse(overridesStr);
                    if (overrides[selectedPreset] && overrides[selectedPreset]['top-accent']) {
                        const aStyle = overrides[selectedPreset]['top-accent'];
                        topAccent.set({
                            left: aStyle.left !== undefined ? aStyle.left : topAccent.left,
                            top: aStyle.top !== undefined ? aStyle.top : topAccent.top,
                            width: aStyle.width !== undefined ? aStyle.width : topAccent.width,
                            height: aStyle.height !== undefined ? aStyle.height : topAccent.height,
                            scaleX: aStyle.scaleX !== undefined ? aStyle.scaleX : 1,
                            scaleY: aStyle.scaleY !== undefined ? aStyle.scaleY : 1,
                            fill: aStyle.fill || defaultFill,
                            opacity: aStyle.opacity !== undefined ? aStyle.opacity : 1
                        });
                    }
                } catch(e) {}
            }
            targetCanvas.add(topAccent);
        }

        if (isCTA) {
            // ===== CTA SLIDE DYNAMIC LAYOUT (ZERO OVERLAP) =====
            const ctaLabelTop = 260;
            const ctaLabel = new fabric.IText('BEFORE YOU GO', {
                left: CANVAS_W / 2, top: ctaLabelTop,
                fontSize: 30, fontWeight: '700',
                fill: accentColor, fontFamily: headingFont,
                textAlign: 'center', originX: 'center', letterSpacing: 4,
                selectable: true, customType: 'cta-label'
            });
            if (slideData.ctaLabelStyle) ctaLabel.set(slideData.ctaLabelStyle);
            targetCanvas.add(ctaLabel);

            const ctaTitleTop = ctaLabelTop + ctaLabel.getScaledHeight() + 30;
            const ctaTitleDef = {
                left: 80, top: ctaTitleTop, width: CANVAS_W - 160,
                fontSize: 84, fontWeight: '900', fill: '#ffffff',
                fontFamily: headingFont, textAlign: 'center', lineHeight: 1.15,
                selectable: true, isPlaceholder: 'title', customType: 'title'
            };
            const ctaTitle = new fabric.Textbox(slideData.title || 'Follow for More! 🔥', { ...ctaTitleDef, ...(slideData.titleStyle || {}) });
            targetCanvas.add(ctaTitle);

            const ctaTitleHeight = ctaTitle.getScaledHeight();
            const ctaBodyTop = (slideData.titleStyle && slideData.titleStyle.top) ? slideData.titleStyle.top + ctaTitleHeight + 35 : ctaTitleTop + ctaTitleHeight + 35;

            const ctaBodyDef = {
                left: 80, top: ctaBodyTop, width: CANVAS_W - 160,
                fontSize: 44, fill: 'rgba(255,255,255,0.88)',
                fontFamily: bodyFont, textAlign: 'center', lineHeight: 1.5,
                selectable: true, isPlaceholder: 'body', customType: 'body'
            };
            const ctaBody = new fabric.Textbox(slideData.content || `Read the caption for the full breakdown ↓\n\nFollow ${handle} for daily prep & insights.`, { ...ctaBodyDef, ...(slideData.bodyStyle || {}) });
            targetCanvas.add(ctaBody);

            const ctaBodyHeight = ctaBody.getScaledHeight();
            const ctaBtnTop = Math.max(ctaBodyTop + ctaBodyHeight + 45, 1050);

            const ctaBtnRect = new fabric.Rect({
                left: CANVAS_W / 2 - 220, top: ctaBtnTop,
                width: 440, height: 90, fill: accentColor,
                rx: 45, ry: 45,
                selectable: true, evented: true, customType: 'cta-btn-bg'
            });
            if (slideData.ctaBtnBgStyle) ctaBtnRect.set(slideData.ctaBtnBgStyle);
            targetCanvas.add(ctaBtnRect);

            const ctaBtnText = new fabric.IText('FOLLOW NOW', {
                left: CANVAS_W / 2, top: ctaBtnTop + 25,
                fontSize: 34, fontWeight: '800', fill: '#000000',
                fontFamily: headingFont, textAlign: 'center', originX: 'center',
                selectable: true, evented: true, customType: 'cta-btn-text'
            });
            if (slideData.ctaBtnTextStyle) ctaBtnText.set(slideData.ctaBtnTextStyle);
            targetCanvas.add(ctaBtnText);

        } else {
            // ===== CONTENT SLIDE LAYOUT BY PRESET =====

            if (selectedPreset === 'template-glass') {
                // Glassmorphism Card Container
                const glassCard = new fabric.Rect({
                    left: 60, top: 180,
                    width: CANVAS_W - 120, height: 950,
                    fill: 'rgba(255, 255, 255, 0.12)',
                    stroke: 'rgba(255, 255, 255, 0.35)',
                    strokeWidth: 2,
                    rx: 36, ry: 36,
                    selectable: false, evented: false, customType: 'glass-card'
                });
                targetCanvas.add(glassCard);

                const titleDef = {
                    left: 100, top: 230, width: CANVAS_W - 200,
                    fontSize: 80, fontWeight: '800', fill: '#ffffff',
                    fontFamily: headingFont, lineHeight: 1.15,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                targetCanvas.add(slideTitle);

                const titleBottom = (slideData.titleStyle && slideData.titleStyle.top) ? slideData.titleStyle.top + slideTitle.getScaledHeight() + 35 : 230 + slideTitle.getScaledHeight() + 35;
                const bodyDef = {
                    left: 100, top: Math.max(titleBottom, 420), width: CANVAS_W - 200,
                    fontSize: 48, fill: '#f8fafc',
                    fontFamily: bodyFont, lineHeight: 1.55,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                targetCanvas.add(slideBody);

            } else if (selectedPreset === 'template-bold') {
                // Bold Yellow Vertical Left Bar
                const verticalBar = new fabric.Rect({
                    left: 65, top: 210,
                    width: 14, height: 820,
                    fill: '#ffd700', rx: 7, ry: 7,
                    selectable: true, evented: true, customType: 'bold-vertical-bar'
                });

                const overridesStrV = localStorage.getItem('loksewa_template_overrides');
                if (overridesStrV) {
                    try {
                        const overrides = JSON.parse(overridesStrV);
                        if (overrides[selectedPreset] && overrides[selectedPreset]['bold-vertical-bar']) {
                            const vStyle = overrides[selectedPreset]['bold-vertical-bar'];
                            verticalBar.set({
                                left: vStyle.left !== undefined ? vStyle.left : 65,
                                top: vStyle.top !== undefined ? vStyle.top : 210,
                                width: vStyle.width !== undefined ? vStyle.width : 14,
                                height: vStyle.height !== undefined ? vStyle.height : 820,
                                scaleX: vStyle.scaleX !== undefined ? vStyle.scaleX : 1,
                                scaleY: vStyle.scaleY !== undefined ? vStyle.scaleY : 1,
                                fill: vStyle.fill || '#ffd700',
                                opacity: vStyle.opacity !== undefined ? vStyle.opacity : 1
                            });
                        }
                    } catch(e) {}
                }
                targetCanvas.add(verticalBar);

                const titleDef = {
                    left: 105, top: 210, width: CANVAS_W - 185,
                    fontSize: 92, fontWeight: '900', fill: '#ffd700',
                    fontFamily: headingFont, lineHeight: 1.1,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                targetCanvas.add(slideTitle);

                const titleBottom = (slideData.titleStyle && slideData.titleStyle.top) ? slideData.titleStyle.top + slideTitle.getScaledHeight() + 35 : 210 + slideTitle.getScaledHeight() + 35;
                const bodyDef = {
                    left: 105, top: Math.max(titleBottom, 450), width: CANVAS_W - 185,
                    fontSize: 50, fontWeight: '600', fill: '#ffffff',
                    fontFamily: bodyFont, lineHeight: 1.5,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                targetCanvas.add(slideBody);

            } else if (selectedPreset === 'template-visual') {
                // Bottom Solid Panel
                const bottomPanel = new fabric.Rect({
                    left: 0, top: 800,
                    width: CANVAS_W, height: 550,
                    fill: 'rgba(15, 23, 42, 0.94)',
                    stroke: accentColor, strokeWidth: 4,
                    selectable: false, evented: false, customType: 'bottom-panel'
                });
                targetCanvas.add(bottomPanel);

                const titleDef = {
                    left: 80, top: 840, width: CANVAS_W - 160,
                    fontSize: 72, fontWeight: '800', fill: '#ffffff',
                    fontFamily: headingFont, lineHeight: 1.15,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                targetCanvas.add(slideTitle);

                const titleBottom = (slideData.titleStyle && slideData.titleStyle.top) ? slideData.titleStyle.top + slideTitle.getScaledHeight() + 25 : 840 + slideTitle.getScaledHeight() + 25;
                const bodyDef = {
                    left: 80, top: Math.max(titleBottom, 960), width: CANVAS_W - 160,
                    fontSize: 44, fill: '#cbd5e1',
                    fontFamily: bodyFont, lineHeight: 1.5,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                targetCanvas.add(slideBody);

            } else if (selectedPreset === 'tpl_news_editorial') {
                let currentY = 160;

                // Category Pill / Badge (Loksewa Token)
                const badgeTextVal = (document.getElementById('canvas-badge-selector')?.value || '🇳🇵 LOKSEWA NEWS').toUpperCase();
                const badgeBg = new fabric.Rect({
                    left: 0, top: 0, width: 260 + (badgeTextVal.length * 10), height: 50,
                    fill: BRAND_TOKENS.loksewa.accentPrimary, rx: 8, ry: 8, customType: 'news-badge-bg'
                });
                const badgeText = new fabric.IText(badgeTextVal, {
                    left: 18, top: 12, fontSize: 22, fontWeight: '800', fill: '#FFFFFF',
                    fontFamily: BRAND_TOKENS.loksewa.fontHeading, customType: 'news-badge-text'
                });
                const badgeGroup = new fabric.Group([badgeBg, badgeText], {
                    left: BRAND_TOKENS.loksewa.safeMargin, top: currentY, selectable: true, customType: 'news-badge-group'
                });
                targetCanvas.add(badgeGroup);
                currentY += 75;

                // Headline
                const titleDef = {
                    left: BRAND_TOKENS.loksewa.safeMargin, top: currentY, width: CANVAS_W - (BRAND_TOKENS.loksewa.safeMargin * 2),
                    fontSize: 76, fontWeight: '900', fill: BRAND_TOKENS.loksewa.textHeading,
                    fontFamily: BRAND_TOKENS.loksewa.fontHeading, lineHeight: 1.15,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                targetCanvas.add(slideTitle);

                currentY += slideTitle.getScaledHeight() + 30;

                // Media Frame / Image Placeholder
                const frameHeight = Math.round(CANVAS_H * 0.35);
                if (!imageUrl) {
                    const placeholderBg = new fabric.Rect({
                        left: BRAND_TOKENS.loksewa.safeMargin, top: currentY, width: CANVAS_W - (BRAND_TOKENS.loksewa.safeMargin * 2), height: frameHeight,
                        fill: BRAND_TOKENS.loksewa.bgSecondary, stroke: BRAND_TOKENS.loksewa.accentPrimary, strokeWidth: 2, strokeDashArray: [8, 4],
                        rx: 16, ry: 16, selectable: true, customType: 'image-placeholder-bg'
                    });
                    targetCanvas.add(placeholderBg);
                    const placeholderText = new fabric.IText('📰 Editorial Media Slot (Upload / AI)', {
                        left: CANVAS_W / 2, top: currentY + frameHeight / 2, originX: 'center', originY: 'center',
                        fontSize: 28, fontWeight: '600', fill: BRAND_TOKENS.loksewa.textCaption, fontFamily: BRAND_TOKENS.loksewa.fontHeading, selectable: false
                    });
                    targetCanvas.add(placeholderText);
                }
                currentY += frameHeight + 35;

                // Body Text
                const bodyDef = {
                    left: BRAND_TOKENS.loksewa.safeMargin, top: currentY, width: CANVAS_W - (BRAND_TOKENS.loksewa.safeMargin * 2),
                    fontSize: 44, fontWeight: '400', fill: BRAND_TOKENS.loksewa.textBody,
                    fontFamily: BRAND_TOKENS.loksewa.fontBody, lineHeight: 1.5,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                targetCanvas.add(slideBody);

                // Source Tag
                const sourceTag = new fabric.IText('SOURCE: PUBLIC SERVICE COMMISSION (NEPAL) • VERIFIED REPORT', {
                    left: BRAND_TOKENS.loksewa.safeMargin, top: CANVAS_H - 120, fontSize: 20, fontWeight: '700', fill: BRAND_TOKENS.loksewa.textCaption,
                    fontFamily: BRAND_TOKENS.loksewa.fontHeading, letterSpacing: 1.5, selectable: true
                });
                targetCanvas.add(sourceTag);

            } else if (selectedPreset === 'tpl_gamified_quiz') {
                let currentY = 150;

                const quizTag = new fabric.IText('🎯 LOKSEWA MODEL TEST • QUIZ SLIDE', {
                    left: BRAND_TOKENS.loksewa.safeMargin, top: currentY, fontSize: 24, fontWeight: '800', fill: BRAND_TOKENS.loksewa.accentSecondary,
                    fontFamily: BRAND_TOKENS.loksewa.fontHeading, letterSpacing: 2, selectable: true
                });
                targetCanvas.add(quizTag);
                currentY += 45;

                const qTitleDef = {
                    left: BRAND_TOKENS.loksewa.safeMargin, top: currentY, width: CANVAS_W - (BRAND_TOKENS.loksewa.safeMargin * 2),
                    fontSize: 72, fontWeight: '900', fill: BRAND_TOKENS.loksewa.textHeading,
                    fontFamily: BRAND_TOKENS.loksewa.fontHeading, lineHeight: 1.15,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...qTitleDef, ...(slideData.titleStyle || {}) });
                targetCanvas.add(slideTitle);

                currentY += slideTitle.getScaledHeight() + 40;

                const rawLines = (slideData.content || '').split('\n').filter(l => l.trim().length > 0);
                const options = rawLines.length >= 2 ? rawLines : [
                    'A. Option First (Primary Choice)',
                    'B. Option Second (Secondary Choice)',
                    'C. Option Third (Alternative)',
                    'D. Option Fourth (Final Choice)'
                ];

                options.slice(0, 4).forEach((optText, i) => {
                    const isCorrect = optText.includes('✓') || optText.includes('(Correct)') || i === 0;
                    const cardBg = new fabric.Rect({
                        left: BRAND_TOKENS.loksewa.safeMargin, top: currentY, width: CANVAS_W - (BRAND_TOKENS.loksewa.safeMargin * 2), height: 95,
                        fill: isCorrect ? '#FEF3C7' : BRAND_TOKENS.loksewa.bgSecondary,
                        stroke: isCorrect ? BRAND_TOKENS.loksewa.accentSecondary : '#CBD5E1', strokeWidth: 2,
                        rx: 16, ry: 16, selectable: true
                    });
                    targetCanvas.add(cardBg);

                    const optLabel = new fabric.Textbox(optText, {
                        left: BRAND_TOKENS.loksewa.safeMargin + 30, top: currentY + 24, width: CANVAS_W - (BRAND_TOKENS.loksewa.safeMargin * 2) - 60,
                        fontSize: 38, fontWeight: isCorrect ? '700' : '500',
                        fill: isCorrect ? '#92400E' : BRAND_TOKENS.loksewa.textBody, fontFamily: BRAND_TOKENS.loksewa.fontBody, selectable: true
                    });
                    targetCanvas.add(optLabel);

                    currentY += 115;
                });

            } else if (selectedPreset === 'tpl_curiosity_hook') {
                const glowCircle = new fabric.Circle({
                    left: CANVAS_W / 2, top: CANVAS_H / 3, radius: 350, originX: 'center', originY: 'center',
                    fill: new fabric.Gradient({
                        type: 'radial', coords: { x1: 350, y1: 350, r1: 0, x2: 350, y2: 350, r2: 350 },
                        colorStops: [{ offset: 0, color: 'rgba(139, 127, 214, 0.35)' }, { offset: 1, color: 'rgba(11, 14, 20, 0)' }]
                    }),
                    selectable: false, evented: false
                });
                targetCanvas.add(glowCircle);

                const cardMargin = BRAND_TOKENS.psychology.safeMargin;
                const cardTop = 160;
                const cardHeight = CANVAS_H - 320;
                const glassCard = new fabric.Rect({
                    left: cardMargin, top: cardTop, width: CANVAS_W - (cardMargin * 2), height: cardHeight,
                    fill: BRAND_TOKENS.psychology.bgSecondary, stroke: 'rgba(255, 255, 255, 0.18)', strokeWidth: 2,
                    rx: BRAND_TOKENS.psychology.radiusCard, ry: BRAND_TOKENS.psychology.radiusCard, selectable: true, customType: 'glass-card'
                });
                targetCanvas.add(glassCard);

                const accentPill = new fabric.Rect({
                    left: cardMargin + 40, top: cardTop + 45, width: 100, height: 8,
                    fill: BRAND_TOKENS.psychology.accentPrimary, rx: 4, ry: 4, selectable: false
                });
                targetCanvas.add(accentPill);

                const titleDef = {
                    left: cardMargin + 40, top: cardTop + 75, width: CANVAS_W - (cardMargin * 2) - 80,
                    fontSize: 78, fontWeight: '900', fill: BRAND_TOKENS.psychology.textHeading,
                    fontFamily: BRAND_TOKENS.psychology.fontHeading, lineHeight: 1.15,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                targetCanvas.add(slideTitle);

                const titleBottom = cardTop + 75 + slideTitle.getScaledHeight() + 40;

                const bodyDef = {
                    left: cardMargin + 40, top: titleBottom, width: CANVAS_W - (cardMargin * 2) - 80,
                    fontSize: 46, fontWeight: '400', fill: BRAND_TOKENS.psychology.textBody,
                    fontFamily: BRAND_TOKENS.psychology.fontBody, lineHeight: 1.55,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                targetCanvas.add(slideBody);

            } else if (selectedPreset === 'tpl_editorial_quote') {
                let currentY = 160;

                const quoteGlyph = new fabric.IText('“', {
                    left: BRAND_TOKENS.political_literacy.safeMargin - 5, top: currentY - 30, fontSize: 160, fontWeight: '900',
                    fill: BRAND_TOKENS.political_literacy.accentPrimary, fontFamily: BRAND_TOKENS.political_literacy.fontHeading, selectable: false
                });
                targetCanvas.add(quoteGlyph);

                currentY += 100;

                const quoteDef = {
                    left: BRAND_TOKENS.political_literacy.safeMargin, top: currentY, width: CANVAS_W - (BRAND_TOKENS.political_literacy.safeMargin * 2),
                    fontSize: 64, fontWeight: '700', fill: BRAND_TOKENS.political_literacy.textHeading,
                    fontFamily: BRAND_TOKENS.political_literacy.fontHeading, lineHeight: 1.25, fontStyle: 'italic',
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...quoteDef, ...(slideData.titleStyle || {}) });
                targetCanvas.add(slideTitle);

                currentY += slideTitle.getScaledHeight() + 45;

                const divLine = new fabric.Rect({
                    left: BRAND_TOKENS.political_literacy.safeMargin, top: currentY, width: 140, height: 4,
                    fill: BRAND_TOKENS.political_literacy.accentPrimary, selectable: false
                });
                targetCanvas.add(divLine);

                currentY += 30;

                const authorDef = {
                    left: BRAND_TOKENS.political_literacy.safeMargin, top: currentY, width: CANVAS_W - (BRAND_TOKENS.political_literacy.safeMargin * 2),
                    fontSize: 44, fontWeight: '500', fill: BRAND_TOKENS.political_literacy.textBody,
                    fontFamily: BRAND_TOKENS.political_literacy.fontBody, lineHeight: 1.4,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '— Political Literacy Project', { ...authorDef, ...(slideData.bodyStyle || {}) });
                targetCanvas.add(slideBody);

            } else if (selectedPreset === 'tpl_structured_list') {
                let currentY = 160;

                const titleDef = {
                    left: BRAND_TOKENS.political_literacy.safeMargin, top: currentY, width: CANVAS_W - (BRAND_TOKENS.political_literacy.safeMargin * 2),
                    fontSize: 72, fontWeight: '900', fill: BRAND_TOKENS.political_literacy.textHeading,
                    fontFamily: BRAND_TOKENS.political_literacy.fontHeading, lineHeight: 1.15,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                targetCanvas.add(slideTitle);

                currentY += slideTitle.getScaledHeight() + 40;

                const items = (slideData.content || '').split('\n').filter(l => l.trim().length > 0);
                const listItems = items.length > 0 ? items : [
                    '1. Context: Historical background and policy origin',
                    '2. Mechanism: Structural breakdown of regulatory framework',
                    '3. Stakes: Long-term economic & civic implications'
                ];

                const cardHeight = Math.min(130, Math.floor((CANVAS_H - currentY - 140) / listItems.length));

                listItems.forEach((itemText, idx) => {
                    const itemCard = new fabric.Rect({
                        left: BRAND_TOKENS.political_literacy.safeMargin, top: currentY, width: CANVAS_W - (BRAND_TOKENS.political_literacy.safeMargin * 2), height: cardHeight - 15,
                        fill: BRAND_TOKENS.political_literacy.bgSecondary, stroke: '#E2E8F0', strokeWidth: 1.5,
                        rx: BRAND_TOKENS.political_literacy.radiusCard, ry: BRAND_TOKENS.political_literacy.radiusCard, selectable: true
                    });
                    targetCanvas.add(itemCard);

                    const numCircle = new fabric.Circle({
                        left: BRAND_TOKENS.political_literacy.safeMargin + 25, top: currentY + (cardHeight - 15) / 2, radius: 22, originY: 'center',
                        fill: BRAND_TOKENS.political_literacy.accentPrimary, selectable: false
                    });
                    targetCanvas.add(numCircle);

                    const numText = new fabric.IText(String(idx + 1), {
                        left: BRAND_TOKENS.political_literacy.safeMargin + 25, top: currentY + (cardHeight - 15) / 2, originX: 'center', originY: 'center',
                        fontSize: 24, fontWeight: '800', fill: '#FFFFFF', fontFamily: BRAND_TOKENS.political_literacy.fontHeading, selectable: false
                    });
                    targetCanvas.add(numText);

                    const itemTB = new fabric.Textbox(itemText.replace(/^\d+\.\s*/, ''), {
                        left: BRAND_TOKENS.political_literacy.safeMargin + 75, top: currentY + 20, width: CANVAS_W - (BRAND_TOKENS.political_literacy.safeMargin * 2) - 100,
                        fontSize: 38, fontWeight: '500', fill: BRAND_TOKENS.political_literacy.textBody, fontFamily: BRAND_TOKENS.political_literacy.fontBody, selectable: true
                    });
                    targetCanvas.add(itemTB);

                    currentY += cardHeight;
                });

            } else if (selectedPreset === 'template-minimal' || selectedPreset === 'template-bright-minimal' || selectedPreset === 'template-psych-dark' || selectedPreset === 'template-psych-quote') {
                const titleColor = selectedPreset === 'template-bright-minimal' ? '#111827' : '#ffffff';
                const bodyColor = selectedPreset === 'template-bright-minimal' ? '#4b5563' : '#cbd5e1';
                
                if (selectedPreset === 'template-psych-dark' || selectedPreset === 'template-psych-quote') {
                    const topBar = new fabric.Rect({
                        left: 80, top: 120, width: 80, height: 6,
                        fill: '#6366F1', rx: 3, ry: 3,
                        selectable: false, evented: false, customType: 'psych-accent-bar'
                    });
                    targetCanvas.add(topBar);
                }

                const titleDef = {
                    left: 80, top: (selectedPreset === 'template-psych-dark' || selectedPreset === 'template-psych-quote') ? 160 : 230, width: CANVAS_W - 160,
                    fontSize: selectedPreset === 'template-psych-quote' ? 76 : 84, fontWeight: '700', fill: titleColor,
                    fontFamily: headingFont, lineHeight: 1.15,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                targetCanvas.add(slideTitle);

                const titleBottom = (slideData.titleStyle && slideData.titleStyle.top) ? slideData.titleStyle.top + slideTitle.getScaledHeight() + 35 : ((selectedPreset === 'template-psych-dark' || selectedPreset === 'template-psych-quote') ? 160 : 230) + slideTitle.getScaledHeight() + 35;
                const bodyDef = {
                    left: 80, top: Math.max(titleBottom, 450), width: CANVAS_W - 160,
                    fontSize: 48, fontWeight: '400', fill: bodyColor,
                    fontFamily: bodyFont, lineHeight: 1.55,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                targetCanvas.add(slideBody);

            } else if (selectedPreset === 'template-blue-border') {
                // Blue line border
                const borderRect = new fabric.Rect({
                    left: 40, top: 40, width: CANVAS_W - 80, height: CANVAS_H - 80,
                    fill: 'transparent', stroke: '#1e40af', strokeWidth: 4,
                    selectable: false, evented: false, customType: 'blue-border'
                });
                targetCanvas.add(borderRect);

                // Red line separating brand identity and slide body
                const redLine = new fabric.Rect({
                    left: 40, top: 140, width: CANVAS_W - 80, height: 4,
                    fill: '#ef4444',
                    selectable: true, isPlaceholder: 'accent', customType: 'red-line'
                });
                targetCanvas.add(redLine);

                const titleDef = {
                    left: 80, top: 200, width: CANVAS_W - 160,
                    fontSize: 72, fontWeight: '700', fill: '#1e40af',
                    fontFamily: headingFont, lineHeight: 1.15,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                targetCanvas.add(slideTitle);

                const titleBottom = (slideData.titleStyle && slideData.titleStyle.top) ? slideData.titleStyle.top + slideTitle.getScaledHeight() + 40 : 200 + slideTitle.getScaledHeight() + 40;
                const bodyDef = {
                    left: 80, top: Math.max(titleBottom, 400), width: CANVAS_W - 160,
                    fontSize: 48, fontWeight: '400', fill: '#111827',
                    fontFamily: bodyFont, lineHeight: 1.55,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                targetCanvas.add(slideBody);

            } else if (selectedPreset === 'template-fb-minimal-1') {
                const titleDef = {
                    left: 120, top: 320, width: CANVAS_W - 240,
                    fontSize: 88, fontWeight: '900', fill: '#ffffff', textAlign: 'center',
                    fontFamily: headingFont, lineHeight: 1.1,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                targetCanvas.add(slideTitle);

                const titleBottom = (slideData.titleStyle && slideData.titleStyle.top) ? slideData.titleStyle.top + slideTitle.getScaledHeight() + 50 : 320 + slideTitle.getScaledHeight() + 50;
                const bodyDef = {
                    left: 120, top: Math.max(titleBottom, 580), width: CANVAS_W - 240,
                    fontSize: 52, fontWeight: '500', fill: '#f1f5f9', textAlign: 'center',
                    fontFamily: bodyFont, lineHeight: 1.45,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                targetCanvas.add(slideBody);

            } else if (selectedPreset === 'template-fb-minimal-2') {
                const titleDef = {
                    left: 80, top: 320, width: CANVAS_W - 160,
                    fontSize: 92, fontWeight: '800', fill: '#ffffff',
                    fontFamily: headingFont, lineHeight: 1.12,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                targetCanvas.add(slideTitle);

                const titleBottom = (slideData.titleStyle && slideData.titleStyle.top) ? slideData.titleStyle.top + slideTitle.getScaledHeight() + 40 : 320 + slideTitle.getScaledHeight() + 40;
                
                const cardTop = Math.max(titleBottom, 600);
                const fbCard = new fabric.Rect({
                    left: 0, top: cardTop,
                    width: CANVAS_W, height: CANVAS_H - cardTop,
                    fill: 'rgba(0, 0, 0, 0.4)',
                    selectable: false, evented: false, customType: 'fb-card-bg'
                });
                targetCanvas.add(fbCard);

                const bodyDef = {
                    left: 80, top: cardTop + 60, width: CANVAS_W - 160,
                    fontSize: 48, fontWeight: '500', fill: '#f8fafc',
                    fontFamily: bodyFont, lineHeight: 1.5,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                targetCanvas.add(slideBody);

            } else if (selectedPreset === 'template-facts-single') {
                const titleDef = {
                    left: 100, top: 200, width: CANVAS_W - 200,
                    fontSize: 76, fontWeight: '800', fill: '#0f172a', textAlign: 'center',
                    fontFamily: headingFont, lineHeight: 1.15,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                targetCanvas.add(slideTitle);

                const bodyDef = {
                    left: 100, top: 940, width: CANVAS_W - 200,
                    fontSize: 46, fontWeight: '500', fill: '#334155', textAlign: 'center',
                    fontFamily: bodyFont, lineHeight: 1.45,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                targetCanvas.add(slideBody);

            } else if (selectedPreset === 'template-news-image') {
                // --- Red Breaking News Badge ---
                let titleY = 180;
                if (showNewsBreaking) {
                    const badgeString = document.getElementById('canvas-badge-selector')?.value || '🔴 BREAKING NEWS';
                    const estimatedWidth = 250 + Math.max(0, (badgeString.length - 16) * 12);
                    
                    const badgeBg = new fabric.Rect({
                        left: 0, top: 0, width: estimatedWidth, height: 48,
                        fill: '#dc2626', rx: 24, ry: 24,
                        customType: 'news-badge-bg'
                    });
                    const badgeText = new fabric.IText(badgeString, {
                        left: 18, top: 12,
                        fontSize: 22, fontWeight: '800', fill: '#ffffff',
                        fontFamily: headingFont, customType: 'news-badge-text'
                    });
                    const badgeGroup = new fabric.Group([badgeBg, badgeText], {
                        left: 80, top: 160,
                        selectable: true, evented: true, customType: 'news-badge-group'
                    });
                    targetCanvas.add(badgeGroup);
                    titleY = 230;
                }

                const titleDef = {
                    left: 80, top: titleY, width: CANVAS_W - 160,
                    fontSize: 84, fontWeight: '900', fill: '#ffffff',
                    fontFamily: headingFont, lineHeight: 1.12,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                targetCanvas.add(slideTitle);

                const titleBottom = (slideData.titleStyle && slideData.titleStyle.top) ? slideData.titleStyle.top + slideTitle.getScaledHeight() + 30 : 230 + slideTitle.getScaledHeight() + 30;
                const cardTop = Math.max(titleBottom, 450);
                const cardHeight = Math.min(CANVAS_H - cardTop - 120, 600);

                const newsCard = new fabric.Rect({
                    left: 60, top: cardTop,
                    width: CANVAS_W - 120, height: cardHeight,
                    fill: 'rgba(15, 23, 42, 0.85)',
                    stroke: '#ef4444', strokeWidth: 2,
                    rx: 24, ry: 24,
                    selectable: false, evented: false, customType: 'news-card-bg'
                });
                targetCanvas.add(newsCard);

                const bodyDef = {
                    left: 95, top: cardTop + 35, width: CANVAS_W - 190,
                    fontSize: 46, fontWeight: '500', fill: '#f1f5f9',
                    fontFamily: bodyFont, lineHeight: 1.5,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                targetCanvas.add(slideBody);

            } else if (selectedPreset === 'template-news-text') {
                // --- Blue News Editorial Badge ---
                let titleY = 180;
                if (showNewsBreaking) {
                    const badgeString = document.getElementById('canvas-badge-selector')?.value || '📰 NEWS ANALYSIS';
                    const estimatedWidth = 250 + Math.max(0, (badgeString.length - 16) * 12);

                    const badgeBg = new fabric.Rect({
                        left: 0, top: 0,
                        width: estimatedWidth, height: 48,
                        fill: '#0284c7', rx: 24, ry: 24,
                        customType: 'news-text-badge-bg'
                    });
                    const badgeText = new fabric.IText(badgeString, {
                        left: 18, top: 12,
                        fontSize: 22, fontWeight: '800', fill: '#ffffff',
                        fontFamily: headingFont, customType: 'news-text-badge-text'
                    });
                    const badgeGroup = new fabric.Group([badgeBg, badgeText], {
                        left: 80, top: 160,
                        selectable: true, evented: true, customType: 'news-badge-group'
                    });
                    targetCanvas.add(badgeGroup);
                    titleY = 230;
                }

                // Left Cyan Accent Strip
                const verticalBar = new fabric.Rect({
                    left: 65, top: titleY,
                    width: 12, height: 790 + (230 - titleY),
                    fill: '#38bdf8', rx: 6, ry: 6,
                    selectable: false, evented: false, customType: 'vertical-accent-bar'
                });
                targetCanvas.add(verticalBar);

                const titleDef = {
                    left: 100, top: titleY, width: CANVAS_W - 180,
                    fontSize: 88, fontWeight: '900', fill: '#f8fafc',
                    fontFamily: headingFont, lineHeight: 1.12,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                targetCanvas.add(slideTitle);

                const titleBottom = (slideData.titleStyle && slideData.titleStyle.top) ? slideData.titleStyle.top + slideTitle.getScaledHeight() + 35 : 230 + slideTitle.getScaledHeight() + 35;
                const cardTop = Math.max(titleBottom, 460);
                const cardHeight = Math.min(CANVAS_H - cardTop - 120, 580);

                const newsCard = new fabric.Rect({
                    left: 100, top: cardTop,
                    width: CANVAS_W - 180, height: cardHeight,
                    fill: 'rgba(30, 41, 59, 0.85)',
                    stroke: 'rgba(56, 189, 248, 0.4)', strokeWidth: 2,
                    rx: 20, ry: 20,
                    selectable: false, evented: false, customType: 'news-text-card-bg'
                });
                targetCanvas.add(newsCard);

                const bodyDef = {
                    left: 130, top: cardTop + 35, width: CANVAS_W - 240,
                    fontSize: 48, fontWeight: '500', fill: '#e2e8f0',
                    fontFamily: bodyFont, lineHeight: 1.55,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                targetCanvas.add(slideBody);

            } else if (selectedPreset === 'template-news-single-image') {
                let currentY = 160;
                if (showNewsBreaking) {
                    const badgeString = document.getElementById('canvas-badge-selector')?.value || '🔴 BREAKING NEWS';
                    const estimatedWidth = 250 + Math.max(0, (badgeString.length - 16) * 12);

                    const badgeBg = new fabric.Rect({
                        left: 0, top: 0, width: estimatedWidth, height: 48,
                        fill: '#dc2626', rx: 24, ry: 24,
                        customType: 'news-badge-bg'
                    });
                    const badgeText = new fabric.IText(badgeString, {
                        left: 18, top: 12,
                        fontSize: 22, fontWeight: '800', fill: '#ffffff',
                        fontFamily: headingFont, customType: 'news-badge-text'
                    });
                    const badgeGroup = new fabric.Group([badgeBg, badgeText], {
                        left: 80, top: currentY,
                        selectable: true, evented: true, customType: 'news-badge-group'
                    });
                    targetCanvas.add(badgeGroup);
                    currentY += 70;
                }

                const placeholderHeight = 400;
                
                // If there's no image, draw the placeholder container.
                // If there is an image, it will be added asynchronously, but we still advance currentY.
                if (!imageUrl) {
                    let phStyle = slideData.imageStyle || {
                        left: 80, top: currentY, width: CANVAS_W - 160, height: placeholderHeight,
                        scaleX: 1, scaleY: 1
                    };
                    const placeholderBg = new fabric.Rect({
                        fill: '#1e293b', stroke: '#475569', strokeWidth: 2, strokeDashArray: [10, 5],
                        rx: 16, ry: 16, selectable: true, customType: 'image-placeholder-bg',
                        ...phStyle
                    });
                    targetCanvas.add(placeholderBg);
                    const placeholderText = new fabric.IText('Drop or Upload Image Here', {
                        left: phStyle.left + (phStyle.width * (phStyle.scaleX || 1)) / 2, 
                        top: phStyle.top + (phStyle.height * (phStyle.scaleY || 1)) / 2, 
                        originX: 'center', originY: 'center',
                        fontSize: 28, fontWeight: '600', fill: '#94a3b8',
                        fontFamily: headingFont, selectable: false, evented: false, customType: 'image-placeholder-text'
                    });
                    targetCanvas.add(placeholderText);
                }
                
                // Always advance currentY by the default layout height so subsequent elements are positioned correctly on initial layout
                currentY += placeholderHeight + 40;

                const titleDef = {
                    left: 80, top: currentY, width: CANVAS_W - 160,
                    fontSize: 72, fontWeight: '900', fill: '#ffffff',
                    fontFamily: headingFont, lineHeight: 1.15,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                targetCanvas.add(slideTitle);

                const titleBottom = (slideData.titleStyle && slideData.titleStyle.top) ? slideData.titleStyle.top + slideTitle.getScaledHeight() + 30 : currentY + slideTitle.getScaledHeight() + 30;

                const bodyDef = {
                    left: 80, top: titleBottom, width: CANVAS_W - 160,
                    fontSize: 42, fontWeight: '500', fill: '#e2e8f0',
                    fontFamily: bodyFont, lineHeight: 1.5,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                targetCanvas.add(slideBody);

            } else if (selectedPreset === 'template-custom') {
                const customTitleSize = parseFloat(brand?.customTitleSize || 100) * 0.88;
                const customTitleY = 210 + (parseFloat(brand?.customTitleY || 50) - 50) * 2;
                const customContentY = (parseFloat(brand?.customContentY || 70) / 100) * CANVAS_H;

                const titleDef = {
                    left: 80, top: customTitleY, width: CANVAS_W - 160,
                    fontSize: customTitleSize, fontWeight: '900', fill: '#ffffff',
                    fontFamily: headingFont, lineHeight: 1.1,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                targetCanvas.add(slideTitle);

                const bodyDef = {
                    left: 80, top: customContentY, width: CANVAS_W - 160,
                    fontSize: 52, fill: 'rgba(255,255,255,0.90)',
                    fontFamily: bodyFont, lineHeight: 1.55,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                targetCanvas.add(slideBody);

            } else {
                // Default / Classic Template
                const titleDef = {
                    left: 80, top: 210, width: CANVAS_W - 160,
                    fontSize: 88, fontWeight: '900', fill: '#ffffff',
                    fontFamily: headingFont, lineHeight: 1.1,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                targetCanvas.add(slideTitle);

                const titleBottom = (slideData.titleStyle && slideData.titleStyle.top) ? slideData.titleStyle.top + slideTitle.getScaledHeight() + 40 : 210 + slideTitle.getScaledHeight() + 40;
                const bodyDef = {
                    left: 80, top: Math.max(titleBottom, 450), width: CANVAS_W - 160,
                    fontSize: 52, fill: 'rgba(255,255,255,0.90)',
                    fontFamily: bodyFont, lineHeight: 1.55,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                targetCanvas.add(slideBody);
            }

            // Slide number badge
            const badgeColor = selectedPreset === 'template-bold' ? '#ffd700' : accentColor;
            const badgeTextColor = '#000000';
            const slideNumBadge = new fabric.Rect({
                left: CANVAS_W - 165, top: CANVAS_H - 102,
                width: 105, height: 62, fill: badgeColor,
                rx: 31, ry: 31,
                selectable: false, evented: false, customType: 'slide-num-bg'
            });
            const slideNumText = new fabric.IText(`${slideIndex + 1}/${currentSlides.length}`, {
                left: CANVAS_W - 112, top: CANVAS_H - 90,
                fontSize: 30, fontWeight: '700', fill: badgeTextColor,
                fontFamily: 'Inter', originX: 'center',
                selectable: false, evented: false, customType: 'slide-num'
            });
            slideNumBadge.set('opacity', showPagination ? 1 : 0);
            slideNumText.set('opacity', showPagination ? 1 : 0);
            targetCanvas.add(slideNumBadge);
            targetCanvas.add(slideNumText);

            // Swipe indicator — show on non-final slides only when there are multiple slides
            const isLastSlide = slideIndex === currentSlides.length - 1;
            if (currentSlides.length > 1 && !isLastSlide) {
                const swipeBg = new fabric.Rect({
                    left: 80, top: CANVAS_H - 102,
                    width: 180, height: 62, fill: 'rgba(0,0,0,0.55)',
                    rx: 31, ry: 31,
                    selectable: true, evented: true, customType: 'swipe-bg'
                });
                const swipeText = new fabric.IText('SWIPE ➔', {
                    left: 170, top: CANVAS_H - 88,
                    fontSize: 26, fontWeight: '700', fill: '#ffffff',
                    fontFamily: 'Inter', originX: 'center',
                    selectable: true, evented: true, customType: 'swipe-text'
                });
                swipeBg.set('opacity', showSwipe ? 1 : 0);
                swipeText.set('opacity', showSwipe ? 1 : 0);
                targetCanvas.add(swipeBg);
                targetCanvas.add(swipeText);
            }
        }

        // --- 6. Footer Handle (Moveable, ON/OFF toggleable) ---
        if (showHandle) {
            const footerHandle = new fabric.IText(handle, {
                left: 80, top: CANVAS_H - 80,
                fontSize: 32, fontWeight: '600',
                fill: selectedPreset === 'template-bold' ? '#ffd700' : (['template-bright-minimal', 'template-blue-border', 'template-facts-single'].includes(selectedPreset) ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'),
                fontFamily: bodyFont,
                selectable: true,
                evented: true,
                customType: 'footer-handle'
            });
            targetCanvas.add(footerHandle);
        }

        if (showNewsBreaking && !selectedPreset.startsWith('template-news-')) {
            const badgeString = document.getElementById('canvas-badge-selector')?.value || '🔴 BREAKING NEWS';
            // Adjust width based on text length roughly. '🔴 BREAKING NEWS' is 16 chars ~ 250px. 
            // 250 + (length - 16) * 12
            const estimatedWidth = 250 + Math.max(0, (badgeString.length - 16) * 12);
            
            const badgeBg = new fabric.Rect({
                left: 0, top: 0, width: estimatedWidth, height: 48,
                fill: '#dc2626', rx: 24, ry: 24,
                customType: 'news-badge-bg'
            });
            const badgeText = new fabric.IText(badgeString, {
                left: 18, top: 12,
                fontSize: 22, fontWeight: '800', fill: '#ffffff',
                fontFamily: headingFont, customType: 'news-badge-text'
            });
            const badgeGroup = new fabric.Group([badgeBg, badgeText], {
                left: 80, top: 140,
                selectable: true, evented: true, customType: 'news-badge-group'
            });
            targetCanvas.add(badgeGroup);
        }

        const canvasTheme = document.getElementById('canvas-theme-selector')?.value || 'none';
        if (canvasTheme !== 'none') {
            let tBg, tTitle, tBody, tAccent, tHeader;
            if (canvasTheme === 'theme-claude') {
                tBg = '#eceeed';
                tTitle = '#2c2c2c';
                tBody = '#4a4a4a';
                tAccent = '#d97757';
                tHeader = '#e2e4e3';
            } else if (canvasTheme === 'theme-facebook') {
                tBg = '#f0f2f5';
                tTitle = '#1c1e21';
                tBody = '#65676b';
                tAccent = '#1877f2';
                tHeader = '#ffffff';
            } else if (canvasTheme === 'theme-slate') {
                tBg = '#0f172a';
                tTitle = '#f8fafc';
                tBody = '#94a3b8';
                tAccent = '#38bdf8';
                tHeader = '#1e293b';
            }
            
            targetCanvas.backgroundColor = tBg;
            const bgPicker = document.getElementById('editor-bg-color');
            if (bgPicker) bgPicker.value = fabricColorToHex(tBg);

            targetCanvas.getObjects().forEach(obj => {
                if (obj.customType === 'title' || obj.isPlaceholder === 'title' || obj.customType === 'brand-handle') {
                    if (!slideData.titleStyle?.fill || obj.customType === 'brand-handle') obj.set('fill', tTitle);
                }
                if (obj.customType === 'body' || obj.isPlaceholder === 'body') {
                    if (!slideData.bodyStyle?.fill) obj.set('fill', tBody);
                }
                if (obj.customType === 'news-badge-bg' || obj.customType === 'news-text-badge-bg' || obj.customType === 'vertical-accent-bar' || obj.customType === 'red-line') {
                    obj.set('fill', tAccent);
                }
                if (obj.customType === 'blue-border') {
                    obj.set('stroke', tAccent);
                }
                if (obj.customType === 'header-bar') {
                    obj.set('fill', tHeader);
                }
                if (obj.customType === 'overlay' || obj.customType === 'bg-overlay') {
                    // Make the overlay solid so it completely adopts the theme background, 
                    // overriding images behind it if a solid theme is selected.
                    obj.set('fill', tBg);
                }
                if (obj.customType === 'image-placeholder-bg') {
                    obj.set('fill', canvasTheme === 'theme-slate' ? '#1e293b' : '#ffffff');
                    obj.set('stroke', tAccent);
                }
                if (obj.customType === 'image-placeholder-text') {
                    obj.set('fill', tBody);
                }
                if (obj.customType === 'news-card-bg' || obj.customType === 'news-text-card-bg' || obj.customType === 'bottom-panel') {
                    obj.set('fill', canvasTheme === 'theme-slate' ? 'rgba(30,41,59,0.85)' : 'rgba(255,255,255,0.85)');
                    obj.set('stroke', tAccent);
                }
                if (obj.customType === 'slide-num' || obj.customType === 'footer-handle' || obj.customType === 'slide-num-bg') {
                    if (obj.type === 'rect') obj.set('fill', tBg === '#0f172a' ? '#1e293b' : '#ffffff');
                    else obj.set('fill', tBody);
                }
            });
        }


        
        // --- APPLY TEMPLATE OVERRIDES ---
        const overrideStr = localStorage.getItem('loksewa_template_overrides');
        if (overrideStr) {
            try {
                const overrides = JSON.parse(overrideStr);
                const tmplOverrides = overrides[selectedPreset];
                if (tmplOverrides) {
                    targetCanvas.getObjects().forEach(obj => {
                        if (obj.customType && tmplOverrides[obj.customType]) {
                            obj.set(tmplOverrides[obj.customType]);
                        }
                    });
                    
                    if (tmplOverrides.extraObjects && tmplOverrides.extraObjects.length > 0) {
                        fabric.util.enlargeArray(tmplOverrides.extraObjects, function(enlargedObjs) {
                            enlargedObjs.forEach(function(obj) {
                                obj.set('isExtraOverride', true);
                                targetCanvas.add(obj);
                            });
                            targetCanvas.renderAll();
                        });
                    }
                }
            } catch (e) {
                console.error("Failed to parse template overrides", e);
            }
        }

        // --- APPLY SLIDE OBJECT POSITION & TRANSFORM OVERRIDES ---
        if (slideData.objectStyles) {
            targetCanvas.getObjects().forEach((obj, idx) => {
                const key = obj.customType || obj.isPlaceholder || obj.id || `obj_${idx}`;
                const savedStyle = slideData.objectStyles[key];
                if (savedStyle) {
                    obj.set({
                        left: savedStyle.left !== undefined ? savedStyle.left : obj.left,
                        top: savedStyle.top !== undefined ? savedStyle.top : obj.top,
                        scaleX: savedStyle.scaleX !== undefined ? savedStyle.scaleX : obj.scaleX,
                        scaleY: savedStyle.scaleY !== undefined ? savedStyle.scaleY : obj.scaleY,
                        angle: savedStyle.angle !== undefined ? savedStyle.angle : obj.angle,
                        originX: savedStyle.originX || obj.originX,
                        originY: savedStyle.originY || obj.originY,
                        opacity: savedStyle.opacity !== undefined ? savedStyle.opacity : obj.opacity
                    });
                    if (savedStyle.fill && obj.fill) obj.set('fill', savedStyle.fill);
                    if (savedStyle.fontSize && obj.fontSize) obj.set('fontSize', savedStyle.fontSize);
                    obj.setCoords();
                }
            });
        }

        // --- DYNAMIC OVERLAP PREVENTION (Heading vs Body) ---
        const titleObj = targetCanvas.getObjects().find(o => o.customType === 'title' || o.isPlaceholder === 'title');
        const bodyObj = targetCanvas.getObjects().find(o => o.customType === 'body' || o.isPlaceholder === 'body');

        if (titleObj && bodyObj) {
            const minBodyTop = titleObj.top + titleObj.getScaledHeight() + 30;
            if (bodyObj.top < minBodyTop) {
                bodyObj.set('top', minBodyTop);
                bodyObj.setCoords();
            }
        }

        targetCanvas.renderAll();
        saveCanvasHistory();
        if (slideRenderVersion === myRenderVersion) isRenderingSlide = false;
    };

    // Set background image if available — with timeout fallback for slow Pollinations requests
    if (imageUrl && !isCTA) {
        // Add a cache-bust seed to force Pollinations to generate a new unique image per slide
        let loadUrl = imageUrl;
        if (loadUrl.includes('image.pollinations.ai') && !loadUrl.includes('&nologo')) {
            loadUrl = loadUrl + '&nologo=true';
        }

        let imgLoaded = false;
        const imgTimeout = setTimeout(() => {
            if (!imgLoaded) {
                console.warn('[Slide Image] Timeout loading image for slide, rendering without bg:', loadUrl.substring(0, 60));
                addObjects();
            }
        }, 8000); // 8 second timeout before rendering without image

        fabric.Image.fromURL(loadUrl, (img) => {
            imgLoaded = true;
            clearTimeout(imgTimeout);
            if (img && img.width > 0) {
                if (selectedPreset === 'template-facts-single') {
                    const targetW = CANVAS_W - 200;
                    const targetH = 480;
                    const scale = Math.min(targetW / img.width, targetH / img.height);
                    
                    img.set({
                        originX: 'center',
                        originY: 'center',
                        left: CANVAS_W / 2, 
                        top: 420 + targetH / 2,
                        scaleX: scale, scaleY: scale,
                        selectable: true,
                        evented: true,
                        customType: 'facts-image',
                        opacity: 1
                    });
                    img.setShadow({
                        color: 'rgba(0,0,0,0.15)',
                        blur: 20,
                        offsetX: 0,
                        offsetY: 10
                    });
                    targetCanvas.add(img);
                } else if (selectedPreset === 'template-news-single-image') {
                    // Use saved image style if available, otherwise default placeholder style
                    let currentY = 160;
                    if (document.getElementById('toggle-news-breaking')?.checked && !slideData.hideNewsBreaking) {
                        currentY += 70;
                    }
                    const phStyle = slideData.imageStyle || {
                        left: 80, top: currentY, width: CANVAS_W - 160, height: 400,
                        scaleX: 1, scaleY: 1
                    };
                    
                    // We need to scale the image to fill the placeholder area
                    const targetW = phStyle.width * (phStyle.scaleX || 1);
                    const targetH = phStyle.height * (phStyle.scaleY || 1);
                    const scale = Math.max(targetW / img.width, targetH / img.height);
                    
                    img.set({
                        left: phStyle.left, top: phStyle.top,
                        scaleX: scale, scaleY: scale,
                        selectable: true, evented: true,
                        customType: 'single-image',
                        clipPath: new fabric.Rect({
                            left: -img.width / 2, top: -img.height / 2,
                            width: img.width, height: img.height,
                            rx: 16 / scale, ry: 16 / scale,
                            originX: 'center', originY: 'center'
                        })
                    });
                    
                    targetCanvas.add(img);
                    targetCanvas.sendToBack(img);
                } else {
                    const scaleX = CANVAS_W / img.width;
                    const scaleY = CANVAS_H / img.height;
                    const scale = Math.max(scaleX, scaleY);
                    img.set({
                        left: 0, top: 0,
                        scaleX: scale, scaleY: scale,
                        selectable: true,
                        evented: true,
                        customType: 'background-image',
                        opacity: 1
                    });
                    targetCanvas.add(img);
                    targetCanvas.sendToBack(img);
                }
            }
            addObjects();
        }, { crossOrigin: 'anonymous' });

    } else {
        addObjects();
    }
}

// Format controls wire-up
document.getElementById('fmt-font-size')?.addEventListener('input', (e) => {
    const obj = fabricCanvas?.getActiveObject();
    if (obj && obj.set) { obj.set('fontSize', parseInt(e.target.value)); fabricCanvas.renderAll(); }
});

document.getElementById('canvas-aspect-selector')?.addEventListener('change', (e) => {
    if (window.setCanvasAspectRatio) {
        window.setCanvasAspectRatio(e.target.value);
        if (window.updateSlidePreview) window.updateSlidePreview();
    }
});

document.getElementById('fmt-color')?.addEventListener('input', (e) => {
    const obj = fabricCanvas?.getActiveObject();
    if (obj && obj.set) { obj.set('fill', e.target.value); fabricCanvas.renderAll(); }
});

document.querySelectorAll('.fmt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const obj = fabricCanvas?.getActiveObject();
        if (!obj) return;
        const fmt = btn.getAttribute('data-fmt');
        if (fmt === 'bold') obj.set('fontWeight', obj.fontWeight === 'bold' || obj.fontWeight === '700' ? '400' : 'bold');
        if (fmt === 'italic') obj.set('fontStyle', obj.fontStyle === 'italic' ? 'normal' : 'italic');
        if (fmt === 'align-left') obj.set('textAlign', 'left');
        if (fmt === 'align-center') obj.set('textAlign', 'center');
        fabricCanvas?.renderAll();
    });
});
document.getElementById('editor-bg-color')?.addEventListener('input', (e) => {
    if (!fabricCanvas) return;
    fabricCanvas.backgroundColor = e.target.value;
    fabricCanvas.renderAll();
});
document.getElementById('editor-bg-color')?.addEventListener('change', () => { if (fabricCanvas) saveCanvasState(); });

document.getElementById('editor-font-color')?.addEventListener('input', (e) => {
    if (!fabricCanvas) return;
    const obj = fabricCanvas.getActiveObject();
    if (obj && obj.set) { 
        obj.set('fill', e.target.value); 
        fabricCanvas.renderAll(); 
    }
});
document.getElementById('editor-font-color')?.addEventListener('change', () => { if (fabricCanvas) saveCanvasState(); });

document.getElementById('canvas-delete')?.addEventListener('click', () => {
    if (!fabricCanvas) return;
    const objs = fabricCanvas.getActiveObjects();
    if (objs.length > 0) {
        objs.forEach(o => fabricCanvas.remove(o));
        fabricCanvas.discardActiveObject();
        fabricCanvas.renderAll();
        saveCanvasState();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!fabricCanvas) return;
        const obj = fabricCanvas.getActiveObject();
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
        if (obj && obj.isEditing) return;

        if (obj) {
            const objs = fabricCanvas.getActiveObjects();
            objs.forEach(o => fabricCanvas.remove(o));
            fabricCanvas.discardActiveObject();
            fabricCanvas.renderAll();
            saveCanvasState();
            e.preventDefault();
        }
    }
});
document.getElementById('canvas-undo')?.addEventListener('click', () => {
    if (!fabricCanvas || canvasHistoryPointer <= 0) return;
    canvasHistoryPointer--;
    fabricCanvas.loadFromJSON(canvasHistory[canvasHistoryPointer], () => fabricCanvas.renderAll());
});

document.getElementById('canvas-redo')?.addEventListener('click', () => {
    if (!fabricCanvas || canvasHistoryPointer >= canvasHistory.length - 1) return;
    canvasHistoryPointer++;
    fabricCanvas.loadFromJSON(canvasHistory[canvasHistoryPointer], () => fabricCanvas.renderAll());
});

// ============================================================
// 3a. CAPTION RENDERING
// ============================================================
function renderCaption(caption) {
    if (!caption) return;

    let capObj = caption;
    if (typeof capObj === 'string') {
        try {
            if (capObj.trim().startsWith('{')) {
                capObj = JSON.parse(capObj);
            }
        } catch(e) {}
    }

    const hookEl = document.getElementById('caption-hook');
    const bodyEl = document.getElementById('caption-body');
    const ctaEl = document.getElementById('caption-cta');
    const nicheEl = document.getElementById('hashtags-niche');
    const broadEl = document.getElementById('hashtags-broad');
    const highIntentEl = document.getElementById('hashtags-high-intent');
    const fallbackEl = document.getElementById('caption-text-fallback');
    const structuredSections = ['caption-hook-section', 'caption-body-section', 'caption-cta-section', 'caption-hashtags-section'];

    const renderHashtags = (el, tags) => {
        if (!el) return;
        el.innerHTML = '';
        if (!tags) return;
        const arr = Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(/\s+/) : []);
        arr.filter(Boolean).forEach(tag => {
            const cleanTag = tag.startsWith('#') ? tag : `#${tag}`;
            const pill = document.createElement('span');
            pill.className = 'hashtag-pill';
            pill.textContent = cleanTag;
            pill.addEventListener('click', () => window.copyToClipboard(cleanTag));
            el.appendChild(pill);
        });
    };

    if (typeof capObj === 'object' && capObj !== null) {
        structuredSections.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ''; });
        if (fallbackEl) fallbackEl.style.display = 'none';

        if (hookEl) hookEl.innerText = capObj.hook || capObj.title || '';
        if (bodyEl) bodyEl.innerText = capObj.body || capObj.content || capObj.text || '';
        if (ctaEl) ctaEl.innerText = capObj.cta || 'Save this post for later!';

        const hashtags = capObj.hashtags || [];
        let nicheTags = [];
        let broadTags = [];
        let highIntentTags = [];

        if (Array.isArray(hashtags)) {
            nicheTags = hashtags;
        } else if (typeof hashtags === 'string') {
            nicheTags = hashtags.split(/\s+/).filter(t => t.length > 0);
        } else {
            nicheTags = Array.isArray(hashtags.niche) ? hashtags.niche : [];
            broadTags = Array.isArray(hashtags.broad) ? hashtags.broad : [];
            highIntentTags = Array.isArray(hashtags.high_intent) ? hashtags.high_intent : [];
        }

        renderHashtags(nicheEl, nicheTags);
        renderHashtags(broadEl, broadTags);
        renderHashtags(highIntentEl, highIntentTags);
    } else if (typeof capObj === 'string') {
        const lines = capObj.split('\n').map(l => l.trim()).filter(Boolean);
        const tags = lines.filter(l => l.includes('#')).join(' ').split(/\s+/).filter(t => t.startsWith('#'));
        const nonTags = lines.filter(l => !l.includes('#'));

        structuredSections.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ''; });
        if (fallbackEl) fallbackEl.style.display = 'none';

        if (hookEl) hookEl.innerText = nonTags[0] || '';
        if (bodyEl) bodyEl.innerText = nonTags.slice(1, -1).join('\n\n') || nonTags[1] || '';
        if (ctaEl) ctaEl.innerText = nonTags.length > 2 ? nonTags[nonTags.length - 1] : 'Save this post!';

        renderHashtags(nicheEl, tags.length > 0 ? tags : ['#loksewaprep', '#nepalgk', '#growuploksewa']);
        renderHashtags(broadEl, []);
        renderHashtags(highIntentEl, []);
    }
}

window.copyToClipboard = async function(text) {
    if (!text) return false;
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch(e) {}
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        return successful;
    } catch(err) {
        console.error('Clipboard copy failed:', err);
        return false;
    }
};

function getCaptionText() {
    const fallbackEl = document.getElementById('caption-text-fallback');
    if (fallbackEl && fallbackEl.style.display !== 'none') return fallbackEl.value;
    const hook = document.getElementById('caption-hook')?.innerText || '';
    const body = document.getElementById('caption-body')?.innerText || '';
    const cta = document.getElementById('caption-cta')?.innerText || '';
    const nicheEl = document.getElementById('hashtags-niche');
    const broadEl = document.getElementById('hashtags-broad');
    const hiEl = document.getElementById('hashtags-high-intent');
    const allTags = [
        ...(nicheEl ? Array.from(nicheEl.querySelectorAll('.hashtag-pill')).map(p => p.textContent) : []),
        ...(broadEl ? Array.from(broadEl.querySelectorAll('.hashtag-pill')).map(p => p.textContent) : []),
        ...(hiEl ? Array.from(hiEl.querySelectorAll('.hashtag-pill')).map(p => p.textContent) : [])
    ];
    return [hook, body, cta, allTags.join(' ')].filter(Boolean).join('\n\n');
}

document.getElementById('copy-caption')?.addEventListener('click', async () => {
    const text = getCaptionText();
    const success = await window.copyToClipboard(text);
    const btn = document.getElementById('copy-caption');
    if (success && btn) {
        btn.innerHTML = '<i data-feather="check"></i> Copied!';
        if (window.feather) feather.replace();
        showToast('Caption copied to clipboard!');
        setTimeout(() => { btn.innerHTML = '<i data-feather="copy"></i> Copy Full Caption'; if (window.feather) feather.replace(); }, 2000);
    } else {
        showToast(success ? 'Caption copied!' : 'Failed to copy caption', success ? 'info' : 'error');
    }
});

// ============================================================
// 3b. EDITOR — Open & Render
// ============================================================
window.openEditor = async (idOrPost) => {
    console.log("openEditor:", idOrPost);
    let post = null;
    let id = null;
    if (typeof idOrPost === 'object' && idOrPost && idOrPost.id) {
        post = idOrPost;
        id = post.id;
    } else {
        id = idOrPost;
        let posts = await getPosts();
        post = posts.find(p => String(p.id) === String(id));
        if (!post && window.lastGeneratedPost && String(window.lastGeneratedPost.id) === String(id)) {
            post = window.lastGeneratedPost;
        }
    }
    if (!post) { console.error("Post not found:", idOrPost); return; }

    currentEditingId = id;

    // Switch to editor view
    switchView('editor-view');
    const h1 = document.querySelector('.topbar h1');
    if (h1) h1.textContent = 'Editor';

    // Parse content first to check for brand_snapshot
    const parsed = parsePostText(post.text);
    currentSlides = parsed.slides || [];
    window.currentSlides = currentSlides;
    const caption = parsed.caption || '';
    currentImageUrls = parseImageUrls(post.image_url);

    // Set brand
    const targetBrandId = post.brand_id || activeBrandId;
    let postBrand = parsed.brand_snapshot || allBrands.find(b => b.id === targetBrandId) || allBrands[0];
    if (postBrand) { 
        currentBranding = postBrand; 
        activeBrandId = postBrand.id;
        updateBrandVisuals(currentBranding); 
        const canvasBrandSel = document.getElementById('canvas-brand-selector');
        if (canvasBrandSel) canvasBrandSel.value = postBrand.id;
    }

    // Set UI
    document.getElementById('editor-topic').innerText = `Editing: ${post.topic}`;
    document.getElementById('editor-status').value = post.status;
    
    // Setup keyboard shortcuts if not already set
    if (!window.fabricShortcutsBound) {
        window.fabricShortcutsBound = true;
        document.addEventListener('keydown', (e) => {
            if (!fabricCanvas) return;
            const activeObj = fabricCanvas.getActiveObject();
            if (!activeObj || !activeObj.isEditing && !activeObj.text) return;
            
            // Check if we are focusing on an input field outside canvas
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl.id !== 'custom-ai-image-prompt' && !activeEl.classList.contains('upper-canvas')) {
                return; 
            }

            if (e.metaKey || e.ctrlKey) {
                let updated = false;
                if (e.key === 'b') {
                    e.preventDefault();
                    const isBold = activeObj.fontWeight === 'bold' || activeObj.fontWeight >= 700;
                    activeObj.set('fontWeight', isBold ? 'normal' : 'bold');
                    updated = true;
                } else if (e.key === 'i') {
                    e.preventDefault();
                    const isItalic = activeObj.fontStyle === 'italic';
                    activeObj.set('fontStyle', isItalic ? 'normal' : 'italic');
                    updated = true;
                } else if (e.key === 'u') {
                    e.preventDefault();
                    const isUnderlined = activeObj.underline;
                    activeObj.set('underline', !isUnderlined);
                    updated = true;
                } else if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    activeObj.set('fontSize', (activeObj.fontSize || 40) + 2);
                    updated = true;
                } else if (e.key === '-') {
                    e.preventDefault();
                    activeObj.set('fontSize', Math.max(10, (activeObj.fontSize || 40) - 2));
                    updated = true;
                }
                
                if (updated) {
                    fabricCanvas.requestRenderAll();
                    syncFabricCanvasToCurrentSlide();
                    saveCanvasHistory();
                }
            }
        });
    }

    const templateSel = document.getElementById('template-selector');
    if (templateSel) {
        if (post.topic && (post.topic.includes('[Psychology') || post.topic.includes('[LabEngine'))) {
            templateSel.value = 'template-psych-dark';
        } else if (post.topic && post.topic.includes('[Facts')) {
            templateSel.value = 'template-facts-single';
        } else {
            templateSel.value = currentBranding.themePreset || 'template-classic';
        }
    }

    // Init Fabric canvas
    initFabricCanvas();

    // Render forms
    currentSlideIndex = 0;
    renderSlidesForm();
    updateSlidePreview();
    renderCaption(caption);

    // Update image preview in sidebar
    updateSidebarImagePreview(0);

    // Show CTA badge on last slide
    updateCTABadge();

    loadSavedTemplatesSelector();

    if (window.feather) feather.replace();
};

function updateCTABadge() {
    const badge = document.getElementById('slide-form-cta-badge');
    if (!badge) return;
    const isCTA = currentSlides[currentSlideIndex]?.is_cta === true || currentSlideIndex === currentSlides.length - 1;
    badge.style.display = isCTA ? 'inline-block' : 'none';
}

function updateSidebarImagePreview(slideIndex) {
    const imgEl = document.getElementById('editor-image');
    const url = currentImageUrls[slideIndex];
    if (imgEl) { imgEl.src = url || 'https://via.placeholder.com/400x500?text=No+Image'; }
    const noteEl = document.getElementById('slide-image-note');
    if (noteEl) noteEl.textContent = url ? `Slide ${slideIndex + 1} background image. Click above to replace.` : `Slide ${slideIndex + 1} has no image. Upload one above.`;
}

function updateSlidePreview() {
    if (!currentSlides.length) return;
    const slide = currentSlides[currentSlideIndex];
    const imageUrl = currentImageUrls[currentSlideIndex] || null;
    renderFabricSlide(slide, currentSlideIndex, imageUrl, currentBranding);
    document.getElementById('current-slide-indicator').innerText = `Slide ${currentSlideIndex + 1} / ${currentSlides.length}`;
    updateSidebarImagePreview(currentSlideIndex);
    updateCTABadge();
}
window.updateSlidePreview = updateSlidePreview;
window.renderSlidesForm = renderSlidesForm;

window.addNewSlide = (targetIndex = null) => {
    syncFabricCanvasToCurrentSlide();
    const insertIdx = (targetIndex !== null && targetIndex >= 0) ? targetIndex : currentSlides.length;
    const newSlide = {
        title: `Slide ${insertIdx + 1}`,
        content: 'Enter your content or key takeaway here...'
    };
    currentSlides.splice(insertIdx, 0, newSlide);
    currentImageUrls.splice(insertIdx, 0, null);
    currentSlideIndex = insertIdx;
    renderSlidesForm();
    updateSlidePreview();
    updateSidebarImagePreview(currentSlideIndex);
    updateCTABadge();
    showToast(`Slide ${insertIdx + 1} added!`);
};

window.duplicateSlide = (index) => {
    syncFabricCanvasToCurrentSlide();
    if (!currentSlides[index]) return;
    const clone = JSON.parse(JSON.stringify(currentSlides[index]));
    clone.title = (clone.title || '') + ' (Copy)';
    const targetIdx = index + 1;
    currentSlides.splice(targetIdx, 0, clone);
    currentImageUrls.splice(targetIdx, 0, currentImageUrls[index] || null);
    currentSlideIndex = targetIdx;
    renderSlidesForm();
    updateSlidePreview();
    updateSidebarImagePreview(currentSlideIndex);
    updateCTABadge();
    showToast(`Slide ${index + 1} duplicated!`);
};

window.deleteSlide = (index) => {
    if (currentSlides.length <= 1) {
        alert('A post must have at least 1 slide.');
        return;
    }
    syncFabricCanvasToCurrentSlide();
    currentSlides.splice(index, 1);
    currentImageUrls.splice(index, 1);
    if (currentSlideIndex >= currentSlides.length) {
        currentSlideIndex = currentSlides.length - 1;
    }
    renderSlidesForm();
    updateSlidePreview();
    updateSidebarImagePreview(currentSlideIndex);
    updateCTABadge();
    showToast(`Slide deleted.`);
};

document.getElementById('add-new-slide-btn')?.addEventListener('click', () => {
    window.addNewSlide();
});

function renderSlidesForm() {
    const container = document.getElementById('slides-form-container');
    container.innerHTML = '';
    currentSlides.forEach((slide, index) => {
        const isCTA = slide.is_cta === true || index === currentSlides.length - 1;
        const div = document.createElement('div');
        div.style.cssText = `margin-bottom:12px;padding:14px;border:1px solid ${index===currentSlideIndex?'#0969da':'#d0d7de'};border-radius:8px;background:${index===currentSlideIndex?'#f0f6ff':'#fff'};cursor:pointer;`;
        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <h4 style="font-size:13px;font-weight:700;color:#656d76;margin:0;">Slide ${index + 1}${isCTA?'<span style="font-size:10px;background:#10b981;color:#fff;padding:1px 7px;border-radius:20px;margin-left:8px;font-weight:600;">CTA</span>':''}</h4>
                <div style="display:flex;gap:6px;align-items:center;">
                    <button onclick="window.jumpToSlide(${index})" style="background:none;border:none;cursor:pointer;color:#0969da;font-size:12px;font-weight:600;" title="Preview slide">▶ Preview</button>
                    <button onclick="window.duplicateSlide(${index})" style="background:none;border:none;cursor:pointer;color:#6e40c9;font-size:12px;font-weight:600;" title="Duplicate slide">📋 Copy</button>
                    ${currentSlides.length > 1 ? `<button onclick="window.deleteSlide(${index})" style="background:none;border:none;cursor:pointer;color:var(--color-danger-fg);font-size:12px;font-weight:600;" title="Delete slide">🗑️ Delete</button>` : ''}
                    <button onclick="window.downloadSingleSlide(${index})" style="background:none;border:none;cursor:pointer;color:#10b981;font-size:12px;font-weight:600;" title="Download PNG for this slide">📥 PNG</button>
                </div>
            </div>
            <input type="text" id="slide-title-${index}" class="full-width" style="margin-bottom:8px;padding:5px 10px;border:1px solid #d0d7de;border-radius:5px;font-size:13px;" value="${(slide.title||'').replace(/"/g, '&quot;')}" oninput="window.updateSlideData(${index},'title',this.value)">
            <textarea id="slide-content-${index}" class="rich-textarea" style="min-height:80px;font-size:13px;" oninput="window.updateSlideData(${index},'content',this.value)">${slide.content||''}</textarea>
        `;
        div.addEventListener('click', (e) => { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') window.jumpToSlide(index); });
        container.appendChild(div);
    });
    if (window.feather) feather.replace();
}

window.saveCurrentSlideAndPost = async function(silent = false) {
    if (fabricCanvas) {
        const activeObj = fabricCanvas.getActiveObject();
        if (activeObj && activeObj.isEditing) {
            activeObj.exitEditing();
        }
        if (!isRenderingSlide) {
            syncFabricCanvasToCurrentSlide();
        }
    }

    const updatedStatus = document.getElementById('editor-status')?.value || 'Draft';
    const updatedText = JSON.stringify({ slides: currentSlides, caption: typeof getCaptionText === 'function' ? getCaptionText() : '' });
    const updatedImageUrl = JSON.stringify(currentImageUrls);

    if (window.lastGeneratedPost && String(window.lastGeneratedPost.id) === String(currentEditingId)) {
        window.lastGeneratedPost.text = updatedText;
        window.lastGeneratedPost.status = updatedStatus;
        window.lastGeneratedPost.image_url = updatedImageUrl;
    }

    if (isMockMode) {
        const i = mockPosts.findIndex(p => p.id === currentEditingId);
        if (i > -1) {
            mockPosts[i].text = updatedText;
            mockPosts[i].status = updatedStatus;
            mockPosts[i].image_url = updatedImageUrl;
            mockPosts[i].updated_at = new Date().toISOString();
            saveMockPosts();
        }
        if (!silent) showToast('💾 Slide changes saved!');
        return;
    }

    if (!currentEditingId) {
        if (!silent) showToast('No post selected for saving.', 'error');
        return;
    }

    const { error } = await supabase
        .from('posts')
        .update({ text: updatedText, status: updatedStatus, image_url: updatedImageUrl })
        .eq('id', currentEditingId);

    if (error) {
        console.error('[Save] Supabase error:', error);
        if (!silent) showToast('Error saving: ' + error.message, 'error');
    } else {
        if (!silent) showToast('💾 Slide changes saved!');
    }
};

window.jumpToSlide = async (index) => {
    await window.saveCurrentSlideAndPost(true);
    currentSlideIndex = index;
    renderSlidesForm();
    updateSlidePreview();
    updateSidebarImagePreview(index);
    updateCTABadge();
};

window.updateSlideData = (index, field, value) => {
    if (!currentSlides[index]) return;
    currentSlides[index][field] = value;
    if (index === currentSlideIndex) {
        updateSlidePreview();
    }
};

// Prev/Next Slide
document.getElementById('prev-slide')?.addEventListener('click', async () => {
    if (currentSlideIndex > 0) {
        await window.saveCurrentSlideAndPost(true);
        currentSlideIndex--;
        renderSlidesForm();
        updateSlidePreview();
        updateSidebarImagePreview(currentSlideIndex);
        updateCTABadge();
    }
});
document.getElementById('next-slide')?.addEventListener('click', async () => {
    if (currentSlideIndex < currentSlides.length - 1) {
        await window.saveCurrentSlideAndPost(true);
        currentSlideIndex++;
        renderSlidesForm();
        updateSlidePreview();
        updateSidebarImagePreview(currentSlideIndex);
        updateCTABadge();
    }
});

document.getElementById('editor-top-save-btn')?.addEventListener('click', () => window.saveCurrentSlideAndPost(false));
document.getElementById('editor-quick-save-btn')?.addEventListener('click', () => window.saveCurrentSlideAndPost(false));

document.getElementById('toggle-brand-logo')?.addEventListener('change', () => updateSlidePreview());
document.getElementById('toggle-brand-handle')?.addEventListener('change', () => updateSlidePreview());
document.getElementById('toggle-brand-header-asset')?.addEventListener('change', () => updateSlidePreview());
document.getElementById('toggle-slide-numbers')?.addEventListener('change', () => updateSlidePreview());
document.getElementById('toggle-swipe-indicator')?.addEventListener('change', () => updateSlidePreview());
document.getElementById('toggle-news-breaking')?.addEventListener('change', (e) => {
    const selector = document.getElementById('canvas-badge-selector');
    if (selector) {
        selector.style.display = e.target.checked ? 'inline-block' : 'none';
    }
    updateSlidePreview();
});
document.getElementById('canvas-badge-selector')?.addEventListener('change', () => updateSlidePreview());
document.getElementById('canvas-theme-selector')?.addEventListener('change', () => { updateSlidePreview(); if (fabricCanvas) saveCanvasState(); });

document.getElementById('toggle-brand-logo-tb')?.addEventListener('change', (e) => {
    const el = document.getElementById('toggle-brand-logo'); if (el) el.checked = e.target.checked;
    updateSlidePreview();
});
document.getElementById('toggle-brand-handle-tb')?.addEventListener('change', (e) => {
    const el = document.getElementById('toggle-brand-handle'); if (el) el.checked = e.target.checked;
    updateSlidePreview();
});
document.getElementById('toggle-slide-numbers-tb')?.addEventListener('change', (e) => {
    const el = document.getElementById('toggle-slide-numbers'); if (el) el.checked = e.target.checked;
    updateSlidePreview();
});

document.getElementById('back-to-queue')?.addEventListener('click', () => {
    document.querySelector('[data-target="queue-view"]')?.click();
});

// ============================================================
// 3c. IMAGE UPLOAD (per-slide)
// ============================================================
document.getElementById('image-upload')?.addEventListener('change', function(e) {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (!file.type.match('image.*')) { alert("Not an image file."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        // Replace only current slide's image
        currentImageUrls[currentSlideIndex] = dataUrl;
        document.getElementById('editor-image').src = dataUrl;
        updateSlidePreview();
    };
    reader.readAsDataURL(file);
});

// ============================================================
// 3d. DOWNLOAD
// ============================================================
async function downloadSlidesAsFabric() {
    const btn = document.getElementById('download-slides');
    btn.innerHTML = '<i data-feather="loader" class="spin"></i> Preparing...';
    if (window.feather) feather.replace();

    const originalIndex = currentSlideIndex;
    const isZipSupported = typeof JSZip !== 'undefined';
    const zip = isZipSupported ? new JSZip() : null;

    for (let i = 0; i < currentSlides.length; i++) {
        currentSlideIndex = i;
        await new Promise(resolve => {
            const slide = currentSlides[i];
            const imageUrl = currentImageUrls[i] || null;
            renderFabricSlide(slide, i, imageUrl, currentBranding);
            setTimeout(async () => {
                if (!fabricCanvas) { resolve(); return; }
                const dataURL = fabricCanvas.toDataURL({ format: 'png', multiplier: 1 / CANVAS_ZOOM });
                if (zip) {
                    const base64Data = dataURL.replace(/^data:image\/png;base64,/, "");
                    zip.file(getSuggestiveFilename(i), base64Data, { base64: true });
                } else {
                    await triggerFileDownload(dataURL, getSuggestiveFilename(i));
                }
                resolve();
            }, 600);
        });
        await new Promise(r => setTimeout(r, 200));
    }

    if (zip) {
        btn.innerHTML = '<i data-feather="loader" class="spin"></i> Zipping...';
        if (window.feather) feather.replace();
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const topicName = getSuggestiveFilename(0).replace('_slide1.png', '').replace('.png', '');
        await triggerFileDownload(zipBlob, `${topicName}_all_slides.zip`);
    }

    currentSlideIndex = originalIndex;
    updateSlidePreview();
    btn.innerHTML = '<i data-feather="download"></i> Download';
    if (window.feather) feather.replace();
}

document.getElementById('download-slides')?.addEventListener('click', downloadSlidesAsFabric);

function getSuggestiveFilename(slideIndex) {
    const topicEl = document.getElementById('editor-topic');
    let rawTopic = topicEl ? topicEl.innerText.replace('Editing:', '').replace('[Facts Lab]', '').replace('[News Lab]', '').trim() : 'post';
    let cleanTopic = rawTopic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 24);

    const d = new Date();
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const slideNum = (slideIndex !== undefined && slideIndex !== null) ? `_slide${slideIndex + 1}` : '';

    return `${cleanTopic || 'carousel'}_${dateStr}${slideNum}.png`;
}

async function triggerFileDownload(dataOrBlob, filename) {
    let blob;
    if (dataOrBlob instanceof Blob) {
        blob = dataOrBlob;
    } else if (typeof dataOrBlob === 'string' && dataOrBlob.startsWith('data:')) {
        const res = await fetch(dataOrBlob);
        blob = await res.blob();
    }

    const isZip = filename.endsWith('.zip');

    if (!isZip && 'showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{
                    description: 'PNG Image',
                    accept: { 'image/png': ['.png'] }
                }]
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            showToast(`Saved ${filename}`);
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.warn('showSaveFilePicker error:', err);
        }
    }

    const blobUrl = blob ? URL.createObjectURL(blob) : dataOrBlob;
    const link = document.createElement('a');
    link.download = filename;
    link.href = blobUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
        if (blob && blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
    }, 2000);

    showToast(`Downloaded ${filename}`);
}

window.downloadSingleSlide = async function(index) {
    const targetIdx = (index !== undefined && index !== null) ? index : currentSlideIndex;
    if (!fabricCanvas) return;

    syncFabricCanvasToCurrentSlide();
    const originalIndex = currentSlideIndex;
    
    // If downloading current slide, directly export
    if (targetIdx === currentSlideIndex) {
        const dataURL = fabricCanvas.toDataURL({ format: 'png', multiplier: 1 / CANVAS_ZOOM });
        await triggerFileDownload(dataURL, getSuggestiveFilename(targetIdx));
        return;
    }

    // If downloading a different slide, render temporarily then export
    currentSlideIndex = targetIdx;
    const slide = currentSlides[targetIdx];
    const imageUrl = currentImageUrls[targetIdx] || null;
    renderFabricSlide(slide, targetIdx, imageUrl, currentBranding);

    setTimeout(async () => {
        const dataURL = fabricCanvas.toDataURL({ format: 'png', multiplier: 1 / CANVAS_ZOOM });
        await triggerFileDownload(dataURL, getSuggestiveFilename(targetIdx));

        // Restore view
        currentSlideIndex = originalIndex;
        updateSlidePreview();
    }, 400);
};

document.getElementById('download-current-slide')?.addEventListener('click', () => {
    window.downloadSingleSlide(currentSlideIndex);
});

// ============================================================
// 3e. SAVE POST
// ============================================================
document.getElementById('save-post')?.addEventListener('click', async () => {
    // Sync canvas position/style overrides — but only if canvas render is complete
    // Text edits are already captured in currentSlides via updateSlideData
    if (!isRenderingSlide) {
        syncFabricCanvasToCurrentSlide();
    }

    const updatedStatus = document.getElementById('editor-status').value;
    const updatedText = JSON.stringify({ slides: currentSlides, caption: getCaptionText() });
    const updatedImageUrl = JSON.stringify(currentImageUrls);

    console.log('[Save] Saving slides:', currentSlides.length, 'currentEditingId:', currentEditingId, 'isMockMode:', isMockMode);

    const btn = document.getElementById('save-post');
    const originalHTML = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-feather="loader" class="spin"></i> Saving...'; if (window.feather) feather.replace(); }

    if (isMockMode) {
        const i = mockPosts.findIndex(p => p.id === currentEditingId);
        if (i > -1) {
            mockPosts[i].text = updatedText;
            mockPosts[i].status = updatedStatus;
            mockPosts[i].image_url = updatedImageUrl;
            mockPosts[i].updated_at = new Date().toISOString();
            saveMockPosts();
        }
        showToast('✓ Saved!');
        if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; if (window.feather) feather.replace(); }
        return;
    }

    if (!currentEditingId) {
        showToast('Error: No post selected for saving.', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; if (window.feather) feather.replace(); }
        return;
    }

    const { error } = await supabase
        .from('posts')
        .update({ text: updatedText, status: updatedStatus, image_url: updatedImageUrl })
        .eq('id', currentEditingId);

    if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; if (window.feather) feather.replace(); }

    if (error) {
        console.error('[Save] Supabase error:', error);
        showToast('Error saving: ' + error.message, 'error');
    } else {
        console.log('[Save] ✓ Saved to Supabase, id:', currentEditingId);
        showToast('✓ Saved successfully!');
    }
});

// ============================================================
// 3f. PUBLISH
// ============================================================
async function executePublish(platformUrl) {
    await downloadSlidesAsFabric();
    const text = getCaptionText();
    try { await navigator.clipboard.writeText(text); } catch {}
    if (currentEditingId) {
        document.getElementById('editor-status').value = 'Published';
        const updatedText = JSON.stringify({ slides: currentSlides, caption: text });
        if (isMockMode) {
            const i = mockPosts.findIndex(p => p.id === currentEditingId);
            if (i > -1) { mockPosts[i].text = updatedText; mockPosts[i].status = 'Published'; mockPosts[i].updated_at = new Date().toISOString(); saveMockPosts(); }
        } else {
            await supabase.from('posts').update({ text: updatedText, status: 'Published', image_url: JSON.stringify(currentImageUrls) }).eq('id', currentEditingId);
        }
    }
    if (platformUrl) window.open(platformUrl, '_blank');
    else alert("Platform URL not set in Brand Identity.");
    document.querySelector('[data-target="queue-view"]')?.click();
}

document.getElementById('publish-facebook')?.addEventListener('click', () => executePublish(currentBranding.facebookUrl));
document.getElementById('publish-instagram')?.addEventListener('click', () => executePublish(currentBranding.instagramUrl));
document.getElementById('publish-tiktok')?.addEventListener('click', () => executePublish(currentBranding.tiktokUrl));
document.getElementById('publish-linkedin')?.addEventListener('click', () => executePublish(currentBranding.linkedinUrl));

// ============================================================
// 3g. REFINE
// ============================================================
document.getElementById('refine-post')?.addEventListener('click', async () => {
    const note = prompt("Enter instructions for refining this content:");
    if (!note) return;
    const btn = document.getElementById('refine-post');
    btn.innerHTML = '<i data-feather="loader" class="spin"></i> Refining...';
    btn.disabled = true;
    if (window.feather) feather.replace();
    try {
        const topic = document.getElementById('editor-topic').innerText.replace('Editing: ', '');
        const currentText = JSON.stringify({ slides: currentSlides, caption: getCaptionText() });
        const response = await fetch(CONFIG.N8N_MANUAL_WEBHOOK_URL.replace('/generate', '/refine'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, currentText, note, brand_context: getBrandContext() })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to refine");
        const parsed = parsePostText(data.text);
        currentSlides = parsed.slides || currentSlides;
        renderSlidesForm();
        updateSlidePreview();
        renderCaption(parsed.caption);
        showToast('Refined successfully! Review and save when ready.');
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    } finally {
        btn.innerHTML = '<i data-feather="edit-2"></i> Reject & Refine';
        btn.disabled = false;
        if (window.feather) feather.replace();
    }
});

// Template selector in editor
document.getElementById('template-selector')?.addEventListener('change', () => updateSlidePreview());

// Apply saved template in editor
document.getElementById('apply-saved-template')?.addEventListener('click', () => {
    const sel = document.getElementById('saved-template-selector');
    if (!sel || !sel.value) return;
    const templates = JSON.parse(localStorage.getItem('cd_templates') || '[]');
    const template = templates.find(t => t.name === sel.value);
    if (!template || !fabricCanvas) return;
    fabricCanvas.loadFromJSON(template.canvasJson, () => {
        // Inject current slide data into placeholder objects
        fabricCanvas.getObjects().forEach(obj => {
            if (obj.isPlaceholder === 'title' && currentSlides[currentSlideIndex]) obj.set('text', currentSlides[currentSlideIndex].title || '');
            if (obj.isPlaceholder === 'body' && currentSlides[currentSlideIndex]) obj.set('text', currentSlides[currentSlideIndex].content || '');
            if (obj.isPlaceholder === 'brand-name') obj.set('text', currentBranding.name || '');
        });
        fabricCanvas.renderAll();
        showToast(`Template "${sel.value}" applied!`);
    });
});

// ============================================================
// 4. MANUAL CONTENT LAB
// ============================================================
let isGeneratingManual = false;
document.getElementById('trigger-manual')?.addEventListener('click', async () => {
    if (isGeneratingManual) return;
    isGeneratingManual = true;

    const topic = document.getElementById('manual-topic').value.trim();
    const contentType = document.getElementById('manual-content-type').value;
    const brandId = document.getElementById('manual-brand').value;
    const feedback = document.getElementById('manual-feedback');
    if (!topic) { feedback.innerText = "Please enter a topic."; feedback.style.color = "var(--color-danger-fg)"; isGeneratingManual = false; return; }

    const btn = document.getElementById('trigger-manual');
    const overlay = document.getElementById('manual-loading-overlay');
    btn.style.display = 'none';
    feedback.style.display = 'none';
    overlay.style.display = 'block';

    try {
        const activeBrand = allBrands.find(b => b.id === brandId) || currentBranding;
        const response = await fetch(`${API_URL}/generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, contentType, brand_id: brandId, promptTemplate: currentPromptTemplate, brand_context: getBrandContext(activeBrand), brand_snapshot: activeBrand })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unknown error");
        if (data.db_error && !isMockMode) { isMockMode = true; }
        const newPost = data.post || { id: Date.now().toString(), topic: `[${contentType}] ${topic}`, text: data.text, image_url: data.image_url, status: 'Draft', brand_id: brandId, updated_at: new Date().toISOString() };
        if (isMockMode && !mockPosts.find(p => p.id === newPost.id)) { mockPosts.unshift(newPost); saveMockPosts(); }
        await loadQueue();
        const postId = data.post?.id || newPost.id;
        window.openEditor(postId);
        document.getElementById('manual-topic').value = '';
    } catch (err) {
        feedback.innerText = "Error: " + err.message;
        feedback.style.color = "var(--color-danger-fg)";
        feedback.style.display = 'block';
    } finally {
        btn.style.display = 'block';
        overlay.style.display = 'none';
        isGeneratingManual = false;
    }
});

// Topic suggestions
const suggestedTopics = ["Geography of Nepal - Major Rivers", "History - The Unification of Nepal", "Constitution - Fundamental Rights", "Current Affairs - Nepal's Economic Policy 2080", "Science - Human Digestive System", "General Knowledge - First in Nepal", "Literature - Bhanubhakta Acharya", "Ecology - National Parks", "Administration - Local Government Structure", "International Relations - Nepal and the UN"];
function suggestRandomTopic() { const input = document.getElementById('manual-topic'); if (input) input.value = suggestedTopics[Math.floor(Math.random() * suggestedTopics.length)]; }
document.getElementById('refresh-topic-btn')?.addEventListener('click', suggestRandomTopic);

// ============================================================
// 5. NEWS LAB
// ============================================================
let isGeneratingNews = false;
document.getElementById('trigger-news')?.addEventListener('click', async () => {
    if (isGeneratingNews) return;
    isGeneratingNews = true;

    const topic = document.getElementById('news-topic-input')?.value.trim() || '';
    const category = document.getElementById('news-category-select')?.value || '';
    const slideCount = parseInt(document.getElementById('news-slide-format')?.value) || 4;
    const brandId = document.getElementById('news-brand').value;
    const language = document.getElementById('news-language').value;
    const contentType = document.getElementById('news-content-type').value;
    const feedback = document.getElementById('news-feedback');
    const btn = document.getElementById('trigger-news');
    const overlay = document.getElementById('news-loading-overlay');
    btn.style.display = 'none'; feedback.style.display = 'none'; overlay.style.display = 'block';
    try {
        const activeBrand = allBrands.find(b => b.id === brandId) || currentBranding;
        const response = await fetch(`${API_URL}/generate-news`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, category, slide_count: slideCount, brand_id: brandId, language, contentType, brand_context: getBrandContext(activeBrand), brand_snapshot: activeBrand })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "News generation failed");
        if (data.db_error && !isMockMode) { isMockMode = true; }
        const newPost = data.post || { id: Date.now().toString(), topic: `[News Lab] Generated`, text: data.text, image_url: data.image_url, status: 'Draft', brand_id: brandId, updated_at: new Date().toISOString() };
        if (isMockMode && !mockPosts.find(p => p.id === newPost.id)) { mockPosts.unshift(newPost); saveMockPosts(); }
        
        // Auto-select badge based on category
        const badgeSelector = document.getElementById('canvas-badge-selector');
        if (badgeSelector) {
            if (category.includes('Nepal')) badgeSelector.value = '🇳🇵 NEPAL TODAY';
            else if (category.includes('International')) badgeSelector.value = '🌍 INTERNATIONAL NEWS';
            else if (category.includes('Economy')) badgeSelector.value = '📈 GLOBAL ECONOMY';
            else if (category.includes('Technology')) badgeSelector.value = '💻 INFO & TECH';
            else if (category.includes('Health')) badgeSelector.value = '❤️ HEALTH';
            else if (category.includes('Weird') || category.includes('Interesting')) badgeSelector.value = '🤪 INTERESTING NEWS';
            else if (category.includes('Good News')) badgeSelector.value = '🌟 GOOD NEWS';
            else badgeSelector.value = '🔴 BREAKING NEWS';
        }

        await loadQueue();
        window.openEditor(data.post?.id || newPost.id);
    } catch (err) {
        feedback.innerText = "Error: " + err.message; feedback.style.color = "var(--color-danger-fg)"; feedback.style.display = 'block';
    } finally { 
        btn.style.display = 'block'; 
        overlay.style.display = 'none'; 
        isGeneratingNews = false;
    }
});

// ============================================================
// 6. FACTS LAB
// ============================================================
document.querySelectorAll('.fact-niche-preset').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('facts-topic').value = btn.getAttribute('data-niche'); });
});

let isGeneratingFacts = false;
document.getElementById('trigger-facts-single')?.addEventListener('click', async () => {
    if (isGeneratingFacts) return;
    isGeneratingFacts = true;

    const topic = document.getElementById('facts-topic').value.trim() || "Sharks are older than trees";
    const language = document.getElementById('facts-language').value;
    const brandId = document.getElementById('facts-brand').value;
    const feedback = document.getElementById('facts-feedback');
    const btnSingle = document.getElementById('trigger-facts-single');
    const btnCarousel = document.getElementById('trigger-facts');
    const overlay = document.getElementById('facts-loading-overlay');
    
    btnSingle.style.display = 'none'; btnCarousel.style.display = 'none'; feedback.style.display = 'none'; overlay.style.display = 'block';
    
    try {
        const activeBrand = allBrands.find(b => b.id === brandId) || currentBranding;
        const response = await fetch(`${API_URL}/generate-facts`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, language, slide_count: 1, brand_id: brandId, brand_context: getBrandContext(activeBrand), brand_snapshot: activeBrand })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Facts generation failed");
        if (data.db_error && !isMockMode) { isMockMode = true; }
        
        const newPost = data.post || { id: Date.now().toString(), topic: `[Single Fact] ${topic.substring(0, 50)}`, text: data.text, image_url: data.image_url, status: 'Draft', brand_id: brandId, updated_at: new Date().toISOString() };
        if (isMockMode && !mockPosts.find(p => p.id === newPost.id)) { mockPosts.unshift(newPost); saveMockPosts(); }
        
        ['queue-brand-filter', 'status-filter'].forEach(id => { const el = document.getElementById(id); if (el) el.value = el.id === 'queue-brand-filter' ? 'All' : 'All'; });
        await loadQueue();
        
        const ts = document.getElementById('template-selector');
        if (ts) {
            ts.value = 'template-facts-single';
            const tsOld = document.getElementById('template-selector-old');
            if (tsOld) tsOld.value = 'template-facts-single';
        }
        window.openEditor(data.post?.id || newPost.id);
    } catch (err) {
        feedback.innerText = "Error: " + err.message; feedback.style.color = "var(--color-danger-fg)"; feedback.style.display = 'block';
    } finally { 
        btnSingle.style.display = 'block'; btnCarousel.style.display = 'block'; overlay.style.display = 'none'; 
        isGeneratingFacts = false;
    }
});

document.getElementById('trigger-facts')?.addEventListener('click', async () => {
    if (isGeneratingFacts) return;
    isGeneratingFacts = true;

    const topic = document.getElementById('facts-topic').value.trim() || "Sharks are older than trees";
    const language = document.getElementById('facts-language').value;
    const slideCount = parseInt(document.getElementById('facts-slide-count').value) || 5;
    const brandId = document.getElementById('facts-brand').value;
    const feedback = document.getElementById('facts-feedback');
    const btnCarousel = document.getElementById('trigger-facts');
    const btnSingle = document.getElementById('trigger-facts-single');
    const overlay = document.getElementById('facts-loading-overlay');
    
    btnCarousel.style.display = 'none'; btnSingle.style.display = 'none'; feedback.style.display = 'none'; overlay.style.display = 'block';
    
    try {
        const activeBrand = allBrands.find(b => b.id === brandId) || currentBranding;
        const response = await fetch(`${API_URL}/generate-facts`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, language, slide_count: slideCount, brand_id: brandId, brand_context: getBrandContext(activeBrand), brand_snapshot: activeBrand })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Facts generation failed");
        if (data.db_error && !isMockMode) { isMockMode = true; }
        const newPost = data.post || { id: Date.now().toString(), topic: `[Facts Lab] ${topic.substring(0, 50)}`, text: data.text, image_url: data.image_url, status: 'Draft', brand_id: brandId, updated_at: new Date().toISOString() };
        if (!mockPosts.find(p => p.id === newPost.id)) { mockPosts.unshift(newPost); saveMockPosts(); }
        window.lastGeneratedPost = newPost;
        ['queue-brand-filter', 'status-filter'].forEach(id => { const el = document.getElementById(id); if (el) el.value = el.id === 'queue-brand-filter' ? 'All' : 'All'; });
        await loadQueue();
        window.openEditor(data.post?.id || newPost.id);
    } catch (err) {
        feedback.innerText = "Error: " + err.message; feedback.style.color = "var(--color-danger-fg)"; feedback.style.display = 'block';
    } finally { 
        btnCarousel.style.display = 'block'; btnSingle.style.display = 'block'; overlay.style.display = 'none'; 
        isGeneratingFacts = false;
    }
});

// ============================================================
// 7. TEMPLATE STUDIO
// ============================================================
function initTemplateStudio() {
    if (studioCanvas) { try { studioCanvas.dispose(); } catch {} studioCanvas = null; }
    const studioEl = document.getElementById('studio-canvas');
    if (!studioEl) return;
    studioCanvas = new fabric.Canvas('studio-canvas', {
        width: PREVIEW_W, height: PREVIEW_H,
        backgroundColor: document.getElementById('studio-bg-color')?.value || '#1a1a2e',
        selection: true, preserveObjectStacking: true
    });
    studioCanvas.setZoom(CANVAS_ZOOM);
    studioCanvas.on('selection:created', onStudioSelection);
    studioCanvas.on('selection:updated', onStudioSelection);
    studioCanvas.on('selection:cleared', () => {
        document.getElementById('studio-props-empty').style.display = '';
        document.getElementById('studio-props-panel').style.display = 'none';
    });
    loadStudioSavedList();
    if (window.feather) feather.replace();
}

function onStudioSelection() {
    const obj = studioCanvas?.getActiveObject();
    if (!obj) return;
    document.getElementById('studio-props-empty').style.display = 'none';
    document.getElementById('studio-props-panel').style.display = '';
    document.getElementById('prop-x').value = Math.round(obj.left / CANVAS_ZOOM) || 0;
    document.getElementById('prop-y').value = Math.round(obj.top / CANVAS_ZOOM) || 0;
    document.getElementById('prop-width').value = Math.round(obj.getScaledWidth() / CANVAS_ZOOM) || 100;
    document.getElementById('prop-height').value = Math.round(obj.getScaledHeight() / CANVAS_ZOOM) || 100;
    document.getElementById('prop-opacity').value = obj.opacity || 1;
    document.getElementById('prop-rotation').value = Math.round(obj.angle) || 0;
    const colorGrp = document.getElementById('prop-color-group');
    const fsGrp = document.getElementById('prop-fontsize-group');
    const txtGrp = document.getElementById('prop-text-group');
    const isText = obj.type === 'i-text' || obj.type === 'textbox';
    if (colorGrp) colorGrp.style.display = '';
    if (fsGrp) fsGrp.style.display = isText ? '' : 'none';
    if (txtGrp) txtGrp.style.display = isText ? '' : 'none';
    if (isText && obj.fontSize) document.getElementById('prop-fontsize').value = Math.round(obj.fontSize);
    if (isText && obj.text) document.getElementById('prop-text').value = obj.text;
    if (obj.fill && typeof obj.fill === 'string') document.getElementById('prop-color').value = fabricColorToHex(obj.fill);
    document.getElementById('prop-lock').checked = !obj.selectable;
}

document.getElementById('prop-apply')?.addEventListener('click', () => {
    const obj = studioCanvas?.getActiveObject();
    if (!obj) return;
    const x = parseFloat(document.getElementById('prop-x').value) * CANVAS_ZOOM;
    const y = parseFloat(document.getElementById('prop-y').value) * CANVAS_ZOOM;
    const w = parseFloat(document.getElementById('prop-width').value) * CANVAS_ZOOM;
    const h = parseFloat(document.getElementById('prop-height').value) * CANVAS_ZOOM;
    const opacity = parseFloat(document.getElementById('prop-opacity').value);
    const angle = parseFloat(document.getElementById('prop-rotation').value);
    const color = document.getElementById('prop-color').value;
    const lock = document.getElementById('prop-lock').checked;
    obj.set({ left: x, top: y, opacity, angle, selectable: !lock, evented: !lock });
    const isText = obj.type === 'i-text' || obj.type === 'textbox';
    if (isText) {
        obj.set({ fontSize: parseFloat(document.getElementById('prop-fontsize').value), text: document.getElementById('prop-text').value, fill: color });
    } else {
        // Width/height for non-text objects
        const currW = obj.getScaledWidth();
        const currH = obj.getScaledHeight();
        obj.set({ scaleX: w / (obj.width || 1), scaleY: h / (obj.height || 1), fill: color });
    }
    studioCanvas.renderAll();
});

// Palette drag-and-drop into studio canvas
document.querySelectorAll('.palette-item').forEach(item => {
    item.addEventListener('click', () => addStudioElement(item.getAttribute('data-element')));
    item.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', item.getAttribute('data-element')); });
});

document.getElementById('studio-canvas')?.parentElement?.addEventListener('dragover', (e) => e.preventDefault());
document.getElementById('studio-canvas')?.parentElement?.addEventListener('drop', (e) => {
    e.preventDefault();
    const elType = e.dataTransfer.getData('text/plain');
    addStudioElement(elType);
});

function addStudioElement(elType) {
    if (!studioCanvas) return;
    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;
    let obj;
    switch (elType) {
        case 'bg-color':
            obj = new fabric.Rect({ left: 0, top: 0, width: CANVAS_W * CANVAS_ZOOM, height: CANVAS_H * CANVAS_ZOOM, fill: currentBranding.primaryColor || '#1e3c72', selectable: true, customType: 'bg-color' });
            studioCanvas.add(obj); studioCanvas.sendToBack(obj); break;
        case 'brand-logo':
            if (currentBranding.logoUrl) {
                fabric.Image.fromURL(currentBranding.logoUrl, (img) => {
                    img.scale(80 * CANVAS_ZOOM / (img.width || 80));
                    img.set({ left: 80 * CANVAS_ZOOM, top: 50 * CANVAS_ZOOM, selectable: true, customType: 'brand-logo', isPlaceholder: 'brand-logo' });
                    studioCanvas.add(img); studioCanvas.renderAll();
                }, { crossOrigin: 'anonymous' });
            } else {
                obj = new fabric.Rect({ left: 80 * CANVAS_ZOOM, top: 50 * CANVAS_ZOOM, width: 80 * CANVAS_ZOOM, height: 80 * CANVAS_ZOOM, fill: '#cccccc', selectable: true, customType: 'brand-logo' });
                studioCanvas.add(obj);
            }
            return;
        case 'title-block':
            obj = new fabric.IText('SLIDE TITLE HERE', { left: 80 * CANVAS_ZOOM, top: 200 * CANVAS_ZOOM, fontSize: 88 * CANVAS_ZOOM, fontWeight: '900', fill: '#ffffff', fontFamily: 'Inter', selectable: true, isPlaceholder: 'title', customType: 'title' });
            studioCanvas.add(obj); break;
        case 'body-block':
            obj = new fabric.Textbox('Body text goes here. Tap to edit.', { left: 80 * CANVAS_ZOOM, top: 500 * CANVAS_ZOOM, width: (CANVAS_W - 160) * CANVAS_ZOOM, fontSize: 52 * CANVAS_ZOOM, fill: 'rgba(255,255,255,0.88)', fontFamily: 'Inter', selectable: true, isPlaceholder: 'body', customType: 'body' });
            studioCanvas.add(obj); break;
        case 'watermark':
            obj = new fabric.IText(currentBranding.handle || '@Brand', { left: 80 * CANVAS_ZOOM, top: (CANVAS_H - 80) * CANVAS_ZOOM, fontSize: 32 * CANVAS_ZOOM, fill: 'rgba(255,255,255,0.5)', fontFamily: 'Inter', selectable: true, isPlaceholder: 'brand-name', customType: 'watermark' });
            studioCanvas.add(obj); break;
        case 'image-frame':
            obj = new fabric.Rect({ left: 0, top: 0, width: CANVAS_W * CANVAS_ZOOM, height: CANVAS_H * CANVAS_ZOOM, fill: 'rgba(0,0,0,0.6)', selectable: true, customType: 'image-overlay' });
            studioCanvas.add(obj); break;
        case 'divider-line':
            obj = new fabric.Line([80 * CANVAS_ZOOM, 150 * CANVAS_ZOOM, (CANVAS_W - 80) * CANVAS_ZOOM, 150 * CANVAS_ZOOM], { stroke: '#f59e0b', strokeWidth: 4, selectable: true, customType: 'divider' });
            studioCanvas.add(obj); break;
        case 'handle-text':
            obj = new fabric.IText(currentBranding.handle || '@CreatorsDen', { left: 80 * CANVAS_ZOOM, top: (CANVAS_H - 80) * CANVAS_ZOOM, fontSize: 32 * CANVAS_ZOOM, fontWeight: '600', fill: 'rgba(255,255,255,0.6)', fontFamily: 'Inter', selectable: true, customType: 'footer-handle' });
            studioCanvas.add(obj); break;
        case 'header-image':
            obj = new fabric.Rect({ left: 0, top: 0, width: CANVAS_W * CANVAS_ZOOM, height: 130 * CANVAS_ZOOM, fill: 'rgba(0,0,0,0.4)', selectable: true, customType: 'header-bar' });
            studioCanvas.add(obj); break;
    }
    if (obj) studioCanvas.renderAll();
}

document.getElementById('studio-clear')?.addEventListener('click', () => { if (studioCanvas && confirm('Clear all?')) { studioCanvas.clear(); studioCanvas.backgroundColor = document.getElementById('studio-bg-color').value; studioCanvas.renderAll(); } });
document.getElementById('studio-delete-selected')?.addEventListener('click', () => { const obj = studioCanvas?.getActiveObject(); if (obj) { studioCanvas.remove(obj); studioCanvas.renderAll(); } });
document.getElementById('studio-bring-front')?.addEventListener('click', () => { studioCanvas?.getActiveObject()?.bringToFront(); studioCanvas?.renderAll(); });
document.getElementById('studio-send-back')?.addEventListener('click', () => { studioCanvas?.getActiveObject()?.sendToBack(); studioCanvas?.renderAll(); });

document.getElementById('studio-bg-color')?.addEventListener('input', (e) => { if (studioCanvas) { studioCanvas.backgroundColor = e.target.value; studioCanvas.renderAll(); } });

// Save Template
document.getElementById('save-studio-template')?.addEventListener('click', () => {
    const activeC = studioCanvas || freeformCanvas;
    if (!activeC) return;
    const name = document.getElementById('studio-template-name').value.trim();
    if (!name) { showToast('Please enter a template name.', 'error'); return; }
    const templates = JSON.parse(localStorage.getItem('cd_templates') || '[]');
    const existing = templates.findIndex(t => t.name === name);
    const templateData = { name, canvasJson: activeC.toJSON(['isPlaceholder', 'customType']), createdAt: new Date().toISOString() };
    if (existing > -1) templates[existing] = templateData;
    else templates.push(templateData);
    localStorage.setItem('cd_templates', JSON.stringify(templates));

    saveCanvasLayoutOverrides(activeC, name);
    const selPreset = document.getElementById('template-selector')?.value || 'template-classic';
    saveCanvasLayoutOverrides(activeC, selPreset);

    loadStudioSavedList();
    loadSavedTemplatesSelector();
    syncTemplateDropdowns();
    showToast(`Template "${name}" saved and applied to generator!`);
    document.getElementById('studio-template-name').value = '';
});

function loadStudioSavedList() {
    const list = document.getElementById('studio-saved-list');
    if (!list) return;
    const templates = JSON.parse(localStorage.getItem('cd_templates') || '[]');
    list.innerHTML = '';
    if (templates.length === 0) { list.innerHTML = '<p style="font-size:12px;color:var(--color-fg-muted);text-align:center;padding:8px;">No saved templates yet.</p>'; return; }
    templates.forEach(t => {
        const div = document.createElement('div');
        div.className = 'studio-saved-item';
        div.innerHTML = `<span style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.name}</span><div style="display:flex;gap:4px;"><button onclick="loadStudioTemplate('${t.name}')" style="color:var(--color-accent-fg);">Load</button><button onclick="deleteStudioTemplate('${t.name}')" style="color:var(--color-danger-fg);">Del</button></div>`;
        list.appendChild(div);
    });
}

function loadSavedTemplatesSelector() {
    const sel = document.getElementById('saved-template-selector');
    if (!sel) return;
    const templates = JSON.parse(localStorage.getItem('cd_templates') || '[]');
    sel.innerHTML = '<option value="">— Select a saved template —</option>';
    templates.forEach(t => { const opt = document.createElement('option'); opt.value = t.name; opt.innerText = t.name; sel.appendChild(opt); });
}

window.loadStudioTemplate = (name) => {
    if (!studioCanvas) return;
    const templates = JSON.parse(localStorage.getItem('cd_templates') || '[]');
    const t = templates.find(t => t.name === name);
    if (t) { studioCanvas.loadFromJSON(t.canvasJson, () => studioCanvas.renderAll()); showToast(`Loaded "${name}"`); }
};

window.deleteStudioTemplate = (name) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    const templates = JSON.parse(localStorage.getItem('cd_templates') || '[]').filter(t => t.name !== name);
    localStorage.setItem('cd_templates', JSON.stringify(templates));
    loadStudioSavedList();
    loadSavedTemplatesSelector();
    showToast(`"${name}" deleted.`);
};

// ============================================================
// 8. BRAND IDENTITY VIEW
// ============================================================
function loadBrandingView() {
    document.getElementById('brand-name-input').value = currentBranding.name || '';
    document.getElementById('brand-handle-input').value = currentBranding.handle || '';
    document.getElementById('brand-logo-preview').src = currentBranding.logoUrl || 'assets/images/logo.png';
    document.getElementById('facebook-url-input').value = currentBranding.facebookUrl || '';
    document.getElementById('instagram-url-input').value = currentBranding.instagramUrl || '';
    document.getElementById('tiktok-url-input').value = currentBranding.tiktokUrl || '';
    document.getElementById('linkedin-url-input').value = currentBranding.linkedinUrl || '';
    document.getElementById('brand-primary-color-input').value = currentBranding.primaryColor || '#1e3c72';
    document.getElementById('brand-secondary-color-input').value = currentBranding.secondaryColor || '#2a5298';
    document.getElementById('brand-accent-color-input').value = currentBranding.accentColor || '#f59e0b';
    document.getElementById('brand-bg-color-input').value = currentBranding.bgColor || '#0f0c29';

    // New fields
    document.getElementById('brand-narrative-input').value = currentBranding.narrative || '';
    document.getElementById('brand-tone-input').value = currentBranding.toneOfVoice || 'Educational & Authoritative';
    document.getElementById('brand-icp-input').value = currentBranding.icp || '';
    document.getElementById('brand-heading-font').value = currentBranding.headingFont || 'Inter';
    document.getElementById('brand-body-font').value = currentBranding.bodyFont || 'Inter';

    document.getElementById('custom-title-size').value = currentBranding.customTitleSize || 100;
    document.getElementById('custom-title-y').value = currentBranding.customTitleY || 50;
    document.getElementById('custom-content-y').value = currentBranding.customContentY || 70;
    document.getElementById('custom-bg-opacity').value = currentBranding.customBgOpacity || 85;
    document.getElementById('custom-bg-color').value = currentBranding.customBgColor || '#000000';
    const ts = document.getElementById('custom-theme-preset');
    if (ts) ts.value = currentBranding.themePreset || 'theme-default';
    const pt = document.getElementById('custom-show-pagination');
    if (pt) pt.checked = currentBranding.showPagination !== false;
    const headerPrev = document.getElementById('brand-header-asset-preview');
    if (headerPrev) headerPrev.src = currentBranding.headerAssetUrl || currentBranding.logoUrl || 'assets/images/logo.png';
    document.getElementById('prompt-template-input').value = currentPromptTemplate;
    document.getElementById('branding-feedback').innerText = '';
}

// Logo upload
document.getElementById('brand-logo-upload')?.addEventListener('change', function(e) {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (!file.type.match('image.*')) { alert("Not an image."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ratio = Math.min(200 / img.width, 200 / img.height);
            canvas.width = img.width * ratio; canvas.height = img.height * ratio;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            document.getElementById('brand-logo-preview').src = canvas.toDataURL('image/png');
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
});

// Header asset upload
document.getElementById('brand-header-asset-upload')?.addEventListener('change', function(e) {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (!file.type.match('image.*')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ratio = Math.min(400 / img.width, 120 / img.height);
            canvas.width = img.width * ratio; canvas.height = img.height * ratio;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/png');
            const prev = document.getElementById('brand-header-asset-preview');
            if (prev) prev.src = dataUrl;
            currentBranding.headerAssetUrl = dataUrl;
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
});

// Save Branding
document.getElementById('save-branding')?.addEventListener('click', async function() {
    const name = document.getElementById('brand-name-input').value;
    const handle = document.getElementById('brand-handle-input').value;
    const logoUrl = document.getElementById('brand-logo-preview').src;
    const headerAssetUrl = document.getElementById('brand-header-asset-preview')?.src || currentBranding.headerAssetUrl || '';
    const facebookUrl = document.getElementById('facebook-url-input').value;
    const instagramUrl = document.getElementById('instagram-url-input').value;
    const tiktokUrl = document.getElementById('tiktok-url-input').value;
    const linkedinUrl = document.getElementById('linkedin-url-input').value;
    const primaryColor = document.getElementById('brand-primary-color-input').value;
    const secondaryColor = document.getElementById('brand-secondary-color-input').value;
    const accentColor = document.getElementById('brand-accent-color-input').value;
    const bgColor = document.getElementById('brand-bg-color-input').value;
    const narrative = document.getElementById('brand-narrative-input').value;
    const toneOfVoice = document.getElementById('brand-tone-input').value;
    const icp = document.getElementById('brand-icp-input').value;
    const headingFont = document.getElementById('brand-heading-font').value;
    const bodyFont = document.getElementById('brand-body-font').value;
    const customTitleSize = document.getElementById('custom-title-size').value;
    const customTitleY = document.getElementById('custom-title-y').value;
    const customContentY = document.getElementById('custom-content-y').value;
    const customBgOpacity = document.getElementById('custom-bg-opacity').value;
    const customBgColor = document.getElementById('custom-bg-color').value;
    const themePreset = document.getElementById('custom-theme-preset')?.value || 'theme-default';
    const promptInput = document.getElementById('prompt-template-input');
    const promptTemplate = promptInput ? (promptInput.value || DEFAULT_PROMPT_TEMPLATE) : DEFAULT_PROMPT_TEMPLATE;
    const showPagination = document.getElementById('custom-show-pagination')?.checked !== false;

    const templateSettings = { customTitleSize, customTitleY, customContentY, customBgOpacity, customBgColor, themePreset, showPagination, headerAssetUrl, accentColor, bgColor, headingFont, bodyFont, narrative, toneOfVoice, icp };
    const socialLinks = { facebookUrl, instagramUrl, tiktokUrl, linkedinUrl };

    const updatedBrandFields = { name, handle, logoUrl, headerAssetUrl, facebookUrl, instagramUrl, tiktokUrl, linkedinUrl, primaryColor, secondaryColor, accentColor, bgColor, narrative, toneOfVoice, icp, headingFont, bodyFont, customTitleSize, customTitleY, customContentY, customBgOpacity, customBgColor, themePreset, showPagination, promptTemplate };

    if (activeBrandId.startsWith('new-')) {
        if (!isMockMode) {
            const { data, error } = await supabase.from('brands').insert({ name, handle, logo_url: logoUrl, primary_color: primaryColor, secondary_color: secondaryColor, social_links: socialLinks, template_settings: templateSettings }).select();
            if (data?.[0]) { activeBrandId = data[0].id; allBrands.push({ id: activeBrandId, ...updatedBrandFields }); }
        } else {
            activeBrandId = 'mock-' + Date.now();
            allBrands.push({ id: activeBrandId, ...updatedBrandFields });
        }
    } else {
        if (!isMockMode) await supabase.from('brands').update({ name, handle, logo_url: logoUrl, primary_color: primaryColor, secondary_color: secondaryColor, social_links: socialLinks, template_settings: templateSettings }).eq('id', activeBrandId);
        const b = allBrands.find(br => br.id === activeBrandId);
        if (b) Object.assign(b, updatedBrandFields);
    }

    currentBranding = allBrands.find(br => br.id === activeBrandId) || currentBranding;
    if (isMockMode) localStorage.setItem('loksewa_all_brands', JSON.stringify(allBrands));

    // Save prompt template internally updated via updatedBrandFields
    currentPromptTemplate = promptTemplate;

    updateBrandVisuals(currentBranding);
    populateBrandSelectors();
    const fb = document.getElementById('branding-feedback');
    fb.innerText = "Brand Identity saved successfully!";
    fb.style.color = "var(--color-success-fg)";
    setTimeout(() => { fb.innerText = ''; }, 3000);
});

document.getElementById('brand-selector')?.addEventListener('change', (e) => {
    const bId = e.target.value;
    if (!bId) return;
    activeBrandId = bId;
    currentBranding = allBrands.find(br => br.id === activeBrandId) || currentBranding;
    currentPromptTemplate = currentBranding.promptTemplate || localStorage.getItem(`loksewa_prompt_template_${activeBrandId}`) || DEFAULT_PROMPT_TEMPLATE;
    loadBrandingForm(currentBranding);
    updateBrandVisuals(currentBranding);
});

document.getElementById('create-brand-btn')?.addEventListener('click', () => {
    const newBrand = { id: 'new-' + Date.now(), name: "New Brand", handle: "@newbrand", logoUrl: "assets/images/logo.png", primaryColor: "#000000", secondaryColor: "#666666", accentColor: '#f59e0b', bgColor: '#0f0c29', headingFont: 'Inter', bodyFont: 'Inter', narrative: '', toneOfVoice: 'Educational & Authoritative', icp: '', customTitleSize: "100", customTitleY: "50", customContentY: "70", customBgOpacity: "85", customBgColor: "#000000", themePreset: "theme-default", showPagination: true, promptTemplate: DEFAULT_PROMPT_TEMPLATE };
    activeBrandId = newBrand.id;
    currentBranding = newBrand;
    const opt = document.createElement('option'); opt.value = activeBrandId; opt.innerText = newBrand.name;
    const sel = document.getElementById('brand-selector');
    sel.appendChild(opt); sel.value = activeBrandId;
    loadBrandingForm(newBrand);
    updateBrandVisuals(newBrand);
});

function loadBrandingForm(brand) {
    if (!brand) return;
    document.getElementById('brand-name-input').value = brand.name || '';
    document.getElementById('brand-handle-input').value = brand.handle || '';
    document.getElementById('brand-logo-preview').src = brand.logoUrl || 'assets/images/logo.png';
    document.getElementById('facebook-url-input').value = brand.facebookUrl || '';
    document.getElementById('instagram-url-input').value = brand.instagramUrl || '';
    document.getElementById('tiktok-url-input').value = brand.tiktokUrl || '';
    document.getElementById('linkedin-url-input').value = brand.linkedinUrl || '';
    document.getElementById('brand-primary-color-input').value = brand.primaryColor || '#1e3c72';
    document.getElementById('brand-secondary-color-input').value = brand.secondaryColor || '#2a5298';
    document.getElementById('brand-accent-color-input').value = brand.accentColor || '#f59e0b';
    document.getElementById('brand-bg-color-input').value = brand.bgColor || '#0f0c29';
    document.getElementById('brand-narrative-input').value = brand.narrative || '';
    document.getElementById('brand-tone-input').value = brand.toneOfVoice || 'Educational & Authoritative';
    document.getElementById('brand-icp-input').value = brand.icp || '';
    document.getElementById('brand-heading-font').value = brand.headingFont || 'Inter';
    document.getElementById('brand-body-font').value = brand.bodyFont || 'Inter';
    document.getElementById('custom-title-size').value = brand.customTitleSize || 100;
    document.getElementById('custom-title-y').value = brand.customTitleY || 50;
    document.getElementById('custom-content-y').value = brand.customContentY || 70;
    document.getElementById('custom-bg-opacity').value = brand.customBgOpacity || 85;
    document.getElementById('custom-bg-color').value = brand.customBgColor || '#000000';
    const ts = document.getElementById('custom-theme-preset'); if (ts) ts.value = brand.themePreset || 'theme-default';
    const pt = document.getElementById('custom-show-pagination'); if (pt) pt.checked = brand.showPagination !== false;
    const hp = document.getElementById('brand-header-asset-preview'); if (hp) hp.src = brand.headerAssetUrl || brand.logoUrl || 'assets/images/logo.png';
    
    currentPromptTemplate = brand.promptTemplate || localStorage.getItem(`loksewa_prompt_template_${brand.id}`) || localStorage.getItem('loksewa_prompt_template') || DEFAULT_PROMPT_TEMPLATE;
    const promptInput = document.getElementById('prompt-template-input');
    if (promptInput) promptInput.value = currentPromptTemplate;
}

document.getElementById('reset-prompt-btn')?.addEventListener('click', () => {
    if (!confirm("Reset to default prompt?")) return;
    currentPromptTemplate = DEFAULT_PROMPT_TEMPLATE;
    document.getElementById('prompt-template-input').value = currentPromptTemplate;
    if(currentBranding) { currentBranding.promptTemplate = currentPromptTemplate; }
    const fb = document.getElementById('branding-feedback');
    fb.innerText = "Prompt reset to default."; fb.style.color = "var(--color-fg-muted)";
    setTimeout(() => { fb.innerText = ''; }, 3000);
});

// Live CSS variable updates for custom template preview
['custom-title-size', 'custom-title-y', 'custom-content-y', 'custom-bg-opacity', 'custom-bg-color'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
        const val = document.getElementById(id).value;
        if (id === 'custom-title-size') document.documentElement.style.setProperty('--custom-title-size', (val * 0.72) + 'px');
        if (id === 'custom-title-y') document.documentElement.style.setProperty('--custom-title-y', -((100 - val) * 3) + 'px');
        if (id === 'custom-content-y') document.documentElement.style.setProperty('--custom-content-y', val + '%');
        if (id === 'custom-bg-opacity' || id === 'custom-bg-color') {
            const hex = document.getElementById('custom-bg-color').value.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16) || 0;
            const g = parseInt(hex.substring(2, 4), 16) || 0;
            const b = parseInt(hex.substring(4, 6), 16) || 0;
            const a = document.getElementById('custom-bg-opacity').value / 100;
            document.documentElement.style.setProperty('--custom-bg-color', `rgba(${r},${g},${b},${a})`);
        }
    });
});

// ============================================================
// 9. VIDEO CREATION
// ============================================================
async function loadVideoQueue() {
    const posts = await getPosts();
    const grid = document.getElementById('video-grid');
    grid.innerHTML = '';
    posts.forEach(post => {
        const imageUrls = parseImageUrls(post.image_url);
        const card = document.createElement('div');
        card.className = 'content-card';
        card.innerHTML = `
            <div class="content-card-img" style="background-image:url('${imageUrls[0]||''}')"></div>
            <div class="content-card-body">
                <div class="content-card-title">${post.topic}</div>
                <div class="content-card-meta">
                    <button class="btn-primary full-width" onclick="window.openVideoEditor('${post.id}')"><i data-feather="film"></i> Create Video</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
    if (window.feather) feather.replace();
}

let currentVideoPostId = null;
window.openVideoEditor = async (id) => {
    currentVideoPostId = id;
    const posts = await getPosts();
    const post = posts.find(p => p.id === id);
    if (!post) return;
    document.getElementById('video-topic-title').innerText = post.topic;
    try {
        const parsed = parsePostText(post.text);
        let niceText = '';
        if (parsed.slides) parsed.slides.forEach((s, i) => { niceText += `Slide ${i + 1}: ${s.title}\n${s.content}\n\n`; });
        const caption = parsed.caption;
        if (caption) niceText += typeof caption === 'object' ? `Caption Hook: ${caption.hook}\nBody: ${caption.body}` : `Caption: ${caption}`;
        document.getElementById('video-original-content').innerText = niceText || post.text;
    } catch { document.getElementById('video-original-content').innerText = post.text; }
    document.getElementById('video-prompts-result').style.display = 'none';
    document.getElementById('video-prompts-text').value = '';
    document.getElementById('video-feedback').innerText = '';
    switchView('video-editor-view');
};

document.getElementById('back-to-video-queue')?.addEventListener('click', () => document.querySelector('[data-target="video-view"]')?.click());
document.getElementById('video-format')?.addEventListener('change', (e) => { document.getElementById('video-splits-group').style.display = e.target.value === 'multiple' ? 'block' : 'none'; });

document.getElementById('generate-video-btn')?.addEventListener('click', async () => {
    const originalResearch = document.getElementById('video-original-content').innerText;
    const format = document.getElementById('video-format').value;
    const splits = document.getElementById('video-splits').value;
    const btn = document.getElementById('generate-video-btn');
    const feedback = document.getElementById('video-feedback');
    btn.innerHTML = '<i data-feather="loader" class="spin"></i> Generating...'; btn.disabled = true; if (window.feather) feather.replace();
    feedback.innerText = 'Requesting video prompts...'; feedback.style.color = 'var(--color-fg-muted)';
    try {
        const response = await fetch(CONFIG.N8N_MANUAL_WEBHOOK_URL.replace('/generate', '/generate-video'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ originalResearch, format, splits })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed");
        document.getElementById('video-prompts-text').value = data.prompts;
        document.getElementById('video-prompts-result').style.display = 'block';
        feedback.innerText = 'Success!'; feedback.style.color = 'var(--color-success-fg)';
    } catch (e) { feedback.innerText = 'Error: ' + e.message; feedback.style.color = 'var(--color-danger-fg)'; }
    finally { btn.innerHTML = '<i data-feather="film"></i> Generate Video Prompts'; btn.disabled = false; if (window.feather) feather.replace(); }
});

document.getElementById('copy-video-prompts')?.addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('video-prompts-text').value).catch(() => {});
    showToast('Video prompts copied!');
});

// ============================================================
// 10. SETTINGS VIEW
// ============================================================
async function loadSettings() {
    if (currentUser?.user_metadata) {
        document.getElementById('setting-display-name').value = currentUser.user_metadata.display_name || '';
        document.getElementById('setting-phone').value = currentUser.user_metadata.phone || '';
    }
}

document.getElementById('save-profile-btn')?.addEventListener('click', async () => {
    if (isMockMode) { alert('Cannot update profile in mock mode'); return; }
    const displayName = document.getElementById('setting-display-name').value;
    const phone = document.getElementById('setting-phone').value;
    const fb = document.getElementById('profile-feedback');
    fb.innerText = 'Saving...'; fb.style.color = 'var(--color-fg-muted)';
    const { error } = await supabase.auth.updateUser({ data: { display_name: displayName, phone } });
    if (error) { fb.innerText = error.message; fb.style.color = 'var(--color-danger-fg)'; }
    else { fb.innerText = 'Profile updated!'; fb.style.color = 'var(--color-success-fg)'; if (displayName) document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${displayName.substring(0, 2)}&background=random`; }
});

document.getElementById('update-password-btn')?.addEventListener('click', async () => {
    if (isMockMode) { alert('Cannot update password in mock mode'); return; }
    const password = document.getElementById('setting-new-password').value;
    const fb = document.getElementById('password-feedback');
    if (!password || password.length < 6) { fb.innerText = "Min 6 characters."; fb.style.color = 'var(--color-danger-fg)'; return; }
    fb.innerText = 'Updating...'; fb.style.color = 'var(--color-fg-muted)';
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { fb.innerText = error.message; fb.style.color = 'var(--color-danger-fg)'; }
    else { fb.innerText = 'Password updated!'; fb.style.color = 'var(--color-success-fg)'; document.getElementById('setting-new-password').value = ''; }
});

let currentMfaFactorId = null;
document.getElementById('enroll-mfa-btn')?.addEventListener('click', async () => {
    if (isMockMode) { alert('MFA not available in mock mode'); return; }
    try {
        const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
        if (error) throw error;
        currentMfaFactorId = data.id;
        document.getElementById('mfa-enrollment-flow').style.display = 'block';
        document.getElementById('enroll-mfa-btn').style.display = 'none';
        document.getElementById('mfa-qr-code').src = `data:image/svg+xml;utf8,${encodeURIComponent(data.totp.qr_code)}`;
    } catch (e) { alert("MFA error: " + e.message); }
});

document.getElementById('verify-mfa-btn')?.addEventListener('click', async () => {
    const code = document.getElementById('mfa-verify-code').value;
    const fb = document.getElementById('mfa-feedback');
    if (!code || code.length !== 6) { fb.innerText = "Enter a valid 6-digit code."; fb.style.color = 'var(--color-danger-fg)'; return; }
    fb.innerText = 'Verifying...'; fb.style.color = 'var(--color-fg-muted)';
    try {
        const challenge = await supabase.auth.mfa.challenge({ factorId: currentMfaFactorId });
        if (challenge.error) throw challenge.error;
        const verify = await supabase.auth.mfa.verify({ factorId: currentMfaFactorId, challengeId: challenge.data.id, code });
        if (verify.error) throw verify.error;
        fb.innerText = 'MFA Enabled!'; fb.style.color = 'var(--color-success-fg)';
        document.getElementById('mfa-enrollment-flow').style.display = 'none';
        document.getElementById('mfa-status-text').innerText = 'Enabled';
        document.getElementById('mfa-status-text').style.color = 'var(--color-success-fg)';
    } catch (e) { fb.innerText = e.message; fb.style.color = 'var(--color-danger-fg)'; }
});

// ============================================================
// 11. MOBILE MENU
// ============================================================
document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('app-container').classList.toggle('sidebar-open');
});
document.addEventListener('click', (e) => {
    const container = document.getElementById('app-container');
    if (container.classList.contains('sidebar-open') && (e.target === container || e.target.closest('.nav-links a'))) {
        container.classList.remove('sidebar-open');
    }
});

// ============================================================
// 12. UTILITY FUNCTIONS
// ============================================================
function showToast(message, type = 'success') {
    let toast = document.getElementById('cd-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'cd-toast';
        toast.style.cssText = `position:fixed;bottom:24px;right:24px;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;z-index:9999;opacity:0;transition:opacity 0.2s ease;max-width:320px;box-shadow:0 8px 24px rgba(0,0,0,0.15);`;
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.style.background = type === 'error' ? '#d1242f' : '#1a7f37';
    toast.style.color = '#ffffff';
    toast.style.opacity = '1';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

// ============================================================
// 13. INIT
// ============================================================
window.onload = () => {
    loadDashboardStats();
    suggestRandomTopic();
    if (window.feather) feather.replace();
};

// --- Custom AI Image Generation ---
let pendingAiImageUrl = null;

function resetAiImageProgress() {
    const progress = document.getElementById('ai-image-progress');
    const previewWrap = document.getElementById('ai-image-preview-wrap');
    const bar = document.getElementById('ai-image-progress-bar');
    const statusText = document.getElementById('ai-image-status-text');
    if (progress) progress.style.display = 'none';
    if (previewWrap) previewWrap.style.display = 'none';
    if (bar) bar.style.width = '0%';
    if (statusText) statusText.textContent = 'Generating image...';
    pendingAiImageUrl = null;
}

document.getElementById('generate-custom-image-btn')?.addEventListener('click', () => {
    const promptEl = document.getElementById('custom-ai-image-prompt');
    const promptText = promptEl ? promptEl.value.trim() : '';
    if (!promptText) {
        showToast('Please describe the image you want to generate', 'error');
        return;
    }

    // Reset state
    resetAiImageProgress();
    pendingAiImageUrl = null;

    // Show progress section
    const progress = document.getElementById('ai-image-progress');
    const bar = document.getElementById('ai-image-progress-bar');
    const statusText = document.getElementById('ai-image-status-text');
    const previewWrap = document.getElementById('ai-image-preview-wrap');
    const genBtn = document.getElementById('generate-custom-image-btn');
    if (progress) { progress.style.display = 'flex'; }
    if (genBtn) { genBtn.disabled = true; }
    if (window.feather) feather.replace();

    // Animate progress bar while loading (indeterminate feel)
    let fakeProgress = 5;
    const progressInterval = setInterval(() => {
        fakeProgress = Math.min(fakeProgress + (Math.random() * 8), 85);
        if (bar) bar.style.width = fakeProgress + '%';
    }, 600);

    const seed = Math.floor(Math.random() * 100000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?seed=${seed}&nologo=true&width=1080&height=1350`;
    pendingAiImageUrl = imageUrl;

    // Detect when the image actually loads
    const tempImg = new Image();
    tempImg.onload = () => {
        clearInterval(progressInterval);
        if (bar) bar.style.width = '100%';
        if (statusText) statusText.textContent = '✓ Image ready — click below to apply';
        // Show preview and apply button
        const previewImg = document.getElementById('ai-image-preview');
        if (previewImg) previewImg.src = imageUrl;
        if (previewWrap) { previewWrap.style.display = 'block'; }
        if (genBtn) { genBtn.disabled = false; }
        if (window.feather) feather.replace();
        showToast('Image generated! Click "Apply to Current Slide" to use it.');
    };
    tempImg.onerror = () => {
        clearInterval(progressInterval);
        if (bar) bar.style.width = '0%';
        if (statusText) statusText.textContent = '✗ Generation failed. Try a different prompt.';
        if (genBtn) { genBtn.disabled = false; }
        showToast('Image generation failed. Please try again.', 'error');
    };
    tempImg.src = imageUrl;
});

// Apply the pending generated image to the current slide
document.getElementById('ai-image-apply-btn')?.addEventListener('click', () => {
    if (!pendingAiImageUrl) return;
    currentImageUrls[currentSlideIndex] = pendingAiImageUrl;
    document.getElementById('editor-image').src = pendingAiImageUrl;
    updateSlidePreview();
    showToast('✓ Image applied to Slide ' + (currentSlideIndex + 1) + '!');
    resetAiImageProgress();
});

// ============================================================
// CANVAS LAB (FREEFORM EDITOR)
// ============================================================

function onCanvasLabSelection() {
    const obj = freeformCanvas?.getActiveObject();
    if (!obj) return;
    
    document.getElementById('canvas-props-empty').style.display = 'none';
    document.getElementById('canvas-props-panel').style.display = 'block';
    
    // Opacity
    document.getElementById('canvas-prop-opacity').value = obj.opacity || 1;
    
    // Color/Fill
    const colorGroup = document.getElementById('canvas-prop-color-group');
    if (obj.type === 'i-text' || obj.type === 'textbox' || obj.text !== undefined || obj.type === 'rect' || obj.type === 'circle') {
        colorGroup.style.display = 'block';
        document.getElementById('canvas-prop-color').value = obj.fill || '#000000';
    } else {
        colorGroup.style.display = 'none';
    }
    
    // Text specific properties
    const textGroup = document.getElementById('canvas-prop-text-group');
    const fontGroup = document.getElementById('canvas-prop-fontsize-group');
    if (obj.type === 'i-text' || obj.type === 'textbox' || obj.text !== undefined) {
        textGroup.style.display = 'block';
        fontGroup.style.display = 'block';
        document.getElementById('canvas-prop-text').value = obj.text || '';
        document.getElementById('canvas-prop-fontsize').value = obj.fontSize || 40;
    } else {
        textGroup.style.display = 'none';
        fontGroup.style.display = 'none';
    }
}

// Format property listeners
document.getElementById('canvas-prop-opacity')?.addEventListener('input', (e) => {
    const obj = (fabricCanvas || freeformCanvas)?.getActiveObject();
    if (obj) { obj.set('opacity', parseFloat(e.target.value)); (fabricCanvas || freeformCanvas).renderAll(); syncFabricCanvasToCurrentSlide(); }
});

document.getElementById('canvas-prop-color')?.addEventListener('input', (e) => {
    const obj = (fabricCanvas || freeformCanvas)?.getActiveObject();
    if (obj) { obj.set('fill', e.target.value); (fabricCanvas || freeformCanvas).renderAll(); syncFabricCanvasToCurrentSlide(); }
});

document.getElementById('canvas-prop-fontsize')?.addEventListener('input', (e) => {
    const obj = (fabricCanvas || freeformCanvas)?.getActiveObject();
    if (obj && (obj.type === 'i-text' || obj.type === 'textbox' || obj.text !== undefined)) { 
        obj.set('fontSize', parseInt(e.target.value, 10) || 40); 
        (fabricCanvas || freeformCanvas).renderAll(); 
        syncFabricCanvasToCurrentSlide(); 
    }
});

document.getElementById('canvas-prop-text')?.addEventListener('input', (e) => {
    const obj = (fabricCanvas || freeformCanvas)?.getActiveObject();
    if (obj && (obj.type === 'i-text' || obj.type === 'textbox' || obj.text !== undefined)) { 
        obj.set('text', e.target.value); 
        (fabricCanvas || freeformCanvas).renderAll(); 
        syncFabricCanvasToCurrentSlide(); 
    }
});

// Header Background Color
document.getElementById('canvas-header-bg-color')?.addEventListener('input', (e) => {
    if (freeformCanvas) {
        const headerObj = freeformCanvas.getObjects().find(o => o.customType === 'header-bar');
        if (headerObj) {
            headerObj.set('fill', e.target.value);
            freeformCanvas.renderAll();
        }
    }
});

// Canvas Background Color
document.getElementById('canvas-bg-color')?.addEventListener('input', (e) => {
    if (freeformCanvas) {
        freeformCanvas.backgroundColor = e.target.value;
        freeformCanvas.renderAll();
    }
});

// Duplicate and Delete Property Actions
document.getElementById('canvas-prop-duplicate')?.addEventListener('click', () => {
    const obj = freeformCanvas?.getActiveObject();
    if (obj) {
        obj.clone((cloned) => {
            cloned.set({
                left: obj.left + 20,
                top: obj.top + 20,
                isExtraOverride: true
            });
            freeformCanvas.add(cloned);
            freeformCanvas.setActiveObject(cloned);
        });
    }
});

document.getElementById('canvas-prop-delete')?.addEventListener('click', () => {
    const obj = freeformCanvas?.getActiveObject();
    if (obj) {
        freeformCanvas.remove(obj);
        freeformCanvas.discardActiveObject();
        freeformCanvas.renderAll();
        document.getElementById('canvas-props-panel').style.display = 'none';
        document.getElementById('canvas-props-empty').style.display = 'block';
    }
});

// Z-Index controls
document.getElementById('canvas-bring-front')?.addEventListener('click', () => {
    const obj = freeformCanvas?.getActiveObject();
    if (obj) { freeformCanvas.bringToFront(obj); freeformCanvas.requestRenderAll(); }
});
document.getElementById('canvas-send-back')?.addEventListener('click', () => {
    const obj = freeformCanvas?.getActiveObject();
    if (obj) { freeformCanvas.sendToBack(obj); freeformCanvas.requestRenderAll(); }
});

// Delete and Clear
document.getElementById('canvas-delete-selected')?.addEventListener('click', () => {
    const obj = freeformCanvas?.getActiveObject();
    if (obj) {
        freeformCanvas.remove(obj);
        freeformCanvas.discardActiveObject();
        freeformCanvas.requestRenderAll();
    }
});
document.getElementById('canvas-clear')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the entire canvas?')) {
        freeformCanvas?.clear();
        freeformCanvas.backgroundColor = document.getElementById('canvas-bg-color')?.value || '#ffffff';
        freeformCanvas.requestRenderAll();
    }
});

// Drag and drop / click from palette to freeform canvas
document.querySelectorAll('.palette-item[data-canvas-elem]').forEach(item => {
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', item.dataset.canvasElem);
    });
    item.addEventListener('click', () => {
        if (!freeformCanvas) return;
        const elemType = item.dataset.canvasElem;
        const pointerX = CANVAS_W / 2;
        const pointerY = CANVAS_H / 2;
        addCanvasElement(elemType, pointerX, pointerY);
    });
});

function addCanvasElement(elemType, pointerX, pointerY) {
    if (!freeformCanvas) return;
    switch(elemType) {
        case 'heading':
            const textH = new fabric.IText('HEADING TEXT', {
                left: pointerX, top: pointerY, originX: 'center', originY: 'center',
                fontFamily: 'Inter', fontSize: 60, fontWeight: 'bold', fill: '#000000',
                isExtraOverride: true
            });
            freeformCanvas.add(textH); freeformCanvas.setActiveObject(textH);
            break;
        case 'body':
            const textB = new fabric.IText('Body text goes here...', {
                left: pointerX, top: pointerY, originX: 'center', originY: 'center',
                fontFamily: 'Inter', fontSize: 30, fontWeight: 'normal', fill: '#333333',
                isExtraOverride: true
            });
            freeformCanvas.add(textB); freeformCanvas.setActiveObject(textB);
            break;
        case 'rect':
            const rect = new fabric.Rect({
                left: pointerX, top: pointerY, originX: 'center', originY: 'center',
                width: 200, height: 100, fill: '#ff4757', rx: 10, ry: 10,
                isExtraOverride: true
            });
            freeformCanvas.add(rect); freeformCanvas.setActiveObject(rect);
            break;
        case 'circle':
            const circle = new fabric.Circle({
                left: pointerX, top: pointerY, originX: 'center', originY: 'center',
                radius: 75, fill: '#1e90ff',
                isExtraOverride: true
            });
            freeformCanvas.add(circle); freeformCanvas.setActiveObject(circle);
            break;
        case 'accent-line':
            const accentLine = new fabric.Rect({
                left: pointerX, top: pointerY, originX: 'center', originY: 'center',
                width: 260, height: 8, fill: '#ffd700', rx: 4, ry: 4,
                isExtraOverride: true, customType: 'top-accent', selectable: true, evented: true
            });
            freeformCanvas.add(accentLine); freeformCanvas.setActiveObject(accentLine);
            break;
        case 'accent-bar':
            const accentBar = new fabric.Rect({
                left: pointerX, top: pointerY, originX: 'center', originY: 'center',
                width: 14, height: 400, fill: '#ffd700', rx: 7, ry: 7,
                isExtraOverride: true, customType: 'bold-vertical-bar', selectable: true, evented: true
            });
            freeformCanvas.add(accentBar); freeformCanvas.setActiveObject(accentBar);
            break;
        case 'image-placeholder':
            const placeholder = new fabric.Rect({
                left: pointerX, top: pointerY, originX: 'center', originY: 'center',
                width: 300, height: 300, fill: '#e1e1e1',
                stroke: '#888888', strokeDashArray: [5, 5], strokeWidth: 2,
                isExtraOverride: true, customType: 'custom-image-box'
            });
            freeformCanvas.add(placeholder); freeformCanvas.setActiveObject(placeholder);
            break;
        case 'brand-logo':
            const selectedBrandId = document.getElementById('canvas-brand-selector')?.value;
            const brand = allBrands.find(b => b.id === selectedBrandId) || allBrands[0] || currentBranding;
            const logoPath = (brand && brand.logoUrl) ? brand.logoUrl : 'assets/images/logo.png';
            fabric.Image.fromURL(logoPath, (img) => {
                if (img) {
                    img.set({ left: pointerX, top: pointerY, originX: 'center', originY: 'center', isExtraOverride: true });
                    img.scaleToWidth(150);
                    freeformCanvas.add(img); freeformCanvas.setActiveObject(img);
                }
            }, { crossOrigin: 'anonymous' });
            break;
    }
}

// Brand Options
function loadCanvasBrandOptions() {
    const sel = document.getElementById('canvas-brand-selector');
    if (!sel) return;
    sel.innerHTML = '';
    allBrands.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name;
        sel.appendChild(opt);
    });
    if (currentBranding) {
        sel.value = currentBranding.id;
    }
}

// AI Image Generation
document.getElementById('canvas-generate-ai')?.addEventListener('click', () => {
    const prompt = document.getElementById('canvas-ai-prompt').value.trim();
    if (!prompt) {
        showToast('Please enter an image prompt', 'error');
        return;
    }
    
    const loading = document.getElementById('canvas-ai-loading');
    if (loading) loading.style.display = 'block';
    
    // Simulate generation with Pollinations (using same method as NewsLab)
    const seed = Math.floor(Math.random() * 100000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}&nologo=true&width=1080&height=1080`;
    
    setTimeout(() => {
        if (loading) loading.style.display = 'none';
        fabric.Image.fromURL(imageUrl, (img) => {
            img.set({ left: CANVAS_W / 2, top: CANVAS_H / 2, originX: 'center', originY: 'center' });
            img.scaleToWidth(500);
            freeformCanvas.add(img);
            freeformCanvas.setActiveObject(img);
        }, { crossOrigin: 'anonymous' });
        showToast('Generated image added to canvas!');
    }, 1000);
});

// Export PNG
document.getElementById('canvas-export-btn')?.addEventListener('click', () => {
    if (!freeformCanvas) return;
    freeformCanvas.discardActiveObject();
    freeformCanvas.requestRenderAll();
    
    const dataUrl = freeformCanvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 1 / CANVAS_ZOOM // Render at full 1080x1350 resolution
    });
    
    const link = document.createElement('a');
    link.download = `canvas-export-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
});




// ============================================================
// LabEngine-v1: Psychology & Mind Lab Engine Logic
// ============================================================


// Global Delegation for Psychology Lab Controls
document.addEventListener('click', (e) => {
    const presetBtn = e.target.closest('.psych-preset-btn');
    if (presetBtn) {
        const topicInput = document.getElementById('psych-topic-input');
        if (topicInput && presetBtn.dataset.topic) {
            topicInput.value = presetBtn.dataset.topic;
        }
        return;
    }

    const modeBtn = e.target.closest('.psych-mode-btn');
    if (modeBtn) {
        document.querySelectorAll('.psych-mode-btn').forEach(b => b.classList.remove('active'));
        modeBtn.classList.add('active');
        psychCurrentMode = modeBtn.dataset.mode || 'GENERATE';
        const genControls = document.getElementById('psych-generate-controls');
        if (genControls) {
            genControls.style.display = psychCurrentMode === 'GENERATE' ? 'flex' : 'none';
        }
        return;
    }
});

function initPsychLab() {
    const brandSelect = document.getElementById('psych-brand-select');
    if (brandSelect) {
        brandSelect.innerHTML = '';
        allBrands.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.name + ' (' + (b.handle || '') + ')';
            brandSelect.appendChild(opt);
        });
    }

    if (window.psychLabInitialized) return;
    window.psychLabInitialized = true;

    if (!psychCanvas) {
        const cEl = document.getElementById('psych-slide-canvas');
        if (cEl) {
            psychCanvas = new fabric.Canvas('psych-slide-canvas', {
                backgroundColor: '#0B0C10',
                selection: false
            });
        }
    }

    // Guard: only bind listeners once to prevent multiple submissions per click
    if (psychLabListenersBound) return;
    psychLabListenersBound = true;

    document.querySelectorAll('.psych-mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.psych-mode-btn').forEach(b => b.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            psychCurrentMode = target.dataset.mode;

            const genControls = document.getElementById('psych-generate-controls');
            if (genControls) {
                genControls.style.display = psychCurrentMode === 'GENERATE' ? 'flex' : 'none';
            }
        });
    });

    document.querySelectorAll('.psych-preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const topicInput = document.getElementById('psych-topic-input');
            if (topicInput) topicInput.value = e.currentTarget.dataset.topic;
        });
    });

    document.getElementById('psych-prev-slide')?.addEventListener('click', () => {
        if (currentPsychSlideIndex > 0) {
            currentPsychSlideIndex--;
            renderPsychCurrentSlide();
        }
    });

    document.getElementById('psych-next-slide')?.addEventListener('click', () => {
        if (currentPsychSlideIndex < currentPsychSlides.length - 1) {
            currentPsychSlideIndex++;
            renderPsychCurrentSlide();
        }
    });

    document.getElementById('psych-copy-caption')?.addEventListener('click', () => {
        const capText = document.getElementById('psych-caption-text')?.value;
        if (capText) {
            navigator.clipboard.writeText(capText);
            showToast('Caption & hashtags copied to clipboard!');
        }
    });

    document.getElementById('psych-export-btn')?.addEventListener('click', async () => {
        if (!psychCanvas || currentPsychSlides.length === 0) return;
        showToast('Exporting Psychology Deck...');
        const zip = new JSZip();
        for (let i = 0; i < currentPsychSlides.length; i++) {
            currentPsychSlideIndex = i;
            renderPsychCurrentSlide();
            const dataUrl = psychCanvas.toDataURL({ format: 'png' });
            const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
            zip.file(`slide_${i + 1}.png`, base64Data, { base64: true });
        }
        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `Psychology_Lab_Deck_${Date.now()}.zip`;
        link.click();
        showToast('Deck exported successfully!');
    });

    let isGeneratingPsych = false;
    document.getElementById('psych-submit-btn')?.addEventListener('click', async () => {
        if (isGeneratingPsych) return; // Prevent double click / duplicate submissions
        isGeneratingPsych = true;

        const topic = document.getElementById('psych-topic-input')?.value;
        if (!topic || !topic.trim()) {
            alert('Please enter a psychology topic or select a preset topic first.');
            isGeneratingPsych = false;
            return;
        }

        const brandId = document.getElementById('psych-brand-select')?.value;
        const brandObj = (typeof allBrands !== 'undefined' && allBrands && allBrands.length > 0) ? (allBrands.find(b => b.id === brandId) || allBrands[0]) : (currentBranding || { name: "Creator's Den", handle: "@ammaazzingg" });
        const targetMetric = document.getElementById('psych-metric-select')?.value || 'SAVES';
        const formatType = document.getElementById('psych-format-select')?.value || 'CAROUSEL';

        const btn = document.getElementById('psych-submit-btn');
        btn.disabled = true;
        btn.innerHTML = '<i data-feather="loader" class="spin"></i> Running LabEngine Intelligence...';
        if (window.feather) feather.replace();

        const resultsContainer = document.getElementById('psych-results-container');
        const researchCard = document.getElementById('psych-research-card');
        const generateCard = document.getElementById('psych-generate-card');

        try {
            const res = await fetch(`${API_URL}/generate-psych`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: psychCurrentMode,
                    topic: topic.trim(),
                    target_metric: targetMetric,
                    content_type: formatType,
                    brand_context: brandObj,
                    brand_id: brandId,
                    user_id: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null
                })
            });

            const data = await res.json();
            btn.disabled = false;
            btn.innerHTML = '<i data-feather="zap"></i> Run LabEngine Intelligence';
            if (window.feather) feather.replace();
            isGeneratingPsych = false;

            if (!data.success) {
                alert('Generation error: ' + (data.error || 'Unknown error'));
                return;
            }

            resultsContainer.style.display = 'block';

            if (data.mode === 'RESEARCH') {
                resultsContainer.style.display = 'block';
                researchCard.style.display = 'block';
                generateCard.style.display = 'none';
                renderPsychResearchMarkdown(data.markdown);
            } else {
                // GENERATE mode: Display preview card with generated slides
                resultsContainer.style.display = 'block';
                generateCard.style.display = 'block';
                researchCard.style.display = 'none';

                const outputData = data.data || {};
                let generatedSlides = [];
                if (outputData.carousel && outputData.carousel.slides) {
                    generatedSlides = outputData.carousel.slides.map((s, idx) => {
                        let bodyContent = s.body_text || s.content || '';
                        if (idx === 0 && !bodyContent && s.subtitle_text) {
                            bodyContent = s.subtitle_text;
                        } else if (s.subtitle_text && bodyContent && !bodyContent.includes(s.subtitle_text)) {
                            bodyContent = `${s.subtitle_text}\n\n${bodyContent}`;
                        }
                        return {
                            slide_number: idx + 1,
                            type: s.type || (idx === 0 ? 'HOOK_COVER' : (idx === outputData.carousel.slides.length - 1 ? 'CTA_FINAL' : 'BODY_VAL')),
                            title_text: s.title_text || s.title || `Slide ${idx + 1}`,
                            title: s.title_text || s.title || `Slide ${idx + 1}`,
                            subtitle_text: s.subtitle_text || '',
                            body_text: bodyContent,
                            content: bodyContent,
                            header_text: s.header_text || brandObj?.handle || '@ammaazzingg',
                            is_cta: s.is_cta || s.type === 'CTA_FINAL' || false
                        };
                    });
                } else if (outputData.single_slide) {
                    generatedSlides = [{
                        slide_number: 1,
                        type: 'HOOK_COVER',
                        title_text: outputData.single_slide.quote_text || 'Psychology Insight',
                        title: outputData.single_slide.quote_text || 'Psychology Insight',
                        subtitle_text: '',
                        body_text: '',
                        content: '',
                        header_text: outputData.single_slide.attribution || brandObj?.handle || '@ammaazzingg',
                        is_cta: false
                    }];
                }
                if (generatedSlides.length < 8 && generatedSlides.length >= 2) {
                    let expanded = [];
                    const hookSlide = generatedSlides[0];
                    const ctaSlide = generatedSlides[generatedSlides.length - 1];
                    const middleSlides = generatedSlides.slice(1, generatedSlides.length - 1);

                    expanded.push(hookSlide);

                    let bodyPool = [];
                    middleSlides.forEach(s => {
                        const text = (s.body_text || s.content || s.subtitle_text || '');
                        const parts = text.split(/\n\n|\n(?=[0-9]\.|Shift|Step|Solution)/i).filter(p => p.trim().length > 10);
                        if (parts.length > 1) {
                            parts.forEach((pt, pIdx) => {
                                bodyPool.push({
                                    type: s.type || 'BODY_VAL',
                                    header_text: s.header_text || brandObj?.handle || '@ammaazzingg',
                                    title_text: pIdx === 0 ? (s.title_text || s.title) : `Key Practical Action #${pIdx + 1}`,
                                    title: pIdx === 0 ? (s.title_text || s.title) : `Key Practical Action #${pIdx + 1}`,
                                    body_text: pt.trim(),
                                    content: pt.trim(),
                                    is_cta: false
                                });
                            });
                        } else {
                            bodyPool.push(s);
                        }
                    });

                    while (bodyPool.length < 6) {
                        bodyPool.push({
                            type: 'BODY_VAL',
                            header_text: brandObj?.handle || '@ammaazzingg',
                            title_text: `Practical Reframe & Action Plan`,
                            title: `Practical Reframe & Action Plan`,
                            body_text: `Apply this daily: When you feel this psychological trigger, take 3 slow breaths, name the cognitive pattern without judgment, and re-center on your current task.`,
                            content: `Apply this daily: When you feel this psychological trigger, take 3 slow breaths, name the cognitive pattern without judgment, and re-center on your current task.`,
                            is_cta: false
                        });
                    }

                    bodyPool.slice(0, 7).forEach(s => expanded.push(s));
                    expanded.push(ctaSlide);
                    generatedSlides = expanded.map((s, idx) => ({ ...s, slide_number: idx + 1 }));
                }

                currentPsychSlides = generatedSlides;
                currentPsychSlideIndex = 0;
                renderPsychCurrentSlide();

                const capObj = outputData.caption || {};
                const postPayload = {
                    slides: generatedSlides,
                    caption: capObj,
                    brand_snapshot: brandObj,
                    brand_id: brandId
                };

                let newPost = data.post;
                if (newPost) {
                    newPost.text = JSON.stringify(postPayload);
                    newPost.brand_id = brandId;
                    newPost.image_url = JSON.stringify(generatedSlides.map(() => null));
                } else {
                    newPost = {
                        id: data.post_id || ('psych_' + Date.now()),
                        topic: `[Psychology Lab] ${topic.substring(0, 60)}`,
                        text: JSON.stringify(postPayload),
                        image_url: JSON.stringify(generatedSlides.map(() => null)),
                        status: 'Draft',
                        brand_id: brandId,
                        updated_at: new Date().toISOString()
                    };
                }

                // Populate caption & scripts UI
                const capEl = document.getElementById('psych-caption-text');
                if (capEl) {
                    const tagStr = (capObj.hashtags && Array.isArray(capObj.hashtags)) ? capObj.hashtags.join(' ') : '#psychology #mentalmodels';
                    capEl.value = `${capObj.hook || ''}\n\n${capObj.body || ''}\n\n${capObj.cta || ''}\n\n${tagStr}`.trim();
                }

                const reelObj = outputData.reel_blueprint || {};
                const reelCard = document.getElementById('psych-reel-card');
                if (reelCard && reelObj.enabled) {
                    reelCard.style.display = 'block';
                    const audioIn = document.getElementById('psych-reel-audio-script');
                    const videoIn = document.getElementById('psych-reel-video-script');
                    if (audioIn) audioIn.value = reelObj.audio_script || '';
                    if (videoIn) videoIn.value = reelObj.video_script || '';
                    window.currentPsychFullReelScript = reelObj.full_script_markdown || reelObj.audio_script || '';
                } else if (reelCard) {
                    reelCard.style.display = 'none';
                }

                // Only save to mockPosts if backend didn't save to Supabase
                if (!data.post && (window.isMockMode || isMockMode)) {
                    const existingIdx = mockPosts.findIndex(p => p.id === newPost.id);
                    if (existingIdx >= 0) mockPosts[existingIdx] = newPost;
                    else mockPosts.unshift(newPost);
                    saveMockPosts();
                }

                window.lastGeneratedPost = newPost;
                ['queue-brand-filter', 'status-filter'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = 'All';
                });
                await loadQueue();

                showToast('Psychology deck generated! Opening in Design Studio...');
                if (document.getElementById('psych-open-in-studio-btn')) {
                    document.getElementById('psych-open-in-studio-btn').dataset.postId = newPost.id;
                }
                if (window.openEditor && newPost) {
                    window.openEditor(newPost);
                }
            }
        } catch (err) {
            isGeneratingPsych = false;
            btn.disabled = false;
            btn.innerHTML = '<i data-feather="zap"></i> Run LabEngine Intelligence';
            if (window.feather) feather.replace();
            alert('Error connecting to backend: ' + err.message);
        }
    });

    document.getElementById('psych-send-to-manual-btn')?.addEventListener('click', transferPsychToManual);
    document.getElementById('psych-open-in-studio-btn')?.addEventListener('click', transferPsychToStudio);
    document.getElementById('psych-send-to-queue-btn')?.addEventListener('click', savePsychToQueue);

    document.getElementById('psych-copy-audio')?.addEventListener('click', async () => {
        const val = document.getElementById('psych-reel-audio-script')?.value;
        if (val) { await window.copyToClipboard(val); showToast('Detailed Audio Script copied!'); }
    });

    document.getElementById('psych-copy-video')?.addEventListener('click', async () => {
        const val = document.getElementById('psych-reel-video-script')?.value;
        if (val) { await window.copyToClipboard(val); showToast('Detailed Video Script copied!'); }
    });

    document.getElementById('psych-copy-full-reel')?.addEventListener('click', async () => {
        const fullScript = window.currentPsychFullReelScript || document.getElementById('psych-reel-audio-script')?.value;
        if (fullScript) { await window.copyToClipboard(fullScript); showToast('Full Teleprompter Reel Script copied!'); }
    });
    
    document.getElementById('psych-copy-caption')?.addEventListener('click', async () => {
        const val = document.getElementById('psych-caption-text')?.value;
        if (val) { await window.copyToClipboard(val); showToast('Psychology Caption copied!'); }
    });

    document.getElementById('psych-convert-angle-btn')?.addEventListener('click', () => {
        document.querySelector('.psych-mode-btn[data-mode="GENERATE"]')?.click();
        window.scrollTo({ top: document.getElementById('psych-view').offsetTop, behavior: 'smooth' });
    });
}

window.initPsychLab = initPsychLab;

let lastGeneratedPsychData = null;

function transferPsychToManual() {
    const slides = (currentPsychSlides && currentPsychSlides.length > 0) ? currentPsychSlides : window.currentPsychSlides;
    if (!slides || slides.length === 0) {
        showToast('No generated Psychology content available.');
        return;
    }
    const topic = document.getElementById('psych-topic-input')?.value || 'Psychology Topic';
    
    const formattedPayload = {
        slides: slides.map((s, idx) => ({
            title: s.title_text || s.title || `Slide ${idx+1}`,
            content: s.body_text || s.content || '',
            header_text: s.header_text || '',
            is_cta: s.is_cta || false
        })),
        caption: {
            hook: document.getElementById('psych-caption-text')?.value?.split('\n\n')[0] || '',
            body: document.getElementById('psych-caption-text')?.value || '',
            cta: 'Save this post to remember it later!',
            hashtags: { niche: ["#psychology", "#mindset"], broad: ["#behavior"], high_intent: ["#mentalmodels"] }
        }
    };

    const topicInput = document.getElementById('manual-topic');
    if (topicInput) topicInput.value = topic;

    const manualSelect = document.getElementById('manual-content-type');
    if (manualSelect) manualSelect.value = 'Concept Deep Dive';

    switchView('manual-view');
    showToast('Psychology post transferred to Manual Input for editing!');
}

function transferPsychToStudio() {
    const postId = document.getElementById('psych-open-in-studio-btn').dataset.postId;
    if (!postId) {
        showToast('Please generate a deck first.');
        return;
    }
    window.openEditor(postId);
    showToast('Opening Psychology post in Editor...');
}

window.transferPsychToManual = transferPsychToManual;
window.transferPsychToStudio = transferPsychToStudio;
window.savePsychToQueue = savePsychToQueue;

async function savePsychToQueue() {
    const existingPostId = document.getElementById('psych-open-in-studio-btn')?.dataset?.postId;
    if (existingPostId) {
        showToast('✓ This deck is already saved in your Content Queue!');
        return;
    }
    if (!currentPsychSlides || currentPsychSlides.length === 0) {
        showToast('No generated Psychology content to save.');
        return;
    }

    const topic = document.getElementById('psych-topic-input')?.value || 'Psychology Topic';
    const brandId = document.getElementById('psych-brand-select')?.value || activeBrandId;
    const captionStr = document.getElementById('psych-caption-text')?.value || '';

    const newPost = {
        id: 'psych_' + Date.now(),
        topic: `[Psychology Lab] ${topic}`,
        text: JSON.stringify({
            slides: currentPsychSlides,
            caption: { body: captionStr }
        }),
        image_url: JSON.stringify(currentPsychSlides.map(() => null)),
        status: 'Draft',
        brand_id: brandId,
        updated_at: new Date().toISOString()
    };

    if (isMockMode) {
        mockPosts.unshift(newPost);
        saveMockPosts();
    } else {
        await supabase.from('posts').insert([newPost]);
    }
    if (document.getElementById('psych-open-in-studio-btn')) {
        document.getElementById('psych-open-in-studio-btn').dataset.postId = newPost.id;
    }
    await loadQueue();
    showToast('✓ Psychology post saved to Content Queue!');
}

function renderPsychResearchMarkdown(markdownStr) {
    const target = document.getElementById('psych-research-markdown');
    if (!target) return;

    let html = markdownStr
        .replace(/^### (.*$)/gim, '<h4 style="font-size: 16px; font-weight: 700; color: #818cf8; margin: 16px 0 8px 0;">$1</h4>')
        .replace(/^## (.*$)/gim, '<h3 style="font-size: 18px; font-weight: 700; color: #a7f3d0; margin: 20px 0 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">$1</h3>')
        .replace(/^# (.*$)/gim, '<h2 style="font-size: 22px; font-weight: 800; color: #ffffff; margin: 24px 0 12px 0;">$1</h2>')
        .replace(/^\* (.*$)/gim, '<li style="margin-left: 20px;">$1</li>')
        .replace(/^- (.*$)/gim, '<li style="margin-left: 20px;">$1</li>')
        .replace(/\*\*(.*?)\*\*/gim, '<strong style="color: #f8fafc;">$1</strong>')
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
        .replace(/\n\n/gim, '<br><br>');

    target.innerHTML = html;
}

function renderPsychCurrentSlide() {
    window.currentPsychSlides = currentPsychSlides;
    if (!psychCanvas || currentPsychSlides.length === 0) return;
    const slide = currentPsychSlides[currentPsychSlideIndex];

    const counterEl = document.getElementById('psych-slide-counter');
    if (counterEl) {
        counterEl.textContent = `Slide ${currentPsychSlideIndex + 1} of ${currentPsychSlides.length}`;
    }

    psychCanvas.clear();
    psychCanvas.backgroundColor = '#0B0C10';

    const headerText = new fabric.Text(slide.header_text || (currentBranding?.handle || '@ammaazzingg'), {
        left: 40, top: 40,
        fontSize: 14, fontFamily: 'Inter, sans-serif',
        fontWeight: '700', fill: '#6366f1', letterSpacing: 2
    });
    psychCanvas.add(headerText);

    const accentLine = new fabric.Rect({
        left: 40, top: 70,
        width: 80, height: 4,
        fill: '#ffd700', rx: 2, ry: 2
    });
    psychCanvas.add(accentLine);

    const titleText = new fabric.Textbox(slide.title_text || '', {
        left: 40, top: 110, width: 460,
        fontSize: slide.type === 'HOOK_COVER' ? 32 : 24,
        fontFamily: 'Inter, sans-serif',
        fontWeight: '800', fill: '#f8fafc',
        lineHeight: 1.2
    });
    psychCanvas.add(titleText);

    const titleHeight = titleText.getScaledHeight();
    const bodyTop = Math.max(110 + titleHeight + 25, 230);

    const bodyStr = (slide.type === 'HOOK_COVER' && slide.subtitle_text)
        ? slide.subtitle_text
        : (slide.body_text || slide.content || slide.subtitle_text || '');

    if (bodyStr) {
        const bodyText = new fabric.Textbox(bodyStr, {
            left: 40, top: bodyTop, width: 460,
            fontSize: slide.type === 'HOOK_COVER' ? 20 : 17,
            fontFamily: 'Inter, sans-serif',
            fontWeight: slide.type === 'HOOK_COVER' ? '500' : '400',
            fill: slide.type === 'HOOK_COVER' ? '#e2e8f0' : '#94a3b8',
            lineHeight: 1.5
        });
        psychCanvas.add(bodyText);
    }

    const footerText = new fabric.Text(slide.is_cta ? 'SAVE & SHARE WITH A FRIEND' : 'LABENGINE-V1 / PSYCHOLOGY', {
        left: 40, top: 615,
        fontSize: 12, fontFamily: 'Inter, sans-serif',
        fontWeight: '600', fill: slide.is_cta ? '#ffd700' : '#475569'
    });
    psychCanvas.add(footerText);

    psychCanvas.renderAll();
}

// ============================================================
// 10. MCQ VIDEO CREATOR & ANIMATED REEL STUDIO
// ============================================================
let mcqStudioInitialized = false;
let mcqState = {
    questions: [
        {
            id: 1,
            question: "नेपालको सबैभन्दा गहिरो नदी कुन हो?",
            options: ["A. कोशी नदी", "B. गण्डकी नदी", "C. कर्णाली नदी", "D. महाकाली नदी"],
            correct_index: 1,
            correct_option: "B. गण्डकी नदी",
            explanation: "गण्डकी (त्रिशूली-नारायणी) नदी नेपालको सबैभन्दा गहिरो नदी हो। यसको गहिराइ ३,९०४ मिटर रहेको छ।"
        },
        {
            id: 2,
            question: "विश्वको सर्वोच्च शिखर सगरमाथाको उचाइ कति मिटर छ?",
            options: ["A. 8,848.86m", "B. 8,844.43m", "C. 8,850.00m", "D. 8,840.50m"],
            correct_index: 0,
            correct_option: "A. 8,848.86m",
            explanation: "नेपाल र चीनद्वारा संयुक्त रूपमा मापन गरिएको सगरमाथाको पछिल्लो आधिकारिक उचाइ ८,८४८.८६ मिटर हो।"
        },
        {
            id: 3,
            question: "क्षेत्रफलको हिसाबले नेपालको सबैभन्दा ठूलो जिल्ला कुन हो?",
            options: ["A. हुम्ला", "B. मनाङ", "C. डोल्पा", "D. मुस्ताङ"],
            correct_index: 2,
            correct_option: "C. डोल्पा",
            explanation: "डोल्पा नेपालको सबैभन्दा ठूलो जिल्ला हो, जसको क्षेत्रफल ७,८८९ वर्ग किलोमिटर रहेको छ।"
        }
    ],
    currentIndex: 0,
    phase: 'IDLE', // 'IDLE', 'QUESTION', 'OPTIONS', 'COUNTDOWN', 'ANSWER'
    qCharCount: 0,
    optCharCounts: [0, 0, 0, 0],
    countdownSec: 3,
    countdownArc: 1.0,
    expCharCount: 0,
    outroCharCount: 0,
    isPlaying: false,
    isExporting: false,
    isPreloadingAudio: false,
    speechId: 0,
    animFrameId: null,
    stepTimer: null,
    typewriterInterval: null,
    audioCache: {}
};
window.mcqState = mcqState;
window.getMCQAudioDestination = getMCQAudioDestination;
window.stopCurrentMCQAudio = stopCurrentMCQAudio;
window.playMCQBeep = playMCQBeep;
window.fetchAudioBuffer = fetchAudioBuffer;
window.updateMCQAudioProgress = updateMCQAudioProgress;
window.getMCQExplanationText = getMCQExplanationText;
window.formatMMSS = formatMMSS;
window.buildMCQTimelineMap = buildMCQTimelineMap;
window.updateMCQSectionPills = updateMCQSectionPills;
window.jumpMCQToSection = jumpMCQToSection;
window.seekMCQToTime = seekMCQToTime;
window.updateMCQTimelineProgress = updateMCQTimelineProgress;
window.preloadMCQAudioDeck = preloadMCQAudioDeck;
window.speakMCQText = speakMCQText;
window.drawMCQCanvas = drawMCQCanvas;
window.startMCQSequence = startMCQSequence;
window.stopMCQSequence = stopMCQSequence;
window.exportMCQVideo = exportMCQVideo;
window.initMCQVideoStudio = initMCQVideoStudio;

let mcqAudioCtx = null;
let mcqAudioDest = null;
let currentBufferSource = null;
let currentAudioEl = null;

function getMCQAudioDestination() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        if (!mcqAudioCtx) {
            mcqAudioCtx = new AudioCtx({ sampleRate: 44100 });
        }
        if (mcqAudioCtx.state === 'suspended') {
            mcqAudioCtx.resume().catch(() => {});
        }
        if (!mcqAudioDest) {
            mcqAudioDest = mcqAudioCtx.createMediaStreamDestination();
        }
        return mcqAudioDest;
    } catch(e) {
        console.warn("getMCQAudioDestination error:", e);
        return null;
    }
}

function stopCurrentMCQAudio() {
    mcqState.speechId = (mcqState.speechId || 0) + 1;

    if (currentBufferSource) {
        try {
            currentBufferSource.onended = null;
            currentBufferSource.stop();
        } catch(e){}
        currentBufferSource = null;
    }
    if (currentAudioEl) {
        try {
            currentAudioEl.onended = null;
            if (typeof currentAudioEl.stop === 'function') {
                currentAudioEl.stop();
            } else if (typeof currentAudioEl.pause === 'function') {
                currentAudioEl.pause();
            }
        } catch(e){}
        currentAudioEl = null;
    }
    if (window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch(e){}
    }
    if (mcqState.typewriterInterval) {
        if (typeof mcqState.typewriterInterval === 'number') {
            cancelAnimationFrame(mcqState.typewriterInterval);
            clearInterval(mcqState.typewriterInterval);
        }
        mcqState.typewriterInterval = null;
    }
}

function playMCQBeep(freq, durationMs) {
    try {
        const destNode = getMCQAudioDestination();
        const ctx = mcqAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (durationMs / 1000));
        osc.connect(gain);
        gain.connect(ctx.destination);
        if (destNode) gain.connect(destNode);
        osc.start();
        osc.stop(ctx.currentTime + (durationMs / 1000));
    } catch (e) {}
}

async function fetchAudioBuffer(text, lang) {
    if (!text) return null;
    if (mcqState.audioCache[text]) return mcqState.audioCache[text];

    try {
        getMCQAudioDestination();
        if (!mcqAudioCtx) return null;
        if (mcqAudioCtx.state === 'suspended') {
            mcqAudioCtx.resume().catch(() => {});
        }

        const res = await fetch(`${API_URL}/generate-tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, language: lang })
        });
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) return null;

        const data = await res.json();
        if (!data || !data.audio_url) return null;

        let arrayBuf;
        if (data.audio_url.startsWith('data:')) {
            const base64Str = data.audio_url.split(',')[1];
            const binaryStr = window.atob(base64Str);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            arrayBuf = bytes.buffer;
        } else {
            return null;
        }

        const decodedBuffer = await new Promise((resolve, reject) => {
            try {
                const res = mcqAudioCtx.decodeAudioData(arrayBuf, buf => resolve(buf), err => reject(err));
                if (res && typeof res.then === 'function') {
                    res.then(resolve).catch(reject);
                }
            } catch(err) {
                reject(err);
            }
        });
        mcqState.audioCache[text] = decodedBuffer;
        return decodedBuffer;
    } catch(e) {
        console.warn("fetchAudioBuffer warning:", e);
        return null;
    }
}

function updateMCQAudioProgress(current, total, statusText = '') {
    const bar = document.getElementById('mcq-progress-bar-inner');
    const label = document.getElementById('mcq-progress-text');
    const container = document.getElementById('mcq-progress-container');

    const pct = Math.min(100, Math.round((current / Math.max(1, total)) * 100));

    if (container) {
        if (pct < 100) {
            container.style.display = 'flex';
        } else {
            setTimeout(() => {
                container.style.display = 'none';
            }, 1000);
        }
    }

    if (bar) bar.style.width = `${pct}%`;
    if (label) label.innerText = statusText || `🎙️ Generating HD Voice Narration... ${current} / ${total} (${pct}%)`;
}

function getMCQExplanationText(qData) {
    if (!qData) return '';
    let correctStr = qData.correct_option || '';
    if ((!correctStr || correctStr.length <= 3) && qData.options && qData.correct_index !== undefined && qData.options[qData.correct_index]) {
        correctStr = qData.options[qData.correct_index];
    }
    const exp = qData.explanation || '';
    return `सही उत्तर: ${correctStr}। ${exp}`;
}

function formatMMSS(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
}

function buildMCQTimelineMap() {
    const map = [];
    let currentTime = 0;

    if (!mcqState.questions || mcqState.questions.length === 0) return { map: [], totalTime: 0 };

    mcqState.questions.forEach((q, idx) => {
        // Question phase
        const qText = q.question || '';
        const qBuf = mcqState.audioCache[qText];
        const qDur = qBuf ? qBuf.duration : Math.max(3, qText.length * 0.08);
        map.push({
            qIndex: idx,
            phase: 'QUESTION',
            label: `Q${idx + 1} Question`,
            pillLabel: `Q${idx + 1}`,
            startTime: currentTime,
            duration: qDur
        });
        currentTime += qDur;

        // Options phase
        let optDurSum = 0;
        if (q.options) {
            q.options.forEach(opt => {
                const optBuf = mcqState.audioCache[opt];
                optDurSum += (optBuf ? optBuf.duration : Math.max(1.5, opt.length * 0.08)) + 0.25;
            });
        }
        map.push({
            qIndex: idx,
            phase: 'OPTIONS',
            label: `Q${idx + 1} Options`,
            pillLabel: `Q${idx + 1} Opts`,
            startTime: currentTime,
            duration: optDurSum
        });
        currentTime += optDurSum;

        // Countdown phase
        map.push({
            qIndex: idx,
            phase: 'COUNTDOWN',
            label: `Q${idx + 1} Timer`,
            pillLabel: `Q${idx + 1} Timer`,
            startTime: currentTime,
            duration: 3.0
        });
        currentTime += 3.0;

        // Explanation phase
        const expText = getMCQExplanationText(q);
        const expBuf = mcqState.audioCache[expText];
        const expDur = (expBuf ? expBuf.duration : Math.max(5, expText.length * 0.08)) + 1.5;
        map.push({
            qIndex: idx,
            phase: 'EXPLANATION',
            label: `Q${idx + 1} Explanation`,
            pillLabel: `Q${idx + 1} Exp`,
            startTime: currentTime,
            duration: expDur
        });
        currentTime += expDur;
    });

    // Outro phase
    const outroText = "लोकसेवा तयारी तथा नयाँ जानकारीका लागि हाम्रो पानालाई लाइक, सेयर र फलो गर्न नबिर्सिनुहोला! धन्यवाद!";
    const outroBuf = mcqState.audioCache[outroText];
    const outroDur = outroBuf ? outroBuf.duration : 8.0;
    map.push({
        qIndex: mcqState.questions.length - 1,
        phase: 'OUTRO',
        label: `Outro`,
        pillLabel: `Outro`,
        startTime: currentTime,
        duration: outroDur
    });
    currentTime += outroDur;

    return { map, totalTime: currentTime };
}

function updateMCQSectionPills() {
    const container = document.getElementById('mcq-section-pills');
    if (!container) return;

    const { map } = buildMCQTimelineMap();
    container.innerHTML = '';

    map.forEach(seg => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isActive = (seg.qIndex === mcqState.currentIndex && seg.phase === mcqState.phase) || (seg.phase === 'OUTRO' && mcqState.phase === 'OUTRO');

        btn.style.cssText = `
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            border: 1px solid ${isActive ? '#38bdf8' : 'rgba(255,255,255,0.15)'};
            background: ${isActive ? 'linear-gradient(135deg, #0284c7, #6366f1)' : 'rgba(255,255,255,0.06)'};
            color: ${isActive ? '#ffffff' : 'rgba(255,255,255,0.7)'};
            transition: all 0.15s ease;
        `;
        btn.innerText = seg.pillLabel;

        btn.onclick = () => {
            jumpMCQToSection(seg.qIndex, seg.phase);
        };
        container.appendChild(btn);
    });
}

function jumpMCQToSection(qIndex, phase) {
    mcqState.isExporting = false;
    stopMCQSequence(true);

    mcqState.currentIndex = qIndex;
    mcqState.phase = phase;

    const qData = mcqState.questions[qIndex] || mcqState.questions[0];
    const lang = document.getElementById('mcq-language')?.value || 'Nepali';

    if (phase === 'QUESTION') {
        mcqState.qCharCount = qData.question ? qData.question.length : 0;
        mcqState.optCharCounts = [0, 0, 0, 0];
        mcqState.expCharCount = 0;
    } else if (phase === 'OPTIONS') {
        mcqState.qCharCount = qData.question ? qData.question.length : 0;
        mcqState.optCharCounts = qData.options ? qData.options.map(o => o ? o.length : 0) : [0, 0, 0, 0];
        mcqState.expCharCount = 0;
    } else if (phase === 'COUNTDOWN') {
        mcqState.qCharCount = qData.question ? qData.question.length : 0;
        mcqState.optCharCounts = qData.options ? qData.options.map(o => o ? o.length : 0) : [0, 0, 0, 0];
        mcqState.countdownSec = 3;
        mcqState.countdownArc = 1.0;
        mcqState.expCharCount = 0;
    } else if (phase === 'EXPLANATION') {
        mcqState.expCharCount = qData.explanation ? qData.explanation.length : 0;
    } else if (phase === 'OUTRO') {
        mcqState.outroCharCount = 80;
    }

    updateMCQEditorFields();
    updateMCQSectionPills();
    drawMCQCanvas();

    mcqState.isPlaying = true;
    if (phase === 'QUESTION') {
        startMCQSequence();
    } else if (phase === 'OPTIONS') {
        startMCQSequence();
    } else if (phase === 'COUNTDOWN') {
        startMCQCountdown(lang, qData);
    } else if (phase === 'EXPLANATION') {
        revealMCQAnswer(lang, qData);
    } else if (phase === 'OUTRO') {
        startMCQOutro(lang);
    }
}

function seekMCQToTime(targetSec) {
    const { map } = buildMCQTimelineMap();
    if (map.length === 0) return;

    let foundSeg = map[0];
    for (let i = 0; i < map.length; i++) {
        const seg = map[i];
        if (targetSec >= seg.startTime && targetSec <= seg.startTime + seg.duration) {
            foundSeg = seg;
            break;
        }
    }

    jumpMCQToSection(foundSeg.qIndex, foundSeg.phase);
}

function updateMCQTimelineProgress() {
    const { map, totalTime } = buildMCQTimelineMap();
    if (totalTime <= 0) return;

    let elapsedSec = 0;
    for (let i = 0; i < map.length; i++) {
        const seg = map[i];
        if (seg.qIndex === mcqState.currentIndex && seg.phase === mcqState.phase) {
            elapsedSec = seg.startTime;
            break;
        } else if (seg.phase === 'OUTRO' && mcqState.phase === 'OUTRO') {
            elapsedSec = seg.startTime;
            break;
        }
    }

    const pct = Math.min(100, Math.max(0, (elapsedSec / totalTime) * 100));
    const sliderEl = document.getElementById('mcq-timeline-slider');
    const timeLabel = document.getElementById('mcq-time-label');

    if (sliderEl && !sliderEl.matches(':active')) {
        sliderEl.value = pct;
    }
    if (timeLabel) {
        timeLabel.innerText = `${formatMMSS(elapsedSec)} / ${formatMMSS(totalTime)}`;
    }

    if (mcqState.isExporting) {
        const exportBtn = document.getElementById('mcq-export-btn');
        if (exportBtn) {
            exportBtn.innerHTML = `<i data-feather="loader" class="spin" style="width:16px;height:16px;"></i> Exporting HD Video... (${Math.round(pct)}%)`;
        }
    }

    updateMCQSectionPills();
}

async function preloadMCQAudioDeck(lang) {
    mcqState.isPreloadingAudio = true;
    const texts = [];
    if (!mcqState.questions || mcqState.questions.length === 0) {
        mcqState.isPreloadingAudio = false;
        return;
    }

    mcqState.questions.forEach(q => {
        if (q.question) texts.push(q.question);
        if (q.options) q.options.forEach(o => { if (o) texts.push(o); });
        if (q.explanation) texts.push(getMCQExplanationText(q));
    });
    texts.push("लोकसेवा तयारी तथा नयाँ जानकारीका लागि हाम्रो पानालाई लाइक, सेयर र फलो गर्न नबिर्सिनुहोला! धन्यवाद!");

    const total = texts.length;
    let completed = 0;
    updateMCQAudioProgress(0, total, `🎙️ Synthesizing HD Voice Narration (0%)...`);

    // Sequential pre-loading with 150ms pacing delay to respect API rate limits and avoid 429 robotic fallbacks
    for (let i = 0; i < texts.length; i++) {
        await fetchAudioBuffer(texts[i], lang);
        completed++;
        updateMCQAudioProgress(completed, total);
        if (i < texts.length - 1) {
            await new Promise(r => setTimeout(r, 150));
        }
    }

    mcqState.isPreloadingAudio = false;
    updateMCQAudioProgress(total, total, `✅ Voice Narration Ready! (100%) Instant Playback & Export Enabled.`);
    updateMCQSectionPills();
    updateMCQTimelineProgress();
}

async function speakMCQText(text, lang, onEnd, onTypewriterProgress, prefixLen = 0) {
    if (!text) {
        if (onTypewriterProgress) onTypewriterProgress(0, 1.0);
        if (onEnd) onEnd();
        return;
    }

    stopCurrentMCQAudio();
    if (mcqState.typewriterInterval) {
        if (typeof mcqState.typewriterInterval === 'number') {
            cancelAnimationFrame(mcqState.typewriterInterval);
            clearInterval(mcqState.typewriterInterval);
        }
        mcqState.typewriterInterval = null;
    }

    if (onTypewriterProgress) onTypewriterProgress(0, 0);

    let handled = false;

    const startTypewriterLoop = (durMs) => {
        if (!onTypewriterProgress) return;
        
        const startTime = mcqAudioCtx ? mcqAudioCtx.currentTime : (performance.now() / 1000);
        const totalLen = text.length;

        function step() {
            if (handled) return;
            const now = mcqAudioCtx ? mcqAudioCtx.currentTime : (performance.now() / 1000);
            const elapsedMs = Math.max(0, (now - startTime) * 1000);
            const ratio = Math.min(1.0, elapsedMs / Math.max(1, durMs));

            let charCount = 0;
            if (prefixLen > 0 && totalLen > prefixLen) {
                const prefixRatio = prefixLen / totalLen;
                if (ratio < prefixRatio) {
                    charCount = 0;
                } else {
                    const expRatio = (ratio - prefixRatio) / (1 - prefixRatio);
                    const mainLen = totalLen - prefixLen;
                    charCount = Math.min(mainLen, Math.floor(expRatio * mainLen));
                }
            } else {
                charCount = Math.min(totalLen, Math.floor(ratio * totalLen));
            }

            onTypewriterProgress(charCount, ratio);

            if (ratio < 1.0) {
                mcqState.typewriterInterval = requestAnimationFrame(step);
            }
        }

        mcqState.typewriterInterval = requestAnimationFrame(step);
    };

    const finish = () => {
        if (!handled) {
            handled = true;
            if (mcqState.typewriterInterval) {
                cancelAnimationFrame(mcqState.typewriterInterval);
                clearInterval(mcqState.typewriterInterval);
                mcqState.typewriterInterval = null;
            }
            const targetLen = (prefixLen > 0 && text.length > prefixLen) ? (text.length - prefixLen) : text.length;
            if (onTypewriterProgress) onTypewriterProgress(targetLen, 1.0);
            if (onEnd) onEnd();
        }
    };

    try {
        const audioBuffer = await fetchAudioBuffer(text, lang);
        if (audioBuffer && mcqAudioCtx) {
            const source = mcqAudioCtx.createBufferSource();
            currentBufferSource = source;
            source.buffer = audioBuffer;
            const dest = getMCQAudioDestination();
            if (dest) source.connect(dest);
            if (!mcqState.isExporting) {
                source.connect(mcqAudioCtx.destination);
            }
            currentAudioEl = source;

            const durMs = audioBuffer.duration * 1000;
            startTypewriterLoop(durMs);

            source.onended = () => finish();
            source.start(0);
        } else {
            fallbackWebSpeech(text, lang, finish, onTypewriterProgress, prefixLen);
        }
    } catch (e) {
        fallbackWebSpeech(text, lang, finish, onTypewriterProgress, prefixLen);
    }
}

function fallbackWebSpeech(text, lang, onEnd, onTypewriterProgress, prefixLen = 0) {
    if (!window.speechSynthesis) {
        const targetLen = (prefixLen > 0 && text.length > prefixLen) ? (text.length - prefixLen) : text.length;
        if (onTypewriterProgress) onTypewriterProgress(targetLen, 1.0);
        if (onEnd) onEnd();
        return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1.0;
    utter.lang = (lang === 'Nepali' || lang === 'ne') ? 'ne-NP' : 'en-US';

    const voices = window.speechSynthesis.getVoices() || [];
    const v = voices.find(v => v.lang.includes('ne') || v.lang.includes('hi') || v.lang.includes('en'));
    if (v) utter.voice = v;

    let handled = false;
    const totalLen = text.length;
    const estDurationMs = Math.max(2500, totalLen * 130);

    const finish = () => {
        if (!handled) {
            handled = true;
            if (mcqState.typewriterInterval) {
                cancelAnimationFrame(mcqState.typewriterInterval);
                clearInterval(mcqState.typewriterInterval);
                mcqState.typewriterInterval = null;
            }
            const targetLen = (prefixLen > 0 && text.length > prefixLen) ? (text.length - prefixLen) : text.length;
            if (onTypewriterProgress) onTypewriterProgress(targetLen, 1.0);
            if (onEnd) onEnd();
        }
    };

    utter.onstart = () => {
        if (!onTypewriterProgress) return;
        const startTime = performance.now();

        function step() {
            if (handled) return;
            const elapsedMs = Math.max(0, performance.now() - startTime);
            const ratio = Math.min(1.0, elapsedMs / estDurationMs);

            let charCount = 0;
            if (prefixLen > 0 && totalLen > prefixLen) {
                const prefixRatio = prefixLen / totalLen;
                if (ratio < prefixRatio) {
                    charCount = 0;
                } else {
                    const expRatio = (ratio - prefixRatio) / (1 - prefixRatio);
                    const mainLen = totalLen - prefixLen;
                    charCount = Math.min(mainLen, Math.floor(expRatio * mainLen));
                }
            } else {
                charCount = Math.min(totalLen, Math.floor(ratio * totalLen));
            }

            onTypewriterProgress(charCount, ratio);

            if (ratio < 1.0) {
                mcqState.typewriterInterval = requestAnimationFrame(step);
            }
        }
        mcqState.typewriterInterval = requestAnimationFrame(step);
    };

    utter.onend = () => finish();
    utter.onerror = () => finish();

    window.speechSynthesis.speak(utter);
}

function wrapCanvasText(ctx, text, maxWidth) {
    if (!text) return [];
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
        const testLine = currentLine ? currentLine + ' ' + words[i] : words[i];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = words[i];
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
}

let mcqBrandLogoImg = null;
let mcqCurrentLogoUrl = '';

function preloadMCQBrandLogo(url) {
    if (!url) { mcqBrandLogoImg = null; mcqCurrentLogoUrl = ''; return; }
    if (url === mcqCurrentLogoUrl) return;
    mcqCurrentLogoUrl = url;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
        mcqBrandLogoImg = img;
        drawMCQCanvas();
    };
    img.onerror = () => { mcqBrandLogoImg = null; };
}

function drawMCQCanvas() {
    const canvas = document.getElementById('mcq-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = 1080;
    const height = 1920;

    const qData = mcqState.questions[mcqState.currentIndex] || mcqState.questions[0];
    const brandId = document.getElementById('mcq-brand')?.value;
    const activeBrand = (typeof allBrands !== 'undefined' && Array.isArray(allBrands)) ? allBrands.find(b => b.id === brandId) : (typeof currentBranding !== 'undefined' ? currentBranding : null);
    const brandName = activeBrand?.name || 'GROWUP LOKSEWA';
    const brandHandle = activeBrand?.handle || '@growuploksewa';
    const brandLogoUrl = activeBrand?.logoUrl || activeBrand?.logo_url || activeBrand?.logo || activeBrand?.avatar;
    const brandHeaderAssetUrl = activeBrand?.headerAssetUrl || activeBrand?.header_asset_url;
    // Prioritize the wide header asset banner; fall back to logo
    const brandDisplayUrl = brandHeaderAssetUrl || brandLogoUrl;

    if (brandDisplayUrl) {
        preloadMCQBrandLogo(brandDisplayUrl);
    }

    const themeKey = document.getElementById('mcq-theme')?.value || 'loksewa_official';
    const themes = {
        loksewa_official: {
            bgGrad: ['#0d1b3e', '#0d47a1', '#071230'],
            glow: 'rgba(198, 40, 40, 0.35)',
            pillBg: 'rgba(255, 255, 255, 0.95)',
            pillBorder: 'rgba(13, 71, 161, 0.8)',
            pillText: '#0d47a1',
            qBoxBg: 'rgba(255, 255, 255, 0.95)',
            qBoxBorder: 'rgba(198, 40, 40, 0.7)',
            qAccent: '#c62828',
            qLabel: '#0d47a1',
            qTextColor: '#1a1a2e',
            optCardBg: 'rgba(255, 255, 255, 0.92)',
            optCardBorder: 'rgba(13, 71, 161, 0.4)',
            optTextColor: '#1a1a2e',
            badgeBg: '#c62828',
            badgeText: '#ffffff',
            cdStroke: '#ffc107',
            cdText: '#ffc107'
        },
        midnight: {
            bgGrad: ['#0b0f19', '#1e1b4b', '#090d16'],
            glow: 'rgba(147, 51, 234, 0.3)',
            pillBg: 'rgba(255, 255, 255, 0.08)',
            pillBorder: 'rgba(255, 255, 255, 0.18)',
            pillText: '#a855f7',
            qBoxBg: 'rgba(30, 41, 59, 0.88)',
            qBoxBorder: 'rgba(168, 85, 247, 0.5)',
            qAccent: '#a855f7',
            qLabel: '#c084fc',
            optCardBg: 'rgba(30, 41, 59, 0.75)',
            optCardBorder: 'rgba(255, 255, 255, 0.18)',
            badgeBg: '#6366f1',
            badgeText: '#ffffff',
            cdStroke: '#f59e0b',
            cdText: '#fbbf24'
        },
        emerald: {
            bgGrad: ['#022c22', '#065f46', '#022c22'],
            glow: 'rgba(16, 185, 129, 0.3)',
            pillBg: 'rgba(255, 255, 255, 0.08)',
            pillBorder: 'rgba(250, 204, 21, 0.3)',
            pillText: '#fbbf24',
            qBoxBg: 'rgba(6, 78, 59, 0.85)',
            qBoxBorder: 'rgba(250, 204, 21, 0.5)',
            qAccent: '#fbbf24',
            qLabel: '#fef08a',
            optCardBg: 'rgba(6, 78, 59, 0.7)',
            optCardBorder: 'rgba(255, 255, 255, 0.18)',
            badgeBg: '#f59e0b',
            badgeText: '#0f172a',
            cdStroke: '#fbbf24',
            cdText: '#fef08a'
        },
        cyber: {
            bgGrad: ['#0f172a', '#1e293b', '#090d16'],
            glow: 'rgba(6, 182, 212, 0.35)',
            pillBg: 'rgba(255, 255, 255, 0.08)',
            pillBorder: 'rgba(6, 182, 212, 0.3)',
            pillText: '#38bdf8',
            qBoxBg: 'rgba(15, 23, 42, 0.9)',
            qBoxBorder: 'rgba(6, 182, 212, 0.6)',
            qAccent: '#06b6d4',
            qLabel: '#38bdf8',
            optCardBg: 'rgba(30, 41, 59, 0.8)',
            optCardBorder: 'rgba(6, 182, 212, 0.3)',
            badgeBg: '#0891b2',
            badgeText: '#ffffff',
            cdStroke: '#38bdf8',
            cdText: '#7dd3fc'
        },
        sunset: {
            bgGrad: ['#27005d', '#711db0', '#1c0042'],
            glow: 'rgba(255, 107, 107, 0.35)',
            pillBg: 'rgba(255, 255, 255, 0.08)',
            pillBorder: 'rgba(255, 107, 107, 0.3)',
            pillText: '#ff6b6b',
            qBoxBg: 'rgba(40, 10, 60, 0.88)',
            qBoxBorder: 'rgba(255, 107, 107, 0.5)',
            qAccent: '#ff6b6b',
            qLabel: '#ffa502',
            optCardBg: 'rgba(40, 10, 60, 0.75)',
            optCardBorder: 'rgba(255, 255, 255, 0.18)',
            badgeBg: '#e84118',
            badgeText: '#ffffff',
            cdStroke: '#ffa502',
            cdText: '#fed330'
        },
        minimal: {
            bgGrad: ['#18181b', '#27272a', '#09090b'],
            glow: 'rgba(255, 255, 255, 0.15)',
            pillBg: 'rgba(255, 255, 255, 0.1)',
            pillBorder: 'rgba(255, 255, 255, 0.25)',
            pillText: '#ffffff',
            qBoxBg: 'rgba(39, 39, 42, 0.9)',
            qBoxBorder: 'rgba(228, 228, 231, 0.5)',
            qAccent: '#ffffff',
            qLabel: '#e4e4e7',
            optCardBg: 'rgba(39, 39, 42, 0.75)',
            optCardBorder: 'rgba(255, 255, 255, 0.2)',
            badgeBg: '#52525b',
            badgeText: '#ffffff',
            cdStroke: '#e4e4e7',
            cdText: '#ffffff'
        }
    };
    const t = themes[themeKey] || themes.midnight;

    // 1. Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, t.bgGrad[0]);
    bgGrad.addColorStop(0.5, t.bgGrad[1]);
    bgGrad.addColorStop(1, t.bgGrad[2]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Radial Glow behind Question
    const radGlow = ctx.createRadialGradient(width / 2, 400, 50, width / 2, 400, 600);
    radGlow.addColorStop(0, t.glow);
    radGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radGlow;
    ctx.fillRect(0, 0, width, height);

    // 2. Top Header — Brand Asset Banner or Brand Pill (Positioned in 9:16 Reel Safe Zone: Y=260)
    const hasHeaderAsset = mcqBrandLogoImg && mcqBrandLogoImg.complete && brandHeaderAssetUrl;
    const hasLogo = mcqBrandLogoImg && mcqBrandLogoImg.complete && !brandHeaderAssetUrl;

    if (hasHeaderAsset) {
        // Render wide header asset banner across the top safe zone
        ctx.save();
        const imgW = mcqBrandLogoImg.naturalWidth || mcqBrandLogoImg.width;
        const imgH = mcqBrandLogoImg.naturalHeight || mcqBrandLogoImg.height;
        let bannerMaxW = 900;
        let bannerMaxH = 110;
        const hStyle = currentBranding?.headerAssetStyle;
        if (hStyle && hStyle.scaleX) {
            bannerMaxH = Math.min(200, Math.round(110 * Math.max(0.5, hStyle.scaleX)));
            bannerMaxW = Math.min(960, Math.round(900 * Math.max(0.5, hStyle.scaleX)));
        }
        const scale = Math.min(bannerMaxW / imgW, bannerMaxH / imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const bannerX = (width - drawW) / 2;
        const bannerY = 260;

        // Subtle shadow behind banner
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 16;
        ctx.drawImage(mcqBrandLogoImg, bannerX, bannerY, drawW, drawH);
        ctx.shadowBlur = 0;

        // Question counter below banner
        ctx.font = 'bold 28px "Inter", sans-serif';
        ctx.fillStyle = t.pillText || '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Q${mcqState.currentIndex + 1}/${mcqState.questions.length}`, width / 2, bannerY + drawH + 22);
        ctx.restore();
    } else {
        // Fallback: Brand Pill with optional small logo in safe zone
        ctx.save();
        ctx.fillStyle = t.pillBg;
        ctx.strokeStyle = t.pillBorder;
        ctx.lineWidth = 2;
        const headerW = 800; const headerH = 80; const headerX = (width - headerW) / 2; const headerY = 260;
        ctx.beginPath();
        ctx.roundRect(headerX, headerY, headerW, headerH, 40);
        ctx.fill();
        ctx.stroke();

        if (hasLogo) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(headerX + 44, headerY + headerH / 2, 24, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(mcqBrandLogoImg, headerX + 20, headerY + (headerH - 48) / 2, 48, 48);
            ctx.restore();
        }

        ctx.font = 'bold 32px "Inter", sans-serif';
        ctx.fillStyle = t.pillText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const logoOffset = hasLogo ? 22 : 0;
        ctx.fillText(`${brandName.toUpperCase()} • Q${mcqState.currentIndex + 1}/${mcqState.questions.length}`, (width / 2) + logoOffset, headerY + headerH / 2);
        ctx.restore();
    }

    const qBoxW = 900; const qBoxX = (width - qBoxW) / 2;

    // --- PHASE BRANCHING FOR CANVAS RENDERING ---
    if (mcqState.phase === 'EXPLANATION' || mcqState.phase === 'ANSWER') {
        // ============================================================
        // DEDICATED SCREEN 1: DETAILED EXPLANATION SCREEN (Safe Zone Y: 410 - 1470)
        // ============================================================

        // 1. Correct Answer Banner Card (Height 140px, Y=410)
        const ansCardY = 410; const ansCardH = 140;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(qBoxX, ansCardY, qBoxW, ansCardH, 20);
        const greenGrad = ctx.createLinearGradient(qBoxX, ansCardY, qBoxX + qBoxW, ansCardY + ansCardH);
        greenGrad.addColorStop(0, '#15803d');
        greenGrad.addColorStop(1, '#22c55e');
        ctx.fillStyle = greenGrad;
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 28;
        ctx.fill();
        ctx.stroke();

        // Label
        ctx.font = 'bold 26px "Inter", sans-serif';
        ctx.fillStyle = '#dcfce7';
        ctx.textAlign = 'left';
        ctx.fillText('✓ सही उत्तर / CORRECT ANSWER:', qBoxX + 40, ansCardY + 40);

        // Correct Option Text (Large 40px)
        ctx.font = 'bold 40px "Mukta", "Inter", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(qData ? qData.correct_option : '', qBoxX + 40, ansCardY + 96);
        ctx.restore();

        // 2. Detailed Explanation Main Container (Height 900px, Y=560 to Y=1460)
        const expBoxY = 560; const expBoxH = 900;
        ctx.save();
        ctx.fillStyle = t.qTextColor ? 'rgba(255, 255, 255, 0.97)' : 'rgba(15, 23, 42, 0.96)';
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 4;
        ctx.shadowColor = 'rgba(34, 197, 94, 0.3)';
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.roundRect(qBoxX, expBoxY, qBoxW, expBoxH, 24);
        ctx.fill();
        ctx.stroke();

        // Top green accent line
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.roundRect(qBoxX, expBoxY, qBoxW, 12, [24, 24, 0, 0]);
        ctx.fill();

        // Header Label
        ctx.font = 'bold 32px "Inter", sans-serif';
        ctx.fillStyle = '#16a34a';
        ctx.textAlign = 'left';
        ctx.fillText('💡 विस्तृत उत्तर व्याख्या / DETAILED EXPLANATION:', qBoxX + 40, expBoxY + 58);

        // Horizontal divider line
        ctx.strokeStyle = t.qTextColor ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(qBoxX + 35, expBoxY + 90);
        ctx.lineTo(qBoxX + qBoxW - 35, expBoxY + 90);
        ctx.stroke();

        // Typewriter Explanation Text
        const visibleExpText = qData && qData.explanation ? qData.explanation.substring(0, mcqState.expCharCount) : '';
        ctx.font = '600 40px "Mukta", "Inter", sans-serif';
        ctx.fillStyle = t.qTextColor ? '#1e293b' : '#f8fafc';
        const expLines = wrapCanvasText(ctx, visibleExpText, qBoxW - 80);
        let expLineY = expBoxY + 155;
        expLines.forEach(line => {
            ctx.fillText(line, qBoxX + 40, expLineY);
            expLineY += 58;
        });
        ctx.restore();

    } else if (mcqState.phase === 'OUTRO') {
        // ============================================================
        // DEDICATED SCREEN 2: OUTRO CALL-TO-ACTION CLIP SCREEN (Safe Zone Y: 410 - 1470)
        // ============================================================
        const outroY = 410; const outroH = 1060;
        ctx.save();
        ctx.fillStyle = t.qTextColor ? 'rgba(255, 255, 255, 0.97)' : 'rgba(15, 23, 42, 0.96)';
        ctx.strokeStyle = '#c62828';
        ctx.lineWidth = 5;
        ctx.shadowColor = '#0d47a1';
        ctx.shadowBlur = 35;
        ctx.beginPath();
        ctx.roundRect(qBoxX, outroY, qBoxW, outroH, 28);
        ctx.fill();
        ctx.stroke();

        // Top Accent bar in Nepal PSC Crimson Red
        ctx.fillStyle = '#c62828';
        ctx.beginPath();
        ctx.roundRect(qBoxX, outroY, qBoxW, 14, [28, 28, 0, 0]);
        ctx.fill();

        // Glowing Brand Badge Pill
        const pillW = 440; const pillH = 65; const pillX = (width - pillW) / 2; const pillY = outroY + 40;
        ctx.fillStyle = '#0d47a1';
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 32);
        ctx.fill();

        ctx.font = 'bold 32px "Inter", sans-serif';
        ctx.fillStyle = '#ffc107';
        ctx.textAlign = 'center';
        const brandHandle = (currentBranding && currentBranding.name) ? currentBranding.name.toUpperCase() : 'GEARUP LOKSEWA';
        ctx.fillText(`✨ ${brandHandle} ✨`, width / 2, pillY + pillH / 2);

        // Outro Title
        ctx.font = 'bold 44px "Mukta", "Inter", sans-serif';
        ctx.fillStyle = t.qTextColor ? '#0d47a1' : '#60a5fa';
        ctx.textAlign = 'center';
        ctx.fillText('हाम्रो पानालाई फलो गर्नुहोला!', width / 2, outroY + 160);

        // Divider
        ctx.strokeStyle = 'rgba(198, 40, 40, 0.3)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(qBoxX + 50, outroY + 195);
        ctx.lineTo(qBoxX + qBoxW - 50, outroY + 195);
        ctx.stroke();

        // Typewriter Outro Body Text
        const outroText = "लोकसेवा तयारी तथा नयाँ जानकारीका लागि हाम्रो पानालाई लाइक, सेयर र फलो गर्न नबिर्सिनुहोला! धन्यवाद!";
        const visibleOutroText = outroText.substring(0, mcqState.outroCharCount || 0);
        ctx.font = '700 42px "Mukta", "Inter", sans-serif';
        ctx.fillStyle = t.qTextColor ? '#1e293b' : '#f8fafc';
        ctx.textAlign = 'left';
        const outroLines = wrapCanvasText(ctx, visibleOutroText, qBoxW - 80);
        let outroLineY = outroY + 270;
        outroLines.forEach(line => {
            ctx.fillText(line, qBoxX + 40, outroLineY);
            outroLineY += 66;
        });

        // Social CTA Footer Container
        const ctaY = outroY + outroH - 260;
        ctx.fillStyle = 'rgba(13, 71, 161, 0.08)';
        ctx.strokeStyle = 'rgba(13, 71, 161, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(qBoxX + 30, ctaY, qBoxW - 60, 210, 20);
        ctx.fill();
        ctx.stroke();

        // Handle
        ctx.font = 'bold 36px "Inter", sans-serif';
        ctx.fillStyle = '#c62828';
        ctx.textAlign = 'center';
        ctx.fillText(brandHandle, width / 2, ctaY + 55);

        // Interactive Badges (Like, Share, Follow)
        const badgeW = 210; const badgeH = 60; const badgeGap = 20;
        const totalBadgesW = badgeW * 3 + badgeGap * 2;
        let startBadgeX = (width - totalBadgesW) / 2;
        const badgeY = ctaY + 110;

        const ctaBadges = [
            { text: '👍 LIKE', bg: '#0d47a1', color: '#ffffff' },
            { text: '🔄 SHARE', bg: '#c62828', color: '#ffffff' },
            { text: '🔔 FOLLOW', bg: '#ffc107', color: '#0d47a1' }
        ];

        ctaBadges.forEach(b => {
            ctx.fillStyle = b.bg;
            ctx.beginPath();
            ctx.roundRect(startBadgeX, badgeY, badgeW, badgeH, 18);
            ctx.fill();

            ctx.font = 'bold 28px "Inter", sans-serif';
            ctx.fillStyle = b.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(b.text, startBadgeX + badgeW / 2, badgeY + badgeH / 2);

            startBadgeX += badgeW + badgeGap;
        });

        ctx.restore();

    } else {
        // ============================================================
        // STANDARD SCREEN: QUESTION & OPTIONS (Safe Zone Y: 410 - 1470)
        // ============================================================

        // 3. Question Card Container (Height 320px, Y=410)
        ctx.save();
        const qBoxH = 320; const qBoxY = 410;
        ctx.fillStyle = t.qBoxBg;
        ctx.strokeStyle = t.qBoxBorder;
        ctx.lineWidth = 4;
        ctx.shadowColor = t.qAccent;
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.roundRect(qBoxX, qBoxY, qBoxW, qBoxH, 24);
        ctx.fill();
        ctx.stroke();

        // Top theme accent line
        ctx.fillStyle = t.qAccent;
        ctx.beginPath();
        ctx.roundRect(qBoxX, qBoxY, qBoxW, 12, [24, 24, 0, 0]);
        ctx.fill();

        // Question Label
        ctx.font = 'bold 28px "Inter", sans-serif';
        ctx.fillStyle = t.qLabel;
        ctx.textAlign = 'left';
        ctx.fillText('QUESTION / प्रश्न:', qBoxX + 35, qBoxY + 48);

        // Typewriter Question Text (Large 46px bold font)
        const visibleQText = qData ? qData.question.substring(0, mcqState.qCharCount) : '';
        ctx.font = '700 46px "Mukta", "Inter", sans-serif';
        ctx.fillStyle = t.qTextColor || '#ffffff';
        const qLines = wrapCanvasText(ctx, visibleQText, qBoxW - 70);
        let qLineY = qBoxY + 110;
        qLines.forEach(line => {
            ctx.fillText(line, qBoxX + 35, qLineY);
            qLineY += 60;
        });
        ctx.restore();

        // 4. Options List (4 Cards, Height 130px each, starting at Y=750)
        const optYStart = 750;
        const optCardH = 130;
        const optGap = 15;

        if (qData && qData.options) {
            qData.options.forEach((optText, idx) => {
                const optY = optYStart + idx * (optCardH + optGap);
                const isCorrect = idx === qData.correct_index;
                const isAnswerPhase = mcqState.phase === 'ANSWER';

                ctx.save();
                ctx.beginPath();
                ctx.roundRect(qBoxX, optY, qBoxW, optCardH, 20);

                if (isAnswerPhase && isCorrect) {
                    // Highlight Correct Option in glowing green gradient
                    const greenGrad = ctx.createLinearGradient(qBoxX, optY, qBoxX + qBoxW, optY + optCardH);
                    greenGrad.addColorStop(0, '#15803d');
                    greenGrad.addColorStop(1, '#22c55e');
                    ctx.fillStyle = greenGrad;
                    ctx.strokeStyle = '#4ade80';
                    ctx.lineWidth = 5;
                    ctx.shadowColor = '#22c55e';
                    ctx.shadowBlur = 35;
                } else if (isAnswerPhase && !isCorrect) {
                    // Dim non-correct options
                    ctx.fillStyle = t.optTextColor ? 'rgba(230, 230, 235, 0.7)' : 'rgba(15, 23, 42, 0.4)';
                    ctx.strokeStyle = t.optTextColor ? 'rgba(200, 200, 210, 0.3)' : 'rgba(255, 255, 255, 0.05)';
                    ctx.lineWidth = 2;
                } else {
                    // Standard option card state
                    ctx.fillStyle = t.optCardBg;
                    ctx.strokeStyle = t.optCardBorder;
                    ctx.lineWidth = 3;
                }
                ctx.fill();
                ctx.stroke();

                // Option Letter Badge Circle (A, B, C, D) - Diameter 60px
                const badgeX = qBoxX + 46;
                const badgeY = optY + optCardH / 2;
                const badgeR = 30;
                ctx.beginPath();
                ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
                ctx.fillStyle = isAnswerPhase && isCorrect ? '#ffffff' : (isAnswerPhase ? (t.optTextColor ? 'rgba(200,200,210,0.4)' : 'rgba(255,255,255,0.1)') : t.badgeBg);
                ctx.fill();

                ctx.font = 'bold 34px "Inter", sans-serif';
                ctx.fillStyle = isAnswerPhase && isCorrect ? '#15803d' : t.badgeText;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const letter = String.fromCharCode(65 + idx);
                ctx.fillText(letter, badgeX, badgeY + 2);

                // Typewriter Option Text (Large 38px bold font)
                const charCount = mcqState.optCharCounts[idx] || 0;
                const visibleOptText = optText.substring(0, charCount);
                ctx.font = '600 38px "Mukta", "Inter", sans-serif';
                ctx.fillStyle = isAnswerPhase && isCorrect ? '#ffffff' : (isAnswerPhase ? (t.optTextColor ? 'rgba(100,100,120,0.5)' : 'rgba(255,255,255,0.4)') : (t.optTextColor || '#f8fafc'));
                ctx.textAlign = 'left';
                ctx.fillText(visibleOptText, qBoxX + 100, badgeY);

                // If correct in answer phase, draw Checkmark icon ✓
                if (isAnswerPhase && isCorrect) {
                    ctx.font = 'bold 44px "Inter", sans-serif';
                    ctx.fillStyle = '#ffffff';
                    ctx.textAlign = 'right';
                    ctx.fillText('✓', qBoxX + qBoxW - 35, badgeY);
                }
                ctx.restore();
            });
        }

        // 5. Phase 3: 3-Second Countdown Visual Arc Widget (Safe Zone Y=1420)
        if (mcqState.phase === 'COUNTDOWN') {
            const cdX = width / 2;
            const cdY = 1420;
            const cdR = 75;

            ctx.save();
            // Background Circle
            ctx.beginPath();
            ctx.arc(cdX, cdY, cdR, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 8;
            ctx.fill();
            ctx.stroke();

            // Progress Arc
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + (Math.PI * 2 * mcqState.countdownArc);
            ctx.beginPath();
            ctx.arc(cdX, cdY, cdR, startAngle, endAngle);
            ctx.strokeStyle = t.cdStroke;
            ctx.lineWidth = 12;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Big Countdown Digit (3, 2, 1)
            ctx.font = 'bold 90px "Inter", sans-serif';
            ctx.fillStyle = t.cdText;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(mcqState.countdownSec.toString(), cdX, cdY);
            ctx.restore();
        }
    }
}

function updateMCQEditorFields() {
    const qData = mcqState.questions[mcqState.currentIndex];
    if (!qData) return;

    const selectEl = document.getElementById('mcq-select-question');
    if (selectEl) {
        selectEl.innerHTML = '';
        mcqState.questions.forEach((q, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.innerText = `Q${idx + 1}: ${q.question.substring(0, 30)}...`;
            if (idx === mcqState.currentIndex) opt.selected = true;
            selectEl.appendChild(opt);
        });
    }

    const qInput = document.getElementById('mcq-edit-question');
    if (qInput) qInput.value = qData.question || '';

    if (qData.options) {
        [0, 1, 2, 3].forEach(i => {
            const optIn = document.getElementById(`mcq-edit-opt${i}`);
            if (optIn) optIn.value = qData.options[i] || '';
        });
    }

    const corrSel = document.getElementById('mcq-edit-correct');
    if (corrSel) corrSel.value = qData.correct_index !== undefined ? qData.correct_index : 0;

    const expInput = document.getElementById('mcq-edit-explanation');
    if (expInput) expInput.value = qData.explanation || '';
}

async function startMCQSequence(isExportingRun = false) {
    if (!isExportingRun) {
        mcqState.isExporting = false;
        stopMCQSequence(false);
    } else {
        stopMCQSequence(true);
    }
    const lang = document.getElementById('mcq-language')?.value || 'Nepali';

    if (mcqState.isPreloadingAudio) {
        await preloadMCQAudioDeck(lang);
    }

    mcqState.isPlaying = true;
    mcqState.phase = 'QUESTION';
    mcqState.qCharCount = 0;
    mcqState.optCharCounts = [0, 0, 0, 0];
    mcqState.countdownSec = 3;
    mcqState.countdownArc = 1.0;
    mcqState.expCharCount = 0;
    mcqState.outroCharCount = 0;

    const qData = mcqState.questions[mcqState.currentIndex] || mcqState.questions[0];

    const phaseLabel = document.getElementById('mcq-phase-label');
    if (phaseLabel) phaseLabel.innerText = `Phase 1: Question ${mcqState.currentIndex + 1}/${mcqState.questions.length} Typewriter & Voiceover`;

    // Continuous Canvas Render Loop
    function renderLoop() {
        if (mcqState.isPlaying || mcqState.isExporting) {
            drawMCQCanvas();
            updateMCQTimelineProgress();
            mcqState.animFrameId = requestAnimationFrame(renderLoop);
        }
    }
    mcqState.animFrameId = requestAnimationFrame(renderLoop);

    // Speak Question with synced typewriter animation
    speakMCQText(qData.question, lang, () => {
        if (!mcqState.isPlaying) return;
        mcqState.phase = 'OPTIONS';
        mcqState.qCharCount = qData.question.length;
        if (phaseLabel) phaseLabel.innerText = `Phase 2: Question ${mcqState.currentIndex + 1} Options Display`;

        let optIdx = 0;
        function animateNextOption() {
            if (!mcqState.isPlaying) return;
            if (optIdx < 4) {
                const text = qData.options[optIdx] || '';
                const currentOptIdx = optIdx;
                speakMCQText(text, lang, () => {
                    mcqState.optCharCounts[currentOptIdx] = text.length;
                    optIdx++;
                    setTimeout(animateNextOption, 250);
                }, (charCount) => {
                    mcqState.optCharCounts[currentOptIdx] = charCount;
                    drawMCQCanvas();
                });
            } else {
                // All options read! Start Phase 3: 3-Second Countdown
                startMCQCountdown(lang, qData);
            }
        }
        animateNextOption();
    }, (charCount) => {
        mcqState.qCharCount = charCount;
        drawMCQCanvas();
    });
}

function startMCQCountdown(lang, qData) {
    if (!mcqState.isPlaying) return;
    mcqState.phase = 'COUNTDOWN';
    mcqState.countdownSec = 3;
    mcqState.countdownArc = 1.0;

    const phaseLabel = document.getElementById('mcq-phase-label');
    if (phaseLabel) phaseLabel.innerText = "Phase 3: 3-Second Countdown";

    playMCQBeep(800, 200);

    const startAudioTime = mcqAudioCtx ? mcqAudioCtx.currentTime : (performance.now() / 1000);
    const durationSec = 3.0;
    let lastSecBeeped = 3;

    function stepCountdown() {
        if (!mcqState.isPlaying) return;
        const now = mcqAudioCtx ? mcqAudioCtx.currentTime : (performance.now() / 1000);
        const elapsed = Math.max(0, now - startAudioTime);
        const remaining = Math.max(0, durationSec - elapsed);
        mcqState.countdownArc = remaining / durationSec;
        const currentSec = Math.max(1, Math.ceil(remaining));

        if (currentSec !== mcqState.countdownSec && currentSec > 0) {
            mcqState.countdownSec = currentSec;
            if (currentSec < lastSecBeeped) {
                playMCQBeep(800, 200);
                lastSecBeeped = currentSec;
            }
        }

        if (remaining <= 0) {
            mcqState.countdownSec = 0;
            mcqState.countdownArc = 0;
            playMCQBeep(1200, 450);
            revealMCQAnswer(lang, qData);
        } else {
            mcqState.typewriterInterval = requestAnimationFrame(stepCountdown);
        }
    }

    mcqState.typewriterInterval = requestAnimationFrame(stepCountdown);
}

function revealMCQAnswer(lang, qData) {
    if (!mcqState.isPlaying) return;
    mcqState.phase = 'EXPLANATION'; // Dedicated Explanation Screen
    mcqState.expCharCount = 0;

    const phaseLabel = document.getElementById('mcq-phase-label');
    if (phaseLabel) phaseLabel.innerText = `Phase 4: Q${mcqState.currentIndex + 1} Detailed Explanation Screen`;

    // Play Victory Chime Sound
    playMCQBeep(1200, 400);

    const speakText = getMCQExplanationText(qData);
    let correctStr = qData.correct_option || '';
    if ((!correctStr || correctStr.length <= 3) && qData.options && qData.correct_index !== undefined && qData.options[qData.correct_index]) {
        correctStr = qData.options[qData.correct_index];
    }
    const prefix = `सही उत्तर: ${correctStr}। `;
    const prefixLen = prefix.length;

    speakMCQText(speakText, lang, () => {
        mcqState.expCharCount = qData.explanation ? qData.explanation.length : 0;

        // Check if there are more questions to advance to
        const nextIdx = mcqState.currentIndex + 1;
        const totalQuestions = mcqState.questions.length;

        // 1.5 seconds reading pause so user can comfortably read full explanation after audio completes
        setTimeout(() => {
            if (!mcqState.isPlaying) return;

            if (nextIdx < totalQuestions) {
                if (phaseLabel) phaseLabel.innerText = `Moving to Question ${nextIdx + 1}/${totalQuestions}...`;
                mcqState.currentIndex = nextIdx;
                updateMCQEditorFields();
                playMCQBeep(600, 150);
                startMCQSequence();
            } else {
                // All questions finished -> Proceed to Outro Clip!
                startMCQOutro(lang);
            }
        }, 1500);
    }, (charCount) => {
        mcqState.expCharCount = charCount;
        drawMCQCanvas();
    }, prefixLen);
}

function startMCQOutro(lang) {
    if (!mcqState.isPlaying) return;
    mcqState.phase = 'OUTRO'; // Dedicated Outro Screen
    mcqState.outroCharCount = 0;

    const phaseLabel = document.getElementById('mcq-phase-label');
    if (phaseLabel) phaseLabel.innerText = "Phase 5: Outro Call-To-Action Clip";

    // Play cheerful chime
    playMCQBeep(1000, 300);

    const outroText = "लोकसेवा तयारी तथा नयाँ जानकारीका लागि हाम्रो पानालाई लाइक, सेयर र फलो गर्न नबिर्सिनुहोला! धन्यवाद!";

    speakMCQText(outroText, lang, () => {
        mcqState.outroCharCount = outroText.length;
        if (phaseLabel) phaseLabel.innerText = "✅ Video Playback & Outro Complete!";

        if (mcqState.isExporting && mcqState.mediaRecorder) {
            setTimeout(() => {
                try { mcqState.mediaRecorder.stop(); } catch(e){}
            }, 1500);
        }
    }, (charCount) => {
        mcqState.outroCharCount = charCount;
        drawMCQCanvas();
    });
}

function stopMCQSequence(keepRecorder = false) {
    mcqState.isPlaying = false;
    if (mcqState.typewriterInterval) {
        clearInterval(mcqState.typewriterInterval);
        mcqState.typewriterInterval = null;
    }
    if (currentAudioEl) {
        try { currentAudioEl.pause(); } catch(e){}
        currentAudioEl = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (mcqState.animFrameId) cancelAnimationFrame(mcqState.animFrameId);

    if (!keepRecorder && mcqState.mediaRecorder && mcqState.mediaRecorder.state !== 'inactive') {
        try { mcqState.mediaRecorder.stop(); } catch(e){}
    }
    if (!keepRecorder) mcqState.isExporting = false;

    const phaseLabel = document.getElementById('mcq-phase-label');
    if (phaseLabel && !mcqState.isExporting) phaseLabel.innerText = "Stopped";
    drawMCQCanvas();
}

async function exportMCQVideo() {
    const canvas = document.getElementById('mcq-canvas');
    if (!canvas) return;

    const exportBtn = document.getElementById('mcq-export-btn');
    if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.innerHTML = `<i data-feather="loader" class="spin"></i> Exporting Video...`;
    }

    const phaseLabel = document.getElementById('mcq-phase-label');
    if (phaseLabel) phaseLabel.innerText = "🎙️ Pre-loading HD Voice narration & preparing Reel...";

    stopMCQSequence();
    const lang = document.getElementById('mcq-language')?.value || 'Nepali';

    await preloadMCQAudioDeck(lang);

    mcqState.isExporting = true;
    mcqState.isPlaying = true;
    mcqState.recordedChunks = [];
    mcqState.currentIndex = 0;

    const canvasStream = canvas.captureStream(30);
    const destNode = getMCQAudioDestination();

    const tracks = [...canvasStream.getVideoTracks()];
    if (destNode && destNode.stream.getAudioTracks().length > 0) {
        tracks.push(...destNode.stream.getAudioTracks());
    }

    const combinedStream = new MediaStream(tracks);

    let mimeType = 'video/webm;codecs=vp9,opus';
    let fileExt = 'webm';

    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')) {
        mimeType = 'video/mp4;codecs=avc1,mp4a.40.2';
        fileExt = 'mp4';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
        fileExt = 'mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        mimeType = 'video/webm;codecs=vp9,opus';
        fileExt = 'webm';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
        mimeType = 'video/webm';
        fileExt = 'webm';
    }

    try {
        const recorder = new MediaRecorder(combinedStream, {
            mimeType,
            videoBitsPerSecond: 4500000
        });
        mcqState.mediaRecorder = recorder;

        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                mcqState.recordedChunks.push(e.data);
            }
        };

        recorder.onstop = () => {
            const blob = new Blob(mcqState.recordedChunks, { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mcq_loksewa_reel_${Date.now()}.${fileExt}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 10000);

            mcqState.isExporting = false;
            mcqState.isPlaying = false;
            if (phaseLabel) phaseLabel.innerText = `✅ HD Reel Exported (${fileExt.toUpperCase()} with Voiceover)! Ready for Facebook Reels.`;
            if (exportBtn) {
                exportBtn.disabled = false;
                exportBtn.innerHTML = `<i data-feather="check"></i> Video Downloaded!`;
                setTimeout(() => {
                    exportBtn.innerHTML = `<i data-feather="download"></i> Export Video (.mp4)`;
                }, 4000);
            }
        };

        recorder.start(100);
        startMCQSequence(true);

    } catch (err) {
        console.error("Video export error:", err);
        alert("Failed to record video stream: " + err.message);
        mcqState.isExporting = false;
        mcqState.isPlaying = false;
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = `<i data-feather="download"></i> Export Video (.mp4)`;
        }
    }
}

function initMCQVideoStudio() {
    window.mcqState = mcqState;
    window.preloadMCQAudioDeck = preloadMCQAudioDeck;
    window.exportMCQVideo = exportMCQVideo;
    window.startMCQSequence = startMCQSequence;
    window.stopMCQSequence = stopMCQSequence;
    window.jumpMCQToSection = jumpMCQToSection;
    window.seekMCQToTime = seekMCQToTime;
    window.buildMCQTimelineMap = buildMCQTimelineMap;
    window.updateMCQEditorFields = updateMCQEditorFields;
    window.drawMCQCanvas = drawMCQCanvas;

    populateBrandSelectors();
    updateMCQEditorFields();
    drawMCQCanvas();
    updateMCQSectionPills();

    if (mcqStudioInitialized) return;
    mcqStudioInitialized = true;

    // AI MCQ Generator Trigger
    document.getElementById('trigger-mcq-generate')?.addEventListener('click', async () => {
        const topic = document.getElementById('mcq-topic')?.value || 'Nepal Geography';
        const difficulty = document.getElementById('mcq-difficulty')?.value || 'Medium';
        const language = document.getElementById('mcq-language')?.value || 'Nepali';
        const questionCount = document.getElementById('mcq-count')?.value || '3';
        const brandId = document.getElementById('mcq-brand')?.value;
        const feedback = document.getElementById('mcq-feedback');
        const btn = document.getElementById('trigger-mcq-generate');

        if (btn) btn.disabled = true;
        if (feedback) { feedback.style.display = 'block'; feedback.style.color = '#38bdf8'; feedback.innerText = 'Generating MCQ Deck with AI...'; }

        try {
            const activeBrand = (typeof allBrands !== 'undefined' && Array.isArray(allBrands)) ? allBrands.find(b => b.id === brandId) : (typeof currentBranding !== 'undefined' ? currentBranding : null);
            const response = await fetch(`${API_URL}/generate-mcq`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic,
                    difficulty,
                    language,
                    question_count: questionCount,
                    brand_id: brandId,
                    brand_context: getBrandContext(activeBrand)
                })
            });

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                const rawText = await response.text();
                console.error("MCQ endpoint returned non-JSON:", rawText.substring(0, 200));
                throw new Error('Server returned non-JSON response. The backend may still be deploying — please try again in 1-2 minutes.');
            }

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to generate MCQ');

            if (data.mcq_data && data.mcq_data.questions && data.mcq_data.questions.length > 0) {
                mcqState.questions = data.mcq_data.questions;
                mcqState.currentIndex = 0;
                updateMCQEditorFields();
                stopMCQSequence();
                drawMCQCanvas();
                if (feedback) { feedback.style.color = '#4ade80'; feedback.innerText = `Successfully generated ${data.mcq_data.questions.length} questions! Pre-loading voice narration...`; }
                await preloadMCQAudioDeck(language);
            } else {
                throw new Error('Invalid MCQ schema returned');
            }
        } catch (err) {
            console.error("MCQ Generate Error:", err);
            if (feedback) { feedback.style.color = '#f87171'; feedback.innerText = 'Error: ' + err.message; }
        } finally {
            if (btn) btn.disabled = false;
        }
    });

    // Player Transport Listeners
    document.getElementById('mcq-play-btn')?.addEventListener('click', () => {
        startMCQSequence();
    });

    document.getElementById('mcq-stop-btn')?.addEventListener('click', () => {
        stopMCQSequence();
    });

    document.getElementById('mcq-export-btn')?.addEventListener('click', () => {
        exportMCQVideo();
    });

    // Timeline Scrubber Input Listener
    document.getElementById('mcq-timeline-slider')?.addEventListener('input', (e) => {
        const pct = parseFloat(e.target.value) || 0;
        const { totalTime } = buildMCQTimelineMap();
        const targetSec = (pct / 100) * totalTime;
        seekMCQToTime(targetSec);
    });

    // Question Selector Dropdown Change
    document.getElementById('mcq-select-question')?.addEventListener('change', (e) => {
        const idx = parseInt(e.target.value) || 0;
        mcqState.currentIndex = idx;
        updateMCQEditorFields();
        stopMCQSequence();
        drawMCQCanvas();
    });

    // Live Editor Sync Handlers
    document.getElementById('mcq-edit-question')?.addEventListener('input', (e) => {
        if (mcqState.questions[mcqState.currentIndex]) {
            mcqState.questions[mcqState.currentIndex].question = e.target.value;
            drawMCQCanvas();
        }
    });

    [0, 1, 2, 3].forEach(i => {
        document.getElementById(`mcq-edit-opt${i}`)?.addEventListener('input', (e) => {
            if (mcqState.questions[mcqState.currentIndex]?.options) {
                mcqState.questions[mcqState.currentIndex].options[i] = e.target.value;
                drawMCQCanvas();
            }
        });
    });

    document.getElementById('mcq-edit-correct')?.addEventListener('change', (e) => {
        if (mcqState.questions[mcqState.currentIndex]) {
            const idx = parseInt(e.target.value) || 0;
            mcqState.questions[mcqState.currentIndex].correct_index = idx;
            const letter = String.fromCharCode(65 + idx);
            const text = mcqState.questions[mcqState.currentIndex].options[idx] || '';
            mcqState.questions[mcqState.currentIndex].correct_option = `${letter}. ${text}`;
            drawMCQCanvas();
        }
    });

    document.getElementById('mcq-edit-explanation')?.addEventListener('input', (e) => {
        if (mcqState.questions[mcqState.currentIndex]) {
            mcqState.questions[mcqState.currentIndex].explanation = e.target.value;
            drawMCQCanvas();
        }
    });

    document.getElementById('mcq-brand')?.addEventListener('change', () => {
        drawMCQCanvas();
    });

    document.getElementById('mcq-theme')?.addEventListener('change', () => {
        drawMCQCanvas();
    });
}

window.mcqState = mcqState;
window.preloadMCQAudioDeck = preloadMCQAudioDeck;
window.exportMCQVideo = exportMCQVideo;
window.startMCQSequence = startMCQSequence;
window.stopMCQSequence = stopMCQSequence;
window.jumpMCQToSection = jumpMCQToSection;
window.seekMCQToTime = seekMCQToTime;
window.buildMCQTimelineMap = buildMCQTimelineMap;

// ============================================================
// 12. VIDEO BRIEF LAB (Book / Novel 2-Min Audio-Visual Summarizer)
// ============================================================
let videoBriefState = {
    topic: 'The Great Gatsby',
    bookTitle: 'The Great Gatsby',
    tagline: '',
    characters: [],
    scenes: [],
    currentIndex: 0,
    isPlaying: false,
    isExporting: false,
    isGenerating: false,
    audioCache: {},
    mediaRecorder: null,
    recordedChunks: [],
    animFrameId: null,
    typewriterInterval: null,
    subtitlesText: '',
    panZoomProgress: 0,
    // Wall-clock based timing for sketch rotation (independent of AudioContext)
    sceneWallStartMs: 0
};

let briefAudioCtx = null;
let briefAudioDest = null;
let currentBriefAudioEl = null;

function getBriefAudioDestination() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        if (!briefAudioCtx) {
            briefAudioCtx = new AudioCtx({ sampleRate: 44100 });
        }
        if (briefAudioCtx.state === 'suspended') {
            briefAudioCtx.resume().catch(() => {});
        }
        if (!briefAudioDest) {
            briefAudioDest = briefAudioCtx.createMediaStreamDestination();
        }
        return briefAudioDest;
    } catch(e) {
        console.warn("getBriefAudioDestination error:", e);
        return null;
    }
}

function stopCurrentBriefAudio() {
    if (currentBriefAudioEl) {
        try { currentBriefAudioEl.stop(); } catch(e){}
        try { currentBriefAudioEl.pause(); } catch(e){}
        currentBriefAudioEl = null;
    }
}

async function fetchBriefAudioBuffer(text, lang) {
    if (!text) return null;
    if (videoBriefState.audioCache[text]) return videoBriefState.audioCache[text];

    try {
        getBriefAudioDestination();
        if (!briefAudioCtx) return null;
        if (briefAudioCtx.state === 'suspended') {
            briefAudioCtx.resume().catch(() => {});
        }

        const res = await fetch(`${API_URL}/generate-tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, language: lang })
        });
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) return null;

        const data = await res.json();
        if (!data || !data.audio_url) return null;

        let arrayBuf;
        if (data.audio_url.startsWith('data:')) {
            const base64Str = data.audio_url.split(',')[1];
            const binaryStr = window.atob(base64Str);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            arrayBuf = bytes.buffer;
        } else {
            return null;
        }

        const decodedBuffer = await new Promise((resolve, reject) => {
            try {
                const res = briefAudioCtx.decodeAudioData(arrayBuf, buf => resolve(buf), err => reject(err));
                if (res && typeof res.then === 'function') {
                    res.then(resolve).catch(reject);
                }
            } catch(err) {
                reject(err);
            }
        });
        videoBriefState.audioCache[text] = decodedBuffer;
        return decodedBuffer;
    } catch(e) {
        console.warn("fetchBriefAudioBuffer warning:", e);
        return null;
    }
}

// ============================================================
// PROCEDURAL SKETCH RENDERER — hand-drawn canvas art engine
// Always visible, consistent characters, genuine sketch aesthetic
// ============================================================

// Deterministic seeded random so each scene+variation is stable across frames
function makeSeededRnd(seed) {
    let s = (Math.abs(seed) * 1664525 + 1013904223) >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const SKCLR = {
    ink:     '#2c1f0e',
    inkMid:  '#5a3a18',
    inkLight:'#8a6030',
    paper:   '#f5f0e4',
};

// Wobbly hand-drawn line
function skLine(ctx, x1, y1, x2, y2, rnd, wobble, color, lw) {
    const segs = Math.max(2, Math.ceil(Math.hypot(x2-x1, y2-y1) / 28));
    wobble = wobble || 1.5;
    ctx.save();
    ctx.strokeStyle = color || SKCLR.ink;
    ctx.lineWidth   = lw    || 2;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x1+(rnd()-0.5)*wobble, y1+(rnd()-0.5)*wobble);
    for (let i = 1; i <= segs; i++) {
        const t = i/segs;
        ctx.lineTo(x1+(x2-x1)*t+(rnd()-0.5)*wobble*1.6, y1+(y2-y1)*t+(rnd()-0.5)*wobble*1.6);
    }
    ctx.stroke(); ctx.restore();
}

// Wobbly oval
function skOval(ctx, cx, cy, rx, ry, rnd, color, lw, fill) {
    ctx.save();
    ctx.strokeStyle = color || SKCLR.ink;
    ctx.lineWidth   = lw    || 2;
    ctx.lineCap = 'round';
    if (fill) ctx.fillStyle = fill;
    const steps = 44;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
        const a = (i/steps)*Math.PI*2;
        const jit = (rnd()-0.5)*1.5;
        const x = cx + Math.cos(a)*(rx+jit);
        const y = cy + Math.sin(a)*(ry+jit*0.5);
        i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.closePath();
    if (fill) ctx.fill();
    ctx.stroke(); ctx.restore();
}

// ---- CHARACTER FIGURE DRAWER ----
// cx,baseY = foot-center; figH = total body height; gender='M'|'F'; pose = standing|reaching|arguing|sitting
function drawFigure(ctx, cx, baseY, figH, gender, pose, rnd) {
    const h = figH;
    const headR   = h*0.093;
    const neckH   = h*0.040;
    const shouldW = h*(gender==='F' ? 0.172 : 0.218);
    const torsoH  = h*0.270;
    const hipW    = h*(gender==='F' ? 0.152 : 0.172);
    const legH    = h*0.385;
    const armH    = h*0.268;
    const lw = Math.max(1.8, h*0.016);
    const c = SKCLR.ink, cm = SKCLR.inkMid;

    const headCY  = baseY - h + headR;
    const neckBot = headCY + headR + neckH;
    const shY     = neckBot;
    const waistY  = shY + torsoH*0.60;
    const hipY    = shY + torsoH;
    const kneeY   = hipY + legH*0.52;
    const footY   = baseY;

    // HEAD
    skOval(ctx, cx, headCY, headR, headR*1.07, rnd, c, lw, 'rgba(245,240,230,0.97)');

    // HAIR
    if (gender==='F') {
        ctx.save(); ctx.strokeStyle=c; ctx.lineWidth=lw*0.78; ctx.lineCap='round';
        ctx.beginPath();
        ctx.moveTo(cx-headR*0.88, headCY-headR*0.64);
        ctx.bezierCurveTo(cx-headR*1.55, headCY, cx-headR*1.75, headCY+headR*2, cx-headR*1.15, headCY+headR*2.85);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx+headR*0.88, headCY-headR*0.64);
        ctx.bezierCurveTo(cx+headR*1.55, headCY, cx+headR*1.75, headCY+headR*2, cx+headR*1.15, headCY+headR*2.85);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx-headR*0.9, headCY-headR*0.60);
        ctx.quadraticCurveTo(cx, headCY-headR*1.48, cx+headR*0.9, headCY-headR*0.60);
        ctx.stroke(); ctx.restore();
    } else {
        ctx.save(); ctx.strokeStyle=c; ctx.lineWidth=lw*0.88;
        ctx.beginPath();
        ctx.moveTo(cx-headR*0.94, headCY-headR*0.20);
        ctx.quadraticCurveTo(cx, headCY-headR*1.36, cx+headR*0.94, headCY-headR*0.20);
        ctx.stroke(); ctx.restore();
    }

    // FACE
    skLine(ctx, cx-headR*0.44, headCY-headR*0.10, cx-headR*0.12, headCY-headR*0.10, rnd, 0.4, c, lw*0.60);
    skLine(ctx, cx+headR*0.12, headCY-headR*0.10, cx+headR*0.44, headCY-headR*0.10, rnd, 0.4, c, lw*0.60);
    // eyebrows
    skLine(ctx, cx-headR*0.46, headCY-headR*0.28, cx-headR*0.13, headCY-headR*0.24, rnd, 0.4, c, lw*0.48);
    skLine(ctx, cx+headR*0.13, headCY-headR*0.24, cx+headR*0.46, headCY-headR*0.28, rnd, 0.4, c, lw*0.48);
    // nose
    ctx.save(); ctx.fillStyle=c; ctx.globalAlpha=0.68;
    ctx.beginPath(); ctx.arc(cx, headCY+headR*0.22, headR*0.065, 0, Math.PI*2); ctx.fill(); ctx.restore();
    // mouth
    const mouthY = headCY+headR*0.46;
    ctx.save(); ctx.strokeStyle=c; ctx.lineWidth=lw*0.58; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(cx-headR*0.27, mouthY);
    ctx.quadraticCurveTo(cx, mouthY+(pose==='arguing'?-3:2.5), cx+headR*0.27, mouthY);
    ctx.stroke(); ctx.restore();

    // NECK
    skLine(ctx, cx-headR*0.27, headCY+headR, cx-headR*0.21, shY, rnd, 0.5, c, lw*0.70);
    skLine(ctx, cx+headR*0.27, headCY+headR, cx+headR*0.21, shY, rnd, 0.5, c, lw*0.70);

    // SHOULDER / TORSO
    skLine(ctx, cx-shouldW, shY+5, cx+shouldW, shY+5, rnd, 2, c, lw);
    skLine(ctx, cx-shouldW, shY, cx-hipW, hipY, rnd, 1.8, c, lw*0.86);
    skLine(ctx, cx+shouldW, shY, cx+hipW, hipY, rnd, 1.8, c, lw*0.86);
    skLine(ctx, cx-hipW*1.10, waistY, cx+hipW*1.10, waistY, rnd, 1.5, c, lw*0.46);
    skLine(ctx, cx, shY+neckH*0.5, cx, hipY-5, rnd, 0.4, cm, lw*0.40);

    // ARMS
    if (pose==='reaching') {
        const elbow={x:cx+shouldW+armH*0.45,y:shY-armH*0.34};
        const hand ={x:cx+shouldW+armH*0.82,y:shY-armH*0.84};
        skLine(ctx, cx+shouldW, shY+5, elbow.x, elbow.y, rnd, 2.5, c, lw*0.84);
        skLine(ctx, elbow.x, elbow.y, hand.x, hand.y, rnd, 2.5, c, lw*0.84);
        skOval(ctx, hand.x+6, hand.y-4, headR*0.50, headR*0.40, rnd, c, lw*0.68, 'rgba(245,240,230,0.95)');
        skLine(ctx, cx-shouldW, shY+5, cx-shouldW-armH*0.08, shY+armH*0.84, rnd, 1.8, c, lw*0.84);
        skOval(ctx, cx-shouldW-armH*0.08, shY+armH*0.84+8, headR*0.48, headR*0.38, rnd, c, lw*0.68, 'rgba(245,240,230,0.95)');
    } else if (pose==='arguing') {
        skLine(ctx, cx+shouldW, shY+5, cx+shouldW+armH*0.66, shY-armH*0.43, rnd, 2.5, c, lw*0.84);
        skLine(ctx, cx-shouldW, shY+5, cx-shouldW-armH*0.56, shY-armH*0.33, rnd, 2.5, c, lw*0.84);
        skOval(ctx, cx+shouldW+armH*0.66+8, shY-armH*0.43-4, headR*0.50, headR*0.40, rnd, c, lw*0.68, 'rgba(245,240,230,0.95)');
        skOval(ctx, cx-shouldW-armH*0.56-8, shY-armH*0.33-4, headR*0.50, headR*0.40, rnd, c, lw*0.68, 'rgba(245,240,230,0.95)');
    } else if (pose==='sitting') {
        skLine(ctx, cx+shouldW, shY+5, cx+shouldW+armH*0.10, shY+armH*0.64, rnd, 1.8, c, lw*0.84);
        skLine(ctx, cx-shouldW, shY+5, cx-shouldW-armH*0.08, shY+armH*0.64, rnd, 1.8, c, lw*0.84);
        skOval(ctx, cx+shouldW+armH*0.10, shY+armH*0.64+8, headR*0.48, headR*0.38, rnd, c, lw*0.68, 'rgba(245,240,230,0.95)');
        skOval(ctx, cx-shouldW-armH*0.08, shY+armH*0.64+8, headR*0.48, headR*0.38, rnd, c, lw*0.68, 'rgba(245,240,230,0.95)');
    } else {
        skLine(ctx, cx+shouldW, shY+5, cx+shouldW+armH*0.12, shY+armH*0.88, rnd, 1.8, c, lw*0.84);
        skLine(ctx, cx-shouldW, shY+5, cx-shouldW-armH*0.10, shY+armH*0.88, rnd, 1.8, c, lw*0.84);
        skOval(ctx, cx+shouldW+armH*0.12, shY+armH*0.88+8, headR*0.48, headR*0.38, rnd, c, lw*0.68, 'rgba(245,240,230,0.95)');
        skOval(ctx, cx-shouldW-armH*0.10, shY+armH*0.88+8, headR*0.48, headR*0.38, rnd, c, lw*0.68, 'rgba(245,240,230,0.95)');
    }

    // HIP LINE
    skLine(ctx, cx-hipW, hipY, cx+hipW, hipY, rnd, 1.5, c, lw*0.72);

    // LOWER BODY
    if (gender==='F') {
        const dressW = hipW*1.52;
        skLine(ctx, cx-hipW, hipY, cx-dressW, footY, rnd, 2.5, c, lw*0.80);
        skLine(ctx, cx+hipW, hipY, cx+dressW, footY, rnd, 2.5, c, lw*0.80);
        ctx.save(); ctx.strokeStyle=c; ctx.lineWidth=lw*0.83; ctx.lineCap='round';
        ctx.beginPath();
        ctx.moveTo(cx-dressW, footY);
        ctx.quadraticCurveTo(cx, footY+6+(rnd()-0.5)*4, cx+dressW, footY);
        ctx.stroke(); ctx.restore();
        for (let f=1; f<4; f++) {
            const fy=hipY+(footY-hipY)*f/4;
            skLine(ctx, cx-hipW*(1+f*0.1), fy, cx+hipW*(1+f*0.1), fy+(rnd()-0.5)*5, rnd, 2, cm, lw*0.40);
        }
        skOval(ctx, cx-dressW*0.54, footY+6, hipW*0.36, hipW*0.17, rnd, c, lw*0.84, 'rgba(60,35,15,0.55)');
        skOval(ctx, cx+dressW*0.54, footY+6, hipW*0.36, hipW*0.17, rnd, c, lw*0.84, 'rgba(60,35,15,0.55)');
    } else if (pose==='sitting') {
        skLine(ctx, cx-hipW*0.6, hipY, cx-hipW*0.82-legH*0.44, hipY+legH*0.38, rnd, 2, c, lw*0.80);
        skLine(ctx, cx-hipW*0.82-legH*0.44, hipY+legH*0.38, cx-hipW*0.56-legH*0.2, hipY+legH*0.38+22, rnd, 2, c, lw*0.80);
        skLine(ctx, cx+hipW*0.6, hipY, cx+hipW*0.82+legH*0.44, hipY+legH*0.38, rnd, 2, c, lw*0.80);
        skLine(ctx, cx+hipW*0.82+legH*0.44, hipY+legH*0.38, cx+hipW*0.56+legH*0.2, hipY+legH*0.38+22, rnd, 2, c, lw*0.80);
    } else {
        // Left leg
        skLine(ctx, cx-hipW*0.54, hipY, cx-hipW*0.43, kneeY, rnd, 2, c, lw*0.86);
        skLine(ctx, cx-hipW*0.43, kneeY, cx-hipW*0.37, footY, rnd, 2, c, lw*0.86);
        skLine(ctx, cx-hipW*0.27, hipY+14, cx-hipW*0.23, kneeY, rnd, 1.5, cm, lw*0.46);
        skOval(ctx, cx-hipW*0.43, kneeY, hipW*0.21, hipW*0.17, rnd, cm, lw*0.48, null);
        // Right leg
        skLine(ctx, cx+hipW*0.54, hipY, cx+hipW*0.43, kneeY, rnd, 2, c, lw*0.86);
        skLine(ctx, cx+hipW*0.43, kneeY, cx+hipW*0.37, footY, rnd, 2, c, lw*0.86);
        skLine(ctx, cx+hipW*0.27, hipY+14, cx+hipW*0.23, kneeY, rnd, 1.5, cm, lw*0.46);
        skOval(ctx, cx+hipW*0.43, kneeY, hipW*0.21, hipW*0.17, rnd, cm, lw*0.48, null);
        // Shoes
        skLine(ctx, cx-hipW*0.37-7, footY, cx-hipW*0.37+h*0.088, footY+6, rnd, 1, c, lw*1.1);
        skLine(ctx, cx-hipW*0.37-7, footY, cx-hipW*0.37-7, footY+8, rnd, 0.5, c, lw);
        skLine(ctx, cx+hipW*0.37-7, footY, cx+hipW*0.37+h*0.088, footY+6, rnd, 1, c, lw*1.1);
        skLine(ctx, cx+hipW*0.37-7, footY, cx+hipW*0.37-7, footY+8, rnd, 0.5, c, lw);
    }
}

// ---- INTERIOR BACKGROUND ----
function drawBg_Interior(ctx, w, h, rnd, variation) {
    const horizY = h*0.54;
    // Perspective floor
    const vp = w/2;
    for (let i=0; i<=6; i++) {
        const fx = w*0.05+(w*0.9/6)*i;
        ctx.save(); ctx.strokeStyle=SKCLR.inkLight; ctx.lineWidth=0.9; ctx.globalAlpha=0.40;
        ctx.beginPath(); ctx.moveTo(fx,h-20); ctx.lineTo(vp+(fx-vp)*0.26,horizY+4); ctx.stroke(); ctx.restore();
    }
    skLine(ctx, 30, horizY, w-30, horizY, rnd, 2.5, SKCLR.ink, 2.5);
    skLine(ctx, 30, horizY+16, w-30, horizY+16, rnd, 1, SKCLR.inkMid, 1.2);
    // Walls
    skLine(ctx, 36, 52, w-36, 52, rnd, 2, SKCLR.ink, 2);
    skLine(ctx, 36, 52, 36, horizY, rnd, 1.5, SKCLR.ink, 2);
    skLine(ctx, w-36, 52, w-36, horizY, rnd, 1.5, SKCLR.ink, 2);
    // Subtle wallpaper lines
    ctx.save(); ctx.globalAlpha=0.05;
    for (let hy=78; hy<horizY; hy+=20) {
        ctx.strokeStyle=SKCLR.inkMid; ctx.lineWidth=0.65;
        ctx.beginPath(); ctx.moveTo(36,hy); ctx.lineTo(w-36,hy); ctx.stroke();
    }
    ctx.restore();

    if (variation%2===0) {
        // Window right
        const wx=w-208, wy=80, ww=152, wh=208;
        skLine(ctx,wx,wy,wx+ww,wy,rnd,1.5,SKCLR.ink,2.8); skLine(ctx,wx,wy,wx,wy+wh,rnd,1.5,SKCLR.ink,2.8);
        skLine(ctx,wx+ww,wy,wx+ww,wy+wh,rnd,1.5,SKCLR.ink,2.8); skLine(ctx,wx,wy+wh,wx+ww,wy+wh,rnd,1.5,SKCLR.ink,2.8);
        skLine(ctx,wx+ww/2,wy,wx+ww/2,wy+wh,rnd,1,SKCLR.ink,1.5); skLine(ctx,wx,wy+wh/2,wx+ww,wy+wh/2,rnd,1,SKCLR.ink,1.5);
        ctx.save(); ctx.globalAlpha=0.20; ctx.fillStyle='#dff0fc'; ctx.fillRect(wx+3,wy+3,ww-6,wh-6); ctx.restore();
        // Curtains
        for (let fi=0; fi<5; fi++) {
            const fcx=wx+fi*(ww*0.3/4); skLine(ctx,fcx,wy,fcx+(rnd()-0.5)*8,wy+wh,rnd,4,SKCLR.inkLight,1);
        }
        for (let fi=0; fi<5; fi++) {
            const fcx=wx+ww-fi*(ww*0.3/4); skLine(ctx,fcx,wy,fcx+(rnd()-0.5)*8,wy+wh,rnd,4,SKCLR.inkLight,1);
        }
    }
    if (variation%2===1) {
        // Bookshelf left with colourful spines
        const bx=44, by=68, bw=112, bh=horizY-86;
        skLine(ctx,bx,by,bx+bw,by,rnd,1,SKCLR.ink,2.5); skLine(ctx,bx,by,bx,by+bh,rnd,1,SKCLR.ink,2.5);
        skLine(ctx,bx+bw,by,bx+bw,by+bh,rnd,1,SKCLR.ink,2.5);
        const ns=4;
        for (let s=0; s<=ns; s++) {
            const sy=by+bh*(s/ns); skLine(ctx,bx,sy,bx+bw,sy,rnd,1,SKCLR.inkMid,1.5);
            if (s<ns) {
                let bkx=bx+5; const shH=bh/ns-8;
                while (bkx<bx+bw-7) {
                    const bkw=9+rnd()*15, bky=by+bh*(s/ns)+4;
                    ctx.save(); ctx.fillStyle=`hsl(${20+rnd()*55},${36+rnd()*34}%,${52+rnd()*20}%)`; ctx.globalAlpha=0.74; ctx.fillRect(bkx,bky,bkw,shH); ctx.restore();
                    skLine(ctx,bkx,bky,bkx,bky+shH,rnd,0.5,SKCLR.ink,1.2); skLine(ctx,bkx+bkw,bky,bkx+bkw,bky+shH,rnd,0.5,SKCLR.ink,1.2);
                    bkx+=bkw+2+rnd()*4;
                }
            }
        }
    }
    // Fireplace (variation 0,3)
    if (variation===0||variation===3) {
        const fx2=52, fy2=horizY-88, fw2=98, fh2=88;
        skLine(ctx,fx2,fy2,fx2+fw2,fy2,rnd,1,SKCLR.ink,2.5); skLine(ctx,fx2,fy2,fx2,fy2+fh2,rnd,1,SKCLR.ink,2.5);
        skLine(ctx,fx2+fw2,fy2,fx2+fw2,fy2+fh2,rnd,1,SKCLR.ink,2.5);
        ctx.save(); ctx.globalAlpha=0.14; ctx.fillStyle='#111'; ctx.fillRect(fx2+3,fy2+3,fw2-6,fh2-6); ctx.restore();
        skOval(ctx,fx2+fw2/2,fy2+fh2-24,18,22,rnd,'#c06020',1.5,'rgba(230,128,38,0.66)');
        skOval(ctx,fx2+fw2/2-10,fy2+fh2-17,10,13,rnd,'#c08020',1,'rgba(242,180,58,0.60)');
    }
    // Small table
    const tx=w*0.72, ty=horizY;
    skLine(ctx,tx-48,ty-48,tx+48,ty-48,rnd,2,SKCLR.ink,2);
    skLine(ctx,tx-42,ty-48,tx-38,ty,rnd,1,SKCLR.inkMid,1.5); skLine(ctx,tx+42,ty-48,tx+38,ty,rnd,1,SKCLR.inkMid,1.5);
}

// ---- EXTERIOR BACKGROUND ----
function drawBg_Exterior(ctx, w, h, rnd, variation, timeOfDay, settingType) {
    const horizY = h*0.44;
    // Sky
    if (timeOfDay==='night') {
        ctx.save(); ctx.globalAlpha=0.08; ctx.fillStyle='#0a0a2a'; ctx.fillRect(0,0,w,horizY); ctx.restore();
        for (let si=0; si<45; si++) {
            ctx.save(); ctx.globalAlpha=0.76; ctx.fillStyle=SKCLR.inkMid;
            ctx.beginPath(); ctx.arc(rnd()*w, rnd()*horizY, 0.8+rnd()*1.8, 0, Math.PI*2); ctx.fill(); ctx.restore();
        }
        skOval(ctx, w*0.80, h*0.10, 30,30, rnd, SKCLR.ink, 1.5, 'rgba(255,248,200,0.72)');
    } else if (timeOfDay==='dusk') {
        ctx.save(); ctx.globalAlpha=0.10;
        for (let dy=0; dy<horizY; dy+=18) {
            ctx.strokeStyle=dy<horizY*0.45?'#6a3060':'#c08040'; ctx.lineWidth=0.7;
            ctx.beginPath(); ctx.moveTo(0,dy); ctx.lineTo(w,dy); ctx.stroke();
        }
        ctx.restore();
        skOval(ctx, w*0.72, horizY-30, 38,38, rnd,'#c06020',2,'rgba(220,130,50,0.54)');
    } else {
        // Clouds
        [[0.20,0.12,68,28],[0.62,0.08,85,32],[0.44,0.19,58,22]].forEach(([fx,fy,rx,ry]) => {
            const ccx=w*fx,ccy=h*fy;
            skOval(ctx,ccx,ccy,rx,ry,rnd,SKCLR.inkLight,0.9,null);
            skOval(ctx,ccx-rx*0.38,ccy+ry*0.18,rx*0.60,ry*0.78,rnd,SKCLR.inkLight,0.8,null);
            skOval(ctx,ccx+rx*0.38,ccy+ry*0.12,rx*0.55,ry*0.72,rnd,SKCLR.inkLight,0.8,null);
        });
    }
    // Horizon
    skLine(ctx,24,horizY,w-24,horizY,rnd,3,SKCLR.ink,2.5);

    if (settingType==='ocean') {
        for (let wi=0; wi<16; wi++) {
            const wy=horizY+6+wi*14, wlen=w*(0.36+rnd()*0.54);
            skLine(ctx,(w-wlen)/2,wy,(w+wlen)/2,wy,rnd,4,SKCLR.inkLight,0.85);
        }
        skLine(ctx,w*0.37,horizY,w*0.37,horizY+106,rnd,2,SKCLR.ink,3.6);
        skLine(ctx,w*0.63,horizY,w*0.63,horizY+106,rnd,2,SKCLR.ink,3.6);
        for (let dp=0; dp<5; dp++) skLine(ctx,w*0.37,horizY+dp*22,w*0.63,horizY+dp*22,rnd,2.5,SKCLR.ink,1.9);
        if (variation%2===0) {
            const bx=w*0.14;
            skLine(ctx,bx-30,horizY-5,bx+30,horizY-5,rnd,1,SKCLR.ink,2);
            skLine(ctx,bx-28,horizY-5,bx-22,horizY+12,rnd,1,SKCLR.ink,2);
            skLine(ctx,bx+28,horizY-5,bx+22,horizY+12,rnd,1,SKCLR.ink,2);
            skLine(ctx,bx,horizY-5,bx,horizY-34,rnd,1,SKCLR.ink,1.5);
        }
    } else if (settingType==='forest') {
        [0.07,0.21,0.76,0.89,0.55].forEach((tp,ti) => {
            drawSketchTree(ctx, w*tp, horizY, [142,124,136,148,115][ti%5], rnd);
        });
        ctx.save(); ctx.globalAlpha=0.12;
        for (let gi=0; gi<20; gi++) {
            const gx=rnd()*w, gy=horizY+5+rnd()*(h-horizY-60);
            ctx.strokeStyle=SKCLR.inkMid; ctx.lineWidth=0.8;
            ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx+(rnd()-0.5)*20,gy+8+rnd()*12); ctx.stroke();
        }
        ctx.restore();
    } else if (settingType==='city') {
        drawSketchCityscape(ctx, w, horizY, rnd);
        // Street lamp
        skLine(ctx,w*0.25,horizY,w*0.25,horizY-122,rnd,1,SKCLR.ink,2.5);
        ctx.save(); ctx.strokeStyle=SKCLR.ink; ctx.lineWidth=2; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(w*0.25,horizY-122);
        ctx.bezierCurveTo(w*0.25,horizY-142,w*0.25+36,horizY-142,w*0.25+36,horizY-122); ctx.stroke(); ctx.restore();
        skOval(ctx,w*0.25+36,horizY-120,10,8,rnd,'#c0a020',1.2,'rgba(255,240,120,0.50)');
    } else {
        // Open landscape
        ctx.save(); ctx.strokeStyle=SKCLR.ink; ctx.lineWidth=2.2;
        ctx.beginPath(); ctx.moveTo(0,horizY+18);
        for (let xi=0; xi<=w; xi+=14) {
            ctx.lineTo(xi+(rnd()-0.5)*4, horizY+18+Math.sin(xi*0.009)*26+Math.sin(xi*0.023)*13+(rnd()-0.5)*3);
        }
        ctx.lineTo(w,h); ctx.lineTo(0,h);
        ctx.globalAlpha=0.08; ctx.fillStyle=SKCLR.inkLight; ctx.fill();
        ctx.globalAlpha=0.85; ctx.stroke(); ctx.restore();
        // Vegetation tufts
        for (let vi=0; vi<8; vi++) {
            const vx=50+rnd()*(w-100), vy=horizY+5+rnd()*80;
            for (let vj=0; vj<3; vj++) skLine(ctx,vx+(rnd()-0.5)*18,vy,vx+(rnd()-0.5)*14,vy+12+rnd()*18,rnd,2,SKCLR.inkMid,1.1);
        }
        if (variation>=2) drawSketchTree(ctx, w*0.84, horizY, 110, rnd);
    }
}

function drawSketchTree(ctx, x, groundY, h, rnd) {
    const tw=h*0.075;
    skLine(ctx,x-tw,groundY,x-tw*0.5,groundY-h*0.42,rnd,2.5,SKCLR.ink,3.2);
    skLine(ctx,x+tw,groundY,x+tw*0.5,groundY-h*0.42,rnd,2.5,SKCLR.ink,3.2);
    skLine(ctx,x-tw*0.5,groundY-h*0.42,x+tw*0.5,groundY-h*0.42,rnd,1,SKCLR.ink,2);
    skLine(ctx,x,groundY-h*0.42,x-h*0.21,groundY-h*0.68,rnd,2.5,SKCLR.ink,2.2);
    skLine(ctx,x,groundY-h*0.42,x+h*0.20,groundY-h*0.64,rnd,2.5,SKCLR.ink,2.2);
    skLine(ctx,x,groundY-h*0.42,x+h*0.04,groundY-h*0.75,rnd,2.5,SKCLR.ink,2);
    [[0,-0.72,0.30,0.32],[-.18,-0.65,0.24,0.27],[.20,-0.62,0.26,0.29],[0,-0.86,0.20,0.24]].forEach(([dx,dy,rx,ry]) => {
        skOval(ctx, x+dx*h, groundY+dy*h, rx*h, ry*h, rnd, SKCLR.ink, 1.9, null);
    });
}

function drawSketchCityscape(ctx, w, horizY, rnd) {
    [{x:0,bw:108,bh:198},{x:98,bw:72,bh:275},{x:162,bw:92,bh:158},{x:248,bw:62,bh:235},
     {x:w-348,bw:88,bh:218},{x:w-268,bw:108,bh:172},{x:w-162,bw:78,bh:295},{x:w-88,bw:92,bh:188}
    ].forEach(b => {
        const by=horizY-b.bh;
        ctx.save(); ctx.globalAlpha=0.11; ctx.fillStyle=SKCLR.inkLight; ctx.fillRect(b.x+2,by+2,b.bw-4,b.bh-2); ctx.restore();
        skLine(ctx,b.x,horizY,b.x,by,rnd,1.5,SKCLR.ink,2); skLine(ctx,b.x+b.bw,horizY,b.x+b.bw,by,rnd,1.5,SKCLR.ink,2);
        skLine(ctx,b.x,by,b.x+b.bw,by+(rnd()-0.5)*3,rnd,1.5,SKCLR.ink,2);
        for (let wy=by+18; wy<horizY-18; wy+=26) {
            for (let wx2=b.x+10; wx2<b.x+b.bw-8; wx2+=20) {
                if (rnd()>0.22) {
                    ctx.save(); ctx.fillStyle=rnd()>0.40?'rgba(255,238,110,0.45)':'rgba(195,218,255,0.25)'; ctx.globalAlpha=0.9;
                    ctx.fillRect(wx2,wy,9,12); ctx.strokeStyle=SKCLR.inkMid; ctx.lineWidth=0.7; ctx.strokeRect(wx2,wy,9,12); ctx.restore();
                }
            }
        }
    });
}

// ---- MAIN SKETCH COMPOSITOR ----
function drawSceneSketch(ctx, fw, fh, scene, sceneIdx, variation, characters) {
    const seed = (sceneIdx*10+variation)*997+7;
    const rnd  = makeSeededRnd(seed);

    const visual = scene.visual || {};
    const rawSetting = ((visual.setting||'')+' '+(scene.title||'')).toLowerCase();
    const isInterior = /\b(mansion|library|study|room|indoor|interior|hall|parlor|inn|dining|ballroom|prison|cell|office|court)\b/.test(rawSetting);
    const isOcean    = /\b(ocean|dock|river|lake|water|sea|shore|harbor|boat|ship)\b/.test(rawSetting);
    const isForest   = /\b(forest|wood|nature|garden|park|meadow|countryside)\b/.test(rawSetting);
    const isCity     = /\b(city|street|town|urban|alley|plaza)\b/.test(rawSetting);
    const timeOfDay  = visual.time || 'day';
    const action     = (visual.action||'').toLowerCase();
    const keyEl      = (visual.key_element||'').toLowerCase();

    // Paper background
    ctx.fillStyle = SKCLR.paper;
    ctx.fillRect(0,0,fw,fh);

    const groundY = fh * (isInterior ? 0.72 : 0.67);

    // Background
    if (isInterior) {
        drawBg_Interior(ctx, fw, fh, rnd, variation);
    } else {
        const st = isOcean?'ocean': isForest?'forest': isCity?'city':'open';
        drawBg_Exterior(ctx, fw, fh, rnd, variation, timeOfDay, st);
    }

    // Characters
    const charNames = (visual.characters_present && visual.characters_present.length>0)
        ? visual.characters_present.slice(0,3)
        : (characters.length>0 ? [characters[0].name] : ['Protagonist']);

    const numChars = Math.min(charNames.length,3);
    const posMap   = {1:[0.50],2:[0.33,0.67],3:[0.22,0.52,0.78]};
    const xPos     = posMap[numChars]||[0.50];
    const figH     = Math.min(fh*0.40, groundY-fh*0.08);

    // Determine poses from action
    const poseList = [];
    if (/reach|touch|grasp|extend|hold|gesture/.test(action)) poseList.push('reaching');
    else if (/argu|fight|confront|demand|accuse|shout/.test(action)) poseList.push('arguing');
    else if (/sit|seat|rest|slump/.test(action)) poseList.push('sitting');
    else poseList.push('standing');
    if (numChars>1) poseList.push(action.includes('confront')?'arguing':'standing');

    const FEMALE_NAMES = /^(mary|jane|elizabeth|emma|anne|daisy|helen|nora|margaret|rose|violet|lily|alice|eleanor|sophia|isabella|charlotte|mia|evelyn|abigail|scarlett|hester|pip|estella|cathy|hermione|desdemona|ophelia|portia|juliet|beatrice|rowena|lydia|caroline|dorothy|jane|lucy)\b/i;

    for (let i=0; i<numChars; i++) {
        const cx = fw * xPos[i];
        const charName = charNames[i] || '';
        const anchor = characters.find(c => {
            if (!c.name||!charName) return false;
            const cn=c.name.toLowerCase(), ch=charName.toLowerCase();
            return cn.includes(ch.split(' ')[0])||ch.includes(cn.split(' ')[0]);
        });
        const anchorText = (anchor?.anchor||'').toLowerCase();
        const isFemale = /\b(woman|female|girl|lady|her\b|she\b)\b/.test(anchorText)||FEMALE_NAMES.test(charName);
        const pose = poseList[i%poseList.length]||'standing';
        drawFigure(ctx, cx, groundY, figH, isFemale?'F':'M', pose, rnd);

        // Name label
        ctx.save();
        ctx.font=`italic ${Math.max(18,fw*0.020)}px Georgia, serif`;
        ctx.fillStyle=SKCLR.inkMid; ctx.textAlign='center'; ctx.globalAlpha=0.88;
        ctx.fillText(anchor?.name||charName, cx, groundY+24);
        ctx.restore();
    }

    // Atmospheric props based on key_element
    if (keyEl.includes('light') && !keyEl.includes('daylight')) {
        const lx=fw*0.82, ly=fh*0.20;
        ctx.save(); ctx.globalAlpha=0.62;
        for (let ri=0; ri<4; ri++) skOval(ctx,lx,ly,15+ri*12,15+ri*12,rnd,ri%2===0?'#1a6a1a':'#2d8a2d',0.6,null);
        skOval(ctx,lx,ly,16,16,rnd,'#1a4a1a',2.2,'rgba(50,190,50,0.55)');
        ctx.restore();
    }
    if (keyEl.includes('rain')||(timeOfDay==='night'&&variation%2===0)) {
        ctx.save(); ctx.strokeStyle=SKCLR.inkLight; ctx.lineWidth=0.65; ctx.globalAlpha=0.28;
        for (let ri=0; ri<38; ri++) {
            const rx=rnd()*fw, ry=rnd()*fh;
            ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(rx-4,ry+15); ctx.stroke();
        }
        ctx.restore();
    }
    if (keyEl.includes('fire')||keyEl.includes('candle')||keyEl.includes('lamp')) {
        const fx=fw*0.12, fy=groundY-55;
        skLine(ctx,fx-18,groundY-42,fx+25,groundY-42,rnd,2,SKCLR.inkMid,1.5);
        skLine(ctx,fx+4,groundY-42,fx+4,fy+20,rnd,1,SKCLR.inkMid,1.5);
        skOval(ctx,fx+4,fy,8,13,rnd,'#c05010',1.5,'rgba(235,125,35,0.72)');
    }
    if (keyEl.includes('crowd')||action.includes('celebrat')||action.includes('party')) {
        ctx.save(); ctx.globalAlpha=0.22;
        for (let ci=0; ci<12; ci++) {
            const cx2=35+rnd()*(fw-70), cr=12+rnd()*8;
            const cy2=groundY-55-rnd()*70;
            skOval(ctx,cx2,cy2,cr,cr*1.08,rnd,SKCLR.inkLight,1.1,SKCLR.paper);
            skLine(ctx,cx2,cy2+cr,cx2,cy2+cr+32,rnd,1.5,SKCLR.inkLight,1.2);
        }
        ctx.restore();
    }
    if (keyEl.includes('book')||keyEl.includes('letter')||keyEl.includes('scroll')||keyEl.includes('photograph')) {
        const px=fw*0.78, py=groundY-34;
        skLine(ctx,px,py,px+52,py,rnd,1,SKCLR.ink,2.2); skLine(ctx,px,py,px,py+36,rnd,1,SKCLR.ink,2.2);
        skLine(ctx,px+52,py,px+52,py+36,rnd,1,SKCLR.ink,2.2); skLine(ctx,px,py+36,px+52,py+36,rnd,1,SKCLR.ink,2.2);
        skLine(ctx,px,py+18,px+52,py+18,rnd,0.8,SKCLR.inkMid,0.9);
        skLine(ctx,px+8,py+4,px+44,py+4,rnd,0.5,SKCLR.inkLight,0.7);
    }

    // Paper grain texture
    ctx.save(); ctx.globalAlpha=0.04;
    for (let gi=0; gi<80; gi++) {
        ctx.fillStyle=SKCLR.inkLight;
        ctx.beginPath(); ctx.arc(rnd()*fw, rnd()*fh, 0.8+rnd()*1.2, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();

    // Decorative sketch border
    ctx.save(); ctx.strokeStyle=SKCLR.inkLight; ctx.lineWidth=0.7; ctx.globalAlpha=0.30;
    ctx.setLineDash([4,5]); ctx.strokeRect(22,22,fw-44,fh-44); ctx.setLineDash([]); ctx.restore();
}

function drawVideoBriefCanvas() {
    const canvas = document.getElementById('brief-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;  // 1080
    const height = canvas.height; // 1920

    ctx.clearRect(0, 0, width, height);

    // 1. Warm Beige Paper Background (#faf7f0)
    ctx.fillStyle = '#faf7f0';
    ctx.fillRect(0, 0, width, height);

    // Subtle paper grain & warm border vignette
    ctx.save();
    const bgGlow = ctx.createRadialGradient(width / 2, height / 2, 400, width / 2, height / 2, 1000);
    bgGlow.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    bgGlow.addColorStop(1, 'rgba(217, 119, 6, 0.08)');
    ctx.fillStyle = bgGlow;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // 2. Full-Stage Sketch Illustration Frame (NO TEXT OVERLAYS AS REQUESTED)
    const activeScene = videoBriefState.scenes[videoBriefState.currentIndex];
    const frameX = 60;
    const frameY = 100;
    const frameW = width - 120; // 960px
    const frameH = 1720;        // Full-bleed 1720px tall sketch frame

    // Paper Card Background & Border
    ctx.save();
    ctx.shadowColor = 'rgba(180, 83, 9, 0.15)';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(frameX, frameY, frameW, frameH, 36);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Determine active AI sketch image based on 3.5s rotation frequency
    let activeImageObj = null;
    if (activeScene) {
        if (activeScene.sketchImages && activeScene.sketchImages.length > 0) {
            const elapsedMs = videoBriefState.isPlaying
                ? Math.max(0, performance.now() - (videoBriefState.sceneWallStartMs || performance.now()))
                : 0;
            const imgIdx = Math.floor(elapsedMs / 3500) % activeScene.sketchImages.length;
            for (let attempt = 0; attempt < activeScene.sketchImages.length; attempt++) {
                const candidate = activeScene.sketchImages[(imgIdx + attempt) % activeScene.sketchImages.length];
                if (candidate && candidate._loaded && !candidate._broken && candidate.naturalWidth > 0) {
                    activeImageObj = candidate; break;
                }
                if (candidate && !candidate._broken && candidate.complete && candidate.naturalWidth > 0) {
                    activeImageObj = candidate; break;
                }
            }
        } else if (activeScene.imageObj && !activeScene.imageObj._broken) {
            activeImageObj = activeScene.imageObj;
        }
    }

    const imgReady = activeImageObj
        && !activeImageObj._broken
        && activeImageObj.complete
        && activeImageObj.naturalWidth > 0
        && activeImageObj.naturalHeight > 0;

    if (imgReady) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(frameX + 8, frameY + 8, frameW - 16, frameH - 16, 30);
        ctx.clip();

        // Ken Burns Gentle Zoom & Pan Effect
        videoBriefState.panZoomProgress = (videoBriefState.panZoomProgress + 0.0012) % 1.0;
        const zoomScale = 1.0 + Math.sin(videoBriefState.panZoomProgress * Math.PI) * 0.04;
        const panX = Math.cos(videoBriefState.panZoomProgress * Math.PI * 2) * 10;
        const panY = Math.sin(videoBriefState.panZoomProgress * Math.PI * 2) * 6;

        const imgW = activeImageObj.naturalWidth;
        const imgH = activeImageObj.naturalHeight;
        const scale = Math.max((frameW - 16) / imgW, (frameH - 16) / imgH) * zoomScale;
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const drawX = frameX + 8 + ((frameW - 16) - drawW) / 2 + panX;
        const drawY = frameY + 8 + ((frameH - 16) - drawH) / 2 + panY;

        try {
            ctx.drawImage(activeImageObj, drawX, drawY, drawW, drawH);
        } catch(drawErr) {
            console.warn('drawImage skipped:', drawErr.message);
        }
        ctx.restore();
    } else if (activeScene) {
        // Fallback procedural sketch while loading or if images unavailable
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(frameX + 8, frameY + 8, frameW - 16, frameH - 16, 30);
        ctx.clip();
        ctx.translate(frameX + 8, frameY + 8);
        const elapsedMs = videoBriefState.isPlaying
            ? Math.max(0, performance.now() - (videoBriefState.sceneWallStartMs || performance.now()))
            : 0;
        const variationIdx = Math.floor(elapsedMs / 3500) % 4;
        drawSceneSketch(ctx, frameW - 16, frameH - 16, activeScene, videoBriefState.currentIndex, variationIdx, videoBriefState.characters || []);
        ctx.restore();
    }
}


async function speakBriefText(text, lang, onEnd, onProgress) {
    if (!text) { if (onEnd) onEnd(); return; }
    stopCurrentBriefAudio();

    if (videoBriefState.typewriterInterval) {
        cancelAnimationFrame(videoBriefState.typewriterInterval);
        videoBriefState.typewriterInterval = null;
    }

    let handled = false;

    const startSubtitleLoop = (durMs) => {
        const startTime = briefAudioCtx ? briefAudioCtx.currentTime : (performance.now() / 1000);
        const totalLen = text.length;

        function step() {
            if (handled) return;
            const now = briefAudioCtx ? briefAudioCtx.currentTime : (performance.now() / 1000);
            const elapsedMs = Math.max(0, (now - startTime) * 1000);
            const ratio = Math.min(1.0, elapsedMs / Math.max(1, durMs));

            const charCount = Math.min(totalLen, Math.floor(ratio * totalLen));
            videoBriefState.subtitlesText = text.substring(0, charCount);
            if (onProgress) onProgress(charCount, ratio);

            if (ratio < 1.0) {
                videoBriefState.typewriterInterval = requestAnimationFrame(step);
            }
        }
        videoBriefState.typewriterInterval = requestAnimationFrame(step);
    };

    const finish = () => {
        if (!handled) {
            handled = true;
            if (videoBriefState.typewriterInterval) {
                cancelAnimationFrame(videoBriefState.typewriterInterval);
                videoBriefState.typewriterInterval = null;
            }
            videoBriefState.subtitlesText = text;
            if (onEnd) onEnd();
        }
    };

    try {
        const audioBuffer = await fetchBriefAudioBuffer(text, lang);
        if (audioBuffer && briefAudioCtx) {
            const source = briefAudioCtx.createBufferSource();
            currentBriefAudioEl = source;
            source.buffer = audioBuffer;
            const dest = getBriefAudioDestination();
            if (dest) source.connect(dest);
            if (!videoBriefState.isExporting) {
                source.connect(briefAudioCtx.destination);
            }
            const durMs = audioBuffer.duration * 1000;
            startSubtitleLoop(durMs);
            source.onended = () => finish();
            source.start(0);
        } else {
            finish();
        }
    } catch(e) {
        finish();
    }
}

async function startVideoBriefSequence(isExportingRun = false, resumeFromIndex = 0) {
    const lang = document.getElementById('brief-language')?.value || 'English';
    if (!videoBriefState.scenes || videoBriefState.scenes.length === 0) return;

    // Stop any existing playback cleanly without resetting scenes
    if (!isExportingRun) {
        videoBriefState.isExporting = false;
    }
    // Cancel existing animation frame & audio but preserve scenes & currentIndex
    stopCurrentBriefAudio();
    if (videoBriefState.typewriterInterval) {
        cancelAnimationFrame(videoBriefState.typewriterInterval);
        videoBriefState.typewriterInterval = null;
    }
    if (videoBriefState.animFrameId) {
        cancelAnimationFrame(videoBriefState.animFrameId);
        videoBriefState.animFrameId = null;
    }

    videoBriefState.isPlaying = true;
    videoBriefState.currentIndex = resumeFromIndex;

    // Start render loop
    function renderLoop() {
        if (videoBriefState.isPlaying || videoBriefState.isExporting) {
            drawVideoBriefCanvas();
            updateBriefTimelineProgress();
            videoBriefState.animFrameId = requestAnimationFrame(renderLoop);
        }
    }
    videoBriefState.animFrameId = requestAnimationFrame(renderLoop);

    function animateScene(idx) {
        if (!videoBriefState.isPlaying) return;
        if (idx >= videoBriefState.scenes.length) {
            // Playback complete
            videoBriefState.isPlaying = false;
            if (isExportingRun && videoBriefState.mediaRecorder && videoBriefState.mediaRecorder.state !== 'inactive') {
                try { videoBriefState.mediaRecorder.stop(); } catch(e){}
            }
            if (videoBriefState.animFrameId) cancelAnimationFrame(videoBriefState.animFrameId);
            const phaseLabel = document.getElementById('brief-phase-label');
            if (phaseLabel) phaseLabel.innerText = 'Playback Complete';
            drawVideoBriefCanvas();
            return;
        }

        videoBriefState.currentIndex = idx;
        // Use wall-clock time for reliable sketch rotation
        videoBriefState.sceneWallStartMs = performance.now();
        const scene = videoBriefState.scenes[idx];
        const phaseLabel = document.getElementById('brief-phase-label');
        if (phaseLabel) phaseLabel.innerText = `Scene ${idx + 1}/${videoBriefState.scenes.length}: ${scene.title}`;

        speakBriefText(scene.narration, lang, () => {
            if (!videoBriefState.isPlaying) return;
            setTimeout(() => animateScene(idx + 1), 200);
        });
    }

    animateScene(resumeFromIndex);
}

function stopVideoBriefSequence(keepRecorder = false) {
    // Pause playback — preserve currentIndex so resume works from where we stopped
    videoBriefState.isPlaying = false;
    stopCurrentBriefAudio();

    if (videoBriefState.typewriterInterval) {
        cancelAnimationFrame(videoBriefState.typewriterInterval);
        videoBriefState.typewriterInterval = null;
    }
    if (videoBriefState.animFrameId) {
        cancelAnimationFrame(videoBriefState.animFrameId);
        videoBriefState.animFrameId = null;
    }

    if (!keepRecorder && videoBriefState.mediaRecorder && videoBriefState.mediaRecorder.state !== 'inactive') {
        try { videoBriefState.mediaRecorder.stop(); } catch(e){}
    }
    if (!keepRecorder) videoBriefState.isExporting = false;

    const phaseLabel = document.getElementById('brief-phase-label');
    if (phaseLabel && !videoBriefState.isExporting) {
        const sc = videoBriefState.scenes[videoBriefState.currentIndex];
        phaseLabel.innerText = sc ? `⏸ Paused — Scene ${videoBriefState.currentIndex + 1}: ${sc.title}` : 'Paused';
    }
    drawVideoBriefCanvas();
}

function updateBriefTimelineProgress() {
    const totalScenes = videoBriefState.scenes.length;
    if (totalScenes === 0) return;

    const slider = document.getElementById('brief-timeline-slider');
    const label = document.getElementById('brief-time-label');

    const pct = ((videoBriefState.currentIndex + 1) / totalScenes) * 100;
    if (slider && !slider.__isDragging) slider.value = pct;
    if (label) label.innerText = `Scene ${videoBriefState.currentIndex + 1} / ${totalScenes}`;
}

async function exportVideoBrief() {
    const canvas = document.getElementById('brief-canvas');
    if (!canvas) return;

    const exportBtn = document.getElementById('brief-export-btn');
    if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.innerHTML = `<i data-feather="loader" class="spin"></i> Exporting HD Video...`;
    }

    const phaseLabel = document.getElementById('brief-phase-label');
    if (phaseLabel) phaseLabel.innerText = "🎬 Recording Video Brief Reel...";

    stopVideoBriefSequence();
    videoBriefState.isExporting = true;
    videoBriefState.isPlaying = true;
    videoBriefState.recordedChunks = [];

    const canvasStream = canvas.captureStream(30);
    const audioDest = getBriefAudioDestination();

    const combinedStream = new MediaStream();
    canvasStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));
    if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
        audioDest.stream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
    }

    let options = { mimeType: 'video/webm;codecs=vp9,opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' };
    }

    try {
        const recorder = new MediaRecorder(combinedStream, options);
        videoBriefState.mediaRecorder = recorder;

        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                videoBriefState.recordedChunks.push(e.data);
            }
        };

        recorder.onstop = () => {
            const blob = new Blob(videoBriefState.recordedChunks, { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const filename = (videoBriefState.bookTitle || 'Video_Brief').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            a.download = `${filename}_brief_reel_${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            videoBriefState.isExporting = false;
            videoBriefState.isPlaying = false;

            if (exportBtn) {
                exportBtn.disabled = false;
                exportBtn.innerHTML = `<i data-feather="check"></i> Brief Downloaded!`;
                setTimeout(() => {
                    exportBtn.innerHTML = `<i data-feather="download"></i> Export Brief (.mp4)`;
                }, 4000);
            }
        };

        recorder.start(100);
        startVideoBriefSequence(true);

    } catch (err) {
        console.error("Brief export error:", err);
        alert("Failed to record video stream: " + err.message);
        videoBriefState.isExporting = false;
        videoBriefState.isPlaying = false;
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = `<i data-feather="download"></i> Export Brief (.mp4)`;
        }
    }
}

function initVideoBriefStudio() {
    drawVideoBriefCanvas();

    const triggerBtn = document.getElementById('trigger-brief-generate');
    if (triggerBtn && !triggerBtn.__bound) {
        triggerBtn.__bound = true;
        triggerBtn.addEventListener('click', async () => {
            const topic = document.getElementById('brief-topic')?.value?.trim();
            const voiceMode = document.getElementById('brief-voice-mode')?.value || 'storyteller';
            const lang = document.getElementById('brief-language')?.value || 'English';
            const feedback = document.getElementById('brief-feedback');

            if (!topic) {
                if (feedback) { feedback.style.display = 'block'; feedback.innerText = 'Please enter a book title or topic.'; }
                return;
            }

            triggerBtn.disabled = true;
            triggerBtn.innerHTML = `<i data-feather="loader" class="spin"></i> Summarizing & Generating Sketches...`;
            if (feedback) { feedback.style.display = 'none'; }

            try {
                const res = await fetch(`${API_URL}/generate-video-brief`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ topic, mode: voiceMode })
                });

                const contentType = res.headers.get('content-type') || '';
                if (!contentType.includes('application/json')) {
                    const errorText = await res.text();
                    throw new Error(`Server response error (${res.status}): ${errorText.substring(0, 100)}... Please wait a moment while the backend finishes booting.`);
                }

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to generate brief script');

                if (data.brief && data.brief.scenes) {
                    videoBriefState.bookTitle = data.brief.book_title || topic;
                    videoBriefState.tagline = data.brief.tagline || '';
                    videoBriefState.characters = data.brief.characters || [];
                    videoBriefState.scenes = data.brief.scenes;
                    videoBriefState.currentIndex = 0;

                    const anchorDiv = document.getElementById('brief-character-anchors');
                    if (anchorDiv && videoBriefState.characters.length > 0) {
                        anchorDiv.innerHTML = `<strong>Character Anchors:</strong> ` + videoBriefState.characters.map(c => `<span style="color:#f59e0b;font-weight:600;">${c.name}</span> (${c.anchor})`).join(' • ');
                    }

                    const listContainer = document.getElementById('brief-scenes-list');
                    const badgeCount = document.getElementById('brief-scene-count-badge');
                    if (badgeCount) badgeCount.innerText = `${videoBriefState.scenes.length} Scenes`;

                    if (listContainer) {
                        listContainer.innerHTML = '';
                        videoBriefState.scenes.forEach((s, idx) => {
                            const card = document.createElement('div');
                            card.style.cssText = `padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:12px;cursor:pointer;`;
                            card.innerHTML = `<div style="font-weight:700;color:#f59e0b;">Scene ${s.scene_number}: ${s.title}</div><div style="color:var(--color-fg-muted);margin-top:2px;">${s.narration.substring(0, 60)}...</div>`;
                            card.onclick = () => {
                                videoBriefState.currentIndex = idx;
                                drawVideoBriefCanvas();
                            };
                            listContainer.appendChild(card);
                        });
                    }

                    // Preload AI Charcoal & Watercolor Sketches + Voice Narration
                    const totalSteps = videoBriefState.scenes.length * 2;
                    let currentStep = 0;

                    const progressModal = document.getElementById('brief-progress-container');
                    const progressText = document.getElementById('brief-progress-text');
                    const progressBar = document.getElementById('brief-progress-bar-inner');

                    if (progressModal) progressModal.style.display = 'flex';

                    for (let i = 0; i < videoBriefState.scenes.length; i++) {
                        const scene = videoBriefState.scenes[i];
                        scene.sketchImages = [];

                        const sketchPrompts = (scene.sketch_prompts && scene.sketch_prompts.length > 0)
                            ? scene.sketch_prompts
                            : [scene.sketch_prompt || `Artistic charcoal sketch with soft muted watercolor wash for ${scene.title}`];

                        // Generate AI Charcoal & Watercolor sketch images
                        for (let k = 0; k < Math.min(sketchPrompts.length, 3); k++) {
                            const p = sketchPrompts[k];
                            if (progressText) progressText.innerText = `🎨 Painting Charcoal & Watercolor Sketch ${k + 1}/${Math.min(sketchPrompts.length, 3)} for Scene ${i + 1}/${videoBriefState.scenes.length}...`;
                            try {
                                const skRes = await fetch(`${API_URL}/generate-brief-sketch`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ prompt: p, scene_number: scene.scene_number, sketch_index: k })
                                });
                                const skData = await skRes.json();
                                const imgSrc = skData.image_data || skData.image_url;
                                if (imgSrc) {
                                    const img = new Image();
                                    img._broken = false;
                                    img._loaded = false;
                                    await new Promise((resolve) => {
                                        img.onload = () => { img._loaded = true; resolve(); };
                                        img.onerror = () => { img._broken = true; resolve(); };
                                        img.src = imgSrc;
                                        setTimeout(resolve, 30000);
                                    });
                                    scene.sketchImages.push(img);
                                    if (k === 0) scene.imageObj = img;
                                }
                            } catch(e) {
                                console.warn(`Scene ${i+1} sketch ${k+1} fetch failed:`, e);
                            }
                        }

                        currentStep++;
                        if (progressBar) progressBar.style.width = `${Math.round((currentStep / totalSteps) * 100)}%`;

                        if (progressText) progressText.innerText = `🎙️ Pre-loading HD Voice Narration ${i + 1}/${videoBriefState.scenes.length}...`;
                        await fetchBriefAudioBuffer(scene.narration, lang);
                        currentStep++;
                        if (progressBar) progressBar.style.width = `${Math.round((currentStep / totalSteps) * 100)}%`;
                    }

                    if (progressModal) progressModal.style.display = 'none';

                    drawVideoBriefCanvas();
                }
            } catch(err) {
                console.error("Video Brief error:", err);
                if (feedback) { feedback.style.display = 'block'; feedback.innerText = err.message; }
            } finally {
                triggerBtn.disabled = false;
                triggerBtn.innerHTML = `<i data-feather="book-open" style="width: 16px; height: 16px;"></i> Generate 2-Min Video Brief`;
            }
        });
    }

    document.getElementById('brief-play-btn')?.addEventListener('click', () => {
        if (videoBriefState.isPlaying) return; // Already playing
        const resumeIdx = videoBriefState.currentIndex || 0;
        startVideoBriefSequence(false, resumeIdx);
    });

    document.getElementById('brief-stop-btn')?.addEventListener('click', () => {
        stopVideoBriefSequence();
    });

    document.getElementById('brief-export-btn')?.addEventListener('click', () => {
        exportVideoBrief();
    });

    // Slider: seek to any scene
    const slider = document.getElementById('brief-timeline-slider');
    if (slider) {
        slider.addEventListener('mousedown', () => { slider.__isDragging = true; });
        slider.addEventListener('touchstart', () => { slider.__isDragging = true; }, { passive: true });
        slider.addEventListener('input', () => {
            if (!videoBriefState.scenes.length) return;
            const pct = parseFloat(slider.value);
            const totalScenes = videoBriefState.scenes.length;
            const targetIdx = Math.max(0, Math.min(totalScenes - 1, Math.round((pct / 100) * totalScenes - 0.5)));
            videoBriefState.currentIndex = targetIdx;
            videoBriefState.sceneWallStartMs = performance.now();
            const label = document.getElementById('brief-time-label');
            if (label) label.innerText = `Scene ${targetIdx + 1} / ${totalScenes}`;
            const phaseLabel = document.getElementById('brief-phase-label');
            const sc = videoBriefState.scenes[targetIdx];
            if (phaseLabel && sc) phaseLabel.innerText = `Scene ${targetIdx + 1}: ${sc.title}`;
            drawVideoBriefCanvas();
        });
        slider.addEventListener('change', () => {
            slider.__isDragging = false;
            // If was playing, restart from new position
            if (videoBriefState.scenes.length) {
                const pct = parseFloat(slider.value);
                const totalScenes = videoBriefState.scenes.length;
                const targetIdx = Math.max(0, Math.min(totalScenes - 1, Math.round((pct / 100) * totalScenes - 0.5)));
                if (videoBriefState.isPlaying) {
                    startVideoBriefSequence(false, targetIdx);
                } else {
                    videoBriefState.currentIndex = targetIdx;
                    videoBriefState.sceneWallStartMs = performance.now();
                    drawVideoBriefCanvas();
                }
            }
        });
    }
}

window.videoBriefState = videoBriefState;
window.initVideoBriefStudio = initVideoBriefStudio;
window.drawVideoBriefCanvas = drawVideoBriefCanvas;
window.startVideoBriefSequence = startVideoBriefSequence;
window.stopVideoBriefSequence = stopVideoBriefSequence;
window.exportVideoBrief = exportVideoBrief;

