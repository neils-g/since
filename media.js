'use strict';
// Photos for "Why I quit". localStorage only holds ~5 MB, so images live in
// IndexedDB (much larger quota; stays on this device). Loaded before app.js.

const Media = (() => {
  let dbp;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('since-media', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('images');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction('images', mode), req = fn(t.objectStore('images'));
      t.oncomplete = () => res(req?.result);
      t.onerror = () => rej(t.error);
    });
  };
  const urls = new Map(); // id → object URL (cached for the session)
  return {
    put: (id, blob) => tx('readwrite', s => s.put(blob, id)),
    get: id => tx('readonly', s => s.get(id)),
    keys: () => tx('readonly', s => s.getAllKeys()),
    del(id) {
      if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
      return tx('readwrite', s => s.delete(id));
    },
    async url(id) {
      if (urls.has(id)) return urls.get(id);
      const blob = await this.get(id);
      if (!blob) return null;
      const u = URL.createObjectURL(blob);
      urls.set(id, u);
      return u;
    },
  };
})();

// Shrink a photo to at most `max` px on its long side and re-encode as JPEG.
async function compressImage(file, max = 1600, quality = 0.82) {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(res, 'image/jpeg', quality));
  } finally {
    URL.revokeObjectURL(src);
  }
}

const blobToDataURL = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
const dataURLToBlob = url => fetch(url).then(r => r.blob());

// Fill in every <img data-img="id"> under root from IndexedDB.
function hydrateImages(root = document) {
  root.querySelectorAll('img[data-img]:not([src])').forEach(img => {
    Media.url(img.dataset.img).then(u => { if (u) img.src = u; else img.closest('.why-photo')?.remove(); }).catch(() => {});
  });
}

// Full-screen photo viewer; tap anywhere to close.
function openPhoto(src) {
  const v = document.createElement('div');
  v.className = 'photo-view';
  v.innerHTML = `<img src="${src}" alt="">`;
  v.onclick = () => v.remove();
  document.body.appendChild(v);
}
