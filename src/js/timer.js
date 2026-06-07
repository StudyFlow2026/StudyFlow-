// Focus Room Timer Module for StudyFlow
import { getState, addSession, updateTask } from './state.js';
import { renderDashboard } from './dashboard.js';
import { renderPlanner } from './planner.js';

let timerInterval = null;
let currentMode = 'pomodoro'; // pomodoro, short, long
let timerState = 'paused'; // running, paused
let timeLeft = 25 * 60; // in seconds
let originalDuration = 25 * 60;
let targetTime = null; // target timestamp for tab visibility catch-up

// Activity Verification States
let sessionTabSwitches = 0;
let sessionInteractions = 0;
let randomActivityCheckTime = -1;
let activityCheckCompleted = false;
let isActivityCheckActive = false;
let activityCheckCountdownInterval = null;
let activityCheckRemaining = 60;

// Web Audio API ambient sound synthesis engine
const AmbientSoundEngine = {
  ctx: null,
  noiseBuffers: {},
  channels: {
    rain: {
      volume: 0,
      isPlaying: false,
      nodes: null,
      start() {
        const ctx = AmbientSoundEngine.getContext();
        const mainGain = ctx.createGain();
        mainGain.gain.value = this.volume;
        mainGain.connect(ctx.destination);

        const source = ctx.createBufferSource();
        source.buffer = AmbientSoundEngine.getNoiseBuffer('rain');
        source.loop = true;
        source.connect(mainGain);
        source.start();

        this.nodes = {
          source,
          mainGain
        };
      },
      stop() {
        if (this.nodes) {
          try { this.nodes.source.stop(); } catch (e) {}
          this.nodes = null;
        }
      }
    },
    waves: {
      volume: 0,
      isPlaying: false,
      nodes: null,
      start() {
        const ctx = AmbientSoundEngine.getContext();
        
        // Detuned carrier oscillators for Theta Binaural Beat
        const oscL = ctx.createOscillator();
        const oscR = ctx.createOscillator();
        
        oscL.type = 'sine';
        oscL.frequency.value = 140; // 140Hz Left
        
        oscR.type = 'sine';
        oscR.frequency.value = 144.5; // 144.5Hz Right -> 4.5Hz Beat
        
        const panL = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        const panR = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        
        const mainGain = ctx.createGain();
        mainGain.gain.value = this.volume;
        mainGain.connect(ctx.destination);
        
        if (panL && panR) {
          panL.pan.value = -1;
          panR.pan.value = 1;
          
          oscL.connect(panL).connect(mainGain);
          oscR.connect(panR).connect(mainGain);
        } else {
          oscL.connect(mainGain);
          oscR.connect(mainGain);
        }
        
        oscL.start();
        oscR.start();
        
        this.nodes = {
          oscL,
          oscR,
          mainGain
        };
      },
      stop() {
        if (this.nodes) {
          try { this.nodes.oscL.stop(); } catch (e) {}
          try { this.nodes.oscR.stop(); } catch (e) {}
          this.nodes = null;
        }
      }
    },
    forest: {
      volume: 0,
      isPlaying: false,
      nodes: null,
      start() {
        const ctx = AmbientSoundEngine.getContext();
        const mainGain = ctx.createGain();
        mainGain.gain.value = this.volume;
        mainGain.connect(ctx.destination);

        const source = ctx.createBufferSource();
        source.buffer = AmbientSoundEngine.getNoiseBuffer('forest');
        source.loop = true;
        source.connect(mainGain);
        source.start();

        this.nodes = {
          source,
          mainGain
        };
      },
      stop() {
        if (this.nodes) {
          try { this.nodes.source.stop(); } catch (e) {}
          this.nodes = null;
        }
      }
    },
    cafe: {
      volume: 0,
      isPlaying: false,
      nodes: null,
      start() {
        const ctx = AmbientSoundEngine.getContext();
        const mainGain = ctx.createGain();
        mainGain.gain.value = this.volume;
        mainGain.connect(ctx.destination);

        const source = ctx.createBufferSource();
        source.buffer = AmbientSoundEngine.getNoiseBuffer('cafe');
        source.loop = true;
        source.connect(mainGain);
        source.start();

        this.nodes = {
          source,
          mainGain
        };
      },
      stop() {
        if (this.nodes) {
          try { this.nodes.source.stop(); } catch (e) {}
          this.nodes = null;
        }
      }
    }
  },

  getContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.ctx;
  },

  getNoiseBuffer(type) {
    if (this.noiseBuffers[type]) {
      return this.noiseBuffers[type];
    }

    const ctx = this.getContext();
    const sampleRate = ctx.sampleRate || 44100;
    
    if (type === 'rain') {
      const bufferSize = 2 * sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);

      // Pink noise math
      let b0, b1, b2, b3, b4, b5, b6;
      b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;
        data[i] = pink * 0.08;
      }

      // Bake in droplets
      const numDroplets = 40;
      for (let d = 0; d < numDroplets; d++) {
        const startIdx = Math.floor(Math.random() * (bufferSize - 4000));
        const freq = 1000 + Math.random() * 800;
        const decay = 600 + Math.random() * 800;
        const amp = 0.08 + Math.random() * 0.08;
        for (let j = 0; j < decay; j++) {
          const val = Math.sin(2 * Math.PI * freq * (j / sampleRate)) * Math.exp(-j / (decay / 3)) * amp;
          data[startIdx + j] += val;
        }
      }
      this.noiseBuffers[type] = buffer;
      return buffer;
    } 
    
    if (type === 'forest') {
      const bufferSize = 4 * sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);

      // Brown noise math (deep forest wind gusts)
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        
        // Modulate volume gently to simulate wind gusts
        const windSwell = 0.6 + 0.4 * Math.sin(2 * Math.PI * 0.25 * (i / sampleRate));
        data[i] *= 1.8 * windSwell;
      }

      // Add bird chirps
      const numChirps = 6;
      for (let c = 0; c < numChirps; c++) {
        const startIdx = Math.floor(Math.random() * (bufferSize - 12000));
        const baseFreq = 800 + Math.random() * 500;
        const chirpLen = 8000 + Math.floor(Math.random() * 4000);
        const amp = 0.02 + Math.random() * 0.02;
        
        for (let j = 0; j < chirpLen; j++) {
          const t = j / sampleRate;
          const freq = baseFreq * Math.exp(-2.5 * t);
          const val = Math.sin(2 * Math.PI * freq * t) * Math.exp(-j / (chirpLen / 4)) * amp;
          data[startIdx + j] += val;
        }
      }
      this.noiseBuffers[type] = buffer;
      return buffer;
    } 
    
    if (type === 'cafe') {
      const bufferSize = 3 * sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);

      // Low hum (brown noise representing restaurant chatter rumble)
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 1.2;
      }
      
      // Simple filter moving average
      let prev = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        data[i] = 0.8 * prev + 0.2 * data[i];
        prev = data[i];
      }

      // Add cup clinks
      const numClinks = 15;
      for (let c = 0; c < numClinks; c++) {
        const startIdx = Math.floor(Math.random() * (bufferSize - 4000));
        const freq = 1800 + Math.random() * 1200;
        const decay = 1500 + Math.random() * 1500;
        const amp = 0.015 + Math.random() * 0.02;
        
        for (let j = 0; j < decay; j++) {
          const val = Math.sin(2 * Math.PI * freq * (j / sampleRate)) * Math.exp(-j / (decay / 4)) * amp;
          data[startIdx + j] += val;
        }
      }
      this.noiseBuffers[type] = buffer;
      return buffer;
    }

    return null;
  },

  setVolume(key, volume) {
    const ch = this.channels[key];
    if (!ch) return;
    ch.volume = volume;
    if (ch.nodes && ch.nodes.mainGain) {
      ch.nodes.mainGain.gain.value = volume;
    }
  },

  async startChannel(key) {
    const ch = this.channels[key];
    if (!ch) return;
    ch.isPlaying = true;
    
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    if (ch.isPlaying && !ch.nodes) {
      ch.start();
    }
  },

  stopChannel(key) {
    const ch = this.channels[key];
    if (!ch) return;
    ch.isPlaying = false;
    ch.stop();
  },

  playAlert() {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => this._triggerAlertChime(ctx));
    } else {
      this._triggerAlertChime(ctx);
    }
  },

  _triggerAlertChime(ctx) {
    const now = ctx.currentTime;
    const freqs = [261.63, 329.63, 392.00, 493.88, 523.25];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      const startTime = now + idx * 0.12;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.18, startTime + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.9);
      
      osc.connect(gainNode).connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 1.2);
    });
  }
};

