import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from './config.js';

const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;

let supabase = null;
let isMockMode = false;

if (SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.warn("Supabase credentials not set. Running in MOCK mode.");
    isMockMode = true;
}

// --- Auth State & Logic ---
let currentUser = null;

if (!isMockMode) {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
        handleAuthChange(session);
    });

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
        handleAuthChange(session);
    });
} else {
    // In mock mode, bypass auth visually
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
}

function handleAuthChange(session) {
    if (session) {
        currentUser = session.user;
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        
            // Extract initials from email
        let nameParam = "AD";
        if (currentUser && currentUser.email) {
            const emailParts = currentUser.email.split('@')[0];
            nameParam = emailParts.substring(0, 2).toUpperCase();
            
            // Only update the topbar avatar, don't overwrite form inputs here
            if (currentUser.user_metadata && currentUser.user_metadata.display_name) {
                nameParam = currentUser.user_metadata.display_name.substring(0, 2).toUpperCase();
            }
            document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${nameParam}&background=random`;
            
            // Check MFA Status
            if(!isMockMode) {
                supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
                    if (data && (data.currentLevel === 'aal2' || data.nextLevel === 'aal2')) {
                        document.getElementById('mfa-status-text').innerText = 'Enabled';
                        document.getElementById('mfa-status-text').style.color = 'var(--success)';
                        document.getElementById('enroll-mfa-btn').style.display = 'none';
                    }
                });
            }
        }
        document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${nameParam}&background=random`;
        
        fetchBrands();
        loadDashboardStats();
    } else {
        currentUser = null;
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }
}

document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const feedback = document.getElementById('login-feedback');
    
    if (isMockMode) {
        if (email && password) {
            feedback.innerText = "Success (Mock Mode)!";
            feedback.style.color = "var(--success)";
            setTimeout(() => {
                document.getElementById('login-container').style.display = 'none';
                document.getElementById('app-container').style.display = 'flex';
                
                const emailParts = email.split('@')[0];
                const nameParam = emailParts.substring(0, 2).toUpperCase();
                document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${nameParam}&background=random`;
                
                fetchBrands();
                loadDashboardStats();
            }, 500);
        } else {
            feedback.innerText = "Please enter any email/password.";
            feedback.style.color = "var(--danger)";
        }
        return;
    }
    
    feedback.innerText = "Authenticating...";
    feedback.style.color = "var(--text-main)";
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
        feedback.innerText = error.message;
        feedback.style.color = "var(--danger)";
    } else {
        feedback.innerText = "Success!";
        feedback.style.color = "var(--success)";
    }
});

document.getElementById('logout-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    if (isMockMode) {
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        document.getElementById('login-feedback').innerText = '';
    } else {
        await supabase.auth.signOut();
    }
});

// --- Intelligence State ---
const DEFAULT_PROMPT_TEMPLATE = `You are an expert Loksewa (Public Service Commission Nepal) content creator.
Generate content based on the following parameters:
Topic: \${topic}
Content Type: \${contentType}

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

let currentPromptTemplate = localStorage.getItem('loksewa_prompt_template') || DEFAULT_PROMPT_TEMPLATE;


// --- Mock Data Persistence ---
let defaultMockPosts = [
    { id: '1', topic: 'Geography of Nepal', text: '{"slides":[{"title":"Geography of Nepal","content":"Nepal is a landlocked country in South Asia."},{"title":"Himalayas","content":"Home to 8 of the 10 highest peaks in the world, including Mt. Everest."}],"caption":"Learn about the geography of Nepal! #Loksewa #Nepal"}', image_url: 'assets/images/geography_nepal.png', status: 'Draft', updated_at: new Date().toISOString() },
    { id: '2', topic: 'History - Rana Regime', text: '{"slides":[{"title":"Rana Regime","content":"The Rana dynasty ruled the Kingdom of Nepal from 1846 until 1951."}],"caption":"History of Nepal #History"}', image_url: 'assets/images/history_nepal.png', status: 'Approved', updated_at: new Date().toISOString() },
    { id: '3', topic: 'Constitution of Nepal', text: '{"slides":[{"title":"Constitution of Nepal","content":"The present constitution was promulgated on 20 September 2015."}],"caption":"Constitution facts #Loksewa"}', image_url: 'assets/images/constitution_nepal.png', status: 'Published', updated_at: new Date().toISOString() },
    { id: '4', topic: 'Economic Policies', text: '{"slides":[{"title":"Economic Policies","content":"Failed to generate content."}]}', image_url: '', status: 'Failed', updated_at: new Date().toISOString() }
];

let mockPosts = JSON.parse(localStorage.getItem('loksewa_mock_posts')) || defaultMockPosts;

function saveMockPosts() {
    if(isMockMode) {
        localStorage.setItem('loksewa_mock_posts', JSON.stringify(mockPosts));
    }
}

let mockSettings = [
    { key: 'ai_temperature', value: '0.7', description: 'Temperature for Gemini API' },
    { key: 'prompt_template', value: 'Generate a gamified post...', description: 'Main prompt' }
];


// --- Branding State ---
let allBrands = JSON.parse(localStorage.getItem('loksewa_all_brands')) || [
    {
        id: "default-brand",
        name: "CREATOR'S DEN",
        handle: "@CreatorsDen",
        logoUrl: "assets/images/logo.png",
        facebookUrl: "https://business.facebook.com",
        instagramUrl: "https://instagram.com",
        tiktokUrl: "https://tiktok.com",
        linkedinUrl: "https://linkedin.com",
        primaryColor: "#1e3c72",
        secondaryColor: "#2a5298",
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
let currentBranding = allBrands[0]; // Active brand for the UI

async function fetchBrands() {
    if (!isMockMode) {
        const { data, error } = await supabase.from('brands').select('*').order('created_at', { ascending: true });
        if (!error && data && data.length > 0) {
            // Map db fields to our local fields
            allBrands = data.map(dbBrand => ({
                id: dbBrand.id,
                name: dbBrand.name,
                handle: dbBrand.handle,
                primaryColor: dbBrand.primary_color,
                secondaryColor: dbBrand.secondary_color,
                logoUrl: dbBrand.logo_url,
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
            
            // Try to keep the same active brand or fallback to first
            if (!allBrands.find(b => b.id === activeBrandId)) {
                activeBrandId = allBrands[0].id;
            }
            currentBranding = allBrands.find(b => b.id === activeBrandId) || allBrands[0];
        }
    }
    populateBrandSelectors();
    updateBrandVisuals(currentBranding);
}

function populateBrandSelectors() {
    const selectors = [
        document.getElementById('brand-selector'),
        document.getElementById('manual-brand'),
        document.getElementById('queue-brand-filter')
    ];
    
    selectors.forEach(sel => {
        if (!sel) return;
        const currentVal = sel.value;
        sel.innerHTML = '';
        if (sel.id === 'queue-brand-filter') {
            const opt = document.createElement('option');
            opt.value = 'All';
            opt.innerText = 'All Brands';
            sel.appendChild(opt);
        }
        allBrands.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.innerText = b.name;
            sel.appendChild(opt);
        });
        
        if (sel.id === 'brand-selector') {
            sel.value = activeBrandId;
        } else if (sel.id === 'manual-brand') {
            sel.value = activeBrandId; // default to active brand
        } else if (currentVal) {
            sel.value = currentVal;
        }
    });
}


function updateBrandVisuals(brand = currentBranding) {
    if (!brand) return;
    const nameEl = document.getElementById('slide-brand-name');
    const handleEl = document.getElementById('slide-brand-handle');
    const logoEl = document.getElementById('slide-brand-logo');
    const sidebarNameEl = document.getElementById('sidebar-brand-name');
    const sidebarLogoEl = document.getElementById('sidebar-brand-logo');
    
    if(nameEl) nameEl.innerText = brand.name || '';
    if(handleEl) handleEl.innerText = brand.handle || '';
    if(logoEl) logoEl.src = brand.logoUrl || '';
    
    if(sidebarNameEl) sidebarNameEl.innerText = brand.name || '';
    if(sidebarLogoEl) sidebarLogoEl.src = brand.logoUrl || '';
    
    // Apply CSS Variables for dynamic template coloring
    if (brand.primaryColor) {
        document.documentElement.style.setProperty('--brand-primary', brand.primaryColor);
    }
    if (brand.secondaryColor) {
        document.documentElement.style.setProperty('--brand-secondary', brand.secondaryColor);
    }
    
    // Apply CSS Variables for custom template builder
    if (brand.customTitleSize) document.documentElement.style.setProperty('--custom-title-size', (brand.customTitleSize * 0.72) + 'px');
    if (brand.customTitleY) document.documentElement.style.setProperty('--custom-title-y', -((100 - brand.customTitleY) * 3) + 'px');
    if (brand.customContentY) document.documentElement.style.setProperty('--custom-content-y', brand.customContentY + '%');
    
    // Convert hex to rgba for overlay
    if (brand.customBgColor && brand.customBgOpacity) {
        const hex = brand.customBgColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.substring(4, 6), 16) || 0;
        const a = brand.customBgOpacity / 100;
        document.documentElement.style.setProperty('--custom-bg-color', `rgba(${r}, ${g}, ${b}, ${a})`);
    }

    // Apply Theme Class
    const slideTarget = document.getElementById('slide-render-target');
    if (slideTarget) {
        slideTarget.className = 'slide-card ' + (brand.themePreset || 'theme-default');
    }
}

// --- Navigation Logic ---
const navLinks = document.querySelectorAll('.nav-links a');
const views = document.querySelectorAll('.view');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Remove active class from all links and views
        navLinks.forEach(l => l.classList.remove('active'));
        views.forEach(v => v.classList.remove('active-view'));
        
        // Add active class to clicked link and corresponding view
        link.classList.add('active');
        const targetViewId = link.getAttribute('data-target');
        document.getElementById(targetViewId).classList.add('active-view');
        
        // Trigger specific logic based on view
        if(targetViewId === 'home-view') loadDashboardStats();
        if(targetViewId === 'queue-view') loadQueue();
        if(targetViewId === 'video-view') loadVideoQueue();
        if(targetViewId === 'settings-view') loadSettings();
        if(targetViewId === 'branding-view') loadBrandingView();
    });
});

// --- Data Fetching & Rendering ---

async function getPosts() {
    if (isMockMode) return mockPosts;
    const { data, error } = await supabase.from('posts').select('*').order('updated_at', { ascending: false });
    if (error) {
        console.error("Database error fetching posts:", error.message);
        console.warn("Falling back to local storage (Mock Mode) due to database error.");
        isMockMode = true;
        // Also ensure UI reflects we are bypassing auth visually just in case
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        return mockPosts;
    }
    return data;
}

function formatDate(isoString) {
    return new Date(isoString).toLocaleString();
}

// 1. Dashboard View
async function loadDashboardStats() {
    const posts = await getPosts();
    
    // Stats
    const drafts = posts.filter(p => p.status === 'Draft').length;
    const approved = posts.filter(p => p.status === 'Approved').length;
    const published = posts.filter(p => p.status === 'Published').length;
    const failed = posts.filter(p => p.status === 'Failed').length;
    
    document.getElementById('stat-drafts').innerText = drafts;
    document.getElementById('stat-approved').innerText = approved;
    document.getElementById('stat-published').innerText = published;
    document.getElementById('stat-failed').innerText = failed;
    
    // Recent Table (last 5)
    const tbody = document.getElementById('recent-activity-table');
    tbody.innerHTML = '';
    
    posts.slice(0, 5).forEach(post => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${post.topic}</strong></td>
            <td><span class="status-badge status-${post.status}">${post.status}</span></td>
            <td>${formatDate(post.updated_at)}</td>
            <td>
                <button class="btn-secondary" onclick="window.openEditor('${post.id}')" style="padding: 6px 12px; font-size: 0.8rem;">View</button>
                <button class="btn-secondary" onclick="window.deletePost('${post.id}')" style="padding: 6px 12px; font-size: 0.8rem; color: var(--danger);"><i data-feather="trash-2" style="width: 14px; height: 14px;"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    if (window.feather) feather.replace();
}

// 2. Queue View
async function loadQueue() {
    const posts = await getPosts();
    const grid = document.getElementById('queue-grid');
    const filter = document.getElementById('status-filter').value;
    
    grid.innerHTML = '';
    
    let filteredPosts = posts;
    if (filter !== 'All') {
        filteredPosts = posts.filter(p => p.status === filter);
    }
    
    const brandFilter = document.getElementById('queue-brand-filter') ? document.getElementById('queue-brand-filter').value : 'All';
    if (brandFilter !== 'All') {
        filteredPosts = filteredPosts.filter(p => p.brand_id === brandFilter);
    }
    
    filteredPosts.forEach(post => {
        const postBrand = allBrands.find(b => b.id === post.brand_id);
        const bName = postBrand ? postBrand.name : "Creator's Den";
        const card = document.createElement('div');
        card.className = 'content-card';
        card.innerHTML = `
            <div class="content-card-img" style="background-image: url('${post.image_url || 'https://via.placeholder.com/400x200?text=No+Image'}')"></div>
            <div class="content-card-body">
                <div class="content-card-title">${post.topic} <span class="badge" style="background:#e1e4e8; color:#24292e; font-size:11px; padding:2px 6px; border-radius:10px;">${bName}</span></div>
                <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom: 16px;">
                    ${post.text.substring(0, 80)}...
                </p>
                <div class="content-card-meta">
                    <select class="status-badge status-${post.status}" onchange="window.updatePostStatus('${post.id}', this.value)" style="border:none; cursor:pointer; font-weight:600; appearance: none; padding-right: 20px; background-image: url('data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpolyline points=%226 9 12 15 18 9%22%3E%3C/polyline%3E%3C/svg%3E'); background-repeat: no-repeat; background-position: right 6px center; background-size: 12px;">
                        <option value="Draft" ${post.status === 'Draft' ? 'selected' : ''}>Draft</option>
                        <option value="Approved" ${post.status === 'Approved' ? 'selected' : ''}>Approved</option>
                        <option value="Published" ${post.status === 'Published' ? 'selected' : ''}>Published</option>
                        <option value="Failed" ${post.status === 'Failed' ? 'selected' : ''}>Failed</option>
                    </select>
                    <div>
                        <button class="btn-primary" onclick="window.openEditor('${post.id}')" style="padding: 8px 16px; font-size: 0.85rem;">Edit</button>
                        <button class="btn-secondary" onclick="window.deletePost('${post.id}')" style="padding: 8px 16px; font-size: 0.85rem; color: var(--danger);"><i data-feather="trash-2" style="width: 16px; height: 16px;"></i></button>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
    
    if (window.feather) feather.replace();
}

document.getElementById('status-filter').addEventListener('change', loadQueue);

window.updatePostStatus = async (id, newStatus) => {
    if(isMockMode) {
        const postIndex = mockPosts.findIndex(p => p.id === id);
        if(postIndex > -1) {
            mockPosts[postIndex].status = newStatus;
            saveMockPosts();
        }
    } else {
        const { error } = await supabase.from('posts').update({ status: newStatus }).eq('id', id);
        if(error) console.error(error);
    }
    loadQueue(); // Re-render to update badge colors
};

window.deletePost = async (id) => {
    if(confirm('Are you sure you want to delete this post?')) {
        if(isMockMode) {
            mockPosts = mockPosts.filter(p => p.id !== id);
            saveMockPosts();
        } else {
            const { error } = await supabase.from('posts').delete().eq('id', id);
            if(error) console.error(error);
        }
        
        // Refresh active views
        if(document.getElementById('queue-view').classList.contains('active-view')) {
            await loadQueue();
        }
        if(document.getElementById('home-view').classList.contains('active-view')) {
            await loadDashboardStats();
        }
    }
}

// 3. Editor View
let currentEditingId = null;

let currentSlides = [];
let currentSlideIndex = 0;

window.openEditor = async (id) => {
    console.log("openEditor called with id", id);
    const posts = await getPosts();
    const post = posts.find(p => p.id === id);
    if(!post) { console.log("Post not found"); return; }
    
    currentEditingId = id;
    let editorStatus = document.getElementById('editor-status');
    let templateSelector = document.getElementById('template-selector');
    
    // Load the brand associated with this post
    if (post.brand_id) {
        const postBrand = allBrands.find(b => b.id === post.brand_id);
        if (postBrand) {
            currentBranding = postBrand;
            updateBrandVisuals(currentBranding);
            if (templateSelector) templateSelector.value = currentBranding.themePreset || 'theme-default';
            const pTog = document.getElementById('toggle-slide-numbers');
            if (pTog) pTog.checked = currentBranding.showPagination !== false;
        }
    } else {
        // Fallback if no brand_id
        updateBrandVisuals(currentBranding);
    }
    
    document.getElementById('editor-topic').innerText = `Editing: ${post.topic}`;
    document.getElementById('editor-image').src = post.image_url || 'https://via.placeholder.com/600x400?text=No+Image';
    editorStatus.value = post.status;
    
    console.log("Set basic editor fields");
    
    const bgImg = document.getElementById('slide-bg-img');
    if (post.image_url) {
        bgImg.src = post.image_url;
        bgImg.style.display = 'block';
    } else {
        bgImg.src = '';
        bgImg.style.display = 'none';
    }

    try {
        const parsed = JSON.parse(post.text);
        currentSlides = parsed.slides || [];
        document.getElementById('caption-text').value = parsed.caption || '';
    } catch (e) {
        currentSlides = [{title: "Content", content: post.text}];
        document.getElementById('caption-text').value = "";
    }
    console.log("Parsed JSON");
    
    currentSlideIndex = 0;
    renderSlidesForm();
    console.log("Rendered forms");
    updateSlidePreview();
    console.log("Updated preview");
    
    // Switch to editor view
    navLinks.forEach(l => l.classList.remove('active'));
    views.forEach(v => v.classList.remove('active-view'));
    document.getElementById('editor-view').classList.add('active-view');
    console.log("Switched view");
};

function renderSlidesForm() {
    const container = document.getElementById('slides-form-container');
    container.innerHTML = '';
    currentSlides.forEach((slide, index) => {
        const div = document.createElement('div');
        div.style.marginBottom = '15px';
        div.style.padding = '15px';
        div.style.border = '1px solid #e2e8f0';
        div.style.borderRadius = '8px';
        div.innerHTML = `
            <h4 style="margin-bottom:8px;">Slide ${index + 1}</h4>
            <input type="text" class="full-width margin-bottom" value="${slide.title.replace(/"/g, '&quot;')}" oninput="updateSlideData(${index}, 'title', this.value)">
            <textarea class="rich-textarea" rows="3" oninput="updateSlideData(${index}, 'content', this.value)">${slide.content}</textarea>
        `;
        container.appendChild(div);
    });
}

window.updateSlideData = (index, field, value) => {
    currentSlides[index][field] = value;
    if (index === currentSlideIndex) {
        updateSlidePreview();
    }
}

function updateSlidePreview() {
    if(currentSlides.length === 0) return;
    const slide = currentSlides[currentSlideIndex];
    const titleEl = document.getElementById('preview-title');
    const bodyEl = document.getElementById('preview-body');
    
    titleEl.innerText = slide.title;
    bodyEl.innerText = slide.content;
    document.getElementById('current-slide-indicator').innerText = `Slide ${currentSlideIndex + 1}`;
    
    // Check local toggle OR global setting for pagination
    const localToggle = document.getElementById('toggle-slide-numbers');
    const showPagination = localToggle ? localToggle.checked : (currentBranding.showPagination !== false);
    
    const paginationEl = document.getElementById('preview-pagination');
    if (paginationEl) {
        paginationEl.innerText = `${currentSlideIndex + 1} / ${currentSlides.length}`;
        paginationEl.style.display = showPagination ? 'block' : 'none';
    }
    
    const slideCard = document.getElementById('slide-render-target');
    const isVisualTemplate = slideCard.classList.contains('template-visual');
    
    // Auto-resize text to fit slide
    titleEl.style.fontSize = isVisualTemplate ? '48px' : '72px';
    bodyEl.style.fontSize = isVisualTemplate ? '32px' : '48px';
    
    let iterations = 0;
    while (slideCard.scrollHeight > slideCard.clientHeight && iterations < 30) {
        let currentBodySize = parseInt(window.getComputedStyle(bodyEl).fontSize);
        let currentTitleSize = parseInt(window.getComputedStyle(titleEl).fontSize);
        
        if (currentBodySize <= 24) break; // Minimum threshold
        
        bodyEl.style.fontSize = (currentBodySize - 2) + 'px';
        titleEl.style.fontSize = (currentTitleSize - 2) + 'px';
        iterations++;
    }
}

document.getElementById('toggle-slide-numbers').addEventListener('change', () => {
    updateSlidePreview();
});

document.getElementById('prev-slide').addEventListener('click', () => {
    if(currentSlideIndex > 0) {
        currentSlideIndex--;
        updateSlidePreview();
    }
});

document.getElementById('next-slide').addEventListener('click', () => {
    if(currentSlideIndex < currentSlides.length - 1) {
        currentSlideIndex++;
        updateSlidePreview();
    }
});

async function downloadSlidesImage() {
    const target = document.getElementById('slide-render-target');
    const originalIndex = currentSlideIndex;
    
    const originalTransform = target.style.transform;
    target.style.transform = 'scale(1)';
    
    for (let i = 0; i < currentSlides.length; i++) {
        currentSlideIndex = i;
        updateSlidePreview();
        await new Promise(r => setTimeout(r, 100)); // wait for DOM to update
        const canvas = await html2canvas(target, {scale: 1, useCORS: true});
        const link = document.createElement('a');
        link.download = `slide_${i+1}.png`;
        link.href = canvas.toDataURL();
        link.click();
    }
    
    target.style.transform = originalTransform || 'scale(0.37037)';
    currentSlideIndex = originalIndex;
    updateSlidePreview();
}

document.getElementById('download-slides').addEventListener('click', async () => {
    await downloadSlidesImage();
});

async function executePublish(platformUrl) {
    // 1. Trigger Download and wait for it
    await downloadSlidesImage();
    
    // 2. Copy Caption
    const text = document.getElementById('caption-text').value;
    try {
        await navigator.clipboard.writeText(text);
        alert(`Slides downloading and caption copied! Opening ${platformUrl}...`);
    } catch(err) {
        console.error("Clipboard error:", err);
    }
    
    // 3. Update Status to Published AND Save Edits
    if(currentEditingId) {
        document.getElementById('editor-status').value = 'Published';
        const updatedStatus = 'Published';
        const newImageUrl = document.getElementById('editor-image').src; 
        
        const updatedText = JSON.stringify({
            slides: currentSlides,
            caption: document.getElementById('caption-text').value
        });
        
        if (isMockMode) {
            const postIndex = mockPosts.findIndex(p => p.id === currentEditingId);
            if(postIndex > -1) {
                mockPosts[postIndex].text = updatedText;
                mockPosts[postIndex].status = updatedStatus;
                mockPosts[postIndex].image_url = newImageUrl;
                mockPosts[postIndex].updated_at = new Date().toISOString();
                saveMockPosts();
            }
        } else {
            await supabase.from('posts').update({ 
                text: updatedText, 
                status: updatedStatus, 
                image_url: newImageUrl 
            }).eq('id', currentEditingId);
        }
    }
    
    // 4. Open Publishing URL
    if (platformUrl) {
        window.open(platformUrl, '_blank');
    } else {
        alert("Platform URL not set. Please set it in the Branding tab.");
    }
    
    document.querySelector('[data-target="queue-view"]').click();
}

document.getElementById('publish-facebook').addEventListener('click', () => {
    executePublish(currentBranding.facebookUrl);
});

document.getElementById('publish-instagram').addEventListener('click', () => {
    executePublish(currentBranding.instagramUrl);
});

document.getElementById('publish-tiktok').addEventListener('click', () => {
    executePublish(currentBranding.tiktokUrl);
});

document.getElementById('publish-linkedin').addEventListener('click', () => {
    executePublish(currentBranding.linkedinUrl);
});

document.getElementById('copy-caption').addEventListener('click', () => {
    const text = document.getElementById('caption-text').value;
    navigator.clipboard.writeText(text);
    alert('Caption copied!');
});

document.getElementById('back-to-queue').addEventListener('click', () => {
    // Switch back to queue view
    document.querySelector('[data-target="queue-view"]').click();
});

document.getElementById('save-post').addEventListener('click', async () => {
    const updatedStatus = document.getElementById('editor-status').value;
    const newImageUrl = document.getElementById('editor-image').src; 
    
    const updatedText = JSON.stringify({
        slides: currentSlides,
        caption: document.getElementById('caption-text').value
    });

    if (isMockMode) {
        const postIndex = mockPosts.findIndex(p => p.id === currentEditingId);
        if(postIndex > -1) {
            mockPosts[postIndex].text = updatedText;
            mockPosts[postIndex].status = updatedStatus;
            mockPosts[postIndex].image_url = newImageUrl;
            mockPosts[postIndex].updated_at = new Date().toISOString();
            saveMockPosts();
        }
        alert('Changes saved (Mock Mode)');
        document.querySelector('[data-target="queue-view"]').click();
        return;
    }
    
    const { error } = await supabase
        .from('posts')
        .update({ text: updatedText, status: updatedStatus, image_url: newImageUrl })
        .eq('id', currentEditingId);
        
    if (error) {
        alert('Error saving: ' + error.message);
    } else {
        alert('Changes saved successfully');
        document.querySelector('[data-target="queue-view"]').click();
    }
});

document.getElementById('refine-post').addEventListener('click', async () => {
    const note = prompt("Enter instructions for refining this content:");
    if (!note) return;

    const btn = document.getElementById('refine-post');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = `<i data-feather="loader" class="spin"></i> Refining...`;
    btn.disabled = true;
    feather.replace();

    const currentText = JSON.stringify({
        slides: currentSlides,
        caption: document.getElementById('caption-text').value
    });
    
    // We get the topic from the UI header
    const fullTopicText = document.getElementById('editor-topic').innerText;
    const topic = fullTopicText.replace('Editing: ', '');

    try {
        const response = await fetch(CONFIG.N8N_MANUAL_WEBHOOK_URL.replace('/generate', '/refine'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, currentText, note })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || "Failed to refine");
        }

        if (isMockMode) {
            const postIndex = mockPosts.findIndex(p => p.id === currentEditingId);
            if(postIndex > -1) {
                mockPosts[postIndex].text = data.text;
                mockPosts[postIndex].status = 'Draft';
                mockPosts[postIndex].updated_at = new Date().toISOString();
                saveMockPosts();
            }
            alert('Refined successfully! (Mock Mode)');
        } else {
            const { error } = await supabase
                .from('posts')
                .update({ text: data.text, status: 'Draft' })
                .eq('id', currentEditingId);
                
            if (error) throw error;
            alert('Refined successfully! Reloading...');
        }
        
        // Return to queue and reload
        await loadQueue();
        document.querySelector('[data-target="queue-view"]').click();
    } catch(e) {
        alert("Error refining post: " + e.message);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
        feather.replace();
    }
});

// Template selector handler
document.getElementById('template-selector').addEventListener('change', function(e) {
    const slideTarget = document.getElementById('slide-render-target');
    slideTarget.className = 'slide-card ' + e.target.value;
    updateSlidePreview();
});

// Image Upload Preview (Local only for demo)
document.getElementById('image-upload').addEventListener('change', function(e) {
    try {
        if (e.target.files && e.target.files[0]) {
            let file = e.target.files[0];
            
            // Check if it's an image
            if (!file.type.match('image.*')) {
                throw new Error("Selected file is not an image.");
            }

            let reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    document.getElementById('editor-image').src = ev.target.result;
                    document.getElementById('slide-bg-img').src = ev.target.result;
                    document.getElementById('slide-bg-img').style.display = 'block';
                    // Note: In real app, we would upload this file to Supabase Storage bucket here and update image_url.
                } catch(innerErr) {
                    console.error("Error setting image source:", innerErr);
                    alert("Oops, something went wrong displaying the image.");
                }
            };
            reader.onerror = function(ev) {
                console.error("FileReader error:", ev);
                alert("Oops, something went wrong reading the file.");
            };
            reader.readAsDataURL(file);
        }
    } catch(err) {
        console.error("File selection error:", err);
        alert("Oops, something went wrong: " + err.message);
    }
});

// 4. Manual Generator View
document.getElementById('trigger-manual').addEventListener('click', async () => {
    const topic = document.getElementById('manual-topic').value;
    const contentType = document.getElementById('manual-content-type').value;
    const language = document.getElementById('manual-language').value;
    const brandId = document.getElementById('manual-brand').value;
    const feedback = document.getElementById('manual-feedback');
    
    if(!topic) {
        feedback.innerText = "Please enter a topic.";
        feedback.style.color = "var(--warning)";
        return;
    }
    
    // UI Loading State
    const btn = document.getElementById('trigger-manual');
    const overlay = document.getElementById('manual-loading-overlay');
    const originalBtnHtml = btn.innerHTML; // Fix: Store original HTML
    
    btn.style.display = 'none';
    feedback.style.display = 'none';
    overlay.style.display = 'block';
    
    if (CONFIG.N8N_MANUAL_WEBHOOK_URL !== "YOUR_N8N_WEBHOOK_URL") {
        // Real mode: Trigger the backend webhook
        try {
            const response = await fetch(CONFIG.N8N_MANUAL_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    topic: topic,
                brand_id: brandId, 
                    contentType: contentType, 
                    language: language,
                    promptTemplate: currentPromptTemplate
                })
            });
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || "Unknown backend error");
            }
            
            // Handle database errors silently handled by backend
            if (data.db_error) {
                console.warn("Database failed to save post:", data.db_error);
                if (!isMockMode) {
                    alert(`Supabase Error: ${data.db_error}\n\nFalling back to Local Storage so you don't lose your work.`);
                    isMockMode = true;
                }
            }
            
            if (isMockMode) {
                const newPost = data.post || {
                    id: Date.now().toString(),
                    topic: `[${contentType}] ${topic}`,
                    text: data.text,
                    image_url: data.image_url,
                    status: 'Draft',
                    brand_id: brandId,
                    updated_at: new Date().toISOString()
                };
                if (!mockPosts.find(p => p.id === newPost.id)) {
                    mockPosts.unshift(newPost);
                    saveMockPosts();
                }
            }
            
            feedback.innerText = "Content triggered successfully! Check the Content Queue shortly.";
            feedback.style.color = "var(--success)";
            btn.style.display = 'block';
            overlay.style.display = 'none';
            feedback.style.display = 'block';
            
            // Fix: Reload queue and redirect in real mode too
            await loadQueue();
            document.querySelector('[data-target="queue-view"]').click();
            document.getElementById('manual-topic').value = "";
            
        } catch(err) {
            console.error(err);
            feedback.innerText = "Error triggering generation: " + err.message;
            feedback.style.color = "var(--danger)";
            
            btn.style.display = 'block';
            overlay.style.display = 'none';
            feedback.style.display = 'block';
        }
    } else {
        // Mock mode timeout simulation (extended to show loader)
        setTimeout(() => {
            if(isMockMode) {
                mockPosts.unshift({
                    id: Date.now().toString(),
                    topic: `[${language}] [${contentType}] ${topic}`,
                    text: `Generated ${contentType.toLowerCase()} for ${topic} in ${language}...`,
                    image_url: 'assets/images/geography_nepal.png',
                    status: 'Draft',
                    brand_id: brandId,
                    updated_at: new Date().toISOString()
                });
                saveMockPosts();
            }
            feedback.innerText = "Content drafted successfully (Mock)!";
            feedback.style.color = "var(--success)";
            document.getElementById('manual-topic').value = "";
            btn.innerHTML = originalBtnHtml;
            btn.disabled = false;
            feather.replace();
            
            // Auto redirect to Queue
            loadQueue();
            document.querySelector('[data-target="queue-view"]').click();
        }, 2500);
    }
});

