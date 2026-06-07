// Cross-Origin Sync Integration Test
import { syncPullAndMerge, loadState, decrypt } from './src/js/state.js';

const STORAGE_KEY = 'studyflow_app_state_multiuser';
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
      body: "[Sync Test] " + msg
    }).catch(() => {});
  };

  const assert = (condition, msg) => {
    if (!condition) {
      throw new Error("Assertion Failed: " + msg);
    }
    log("PASS: " + msg);
  };

  try {
    log("Starting Cross-Origin Sync Integration Tests...");

    // 1. Reset local storage
    localStorage.clear();
    log("Cleared local localStorage.");

    // 2. Set up initial Server State (simulate server having some users)
    const serverTimestamp = Date.now();
    const serverMockState = {
      users: [
        {
          username: "ServerUser",
          password: "password123_hashed_on_server",
          email: "server@user.com",
          lastModified: serverTimestamp,
          state: {
            tasks: [{ id: "task-server", title: "Server Task", status: "todo" }],
            sessions: [],
            notes: [],
            settings: { theme: "dark" }
          }
        },
        {
          username: "BothUser",
          password: "password_both_hashed",
          email: "both_server@user.com",
          lastModified: serverTimestamp + 1000, // Newer on server
          state: {
            tasks: [{ id: "task-both-server", title: "Newer Server Task", status: "todo" }],
            sessions: [],
            notes: [],
            settings: { theme: "dark" }
          }
        }
      ],
      activeUser: "ServerUser"
    };

    log("Initializing target mock state on localhost:3000 server...");
    const postResponse = await fetch('http://localhost:3000/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(serverMockState)
    });
    assert(postResponse.ok, "Mock state uploaded to server successfully");

    // 3. Set up Local State (simulate local changes/users)
    const localTimestamp = Date.now();
    const localMockState = {
      users: [
        {
          username: "LocalOnlyUser",
          password: "password_local_hashed",
          email: "local@user.com",
          lastModified: localTimestamp,
          state: {
            tasks: [{ id: "task-local", title: "Local Only Task", status: "todo" }],
            sessions: [],
            notes: [],
            settings: { theme: "dark" }
          }
        },
        {
          username: "BothUser",
          password: "password_both_hashed",
          email: "both_local@user.com",
          lastModified: localTimestamp - 5000, // Older on local
          state: {
            tasks: [{ id: "task-both-local", title: "Older Local Task", status: "todo" }],
            sessions: [],
            notes: [],
            settings: { theme: "dark" }
          }
        }
      ],
      activeUser: null
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(localMockState));
    log("Initialized local mock state in localStorage.");

    // 4. Trigger the actual Pull & Merge routine
    log("Running syncPullAndMerge()...");
    const syncResult = await syncPullAndMerge();
    assert(syncResult.changed === true, "syncPullAndMerge returned changed: true");

    // 5. Verify local localStorage state after sync
    const finalLocalState = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(finalLocalState !== null, "Local state exists in localStorage after sync");
    
    // Assert ServerUser exists locally now
    const localServerUser = finalLocalState.users.find(u => u.username.toLowerCase() === "serveruser");
    assert(localServerUser !== undefined, "ServerUser successfully synced to local storage");
    assert(localServerUser.state.tasks[0].id === "task-server", "ServerUser's tasks matched server state");

    // Assert LocalOnlyUser still exists locally
    const localLocalOnlyUser = finalLocalState.users.find(u => u.username.toLowerCase() === "localonlyuser");
    assert(localLocalOnlyUser !== undefined, "LocalOnlyUser retained in local storage");

    // Assert BothUser merged correctly (kept the server version which was newer)
    const localBothUser = finalLocalState.users.find(u => u.username.toLowerCase() === "bothuser");
    assert(localBothUser !== undefined, "BothUser exists locally");
    assert(localBothUser.lastModified === serverTimestamp + 1000, "BothUser correctly resolved using server version (newer timestamp)");
    assert(localBothUser.state.tasks[0].id === "task-both-server", "BothUser's tasks resolved to server version");

    // 6. Verify Server State was updated with local changes (LocalOnlyUser should be pushed to server)
    log("Fetching final state from server to verify merge pushback...");
    const getResponse = await fetch('http://localhost:3000/api/sync');
    assert(getResponse.ok, "Fetched state from server");
    const finalServerStateRaw = await getResponse.json();

    let finalServerState;
    if (finalServerStateRaw && finalServerStateRaw.encryptedData) {
      finalServerState = JSON.parse(decrypt(finalServerStateRaw.encryptedData));
    } else {
      finalServerState = finalServerStateRaw;
    }

    const serverLocalOnlyUser = finalServerState.users.find(u => u.username.toLowerCase() === "localonlyuser");
    assert(serverLocalOnlyUser !== undefined, "LocalOnlyUser was successfully pushed back and merged into server database");

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
