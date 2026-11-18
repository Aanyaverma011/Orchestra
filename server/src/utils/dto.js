// Shape a Job document for the API. Keeps logs/payload out of list responses.
function toJobDto(doc, { detail = false } = {}) {
  const j = doc.toObject ? doc.toObject() : doc;
  const owner = j.createdBy && j.createdBy._id ? j.createdBy : null;
  const dto = {
    id: String(j._id),
    name: j.name,
    type: j.type,
    status: j.status,
    priority: j.priority,
    attempts: j.attempts,
    maxAttempts: j.maxAttempts,
    progress: j.progress || 0,
    error: j.error || null,
    createdBy: owner ? { id: String(owner._id), name: owner.name, email: owner.email } : String(j.createdBy),
    scheduledFor: j.scheduledFor || null,
    scheduleId: j.scheduleId || null,
    startedAt: j.startedAt || null,
    finishedAt: j.finishedAt || null,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
    durationMs: j.startedAt && j.finishedAt ? new Date(j.finishedAt) - new Date(j.startedAt) : null,
    hasFile: Boolean(j.result && j.result.file),
  };
  if (detail) {
    dto.payload = j.payload;
    dto.result = j.result;
    dto.logs = j.logs || [];
    dto.explanation =
      j.explanation && j.explanation.forError === j.error
        ? { summary: j.explanation.summary, source: j.explanation.source }
        : null;
  }
  return dto;
}

module.exports = { toJobDto };
