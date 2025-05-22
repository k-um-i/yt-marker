let currentVideoID = getYouTubeVideoID(window.location.href);

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("saveBtn").addEventListener("click", saveTimestamp);
  getCurrentVideoInfo();
});

function updateStatus(msg) {
  document.getElementById("status").textContent = msg;
}

function saveTimestamp() {
  const note = document.getElementById("note").value.trim();
  if (!currentVideoID) {
    updateStatus("No video ID found.");
    return;
  }

  getCurrentVideoInfo(true, (info) => {
    if (!info) return;
    const link = `https://www.youtube.com/watch?v=${info.videoId}&t=${info.seconds}`;
    const entry = `${info.time} &break ${note || "No note"} &break ${link}`;
    chrome.storage.local.get([currentVideoID], (result) => {
      const entries = result[currentVideoID] || [];
      entries.push(entry);
      chrome.storage.local.set({ [currentVideoID]: entries }, () => {
        document.getElementById("note").value = "";
        updateStatus("Timestamp saved!");
        renderTimestamps(currentVideoID, entries);
      });
    });
  });
}

function renderTimestamps(title, entries) {
  const container = document.getElementById("timestamps");
  container.innerHTML = "";

  const savedtitle = document.getElementById("savedtitle");
  savedtitle.innerHTML = "Saved Timestamps (" + entries.length + " Total)";

  if (!entries || entries.length === 0) {
    container.textContent = "No timestamps yet.";
    return;
  }

  entries.forEach((entry, index) => {
    const parts = entry.split(" &break ");
    const time = parts[0];
    const note = parts[1] || "";
    const link = parts[2];

    const div = document.createElement("div");

    const a = document.createElement("a");
    a.href = link;
    a.textContent = time;
    a.target = "_blank";
    div.appendChild(a);

    div.appendChild(document.createTextNode(` - ${note}`));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "dltBtn";
    deleteBtn.textContent = "Delete";
    deleteBtn.style.marginLeft = "10px";
    deleteBtn.addEventListener("click", () => deleteTimestamp(title, index));

    div.appendChild(deleteBtn);

    div.className = "timestampEntry";
    container.appendChild(div);
  });
}

function getYouTubeVideoID(url) {
  const match = url.match(/v=([a-zA-Z0-9_-]{11})/) || url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function deleteTimestamp(title, index) {
  chrome.storage.local.get([currentVideoID], (result) => {
    let entries = result[currentVideoID] || [];

    entries.splice(index, 1);

    chrome.storage.local.set({ [currentVideoID]: entries }, () => {
      renderTimestamps(currentVideoID, entries);
      updateStatus("Timestamp deleted!");
    });
  });
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]+/g, "_").slice(0, 100);
}

function getCurrentVideoInfo(includeTime = false, callback = () => {}) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) {
      updateStatus("No active tab.");
      return;
    }

    chrome.tabs.executeScript(tab.id, {
      code: '(' + getVideoInfo.toString() + ')();'
    }, (results) => {
      if (chrome.runtime.lastError) {
        updateStatus("Error: " + chrome.runtime.lastError.message);
        return;
      }

      const info = results[0];
      if (!info || !info.title) {
        updateStatus("Could not get video info.");
        return;
      }

      currentVideoID = info.videoId;
      if (!includeTime) {
        chrome.storage.local.get([info.videoId], (result) => {
          renderTimestamps(info.videoId, result[info.videoId] || []);
        });
      } else {
        callback(info);
      }
    });
  });
}

function getVideoInfo() {
  const video = document.querySelector("video");
  const videoUrl = location.href;
  const urlParams = new URLSearchParams(new URL(videoUrl).search);
  const videoId = urlParams.get("v");

  const titleSelectors = ['h1.title', '#container h1', 'meta[name="title"]'];
  let title = null;

  for (const selector of titleSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      title = el.textContent?.trim();
      break;
    }
  }

  if (!title && document.title) {
    title = document.title.replace(" - YouTube", "").trim();
  }

  if (!video || !title || !videoId) return null;

  const seconds = Math.floor(video.currentTime);
  const time = formatTime(seconds);
  return { title, time, seconds, videoId };

  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h > 0 ? h + ":" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
}
