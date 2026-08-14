const { Op, fn, col, literal } = require('sequelize');
const {
  sequelize,
  ReportingPatient,
  ReportingAssessment,
  ReportingQuestionnaire,
  ReportingTherapySession,
  ReportingTherapist,
  ReportingActivityFact,
  ReportingIngestionBatch,
} = require('../models');
const env = require('../config/env');
const { redact, publicEvent } = require('../utils/redaction');
const { AuthorizationError, NotFoundError, ValidationError } = require('../utils/errors');

const MODEL_BY_ENTITY = {
  patient: ReportingPatient,
  assessment: ReportingAssessment,
  questionnaire: ReportingQuestionnaire,
  therapy_session: ReportingTherapySession,
  therapist: ReportingTherapist,
  activity: ReportingActivityFact,
};

const field = (data, ...keys) => keys.map((key) => data?.[key]).find((value) => value !== undefined && value !== null);
const asUuidOrNull = (value) => (typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? value : null);
const asDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const requireTenant = (context, filters = {}) => {
  const requestedTenantId = filters.tenantId || context?.tenantId;
  if (!requestedTenantId) throw new AuthorizationError('Contexto de tenant obrigatório', 'TENANT_CONTEXT_REQUIRED');
  if (context?.tenantId && requestedTenantId !== context.tenantId) {
    throw new AuthorizationError('Tenant fora do escopo autorizado', 'TENANT_SCOPE_DENIED');
  }

  const requestedOrganizationId = filters.organizationId || null;
  const allowedOrganizations = Array.isArray(context?.organizationIds) ? context.organizationIds : [];
  if (requestedOrganizationId && allowedOrganizations.length > 0 && !allowedOrganizations.includes(requestedOrganizationId) && !context?.isService) {
    throw new AuthorizationError('Organização fora do escopo autorizado', 'ORGANIZATION_SCOPE_DENIED');
  }
  if (!requestedOrganizationId && allowedOrganizations.length > 0 && !context?.isService) {
    return { tenantId: requestedTenantId, organizationId: { [Op.in]: allowedOrganizations } };
  }
  return { tenantId: requestedTenantId, ...(requestedOrganizationId ? { organizationId: requestedOrganizationId } : {}) };
};

const buildWhere = (context, filters = {}) => {
  const scope = requireTenant(context, filters);
  const where = { ...scope, isTombstone: false };
  if (filters.patientId) where.patientId = filters.patientId;
  if (filters.therapistId) where.therapistId = filters.therapistId;
  if (filters.userId) where.userId = filters.userId;
  if (filters.status) where.status = filters.status;
  if (filters.classification) where.classification = filters.classification;
  if (filters.eventType) where.eventType = filters.eventType;
  const dateField = filters.dateField || null;
  if (filters.startDate || filters.endDate) {
    const range = {};
    if (filters.startDate) range[Op.gte] = filters.startDate;
    if (filters.endDate) range[Op.lte] = filters.endDate;
    where[dateField || 'createdAt'] = range;
  }
  if (filters.search) {
    const search = `%${filters.search}%`;
    where[Op.or] = [
      { fullName: { [Op.iLike]: search } },
      { initials: { [Op.iLike]: search } },
      { displayName: { [Op.iLike]: search } },
      { sourceId: { [Op.iLike]: search } },
    ];
  }
  return where;
};

const publicRecord = (record) => {
  const value = typeof record?.toJSON === 'function' ? record.toJSON() : record;
  const clean = redact(value);
  delete clean.sourceSystem;
  delete clean.sourceId;
  delete clean.sourceVersion;
  delete clean.sourceUpdatedAt;
  delete clean.isTombstone;
  return clean;
};

