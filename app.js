const recordButton = document.getElementById('recordButton');
const statusLabel = document.getElementById('statusLabel');
const recordingPreview = document.getElementById('recordingPreview');
const downloadLink = document.getElementById('downloadLink');
const slotFrame = document.getElementById('slotFrame');
const recordCanvas = document.getElementById('recordCanvas');
const formatButtons = document.querySelectorAll('.format-button');

const FRAME_RATE = 30;
const FRAME_INTERVAL = 1000 / FRAME_RATE;
let mediaRecorder = null;
let recordedChunks = [];
let activeStream = null;
let isRecording = false;
let renderToken = 0;
let captureScale = 1;
let lastRecordingUrl = '';

function setActiveRatio(ratio) {
  const ratioClass = `ratio-${ratio}`;
  if (!slotFrame.classList.contains(ratioClass)) {
    slotFrame.classList.remove('ratio-9-16', 'ratio-1-1');
    slotFrame.classList.add(ratioClass);
  }

  formatButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.ratio === ratio);
  });

  if (isRecording) {
    stopRenderLoop();
    window.requestAnimationFrame(() => {
      prepareCanvas();
      startRenderLoop();
    });
  }
}

formatButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const { ratio } = button.dataset;
    setActiveRatio(ratio);
  });
});

setActiveRatio(slotFrame.classList.contains('ratio-1-1') ? '1-1' : '9-16');

function prepareCanvas() {
  const rect = slotFrame.getBoundingClientRect();
  captureScale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  recordCanvas.width = Math.round(rect.width * captureScale);
  recordCanvas.height = Math.round(rect.height * captureScale);
  const context = recordCanvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
}

function stopRenderLoop() {
  renderToken += 1;
}

function startRenderLoop() {
  const token = ++renderToken;

  const renderFrame = async () => {
    if (!isRecording || token !== renderToken) {
      return;
    }

    try {
      await window.html2canvas(slotFrame, {
        canvas: recordCanvas,
        backgroundColor: null,
        scale: captureScale,
        logging: false,
        useCORS: true,
        removeContainer: true,
      });
    } catch (error) {
      console.error('Failed to render slot frame', error);
      stopRecording(true);
      statusLabel.textContent = 'Rendering error. Recording stopped.';
      return;
    }

    if (!isRecording || token !== renderToken) {
      return;
    }

    setTimeout(renderFrame, FRAME_INTERVAL);
  };

  renderFrame();
}

async function startRecording() {
  if (typeof window.html2canvas !== 'function') {
    statusLabel.textContent = 'Capture tool failed to load.';
    return;
  }

  recordedChunks = [];
  if (lastRecordingUrl) {
    URL.revokeObjectURL(lastRecordingUrl);
    lastRecordingUrl = '';
  }
  recordingPreview.hidden = true;
  recordingPreview.pause();
  downloadLink.hidden = true;
  recordButton.disabled = true;
  statusLabel.textContent = 'Preparing capture…';

  await new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      prepareCanvas();
      resolve();
    });
  });

  const stream = recordCanvas.captureStream(FRAME_RATE);
  activeStream = stream;

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm;codecs=vp8';

  try {
    mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 8_000_000,
    });
  } catch (error) {
    console.error('Failed to create MediaRecorder', error);
    statusLabel.textContent = 'Recording is not supported in this browser.';
    recordButton.disabled = false;
    return;
  }

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = () => {
    if (lastRecordingUrl) {
      URL.revokeObjectURL(lastRecordingUrl);
      lastRecordingUrl = '';
    }

    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    lastRecordingUrl = url;

    recordingPreview.src = url;
    recordingPreview.hidden = false;
    recordingPreview.load();
    downloadLink.href = url;
    downloadLink.hidden = false;
    statusLabel.textContent = 'Recording finished. You can download the file.';

    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
      activeStream = null;
    }

    mediaRecorder = null;
    recordButton.textContent = 'Start recording';
    recordButton.disabled = false;
  };

  mediaRecorder.start();
  isRecording = true;
  recordButton.textContent = 'Stop recording';
  recordButton.disabled = false;
  statusLabel.textContent = 'Recording…';
  startRenderLoop();
}

function stopRecording(force = false) {
  if (!mediaRecorder) {
    if (force) {
      isRecording = false;
      stopRenderLoop();
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
        activeStream = null;
      }
      recordButton.textContent = 'Start recording';
      recordButton.disabled = false;
    }
    return;
  }

  isRecording = false;
  stopRenderLoop();

  if (mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

recordButton.addEventListener('click', async () => {
  if (isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
});

window.addEventListener('beforeunload', () => {
  stopRecording(true);
});
