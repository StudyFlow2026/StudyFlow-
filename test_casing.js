// Case-Insensitivity Integration Test
import { loadState, getState } from './src/js/state.js';
import { timerState, timeLeft, getTargetTime, setTargetTime, syncTimerProgress } from './src/js/timer.js';

// Helper to wait
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runTests() {
  const log = (msg) => {
    console.log("[TEST LOG]", msg);
    const div = document.createElement('div');
    div.textContent = msg;
    div.style.padding = '8px';
    div.style.borderBottom = '1px solid #333';
    div.style.fontFamily = 'monospace';
    document.getElementById('test-results-log').appendChild(div);
    
    // Sync log to backend server log
    fetch('http://localhost:3000/api/log', {
      method: 'POST',
      body: "[Casing Test] " + msg
    }).catch(() => {});
  };

  const assert = (condition, msg) => {
    if (!condition) {
      throw new Error("Assertion Failed: " + msg);
    }
    log("PASS: " + msg);
  };

  try {
    log("Starting Casing Integration Tests...");

    // Mock confirm dialog for headless execution
    window.confirm = () => true;

    // Clear state first to ensure clean test environment
    localStorage.clear();
    log("Cleared localStorage.");

    // Wait for App to load and auth overlay to display
    await sleep(1000);

    // Switch to Sign Up tab
    document.getElementById('tab-signup-btn').click();
    await sleep(200);

    // Fill in registration form with specific casing
    document.getElementById('signup-username').value = "ScholarMode";
    document.getElementById('signup-email').value = "test@test.com";
    document.getElementById('signup-password').value = "Password123";
    document.getElementById('signup-confirm-password').value = "Password123";
    
    log("Submitting registration form...");
    document.getElementById('signup-form').dispatchEvent(new Event('submit'));
    await sleep(500);

    // Fetch the generated OTP from the backend test API
    log("Fetching registration OTP from backend...");
    const otpResponse = await fetch('http://localhost:3000/api/get-latest-otp');
    const otpData = await otpResponse.json();
    const toastOtp = otpData.otp.replace(/\s+/g, '').trim();
    assert(toastOtp.length === 6, `Retrieved 6-digit OTP code from backend: ${toastOtp}`);

    // Fill OTP digits
    const otpBoxes = document.querySelectorAll('.otp-input-box');
    for (let i = 0; i < 6; i++) {
      otpBoxes[i].value = toastOtp[i];
      otpBoxes[i].dispatchEvent(new Event('input'));
    }
    
    log("Submitting verification code...");
    document.getElementById('otp-verify-btn').click();
    await sleep(1000);

    // Verify logged in
    let wrapper = JSON.parse(localStorage.getItem('studyflow_app_state_multiuser'));
    assert(wrapper.activeUser === "ScholarMode", "Logged in as ScholarMode");
    
    // Log out first
    document.getElementById('logout-trigger-btn').click();
    await sleep(500);
    log("Logged out successfully.");

    // Now, manually corrupt the stored password hash to uppercase to test case-insensitive hash checking
    wrapper = JSON.parse(localStorage.getItem('studyflow_app_state_multiuser'));
    const user = wrapper.users.find(u => u.username === "ScholarMode");
    assert(user !== undefined, "Found ScholarMode in local storage database");
    
    const originalHash = user.password;
    user.password = originalHash.toUpperCase();
    localStorage.setItem('studyflow_app_state_multiuser', JSON.stringify(wrapper));
    log(`Corrupted stored hash in database to UPPERCASE: ${user.password}`);

    // Force loadState to reload corrupted data
    loadState();

    // Now attempt to log in using different username casing (scholarmode) and correct password (Password123)
    document.getElementById('login-username').value = "scholarmode";
    document.getElementById('login-password').value = "Password123";
    const staySignedInCheckbox = document.getElementById('login-stay-signed-in');
    if (staySignedInCheckbox) staySignedInCheckbox.checked = true;
    
    log("Logging in as 'scholarmode' (lowercase 's' and 'm') with correct password...");
    document.getElementById('login-form').dispatchEvent(new Event('submit'));
    await sleep(1000);

    // Check if login succeeded and overlay is hidden
    const overlay = document.getElementById('auth-overlay');
    assert(overlay.style.display === 'none', "Auth overlay hidden (successful login)");
    
    // Check active user casing
    const activeState = JSON.parse(localStorage.getItem('studyflow_app_state_multiuser'));
    assert(activeState.activeUser.toLowerCase() === "scholarmode", "Successfully authenticated case-insensitively");
    
    // Now, run the Pomodoro background timer catch-up test
    log("Starting Pomodoro Timer background catch-up unit test...");
    
    // Switch to Focus Room tab
    document.querySelector('.nav-btn[data-tab="timer"]').click();
    await sleep(500);
    
    // Reset timer to ensure clean pomodoro mode
    const resetBtn = document.getElementById('timer-reset');
    if (resetBtn) resetBtn.click();
    await sleep(200);
    
    // Check initial time
    const initialTimeLeft = timeLeft;
    log(`Initial time left: ${initialTimeLeft}s`);
    
    // Click start timer
    document.getElementById('timer-start').click();
    await sleep(200);
    
    assert(timerState === 'running', "Timer is running after start button click");
    
    const initialTargetTime = getTargetTime();
    assert(initialTargetTime > 0, `targetTime successfully set: ${initialTargetTime}`);
    
    // Simulate background elapsed time (shift targetTime back by 15 seconds)
    log("Simulating 15 seconds passing in background tab...");
    setTargetTime(initialTargetTime - 15000);
    
    // Trigger catch-up progress sync
    log("Restoring focus/visibility - triggering syncTimerProgress()...");
    syncTimerProgress();
    
    const newTimeLeft = timeLeft;
    log(`Time left after catch-up: ${newTimeLeft}s`);
    
    // Verify that it accurately caught up (should be approx initialTimeLeft - 15 seconds)
    const expectedTimeLeft = initialTimeLeft - 15;
    assert(Math.abs(newTimeLeft - expectedTimeLeft) <= 1, `Time left accurately caught up to ${newTimeLeft}s (expected: ${expectedTimeLeft}s)`);
    
    // Clean up: pause/reset the timer
    document.getElementById('timer-reset').click();
    await sleep(200);
    log("PASS: Pomodoro Timer background catch-up test successful!");

    log("TEST_RESULT: SUCCESS");
    document.getElementById('test-badge').textContent = "SUCCESS";
    document.getElementById('test-badge').className = "passed";
  } catch (err) {
    log("TEST_RESULT: FAILED - " + err.message);
    console.error(err);
    document.getElementById('test-badge').textContent = "FAILED";
    document.getElementById('test-badge').className = "failed";
  }
}

window.addEventListener('load', () => {
  setTimeout(runTests, 1500);
});