// Topic Suggestions
const suggestedTopics = [
    "Geography of Nepal - Major Rivers",
    "History - The Unification of Nepal",
    "Constitution - Fundamental Rights",
    "Current Affairs - Nepal's Economic Policy 2080",
    "Science - Human Digestive System",
    "General Knowledge - First in Nepal",
    "Literature - Masterpieces of Bhanubhakta",
    "Ecology - National Parks and Wildlife Reserves",
    "Administration - Structure of Local Government",
    "International Relations - Nepal and the UN"
];

function suggestRandomTopic() {
    const input = document.getElementById('manual-topic');
    if(input) {
        const randomIndex = Math.floor(Math.random() * suggestedTopics.length);
        input.value = suggestedTopics[randomIndex];
    }
}

document.getElementById('refresh-topic-btn').addEventListener('click', suggestRandomTopic);

// 5. Settings View (now handled directly in Account Settings HTML)
async function loadSettings() {
    if (currentUser && currentUser.user_metadata) {
        document.getElementById('setting-display-name').value = currentUser.user_metadata.display_name || '';
        document.getElementById('setting-phone').value = currentUser.user_metadata.phone || '';
    }
}


// Init
window.onload = () => {
    loadDashboardStats();
    suggestRandomTopic();
};

// 7. Branding View
function loadBrandingView() {
    document.getElementById('brand-name-input').value = currentBranding.name;
    document.getElementById('brand-handle-input').value = currentBranding.handle;
    document.getElementById('brand-logo-preview').src = currentBranding.logoUrl;
    document.getElementById('facebook-url-input').value = currentBranding.facebookUrl || "";
    document.getElementById('instagram-url-input').value = currentBranding.instagramUrl || "";
    document.getElementById('tiktok-url-input').value = currentBranding.tiktokUrl || "";
    document.getElementById('linkedin-url-input').value = currentBranding.linkedinUrl || "";
    document.getElementById('brand-primary-color-input').value = currentBranding.primaryColor || "#1e3c72";
    document.getElementById('brand-secondary-color-input').value = currentBranding.secondaryColor || "#2a5298";
    
    // Custom Template
    document.getElementById('custom-title-size').value = currentBranding.customTitleSize || 100;
    document.getElementById('custom-title-y').value = currentBranding.customTitleY || 50;
    document.getElementById('custom-content-y').value = currentBranding.customContentY || 70;
    document.getElementById('custom-bg-opacity').value = currentBranding.customBgOpacity || 85;
    document.getElementById('custom-bg-color').value = currentBranding.customBgColor || "#000000";
    
    const themeSelect = document.getElementById('custom-theme-preset');
    if(themeSelect) themeSelect.value = currentBranding.themePreset || 'theme-default';
    
    const paginationToggle = document.getElementById('custom-show-pagination');
    if(paginationToggle) paginationToggle.checked = currentBranding.showPagination !== false;
    
    // Prompt
    document.getElementById('prompt-template-input').value = currentPromptTemplate;
    
    document.getElementById('branding-feedback').innerText = "";
}

