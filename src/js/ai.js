// FlowAI Assistant Module for StudyFlow - Premium Study Companion
import { 
  getState, 
  addTask, 
  addNotePage, 
  saveState, 
  getTodayStats,
  getChats,
  saveChatThread,
  deleteChatThread
} from './state.js';
import { renderDashboard } from './dashboard.js';
import { renderPlanner } from './planner.js';
import { switchTab } from './router.js';

// Active Chat Thread ID in Memory
let activeThreadId = null;

// Default Suggestion Cards
const SUGGESTIONS = {
  coach: [
    { title: "🎓 Plan study", desc: "Create a 3-step study plan for my upcoming Mathematics test.", prompt: "Create a 3-step study plan for my upcoming Mathematics test." },
    { title: "⏱️ Focus tips", desc: "Explain the Feynman technique and how I can apply it.", prompt: "Explain the Feynman technique and how I can apply it to my study sessions." },
    { title: "🔍 Productivity Audit", desc: "Audit my logged hours and task completion for today.", prompt: "Perform a productivity audit on my study sessions today." }
  ],
  wizard: [
    { title: "📝 Summarize topic", desc: "Write a summary of active recall vs passive review.", prompt: "Write a concise summary comparing the neural efficiency of active recall versus passive review." },
    { title: "⚡ Key takeaways", desc: "Summarize the 3 core pillars of deep focused work.", prompt: "Summarize the 3 core pillars of deep focused work into quick bullet point takeaways." }
  ],
  quiz: [
    { title: "🧠 Test knowledge", desc: "Start a quiz about sorting algorithms and time complexity.", prompt: "Start a quiz about sorting algorithms and time complexity." },
    { title: "📚 Flashcard prompt", desc: "Ask me questions to test my Pomodoro study knowledge.", prompt: "Test my knowledge on study techniques with a series of quick questions." }
  ]
};

// System Prompts for Personas
const PERSONA_PROMPTS = {
  coach: `You are Graduate Coach FlowAI, an encouraging and expert academic coach for the StudyFlow app.
Help the user build study habits, manage tasks, suggest Pomodoro schedules, and stay motivated.
To help the user directly, you can recommend adding tasks to their planner. If you recommend a task, put it on its own line in this exact format:
[TASK: Task Title | Subject Name | priority (high/medium/low) | Estimated Pomodoros (number)]
Example: [TASK: Review calculus formulas | Mathematics | high | 2]`,

  wizard: `You are Summary Wizard FlowAI, an expert in reading comprehension and key conceptual analysis.
Help the user break down complex academic topics, summarize study notes, and write outlines.
To help the user, you can recommend saving structured summaries as study notes. Format note suggestions on its own line:
[NOTE: Note Title | Subject Name | Content summary snippet]
Example: [NOTE: Big O Reference Sheet | Computer Science | Big O measures bounds for time complexity...]`,

  quiz: `You are Quiz Master FlowAI, a diagnostic self-testing assistant.
Help the user test their knowledge. Generate conceptual questions, active recall prompts, and multiple-choice questions.
Explain the concepts clearly after the user attempts them.
You can recommend creating a study review task:
[TASK: Task Title | Subject Name | priority (high/medium/low) | Estimated Pomodoros (number)]`
};