const eventToAttributes = (event) => {
  const data = redact(event.data || {});
  const common = {
    sourceSystem: event.sourceSystem,
    sourceId: event.sourceId,
    sourceVersion: event.sourceVersion || null,
    sourceUpdatedAt: event.sourceUpdatedAt || null,
    tenantId: event.tenantId,
    organizationId: event.organizationId || null,
    isTombstone: event.operation === 'tombstone',
    data: event.operation === 'tombstone' ? {} : data,
  };
  const occurredAt = event.occurredAt || event.sourceUpdatedAt || new Date();

  switch (event.entityType) {
    case 'patient':
      return { ...common, patientId: asUuidOrNull(field(data, 'patientId')) || asUuidOrNull(event.sourceId), fullName: field(data, 'fullName', 'name') || null, initials: field(data, 'initials') || null, userId: asUuidOrNull(field(data, 'userId')), isActive: field(data, 'isActive') !== false && event.operation !== 'tombstone', createdOn: asDate(field(data, 'createdAt', 'createdOn')) };
    case 'assessment':
      return { ...common, assessmentId: asUuidOrNull(field(data, 'assessmentId')) || asUuidOrNull(event.sourceId), patientId: asUuidOrNull(field(data, 'patientId')) || asUuidOrNull(data.patient?.id), assessmentDate: asDate(field(data, 'assessmentDate', 'date')) || occurredAt, weight: field(data, 'weight') ?? null, height: field(data, 'height') ?? null };
    case 'questionnaire':
      return { ...common, questionnaireId: asUuidOrNull(field(data, 'questionnaireId')) || asUuidOrNull(event.sourceId), patientId: asUuidOrNull(field(data, 'patientId')) || asUuidOrNull(data.patient?.id), assessmentId: asUuidOrNull(field(data, 'assessmentId')), applicationDate: asDate(field(data, 'applicationDate', 'date')) || occurredAt, version: field(data, 'version') || null, totalScore: field(data, 'totalScore', 'score') ?? null, classification: field(data, 'classification', 'category') || null };
    case 'therapy_session':
      return { ...common, sessionId: asUuidOrNull(field(data, 'sessionId')) || asUuidOrNull(event.sourceId), patientId: asUuidOrNull(field(data, 'patientId')) || asUuidOrNull(data.patient?.id), therapistId: asUuidOrNull(field(data, 'therapistId')) || asUuidOrNull(data.therapist?.id), sessionDate: asDate(field(data, 'sessionDate', 'date')) || occurredAt, status: field(data, 'status') || null, durationMinutes: field(data, 'durationMinutes', 'duration') ?? null };
    case 'therapist':
      return { ...common, therapistId: asUuidOrNull(field(data, 'therapistId')) || asUuidOrNull(event.sourceId), displayName: field(data, 'displayName', 'name', 'fullName') || null, isActive: field(data, 'isActive') !== false && event.operation !== 'tombstone' };
    case 'activity':
      return { ...common, eventId: field(data, 'eventId') || event.eventId || event.sourceId, userId: asUuidOrNull(field(data, 'userId')), eventType: field(data, 'eventType', 'type') || 'activity', occurredAt, severity: field(data, 'severity') || null };
    default:
      throw new ValidationError(`entityType inválido: ${event.entityType}`, 'ENTITY_TYPE_INVALID');
  }
};

const compareFreshness = (existing, incoming) => {
  if (!existing) return true;
  const incomingDate = asDate(incoming.sourceUpdatedAt);
  const existingDate = asDate(existing.sourceUpdatedAt);
  if (incomingDate && existingDate) return incomingDate.getTime() >= existingDate.getTime();
  if (incoming.sourceVersion && existing.sourceVersion && /^\d+$/.test(String(incoming.sourceVersion)) && /^\d+$/.test(String(existing.sourceVersion))) {
    return Number(incoming.sourceVersion) >= Number(existing.sourceVersion);
  }
  return true;
};

const applyEvent = async (event, transaction) => {
  const Model = MODEL_BY_ENTITY[event.entityType];
  const attributes = eventToAttributes(event);
  const existing = await Model.findOne({ where: { sourceSystem: event.sourceSystem, sourceId: event.sourceId }, transaction, lock: transaction.LOCK.UPDATE });
  if (!compareFreshness(existing, event)) return { applied: false, ignored: true };
  if (existing) {
    await existing.update(attributes, { transaction });
    return { applied: true, record: existing };
  }
  const record = await Model.create(attributes, { transaction });
  return { applied: true, record };
};

