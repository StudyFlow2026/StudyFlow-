// State Management for StudyFlow with Multi-User Profile Support

const STORAGE_KEY = 'studyflow_app_state_multiuser';

// Encryption and Decryption Utilities using RC4 stream cipher and Hex encoding
const ENCRYPTION_KEY = 'StudyFlow_Secure_State_Key_2026';

function encrypt(str) {
  if (!str) return '';
  let s = [], j = 0, x, res = '';
  for (let i = 0; i < 256; i++) {
    s[i] = i;
  }
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)) % 256;
    x = s[i]; s[i] = s[j]; s[j] = x;
  }
  let i = 0;
  j = 0;
  for (let y = 0; y < str.length; y++) {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    x = s[i]; s[i] = s[j]; s[j] = x;
    res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
  }
  // Convert res to hex
  let hex = '';
  for (let idx = 0; idx < res.length; idx++) {
    hex += res.charCodeAt(idx).toString(16).padStart(2, '0');
  }
  return hex;
}

export function decrypt(hex) {
  if (!hex) return '';
  // Convert hex to str
  let str = '';
  for (let idx = 0; idx < hex.length; idx += 2) {
    str += String.fromCharCode(parseInt(hex.substr(idx, 2), 16));
  }
  let s = [], j = 0, x, res = '';
  for (let i = 0; i < 256; i++) {
    s[i] = i;
  }
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)) % 256;
    x = s[i]; s[i] = s[j]; s[j] = x;
  }
  let i = 0;
  j = 0;
  for (let y = 0; y < str.length; y++) {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    x = s[i]; s[i] = s[j]; s[j] = x;
    res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
  }
  return res;
}

// Global Storage overrides for transparent client-side encryption
const originalGetItem = Storage.prototype.getItem;
const originalSetItem = Storage.prototype.setItem;

Storage.prototype.setItem = function(key, value) {
  if (key === STORAGE_KEY) {
    const encrypted = encrypt(value);
    const envelope = JSON.stringify({ encryptedData: encrypted });
    originalSetItem.call(this, key, envelope);
  } else {
    originalSetItem.call(this, key, value);
  }
};

Storage.prototype.getItem = function(key) {
  const value = originalGetItem.call(this, key);
  if (key === STORAGE_KEY && value) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && parsed.encryptedData) {
        return decrypt(parsed.encryptedData);
      }
    } catch (e) {
      // Fallback if it was saved as plaintext
    }
  }
  return value;
};

// Default State Templates for newly registered users
const DEFAULT_STATE = {
  tasks: [],
  sessions: [],
  notes: [],
  friends: [],
  chats: [],
  settings: {
    theme: 'dark',
    pomodoroTime: 25,
    shortBreakTime: 5,
    longBreakTime: 15,
    dailyGoalMinutes: 120,
    autoStart: false,
    ambientSoundEnabled: true,
    strictFocusEnabled: false,
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash'
  }
};

// Global multi-user wrapper state
let wrapperState = {
  users: [],
  activeUser: null
};

// Currently loaded single user workspace data
let appState = {
  tasks: [],
  sessions: [],
  notes: [],
  friends: [],
  settings: { ...DEFAULT_STATE.settings }
};

// Helper to calculate dates relative to today
function getRelativeDateString(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

// Load state from local storage
export function loadState() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      wrapperState = JSON.parse(data);
      wrapperState.users = wrapperState.users || [];
      
      // Determine session user based on stay-signed-in settings
      const transientUser = sessionStorage.getItem('studyflow_session_user');
      if (transientUser) {
        wrapperState.activeUser = transientUser;
      } else {
        const staySignedIn = localStorage.getItem('studyflow_stay_signed_in') === 'true';
        if (!staySignedIn) {
          wrapperState.activeUser = null;
        } else if (wrapperState.activeUser) {
          sessionStorage.setItem('studyflow_session_user', wrapperState.activeUser);
        }
      }

      if (wrapperState.activeUser) {
        const user = wrapperState.users.find(u => u.username && wrapperState.activeUser && u.username.toLowerCase() === wrapperState.activeUser.toLowerCase());
        if (user) {
          appState = user.state;
          // Fallback merges
          appState.tasks = appState.tasks || [];
          appState.sessions = appState.sessions || [];
          appState.notes = appState.notes || [];
          appState.friends = appState.friends || [];
          appState.chats = appState.chats || [];
          appState.settings = { ...DEFAULT_STATE.settings, ...appState.settings };
        } else {
          // Active user not found in list (corruption fallback)
          wrapperState.activeUser = null;
          clearAppState();
        }
      } else {
        clearAppState();
      }
    } else {
      wrapperState = { users: [], activeUser: null };
      clearAppState();
      saveState();
    }
  } catch (e) {
    console.error("Error reading localStorage, reverting to defaults", e);
    clearAppState();
  }
  return appState;
}

