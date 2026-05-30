const video = document.querySelector("#camera");
const canvas = document.querySelector("#sampleCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const waveformCanvas = document.querySelector("#waveformDisplay");
const waveformCtx = waveformCanvas.getContext("2d");
const waveformStatus = document.querySelector("#waveformStatus");
const waveformOverlay = document.querySelector(".waveform-overlay");

const startButton = document.querySelector("#startButton");
const cameraToggle = document.querySelector("#cameraToggle");
const waveformToggle = document.querySelector("#waveformToggle");
const statusText = document.querySelector("#statusText");
const isoValue = document.querySelector("#isoValue");
const wbValue = document.querySelector("#wbValue");
const ndValue = document.querySelector("#ndValue");
const exposureHeadline = document.querySelector("#exposureHeadline");
const exposureDetail = document.querySelector("#exposureDetail");
const lumaFill = document.querySelector("#lumaFill");
const wbHeadline = document.querySelector("#wbHeadline");
const wbDetail = document.querySelector("#wbDetail");
const sceneHeadline = document.querySelector("#sceneHeadline");
const sceneDetail = document.querySelector("#sceneDetail");
const noiseHeadline = document.querySelector("#noiseHeadline");
const noiseBadge = document.querySelector("#noiseBadge");
const noiseFill = document.querySelector("#noiseFill");
const noiseDetail = document.querySelector("#noiseDetail");
const colorChip = document.querySelector("#colorChip");
const cameraSelect = document.querySelector("#cameraSelect");
const cameraBrand = document.querySelector("#cameraBrand");
const cameraModel = document.querySelector("#cameraModel");
const pictureProfile = document.querySelector("#pictureProfile");
const baseIso = document.querySelector("#baseIso");
const fps = document.querySelector("#fps");
const shutter = document.querySelector("#shutter");
const look = document.querySelector("#look");
const targetIso = document.querySelector("#targetIso");
const lowLightMode = document.querySelector("#lowLightMode");
const noiseLimit = document.querySelector("#noiseLimit");
const maxCleanIso = document.querySelector("#maxCleanIso");
const waveformMode = document.querySelector("#waveformMode");
const previewTint = document.querySelector("#previewTint");
const previewWb = document.querySelector("#previewWb");
const previewIso = document.querySelector("#previewIso");
const previewWbValue = document.querySelector("#previewWbValue");
const previewIsoValue = document.querySelector("#previewIsoValue");
const previewHeadline = document.querySelector("#previewHeadline");
const previewDetail = document.querySelector("#previewDetail");
const resetPreviewButton = document.querySelector("#resetPreviewButton");
const saveShotButton = document.querySelector("#saveShotButton");
const capturePhotoButton = document.querySelector("#capturePhotoButton");
const clearShotsButton = document.querySelector("#clearShotsButton");
const shotNotes = document.querySelector("#shotNotes");
const locationStatus = document.querySelector("#locationStatus");
const shotList = document.querySelector("#shotList");
const libraryCount = document.querySelector("#libraryCount");
const compareA = document.querySelector("#compareA");
const compareB = document.querySelector("#compareB");
const compareResult = document.querySelector("#compareResult");

let stream = null;
let facingMode = "environment";
let rafId = null;
let selectedDeviceId = "";
let latestReading = null;
let savedShots = loadShots();
let waveformVisible = localStorage.getItem("cineMeterWaveformVisible") !== "false";

const targetLumaByLook = {
  neutral: 132,
  skin: 145,
  highlight: 112,
  lowkey: 96,
};

const cameraProfiles = {
  Sony: {
    models: ["FX3 / FX30", "A7S III", "A7 IV", "FX6", "FX9"],
    profiles: ["S-Log3 / S-Gamut3.Cine", "S-Cinetone", "HLG", "Rec.709"],
    baseIso: {
      "S-Log3 / S-Gamut3.Cine": 800,
      "S-Cinetone": 125,
      HLG: 125,
      "Rec.709": 100,
    },
    cleanIso: {
      "FX3 / FX30": 12800,
      "A7S III": 12800,
      "A7 IV": 6400,
      FX6: 12800,
      FX9: 4000,
    },
  },
  Canon: {
    models: ["C70", "R5 C", "R5", "R6 Mark II", "C300 Mark III"],
    profiles: ["Canon Log 2", "Canon Log 3", "Wide DR", "Rec.709"],
    baseIso: {
      "Canon Log 2": 800,
      "Canon Log 3": 800,
      "Wide DR": 400,
      "Rec.709": 100,
    },
    cleanIso: {
      C70: 6400,
      "R5 C": 3200,
      R5: 3200,
      "R6 Mark II": 6400,
      "C300 Mark III": 6400,
    },
  },
};

async function startCamera() {
  stopCamera();
  statusText.textContent = "Opening camera...";

  try {
    const videoConstraints = selectedDeviceId
      ? {
          deviceId: { exact: selectedDeviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        }
      : {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        };

    stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false,
    });

    video.srcObject = stream;
    await video.play();
    startButton.textContent = "Restart";
    statusText.textContent = "Live meter running.";
    readTrackInfo();
    await populateCameraSelect();
    rafId = requestAnimationFrame(sampleFrame);
  } catch (error) {
    statusText.textContent = "Camera blocked. Use HTTPS or localhost, then allow camera access.";
    exposureHeadline.textContent = "Camera not available";
    exposureDetail.textContent = error.message || "The browser could not open the camera.";
  }
}