const ingestBatch = async (payload, context) => {
  const scope = requireTenant(context, { tenantId: payload.tenantId, organizationId: payload.organizationId });
  for (const event of payload.events) {
    requireTenant(context, { tenantId: event.tenantId, organizationId: event.organizationId || payload.organizationId });
    if (event.sourceSystem !== payload.sourceSystem) {
      throw new ValidationError('sourceSystem do evento difere do lote', 'INGESTION_SOURCE_MISMATCH');
    }
  }
  return sequelize.transaction(async (transaction) => {
    let batch = await ReportingIngestionBatch.findOne({ where: { batchId: payload.batchId }, transaction, lock: transaction.LOCK.UPDATE });
    if (batch?.status === 'completed') return { batch: publicRecord(batch), replayed: true };
    if (!batch) {
      batch = await ReportingIngestionBatch.create({ batchId: payload.batchId, sourceSystem: payload.sourceSystem, tenantId: scope.tenantId, organizationId: payload.organizationId || null, startedAt: new Date() }, { transaction });
    }

    const errors = [];
    let appliedCount = 0;
    let ignoredCount = 0;
    for (const [index, event] of payload.events.entries()) {
      try {
        if (event.tenantId !== scope.tenantId) throw new AuthorizationError('Evento fora do tenant do lote', 'INGESTION_SCOPE_DENIED');
        if (payload.sourceSystem !== event.sourceSystem) throw new ValidationError('sourceSystem do evento difere do lote', 'INGESTION_SOURCE_MISMATCH');
        const result = await applyEvent(event, transaction);
        if (result.applied) appliedCount += 1;
        if (result.ignored) ignoredCount += 1;
      } catch (error) {
        errors.push({ index, code: error.code || 'INGESTION_ITEM_FAILED', message: error.message });
      }
    }
    const status = errors.length === 0 ? 'completed' : (appliedCount > 0 ? 'partial' : 'failed');
    await batch.update({ status, receivedCount: payload.events.length, appliedCount, ignoredCount, failedCount: errors.length, errorSummary: errors.slice(0, 25), completedAt: new Date() }, { transaction });
    return { batch: publicRecord(batch), replayed: false };
  });
};

const list = async (Model, context, filters, dateField) => {
  const safeFilters = { ...filters, dateField };
  const where = buildWhere(context, safeFilters);
  const { limit = 50, offset = 0 } = filters;
  const { rows, count } = await Model.findAndCountAll({ where, order: [[dateField || 'updatedAt', 'DESC'], ['id', 'DESC']], limit, offset });
  return { items: rows.map(publicRecord), pagination: { limit, offset, total: count, hasNext: offset + rows.length < count } };
};

const getPatient = async (patientId, context) => {
  const where = buildWhere(context, { patientId });
  const record = await ReportingPatient.findOne({ where: { ...where, patientId } });
  if (!record) throw new NotFoundError('Paciente não encontrado', 'PATIENT_NOT_FOUND');
  return publicRecord(record);
};

const listPatients = (context, filters) => list(ReportingPatient, context, filters, 'createdOn');
const listAssessments = (context, patientId, filters) => list(ReportingAssessment, context, { ...filters, patientId }, 'assessmentDate');
const listQuestionnaires = (context, patientId, filters) => list(ReportingQuestionnaire, context, { ...filters, patientId }, 'applicationDate');

const getProgressReport = async (context, patientId, filters = {}) => {
  await getPatient(patientId, context);
  const [assessments, questionnaires, sessions] = await Promise.all([
    ReportingAssessment.findAll({ where: buildWhere(context, { ...filters, patientId }), order: [['assessmentDate', 'ASC']] }),
    ReportingQuestionnaire.findAll({ where: buildWhere(context, { ...filters, patientId }), order: [['applicationDate', 'ASC']] }),
    ReportingTherapySession.findAll({ where: buildWhere(context, { ...filters, patientId }), order: [['sessionDate', 'ASC']] }),
  ]);
  return { patientId, assessments: assessments.map(publicRecord), questionnaires: questionnaires.map(publicRecord), sessions: sessions.map(publicRecord), summary: { assessmentCount: assessments.length, questionnaireCount: questionnaires.length, sessionCount: sessions.length } };
};

const getOverview = async (context, filters = {}) => {
  const scope = requireTenant(context, filters);
  const dateFilters = filters.startDate || filters.endDate ? { [Op.and]: [{ tenantId: scope.tenantId }, ...(scope.organizationId ? [{ organizationId: scope.organizationId }] : [])] } : scope;
  const [patients, assessments, questionnaires, sessions, therapists] = await Promise.all([
    ReportingPatient.count({ where: { ...dateFilters, isTombstone: false, isActive: true } }),
    ReportingAssessment.count({ where: { ...dateFilters, isTombstone: false } }),
    ReportingQuestionnaire.count({ where: { ...dateFilters, isTombstone: false } }),
    ReportingTherapySession.count({ where: { ...dateFilters, isTombstone: false } }),
    ReportingTherapist.count({ where: { ...dateFilters, isTombstone: false, isActive: true } }),
  ]);
  return { tenantId: scope.tenantId, organizationId: filters.organizationId || null, metrics: { totalPatients: patients, totalAssessments: assessments, totalQuestionnaires: questionnaires, totalSessions: sessions, totalTherapists: therapists } };
};