// Branding Logo Upload (With Canvas Resizing to prevent localStorage limits)
document.getElementById('brand-logo-upload').addEventListener('change', function(e) {
    try {
        if (e.target.files && e.target.files[0]) {
            let file = e.target.files[0];
            if (!file.type.match('image.*')) throw new Error("Selected file is not an image.");
            let reader = new FileReader();
            reader.onload = function(ev) {
                let img = new Image();
                img.onload = function() {
                    let canvas = document.createElement('canvas');
                    let ctx = canvas.getContext('2d');
                    // Resize to max 200px width/height
                    let maxW = 200, maxH = 200;
                    let ratio = Math.min(maxW / img.width, maxH / img.height);
                    canvas.width = img.width * ratio;
                    canvas.height = img.height * ratio;
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    let dataUrl = canvas.toDataURL('image/png');
                    document.getElementById('brand-logo-preview').src = dataUrl;
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        }
    } catch(err) {
        alert("Oops, something went wrong: " + err.message);
    }
});

// Save Branding

document.getElementById('save-branding').addEventListener('click', async function() {
    const name = document.getElementById('brand-name-input').value;
    const handle = document.getElementById('brand-handle-input').value;
    const logoUrl = document.getElementById('brand-logo-preview').src;
    const facebookUrl = document.getElementById('facebook-url-input').value;
    const instagramUrl = document.getElementById('instagram-url-input').value;
    const tiktokUrl = document.getElementById('tiktok-url-input').value;
    const linkedinUrl = document.getElementById('linkedin-url-input').value;
    const primaryColor = document.getElementById('brand-primary-color-input').value;
    const secondaryColor = document.getElementById('brand-secondary-color-input').value;
    
    const customTitleSize = document.getElementById('custom-title-size').value;
    const customTitleY = document.getElementById('custom-title-y').value;
    const customContentY = document.getElementById('custom-content-y').value;
    const customBgOpacity = document.getElementById('custom-bg-opacity').value;
    const customBgColor = document.getElementById('custom-bg-color').value;
    
    const themeSelect = document.getElementById('custom-theme-preset');
    const themePreset = themeSelect ? themeSelect.value : 'theme-default';
    
    const paginationToggle = document.getElementById('custom-show-pagination');
    const showPagination = paginationToggle ? paginationToggle.checked : true;
    
    const templateSettings = { customTitleSize, customTitleY, customContentY, customBgOpacity, customBgColor, themePreset, showPagination };
    const socialLinks = { facebookUrl, instagramUrl, tiktokUrl, linkedinUrl };
    
    if (activeBrandId.startsWith('new-')) {
        // Create new brand in Supabase
        if (!isMockMode) {
            const { data, error } = await supabase.from('brands').insert({
                name, handle, logo_url: logoUrl, primary_color: primaryColor, secondary_color: secondaryColor,
                social_links: socialLinks, template_settings: templateSettings
            }).select();
            if (data && data[0]) {
                activeBrandId = data[0].id;
                allBrands.push({
                    id: activeBrandId, name, handle, logoUrl, facebookUrl, instagramUrl, tiktokUrl, linkedinUrl,
                    primaryColor, secondaryColor, customTitleSize, customTitleY, customContentY, customBgOpacity, customBgColor, themePreset, showPagination
                });
            }
        } else {
            activeBrandId = "mock-" + Date.now();
            allBrands.push({
                id: activeBrandId, name, handle, logoUrl, facebookUrl, instagramUrl, tiktokUrl, linkedinUrl,
                primaryColor, secondaryColor, customTitleSize, customTitleY, customContentY, customBgOpacity, customBgColor, themePreset, showPagination
            });
        }
    } else {
        // Update existing brand
        if (!isMockMode) {
            await supabase.from('brands').update({
                name, handle, logo_url: logoUrl, primary_color: primaryColor, secondary_color: secondaryColor,
                social_links: socialLinks, template_settings: templateSettings
            }).eq('id', activeBrandId);
        }
        const b = allBrands.find(br => br.id === activeBrandId);
        if (b) {
            Object.assign(b, { name, handle, logoUrl, facebookUrl, instagramUrl, tiktokUrl, linkedinUrl, primaryColor, secondaryColor, customTitleSize, customTitleY, customContentY, customBgOpacity, customBgColor, themePreset, showPagination });
        }
    }
    
    currentBranding = allBrands.find(br => br.id === activeBrandId);
    if(isMockMode) localStorage.setItem('loksewa_all_brands', JSON.stringify(allBrands));
    
    updateBrandVisuals(currentBranding);
    populateBrandSelectors();
    
    const feedback = document.getElementById('branding-feedback');
    feedback.innerText = "Brand saved successfully!";
    feedback.style.color = "var(--success)";
    setTimeout(() => { feedback.innerText = ""; }, 3000);
});

// Brand Selector Event
document.getElementById('brand-selector').addEventListener('change', (e) => {
    const bId = e.target.value;
    if (bId) {
        activeBrandId = bId;
        currentBranding = allBrands.find(br => br.id === activeBrandId);
        loadBrandingForm(currentBranding);
        updateBrandVisuals(currentBranding);
    }
});

// Create Brand Event
document.getElementById('create-brand-btn').addEventListener('click', () => {
    const newBrand = {
        id: 'new-' + Date.now(),
        name: "New Brand",
        handle: "@newbrand",
        logoUrl: "assets/images/logo.png",
        primaryColor: "#000000",
        secondaryColor: "#666666",
        customTitleSize: "100", customTitleY: "50", customContentY: "70", customBgOpacity: "85", customBgColor: "#000000", themePreset: "theme-default", showPagination: true
    };
    activeBrandId = newBrand.id;
    currentBranding = newBrand;
    // Don't add to allBrands until saved
    const opt = document.createElement('option');
    opt.value = activeBrandId;
    opt.innerText = newBrand.name;
    document.getElementById('brand-selector').appendChild(opt);
    document.getElementById('brand-selector').value = activeBrandId;
    
    loadBrandingForm(newBrand);
    updateBrandVisuals(newBrand);
});

function loadBrandingForm(brand) {
    document.getElementById('brand-name-input').value = brand.name || '';
    document.getElementById('brand-handle-input').value = brand.handle || '';
    document.getElementById('brand-logo-preview').src = brand.logoUrl || 'assets/images/logo.png';
    document.getElementById('facebook-url-input').value = brand.facebookUrl || '';
    document.getElementById('instagram-url-input').value = brand.instagramUrl || '';
    document.getElementById('tiktok-url-input').value = brand.tiktokUrl || '';
    document.getElementById('linkedin-url-input').value = brand.linkedinUrl || '';
    document.getElementById('brand-primary-color-input').value = brand.primaryColor || '#1e3c72';
    document.getElementById('brand-secondary-color-input').value = brand.secondaryColor || '#2a5298';
    document.getElementById('custom-title-size').value = brand.customTitleSize || 100;
    document.getElementById('custom-title-y').value = brand.customTitleY || 50;
    document.getElementById('custom-content-y').value = brand.customContentY || 70;
    document.getElementById('custom-bg-opacity').value = brand.customBgOpacity || 85;
    document.getElementById('custom-bg-color').value = brand.customBgColor || '#000000';
    const ts = document.getElementById('custom-theme-preset');
    if(ts) ts.value = brand.themePreset || 'theme-default';
    const pt = document.getElementById('custom-show-pagination');
    if(pt) pt.checked = brand.showPagination !== false;
}


// --- Intelligence Logic ---
// Real-time custom template updates
const customInputs = ['custom-title-size', 'custom-title-y', 'custom-content-y', 'custom-bg-opacity', 'custom-bg-color'];
customInputs.forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
        // Just update variables inline to preview, doesn't save to localStorage yet
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
            document.documentElement.style.setProperty('--custom-bg-color', `rgba(${r}, ${g}, ${b}, ${a})`);
        }
    });
});