function stopCamera() {
  if (rafId) cancelAnimationFrame(rafId);
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
}

function readTrackInfo() {
  const track = stream?.getVideoTracks()[0];
  const settings = track?.getSettings?.() || {};
  if (settings.iso) {
    baseIso.value = closestIso(settings.iso);
  }
}

function closestIso(value) {
  const options = [...baseIso.options].map((option) => Number(option.value));
  return String(options.reduce((best, iso) => Math.abs(iso - value) < Math.abs(best - value) ? iso : best, options[0]));
}

function sampleFrame() {
  if (!video.videoWidth) {
    rafId = requestAnimationFrame(sampleFrame);
    return;
  }

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const stats = analyzeFrame(frame);
  updateUi(stats);
  rafId = requestAnimationFrame(sampleFrame);
}

function analyzeFrame(data) {
  let r = 0;
  let g = 0;
  let b = 0;
  let luma = 0;
  let clipped = 0;
  let crushed = 0;
  const waveform = {
    y: Array.from({ length: canvas.width }, () => []),
    r: Array.from({ length: canvas.width }, () => []),
    g: Array.from({ length: canvas.width }, () => []),
    b: Array.from({ length: canvas.width }, () => []),
  };
  const pixels = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const x = pixelIndex % canvas.width;
    const pr = data[i];
    const pg = data[i + 1];
    const pb = data[i + 2];
    const y = 0.2126 * pr + 0.7152 * pg + 0.0722 * pb;

    r += pr;
    g += pg;
    b += pb;
    luma += y;
    waveform.y[x].push(y);
    if (pixelIndex % 2 === 0) {
      waveform.r[x].push(pr);
      waveform.g[x].push(pg);
      waveform.b[x].push(pb);
    }
    if (y > 244) clipped++;
    if (y < 12) crushed++;
  }

  r /= pixels;
  g /= pixels;
  b /= pixels;
  luma /= pixels;

  return {
    r,
    g,
    b,
    luma,
    ire: Math.round((luma / 255) * 100),
    clippedPct: (clipped / pixels) * 100,
    crushedPct: (crushed / pixels) * 100,
    waveform,
    kelvin: estimateKelvin(r, g, b),
  };
}

function estimateKelvin(r, g, b) {
  const total = Math.max(1, r + g + b);
  const rn = r / total;
  const bn = b / total;
  const warmth = (rn - bn) * 100;
  const kelvin = 5600 - warmth * 92;
  return clamp(Math.round(kelvin / 100) * 100, 2500, 9000);
}

