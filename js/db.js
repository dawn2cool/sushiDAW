/*
  db.js — SushiDAW database client
  Saves/loads beats and roll history via the Ktor backend.
*/

const DB = (() => {

  // ── Beats ─────────────────────────────────────────────────

  async function saveBeat(name) {
    // Serialize the full current state (these variables come from app.js)
    const patternsJson         = JSON.stringify(patterns);
    const channelInstancesJson = JSON.stringify(channelInstances.map(i => ({
      name:     i.def.name,
      color:    i.def.color,
      emoji:    i.def.emoji || '🍱',
      voiceIdx: i.def.voiceIdx,
      instanceNum: i.instanceNum
    })));

    const res = await Auth.apiFetch('/api/beats', {
      method: 'POST',
      body: JSON.stringify({ name, bpm, numSteps, patternsJson, channelInstancesJson })
    });
    if (!res || !res.ok) throw new Error('Failed to save beat');
    const data = await res.json();
    return data.id;
  }

  async function listBeats() {
    const res = await Auth.apiFetch('/api/beats');
    if (!res || !res.ok) return [];
    return await res.json(); // Returns BeatSummary[]
  }

  async function getBeat(id) {
    const res = await Auth.apiFetch(`/api/beats/${id}`);
    if (!res || !res.ok) throw new Error('Beat not found');
    return await res.json(); // Returns full Beat object
  }

  async function deleteBeat(id) {
    const res = await Auth.apiFetch(`/api/beats/${id}`, { method: 'DELETE' });
    return res && res.ok;
  }

  // ── Roll history ──────────────────────────────────────────

  async function saveRoll({ rollName, ingredients, rating, ratingLabel, canvasDataUrl, beatId }) {
    const res = await Auth.apiFetch('/api/rolls', {
      method: 'POST',
      body: JSON.stringify({ rollName, ingredients, rating, ratingLabel, canvasDataUrl: canvasDataUrl || '', beatId: beatId || '' })
    });
    if (!res || !res.ok) return null;
    const data = await res.json();
    return data.id;
  }

  async function listRolls() {
    const res = await Auth.apiFetch('/api/rolls');
    if (!res || !res.ok) return [];
    return await res.json();
  }

  async function deleteRoll(id) {
    const res = await Auth.apiFetch(`/api/rolls/${id}`, { method: 'DELETE' });
    return res && res.ok;
  }

  return { saveBeat, listBeats, getBeat, deleteBeat, saveRoll, listRolls, deleteRoll };
})();