// Mock HTML5 Audio interface adapter
class SynthAudio {
  constructor(key) {
    this.key = key;
    this._volume = 0;
    this._paused = true;
    this.loop = true;
  }

  get volume() {
    return this._volume;
  }

  set volume(val) {
    this._volume = val;
    if (this.key !== 'alert') {
      AmbientSoundEngine.setVolume(this.key, val);
    }
  }

  get paused() {
    return this._paused;
  }

  play() {
    this._paused = false;
    if (this.key === 'alert') {
      AmbientSoundEngine.playAlert();
    } else {
      AmbientSoundEngine.startChannel(this.key);
    }
    return Promise.resolve();
  }

  pause() {
    this._paused = true;
    if (this.key !== 'alert') {
      AmbientSoundEngine.stopChannel(this.key);
    }
  }
}

// Ambient audio mapping
const audios = {
  rain: null,
  cafe: null,
  waves: null,
  forest: null,
  alert: null
};

export function initTimer() {
  // Instantiate synthesized audio objects
  audios.rain = new SynthAudio('rain');
  audios.cafe = new SynthAudio('cafe');
  audios.waves = new SynthAudio('waves');
  audios.forest = new SynthAudio('forest');
  audios.alert = new SynthAudio('alert');

  // Set initial default states
  Object.keys(audios).forEach(key => {
    if (audios[key] && key !== 'alert') {
      audios[key].loop = true;
      audios[key].volume = 0;
    }
  });

  // Preset Buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      switchMode(mode);
    });
  });

  // Control Buttons
  const startBtn = document.getElementById('timer-start');
  if (startBtn) {
    startBtn.addEventListener('click', toggleTimer);
  }

  const resetBtn = document.getElementById('timer-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetTimer);
  }

  const skipBtn = document.getElementById('timer-skip');
  if (skipBtn) {
    skipBtn.addEventListener('click', skipSession);
  }

  // Bind active task options
  populateTaskBinder();

  // Sound mixer range sliders
  document.querySelectorAll('.sound-channel').forEach(channel => {
    const soundKey = channel.getAttribute('data-sound');
    const slider = channel.querySelector('.sound-volume-slider');
    const muteBtn = channel.querySelector('.sound-mute-btn');

    if (slider && audios[soundKey]) {
      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        const volumeVal = val / 100;
        audios[soundKey].volume = volumeVal;
        
        if (volumeVal > 0) {
          channel.classList.add('playing');
          // Try to play if not already playing
          if (audios[soundKey].paused) {
            audios[soundKey].play().catch(err => console.log("Autoplay block:", err));
          }
        } else {
          channel.classList.remove('playing');
          audios[soundKey].pause();
        }
      });
    }

    if (muteBtn && audios[soundKey]) {
      muteBtn.addEventListener('click', () => {
        const isPlaying = channel.classList.contains('playing');
        if (isPlaying) {
          // Mute/Pause
          slider.value = 0;
          audios[soundKey].volume = 0;
          audios[soundKey].pause();
          channel.classList.remove('playing');
        } else {
          // Unmute to default 50%
          slider.value = 50;
          audios[soundKey].volume = 0.5;
          audios[soundKey].play().catch(err => console.log("Play failed:", err));
          channel.classList.add('playing');
        }
      });
    }
  });

  // Activity Verification Event Listeners
  const activityConfirmBtn = document.getElementById('activity-check-confirm-btn');
  if (activityConfirmBtn) {
    activityConfirmBtn.addEventListener('click', confirmActivityCheck);
  }

  // Keydown / click listeners to track active density
  window.addEventListener('keydown', () => {
    if (timerState === 'running' && currentMode === 'pomodoro') {
      sessionInteractions++;
    }
  });

  window.addEventListener('click', () => {
    if (timerState === 'running' && currentMode === 'pomodoro') {
      sessionInteractions++;
    }
  });

  // Page visibility auto-pause listener
  document.addEventListener('visibilitychange', () => {
    if (timerState === 'running') {
      if (document.hidden) {
        if (currentMode === 'pomodoro') {
          const state = getState();
          const settings = state.settings || {};
          if (settings.strictFocusEnabled) {
            pauseTimer();
            showTimerCompleteNotification('Focus Paused', 'Timer paused because you switched tabs. Stay focused on your workspace!');
            sessionTabSwitches++;
          }
        }
      } else {
        // Tab became visible again. Catch up immediately!
        syncTimerProgress();
      }
    }
  });

  // Window focus catch-up listener
  window.addEventListener('focus', () => {
    if (timerState === 'running') {
      syncTimerProgress();
    }
  });

  // Setup initial timer face
  resetTimerFace();
}