function updateUi(stats) {
  const target = targetLumaByLook[look.value];
  const iso = Number(baseIso.value);
  const recommendedIso = clampToCameraIso(Math.round((iso * target) / Math.max(12, stats.luma)));
  const nd = calculateNd(recommendedIso);
  const noise = calculateNoise(recommendedIso, stats);
  const shutterSpeed = calculateShutter();
  const lumaPct = clamp((stats.luma / 255) * 100, 0, 100);

  isoValue.textContent = String(recommendedIso);
  wbValue.textContent = `${stats.kelvin}K`;
  ndValue.textContent = nd.label;
  lumaFill.style.width = `${lumaPct}%`;
  colorChip.style.background = `rgb(${Math.round(stats.r)}, ${Math.round(stats.g)}, ${Math.round(stats.b)})`;
  drawWaveform(stats.waveform, stats.luma, stats.clippedPct, stats.crushedPct);
  latestReading = {
    iso: recommendedIso,
    targetIso: Number(targetIso.value),
    nd,
    kelvin: stats.kelvin,
    ire: stats.ire,
    luma: Math.round(stats.luma),
    clippedPct: stats.clippedPct,
    crushedPct: stats.crushedPct,
    camera: selectedCameraLabel(),
    cameraBrand: cameraBrand.value,
    cameraModel: cameraModel.value,
    pictureProfile: pictureProfile.value,
    previewWb: Number(previewWb.value),
    previewIso: Number(previewIso.value),
    lowLightMode: lowLightMode.value,
    maxCleanIso: Number(maxCleanIso.value),
    noise,
    fps: fps.value,
    shutter: `${shutter.value} deg`,
    look: look.options[look.selectedIndex]?.textContent || look.value,
    color: `rgb(${Math.round(stats.r)}, ${Math.round(stats.g)}, ${Math.round(stats.b)})`,
  };
  updatePreviewDetail(stats.kelvin, recommendedIso);

  const exposure = exposureMessage(stats.luma, target, recommendedIso, shutterSpeed);
  exposureHeadline.textContent = exposure.headline;
  exposureDetail.textContent = exposure.detail;

  wbHeadline.textContent = `${stats.kelvin}K`;
  wbDetail.textContent = wbMessage(stats.kelvin);

  const scene = sceneMessage(stats);
  sceneHeadline.textContent = scene.headline;
  sceneDetail.textContent = scene.detail;
  sceneHeadline.className = scene.ok ? "good" : "warning";
  updateNoiseUi(noise);
}

function populateCameraMetadata() {
  const brand = cameraBrand.value;
  const config = cameraProfiles[brand];
  const previousModel = cameraModel.value;
  const previousProfile = pictureProfile.value;

  cameraModel.innerHTML = "";
  pictureProfile.innerHTML = "";
  config.models.forEach((model) => cameraModel.append(new Option(model, model)));
  config.profiles.forEach((profile) => pictureProfile.append(new Option(profile, profile)));

  cameraModel.value = config.models.includes(previousModel) ? previousModel : config.models[0];
  pictureProfile.value = config.profiles.includes(previousProfile) ? previousProfile : config.profiles[0];
  applyProfileBaseIso();
  updatePreviewControls();
}

function applyProfileBaseIso() {
  const iso = cameraProfiles[cameraBrand.value]?.baseIso[pictureProfile.value];
  if (iso) {
    baseIso.value = closestIso(iso);
    targetIso.value = closestTargetIso(Math.min(800, iso));
  }
  const cleanIso = cameraProfiles[cameraBrand.value]?.cleanIso[cameraModel.value];
  if (cleanIso) maxCleanIso.value = closestMaxCleanIso(cleanIso);
}

function closestTargetIso(value) {
  const options = [...targetIso.options].map((option) => Number(option.value));
  return String(options.reduce((best, iso) => Math.abs(iso - value) < Math.abs(best - value) ? iso : best, options[0]));
}

function closestMaxCleanIso(value) {
  const options = [...maxCleanIso.options].map((option) => Number(option.value));
  return String(options.reduce((best, iso) => Math.abs(iso - value) < Math.abs(best - value) ? iso : best, options[0]));
}

function updatePreviewControls() {
  previewWbValue.textContent = `${previewWb.value}K`;
  previewIsoValue.textContent = previewIso.value;
  previewHeadline.textContent = `${cameraBrand.value} ${cameraModel.value}`;
  applyPreviewLook();
  if (latestReading) updatePreviewDetail(latestReading.kelvin, latestReading.iso);
}

function applyPreviewLook() {
  const wb = Number(previewWb.value);
  const iso = Number(previewIso.value);
  const base = Math.max(50, Number(baseIso.value));
  const brightness = clamp(Math.pow(iso / base, 0.42), 0.55, 1.85);
  const warmth = clamp((5600 - wb) / 3300, -1, 1);
  const tintColor = warmth >= 0 ? "rgba(255, 165, 72, 1)" : "rgba(90, 170, 255, 1)";
  const tintOpacity = Math.min(0.34, Math.abs(warmth) * 0.34);

  document.documentElement.style.setProperty("--preview-brightness", String(brightness));
  document.documentElement.style.setProperty("--preview-tint", tintColor);
  document.documentElement.style.setProperty("--preview-tint-opacity", String(tintOpacity));
  previewTint.style.opacity = String(tintOpacity);
}