// Markdown to HTML Parser
function formatMarkdownToHtml(text) {
  if (!text) return '';
  
  let html = text.trim();
  
  // Parse code blocks with a clean container and copy button
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  html = html.replace(codeBlockRegex, (match, lang, code) => {
    const cleanCode = code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const displayLang = lang || 'code';
    const uniqueId = `code-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    return `
      <div class="ai-code-container">
        <div class="ai-code-header">
          <span>${displayLang.toUpperCase()}</span>
          <button type="button" class="btn-copy-code" data-target="${uniqueId}" style="background: transparent; border: none; color: #a6adc8; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
            <i data-lucide="copy" style="width: 12px; height: 12px;"></i> Copy
          </button>
        </div>
        <pre class="ai-code-pre"><code id="${uniqueId}">${cleanCode}</code></pre>
      </div>
    `;
  });

  // Handle headers
  html = html.replace(/^### (.*?)$/gm, '<h3 style="margin: 10px 0 6px 0; font-weight: 600; color: var(--text-primary); font-size: 14px;">$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2 style="margin: 12px 0 8px 0; font-weight: 600; color: var(--text-primary); font-size: 16px;">$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1 style="margin: 16px 0 10px 0; font-weight: 700; color: var(--text-primary); font-size: 18px;">$1</h1>');

  // Handle bold and italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');

  // Handle inline code
  html = html.replace(/`(.*?)`/g, '<code style="background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>');

  // Parse Actionable tasks [TASK: Title | Subject | Priority | Pomos]
  const taskRegex = /\[TASK:\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(high|medium|low)\s*\|\s*(\d+)\s*\]/gi;
  html = html.replace(taskRegex, (match, title, subject, priority, pomos) => {
    return `
      <div class="ai-interactive-card">
        <div>
          <strong style="color: var(--accent-primary); display: flex; align-items: center; gap: 4px;"><i data-lucide="check-square" style="width: 14px; height: 14px;"></i> Suggestion: Add Task</strong>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-secondary); font-weight: 500;">"${title}" (${subject} - ${priority} priority)</p>
        </div>
        <button type="button" class="btn btn-primary btn-add-suggested-task" data-title="${title}" data-subject="${subject}" data-priority="${priority}" data-pomos="${pomos}" style="font-size: 11px; padding: 6px 12px; height: 30px; min-height: auto; border-radius: var(--radius-sm);">
          Add to Board
        </button>
      </div>
    `;
  });

  // Parse Actionable notes [NOTE: Title | Subject | Content]
  const noteRegex = /\[NOTE:\s*(.*?)\s*\|\s*(.*?)\s*\|\s*([\s\S]*?)\s*\]/gi;
  html = html.replace(noteRegex, (match, title, subject, content) => {
    return `
      <div class="ai-interactive-card">
        <div>
          <strong style="color: var(--accent-secondary); display: flex; align-items: center; gap: 4px;"><i data-lucide="file-text" style="width: 14px; height: 14px;"></i> Suggestion: Draft Note</strong>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-secondary); font-weight: 500;">Create notebook page: "${title}"</p>
        </div>
        <button type="button" class="btn btn-primary btn-add-suggested-note" data-title="${title}" data-subject="${subject}" data-content="${content}" style="font-size: 11px; padding: 6px 12px; height: 30px; min-height: auto; border-radius: var(--radius-sm); background: linear-gradient(135deg, var(--accent-secondary), var(--accent-primary)); border: none;">
          Create Note
        </button>
      </div>
    `;
  });

  // Handle bullet lists
  const lines = html.split('\n');
  let inList = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const content = line.substring(2);
      if (!inList) {
        lines[i] = '<ul style="padding-left: 18px; margin: 8px 0; display: flex; flex-direction: column; gap: 4px;"><li>' + content + '</li>';
        inList = true;
      } else {
        lines[i] = '<li>' + content + '</li>';
      }
    } else {
      if (inList) {
        lines[i-1] = lines[i-1] + '</ul>';
        inList = false;
      }
    }
  }
  if (inList) {
    lines[lines.length - 1] = lines[lines.length - 1] + '</ul>';
  }
  html = lines.join('\n');

  // Convert line breaks
  html = html.replace(/\n/g, '<br>');

  return html;
}

// Check Gemini API Status & Banner
export function checkGeminiStatus() {
  const state = getState();
  const settings = state.settings || {};
  const chatMessages = document.getElementById('ai-chat-messages');
  if (!chatMessages) return;

  const activeLabel = document.getElementById('ai-status-label');
  let banner = document.getElementById('gemini-status-banner');
  
  if (!settings.geminiApiKey) {
    if (activeLabel) {
      activeLabel.innerHTML = '⚠️ Offline Mode (Local)';
      activeLabel.style.color = 'var(--text-tertiary)';
    }
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'gemini-status-banner';
      banner.style.cssText = `
        background: rgba(255, 193, 7, 0.08);
        border: 1px dashed rgba(255, 193, 7, 0.25);
        color: var(--text-secondary);
        padding: 12px;
        border-radius: 8px;
        font-size: 12px;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        line-height: 1.4;
      `;
      banner.innerHTML = `
        <span style="font-size: 16px;">💡</span>
        <div>
          <strong>Offline Mode:</strong> FlowAI is currently running in local fallback mode. 
          <a href="#" class="ai-view-link" data-tab-link="settings" style="color: var(--accent-secondary); text-decoration: underline; font-weight: 600;">
            Add a Gemini API Key in Settings
          </a> to unlock live AI coaching.
        </div>
      `;
      chatMessages.insertBefore(banner, chatMessages.firstChild);
    }
  } else {
    if (activeLabel) {
      activeLabel.innerHTML = `<span class="pulse-dot" style="width: 6px; height: 6px; border-radius: 50%; background: var(--priority-low); display: inline-block; animation: pulse 2s infinite;"></span> Live Gemini Mode`;
      activeLabel.style.color = 'var(--priority-low)';
    }
    if (banner) {
      banner.remove();
    }
  }
}

// Generate Offline Rule-based Fallbacks
function generateOfflineResponse(prompt) {
  const query = prompt.toLowerCase();
  
  if (query.includes('plan') || query.includes('suggest plan')) {
    return `
      <div>
        <p>I've structured a study plan for you today. Let's add it to your tasks:</p>
        [TASK: Complete Calculus Formulas Review | Mathematics | high | 2]
        [TASK: Draft CS Algorithm Outline | Computer Science | medium | 3]
      </div>
    `;
  }
  
  if (query.includes('breakdown') || query.includes('break down')) {
    return `
      <div>
        <p>Here is a structured breakdown for your active planner task:</p>
        [TASK: Outline & Prep Resources | General | medium | 1]
        [TASK: Core drafting & implementation | General | medium | 2]
      </div>
    `;
  }

  if (query.includes('audit')) {
    const stats = getTodayStats();
    return `
      <div>
        <h4 style="margin: 0 0 6px 0; color: var(--accent-primary);">📊 Local Study Audit:</h4>
        <ul style="padding-left: 18px; margin: 6px 0; display: flex; flex-direction: column; gap: 4px;">
          <li>⏱️ <strong>Focus logged:</strong> ${stats.focusMinutes} minutes today</li>
          <li>🔥 <strong>Streak:</strong> ${stats.streak} day(s) active</li>
          <li>✅ <strong>Planner task count:</strong> ${stats.totalTasks} total</li>
        </ul>
        <p style="margin-top: 6px; font-style: italic;">Need more specialized planning? [TASK: Plan next study sprint | General | low | 1]</p>
      </div>
    `;
  }

  if (query.includes('note') || query.includes('draft')) {
    return `
      <div>
        <p>I can draft a structured notebook page for you here. Click the button to create it:</p>
        [NOTE: Big O Complexity Sheet | Computer Science | time classifications include: O(1) constant, O(log n) logarithmic, O(n) linear, O(n log n) linearithmic.]
      </div>
    `;
  }

  if (query.includes('quiz') || query.includes('test')) {
    return `
      <div>
        <p><strong>Quiz Master:</strong> Let's test your general knowledge!</p>
        <p style="margin-top: 4px; font-weight: bold;">Q: What is the average time complexity of Quick Sort?</p>
        <p style="margin-top: 4px; font-style: italic; color: var(--text-tertiary);">1. O(n log n)  |  2. O(n²)  |  3. O(n)</p>
        <p style="margin-top: 6px; font-size: 11px;">Type "1" or "O(n log n)" to answer.</p>
      </div>
    `;
  }

  return `
    <div>
      <p>Hey! I am running in Offline Mode. I can help with general study tools:</p>
      <ul style="padding-left: 18px; margin: 6px 0; display: flex; flex-direction: column; gap: 4px;">
        <li>Type "plan" to suggest a structured task list</li>
        <li>Type "audit" to see performance metrics</li>
        <li>Type "draft" to create notebook pages</li>
      </ul>
      <p style="margin-top: 6px; font-size: 11px; color: var(--text-tertiary);">Provide a Gemini API Key in Settings to get real-time advanced conversational answers.</p>
    </div>
  `;
}

// Sidebar Chats Management
export function renderChatsList() {
  const listContainer = document.getElementById('ai-history-list');
  if (!listContainer) return;

  const chats = getChats();
  listContainer.innerHTML = '';

  if (chats.length === 0) {
    listContainer.innerHTML = `<div style="font-size: 12px; color: var(--text-tertiary); text-align: center; margin-top: 20px;">No recent chats.</div>`;
    return;
  }

  chats.forEach(thread => {
    const activeClass = thread.id === activeThreadId ? 'active' : '';
    const item = document.createElement('div');
    item.className = `chat-thread-btn ${activeClass}`;
    item.setAttribute('data-id', thread.id);
    
    // Icon based on persona
    let iconName = 'graduation-cap';
    if (thread.persona === 'wizard') iconName = 'file-text';
    if (thread.persona === 'quiz') iconName = 'help-circle';

    item.innerHTML = `
      <i data-lucide="${iconName}" style="width: 14px; height: 14px; flex-shrink:0;"></i>
      <span class="chat-thread-title">${thread.title || 'New Chat'}</span>
      <div class="chat-thread-actions">
        <button class="chat-thread-action-icon btn-rename-chat" data-id="${thread.id}" title="Rename chat">
          <i data-lucide="edit-2" style="width: 12px; height: 12px;"></i>
        </button>
        <button class="chat-thread-action-icon btn-delete-chat" data-id="${thread.id}" title="Delete chat">
          <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
        </button>
      </div>
    `;

    // Click handler to load thread
    item.addEventListener('click', (e) => {
      if (e.target.closest('.chat-thread-actions')) return;
      switchThread(thread.id);
    });

    listContainer.appendChild(item);
  });

  if (typeof lucide !== 'undefined') {
    lucide.createIcons({ attrs: { class: 'lucide-icon' } });
  }
}

function createNewThread() {
  const settings = getState().settings || {};
  const newThread = {
    id: `thread-${Date.now()}`,
    title: 'New Chat',
    persona: 'coach',
    model: settings.geminiModel || 'gemini-2.5-flash',
    messages: []
  };

  saveChatThread(newThread);
  activeThreadId = newThread.id;
  
  // Re-sync selector elements
  syncHeaderControls(newThread);
  renderChatsList();
  renderChatMessages();
}

function switchThread(threadId) {
  const chats = getChats();
  const thread = chats.find(c => c.id === threadId);
  if (!thread) return;

  activeThreadId = threadId;
  syncHeaderControls(thread);
  renderChatsList();
  renderChatMessages();
}

function syncHeaderControls(thread) {
  // Model selector dropdown
  const modelSelect = document.getElementById('ai-model-select');
  if (modelSelect) modelSelect.value = thread.model || 'gemini-2.5-flash';

  // Persona buttons
  document.querySelectorAll('#ai-persona-selector .persona-chip').forEach(btn => {
    if (btn.getAttribute('data-persona') === thread.persona) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Title
  const titleEl = document.getElementById('ai-current-title');
  if (titleEl) titleEl.textContent = thread.title || 'New Chat';
}

function deleteThread(threadId) {
  deleteChatThread(threadId);
  
  const chats = getChats();
  if (chats.length > 0) {
    activeThreadId = chats[chats.length - 1].id;
  } else {
    activeThreadId = null;
    createNewThread();
    return;
  }

  renderChatsList();
  const nextThread = chats.find(c => c.id === activeThreadId);
  if (nextThread) syncHeaderControls(nextThread);
  renderChatMessages();
}

function renameThread(threadId) {
  const chats = getChats();
  const thread = chats.find(c => c.id === threadId);
  if (!thread) return;

  const currentTitle = thread.title || 'New Chat';
  const newTitle = prompt('Enter a new title for this chat thread:', currentTitle);
  
  if (newTitle !== null && newTitle.trim()) {
    thread.title = newTitle.trim();
    saveChatThread(thread);
    
    if (activeThreadId === threadId) {
      const titleEl = document.getElementById('ai-current-title');
      if (titleEl) titleEl.textContent = thread.title;
    }
    
    renderChatsList();
  }
}

// Render Messages & Welcome Cards
function renderChatMessages() {
  const container = document.getElementById('ai-chat-messages');
  if (!container) return;

  container.innerHTML = '';
  
  // Render warning banner first
  checkGeminiStatus();

  const chats = getChats();
  const thread = chats.find(c => c.id === activeThreadId);
  if (!thread || thread.messages.length === 0) {
    // Render Welcome Suggestions grid
    const welcomeDiv = document.createElement('div');
    welcomeDiv.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      margin: auto;
      max-width: 600px;
      padding: 20px 0;
    `;
    
    const persona = thread ? thread.persona : 'coach';
    const suggestions = SUGGESTIONS[persona] || SUGGESTIONS.coach;

    welcomeDiv.innerHTML = `
      <div style="width: 52px; height: 52px; border-radius: 50%; background: rgba(108, 92, 231, 0.1); color: var(--accent-primary); display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
        <i data-lucide="sparkles" style="width: 24px; height: 24px;"></i>
      </div>
      <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 6px 0; color: var(--text-primary);">How can FlowAI help you today?</h2>
      <p style="font-size: 13px; color: var(--text-tertiary); max-width: 420px; line-height: 1.5; margin: 0 0 20px 0;">
        Choose a persona in the header above or click one of the suggested prompts below to start:
      </p>
      <div class="welcome-grid">
        ${suggestions.map((card, idx) => `
          <button type="button" class="suggestion-card" data-prompt="${card.prompt}">
            <h4>${card.title}</h4>
            <p>${card.desc}</p>
          </button>
        `).join('')}
      </div>
    `;

    container.appendChild(welcomeDiv);
    
    // Bind click listeners for suggestion cards
    welcomeDiv.querySelectorAll('.suggestion-card').forEach(card => {
      card.addEventListener('click', () => {
        const textPrompt = card.getAttribute('data-prompt');
        const chatInput = document.getElementById('ai-chat-input');
        if (chatInput) {
          chatInput.value = textPrompt;
          document.getElementById('ai-chat-form').dispatchEvent(new Event('submit'));
        }
      });
    });
  } else {
    // Loop through existing chat history
    thread.messages.forEach(msg => {
      appendMessageBubble(msg.role, msg.parts[0].text);
    });
  }

  container.scrollTop = container.scrollHeight;
  if (typeof lucide !== 'undefined') {
    lucide.createIcons({ attrs: { class: 'lucide-icon' } });
  }
}

