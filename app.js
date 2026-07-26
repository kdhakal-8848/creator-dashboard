import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from './config.js';

const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;

let supabase = null;
let isMockMode = false;
let isGuest = false;
let currentUser = null;
window.isGuest = false;

try {
    if (SUPABASE_URL && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        isMockMode = true;
    }
} catch (err) {
    console.warn("Supabase client init error, switching to mock mode:", err);
    isMockMode = true;
}

if (!isMockMode && supabase) {
    try {
        supabase.auth.getSession().then(({ data: { session } }) => {
            handleAuthChange(session);
        }).catch(e => console.warn("getSession error:", e));

        supabase.auth.onAuthStateChange((_event, session) => {
            handleAuthChange(session);
        });
    } catch (e) {
        console.warn("AuthStateChange error:", e);
    }
} else {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
}

function handleAuthChange(session) {
    if (isGuest) return;
    if (session) {
        currentUser = session.user;
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

        if (!isMockMode) {
            supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
                if (data && (data.currentLevel === 'aal2' || data.nextLevel === 'aal2')) {
                    const mfaText = document.getElementById('mfa-status-text');
                    const mfaBtn = document.getElementById('enroll-mfa-btn');
                    if (mfaText) { mfaText.innerText = 'Enabled'; mfaText.style.color = 'var(--color-success-fg)'; }
                    if (mfaBtn) mfaBtn.style.display = 'none';
                }
            });
        }

        fetchBrands();
        loadDashboardStats();
    } else {
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
    }
}

