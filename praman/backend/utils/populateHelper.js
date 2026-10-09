const { supabase } = require('../config/db');

/**
 * Format a record so both `_id` and `id` exist for full compatibility
 */
const formatRecord = (item) => {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    _id: item.id || item._id,
  };
};

/**
 * Populate foreign key user references in objects or arrays of objects
 */
const populateUsers = async (data, fields = ['uploadedBy', 'currentHolder', 'courtAssignedTo', 'courtReviewedBy', 'fromUser', 'toUser', 'performedBy', 'user']) => {
  if (!data) return data;
  const isArray = Array.isArray(data);
  const items = isArray ? data.map(formatRecord) : [formatRecord(data)];

  // Gather unique user IDs
  const userIds = new Set();
  items.forEach((item) => {
    fields.forEach((field) => {
      const val = item[field];
      if (val) {
        const id = typeof val === 'object' ? (val.id || val._id) : val;
        if (id) userIds.add(id);
      }
    });

    if (Array.isArray(item.notes)) {
      item.notes.forEach((note) => {
        if (note.addedBy) {
          const noteUserId = typeof note.addedBy === 'object' ? (note.addedBy.id || note.addedBy._id) : note.addedBy;
          if (noteUserId) userIds.add(noteUserId);
        }
      });
    }
  });

  if (userIds.size === 0) return isArray ? items : items[0];

  const { data: users } = await supabase
    .from('users')
    .select('id, name, email, role')
    .in('id', Array.from(userIds));

  const userMap = {};
  if (users) {
    users.forEach((u) => {
      userMap[u.id] = { ...u, _id: u.id };
    });
  }

  items.forEach((item) => {
    fields.forEach((field) => {
      const val = item[field];
      if (val) {
        const id = typeof val === 'object' ? (val.id || val._id) : val;
        if (id && userMap[id]) {
          item[field] = userMap[id];
        }
      }
    });

    if (Array.isArray(item.notes)) {
      item.notes = item.notes.map((note) => {
        const noteUserId = typeof note.addedBy === 'object' ? (note.addedBy.id || note.addedBy._id) : note.addedBy;
        return {
          ...note,
          addedBy: (noteUserId && userMap[noteUserId]) ? userMap[noteUserId] : note.addedBy,
        };
      });
    }
  });

  return isArray ? items : items[0];
};

/**
 * Populate evidence reference object in audit/custody logs
 */
const populateEvidence = async (data) => {
  if (!data) return data;
  const isArray = Array.isArray(data);
  const items = isArray ? data.map(formatRecord) : [formatRecord(data)];

  const evidenceIds = new Set();
  items.forEach((item) => {
    if (item.evidence) {
      const evId = typeof item.evidence === 'object' ? (item.evidence.id || item.evidence._id) : item.evidence;
      if (evId) evidenceIds.add(evId);
    }
  });

  if (evidenceIds.size === 0) return isArray ? items : items[0];

  const { data: evidences } = await supabase
    .from('evidence')
    .select('id, evidenceId, caseNumber, title')
    .in('id', Array.from(evidenceIds));

  const evMap = {};
  if (evidences) {
    evidences.forEach((ev) => {
      evMap[ev.id] = { ...ev, _id: ev.id };
    });
  }

  items.forEach((item) => {
    if (item.evidence) {
      const evId = typeof item.evidence === 'object' ? (item.evidence.id || item.evidence._id) : item.evidence;
      if (evId && evMap[evId]) {
        item.evidence = evMap[evId];
      }
    }
  });

  return isArray ? items : items[0];
};

module.exports = { formatRecord, populateUsers, populateEvidence };