document.getElementById('reset-prompt-btn').addEventListener('click', () => {
    if(confirm("Are you sure you want to reset to the default prompt?")) {
        currentPromptTemplate = DEFAULT_PROMPT_TEMPLATE;
        document.getElementById('prompt-template-input').value = currentPromptTemplate;
        localStorage.setItem('loksewa_prompt_template', currentPromptTemplate);
        const feedback = document.getElementById('branding-feedback');
        if (feedback) {
            feedback.innerText = "Prompt reset to default.";
            feedback.style.color = "var(--color-fg-muted)";
            setTimeout(() => { feedback.innerText = ""; }, 3000);
        }
    }
});

// --- Video Creation Logic ---
async function loadVideoQueue() {
    const posts = await getPosts();
    const grid = document.getElementById('video-grid');
    grid.innerHTML = '';
    
    posts.forEach(post => {
        const card = document.createElement('div');
        card.className = 'content-card';
        card.innerHTML = `
            <div class="content-card-img" style="background-image: url('${post.image_url || 'https://via.placeholder.com/400x200?text=No+Image'}')"></div>
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
    
    // Attempt to format JSON text nicely
    try {
        const parsed = JSON.parse(post.text);
        let niceText = "";
        if(parsed.slides) {
            parsed.slides.forEach((s, i) => {
                niceText += `Slide ${i+1}: ${s.title}\n${s.content}\n\n`;
            });
        }
        if(parsed.caption) niceText += `Caption: ${parsed.caption}`;
        document.getElementById('video-original-content').innerText = niceText || post.text;
    } catch(e) {
        document.getElementById('video-original-content').innerText = post.text;
    }
    
    document.getElementById('video-prompts-result').style.display = 'none';
    document.getElementById('video-prompts-text').value = '';
    document.getElementById('video-feedback').innerText = '';
    
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
    document.getElementById('video-editor-view').classList.add('active-view');
};

document.getElementById('back-to-video-queue').addEventListener('click', () => {
    document.querySelector('[data-target="video-view"]').click();
});

document.getElementById('video-format').addEventListener('change', (e) => {
    document.getElementById('video-splits-group').style.display = e.target.value === 'multiple' ? 'block' : 'none';
});

document.getElementById('generate-video-btn').addEventListener('click', async () => {
    const originalResearch = document.getElementById('video-original-content').innerText;
    const format = document.getElementById('video-format').value;
    const splits = document.getElementById('video-splits').value;
    
    const btn = document.getElementById('generate-video-btn');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = `<i data-feather="loader" class="spin"></i> Generating...`;
    btn.disabled = true;
    feather.replace();
    
    const feedback = document.getElementById('video-feedback');
    feedback.innerText = "Requesting video prompts...";
    feedback.style.color = "var(--text-main)";

    try {
        const response = await fetch(CONFIG.N8N_MANUAL_WEBHOOK_URL.replace('/generate', '/generate-video'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ originalResearch, format, splits })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || "Failed to generate video prompts");
        }
        
        document.getElementById('video-prompts-text').value = data.prompts;
        document.getElementById('video-prompts-result').style.display = 'block';
        feedback.innerText = "Success!";
        feedback.style.color = "var(--success)";
    } catch(e) {
        feedback.innerText = "Error: " + e.message;
        feedback.style.color = "var(--danger)";
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
        feather.replace();
    }
});

document.getElementById('copy-video-prompts').addEventListener('click', () => {
    const text = document.getElementById('video-prompts-text').value;
    navigator.clipboard.writeText(text);
    alert('Video prompts copied!');
});

// --- Mobile Menu Toggle ---
document.getElementById('mobile-menu-btn').addEventListener('click', () => {
    document.getElementById('app-container').classList.toggle('sidebar-open');
});

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    const container = document.getElementById('app-container');
    // If we click on the app container (which acts as overlay via ::after)
    // or if we click a nav link in mobile mode
    if (container.classList.contains('sidebar-open') && 
        (e.target === container || e.target.closest('.nav-links a'))) {
        container.classList.remove('sidebar-open');
    }
});

// --- Settings & Security Logic ---
document.getElementById('save-profile-btn').addEventListener('click', async () => {
    if(isMockMode) return alert('Cannot update profile in mock mode');
    const btn = document.getElementById('save-profile-btn');
    const feedback = document.getElementById('profile-feedback');
    const displayName = document.getElementById('setting-display-name').value;
    const phone = document.getElementById('setting-phone').value;
    
    btn.disabled = true;
    feedback.innerText = "Saving...";
    feedback.style.color = "var(--text-secondary)";
    
    const { data, error } = await supabase.auth.updateUser({
        data: { display_name: displayName, phone: phone }
    });
    
    if (error) {
        feedback.innerText = error.message;
        feedback.style.color = "var(--danger)";
    } else {
        feedback.innerText = "Profile updated successfully!";
        feedback.style.color = "var(--success)";
        if(displayName) {
            document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${displayName.substring(0,2)}&background=random`;
        }
    }
    btn.disabled = false;
});