// Synchronize remaining timer duration when background execution is throttled or suspended
function syncTimerProgress() {
  if (timerState === 'running' && targetTime) {
    timeLeft = Math.max(0, Math.round((targetTime - Date.now()) / 1000));
    updateTimerFace();
    
    // Check if we passed the random activity verification check time in the background
    if (currentMode === 'pomodoro' && timeLeft <= randomActivityCheckTime && !activityCheckCompleted && !isActivityCheckActive && randomActivityCheckTime > 0) {
      triggerActivityCheck();
    }

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      handleSessionComplete();
    }
  }
}

export function renderTimer() {
  populateTaskBinder();
  updateSessionTally();

  // Hide or show Ambient Sound Mixer based on user preferences
  const state = getState();
  const settings = state.settings || {};
  const ambientCard = document.getElementById('focus-ambient-sound-card');
  if (ambientCard) {
    if (settings.ambientSoundEnabled === false) {
      ambientCard.style.display = 'none';
      // Stop all ambient channels if they are currently playing
      Object.keys(audios).forEach(key => {
        if (audios[key] && key !== 'alert') {
          audios[key].pause();
          
          // Reset slider UI representations and playing states
          const channel = document.querySelector(`.sound-channel[data-sound="${key}"]`);
          if (channel) {
            channel.classList.remove('playing');
            const slider = channel.querySelector('.sound-volume-slider');
            if (slider) slider.value = 0;
          }
        }
      });
    } else {
      ambientCard.style.display = 'block';
    }
  }
}