function clearAppState() {
  appState = {
    tasks: [],
    sessions: [],
    notes: [],
    friends: [],
    chats: [],
    settings: { ...DEFAULT_STATE.settings }
  };
}

// Save state back to local storage
export function saveState() {
  try {
    if (wrapperState.activeUser) {
      const user = wrapperState.users.find(u => u.username && wrapperState.activeUser && u.username.toLowerCase() === wrapperState.activeUser.toLowerCase());
      if (user) {
        user.state = appState;
        user.lastModified = Date.now();
      }
    }
    const staySignedIn = localStorage.getItem('studyflow_stay_signed_in') !== 'false';
    const stateToSave = { ...wrapperState };
    if (!staySignedIn) {
      stateToSave.activeUser = null;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    syncPushToServer();
  } catch (e) {
    console.error("Failed to write to localStorage", e);
  }
}

// Push local state to server API endpoint for synchronization
export async function syncPushToServer() {
  try {
    const data = originalGetItem.call(localStorage, STORAGE_KEY);
    if (!data) return;
    await fetch(getApiUrl('/api/sync'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: data
    });
  } catch (e) {
    // Fail silently if server is offline or unreachable
  }
}

// Pull server database state and perform cross-origin data merge
export async function syncPullAndMerge() {
  try {
    const response = await fetch(getApiUrl('/api/sync'));
    if (!response.ok) return;
    const serverStateEnvelope = await response.json();
    if (!serverStateEnvelope) return;

    let serverState;
    if (serverStateEnvelope.encryptedData) {
      try {
        serverState = JSON.parse(decrypt(serverStateEnvelope.encryptedData));
      } catch (e) {
        console.error("Failed to decrypt server state during sync", e);
        return { changed: false, activeUserChanged: false };
      }
    } else {
      serverState = serverStateEnvelope; // Fallback to plaintext if server database is not yet encrypted
    }
    
    if (!serverState || !Array.isArray(serverState.users)) return { changed: false, activeUserChanged: false };
    
    const localData = localStorage.getItem(STORAGE_KEY);
    const localState = localData ? JSON.parse(localData) : { users: [], activeUser: null };
    localState.users = localState.users || [];
    
    const mergedUsers = [];
    const localUsersMap = new Map(localState.users.map(u => [u.username.toLowerCase(), u]));
    const serverUsersMap = new Map(serverState.users.map(u => [u.username.toLowerCase(), u]));
    
    const allUsernames = new Set([
      ...localUsersMap.keys(),
      ...serverUsersMap.keys()
    ]);
    
    let changed = false;
    let activeUserChanged = false;
    
    for (const username of allUsernames) {
      const localUser = localUsersMap.get(username);
      const serverUser = serverUsersMap.get(username);
      
      if (localUser && serverUser) {
        const localTime = localUser.lastModified || 0;
        const serverTime = serverUser.lastModified || 0;
        
        if (serverTime > localTime) {
          mergedUsers.push(serverUser);
          changed = true;
        } else {
          mergedUsers.push(localUser);
          if (localTime > serverTime) {
            changed = true;
          }
        }
      } else if (localUser) {
        mergedUsers.push(localUser);
        changed = true;
      } else if (serverUser) {
        mergedUsers.push(serverUser);
        changed = true;
      }
    }
    
    let mergedActiveUser = localState.activeUser;
    if (!mergedActiveUser && serverState.activeUser) {
      const activeUserExists = mergedUsers.some(u => u.username.toLowerCase() === serverState.activeUser.toLowerCase());
      if (activeUserExists) {
        mergedActiveUser = serverState.activeUser;
        changed = true;
        activeUserChanged = true;
      }
    }
    
    if (changed) {
      localState.users = mergedUsers;
      localState.activeUser = mergedActiveUser;
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localState));
      
      // Push merged state back to server (send raw encrypted envelope)
      const rawData = originalGetItem.call(localStorage, STORAGE_KEY);
      await fetch(getApiUrl('/api/sync'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: rawData
      });
      
      // Reload active state in memory
      wrapperState = localState;
      if (wrapperState.activeUser) {
        const user = wrapperState.users.find(u => u.username && wrapperState.activeUser && u.username.toLowerCase() === wrapperState.activeUser.toLowerCase());
        if (user) {
          appState = user.state;
        }
      }
      return { changed: true, activeUserChanged };
    }
    return { changed: false, activeUserChanged: false };
  } catch (e) {
    // Fail silently if server is offline or unreachable
    return { changed: false, activeUserChanged: false };
  }
}