document.getElementById('update-password-btn').addEventListener('click', async () => {
    if(isMockMode) return alert('Cannot update password in mock mode');
    const password = document.getElementById('setting-new-password').value;
    const feedback = document.getElementById('password-feedback');
    if(!password || password.length < 6) {
        feedback.innerText = "Password must be at least 6 characters.";
        feedback.style.color = "var(--danger)";
        return;
    }
    
    feedback.innerText = "Updating...";
    feedback.style.color = "var(--text-secondary)";
    
    const { data, error } = await supabase.auth.updateUser({ password });
    
    if (error) {
        feedback.innerText = error.message;
        feedback.style.color = "var(--danger)";
    } else {
        feedback.innerText = "Password updated successfully!";
        feedback.style.color = "var(--success)";
        document.getElementById('setting-new-password').value = '';
    }
});

let currentMfaFactorId = null;

document.getElementById('enroll-mfa-btn').addEventListener('click', async () => {
    if(isMockMode) return alert('Cannot enroll MFA in mock mode');
    const feedback = document.getElementById('mfa-feedback');
    
    try {
        const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
        if (error) throw error;
        
        currentMfaFactorId = data.id;
        document.getElementById('mfa-enrollment-flow').style.display = 'block';
        document.getElementById('enroll-mfa-btn').style.display = 'none';
        
        // Generate QR code using raw SVG Data URI (Fix 5)
        const svgString = encodeURIComponent(data.totp.qr_code);
        document.getElementById('mfa-qr-code').src = `data:image/svg+xml;utf8,${svgString}`;
        
    } catch(e) {
        alert("Error enrolling MFA: " + e.message);
    }
});

document.getElementById('verify-mfa-btn').addEventListener('click', async () => {
    const code = document.getElementById('mfa-verify-code').value;
    const feedback = document.getElementById('mfa-feedback');
    
    if(!code || code.length !== 6) {
        feedback.innerText = "Please enter a valid 6-digit code.";
        feedback.style.color = "var(--danger)";
        return;
    }
    
    feedback.innerText = "Verifying...";
    feedback.style.color = "var(--text-secondary)";
    
    try {
        const challenge = await supabase.auth.mfa.challenge({ factorId: currentMfaFactorId });
        if (challenge.error) throw challenge.error;
        
        const verify = await supabase.auth.mfa.verify({
            factorId: currentMfaFactorId,
            challengeId: challenge.data.id,
            code: code
        });
        
        if (verify.error) throw verify.error;
        
        feedback.innerText = "MFA Enabled successfully!";
        feedback.style.color = "var(--success)";
        document.getElementById('mfa-enrollment-flow').style.display = 'none';
        document.getElementById('mfa-status-text').innerText = 'Enabled';
        document.getElementById('mfa-status-text').style.color = 'var(--success)';
        
    } catch(e) {
        feedback.innerText = e.message;
        feedback.style.color = "var(--danger)";
    }
});
