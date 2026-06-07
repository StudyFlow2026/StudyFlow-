// Settings Module for StudyFlow
import { getActiveUser, getActiveUserEmail, updateActiveUserProfile, getState, updateActiveUserSettings } from './state.js';

export function initSettings() {
  const btnProfile = document.getElementById('btn-settings-profile');
  const btnHelp = document.getElementById('btn-settings-help');
  const btnAbout = document.getElementById('btn-settings-about');
  const profileContent = document.getElementById('settings-profile-content');
  const helpContent = document.getElementById('settings-help-content');
  const aboutContent = document.getElementById('settings-about-content');

  const deactivateAllSettingsTabs = () => {
    if (btnProfile) btnProfile.classList.remove('active');
    if (btnHelp) btnHelp.classList.remove('active');
    if (btnAbout) btnAbout.classList.remove('active');
    if (profileContent) profileContent.style.display = 'none';
    if (helpContent) helpContent.style.display = 'none';
    if (aboutContent) aboutContent.style.display = 'none';
  };

  // Settings view Sub-tabs switching
  if (btnProfile && profileContent) {
    btnProfile.addEventListener('click', () => {
      deactivateAllSettingsTabs();
      btnProfile.classList.add('active');
      profileContent.style.display = 'block';
    });
  }

  if (btnHelp && helpContent) {
    btnHelp.addEventListener('click', () => {
      deactivateAllSettingsTabs();
      btnHelp.classList.add('active');
      helpContent.style.display = 'block';
    });
  }

  if (btnAbout && aboutContent) {
    btnAbout.addEventListener('click', () => {
      deactivateAllSettingsTabs();
      btnAbout.classList.add('active');
      aboutContent.style.display = 'block';
    });
  }

  // Interactive FAQs Accordion Clicks
  document.querySelectorAll('.faq-question').forEach(question => {
    question.addEventListener('click', () => {
      const answer = question.nextElementSibling;
      const isActive = question.classList.contains('active');

      // Close all other answers for a clean accordion effect
      document.querySelectorAll('.faq-question').forEach(q => {
        if (q !== question) {
          q.classList.remove('active');
          q.nextElementSibling.classList.remove('show');
        }
      });

      // Toggle current
      if (isActive) {
        question.classList.remove('active');
        answer.classList.remove('show');
      } else {
        question.classList.add('active');
        answer.classList.add('show');
      }
    });
  });

  // Profile Form update listener
  const form = document.getElementById('settings-profile-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const successEl = document.getElementById('settings-success-msg');
      const errorEl = document.getElementById('settings-error-msg');
      
      successEl.style.display = 'none';
      errorEl.style.display = 'none';

      const emailVal = document.getElementById('settings-email-input').value;

      // Determine what is being updated
      const currentEmail = getActiveUserEmail();
      const isEmailChanged = (emailVal.trim() !== currentEmail.trim());

      if (isEmailChanged) {
        // Update Profile state
        const result = await updateActiveUserProfile(emailVal);
        if (!result.success) {
          errorEl.textContent = result.message || 'Failed to update profile details.';
          errorEl.style.display = 'block';
          return;
        }
      }

      // Save Preferences settings (this runs either after successful profile update or when only settings changed)
      const autoStartVal = document.getElementById('settings-auto-start').checked;
      const ambientEnabledVal = document.getElementById('settings-ambient-enabled').checked;
      const tabGuardVal = document.getElementById('settings-tab-guard')?.checked || false;
      const pomoTimeVal = parseInt(document.getElementById('settings-pomo-time').value) || 25;
      const shortTimeVal = parseInt(document.getElementById('settings-short-time').value) || 5;
      const longTimeVal = parseInt(document.getElementById('settings-long-time').value) || 15;
      const dailyGoalVal = parseInt(document.getElementById('settings-daily-goal').value) || 120;
      const geminiApiKeyVal = document.getElementById('settings-gemini-key')?.value.trim() || '';
      const geminiModelVal = document.getElementById('settings-gemini-model')?.value.trim() || 'gemini-2.5-flash';

      updateActiveUserSettings({
        autoStart: autoStartVal,
        ambientSoundEnabled: ambientEnabledVal,
        strictFocusEnabled: tabGuardVal,
        pomodoroTime: pomoTimeVal,
        shortBreakTime: shortTimeVal,
        longBreakTime: longTimeVal,
        dailyGoalMinutes: dailyGoalVal,
        geminiApiKey: geminiApiKeyVal,
        geminiModel: geminiModelVal
      });

      // Save custom SMTP configuration if elements exist
      const smtpServerEl = document.getElementById('settings-smtp-server');
      const smtpPortEl = document.getElementById('settings-smtp-port');
      const smtpUserEl = document.getElementById('settings-smtp-user');
      const smtpPassEl = document.getElementById('settings-smtp-pass');
      
      if (smtpServerEl && smtpPortEl && smtpUserEl && smtpPassEl) {
        const smtpConfig = {
          smtpServer: smtpServerEl.value.trim(),
          smtpPort: parseInt(smtpPortEl.value) || 587,
          smtpUser: smtpUserEl.value.trim(),
          smtpPass: smtpPassEl.value.trim()
        };
        localStorage.setItem('studyflow_smtp_config', JSON.stringify(smtpConfig));
      }

      // Save custom Google Client ID configuration if element exists
      const googleClientIdEl = document.getElementById('settings-google-client-id');
      if (googleClientIdEl) {
        localStorage.setItem('studyflow_google_client_id', googleClientIdEl.value.trim());
      }

      successEl.style.display = 'block';
      
      // Auto-hide success banner
      setTimeout(() => {
        successEl.style.display = 'none';
      }, 4000);
    });
  }
}