function appendMessageBubble(sender, text) {
  const messages = document.getElementById('ai-chat-messages');
  if (!messages) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-message ${sender}`;
  
  if (sender === 'ai' || sender === 'model') {
    msgDiv.innerHTML = formatMarkdownToHtml(text);
  } else {
    msgDiv.textContent = text;
  }

  messages.appendChild(msgDiv);
  messages.scrollTop = messages.scrollHeight;

  if (typeof lucide !== 'undefined') {
    lucide.createIcons({ attrs: { class: 'lucide-icon' } });
  }
}

function showTyping(show) {
  const indicator = document.getElementById('ai-typing-indicator');
  const messages = document.getElementById('ai-chat-messages');
  if (indicator && messages) {
    indicator.style.display = show ? 'block' : 'none';
    messages.scrollTop = messages.scrollHeight;
  }
}

export function initAI() {
  const chatForm = document.getElementById('ai-chat-form');
  const chatInput = document.getElementById('ai-chat-input');
  const chatMessages = document.getElementById('ai-chat-messages');

  if (!chatForm || !chatInput || !chatMessages) return;

  // Initialize Threads State
  const chats = getChats();
  if (chats.length > 0) {
    activeThreadId = chats[chats.length - 1].id;
    const activeThread = chats.find(c => c.id === activeThreadId);
    if (activeThread) syncHeaderControls(activeThread);
  } else {
    createNewThread();
  }

  // Render Sidebar Chats List
  renderChatsList();
  renderChatMessages();

  // Input textarea styling and auto-grow event
  chatInput.style.overflowY = 'hidden';
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  // Support Shift+Enter for new line, Enter to submit
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit'));
    }
  });

  // Submit Handler
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const prompt = chatInput.value.trim();
    if (!prompt) return;

    // Send user message bubble
    appendMessageBubble('user', prompt);
    chatInput.value = '';
    chatInput.style.height = '40px'; // Reset height

    const chatsList = getChats();
    const thread = chatsList.find(c => c.id === activeThreadId);
    if (!thread) return;

    // Record user message in thread state
    thread.messages.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    // Rename chat title if it was default 'New Chat'
    if (thread.title === 'New Chat') {
      thread.title = prompt.length > 22 ? prompt.substring(0, 20) + '...' : prompt;
      saveChatThread(thread);
      renderChatsList();
      syncHeaderControls(thread);
    }

    const state = getState();
    const settings = state.settings || {};

    if (settings.geminiApiKey) {
      showTyping(true);
      
      const key = settings.geminiApiKey;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${thread.model}:generateContent?key=${key}`;
      
      const systemInstruction = PERSONA_PROMPTS[thread.persona] || PERSONA_PROMPTS.coach;
      const requestBody = {
        contents: thread.messages,
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        }
      };

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })
      .then(async (response) => {
        showTyping(false);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errMsg = errorData.error?.message || response.statusText || 'Unknown API Error';
          throw new Error(errMsg);
        }
        return response.json();
      })
      .then((data) => {
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
        
        // Save reply to state history
        thread.messages.push({
          role: 'model',
          parts: [{ text: replyText }]
        });
        saveChatThread(thread);

        appendMessageBubble('ai', replyText);

        // Update dashboard & planner UI if plan/breakdown was queried
        const query = prompt.toLowerCase();
        if (query.includes('plan') || query.includes('breakdown') || query.includes('break down')) {
          renderDashboard();
          renderPlanner();
        }
      })
      .catch((err) => {
        // Rollback state on error
        thread.messages.pop();
        saveChatThread(thread);

        const errBubble = `
          <div style="color: var(--priority-high); padding: 10px; border: 1px solid rgba(255,0,0,0.2); border-radius: 8px; background: rgba(255, 0, 0, 0.05); font-size: 12px; line-height: 1.4;">
            <p><strong>⚠️ Gemini API Error:</strong> Failed to fetch response. Please verify your API key and model settings in the Settings panel.</p>
            <p style="font-size: 11px; margin-top: 4px; opacity: 0.8;">Details: ${err.message}</p>
          </div>
        `;
        appendMessageBubble('ai', errBubble);
      });
    } else {
      // Offline fallback mode
      showTyping(true);
      setTimeout(() => {
        showTyping(false);
        const replyText = generateOfflineResponse(prompt);
        
        // Save reply to state history
        thread.messages.push({
          role: 'model',
          parts: [{ text: replyText }]
        });
        saveChatThread(thread);

        appendMessageBubble('ai', replyText);

        const query = prompt.toLowerCase();
        if (query.includes('plan') || query.includes('breakdown') || query.includes('break down')) {
          renderDashboard();
          renderPlanner();
        }
      }, 800);
    }
  });

  // New Chat Button Click
  const btnNewChat = document.getElementById('btn-new-chat');
  if (btnNewChat) {
    btnNewChat.addEventListener('click', () => {
      createNewThread();
    });
  }

  // Clear Chat Button Click
  const btnClearChat = document.getElementById('btn-clear-chat');
  if (btnClearChat) {
    btnClearChat.addEventListener('click', () => {
      const thread = chats.find(c => c.id === activeThreadId);
      if (thread) {
        thread.messages = [];
        saveChatThread(thread);
        renderChatMessages();
      }
    });
  }

  // Model Selector Select Change
  const modelSelect = document.getElementById('ai-model-select');
  if (modelSelect) {
    modelSelect.addEventListener('change', () => {
      const thread = chats.find(c => c.id === activeThreadId);
      if (thread) {
        thread.model = modelSelect.value;
        saveChatThread(thread);
      }
    });
  }

  // Persona Selector Click
  const personaSelector = document.getElementById('ai-persona-selector');
  if (personaSelector) {
    personaSelector.addEventListener('click', (e) => {
      const btn = e.target.closest('.persona-chip');
      if (btn) {
        const persona = btn.getAttribute('data-persona');
        const thread = chats.find(c => c.id === activeThreadId);
        if (thread) {
          thread.persona = persona;
          saveChatThread(thread);
          
          // Sync header visual state and suggest updates
          syncHeaderControls(thread);
          
          // Re-render empty welcome suggestion cards if no chat history
          if (thread.messages.length === 0) {
            renderChatMessages();
          } else {
            // Re-sync chips active class
            document.querySelectorAll('#ai-persona-selector .persona-chip').forEach(c => {
              c.classList.toggle('active', c === btn);
            });
          }
        }
      }
    });
  }

  // Delegate Sidebar Actions (Rename, Delete)
  const sidebarList = document.getElementById('ai-history-list');
  if (sidebarList) {
    sidebarList.addEventListener('click', (e) => {
      const btnRename = e.target.closest('.btn-rename-chat');
      if (btnRename) {
        const id = btnRename.getAttribute('data-id');
        renameThread(id);
        return;
      }

      const btnDelete = e.target.closest('.btn-delete-chat');
      if (btnDelete) {
        const id = btnDelete.getAttribute('data-id');
        if (confirm("Are you sure you want to delete this chat thread?")) {
          deleteThread(id);
        }
        return;
      }
    });
  }

  // Event Delegation for copy code, and suggested action triggers (tasks/notes)
  chatMessages.addEventListener('click', (e) => {
    // 1. Copy Code Button
    const btnCopy = e.target.closest('.btn-copy-code');
    if (btnCopy) {
      const targetId = btnCopy.getAttribute('data-target');
      const codeEl = document.getElementById(targetId);
      if (codeEl) {
        navigator.clipboard.writeText(codeEl.textContent)
          .then(() => {
            const originalText = btnCopy.innerHTML;
            btnCopy.innerHTML = '✓ Copied';
            btnCopy.style.color = 'var(--priority-low)';
            setTimeout(() => {
              btnCopy.innerHTML = originalText;
              btnCopy.style.color = '#a6adc8';
            }, 2000);
          })
          .catch(err => {
            console.error("Failed to copy code: ", err);
          });
      }
      return;
    }

    // 2. Add Suggested Task Card Trigger
    const btnAddTask = e.target.closest('.btn-add-suggested-task');
    if (btnAddTask) {
      const title = btnAddTask.getAttribute('data-title');
      const subject = btnAddTask.getAttribute('data-subject');
      const priority = btnAddTask.getAttribute('data-priority');
      const pomos = parseInt(btnAddTask.getAttribute('data-pomos')) || 1;

      addTask({
        title,
        subject,
        priority,
        status: 'todo',
        estimatedPomos: pomos,
        dueDate: new Date().toISOString().split('T')[0]
      });

      btnAddTask.textContent = '✓ Added to Board';
      btnAddTask.disabled = true;
      btnAddTask.style.background = 'var(--priority-low)';
      btnAddTask.style.color = '#fff';

      renderDashboard();
      renderPlanner();
      return;
    }

    // 3. Add Suggested Note Card Trigger
    const btnAddNote = e.target.closest('.btn-add-suggested-note');
    if (btnAddNote) {
      const title = btnAddNote.getAttribute('data-title');
      const subject = btnAddNote.getAttribute('data-subject');
      const content = btnAddNote.getAttribute('data-content');

      const page = addNotePage(title, subject);
      if (page && content) {
        page.blocks = [
          { id: `b-${Date.now()}-1`, type: 'h1', content: title },
          { id: `b-${Date.now()}-2`, type: 'callout', content: `💡 Created from FlowAI Chat Suggestion` },
          { id: `b-${Date.now()}-3`, type: 'text', content: content }
        ];
        saveState();
      }

      btnAddNote.textContent = '✓ Note Created';
      btnAddNote.disabled = true;
      btnAddNote.style.background = 'var(--priority-low)';
      btnAddNote.style.color = '#fff';

      // Switch to Notes workspace
      window.activePageId = page.id;
      switchTab('notes');
      return;
    }

    // 4. View Links
    const viewLink = e.target.closest('.ai-view-link');
    if (viewLink) {
      e.preventDefault();
      const tab = viewLink.getAttribute('data-tab-link');
      if (tab) switchTab(tab);
    }
  });
}