function updatePreviewDetail(measuredKelvin, recommendedIso) {
  const wbDelta = Number(previewWb.value) - measuredKelvin;
  const isoDeltaStops = Math.log2(Number(previewIso.value) / Math.max(1, recommendedIso));
  const wbText = Math.abs(wbDelta) <= 200 ? "WB preview is close to the phone reading" : `WB preview is ${Math.abs(wbDelta)}K ${wbDelta > 0 ? "cooler" : "warmer"} than the phone reading`;
  const isoText = Math.abs(isoDeltaStops) < 0.2 ? "ISO preview is close" : `ISO preview is ${Math.abs(isoDeltaStops).toFixed(1)} stops ${isoDeltaStops > 0 ? "brighter" : "darker"}`;
  previewDetail.textContent = `${wbText}. ${isoText}. Save this reading with ${cameraBrand.value} ${cameraModel.value}, ${pictureProfile.value}.`;
}

function resetPreview() {
  const wb = latestReading?.kelvin || 5600;
  const iso = latestReading?.iso || Number(baseIso.value);
  previewWb.value = String(clamp(Math.round(wb / 100) * 100, 2500, 9000));
  previewIso.value = String(clampToCameraIso(iso));
  updatePreviewControls();
}

function calculateNoise(recommendedIso, stats) {
  const cleanLimit = Number(maxCleanIso.value);
  const toleranceStops = {
    clean: 0,
    balanced: 1,
    push: 2,
  }[noiseLimit.value];
  const allowedIso = cleanLimit * (2 ** toleranceStops);
  const overStops = Math.log2(Math.max(1, recommendedIso) / Math.max(1, allowedIso));
  const under = stats.luma < 58 || stats.crushedPct > 14;
  const score = clamp(((Math.max(0, overStops) / 2.5) * 70) + (under ? 24 : 0), 0, 100);
  let level = "Clean";
  if (score >= 68) level = "Noisy";
  else if (score >= 34) level = "Risk";

  return {
    level,
    score,
    cleanLimit,
    allowedIso,
    overStops,
    under,
    advice: lowLightAdvice(level, recommendedIso, allowedIso, under),
  };
}

function lowLightAdvice(level, recommendedIso, allowedIso, under) {
  if (lowLightMode.value === "see") {
    return `See In Dark is active. ISO ${recommendedIso} may reveal the scene, but expect noise; expose faces and protect important shadows.`;
  }
  if (level === "Clean") {
    return `ISO ${recommendedIso} is within the selected clean limit. Keep exposure here, or save this as a low-light reference.`;
  }
  if (level === "Risk") {
    return `Try to stay near ISO ${Math.round(allowedIso)}. Open the lens, add a small key/fill, or use a slower shutter angle before pushing ISO.`;
  }
  return `ISO ${recommendedIso} is likely noisy. Add light, open aperture, reduce frame rate, use 360 deg shutter if motion allows, or accept noise intentionally.`;
}

function updateNoiseUi(noise) {
  noiseHeadline.textContent = noise.level === "Clean" ? "Clean ISO range" : noise.level === "Risk" ? "Noise risk rising" : "Likely noisy";
  noiseBadge.textContent = noise.level;
  noiseBadge.className = `noise-badge ${noise.level === "Clean" ? "good" : "warning"}`;
  noiseFill.style.width = `${Math.round(noise.score)}%`;
  noiseDetail.textContent = noise.advice;
}

function calculateNd(recommendedIso) {
  const target = Number(targetIso.value);
  const stops = Math.max(0, Math.log2(Math.max(1, recommendedIso) / Math.max(1, target)));
  const roundedStops = Math.round(stops * 3) / 3;
  const ndNumber = roundedStops <= 0 ? 0 : Math.round(roundedStops * 3) / 10;
  return {
    stops: roundedStops,
    label: roundedStops <= 0 ? "Clear" : `ND ${ndNumber.toFixed(1)}`,
  };
}

