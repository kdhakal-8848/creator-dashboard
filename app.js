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
        }
        document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${nameParam}&background=random`;
        
        loadDashboardStats(); // Refresh data now that we are authenticated
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
let currentBranding = JSON.parse(localStorage.getItem('loksewa_branding')) || {
    name: "PUBLIC SERVICE NEPAL",
    handle: "@PublicServiceNepal",
    logoUrl: "assets/images/logo.png",
    facebookUrl: "https://business.facebook.com",
    instagramUrl: "https://instagram.com",
    tiktokUrl: "https://tiktok.com",
    linkedinUrl: "https://linkedin.com",
    primaryColor: "#1e3c72",
    secondaryColor: "#2a5298"
};

function updateBrandVisuals() {
    const nameEl = document.getElementById('slide-brand-name');
    const handleEl = document.getElementById('slide-brand-handle');
    const logoEl = document.getElementById('slide-brand-logo');
    
    if(nameEl) nameEl.innerText = currentBranding.name;
    if(handleEl) handleEl.innerText = currentBranding.handle;
    if(logoEl) logoEl.src = currentBranding.logoUrl;
    
    // Apply CSS Variables for dynamic template coloring
    if (currentBranding.primaryColor) {
        document.documentElement.style.setProperty('--brand-primary', currentBranding.primaryColor);
    }
    if (currentBranding.secondaryColor) {
        document.documentElement.style.setProperty('--brand-secondary', currentBranding.secondaryColor);
    }
}

// Initial application of branding
updateBrandVisuals();

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
        if(targetViewId === 'intelligence-view') loadIntelligenceView();
    });
});

// --- Data Fetching & Rendering ---

async function getPosts() {
    if (isMockMode) return mockPosts;
    const { data, error } = await supabase.from('posts').select('*').order('updated_at', { ascending: false });
    if (error) {
        console.error(error);
        return [];
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
    
    filteredPosts.forEach(post => {
        const card = document.createElement('div');
        card.className = 'content-card';
        card.innerHTML = `
            <div class="content-card-img" style="background-image: url('${post.image_url || 'https://via.placeholder.com/400x200?text=No+Image'}')"></div>
            <div class="content-card-body">
                <div class="content-card-title">${post.topic}</div>
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
    
    document.getElementById('editor-topic').innerText = `Editing: ${post.topic}`;
    document.getElementById('editor-image').src = post.image_url || 'https://via.placeholder.com/600x400?text=No+Image';
    editorStatus.value = post.status;
    
    // Set default template class
    document.getElementById('slide-render-target').className = 'slide-card template-classic';
    templateSelector.value = 'template-classic';
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
    document.getElementById('preview-pagination').innerText = `${currentSlideIndex + 1} / ${currentSlides.length}`;
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

document.getElementById('download-slides').addEventListener('click', async () => {
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
});

async function executePublish(platformUrl) {
    // 1. Trigger Download
    document.getElementById('download-slides').click();
    
    // 2. Copy Caption
    const text = document.getElementById('caption-text').value;
    try {
        await navigator.clipboard.writeText(text);
        alert(`Slides downloading and caption copied! Opening ${platformUrl}...`);
    } catch(err) {
        console.error("Clipboard error:", err);
    }
    
    // 3. Update Status to Published
    if(currentEditingId) {
        document.getElementById('editor-status').value = 'Published';
        if (isMockMode) {
            const postIndex = mockPosts.findIndex(p => p.id === currentEditingId);
            if(postIndex > -1) {
                mockPosts[postIndex].status = 'Published';
                saveMockPosts();
            }
        } else {
            supabase.from('posts').update({ status: 'Published' }).eq('id', currentEditingId).then();
        }
    }
    
    // 4. Open Publishing URL
    if (platformUrl) {
        window.open(platformUrl, '_blank');
    } else {
        alert("Platform URL not set. Please set it in the Branding tab.");
    }
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
        
        // Return to queue
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
    const feedback = document.getElementById('manual-feedback');
    
    if(!topic) {
        feedback.innerText = "Please enter a topic.";
        feedback.style.color = "var(--warning)";
        return;
    }
    
    // UI Loading State
    const btn = document.getElementById('trigger-manual');
    const originalBtnHtml = btn.innerHTML;
    btn.innerHTML = `<i data-feather="loader" class="spin"></i> Generating...`;
    btn.disabled = true;
    feather.replace();
    
    feedback.innerText = "Triggering n8n webhook...";
    feedback.style.color = "var(--text-main)";
    
    if (CONFIG.N8N_MANUAL_WEBHOOK_URL !== "YOUR_N8N_WEBHOOK_URL") {
        // Real mode: Trigger the backend webhook
        try {
            const response = await fetch(CONFIG.N8N_MANUAL_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    topic: topic, 
                    contentType: contentType, 
                    language: language,
                    promptTemplate: currentPromptTemplate
                })
            });
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || "Unknown backend error");
            }
            
            if (isMockMode && data.post) {
                mockPosts.unshift(data.post);
                saveMockPosts();
            }
            
            feedback.innerText = "Content triggered successfully! Check the Content Queue shortly.";
            feedback.style.color = "var(--success)";
            document.getElementById('manual-topic').value = "";
            btn.innerHTML = originalBtnHtml;
            btn.disabled = false;
            feather.replace();
            document.querySelector('[data-target="queue-view"]').click();
        } catch (e) {
            feedback.innerText = "Failed to trigger webhook: " + e.message;
            feedback.style.color = "var(--danger)";
            btn.innerHTML = originalBtnHtml;
            btn.disabled = false;
            feather.replace();
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

// 5. Settings View
async function loadSettings() {
    const container = document.getElementById('settings-container');
    container.innerHTML = '';
    
    let settings = isMockMode ? mockSettings : [];
    
    if (!isMockMode) {
        const { data, error } = await supabase.from('system_settings').select('*');
        if (!error) settings = data;
    }
    
    settings.forEach(setting => {
        const div = document.createElement('div');
        div.className = 'form-group setting-item';
        div.innerHTML = `
            <label>${setting.key}</label>
            <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom: 8px;">${setting.description}</p>
            ${setting.key === 'prompt_template' 
                ? `<textarea id="setting-${setting.key}" rows="4">${setting.value}</textarea>`
                : `<input type="text" id="setting-${setting.key}" value="${setting.value}">`
            }
        `;
        container.appendChild(div);
    });
}

document.getElementById('save-settings').addEventListener('click', async () => {
    if (isMockMode) {
        mockSettings.forEach(s => {
            const input = document.getElementById(`setting-${s.key}`);
            if(input) s.value = input.value;
        });
        alert('Settings saved (Mock Mode)');
        return;
    }
    
    // In real mode, update each setting in DB... (Requires iteration or bulk upsert)
    alert('Settings saved (Assuming Supabase implementation)');
});


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
    document.getElementById('branding-feedback').innerText = "";
}