// --- Auth UI ---
const handleLoginAction = async (e) => {
    if (e) e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const feedback = document.getElementById('login-feedback');

    if (isMockMode) {
        if (email && password) {
            feedback.innerText = "Success (Mock Mode)!";
            feedback.style.color = "var(--color-success-fg)";
            setTimeout(() => {
                document.getElementById('login-container').style.display = 'none';
                document.getElementById('app-container').style.display = 'flex';
                const nameParam = email.split('@')[0].substring(0, 2).toUpperCase();
                document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${nameParam}&background=random`;
                fetchBrands();
                loadDashboardStats();
            }, 500);
        } else {
            feedback.innerText = "Please enter any email/password.";
            feedback.style.color = "var(--color-danger-fg)";
        }
        return;
    }
    if (!email || !password) {
        showLoginError('Please enter your email and password.');
        return;
    }
    setLoginLoading(true);
    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            let msg = error.message;
            if (msg.includes('Invalid login credentials')) msg = '❌ Wrong email or password. Please try again.';
            else if (msg.includes('Email not confirmed')) msg = '📧 Please confirm your email first before signing in.';
            else if (msg.includes('User not found')) msg = '❌ No account found with that email. Click Sign Up to create one.';
            showLoginError(msg);
        } else {
            showLoginSuccess('✅ Signed in! Loading...');
        }
    } catch (err) {
        showLoginError('⚠️ Network error: ' + err.message);
    } finally {
        setLoginLoading(false);
    }
};

document.getElementById('login-btn')?.addEventListener('click', handleLoginAction);
document.getElementById('signin-form')?.addEventListener('submit', handleLoginAction);

// Sign Up Handler
document.getElementById('signup-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) {
        showLoginError('Please enter your email & password to sign up.');
        return;
    }
    if (password.length < 6) {
        showLoginError('❌ Password must be at least 6 characters.');
        return;
    }
    setLoginLoading(true);
    if (isMockMode) {
        setTimeout(() => {
            showLoginSuccess('✅ Mock account created! Click Sign In.');
            setLoginLoading(false);
        }, 500);
        return;
    }
    try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
            showLoginError('❌ ' + error.message);
        } else {
            if (data.session) {
                showLoginSuccess('✅ Account created & signed in!');
                handleAuthChange(data.session);
            } else {
                showLoginSuccess('✅ Account created! Check your email to confirm, then Sign In.');
            }
        }
    } catch (err) {
        showLoginError('⚠️ Network error: ' + err.message);
    } finally {
        setLoginLoading(false);
    }
});

window.fetchBrands = fetchBrands;
window.loadDashboardStats = loadDashboardStats;
window.handleAuthChange = handleAuthChange;
window.renderFabricSlide = renderFabricSlide;

// Guest Mode Handler
document.getElementById('guest-btn')?.addEventListener('click', () => {
    window.isGuest = true;
    isGuest = true;
    window.enableGuestMode();
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

document.getElementById('logout-btn').addEventListener('click', async (e) => {
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
    const selectors = ['brand-selector', 'manual-brand', 'queue-brand-filter', 'news-brand', 'facts-brand'];
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
        if (id === 'brand-selector') sel.value = activeBrandId;
        else if (['manual-brand', 'news-brand', 'facts-brand'].includes(id)) sel.value = activeBrandId;
        else if (currentVal) sel.value = currentVal;
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
const navLinks = document.querySelectorAll('.nav-links a');
const views = document.querySelectorAll('.view');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navLinks.forEach(l => l.classList.remove('active'));
        views.forEach(v => v.classList.remove('active-view'));
        link.classList.add('active');
        const targetViewId = link.getAttribute('data-target');
        const targetView = document.getElementById(targetViewId);
        if (targetView) targetView.classList.add('active-view');
        const h1 = document.querySelector('.topbar h1');
        if (h1) h1.textContent = link.textContent.trim();
        if (targetViewId === 'home-view') loadDashboardStats();
        if (targetViewId === 'queue-view') loadQueue();
        if (targetViewId === 'video-view') loadVideoQueue();
        if (targetViewId === 'settings-view') loadSettings();
        if (targetViewId === 'branding-view') loadBrandingView();
        if (targetViewId === 'template-studio-view') initTemplateStudio();
        if (window.feather) feather.replace();
    });
});

// ============================================================
// DATA HELPERS
// ============================================================
async function getPosts() {
    if (isMockMode) return mockPosts;
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
        const parsed = JSON.parse(text);
        return parsed; // { slides, caption }
    } catch {
        return { slides: [{ title: "Content", content: text }], caption: text };
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
    const statusFilter = document.getElementById('status-filter').value;
    const brandFilter = document.getElementById('queue-brand-filter')?.value || 'All';
    grid.innerHTML = '';
    let filtered = posts;
    if (statusFilter !== 'All') filtered = filtered.filter(p => p.status === statusFilter);
    if (brandFilter !== 'All') filtered = filtered.filter(p => p.brand_id === brandFilter);
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

document.getElementById('status-filter').addEventListener('change', loadQueue);
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
const CANVAS_W = 1080;
const CANVAS_H = 1350;
const PREVIEW_W = 400;
const PREVIEW_H = 500;
const CANVAS_ZOOM = PREVIEW_W / CANVAS_W; // 0.37037

let fabricCanvas = null;
let studioCanvas = null;
let currentEditingId = null;
let currentSlides = [];
let currentSlideIndex = 0;
let currentImageUrls = [];
let canvasHistory = [];
let canvasHistoryPointer = -1;

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
}

function syncFabricCanvasToCurrentSlide() {
    if (!fabricCanvas || !currentSlides[currentSlideIndex]) return;
    // Only sync if canvas has objects (avoid syncing after a clear)
    const objects = fabricCanvas.getObjects();
    if (objects.length === 0) return;
    let updated = false;
    objects.forEach(obj => {
        const style = {
            left: obj.left, top: obj.top, width: obj.width, fontSize: obj.fontSize,
            fill: obj.fill, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle,
            fontWeight: obj.fontWeight, fontStyle: obj.fontStyle, textAlign: obj.textAlign
        };
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
        }
    });
    if (!updated) return;
    // Also update the form inputs if they exist
    const titleIn = document.getElementById(`slide-title-${currentSlideIndex}`);
    const contentIn = document.getElementById(`slide-content-${currentSlideIndex}`);
    if (titleIn) titleIn.value = currentSlides[currentSlideIndex].title || '';
    if (contentIn) contentIn.value = currentSlides[currentSlideIndex].content || '';
}

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
    if (fontSizeInput && obj.fontSize) fontSizeInput.value = Math.round(obj.fontSize);
    if (colorInput && obj.fill) colorInput.value = fabricColorToHex(obj.fill);
}

function fabricColorToHex(color) {
    if (!color || color === '') return '#ffffff';
    if (color.startsWith('#')) return color;
    try {
        const c = new fabric.Color(color);
        return '#' + c.toHex();
    } catch { return '#ffffff'; }
}

// --- CORE RENDER FUNCTION: Render one slide to the Fabric canvas ---
// --- CORE RENDER FUNCTION: Render one slide to the Fabric canvas ---
async function renderFabricSlide(slideData, slideIndex, imageUrl, brand) {
    if (!fabricCanvas) initFabricCanvas();
    if (!fabricCanvas) return;

    // We do NOT sync here anymore, because it would overwrite the new target slide
    // with the old slide's canvas state just before we draw the new one!
    // Sync is now strictly handled in the nav button click handlers and UI updaters BEFORE currentSlideIndex changes.
    fabricCanvas.clear();

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
    if (selectedPreset === 'template-bold') bgColor = '#0d0d0d';
    if (selectedPreset === 'template-glass') bgColor = '#0a192f';
    if (selectedPreset === 'template-visual') bgColor = '#0f172a';
    if (selectedPreset === 'template-minimal') bgColor = '#121218';
    if (selectedPreset === 'template-bright-minimal') bgColor = '#f8f9fa';
    if (selectedPreset === 'template-news-image') bgColor = '#090d16';
    if (selectedPreset === 'template-news-text') bgColor = '#0b1120';
    if (selectedPreset === 'template-facts-single') bgColor = '#f8f9fa';
    if (selectedPreset === 'template-custom' && brand?.customBgColor) bgColor = brand.customBgColor;

    // Override with explicit brand background color if set to something other than the default dark blue
    if (brand?.bgColor && brand.bgColor.toLowerCase() !== '#0f0c29' && selectedPreset !== 'template-custom') {
        bgColor = brand.bgColor;
    }

    fabricCanvas.backgroundColor = bgColor;
    
    const showLogo = (document.getElementById('toggle-brand-logo-tb')?.checked ?? document.getElementById('toggle-brand-logo')?.checked) !== false;
    const showHandle = (document.getElementById('toggle-brand-handle-tb')?.checked ?? document.getElementById('toggle-brand-handle')?.checked) !== false;
    const showHeaderAsset = document.getElementById('toggle-brand-header-asset')?.checked !== false;
    const showPagination = (document.getElementById('toggle-slide-numbers-tb')?.checked ?? document.getElementById('toggle-slide-numbers')?.checked) !== false;
    const showSwipe = document.getElementById('toggle-swipe-indicator')?.checked !== false;
    const showNewsBreaking = document.getElementById('toggle-news-breaking')?.checked !== false;

    const addObjects = () => {
        // --- 1. Overlay Layer ---
        let overlayFill = 'rgba(0,0,0,0.65)';
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
        fabricCanvas.add(overlay);

        // --- 2. Header Bar / Top Strip ---
        const minimalPresets = ['template-minimal', 'template-bright-minimal', 'template-fb-minimal-1', 'template-fb-minimal-2'];
        if (!minimalPresets.includes(selectedPreset) && selectedPreset !== 'template-visual' && selectedPreset !== 'template-news-image' && selectedPreset !== 'template-news-text') {
            const headerBar = new fabric.Rect({
                left: 0, top: 0,
                width: CANVAS_W, height: 130,
                fill: selectedPreset === 'template-bold' ? '#141414' : 'rgba(0,0,0,0.4)',
                selectable: false, evented: false, customType: 'header-bar'
            });
            fabricCanvas.add(headerBar);
        }

        // --- 3. Brand Logo (Moveable, ON/OFF toggleable) ---
        if (showLogo && brand?.logoUrl) {
            fabric.Image.fromURL(brand.logoUrl, (img) => {
                if (img && img.width > 0) {
                    const targetSize = 56;
                    const scale = targetSize / (img.height || targetSize);
                    img.set({
                        left: 80,
                        top: (minimalPresets.includes(selectedPreset)) ? 42 : 36,
                        scaleX: scale,
                        scaleY: scale,
                        selectable: true,
                        evented: true,
                        customType: 'brand-logo',
                        isPlaceholder: 'brand-logo'
                    });
                    fabricCanvas.add(img);
                    fabricCanvas.bringToFront(img);
                    fabricCanvas.renderAll();
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
                fill: selectedPreset === 'template-bold' ? '#ffd700' : (selectedPreset === 'template-bright-minimal' ? '#111827' : '#ffffff'),
                fontFamily: headingFont,
                selectable: true,
                evented: true,
                customType: 'brand-handle'
            });
            if (slideData.brandHandleStyle) {
                brandText.set(slideData.brandHandleStyle);
            }
            fabricCanvas.add(brandText);
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
                    if (slideData.headerAssetStyle) {
                        const customStyle = { ...slideData.headerAssetStyle };
                        
                        // CRITICAL: Prevent cropped bounding boxes from being applied if they were saved previously
                        delete customStyle.width;
                        delete customStyle.height;
                        delete customStyle.cropX;
                        delete customStyle.cropY;

                        customStyle.originX = 'left';
                        customStyle.originY = 'center';
                        if (typeof customStyle.left !== 'number' || customStyle.left < 80 || customStyle.left > 600) {
                            customStyle.left = 80;
                        }
                        if (typeof customStyle.top !== 'number' || customStyle.top < 20 || customStyle.top > 115) {
                            customStyle.top = 67.5;
                        }
                        
                        // Prevent the image from blowing up and covering the whole slide from previous bad state
                        const maxAllowedScale = Math.min(450 / img.width, 100 / img.height);
                        
                        if (!customStyle.scaleX || customStyle.scaleX > maxAllowedScale) customStyle.scaleX = defaultScale;
                        if (!customStyle.scaleY || customStyle.scaleY > maxAllowedScale) customStyle.scaleY = defaultScale;
                        
                        img.set(customStyle);
                    }
                    fabricCanvas.add(img);
                    fabricCanvas.bringToFront(img);
                    fabricCanvas.renderAll();
                } else {
                    console.warn('[Header Asset] Image loaded but has no width, URL starts with:', assetUrl.substring(0, 40));
                }
            }, loadOpts);
        }

        // --- 6. Accent Line ---
        if (selectedPreset !== 'template-minimal' && selectedPreset !== 'template-fb-minimal-1' && selectedPreset !== 'template-fb-minimal-2') {
            const topAccent = new fabric.Rect({
                left: selectedPreset === 'template-bold' ? 90 : 80,
                top: selectedPreset === 'template-bright-minimal' ? 110 : 135,
                width: selectedPreset === 'template-bold' ? 260 : (selectedPreset === 'template-bright-minimal' ? CANVAS_W - 160 : 200),
                height: selectedPreset === 'template-bold' ? 8 : (selectedPreset === 'template-bright-minimal' ? 4 : 6),
                fill: selectedPreset === 'template-bold' ? '#ffd700' : (selectedPreset === 'template-bright-minimal' ? '#2563eb' : accentColor),
                selectable: false, evented: false, customType: 'top-accent'
            });
            fabricCanvas.add(topAccent);
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
            fabricCanvas.add(ctaLabel);

            const ctaTitleTop = ctaLabelTop + ctaLabel.getScaledHeight() + 30;
            const ctaTitleDef = {
                left: 80, top: ctaTitleTop, width: CANVAS_W - 160,
                fontSize: 84, fontWeight: '900', fill: '#ffffff',
                fontFamily: headingFont, textAlign: 'center', lineHeight: 1.15,
                selectable: true, isPlaceholder: 'title', customType: 'title'
            };
            const ctaTitle = new fabric.Textbox(slideData.title || 'Follow for More! 🔥', { ...ctaTitleDef, ...(slideData.titleStyle || {}) });
            fabricCanvas.add(ctaTitle);

            const ctaTitleHeight = ctaTitle.getScaledHeight();
            const ctaBodyTop = (slideData.titleStyle && slideData.titleStyle.top) ? slideData.titleStyle.top + ctaTitleHeight + 35 : ctaTitleTop + ctaTitleHeight + 35;

            const ctaBodyDef = {
                left: 80, top: ctaBodyTop, width: CANVAS_W - 160,
                fontSize: 44, fill: 'rgba(255,255,255,0.88)',
                fontFamily: bodyFont, textAlign: 'center', lineHeight: 1.5,
                selectable: true, isPlaceholder: 'body', customType: 'body'
            };
            const ctaBody = new fabric.Textbox(slideData.content || `Read the caption for the full breakdown ↓\n\nFollow ${handle} for daily prep & insights.`, { ...ctaBodyDef, ...(slideData.bodyStyle || {}) });
            fabricCanvas.add(ctaBody);

            const ctaBodyHeight = ctaBody.getScaledHeight();
            const ctaBtnTop = Math.max(ctaBodyTop + ctaBodyHeight + 45, 1050);

            const ctaBtnRect = new fabric.Rect({
                left: CANVAS_W / 2 - 220, top: ctaBtnTop,
                width: 440, height: 90, fill: accentColor,
                rx: 45, ry: 45,
                selectable: true, evented: true, customType: 'cta-btn-bg'
            });
            if (slideData.ctaBtnBgStyle) ctaBtnRect.set(slideData.ctaBtnBgStyle);
            fabricCanvas.add(ctaBtnRect);

            const ctaBtnText = new fabric.IText('FOLLOW NOW', {
                left: CANVAS_W / 2, top: ctaBtnTop + 25,
                fontSize: 34, fontWeight: '800', fill: '#000000',
                fontFamily: headingFont, textAlign: 'center', originX: 'center',
                selectable: true, evented: true, customType: 'cta-btn-text'
            });
            if (slideData.ctaBtnTextStyle) ctaBtnText.set(slideData.ctaBtnTextStyle);
            fabricCanvas.add(ctaBtnText);

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
                fabricCanvas.add(glassCard);

                const titleDef = {
                    left: 100, top: 230, width: CANVAS_W - 200,
                    fontSize: 80, fontWeight: '800', fill: '#ffffff',
                    fontFamily: headingFont, lineHeight: 1.15,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                fabricCanvas.add(slideTitle);

                const titleBottom = (slideData.titleStyle && slideData.titleStyle.top) ? slideData.titleStyle.top + slideTitle.getScaledHeight() + 35 : 230 + slideTitle.getScaledHeight() + 35;
                const bodyDef = {
                    left: 100, top: Math.max(titleBottom, 420), width: CANVAS_W - 200,
                    fontSize: 48, fill: '#f8fafc',
                    fontFamily: bodyFont, lineHeight: 1.55,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                fabricCanvas.add(slideBody);

            } else if (selectedPreset === 'template-bold') {
                // Bold Yellow Vertical Left Bar
                const verticalBar = new fabric.Rect({
                    left: 65, top: 210,
                    width: 14, height: 820,
                    fill: '#ffd700', rx: 7, ry: 7,
                    selectable: false, evented: false, customType: 'bold-vertical-bar'
                });
                fabricCanvas.add(verticalBar);

                const titleDef = {
                    left: 105, top: 210, width: CANVAS_W - 185,
                    fontSize: 92, fontWeight: '900', fill: '#ffd700',
                    fontFamily: headingFont, lineHeight: 1.1,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                fabricCanvas.add(slideTitle);

                const titleBottom = (slideData.titleStyle && slideData.titleStyle.top) ? slideData.titleStyle.top + slideTitle.getScaledHeight() + 35 : 210 + slideTitle.getScaledHeight() + 35;
                const bodyDef = {
                    left: 105, top: Math.max(titleBottom, 450), width: CANVAS_W - 185,
                    fontSize: 50, fontWeight: '600', fill: '#ffffff',
                    fontFamily: bodyFont, lineHeight: 1.5,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                fabricCanvas.add(slideBody);

            } else if (selectedPreset === 'template-visual') {
                // Bottom Solid Panel
                const bottomPanel = new fabric.Rect({
                    left: 0, top: 800,
                    width: CANVAS_W, height: 550,
                    fill: 'rgba(15, 23, 42, 0.94)',
                    stroke: accentColor, strokeWidth: 4,
                    selectable: false, evented: false, customType: 'bottom-panel'
                });
                fabricCanvas.add(bottomPanel);

                const titleDef = {
                    left: 80, top: 840, width: CANVAS_W - 160,
                    fontSize: 72, fontWeight: '800', fill: '#ffffff',
                    fontFamily: headingFont, lineHeight: 1.15,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                fabricCanvas.add(slideTitle);

                const titleBottom = (slideData.titleStyle && slideData.titleStyle.top) ? slideData.titleStyle.top + slideTitle.getScaledHeight() + 25 : 840 + slideTitle.getScaledHeight() + 25;
                const bodyDef = {
                    left: 80, top: Math.max(titleBottom, 960), width: CANVAS_W - 160,
                    fontSize: 44, fill: '#cbd5e1',
                    fontFamily: bodyFont, lineHeight: 1.5,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                fabricCanvas.add(slideBody);

            } else if (selectedPreset === 'template-minimal' || selectedPreset === 'template-bright-minimal') {
                const titleColor = selectedPreset === 'template-bright-minimal' ? '#111827' : '#ffffff';
                const bodyColor = selectedPreset === 'template-bright-minimal' ? '#4b5563' : '#cbd5e1';
                
                const titleDef = {
                    left: 80, top: 230, width: CANVAS_W - 160,
                    fontSize: 84, fontWeight: '700', fill: titleColor,
                    fontFamily: headingFont, lineHeight: 1.15,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                fabricCanvas.add(slideTitle);

                const titleBottom = (slideData.titleStyle && slideData.titleStyle.top) ? slideData.titleStyle.top + slideTitle.getScaledHeight() + 35 : 230 + slideTitle.getScaledHeight() + 35;
                const bodyDef = {
                    left: 80, top: Math.max(titleBottom, 460), width: CANVAS_W - 160,
                    fontSize: 48, fontWeight: '400', fill: bodyColor,
                    fontFamily: bodyFont, lineHeight: 1.55,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                fabricCanvas.add(slideBody);

            } else if (selectedPreset === 'template-fb-minimal-1') {
                const titleDef = {
                    left: 120, top: 320, width: CANVAS_W - 240,
                    fontSize: 88, fontWeight: '900', fill: '#ffffff', textAlign: 'center',
                    fontFamily: headingFont, lineHeight: 1.1,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                fabricCanvas.add(slideTitle);

                const titleBottom = (slideData.titleStyle && slideData.titleStyle.top) ? slideData.titleStyle.top + slideTitle.getScaledHeight() + 50 : 320 + slideTitle.getScaledHeight() + 50;
                const bodyDef = {
                    left: 120, top: Math.max(titleBottom, 580), width: CANVAS_W - 240,
                    fontSize: 52, fontWeight: '500', fill: '#f1f5f9', textAlign: 'center',
                    fontFamily: bodyFont, lineHeight: 1.45,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                fabricCanvas.add(slideBody);

            } else if (selectedPreset === 'template-fb-minimal-2') {
                const titleDef = {
                    left: 80, top: 320, width: CANVAS_W - 160,
                    fontSize: 92, fontWeight: '800', fill: '#ffffff',
                    fontFamily: headingFont, lineHeight: 1.12,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                fabricCanvas.add(slideTitle);

                const titleBottom = (slideData.titleStyle && slideData.titleStyle.top) ? slideData.titleStyle.top + slideTitle.getScaledHeight() + 40 : 320 + slideTitle.getScaledHeight() + 40;
                
                const cardTop = Math.max(titleBottom, 600);
                const fbCard = new fabric.Rect({
                    left: 0, top: cardTop,
                    width: CANVAS_W, height: CANVAS_H - cardTop,
                    fill: 'rgba(0, 0, 0, 0.4)',
                    selectable: false, evented: false, customType: 'fb-card-bg'
                });
                fabricCanvas.add(fbCard);

                const bodyDef = {
                    left: 80, top: cardTop + 60, width: CANVAS_W - 160,
                    fontSize: 48, fontWeight: '500', fill: '#f8fafc',
                    fontFamily: bodyFont, lineHeight: 1.5,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                fabricCanvas.add(slideBody);

            } else if (selectedPreset === 'template-facts-single') {
                const titleDef = {
                    left: 100, top: 200, width: CANVAS_W - 200,
                    fontSize: 76, fontWeight: '800', fill: '#0f172a', textAlign: 'center',
                    fontFamily: headingFont, lineHeight: 1.15,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                fabricCanvas.add(slideTitle);

                const bodyDef = {
                    left: 100, top: 940, width: CANVAS_W - 200,
                    fontSize: 46, fontWeight: '500', fill: '#334155', textAlign: 'center',
                    fontFamily: bodyFont, lineHeight: 1.45,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                fabricCanvas.add(slideBody);

            } else if (selectedPreset === 'template-news-image') {
                // --- Red Breaking News Badge ---
                let titleY = 180;
                if (showNewsBreaking) {
                    const badgeBg = new fabric.Rect({
                        left: 80, top: 160,
                        width: 250, height: 48,
                        fill: '#dc2626', rx: 24, ry: 24,
                        selectable: false, evented: false, customType: 'news-badge-bg'
                    });
                    fabricCanvas.add(badgeBg);

                    const badgeText = new fabric.IText('🔴 BREAKING NEWS', {
                        left: 98, top: 172,
                        fontSize: 22, fontWeight: '800', fill: '#ffffff',
                        fontFamily: headingFont, selectable: false, evented: false, customType: 'news-badge-text'
                    });
                    fabricCanvas.add(badgeText);
                    titleY = 230;
                }

                const titleDef = {
                    left: 80, top: titleY, width: CANVAS_W - 160,
                    fontSize: 84, fontWeight: '900', fill: '#ffffff',
                    fontFamily: headingFont, lineHeight: 1.12,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                fabricCanvas.add(slideTitle);

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
                fabricCanvas.add(newsCard);

                const bodyDef = {
                    left: 95, top: cardTop + 35, width: CANVAS_W - 190,
                    fontSize: 46, fontWeight: '500', fill: '#f1f5f9',
                    fontFamily: bodyFont, lineHeight: 1.5,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                fabricCanvas.add(slideBody);

            } else if (selectedPreset === 'template-news-text') {
                // --- Blue News Editorial Badge ---
                let titleY = 180;
                if (showNewsBreaking) {
                    const badgeBg = new fabric.Rect({
                        left: 80, top: 160,
                        width: 250, height: 48,
                        fill: '#0284c7', rx: 24, ry: 24,
                        selectable: false, evented: false, customType: 'news-text-badge-bg'
                    });
                    fabricCanvas.add(badgeBg);

                    const badgeText = new fabric.IText('📰 NEWS ANALYSIS', {
                        left: 98, top: 172,
                        fontSize: 22, fontWeight: '800', fill: '#ffffff',
                        fontFamily: headingFont, selectable: false, evented: false, customType: 'news-text-badge-text'
                    });
                    fabricCanvas.add(badgeText);
                    titleY = 230;
                }

                // Left Cyan Accent Strip
                const verticalBar = new fabric.Rect({
                    left: 65, top: titleY,
                    width: 12, height: 790 + (230 - titleY),
                    fill: '#38bdf8', rx: 6, ry: 6,
                    selectable: false, evented: false, customType: 'vertical-accent-bar'
                });
                fabricCanvas.add(verticalBar);

                const titleDef = {
                    left: 100, top: titleY, width: CANVAS_W - 180,
                    fontSize: 88, fontWeight: '900', fill: '#f8fafc',
                    fontFamily: headingFont, lineHeight: 1.12,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                fabricCanvas.add(slideTitle);

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
                fabricCanvas.add(newsCard);

                const bodyDef = {
                    left: 130, top: cardTop + 35, width: CANVAS_W - 240,
                    fontSize: 48, fontWeight: '500', fill: '#e2e8f0',
                    fontFamily: bodyFont, lineHeight: 1.55,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                fabricCanvas.add(slideBody);

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
                fabricCanvas.add(slideTitle);

                const bodyDef = {
                    left: 80, top: customContentY, width: CANVAS_W - 160,
                    fontSize: 52, fill: 'rgba(255,255,255,0.90)',
                    fontFamily: bodyFont, lineHeight: 1.55,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                fabricCanvas.add(slideBody);

            } else {
                // Default / Classic Template
                const titleDef = {
                    left: 80, top: 210, width: CANVAS_W - 160,
                    fontSize: 88, fontWeight: '900', fill: '#ffffff',
                    fontFamily: headingFont, lineHeight: 1.1,
                    selectable: true, isPlaceholder: 'title', customType: 'title'
                };
                const slideTitle = new fabric.Textbox(slideData.title || '', { ...titleDef, ...(slideData.titleStyle || {}) });
                fabricCanvas.add(slideTitle);

                const titleBottom = (slideData.titleStyle && slideData.titleStyle.top) ? slideData.titleStyle.top + slideTitle.getScaledHeight() + 40 : 210 + slideTitle.getScaledHeight() + 40;
                const bodyDef = {
                    left: 80, top: Math.max(titleBottom, 450), width: CANVAS_W - 160,
                    fontSize: 52, fill: 'rgba(255,255,255,0.90)',
                    fontFamily: bodyFont, lineHeight: 1.55,
                    selectable: true, isPlaceholder: 'body', customType: 'body'
                };
                const slideBody = new fabric.Textbox(slideData.content || '', { ...bodyDef, ...(slideData.bodyStyle || {}) });
                fabricCanvas.add(slideBody);
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
            fabricCanvas.add(slideNumBadge);
            fabricCanvas.add(slideNumText);

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
                fabricCanvas.add(swipeBg);
                fabricCanvas.add(swipeText);
            }
        }

        // --- 6. Footer Handle (Moveable, ON/OFF toggleable) ---
        if (showHandle) {
            const footerHandle = new fabric.IText(handle, {
                left: 80, top: CANVAS_H - 80,
                fontSize: 32, fontWeight: '600',
                fill: selectedPreset === 'template-bold' ? '#ffd700' : 'rgba(255,255,255,0.6)',
                fontFamily: bodyFont,
                selectable: true,
                evented: true,
                customType: 'footer-handle'
            });
            fabricCanvas.add(footerHandle);
        }

        fabricCanvas.renderAll();
        saveCanvasHistory();
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
                    fabricCanvas.add(img);
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
                    fabricCanvas.add(img);
                    fabricCanvas.sendToBack(img);
                }
            }
            addObjects();
        }, { crossOrigin: 'anonymous' });

    } else {
        addObjects();
    }
}

// Format controls wire-up
document.getElementById('fmt-font-size')?.addEventListener('change', (e) => {
    const obj = fabricCanvas?.getActiveObject();
    if (obj && obj.set) { obj.set('fontSize', parseInt(e.target.value)); fabricCanvas.renderAll(); }
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

    const hookEl = document.getElementById('caption-hook');
    const bodyEl = document.getElementById('caption-body');
    const ctaEl = document.getElementById('caption-cta');
    const nicheEl = document.getElementById('hashtags-niche');
    const broadEl = document.getElementById('hashtags-broad');
    const highIntentEl = document.getElementById('hashtags-high-intent');
    const fallbackEl = document.getElementById('caption-text-fallback');
    const structuredSections = ['caption-hook-section', 'caption-body-section', 'caption-cta-section', 'caption-hashtags-section'];

    if (typeof caption === 'object' && caption.hook) {
        // Structured caption
        structuredSections.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ''; });
        if (fallbackEl) fallbackEl.style.display = 'none';
        if (hookEl) hookEl.innerText = caption.hook || '';
        if (bodyEl) bodyEl.innerText = caption.body || '';
        if (ctaEl) ctaEl.innerText = caption.cta || '';

        const renderHashtags = (el, tags) => {
            if (!el || !tags) return;
            el.innerHTML = '';
            (Array.isArray(tags) ? tags : tags.split(' ')).forEach(tag => {
                const pill = document.createElement('span');
                pill.className = 'hashtag-pill';
                pill.textContent = tag;
                pill.addEventListener('click', () => navigator.clipboard.writeText(tag).catch(() => {}));
                el.appendChild(pill);
            });
        };

        const hashtags = caption.hashtags || {};
        renderHashtags(nicheEl, hashtags.niche || []);
        renderHashtags(broadEl, hashtags.broad || []);
        renderHashtags(highIntentEl, hashtags.high_intent || []);
    } else {
        // Plain text fallback (old posts)
        structuredSections.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
        if (fallbackEl) { fallbackEl.style.display = ''; fallbackEl.value = typeof caption === 'string' ? caption : JSON.stringify(caption); }
    }
}

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
    try {
        await navigator.clipboard.writeText(text);
        const btn = document.getElementById('copy-caption');
        btn.innerHTML = '<i data-feather="check"></i> Copied!';
        if (window.feather) feather.replace();
        setTimeout(() => { btn.innerHTML = '<i data-feather="copy"></i> Copy Full Caption'; feather.replace(); }, 2000);
    } catch { alert('Caption copied!'); }
});

// ============================================================
// 3b. EDITOR — Open & Render
// ============================================================
window.openEditor = async (id) => {
    console.log("openEditor:", id);
    const posts = await getPosts();
    const post = posts.find(p => p.id === id);
    if (!post) { console.error("Post not found:", id); return; }

    currentEditingId = id;

    // Switch to editor view
    navLinks.forEach(l => l.classList.remove('active'));
    views.forEach(v => v.classList.remove('active-view'));
    document.getElementById('editor-view').classList.add('active-view');
    const h1 = document.querySelector('.topbar h1');
    if (h1) h1.textContent = 'Editor';

    // Parse content first to check for brand_snapshot
    const parsed = parsePostText(post.text);
    currentSlides = parsed.slides || [];
    const caption = parsed.caption || '';
    currentImageUrls = parseImageUrls(post.image_url);

    // Set brand
    if (post.brand_id) {
        let postBrand = parsed.brand_snapshot || allBrands.find(b => b.id === post.brand_id);
        if (postBrand) { 
            currentBranding = postBrand; 
            updateBrandVisuals(currentBranding); 
        }
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
    if (templateSel) templateSel.value = currentBranding.themePreset || 'template-classic';

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

function renderSlidesForm() {
    const container = document.getElementById('slides-form-container');
    container.innerHTML = '';
    currentSlides.forEach((slide, index) => {
        const isCTA = slide.is_cta === true || index === currentSlides.length - 1;
        const div = document.createElement('div');
        div.style.cssText = `margin-bottom:12px;padding:14px;border:1px solid ${index===currentSlideIndex?'#0969da':'#d0d7de'};border-radius:8px;background:${index===currentSlideIndex?'#f0f6ff':'#fff'};cursor:pointer;`;
        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <h4 style="font-size:13px;font-weight:700;color:#656d76;">Slide ${index + 1}${isCTA?'<span style="font-size:10px;background:#10b981;color:#fff;padding:1px 7px;border-radius:20px;margin-left:8px;font-weight:600;">CTA</span>':''}</h4>
                <div>
                    <button onclick="window.jumpToSlide(${index})" style="background:none;border:none;cursor:pointer;color:#0969da;font-size:12px;font-weight:600;">▶ Preview</button>
                    <button onclick="window.downloadSingleSlide(${index})" style="background:none;border:none;cursor:pointer;color:#10b981;font-size:12px;font-weight:600;margin-left:8px;" title="Download PNG for this slide">📥 PNG</button>
                </div>
            </div>
            <input type="text" id="slide-title-${index}" class="full-width" style="margin-bottom:8px;padding:5px 10px;border:1px solid #d0d7de;border-radius:5px;font-size:13px;" value="${(slide.title||'').replace(/"/g, '&quot;')}" oninput="window.updateSlideData(${index},'title',this.value)">
            <textarea id="slide-content-${index}" class="rich-textarea" style="min-height:80px;font-size:13px;" oninput="window.updateSlideData(${index},'content',this.value)">${slide.content||''}</textarea>
        `;
        div.addEventListener('click', (e) => { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') window.jumpToSlide(index); });
        container.appendChild(div);
    });
}

window.jumpToSlide = (index) => {
    syncFabricCanvasToCurrentSlide();
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
document.getElementById('prev-slide').addEventListener('click', () => {
    if (currentSlideIndex > 0) {
        syncFabricCanvasToCurrentSlide();
        currentSlideIndex--;
        renderSlidesForm();
        updateSlidePreview();
        updateSidebarImagePreview(currentSlideIndex);
        updateCTABadge();
    }
});
document.getElementById('next-slide').addEventListener('click', () => {
    if (currentSlideIndex < currentSlides.length - 1) {
        syncFabricCanvasToCurrentSlide();
        currentSlideIndex++;
        renderSlidesForm();
        updateSlidePreview();
        updateSidebarImagePreview(currentSlideIndex);
        updateCTABadge();
    }
});

document.getElementById('toggle-brand-logo')?.addEventListener('change', () => updateSlidePreview());
document.getElementById('toggle-brand-handle')?.addEventListener('change', () => updateSlidePreview());
document.getElementById('toggle-brand-header-asset')?.addEventListener('change', () => updateSlidePreview());
document.getElementById('toggle-slide-numbers')?.addEventListener('change', () => updateSlidePreview());
document.getElementById('toggle-swipe-indicator')?.addEventListener('change', () => updateSlidePreview());
document.getElementById('toggle-news-breaking')?.addEventListener('change', () => updateSlidePreview());

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

document.getElementById('back-to-queue').addEventListener('click', () => {
    document.querySelector('[data-target="queue-view"]')?.click();
});

// ============================================================
// 3c. IMAGE UPLOAD (per-slide)
// ============================================================
document.getElementById('image-upload').addEventListener('change', function(e) {
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

document.getElementById('download-slides').addEventListener('click', downloadSlidesAsFabric);

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
document.getElementById('save-post').addEventListener('click', async () => {
    syncFabricCanvasToCurrentSlide();
    const updatedStatus = document.getElementById('editor-status').value;
    const updatedText = JSON.stringify({ slides: currentSlides, caption: getCaptionText() });
    const updatedImageUrl = JSON.stringify(currentImageUrls);

    if (isMockMode) {
        const i = mockPosts.findIndex(p => p.id === currentEditingId);
        if (i > -1) { mockPosts[i].text = updatedText; mockPosts[i].status = updatedStatus; mockPosts[i].image_url = updatedImageUrl; mockPosts[i].updated_at = new Date().toISOString(); saveMockPosts(); }
        showToast('Saved successfully (Mock)');
        document.querySelector('[data-target="queue-view"]')?.click();
        return;
    }
    const { error } = await supabase.from('posts').update({ text: updatedText, status: updatedStatus, image_url: updatedImageUrl }).eq('id', currentEditingId);
    if (error) showToast('Error saving: ' + error.message, 'error');
    else { showToast('Saved successfully!'); document.querySelector('[data-target="queue-view"]')?.click(); }
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

document.getElementById('publish-facebook').addEventListener('click', () => executePublish(currentBranding.facebookUrl));
document.getElementById('publish-instagram').addEventListener('click', () => executePublish(currentBranding.instagramUrl));
document.getElementById('publish-tiktok').addEventListener('click', () => executePublish(currentBranding.tiktokUrl));
document.getElementById('publish-linkedin').addEventListener('click', () => executePublish(currentBranding.linkedinUrl));

// ============================================================
// 3g. REFINE
// ============================================================
document.getElementById('refine-post').addEventListener('click', async () => {
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
document.getElementById('trigger-manual').addEventListener('click', async () => {
    const topic = document.getElementById('manual-topic').value.trim();
    const contentType = document.getElementById('manual-content-type').value;
    const brandId = document.getElementById('manual-brand').value;
    const feedback = document.getElementById('manual-feedback');
    if (!topic) { feedback.innerText = "Please enter a topic."; feedback.style.color = "var(--color-danger-fg)"; return; }

    const btn = document.getElementById('trigger-manual');
    const overlay = document.getElementById('manual-loading-overlay');
    btn.style.display = 'none';
    feedback.style.display = 'none';
    overlay.style.display = 'block';

    try {
        const activeBrand = allBrands.find(b => b.id === brandId) || currentBranding;
        const response = await fetch(CONFIG.N8N_MANUAL_WEBHOOK_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, contentType, brand_id: brandId, promptTemplate: currentPromptTemplate, brand_context: getBrandContext(activeBrand), brand_snapshot: activeBrand })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unknown error");
        if (data.db_error && !isMockMode) { isMockMode = true; alert(`DB Error: ${data.db_error}\n\nUsing local storage.`); }
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
        btn.style.display = 'block';
        overlay.style.display = 'none';
    } finally {
        btn.style.display = 'block';
        overlay.style.display = 'none';
    }
});

// Topic suggestions
const suggestedTopics = ["Geography of Nepal - Major Rivers", "History - The Unification of Nepal", "Constitution - Fundamental Rights", "Current Affairs - Nepal's Economic Policy 2080", "Science - Human Digestive System", "General Knowledge - First in Nepal", "Literature - Bhanubhakta Acharya", "Ecology - National Parks", "Administration - Local Government Structure", "International Relations - Nepal and the UN"];
function suggestRandomTopic() { const input = document.getElementById('manual-topic'); if (input) input.value = suggestedTopics[Math.floor(Math.random() * suggestedTopics.length)]; }
document.getElementById('refresh-topic-btn').addEventListener('click', suggestRandomTopic);

// ============================================================
// 5. NEWS LAB
// ============================================================
document.getElementById('trigger-news').addEventListener('click', async () => {
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
        const response = await fetch(CONFIG.N8N_MANUAL_WEBHOOK_URL.replace('/generate', '/generate-news'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, category, slide_count: slideCount, brand_id: brandId, language, contentType, brand_context: getBrandContext(activeBrand), brand_snapshot: activeBrand })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "News generation failed");
        if (data.db_error && !isMockMode) { isMockMode = true; }
        const newPost = data.post || { id: Date.now().toString(), topic: `[News Lab] Generated`, text: data.text, image_url: data.image_url, status: 'Draft', brand_id: brandId, updated_at: new Date().toISOString() };
        if (isMockMode && !mockPosts.find(p => p.id === newPost.id)) { mockPosts.unshift(newPost); saveMockPosts(); }
        await loadQueue();
        window.openEditor(data.post?.id || newPost.id);
    } catch (err) {
        feedback.innerText = "Error: " + err.message; feedback.style.color = "var(--color-danger-fg)"; feedback.style.display = 'block';
    } finally { btn.style.display = 'block'; overlay.style.display = 'none'; }
});

// ============================================================
// 6. FACTS LAB
// ============================================================
document.querySelectorAll('.fact-niche-preset').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('facts-topic').value = btn.getAttribute('data-niche'); });
});

document.getElementById('trigger-facts-single')?.addEventListener('click', async () => {
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
        const response = await fetch(CONFIG.N8N_MANUAL_WEBHOOK_URL.replace('/generate', '/generate-facts'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            // Using slide_count 1 and a hint for single slide fact
            body: JSON.stringify({ topic, language, slide_count: 1, brand_id: brandId, brand_context: getBrandContext(activeBrand), brand_snapshot: activeBrand })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Facts generation failed");
        if (data.db_error && !isMockMode) { isMockMode = true; alert(`DB Error: ${data.db_error}`); }
        
        const newPost = data.post || { id: Date.now().toString(), topic: `[Single Fact] ${topic.substring(0, 50)}`, text: data.text, image_url: data.image_url, status: 'Draft', brand_id: brandId, updated_at: new Date().toISOString() };
        if (isMockMode && !mockPosts.find(p => p.id === newPost.id)) { mockPosts.unshift(newPost); saveMockPosts(); }
        
        ['queue-brand-filter', 'status-filter'].forEach(id => { const el = document.getElementById(id); if (el) el.value = el.id === 'queue-brand-filter' ? 'All' : 'All'; });
        await loadQueue();
        
        const ts = document.getElementById('template-selector');
        if (ts) {
            ts.value = 'template-facts-single';
            // Also update the legacy one if it exists
            const tsOld = document.getElementById('template-selector-old');
            if (tsOld) tsOld.value = 'template-facts-single';
        }
        window.openEditor(data.post?.id || newPost.id);
    } catch (err) {
        feedback.innerText = "Error: " + err.message; feedback.style.color = "var(--color-danger-fg)"; feedback.style.display = 'block';
    } finally { 
        btnSingle.style.display = 'block'; btnCarousel.style.display = 'block'; overlay.style.display = 'none'; 
    }
});

document.getElementById('trigger-facts')?.addEventListener('click', async () => {
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
        const response = await fetch(CONFIG.N8N_MANUAL_WEBHOOK_URL.replace('/generate', '/generate-facts'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, language, slide_count: slideCount, brand_id: brandId, brand_context: getBrandContext(activeBrand), brand_snapshot: activeBrand })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Facts generation failed");
        if (data.db_error && !isMockMode) { isMockMode = true; alert(`DB Error: ${data.db_error}`); }
        const newPost = data.post || { id: Date.now().toString(), topic: `[Facts Lab] ${topic.substring(0, 50)}`, text: data.text, image_url: data.image_url, status: 'Draft', brand_id: brandId, updated_at: new Date().toISOString() };
        if (isMockMode && !mockPosts.find(p => p.id === newPost.id)) { mockPosts.unshift(newPost); saveMockPosts(); }
        ['queue-brand-filter', 'status-filter'].forEach(id => { const el = document.getElementById(id); if (el) el.value = el.id === 'queue-brand-filter' ? 'All' : 'All'; });
        await loadQueue();
        window.openEditor(data.post?.id || newPost.id);
    } catch (err) {
        feedback.innerText = "Error: " + err.message; feedback.style.color = "var(--color-danger-fg)"; feedback.style.display = 'block';
    } finally { btnCarousel.style.display = 'block'; btnSingle.style.display = 'block'; overlay.style.display = 'none'; }
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
    if (!studioCanvas) return;
    const name = document.getElementById('studio-template-name').value.trim();
    if (!name) { showToast('Please enter a template name.', 'error'); return; }
    const templates = JSON.parse(localStorage.getItem('cd_templates') || '[]');
    const existing = templates.findIndex(t => t.name === name);
    const templateData = { name, canvasJson: studioCanvas.toJSON(['isPlaceholder', 'customType']), createdAt: new Date().toISOString() };
    if (existing > -1) templates[existing] = templateData;
    else templates.push(templateData);
    localStorage.setItem('cd_templates', JSON.stringify(templates));
    loadStudioSavedList();
    loadSavedTemplatesSelector();
    showToast(`Template "${name}" saved!`);
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
document.getElementById('brand-logo-upload').addEventListener('change', function(e) {
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
document.getElementById('save-branding').addEventListener('click', async function() {
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
    const showPagination = document.getElementById('custom-show-pagination')?.checked !== false;

    const templateSettings = { customTitleSize, customTitleY, customContentY, customBgOpacity, customBgColor, themePreset, showPagination, headerAssetUrl, accentColor, bgColor, headingFont, bodyFont, narrative, toneOfVoice, icp };
    const socialLinks = { facebookUrl, instagramUrl, tiktokUrl, linkedinUrl };

    const updatedBrandFields = { name, handle, logoUrl, headerAssetUrl, facebookUrl, instagramUrl, tiktokUrl, linkedinUrl, primaryColor, secondaryColor, accentColor, bgColor, narrative, toneOfVoice, icp, headingFont, bodyFont, customTitleSize, customTitleY, customContentY, customBgOpacity, customBgColor, themePreset, showPagination };

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

    // Save prompt template
    const promptInput = document.getElementById('prompt-template-input');
    if (promptInput) {
        currentPromptTemplate = promptInput.value || DEFAULT_PROMPT_TEMPLATE;
        localStorage.setItem(`loksewa_prompt_template_${activeBrandId}`, currentPromptTemplate);
    }

    updateBrandVisuals(currentBranding);
    populateBrandSelectors();
    const fb = document.getElementById('branding-feedback');
    fb.innerText = "Brand Identity saved successfully!";
    fb.style.color = "var(--color-success-fg)";
    setTimeout(() => { fb.innerText = ''; }, 3000);
});

document.getElementById('brand-selector').addEventListener('change', (e) => {
    const bId = e.target.value;
    if (!bId) return;
    activeBrandId = bId;
    currentBranding = allBrands.find(br => br.id === activeBrandId) || currentBranding;
    currentPromptTemplate = localStorage.getItem(`loksewa_prompt_template_${activeBrandId}`) || DEFAULT_PROMPT_TEMPLATE;
    loadBrandingForm(currentBranding);
    updateBrandVisuals(currentBranding);
});

document.getElementById('create-brand-btn').addEventListener('click', () => {
    const newBrand = { id: 'new-' + Date.now(), name: "New Brand", handle: "@newbrand", logoUrl: "assets/images/logo.png", primaryColor: "#000000", secondaryColor: "#666666", accentColor: '#f59e0b', bgColor: '#0f0c29', headingFont: 'Inter', bodyFont: 'Inter', narrative: '', toneOfVoice: 'Educational & Authoritative', icp: '', customTitleSize: "100", customTitleY: "50", customContentY: "70", customBgOpacity: "85", customBgColor: "#000000", themePreset: "theme-default", showPagination: true };
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
    
    currentPromptTemplate = localStorage.getItem(`loksewa_prompt_template_${brand.id}`) || localStorage.getItem('loksewa_prompt_template') || DEFAULT_PROMPT_TEMPLATE;
    const promptInput = document.getElementById('prompt-template-input');
    if (promptInput) promptInput.value = currentPromptTemplate;
}

document.getElementById('reset-prompt-btn').addEventListener('click', () => {
    if (!confirm("Reset to default prompt?")) return;
    currentPromptTemplate = DEFAULT_PROMPT_TEMPLATE;
    document.getElementById('prompt-template-input').value = currentPromptTemplate;
    localStorage.setItem(`loksewa_prompt_template_${activeBrandId}`, currentPromptTemplate);
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
    views.forEach(v => v.classList.remove('active-view'));
    document.getElementById('video-editor-view').classList.add('active-view');
};

document.getElementById('back-to-video-queue').addEventListener('click', () => document.querySelector('[data-target="video-view"]')?.click());
document.getElementById('video-format').addEventListener('change', (e) => { document.getElementById('video-splits-group').style.display = e.target.value === 'multiple' ? 'block' : 'none'; });

document.getElementById('generate-video-btn').addEventListener('click', async () => {
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

document.getElementById('copy-video-prompts').addEventListener('click', () => {
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

document.getElementById('save-profile-btn').addEventListener('click', async () => {
    if (isMockMode) { alert('Cannot update profile in mock mode'); return; }
    const displayName = document.getElementById('setting-display-name').value;
    const phone = document.getElementById('setting-phone').value;
    const fb = document.getElementById('profile-feedback');
    fb.innerText = 'Saving...'; fb.style.color = 'var(--color-fg-muted)';
    const { error } = await supabase.auth.updateUser({ data: { display_name: displayName, phone } });
    if (error) { fb.innerText = error.message; fb.style.color = 'var(--color-danger-fg)'; }
    else { fb.innerText = 'Profile updated!'; fb.style.color = 'var(--color-success-fg)'; if (displayName) document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${displayName.substring(0, 2)}&background=random`; }
});

document.getElementById('update-password-btn').addEventListener('click', async () => {
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
document.getElementById('enroll-mfa-btn').addEventListener('click', async () => {
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

document.getElementById('verify-mfa-btn').addEventListener('click', async () => {
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
document.getElementById('mobile-menu-btn').addEventListener('click', () => {
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
document.getElementById('generate-custom-image-btn')?.addEventListener('click', () => {
    const promptEl = document.getElementById('custom-ai-image-prompt');
    const promptText = promptEl.value.trim();
    if (!promptText) {
        showToast('Please enter an image prompt', 'error');
        return;
    }
    
    showToast('Generating AI Image...', 'info');
    const seed = Math.floor(Math.random() * 100000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?seed=${seed}&nologo=true&width=1080&height=1350`;
    
    // Simulate slight delay then apply
    setTimeout(() => {
        currentImageUrls[currentSlideIndex] = imageUrl;
        document.getElementById('editor-image').src = imageUrl;
        updateSlidePreview();
        showToast('AI Image applied to slide!');
    }, 1000);
});