function drawWaveform(waveform, luma, clippedPct, crushedPct) {
  if (!waveformVisible) return;

  const width = waveformCanvas.width;
  const height = waveformCanvas.height;

  waveformCtx.clearRect(0, 0, width, height);
  waveformCtx.fillStyle = "#101316";
  waveformCtx.fillRect(0, 0, width, height);

  waveformCtx.fillStyle = "rgba(239, 108, 99, 0.14)";
  waveformCtx.fillRect(0, 0, width, height * 0.12);
  waveformCtx.fillStyle = "rgba(85, 200, 189, 0.09)";
  waveformCtx.fillRect(0, height * 0.88, width, height * 0.12);

  waveformCtx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  waveformCtx.lineWidth = 1;
  [0, 10, 40, 50, 70, 90, 100].forEach((ire) => {
    const y = ireToY(ire, height) + 0.5;
    waveformCtx.beginPath();
    waveformCtx.moveTo(0, y);
    waveformCtx.lineTo(width, y);
    waveformCtx.stroke();
  });

  waveformCtx.globalCompositeOperation = "lighter";

  if (waveformMode.value === "rgb") {
    drawWaveformTrace(waveform.r, 0, width / 3, height, "rgba(255, 86, 78, 0.22)");
    drawWaveformTrace(waveform.g, width / 3, width / 3, height, "rgba(93, 230, 122, 0.22)");
    drawWaveformTrace(waveform.b, (width / 3) * 2, width / 3, height, "rgba(84, 156, 255, 0.22)");
    waveformCtx.globalCompositeOperation = "source-over";
    drawParadeLabels(width, height);
  } else {
    drawWaveformTrace(waveform.y, 0, width, height, "rgba(85, 200, 189, 0.2)");
    waveformCtx.globalCompositeOperation = "source-over";
  }

  waveformCtx.globalCompositeOperation = "source-over";

  if (waveformStatus) {
    if (clippedPct > 4) {
      waveformStatus.textContent = "Clipping";
      waveformStatus.className = "warning";
    } else if (crushedPct > 8) {
      waveformStatus.textContent = "Crushed";
      waveformStatus.className = "warning";
    } else if (luma >= 112 && luma <= 150) {
      waveformStatus.textContent = "Balanced";
      waveformStatus.className = "good";
    } else {
      waveformStatus.textContent = "Watch";
      waveformStatus.className = "";
    }
  }
}

function updateWaveformToggle() {
  waveformOverlay.classList.toggle("is-hidden", !waveformVisible);
  waveformToggle.classList.toggle("is-on", waveformVisible);
  waveformToggle.setAttribute("aria-pressed", String(waveformVisible));
  waveformToggle.textContent = waveformVisible ? "Wave" : "Off";
}

function drawWaveformTrace(columns, offsetX, drawWidth, height, color) {
  const scaleX = drawWidth / columns.length;
  waveformCtx.fillStyle = color;
  columns.forEach((column, columnIndex) => {
    const x = Math.round(offsetX + columnIndex * scaleX);
    const pixelWidth = Math.max(1, Math.ceil(scaleX));
    column.forEach((value) => {
      const y = Math.round(ireToY((value / 255) * 100, height));
      waveformCtx.fillRect(x, y, pixelWidth, 1.5);
    });
  });
}

function drawParadeLabels(width, height) {
  waveformCtx.fillStyle = "rgba(245, 241, 234, 0.62)";
  waveformCtx.font = "700 12px system-ui, sans-serif";
  waveformCtx.fillText("R", 10, height - 10);
  waveformCtx.fillText("G", width / 3 + 10, height - 10);
  waveformCtx.fillText("B", (width / 3) * 2 + 10, height - 10);
}

function ireToY(ire, height) {
  return Math.round(height - clamp(ire, 0, 100) / 100 * height);
}

async function populateCameraSelect() {
  if (!navigator.mediaDevices?.enumerateDevices) return;

  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter((device) => device.kind === "videoinput");
  const currentTrack = stream?.getVideoTracks()[0];
  const currentDeviceId = currentTrack?.getSettings?.().deviceId || selectedDeviceId;
  const currentValue = currentDeviceId || selectedDeviceId;

  cameraSelect.innerHTML = "";
  const autoOption = new Option("Auto Back Camera", "");
  cameraSelect.append(autoOption);

  cameras.forEach((camera, index) => {
    const label = camera.label || `Camera ${index + 1}`;
    cameraSelect.append(new Option(label, camera.deviceId));
  });

  cameraSelect.value = [...cameraSelect.options].some((option) => option.value === currentValue) ? currentValue : "";
  selectedDeviceId = cameraSelect.value;
  cameraSelect.disabled = cameras.length === 0;
}