const getPatientProgressRate = async (context, patientId, filters = {}) => {
  const questionnaires = await ReportingQuestionnaire.findAll({ where: buildWhere(context, { ...filters, patientId }), order: [['applicationDate', 'ASC']] });
  const scores = questionnaires.map((item) => Number(item.totalScore)).filter((score) => Number.isFinite(score));
  const first = scores[0];
  const last = scores[scores.length - 1];
  const rate = scores.length > 1 && first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;
  return { patientId, samples: scores.length, firstScore: Number.isFinite(first) ? first : null, lastScore: Number.isFinite(last) ? last : null, progressRate: rate === null ? null : Number(rate.toFixed(2)) };
};

const getAdherenceStats = async (context, patientId, filters = {}) => {
  const sessions = await ReportingTherapySession.findAll({ where: buildWhere(context, { ...filters, patientId }), order: [['sessionDate', 'ASC']] });
  const completed = sessions.filter((session) => ['completed', 'finished', 'done'].includes(String(session.status || '').toLowerCase())).length;
  return { patientId, scheduledSessions: sessions.length, completedSessions: completed, adherenceRate: sessions.length ? Number(((completed / sessions.length) * 100).toFixed(2)) : null };
};

const getTherapistPerformance = async (context, therapistId, filters = {}) => {
  const sessions = await ReportingTherapySession.findAll({ where: buildWhere(context, { ...filters, therapistId }), attributes: ['patientId', 'status', 'durationMinutes', 'sessionDate'] });
  const completed = sessions.filter((session) => ['completed', 'finished', 'done'].includes(String(session.status || '').toLowerCase()));
  return { therapistId, totalSessions: sessions.length, completedSessions: completed.length, uniquePatients: new Set(sessions.map((session) => session.patientId)).size, averageDurationMinutes: completed.length ? Number((completed.reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0) / completed.length).toFixed(2)) : null };
};

const getClassificationDistribution = async (context, filters = {}) => {
  const where = buildWhere(context, { ...filters, dateField: 'applicationDate' });
  const rows = await ReportingQuestionnaire.findAll({ where, attributes: ['classification', [fn('COUNT', col('id')), 'count']], group: ['classification'], order: [[literal('count'), 'DESC']] });
  return { distribution: rows.map((row) => ({ classification: row.classification || 'unclassified', count: Number(row.get('count')) })) };
};

const getMonthlyTrends = async (context, filters = {}) => {
  const months = Math.min(Number(filters.months || 12), env.maxTrendMonths);
  const where = buildWhere(context, filters);
  const [sessions, patients] = await Promise.all([
    ReportingTherapySession.findAll({ where, attributes: ['sessionDate'] }),
    ReportingPatient.findAll({ where: buildWhere(context, filters), attributes: ['createdOn'] }),
  ]);
  const map = new Map();
  const add = (dateValue, key) => { const date = asDate(dateValue); if (!date) return; const month = date.toISOString().slice(0, 7); const current = map.get(month) || { year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)), sessions: 0, newPatients: 0 }; current[key] += 1; map.set(month, current); };
  sessions.forEach((row) => add(row.sessionDate, 'sessions'));
  patients.forEach((row) => add(row.createdOn, 'newPatients'));
  return { months: Array.from(map.values()).sort((a, b) => (a.year - b.year) || (a.month - b.month)).slice(-months) };
};

const getActivity = async (context, userId, filters = {}) => list(ReportingActivityFact, context, { ...filters, userId }, 'occurredAt');

const getBatch = async (batchId, context) => {
  const batch = await ReportingIngestionBatch.findOne({ where: { batchId } });
  if (!batch) throw new NotFoundError('Lote não encontrado', 'INGESTION_BATCH_NOT_FOUND');
  requireTenant(context, { tenantId: batch.tenantId, organizationId: batch.organizationId });
  return publicRecord(batch);
};

module.exports = {
  ingestBatch,
  getBatch,
  listPatients,
  listAssessments,
  listQuestionnaires,
  getProgressReport,
  getOverview,
  getPatientProgressRate,
  getAdherenceStats,
  getTherapistPerformance,
  getClassificationDistribution,
  getMonthlyTrends,
  getActivity,
  publicRecord,
  requireTenant,
};