function populateTaskBinder() {
  const binder = document.getElementById('timer-task-binder');
  if (!binder) return;

  const state = getState();
  const currentSelection = binder.value;

  let html = `<option value="">None (General Study)</option>`;
  state.tasks
    .filter(t => t.status !== 'completed')
    .forEach(task => {
      html += `<option value="${task.id}">${task.title} (${task.subject})</option>`;
    });

  binder.innerHTML = html;
  // Keep selection if it is still valid
  if (state.tasks.some(t => t.id === currentSelection && t.status !== 'completed')) {
    binder.value = currentSelection;
  } else {
    binder.value = '';
  }
}

function switchMode(mode) {
  if (timerState === 'running') {
    if (!confirm('Focus session is currently running. Switch modes and reset timer?')) {
      return;
    }
  }

  currentMode = mode;
  
  // Highlight active button
  document.querySelectorAll('.preset-btn').forEach(btn => {
    if (btn.getAttribute('data-mode') === mode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Reset activity verification variables for new session
  sessionTabSwitches = 0;
  sessionInteractions = 0;
  activityCheckCompleted = false;
  isActivityCheckActive = false;
  if (activityCheckCountdownInterval) {
    clearInterval(activityCheckCountdownInterval);
    activityCheckCountdownInterval = null;
  }
  const modal = document.getElementById('activity-check-modal');
  if (modal) modal.style.display = 'none';

  const state = getState();
  const settings = state.settings;

  // Calculate starting seconds
  let minutes = 25;
  if (mode === 'pomodoro') minutes = settings.pomodoroTime || 25;
  else if (mode === 'short') minutes = settings.shortBreakTime || 5;
  else if (mode === 'long') minutes = settings.longBreakTime || 15;

  timeLeft = minutes * 60;
  originalDuration = timeLeft;
  
  // Pick a random second to trigger the check (e.g. between 20% and 80% of the total duration)
  if (mode === 'pomodoro' && timeLeft > 60) {
    randomActivityCheckTime = Math.floor(timeLeft * (0.2 + Math.random() * 0.6));
  } else {
    randomActivityCheckTime = -1;
  }
  
  pauseTimer();
  resetTimerFace();

  // Update status labels
  const statusText = document.getElementById('timer-status-text');
  if (statusText) {
    if (mode === 'pomodoro') statusText.textContent = 'Time to focus';
    else statusText.textContent = 'Rest and recharge';
  }
}

function toggleTimer() {
  if (timerState === 'paused') {
    startTimer();
  } else {
    pauseTimer();
  }
}

function startTimer() {
  timerState = 'running';
  
  // Transition bound task from 'todo' to 'inprogress' when starting focus session
  if (currentMode === 'pomodoro') {
    const taskBinder = document.getElementById('timer-task-binder');
    const taskId = taskBinder ? taskBinder.value : null;
    if (taskId) {
      const state = getState();
      const boundTask = state.tasks.find(t => t.id === taskId);
      if (boundTask && boundTask.status === 'todo') {
        updateTask(taskId, { status: 'inprogress' });
        try {
          renderPlanner();
        } catch (e) {
          console.error("Failed to render planner:", e);
        }
      }
    }
  }
  
  // Swap icons
  const startIcon = document.getElementById('timer-start-icon');
  if (startIcon) {
    startIcon.setAttribute('data-lucide', 'pause');
    lucide.createIcons({ attrs: { class: 'lucide-icon' } });
  }

  // Animation ticks
  const breathRing = document.getElementById('timer-breath-ring');
  if (breathRing) {
    breathRing.classList.add('ticking');
  }

  // Unconditionally resume AudioContext on user play gesture to ensure future alerts trigger
  try {
    AmbientSoundEngine.getContext().resume();
  } catch(e) {}

  // Start sound mixer channels playing if their volume is set and enabled
  const state = getState();
  const settings = state.settings || {};
  if (settings.ambientSoundEnabled !== false) {
    Object.keys(audios).forEach(key => {
      if (audios[key] && key !== 'alert' && audios[key].volume > 0) {
        audios[key].play().catch(e => console.log("Audio block:", e));
      }
    });
  }

  // Ticking Interval
  targetTime = Date.now() + timeLeft * 1000;
  timerInterval = setInterval(() => {
    timeLeft = Math.max(0, Math.round((targetTime - Date.now()) / 1000));
    
    updateTimerFace();

    if (currentMode === 'pomodoro' && timeLeft === randomActivityCheckTime && !activityCheckCompleted && !isActivityCheckActive) {
      triggerActivityCheck();
    }

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      handleSessionComplete();
    }
  }, 1000);
}

function pauseTimer() {
  timerState = 'paused';
  clearInterval(timerInterval);
  targetTime = null;

  // Swap icons
  const startIcon = document.getElementById('timer-start-icon');
  if (startIcon) {
    startIcon.setAttribute('data-lucide', 'play');
    lucide.createIcons({ attrs: { class: 'lucide-icon' } });
  }

  const breathRing = document.getElementById('timer-breath-ring');
  if (breathRing) {
    breathRing.classList.remove('ticking');
  }

  // Pause ambient audio tracks
  Object.keys(audios).forEach(key => {
    if (audios[key] && key !== 'alert') {
      audios[key].pause();
    }
  });
}

function resetTimer() {
  pauseTimer();
  switchMode(currentMode);
}

function skipSession() {
  if (confirm('Skip this focus session? It will not be logged in your statistics.')) {
    pauseTimer();
    // Swap mode automatically
    if (currentMode === 'pomodoro') {
      switchMode('short');
    } else {
      switchMode('pomodoro');
    }
  }
}

function updateTimerFace() {
  const clock = document.getElementById('timer-clock');
  if (!clock) return;

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const formattedMins = mins < 10 ? `0${mins}` : mins;
  const formattedSecs = secs < 10 ? `0${secs}` : secs;

  const timeString = `${formattedMins}:${formattedSecs}`;
  clock.textContent = timeString;

  // Update browser tab title
  const modeLabel = currentMode === 'pomodoro' ? 'Focus' : 'Break';
  document.title = `(${timeString}) ${modeLabel} - StudyFlow`;

  // Scale breath ring radius
  const breathRing = document.getElementById('timer-breath-ring');
  if (breathRing && originalDuration > 0) {
    const ratio = timeLeft / originalDuration;
    // scale from 1 (start) to 0.7 (end)
    const scale = 0.7 + (ratio * 0.3);
    breathRing.style.transform = `scale(${scale})`;
  }
}

function resetTimerFace() {
  updateTimerFace();
  document.title = 'StudyFlow - Ultimate Student Dashboard & Planner';
  
  const breathRing = document.getElementById('timer-breath-ring');
  if (breathRing) {
    breathRing.style.transform = 'scale(1)';
  }
}

function showTimerCompleteNotification(title, message) {
  const existing = document.getElementById('timer-complete-notification');
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement('div');
  notification.id = 'timer-complete-notification';
  
  notification.style.position = 'fixed';
  notification.style.bottom = '24px';
  notification.style.right = '24px';
  notification.style.zIndex = '9999';
  notification.style.background = 'rgba(18, 18, 24, 0.85)';
  notification.style.backdropFilter = 'blur(16px) saturate(180%)';
  notification.style.webkitBackdropFilter = 'blur(16px) saturate(180%)';
  notification.style.border = '1px solid rgba(255, 255, 255, 0.08)';
  notification.style.borderRadius = '12px';
  notification.style.padding = '16px';
  notification.style.boxShadow = '0 8px 32px 0 rgba(0, 0, 0, 0.4)';
  notification.style.width = '320px';
  notification.style.color = '#ffffff';
  notification.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
  notification.style.transform = 'translateY(100px) scale(0.9)';
  notification.style.opacity = '0';
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(108, 92, 231, 0.15); color: #6c5ce7; display: flex; align-items: center; justify-content: center;">
        <i data-lucide="bell" style="width: 20px; height: 20px;"></i>
      </div>
      <div style="flex: 1;">
        <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; letter-spacing: 0.5px; font-family: 'Outfit', sans-serif;">${title}</h4>
        <p style="margin: 0; font-size: 12px; color: #a4b0be; font-family: 'Outfit', sans-serif;">${message}</p>
      </div>
      <button id="close-timer-notif-btn" style="background: none; border: none; color: #a4b0be; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: all 0.2s;">
        <i data-lucide="x" style="width: 16px; height: 16px;"></i>
      </button>
    </div>
  `;

  document.body.appendChild(notification);
  lucide.createIcons();

  setTimeout(() => {
    notification.style.transform = 'translateY(0) scale(1)';
    notification.style.opacity = '1';
  }, 10);

  const closeBtn = document.getElementById('close-timer-notif-btn');
  const dismiss = () => {
    notification.style.transform = 'translateY(20px) scale(0.95)';
    notification.style.opacity = '0';
    setTimeout(() => {
      notification.remove();
    }, 300);
  };
  
  if (closeBtn) {
    closeBtn.addEventListener('click', dismiss);
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.05)';
      closeBtn.style.color = '#ffffff';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'none';
      closeBtn.style.color = '#a4b0be';
    });
  }

  setTimeout(() => {
    if (document.body.contains(notification)) {
      dismiss();
    }
  }, 8000);
}

function handleSessionComplete() {
  pauseTimer();

  // Play alarm sound
  if (audios.alert) {
    audios.alert.volume = 0.8;
    audios.alert.play().catch(e => console.log("Alarm fail:", e));
  }

  const state = getState();
  const settings = state.settings || {};

  // Log session if it was a Focus session
  if (currentMode === 'pomodoro') {
    const taskBinder = document.getElementById('timer-task-binder');
    const taskId = taskBinder ? taskBinder.value : null;
    let taskTitle = 'General Study';

    if (taskId) {
      const boundTask = state.tasks.find(t => t.id === taskId);
      if (boundTask) {
        taskTitle = boundTask.title;
        // Increment completed Pomodoros count
        const nextCompleted = (boundTask.completedPomos || 0) + 1;
        const updatedFields = { completedPomos: nextCompleted };
        
        // If completed pomos reached or exceeded estimated, mark completed
        if (nextCompleted >= boundTask.estimatedPomos) {
          updatedFields.status = 'completed';
        }
        
        updateTask(taskId, updatedFields);
        
        try {
          renderPlanner();
        } catch (e) {
          console.error("Failed to render planner:", e);
        }
        
        populateTaskBinder();
      }
    }

    const durationMinutes = Math.round(originalDuration / 60);
    
    // Calculate focus score based on activity verification parameters
    let focusScore = 100;
    
    // 1. Tab switches deduction: -10 per switch, max -30
    const tabSwitchDeduction = Math.min(30, sessionTabSwitches * 10);
    focusScore -= tabSwitchDeduction;
    
    // 2. Activity Check deduction: If they completed the check, 0 penalty, otherwise -40
    if (!activityCheckCompleted && randomActivityCheckTime > 0 && timeLeft <= randomActivityCheckTime) {
      focusScore -= 40;
    }
    
    // 3. Interaction Density check: If they had less than 10 clicks/keypresses, deduct -30
    if (sessionInteractions < 10) {
      focusScore -= 30;
    }
    
    focusScore = Math.max(0, focusScore);

    // Add to session logs
    addSession({
      taskId,
      taskTitle,
      duration: durationMinutes,
      type: 'pomodoro',
      score: focusScore
    });

    // Re-check count of focus sessions completed today after logging this one
    const todayStr = new Date().toISOString().split('T')[0];
    const updatedState = getState();
    const todaySessions = updatedState.sessions.filter(s => s.date === todayStr && s.type === 'pomodoro');
    const completedCount = todaySessions.length;

    // Every 4th session triggers a Long Break (e.g. 4, 8, 12...)
    if (completedCount > 0 && completedCount % 4 === 0) {
      showTimerCompleteNotification('Focus Session Completed!', `Amazing! That's ${completedCount} sessions. Take a long break to fully recharge.`);
      switchMode('long');
    } else {
      showTimerCompleteNotification('Focus Session Completed!', 'Awesome work! Take a short break to recharge.');
      switchMode('short');
    }

    // Auto-start next session (the break) if enabled in settings
    if (settings.autoStart) {
      setTimeout(() => {
        startTimer();
      }, 500);
    }
  } else {
    showTimerCompleteNotification('Break Completed!', 'Time to dive back in and focus!');
    switchMode('pomodoro');

    // Auto-start next session (the focus) if enabled in settings
    if (settings.autoStart) {
      setTimeout(() => {
        startTimer();
      }, 500);
    }
  }

  // Update tallies
  updateSessionTally();
  renderDashboard();
}