function exposureMessage(luma, target, recommendedIso, shutterSpeed) {
  const nd = calculateNd(recommendedIso);
  const delta = luma - target;
  if (Math.abs(delta) <= 14) {
    return {
      headline: `Hold ISO ${recommendedIso}`,
      detail: `Exposure is close for ${fps.value} fps at about 1/${shutterSpeed}. ${nd.label === "Clear" ? "No ND needed for the selected target ISO." : `Use about ${nd.label} to stay near ISO ${targetIso.value}.`}`,
    };
  }

  if (delta < 0) {
    return {
      headline: `Raise to ISO ${recommendedIso}`,
      detail: `The scene is under target. If noise becomes too high, add light or open the lens before pushing ISO further.`,
    };
  }

  return {
    headline: `Lower to ISO ${recommendedIso}`,
    detail: `The scene is over target. ${nd.label === "Clear" ? "Lower ISO, add ND, or stop down to protect highlight detail." : `Start around ${nd.label}, then protect highlights with the waveform.`}`,
  };
}

function selectedCameraLabel() {
  return cameraSelect.options[cameraSelect.selectedIndex]?.textContent || "Auto Back Camera";
}

function loadShots() {
  try {
    return JSON.parse(localStorage.getItem("cineMeterShots") || "[]");
  } catch {
    return [];
  }
}

function saveShots() {
  localStorage.setItem("cineMeterShots", JSON.stringify(savedShots));
}

async function getLocationTag() {
  if (!navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        lat: Number(position.coords.latitude.toFixed(5)),
        lon: Number(position.coords.longitude.toFixed(5)),
      }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 4500, maximumAge: 60000 },
    );
  });
}

async function saveCurrentShot() {
  if (!latestReading) {
    statusText.textContent = "Start the camera before saving a reading.";
    return;
  }

  saveShotButton.disabled = true;
  saveShotButton.textContent = "Saving";
  locationStatus.textContent = "Checking location permission...";
  const location = await getLocationTag();

  const shot = buildShot(location);
  savedShots.unshift(shot);
  savedShots = savedShots.slice(0, 30);
  saveShots();
  renderShotLibrary();
  shotNotes.value = "";
  locationStatus.textContent = location ? `Saved with location ${location.lat}, ${location.lon}.` : "Saved without location.";
  saveShotButton.disabled = false;
  saveShotButton.textContent = "Save";
}

function buildShot(location, photo = null) {
  return {
    id: String(Date.now()),
    createdAt: new Date().toISOString(),
    notes: shotNotes.value.trim(),
    location,
    reading: latestReading,
    photo,
  };
}

async function capturePhotoWithMetadata() {
  if (!latestReading || !video.videoWidth) {
    statusText.textContent = "Start the camera before capturing a photo.";
    return;
  }

  capturePhotoButton.disabled = true;
  capturePhotoButton.textContent = "Capturing";
  locationStatus.textContent = "Preparing reference photo...";

  const location = await getLocationTag();
  const photo = createMetadataPhoto(location);
  const shot = buildShot(location, {
    thumb: photo.thumb,
    filename: photo.filename,
  });

  savedShots.unshift(shot);
  savedShots = savedShots.slice(0, 20);
  saveShots();
  renderShotLibrary();
  await shareOrDownloadPhoto(photo.image, photo.filename);

  shotNotes.value = "";
  locationStatus.textContent = "Reference photo saved with metadata on the image.";
  capturePhotoButton.disabled = false;
  capturePhotoButton.textContent = "Capture Photo";
}