export function renderSettings() {
  const username = getActiveUser();
  const email = getActiveUserEmail();
  const state = getState();
  const settings = state.settings || {};

  const userDisplay = document.getElementById('settings-username-display');
  const emailInput = document.getElementById('settings-email-input');

  if (userDisplay) userDisplay.value = username || 'Guest User';
  if (emailInput) emailInput.value = email || '';

  // Load preferences inputs
  const autoStartInput = document.getElementById('settings-auto-start');
  const ambientEnabledInput = document.getElementById('settings-ambient-enabled');
  const tabGuardInput = document.getElementById('settings-tab-guard');
  const pomoInput = document.getElementById('settings-pomo-time');
  const shortInput = document.getElementById('settings-short-time');
  const longInput = document.getElementById('settings-long-time');
  const goalInput = document.getElementById('settings-daily-goal');

  if (autoStartInput) autoStartInput.checked = !!settings.autoStart;
  if (ambientEnabledInput) ambientEnabledInput.checked = settings.ambientSoundEnabled !== false;
  if (tabGuardInput) tabGuardInput.checked = !!settings.strictFocusEnabled;
  if (pomoInput) pomoInput.value = settings.pomodoroTime || 25;
  if (shortInput) shortInput.value = settings.shortBreakTime || 5;
  if (longInput) longInput.value = settings.longBreakTime || 15;
  if (goalInput) goalInput.value = settings.dailyGoalMinutes || 120;

  const geminiApiKeyInput = document.getElementById('settings-gemini-key');
  const geminiModelInput = document.getElementById('settings-gemini-model');
  if (geminiApiKeyInput) geminiApiKeyInput.value = settings.geminiApiKey || '';
  if (geminiModelInput) geminiModelInput.value = settings.geminiModel || 'gemini-2.5-flash';

  // Load SMTP config inputs if available
  const smtpServerInput = document.getElementById('settings-smtp-server');
  const smtpPortInput = document.getElementById('settings-smtp-port');
  const smtpUserInput = document.getElementById('settings-smtp-user');
  const smtpPassInput = document.getElementById('settings-smtp-pass');
  
  if (smtpServerInput && smtpPortInput && smtpUserInput && smtpPassInput) {
    const smtpConfigStr = localStorage.getItem('studyflow_smtp_config');
    if (smtpConfigStr) {
      try {
        const smtpConfig = JSON.parse(smtpConfigStr);
        smtpServerInput.value = smtpConfig.smtpServer || '';
        smtpPortInput.value = smtpConfig.smtpPort || '';
        smtpUserInput.value = smtpConfig.smtpUser || '';
        smtpPassInput.value = smtpConfig.smtpPass || '';
      } catch (e) {
        console.error("Failed to parse SMTP config", e);
      }
    }
  }

  // Load Google Client ID input if available
  const googleClientIdInput = document.getElementById('settings-google-client-id');
  if (googleClientIdInput) {
    googleClientIdInput.value = localStorage.getItem('studyflow_google_client_id') || '';
  }

  // Reset display banners
  const successEl = document.getElementById('settings-success-msg');
  const errorEl = document.getElementById('settings-error-msg');
  if (successEl) successEl.style.display = 'none';
  if (errorEl) errorEl.style.display = 'none';

  // Make sure profile tab is default open on view load
  const btnProfile = document.getElementById('btn-settings-profile');
  if (btnProfile) btnProfile.click();
}
