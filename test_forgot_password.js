// Forgot Password Integration Test
import { loadState, getState } from './src/js/state.js';

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
      body: "[Forgot Password Test] " + msg
    }).catch(() => {});
  };

  const assert = (condition, msg) => {
    if (!condition) {
      throw new Error("Assertion Failed: " + msg);
    }
    log("PASS: " + msg);
  };

  try {
    log("Starting Forgot Password Integration Tests...");

    // Mock confirm dialog for headless execution
    window.confirm = () => true;

    // Clear state first to ensure clean test environment
    localStorage.clear();
    log("Cleared localStorage.");

    // Wait for App to load and auth overlay to display
    await sleep(1000);

    // Switch to Sign Up tab and register
    document.getElementById('tab-signup-btn').click();
    await sleep(200);

    document.getElementById('signup-username').value = "ResetScholar";
    document.getElementById('signup-email').value = "reset@test.com";
    document.getElementById('signup-password').value = "InitialPass123";
    document.getElementById('signup-confirm-password').value = "InitialPass123";
    
    log("Registering user ResetScholar...");
    document.getElementById('signup-form').dispatchEvent(new Event('submit'));
    await sleep(800);

    // Fetch the generated OTP from the backend test API for Sign Up
    log("Fetching signup OTP from backend...");
    const signupOtpResponse = await fetch('http://localhost:3000/api/get-latest-otp');
    const signupOtpData = await signupOtpResponse.json();
    const signupOtp = signupOtpData.otp.replace(/\s+/g, '').trim();
    assert(signupOtp.length === 6, `Retrieved 6-digit Sign Up OTP from backend: ${signupOtp}`);

    // Fill OTP digits
    const otpBoxes = document.querySelectorAll('.otp-input-box');
    for (let i = 0; i < 6; i++) {
      otpBoxes[i].value = signupOtp[i];
      otpBoxes[i].dispatchEvent(new Event('input'));
    }
    
    log("Submitting verification code for Sign Up...");
    document.getElementById('otp-verify-btn').click();
    await sleep(1000);

    // Verify logged in
    let wrapper = JSON.parse(localStorage.getItem('studyflow_app_state_multiuser'));
    assert(wrapper.activeUser === "ResetScholar", "Successfully registered and logged in");

    // Log out to return to auth overlay
    log("Logging out...");
    document.getElementById('logout-trigger-btn').click();
    await sleep(500);
    log("Logged out successfully.");

    // Click "Forgot password?" link
    log("Clicking 'Forgot password?' link...");
    document.getElementById('forgot-password-link').click();
    await sleep(300);

    // Verify forgot password form is visible
    const forgotForm = document.getElementById('forgot-password-form');
    assert(forgotForm.style.display === 'flex', "Forgot password form is now visible");
    assert(document.getElementById('login-form').style.display === 'none', "Login form is hidden");

    // Fill username and email to request reset
    document.getElementById('forgot-username').value = "resetscholar"; // test case insensitivity
    document.getElementById('forgot-email').value = "reset@test.com";
    
    log("Submitting password recovery request...");
    forgotForm.dispatchEvent(new Event('submit'));
    await sleep(800);

    // Fetch the generated OTP from the backend test API
    log("Fetching latest recovery OTP from backend...");
    const otpResponse = await fetch('http://localhost:3000/api/get-latest-otp');
    const otpData = await otpResponse.json();
    const toastOtp = otpData.otp.replace(/\s+/g, '').trim();
    assert(toastOtp.length === 6, `Retrieved 6-digit recovery OTP from backend: ${toastOtp}`);

    // Verify reset password panel is visible
    const resetPanel = document.getElementById('reset-password-panel');
    assert(resetPanel.style.display === 'flex', "Reset password panel is now visible");

    // Fill in OTP digits
    const resetOtpBoxes = document.querySelectorAll('.reset-otp-input-box');
    for (let i = 0; i < 6; i++) {
      resetOtpBoxes[i].value = toastOtp[i];
      resetOtpBoxes[i].dispatchEvent(new Event('input'));
    }

    // Enter new password
    document.getElementById('reset-new-password').value = "NewSecurePassword456";
    document.getElementById('reset-confirm-password').value = "NewSecurePassword456";

    log("Submitting password reset form...");
    document.getElementById('reset-submit-btn').click();
    await sleep(1000);

    // Verify reset succeeded and logged in automatically
    const overlay = document.getElementById('auth-overlay');
    assert(overlay.style.display === 'none', "Auth overlay hidden (successful password reset and login)");
    
    wrapper = JSON.parse(localStorage.getItem('studyflow_app_state_multiuser'));
    assert(wrapper.activeUser.toLowerCase() === "resetscholar", "Logged in as ResetScholar post-reset");

    // Log out to test logging in with the new password
    log("Logging out again to test new credentials...");
    document.getElementById('logout-trigger-btn').click();
    await sleep(500);

    // Try logging in with the OLD password
    log("Attempting login with OLD password (should fail)...");
    document.getElementById('login-username').value = "resetscholar";
    document.getElementById('login-password').value = "InitialPass123";
    document.getElementById('login-form').dispatchEvent(new Event('submit'));
    await sleep(500);

    const errorEl = document.getElementById('login-error');
    assert(overlay.style.display !== 'none', "Login with old password failed (auth overlay remains visible)");
    assert(errorEl.style.display === 'block', "Login error message is displayed");

    // Try logging in with the NEW password
    log("Attempting login with NEW password (should succeed)...");
    document.getElementById('login-username').value = "resetscholar";
    document.getElementById('login-password').value = "NewSecurePassword456";
    document.getElementById('login-form').dispatchEvent(new Event('submit'));
    await sleep(1000);

    assert(overlay.style.display === 'none', "Login with new password succeeded (auth overlay hidden)");
    
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
