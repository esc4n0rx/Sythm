export interface AudioSampleItem {
  id: string;
  name: string;
  durationSec: number;
  sampleRate: number;
  channels: number;
  sizeBytes: number;
  buffer: AudioBuffer;
}

interface StoredSampleRecord {
  id: string;
  name: string;
  sizeBytes: number;
  arrayBuffer: ArrayBuffer;
}

const DB_NAME = 'sythm.samples.db';
const STORE_NAME = 'samples';
const DB_VERSION = 1;

function openSamplesDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function decodeBytesToAudioBuffer(bytes: ArrayBuffer): Promise<AudioBuffer> {
  const OfflineCtx =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  const ctx = new OfflineCtx(1, 128, 44100);
  // Copy buffer because decodeAudioData detaches the ArrayBuffer it receives
  return ctx.decodeAudioData(bytes.slice(0));
}

async function saveRecordToDb(record: StoredSampleRecord): Promise<void> {
  const db = await openSamplesDatabase();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

function buildSampleItem(
  id: string,
  name: string,
  sizeBytes: number,
  buffer: AudioBuffer,
): AudioSampleItem {
  return {
    id,
    name,
    durationSec: buffer.duration,
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
    sizeBytes,
    buffer,
  };
}

export async function loadPersistedSamples(): Promise<AudioSampleItem[]> {
  const db = await openSamplesDatabase();
  if (!db) return [];

  const records = await new Promise<StoredSampleRecord[]>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        db.close();
        resolve((req.result as StoredSampleRecord[]) ?? []);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    } catch {
      db.close();
      resolve([]);
    }
  });

  const decoded: AudioSampleItem[] = [];
  for (const rec of records) {
    try {
      const buffer = await decodeBytesToAudioBuffer(rec.arrayBuffer);
      decoded.push(buildSampleItem(rec.id, rec.name, rec.sizeBytes, buffer));
    } catch {
      // Skip corrupted cached entry
    }
  }
  return decoded;
}

export async function importAudioFile(file: File): Promise<AudioSampleItem> {
  const bytes = await file.arrayBuffer();
  const buffer = await decodeBytesToAudioBuffer(bytes);
  const cleanName = file.name.trim() || `sample-${Date.now()}.wav`;
  const id = `smp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  await saveRecordToDb({
    id,
    name: cleanName,
    sizeBytes: bytes.byteLength,
    arrayBuffer: bytes,
  });

  return buildSampleItem(id, cleanName, bytes.byteLength, buffer);
}

export async function deletePersistedSample(id: string): Promise<void> {
  const db = await openSamplesDatabase();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

function encodeFloatBufferAsWavBytes(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const length = buffer.length;
  const blockAlign = numChannels * 2;
  const byteRate = buffer.sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const left = buffer.getChannelData(0);
  const right = numChannels > 1 ? buffer.getChannelData(1) : left;
  let offset = 44;
  for (let i = 0; i < length; i += 1) {
    for (let c = 0; c < numChannels; c += 1) {
      const s = Math.max(-1, Math.min(1, c === 0 ? left[i] : right[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return out;
}

export async function createDemoBreakbeatSample(): Promise<AudioSampleItem> {
  const sampleRate = 44100;
  const bpm = 128;
  const beatSec = 60 / bpm;
  const totalBeats = 8;
  const durationSec = beatSec * totalBeats;
  const offline = new OfflineAudioContext(2, Math.ceil(durationSec * sampleRate), sampleRate);

  const master = offline.createGain();
  master.gain.value = 0.85;
  master.connect(offline.destination);

  // Build noise buffer for snares & hihats
  const noiseLen = Math.floor(sampleRate * 0.25);
  const noiseBuf = offline.createBuffer(1, noiseLen, sampleRate);
  const noiseData = noiseBuf.getChannelData(0);
  for (let i = 0; i < noiseLen; i += 1) noiseData[i] = Math.random() * 2 - 1;

  const scheduleKick = (t: number) => {
    const osc = offline.createOscillator();
    const g = offline.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(138, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.95, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 0.24);
  };

  const scheduleSnare = (t: number) => {
    const src = offline.createBufferSource();
    src.buffer = noiseBuf;
    const hp = offline.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 1800;
    const g = offline.createGain();
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(hp);
    hp.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + 0.18);
  };

  const scheduleHat = (t: number) => {
    const src = offline.createBufferSource();
    src.buffer = noiseBuf;
    const hp = offline.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7200;
    const g = offline.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    src.connect(hp);
    hp.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + 0.065);
  };

  const scheduleSynthNote = (t: number, freqHz: number, durSec: number, gainAmt: number) => {
    const osc = offline.createOscillator();
    const filter = offline.createBiquadFilter();
    const g = offline.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freqHz, t);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(2800, freqHz * 5), t);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(gainAmt, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + durSec);
    osc.connect(filter);
    filter.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + durSec + 0.02);
  };

  // Bass notes in A minor: A1, A1, C2, G1, F1, F1, E1, G1
  const bassFreqs = [55, 55, 65.41, 49, 43.65, 43.65, 41.2, 49];
  // Lead melody notes: A4, C5, E5, G4, F4, A4, E4, G4
  const leadFreqs = [440, 523.25, 659.25, 392, 349.23, 440, 329.63, 392];

  for (let beat = 0; beat < totalBeats; beat += 1) {
    const t = beat * beatSec;
    scheduleKick(t);
    if (beat % 2 === 1) {
      scheduleSnare(t);
    }
    scheduleHat(t + beatSec * 0.5);
    scheduleSynthNote(t + beatSec * 0.25, bassFreqs[beat], beatSec * 0.65, 0.24);
    scheduleSynthNote(t, leadFreqs[beat], beatSec * 0.45, 0.14);
  }

  const rendered = await offline.startRendering();
  const wavBytes = encodeFloatBufferAsWavBytes(rendered);
  const name = 'demo-rave-loop.wav';
  const id = `smp-demo-${Date.now()}`;

  await saveRecordToDb({
    id,
    name,
    sizeBytes: wavBytes.byteLength,
    arrayBuffer: wavBytes,
  });

  return buildSampleItem(id, name, wavBytes.byteLength, rendered);
}

export function buildSampleBufferMap(samples: readonly AudioSampleItem[]): Map<string, AudioBuffer> {
  const map = new Map<string, AudioBuffer>();
  for (const item of samples) {
    map.set(item.name, item.buffer);
    map.set(item.name.toLowerCase(), item.buffer);
    const noExt = item.name.replace(/\.[^.]+$/, '');
    if (noExt) {
      map.set(noExt.toLowerCase(), item.buffer);
    }
  }
  return map;
}