export function getState() {
  return appState;
}

export function getActiveUser() {
  return wrapperState.activeUser;
}

export function getActiveUserEmail() {
  if (!wrapperState.activeUser) return "";
  const user = wrapperState.users.find(u => u.username && wrapperState.activeUser && u.username.toLowerCase() === wrapperState.activeUser.toLowerCase());
  return user ? user.email : "";
}

/* MULTI-USER AUTH ACTIONS */

function fallbackSha256(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  
  const maxWord = Math.pow(2, 32);
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  // Convert string to UTF-8 array/bytes
  const utf8 = [];
  for (let idx = 0; idx < ascii.length; idx++) {
    let charcode = ascii.charCodeAt(idx);
    if (charcode < 0x80) utf8.push(charcode);
    else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 
                0x80 | (charcode & 0x3f));
    }
    else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.push(0xe0 | (charcode >> 12), 
                0x80 | ((charcode>>6) & 0x3f), 
                0x80 | (charcode & 0x3f));
    }
    else {
      idx++;
      charcode = 0x10000 + (((charcode & 0x3ff)<<10)
                | (ascii.charCodeAt(idx) & 0x3ff));
      utf8.push(0xf0 | (charcode >> 18), 
                0x80 | ((charcode>>12) & 0x3f), 
                0x80 | ((charcode>>6) & 0x3f), 
                0x80 | (charcode & 0x3f));
    }
  }

  const msgLenBits = utf8.length * 8;
  utf8.push(0x80);
  
  // Pad with 0s until length is congruent to 56 mod 64
  while ((utf8.length % 64) !== 56) {
    utf8.push(0);
  }
  
  // Append original length in bits as a 64-bit big-endian integer
  const lengthBuffer = new ArrayBuffer(8);
  const view = new DataView(lengthBuffer);
  view.setUint32(0, Math.floor(msgLenBits / maxWord));
  view.setUint32(4, msgLenBits % maxWord);
  
  for (let idx = 0; idx < 8; idx++) {
    utf8.push(view.getUint8(idx));
  }
  
  // Now process in 512-bit chunks (64 bytes each)
  const chunks = utf8.length / 64;
  
  for (let chunkIdx = 0; chunkIdx < chunks; chunkIdx++) {
    const w = new Uint32Array(64);
    const chunkOffset = chunkIdx * 64;
    
    // First 16 words of chunk
    for (let idx = 0; idx < 16; idx++) {
      w[idx] = (utf8[chunkOffset + idx*4] << 24) |
               (utf8[chunkOffset + idx*4 + 1] << 16) |
               (utf8[chunkOffset + idx*4 + 2] << 8) |
               (utf8[chunkOffset + idx*4 + 3]);
    }
    
    // Extend the remaining words
    for (let idx = 16; idx < 64; idx++) {
      const s0 = rightRotate(w[idx-15], 7) ^ rightRotate(w[idx-15], 18) ^ (w[idx-15] >>> 3);
      const s1 = rightRotate(w[idx-2], 17) ^ rightRotate(w[idx-2], 19) ^ (w[idx-2] >>> 10);
      w[idx] = (w[idx-16] + s0 + w[idx-7] + s1) | 0;
    }
    
    // Initialize working variables
    let [a, b, c, d, e, f, g, h] = hash;
    
    // Compression loop
    for (let idx = 0; idx < 64; idx++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[idx] + w[idx]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      
      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    
    // Add chunk's hash to result
    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }
  
  // Format as hex string
  return hash.map(h => (h >>> 0).toString(16).padStart(8, '0')).join('');
}

async function hashPassword(password) {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(password);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (e) {
      console.warn("Web Crypto SHA-256 failed, falling back to pure JS implementation", e);
    }
  }
  return fallbackSha256(password);
}


export function isUsernameTaken(username) {
  const cleanName = username.trim();
  return wrapperState.users.some(u => u.username.toLowerCase() === cleanName.toLowerCase());
}

