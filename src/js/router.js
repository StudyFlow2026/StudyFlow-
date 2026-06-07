import { getState, saveState } from './state.js';

const routeCallbacks = {};

// Register callbacks to execute when views become active
export function registerRoute(viewName, callback) {
  routeCallbacks[viewName] = callback;
}

// Switch between views
export function switchTab(tabId) {
  // Update nav buttons
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update views
  const views = document.querySelectorAll('.app-view');
  views.forEach(view => {
    if (view.id === `view-${tabId}`) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });

  // Update header content
  updateHeader(tabId);

  // Trigger render callback if registered
  if (routeCallbacks[tabId] && typeof routeCallbacks[tabId] === 'function') {
    routeCallbacks[tabId]();
  }
}

// Update header titles based on view
function updateHeader(tabId) {
  const headerTitle = document.getElementById('header-title');
  const headerSubtitle = document.getElementById('header-subtitle');
  
  if (!headerTitle || !headerSubtitle) return;

  const today = new Date();
  const options = { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' };
  const formattedDate = today.toLocaleDateString('en-US', options);

  switch (tabId) {
    case 'dashboard':
      headerTitle.textContent = 'Welcome back, Scholar';
      headerSubtitle.textContent = formattedDate;
      break;
    case 'planner':
      headerTitle.textContent = 'Study Planner & Kanban';
      headerSubtitle.textContent = 'Organize, schedule, and track tasks';
      break;
    case 'timer':
      headerTitle.textContent = 'Immersive Focus Room';
      headerSubtitle.textContent = 'Tune out distractions and dive deep';
      break;
    case 'notes':
      headerTitle.textContent = 'Block Notes Workspace';
      headerSubtitle.textContent = 'Document learning, research, and summaries';
      break;
    case 'analytics':
      headerTitle.textContent = 'Productivity Analytics';
      headerSubtitle.textContent = 'Visualize streaks, performance, and trends';
      break;
    case 'friends':
      headerTitle.textContent = 'WhatsApp Chat Room';
      headerSubtitle.textContent = 'Connect and collaborate with classmates';
      break;
    case 'ai':
      headerTitle.textContent = 'FlowAI Study Assistant';
      headerSubtitle.textContent = 'Brainstorm study plans, audit productivity, and test your knowledge';
      break;
    default:
      headerTitle.textContent = 'StudyFlow';
      headerSubtitle.textContent = formattedDate;
  }
}

// Initialize navigation listeners
export function initRouter() {
  // Side bar navigation clicks
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // Theme option clicks
  document.querySelectorAll('.theme-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const selectedTheme = opt.getAttribute('data-theme');
      
      // Update buttons active class
      document.querySelectorAll('.theme-opt').forEach(b => b.classList.remove('active'));
      opt.classList.add('active');
      
      // Set attribute on html element
      document.documentElement.setAttribute('data-theme', selectedTheme);
      
      // Update state settings
      const state = getState();
      if (state && state.settings) {
        state.settings.theme = selectedTheme;
        saveState();
      }
    });
  });

  // Handle direct navigation link triggers (e.g. view-all-link clicks)
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-tab-link]');
    if (link) {
      e.preventDefault();
      const tabId = link.getAttribute('data-tab-link');
      switchTab(tabId);
    }
  });

  // Default home page
  switchTab('dashboard');
}