function createMetadataPhoto(location) {
  const width = Math.min(1600, video.videoWidth || 1280);
  const height = Math.round(width * ((video.videoHeight || 720) / (video.videoWidth || 1280)));
  const slateHeight = 340;
  const photoCanvas = document.createElement("canvas");
  const photoCtx = photoCanvas.getContext("2d");
  photoCanvas.width = width;
  photoCanvas.height = height + slateHeight;

  photoCtx.drawImage(video, 0, 0, width, height);
  photoCtx.fillStyle = "#111417";
  photoCtx.fillRect(0, height, width, slateHeight);
  photoCtx.fillStyle = "#55c8bd";
  photoCtx.font = "700 28px system-ui, sans-serif";
  photoCtx.fillText("Cine Meter Reference", 36, height + 48);
  photoCtx.fillStyle = "#f5f1ea";
  photoCtx.font = "700 34px system-ui, sans-serif";
  photoCtx.fillText(`${latestReading.cameraBrand} ${latestReading.cameraModel}`, 36, height + 92);

  const rows = metadataRows(location);
  photoCtx.font = "24px system-ui, sans-serif";
  rows.forEach((row, index) => {
    const x = index % 2 === 0 ? 36 : Math.round(width * 0.52);
    const y = height + 140 + Math.floor(index / 2) * 42;
    photoCtx.fillStyle = "#aeb7bb";
    photoCtx.fillText(`${row.label}:`, x, y);
    photoCtx.fillStyle = "#f5f1ea";
    photoCtx.fillText(row.value, x + 150, y);
  });

  if (shotNotes.value.trim()) {
    photoCtx.fillStyle = "#aeb7bb";
    photoCtx.font = "22px system-ui, sans-serif";
    photoCtx.fillText(`Notes: ${shotNotes.value.trim().slice(0, 110)}`, 36, height + slateHeight - 34);
  }

  const filename = `cine-meter-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
  return {
    filename,
    image: photoCanvas.toDataURL("image/png"),
    thumb: makeThumbnail(photoCanvas),
  };
}

function metadataRows(location) {
  return [
    { label: "Profile", value: latestReading.pictureProfile },
    { label: "ISO", value: `${latestReading.iso} / preview ${latestReading.previewIso}` },
    { label: "WB", value: `${latestReading.kelvin}K / preview ${latestReading.previewWb}K` },
    { label: "ND", value: latestReading.nd.label },
    { label: "FPS", value: latestReading.fps },
    { label: "Shutter", value: latestReading.shutter },
    { label: "Noise", value: `${latestReading.noise?.level || "--"} max ${latestReading.maxCleanIso}` },
    { label: "IRE", value: String(latestReading.ire) },
    { label: "Location", value: location ? `${location.lat}, ${location.lon}` : "Not saved" },
    { label: "Time", value: new Date().toLocaleString() },
  ];
}

function makeThumbnail(sourceCanvas) {
  const thumbCanvas = document.createElement("canvas");
  const ratio = sourceCanvas.width / sourceCanvas.height;
  thumbCanvas.width = 520;
  thumbCanvas.height = Math.round(520 / ratio);
  thumbCanvas.getContext("2d").drawImage(sourceCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  return thumbCanvas.toDataURL("image/jpeg", 0.72);
}

async function shareOrDownloadPhoto(dataUrl, filename) {
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({
        files: [file],
        title: "Cine Meter Reference",
        text: "Camera settings reference photo",
      });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

function clearShots() {
  savedShots = [];
  saveShots();
  renderShotLibrary();
  locationStatus.textContent = "Shot library cleared.";
}

function renderShotLibrary() {
  libraryCount.textContent = savedShots.length ? `${savedShots.length} saved reading${savedShots.length === 1 ? "" : "s"}` : "No saved readings";
  shotList.innerHTML = "";
  compareA.innerHTML = "";
  compareB.innerHTML = "";

  if (!savedShots.length) {
    compareA.append(new Option("No readings", ""));
    compareB.append(new Option("No readings", ""));
    compareResult.textContent = "Save two readings to compare exposure and white balance.";
    return;
  }

  savedShots.forEach((shot, index) => {
    const date = new Date(shot.createdAt);
    const title = `${index + 1}. ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    compareA.append(new Option(title, shot.id));
    compareB.append(new Option(title, shot.id));

    const item = document.createElement("article");
    item.className = "shot-item";
    item.innerHTML = `
      ${shot.photo?.thumb ? `<img class="shot-photo" src="${shot.photo.thumb}" alt="Captured reference photo">` : ""}
      <strong>${title}</strong>
      <div class="shot-meta">
        <span>${shot.reading.kelvin}K</span>
        <span>ISO ${shot.reading.iso}</span>
        <span>${shot.reading.nd.label}</span>
        <span>${shot.reading.ire} IRE</span>
        <span>${shot.reading.noise?.level || "Noise --"}</span>
        <span>${shot.reading.cameraBrand || "Camera"} ${shot.reading.cameraModel || ""}</span>
      </div>
      <p>${escapeHtml(shot.notes || shot.reading.camera)}</p>
    `;
    shotList.append(item);
  });

  compareA.value = savedShots[0]?.id || "";
  compareB.value = savedShots[1]?.id || savedShots[0]?.id || "";
  updateComparison();
}