export async function registerUser(username, password, email) {
  const cleanName = username.trim();
  if (!cleanName) {
    return { success: false, message: 'Username cannot be blank.' };
  }
  
  // Check duplicate
  const exists = wrapperState.users.some(u => u.username.toLowerCase() === cleanName.toLowerCase());
  if (exists) {
    return { success: false, message: 'Username already registered.' };
  }

  // Create a deep copy of template states for new user
  const initialUserState = JSON.parse(JSON.stringify(DEFAULT_STATE));

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Add user
  wrapperState.users.push({
    username: cleanName,
    password: hashedPassword,
    email: email.trim(),
    state: initialUserState,
    lastModified: Date.now()
  });
  
  wrapperState.activeUser = cleanName;
  localStorage.setItem('studyflow_stay_signed_in', 'true');
  sessionStorage.setItem('studyflow_session_user', cleanName);
  appState = initialUserState;
  saveState();

  return { success: true };
}

export function verifyUserCredentials(username, email) {
  const user = wrapperState.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
  if (!user) {
    return { success: false, message: 'Username is not registered.' };
  }
  if (!user.email || user.email.toLowerCase() !== email.trim().toLowerCase()) {
    return { success: false, message: 'Email address does not match this username.' };
  }
  return { success: true, user };
}

export async function resetUserPassword(username, newPassword) {
  const user = wrapperState.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
  if (!user) {
    return { success: false, message: 'User not found.' };
  }
  const hashedPassword = await hashPassword(newPassword);
  user.password = hashedPassword;
  
  // Log the user in
  wrapperState.activeUser = user.username;
  localStorage.setItem('studyflow_stay_signed_in', 'true');
  sessionStorage.setItem('studyflow_session_user', user.username);
  appState = user.state;
  saveState();
  
  return { success: true };
}

export async function loginUser(username, password, staySignedIn = false) {
  const cleanName = username.trim();
  
  if (wrapperState.users.length === 0) {
    return { 
      success: false, 
      message: 'No registered accounts found in this browser context. Please click the "Sign Up" tab above to create your profile first.' 
    };
  }

  const user = wrapperState.users.find(u => u.username.toLowerCase() === cleanName.toLowerCase());
  
  if (!user) {
    return { success: false, message: 'Invalid username or password.' };
  }

  const hashedPassword = await hashPassword(password);
  
  // Check if stored password is a SHA-256 hash (64 hex characters)
  const isHashed = /^[a-f0-9]{64}$/i.test(user.password);
  
  if (isHashed) {
    if (user.password.toLowerCase() !== hashedPassword.toLowerCase()) {
      return { success: false, message: 'Invalid username or password.' };
    }
  } else {
    // Old plaintext account fallback
    if (user.password !== password) {
      return { success: false, message: 'Invalid username or password.' };
    }
    // Auto-migrate to hashed password
    user.password = hashedPassword;
    saveState();
  }

  wrapperState.activeUser = user.username;
  localStorage.setItem('studyflow_stay_signed_in', staySignedIn ? 'true' : 'false');
  sessionStorage.setItem('studyflow_session_user', user.username);
  appState = user.state;
  saveState();

  return { success: true };
}

export function logoutUser() {
  saveState(); // save workspace
  wrapperState.activeUser = null;
  localStorage.removeItem('studyflow_stay_signed_in');
  sessionStorage.removeItem('studyflow_session_user');
  clearAppState();
  saveState();
}

export async function updateActiveUserProfile(email) {
  const activeUser = wrapperState.activeUser;
  if (!activeUser) {
    return { success: false, message: 'No active session found.' };
  }

  const user = wrapperState.users.find(u => u.username && activeUser && u.username.toLowerCase() === activeUser.toLowerCase());
  if (!user) {
    return { success: false, message: 'User profile not found.' };
  }

  // Update email
  if (email && email.trim() !== '') {
    user.email = email.trim();
  }

  saveState();
  return { success: true };
}

/* TASKS ACTIONS */
export function addTask(taskData) {
  const newTask = {
    id: `task-${Date.now()}`,
    title: taskData.title || 'New Task',
    subject: taskData.subject || 'General',
    priority: taskData.priority || 'medium',
    status: taskData.status || 'todo',
    estimatedPomos: parseInt(taskData.estimatedPomos) || 2,
    completedPomos: 0,
    dueDate: taskData.dueDate || '',
    createdAt: new Date().toISOString()
  };
  appState.tasks.push(newTask);
  saveState();
  return newTask;
}