// Branding Logo Upload
document.getElementById('brand-logo-upload').addEventListener('change', function(e) {
    try {
        if (e.target.files && e.target.files[0]) {
            let file = e.target.files[0];
            if (!file.type.match('image.*')) throw new Error("Selected file is not an image.");
            let reader = new FileReader();
            reader.onload = function(ev) {
                document.getElementById('brand-logo-preview').src = ev.target.result;
            };
            reader.readAsDataURL(file);
        }
    } catch(err) {
        alert("Oops, something went wrong: " + err.message);
    }
});

// Save Branding
document.getElementById('save-branding').addEventListener('click', function() {
    const name = document.getElementById('brand-name-input').value;
    const handle = document.getElementById('brand-handle-input').value;
    const logoUrl = document.getElementById('brand-logo-preview').src;
    const facebookUrl = document.getElementById('facebook-url-input').value;
    const instagramUrl = document.getElementById('instagram-url-input').value;
    const tiktokUrl = document.getElementById('tiktok-url-input').value;
    const linkedinUrl = document.getElementById('linkedin-url-input').value;
    const primaryColor = document.getElementById('brand-primary-color-input').value;
    const secondaryColor = document.getElementById('brand-secondary-color-input').value;
    
    currentBranding = { name, handle, logoUrl, facebookUrl, instagramUrl, tiktokUrl, linkedinUrl, primaryColor, secondaryColor };
    localStorage.setItem('loksewa_branding', JSON.stringify(currentBranding));
    
    updateBrandVisuals();
    
    const feedback = document.getElementById('branding-feedback');
    feedback.innerText = "Branding saved successfully! Future slides will use these assets.";
    feedback.style.color = "var(--success)";
    setTimeout(() => { feedback.innerText = ""; }, 3000);
});

// --- Intelligence Logic ---
function loadIntelligenceView() {
    document.getElementById('prompt-template-input').value = currentPromptTemplate;
}

document.getElementById('save-prompt-btn').addEventListener('click', () => {
    const newVal = document.getElementById('prompt-template-input').value;
    currentPromptTemplate = newVal;
    localStorage.setItem('loksewa_prompt_template', currentPromptTemplate);
    const feedback = document.getElementById('prompt-feedback');
    feedback.innerText = "Prompt template saved!";
    feedback.style.color = "var(--success)";
    setTimeout(() => { feedback.innerText = ""; }, 3000);
});

document.getElementById('reset-prompt-btn').addEventListener('click', () => {
    if(confirm("Are you sure you want to reset to the default prompt?")) {
        currentPromptTemplate = DEFAULT_PROMPT_TEMPLATE;
        document.getElementById('prompt-template-input').value = currentPromptTemplate;
        localStorage.setItem('loksewa_prompt_template', currentPromptTemplate);
        const feedback = document.getElementById('prompt-feedback');
        feedback.innerText = "Prompt reset to default.";
        feedback.style.color = "var(--text-main)";
        setTimeout(() => { feedback.innerText = ""; }, 3000);
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