function updateComparison() {
  const a = savedShots.find((shot) => shot.id === compareA.value);
  const b = savedShots.find((shot) => shot.id === compareB.value);
  if (!a || !b || a.id === b.id) {
    compareResult.textContent = savedShots.length > 1 ? "Choose two different readings to compare." : "Save one more reading to compare scenes.";
    return;
  }

  const kelvinDelta = b.reading.kelvin - a.reading.kelvin;
  const ireDelta = b.reading.ire - a.reading.ire;
  const ndDelta = b.reading.nd.stops - a.reading.nd.stops;
  const wbDirection = kelvinDelta > 0 ? "cooler" : "warmer";
  const exposureDirection = ireDelta > 0 ? "brighter" : "darker";
  compareResult.textContent = `Match is ${Math.abs(kelvinDelta)}K ${wbDirection}, ${Math.abs(ireDelta)} IRE ${exposureDirection}, ND shift ${ndDelta.toFixed(1)} stops.`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[char]));
}

function wbMessage(kelvin) {
  if (kelvin <= 3400) return "Warm source detected. Try tungsten balance around 3200K, then fine tune by skin tone.";
  if (kelvin >= 6800) return "Cool source detected. Try shade/cloud balance around 7000K to keep whites neutral.";
  if (kelvin >= 5000 && kelvin <= 6200) return "Daylight range. Start near 5600K for a neutral image.";
  return "Mixed or practical light range. Start here, then check skin and white surfaces.";
}

function sceneMessage(stats) {
  if (stats.clippedPct > 4) {
    return {
      ok: false,
      headline: "Highlights clipping",
      detail: `${stats.clippedPct.toFixed(1)}% of the frame is near pure white. Use ND, lower ISO, or reduce direct light.`,
    };
  }
  if (stats.crushedPct > 8) {
    return {
      ok: false,
      headline: "Shadows crushing",
      detail: `${stats.crushedPct.toFixed(1)}% of the frame is near black. Add fill or raise exposure if detail matters.`,
    };
  }
  return {
    ok: true,
    headline: "Scene looks usable",
    detail: "No major clipping warning. Subject-area readings give the cleanest result.",
  };
}

function calculateShutter() {
  const fpsValue = Number(fps.value);
  const angle = Number(shutter.value);
  return Math.round((fpsValue * 360) / angle);
}

function clampToCameraIso(value) {
  const stops = [50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400];
  return stops.reduce((best, iso) => Math.abs(iso - value) < Math.abs(best - value) ? iso : best, stops[0]);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

startButton.addEventListener("click", startCamera);
waveformToggle.addEventListener("click", () => {
  waveformVisible = !waveformVisible;
  localStorage.setItem("cineMeterWaveformVisible", String(waveformVisible));
  updateWaveformToggle();
});
cameraToggle.addEventListener("click", () => {
  selectedDeviceId = "";
  cameraSelect.value = "";
  facingMode = facingMode === "environment" ? "user" : "environment";
  startCamera();
});

[baseIso, fps, shutter, look, targetIso, lowLightMode, noiseLimit, maxCleanIso, waveformMode].forEach((input) => input.addEventListener("change", () => {
  if (!stream) return;
  statusText.textContent = "Settings updated.";
}));

[previewWb, previewIso].forEach((input) => input.addEventListener("input", updatePreviewControls));

cameraBrand.addEventListener("change", populateCameraMetadata);
pictureProfile.addEventListener("change", () => {
  applyProfileBaseIso();
  updatePreviewControls();
});
cameraModel.addEventListener("change", () => {
  applyProfileBaseIso();
  updatePreviewControls();
});
resetPreviewButton.addEventListener("click", resetPreview);

cameraSelect.addEventListener("change", () => {
  selectedDeviceId = cameraSelect.value;
  if (selectedDeviceId) facingMode = "environment";
  startCamera();
});

if (!navigator.mediaDevices?.getUserMedia) {
  startButton.disabled = true;
  statusText.textContent = "This browser does not support camera access.";
}

saveShotButton.addEventListener("click", saveCurrentShot);
capturePhotoButton.addEventListener("click", capturePhotoWithMetadata);
clearShotsButton.addEventListener("click", clearShots);
compareA.addEventListener("change", updateComparison);
compareB.addEventListener("change", updateComparison);
renderShotLibrary();
populateCameraMetadata();
updatePreviewControls();
updateWaveformToggle();