export function updateTask(taskId, updatedFields) {
  const taskIndex = appState.tasks.findIndex(t => t.id === taskId);
  if (taskIndex !== -1) {
    appState.tasks[taskIndex] = { ...appState.tasks[taskIndex], ...updatedFields };
    saveState();
    return appState.tasks[taskIndex];
  }
  return null;
}

export function deleteTask(taskId) {
  appState.tasks = appState.tasks.filter(t => t.id !== taskId);
  // Also unbind any notes or sessions linked
  appState.sessions.forEach(s => {
    if (s.taskId === taskId) s.taskId = null;
  });
  saveState();
}

/* SESSION TIMER ACTIONS */
export function addSession(sessionData) {
  const newSession = {
    id: `sess-${Date.now()}`,
    taskId: sessionData.taskId || null,
    taskTitle: sessionData.taskTitle || 'General Focus',
    duration: parseInt(sessionData.duration) || 25,
    date: getRelativeDateString(0),
    timestamp: Date.now(),
    type: sessionData.type || 'pomodoro',
    score: parseInt(sessionData.score) || 100
  };
  
  appState.sessions.push(newSession);
  
  // If tied to a task, increment completed Pomos
  if (sessionData.taskId && sessionData.type === 'pomodoro') {
    const task = appState.tasks.find(t => t.id === sessionData.taskId);
    if (task) {
      task.completedPomos = (task.completedPomos || 0) + 1;
    }
  }
  
  saveState();
  return newSession;
}

export function clearHistory() {
  appState.sessions = [];
  appState.tasks.forEach(t => t.completedPomos = 0);
  saveState();
}

/* NOTE WORKSPACE ACTIONS */
export function addNotePage(title, subject = 'General') {
  const newPage = {
    id: `page-${Date.now()}`,
    title: title || 'Untitled Page',
    subject: subject || 'General',
    updatedAt: new Date().toISOString(),
    blocks: [
      { id: `b-${Date.now()}-1`, type: 'text', content: '', placeholder: 'Press / for commands...' }
    ]
  };
  appState.notes.push(newPage);
  saveState();
  return newPage;
}

export function updateNotePage(pageId, updatedFields) {
  const page = appState.notes.find(n => n.id === pageId);
  if (page) {
    if (updatedFields.title !== undefined) page.title = updatedFields.title;
    if (updatedFields.subject !== undefined) page.subject = updatedFields.subject;
    if (updatedFields.blocks !== undefined) page.blocks = updatedFields.blocks;
    page.updatedAt = new Date().toISOString();
    saveState();
    return page;
  }
  return null;
}

export function deleteNotePage(pageId) {
  appState.notes = appState.notes.filter(n => n.id !== pageId);
  saveState();
}

/* STATISTICAL AGGREGATIONS */

