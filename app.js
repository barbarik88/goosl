const recordButton = document.getElementById('recordButton');
const statusLabel = document.getElementById('statusLabel');
const recordingPreview = document.getElementById('recordingPreview');
const downloadLink = document.getElementById('downloadLink');

let mediaRecorder = null;
let recordedChunks = [];
let activeStream = null;

async function startRecording() {
  try {
    recordedChunks = [];
    statusLabel.textContent = 'Выберите вкладку для записи…';

    activeStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'browser',
        logicalSurface: true,
        preferCurrentTab: true,
        frameRate: 60,
      },
      audio: false,
    });

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm;codecs=vp8';

    mediaRecorder = new MediaRecorder(activeStream, { mimeType });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      recordingPreview.src = url;
      recordingPreview.hidden = false;
      downloadLink.href = url;
      downloadLink.hidden = false;
      statusLabel.textContent = 'Запись завершена. Можно скачать файл.';

      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
        activeStream = null;
      }
    };

    mediaRecorder.start();
    statusLabel.textContent = 'Идет запись…';
    recordButton.textContent = 'Остановить запись';
  } catch (error) {
    stopAndReset();
    console.error('Не удалось начать запись', error);
    statusLabel.textContent = 'Не удалось начать запись. Проверьте разрешения.';
  }
}

function stopAndReset() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  } else if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;
  }

  mediaRecorder = null;
  recordButton.textContent = 'Начать запись';
}

recordButton.addEventListener('click', async () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    await startRecording();
  } else {
    stopAndReset();
  }
});

window.addEventListener('beforeunload', () => {
  if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop());
  }
});