function updateSessionTally() {
  const infoLabel = document.getElementById('timer-session-info');
  const dotsContainer = document.getElementById('timer-session-dots');
  if (!infoLabel || !dotsContainer) return;

  const state = getState();
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySessions = state.sessions.filter(s => s.date === todayStr && s.type === 'pomodoro');
  const completedCount = todaySessions.length;

  infoLabel.textContent = `Session #${completedCount + 1} • Daily Target: 4 focus sessions`;

  // Draw dots
  let dotsHtml = '';
  for (let i = 1; i <= 4; i++) {
    const isFilled = i <= completedCount ? 'filled' : '';
    dotsHtml += `<span class="session-dot ${isFilled}"></span>`;
  }
  dotsContainer.innerHTML = dotsHtml;
}

function triggerActivityCheck() {
  isActivityCheckActive = true;
  pauseTimer(); // Auto-pause timer during activity verification check
  
  const modal = document.getElementById('activity-check-modal');
  const countLabel = document.getElementById('activity-check-countdown');
  
  if (modal) {
    modal.style.display = 'flex';
  }
  
  activityCheckRemaining = 60;
  if (countLabel) countLabel.textContent = `${activityCheckRemaining}s`;
  
  // Sound check chime
  if (audios.alert) {
    audios.alert.volume = 0.5;
    audios.alert.play().catch(() => {});
  }
  
  activityCheckCountdownInterval = setInterval(() => {
    activityCheckRemaining--;
    if (countLabel) {
      countLabel.textContent = `${activityCheckRemaining}s`;
    }
    
    if (activityCheckRemaining <= 0) {
      clearInterval(activityCheckCountdownInterval);
      activityCheckCountdownInterval = null;
      handleActivityCheckTimeout();
    }
  }, 1000);
}

function handleActivityCheckTimeout() {
  isActivityCheckActive = false;
  activityCheckCompleted = false; // Flag that they missed it
  
  const modal = document.getElementById('activity-check-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  
  // Penalty chime
  if (audios.alert) {
    audios.alert.volume = 0.8;
    audios.alert.play().catch(() => {});
  }
  
  showTimerCompleteNotification('Activity Check Missed!', 'Your focus timer has been paused. Click Play to resume your work.');
}

function confirmActivityCheck() {
  if (activityCheckCountdownInterval) {
    clearInterval(activityCheckCountdownInterval);
    activityCheckCountdownInterval = null;
  }
  
  isActivityCheckActive = false;
  activityCheckCompleted = true;
  
  const modal = document.getElementById('activity-check-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  
  showTimerCompleteNotification('Activity Confirmed', 'Keep up the great work!');
  startTimer(); // Resume timer
}

export function getTargetTime() { return targetTime; }
export function setTargetTime(val) { targetTime = val; }
export { currentMode, timerState, timeLeft, syncTimerProgress };