export function getStreak() {
  const sessions = appState.sessions.filter(s => s.type === 'pomodoro');
  if (sessions.length === 0) return 0;
  
  const uniqueDates = [...new Set(sessions.map(s => s.date))].sort();
  const today = getRelativeDateString(0);
  const yesterday = getRelativeDateString(-1);
  
  if (!uniqueDates.includes(today) && !uniqueDates.includes(yesterday)) {
    return 0;
  }
  
  let streak = 0;
  let checkDate = new Date();
  
  if (!uniqueDates.includes(today)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  while (true) {
    const formatted = checkDate.toISOString().split('T')[0];
    if (uniqueDates.includes(formatted)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  return streak;
}

export function getTodayStats() {
  const todayStr = getRelativeDateString(0);
  const todaySessions = appState.sessions.filter(s => s.date === todayStr);
  
  const focusTimeMinutes = todaySessions
    .filter(s => s.type === 'pomodoro')
    .reduce((sum, s) => sum + s.duration, 0);
    
  const completedTodayTasksCount = appState.tasks
    .filter(t => t.status === 'completed' && t.dueDate === todayStr).length;
  
  const activeTodayTasksCount = appState.tasks
    .filter(t => t.dueDate === todayStr).length;
    
  const pomodoroSessions = todaySessions.filter(s => s.type === 'pomodoro');
  const scoreAverage = pomodoroSessions.length > 0
    ? Math.round(pomodoroSessions.reduce((sum, s) => sum + s.score, 0) / pomodoroSessions.length)
    : 0;

  return {
    focusMinutes: focusTimeMinutes,
    completedTasks: appState.tasks.filter(t => t.status === 'completed').length,
    totalTasks: appState.tasks.length,
    activeTasksToday: activeTodayTasksCount,
    completedTasksToday: completedTodayTasksCount,
    streak: getStreak(),
    focusScore: scoreAverage || 100
  };
}

export function getAllSubjects() {
  const subjects = new Set();
  appState.tasks.forEach(t => { if (t.subject) subjects.add(t.subject); });
  appState.notes.forEach(n => { if (n.subject) subjects.add(n.subject); });
  return Array.from(subjects).filter(s => s.trim() !== "");
}

export function getSubjectDistribution() {
  const dist = {};
  appState.sessions.forEach(s => {
    if (s.type !== 'pomodoro') return;
    
    let subject = 'General';
    if (s.taskId) {
      const task = appState.tasks.find(t => t.id === s.taskId);
      if (task && task.subject) subject = task.subject;
    }
    
    dist[subject] = (dist[subject] || 0) + s.duration;
  });
  
  const total = Object.values(dist).reduce((sum, v) => sum + v, 0);
  return Object.keys(dist).map(subject => ({
    subject,
    minutes: dist[subject],
    percentage: total > 0 ? Math.round((dist[subject] / total) * 100) : 0
  }));
}

export function getWeeklyStudyData() {
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyFocus = Array(7).fill(0).map((_, index) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - index));
    return {
      dateStr: d.toISOString().split('T')[0],
      dayName: weekdays[d.getDay()],
      minutes: 0
    };
  });
  
  appState.sessions.forEach(s => {
    if (s.type !== 'pomodoro') return;
    const match = dailyFocus.find(f => f.dateStr === s.date);
    if (match) {
      match.minutes += s.duration;
    }
  });
  
  return dailyFocus.map(df => ({
    label: df.dayName,
    hours: parseFloat((df.minutes / 60).toFixed(1)),
    minutes: df.minutes
  }));
}

export function updateActiveUserSettings(settingsFields) {
  appState.settings = { ...appState.settings, ...settingsFields };
  saveState();
  return { success: true };
}

export function addFriendState(friendUsername) {
  if (!appState.friends) {
    appState.friends = [];
  }
  const exists = appState.friends.some(f => f.toLowerCase() === friendUsername.toLowerCase());
  if (!exists) {
    appState.friends.push(friendUsername);
    saveState();
    return true;
  }
  return false;
}

export function getFriendsState() {
  return appState.friends || [];
}

export function getApiUrl(path) {
  const base = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
  return `${base}${path}`;
}

export function getRegisteredUsersLocal() {
  return (wrapperState.users || []).map(u => u.username) || [];
}

export async function loginUserGoogle(username, email) {
  const cleanName = username.trim();
  const cleanEmail = email.trim();
  
  if (!cleanName) {
    return { success: false, message: 'Google Sign-In username cannot be empty.' };
  }
  
  let user = wrapperState.users.find(u => u.username.toLowerCase() === cleanName.toLowerCase());
  
  if (!user) {
    // Auto-register the Google account if not registered yet
    const initialUserState = JSON.parse(JSON.stringify(DEFAULT_STATE));
    const randomPass = Math.random().toString(36) + Math.random().toString(36);
    const hashedPassword = await hashPassword(randomPass);
    
    user = {
      username: cleanName,
      password: hashedPassword,
      email: cleanEmail,
      state: initialUserState,
      lastModified: Date.now()
    };
    wrapperState.users.push(user);
  }
  
  // Set active session
  wrapperState.activeUser = user.username;
  localStorage.setItem('studyflow_stay_signed_in', 'true');
  sessionStorage.setItem('studyflow_session_user', user.username);
  appState = user.state;
  saveState();
  
  return { success: true };
}

/* CHAT WORKSPACE ACTIONS */
export function getChats() {
  if (!appState.chats) {
    appState.chats = [];
  }
  return appState.chats;
}

export function saveChatThread(thread) {
  if (!appState.chats) {
    appState.chats = [];
  }
  const idx = appState.chats.findIndex(c => c.id === thread.id);
  if (idx !== -1) {
    appState.chats[idx] = thread;
  } else {
    appState.chats.push(thread);
  }
  saveState();
}

export function deleteChatThread(threadId) {
  if (!appState.chats) return;
  appState.chats = appState.chats.filter(c => c.id !== threadId);
  saveState();
}
