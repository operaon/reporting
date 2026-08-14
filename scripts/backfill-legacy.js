require('dotenv').config();
const { Sequelize, QueryTypes } = require('sequelize');
const env = require('../src/config/env');
const reportingService = require('../src/services/reportingService');
const { sequelize } = require('../src/models');

const legacy = env.legacyDatabase.url
  ? new Sequelize(env.legacyDatabase.url, { dialect: 'postgres', logging: false })
  : new Sequelize(env.legacyDatabase.name, env.legacyDatabase.user, env.legacyDatabase.password, { dialect: 'postgres', host: env.legacyDatabase.host, port: env.legacyDatabase.port, logging: false });

const hasTable = async (tableName) => {
  const rows = await legacy.query('SELECT to_regclass(:tableName) AS relation', { replacements: { tableName }, type: QueryTypes.SELECT });
  return Boolean(rows[0]?.relation);
};

const pick = (row, ...keys) => keys.map((key) => row[key]).find((value) => value !== undefined && value !== null);
const uuid = (value) => (typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? value : null);
const tenantOf = (row) => uuid(pick(row, 'tenantId', 'tenant_id', 'tenant'));
const organizationOf = (row) => uuid(pick(row, 'organizationId', 'organization_id', 'organization'));
const sourceIdOf = (row) => String(pick(row, 'id', 'uuid', '_id'));

const tableReaders = [
  { table: 'patients', entityType: 'patient', data: (row) => ({ patientId: uuid(sourceIdOf(row)), userId: uuid(pick(row, 'userId', 'user_id')), fullName: pick(row, 'fullName', 'full_name', 'name'), initials: pick(row, 'initials'), isActive: pick(row, 'isActive', 'is_active', 'active') !== false, createdAt: pick(row, 'createdAt', 'created_at') }) },
  { table: 'assessments', entityType: 'assessment', data: (row) => ({ assessmentId: uuid(sourceIdOf(row)), patientId: uuid(pick(row, 'patientId', 'patient_id')), assessmentDate: pick(row, 'assessmentDate', 'assessment_date', 'date', 'createdAt'), weight: pick(row, 'weight'), height: pick(row, 'height') }) },
  { table: 'questionnaires', entityType: 'questionnaire', data: (row) => ({ questionnaireId: uuid(sourceIdOf(row)), patientId: uuid(pick(row, 'patientId', 'patient_id')), assessmentId: uuid(pick(row, 'assessmentId', 'assessment_id')), applicationDate: pick(row, 'applicationDate', 'application_date', 'date', 'createdAt'), totalScore: pick(row, 'totalScore', 'total_score', 'score'), classification: pick(row, 'classification', 'category'), version: pick(row, 'version') }) },
  { table: 'appointments', entityType: 'therapy_session', data: (row) => ({ sessionId: uuid(sourceIdOf(row)), patientId: uuid(pick(row, 'patientId', 'patient_id')), therapistId: uuid(pick(row, 'therapistId', 'therapist_id', 'professionalId')), sessionDate: pick(row, 'scheduledAt', 'scheduled_at', 'appointmentDate', 'appointment_date', 'date', 'createdAt'), status: pick(row, 'status'), durationMinutes: pick(row, 'durationMinutes', 'duration_minutes', 'duration') }) },
  { table: 'sessions', entityType: 'therapy_session', data: (row) => ({ sessionId: uuid(sourceIdOf(row)), patientId: uuid(pick(row, 'patientId', 'patient_id')), therapistId: uuid(pick(row, 'therapistId', 'therapist_id', 'professionalId')), sessionDate: pick(row, 'startedAt', 'started_at', 'sessionDate', 'session_date', 'createdAt'), status: pick(row, 'status'), durationMinutes: pick(row, 'durationMinutes', 'duration_minutes', 'duration') }) },
  { table: 'therapists', entityType: 'therapist', data: (row) => ({ therapistId: uuid(sourceIdOf(row)), displayName: pick(row, 'displayName', 'display_name', 'fullName', 'full_name', 'name'), isActive: pick(row, 'isActive', 'is_active', 'active') !== false }) },
  { table: 'activity_logs', entityType: 'activity', data: (row) => ({ eventId: String(pick(row, 'id', 'uuid')), userId: uuid(pick(row, 'userId', 'user_id')), eventType: pick(row, 'eventType', 'event_type', 'action', 'type') || 'legacy_activity', occurredAt: pick(row, 'occurredAt', 'occurred_at', 'createdAt', 'created_at'), severity: pick(row, 'severity'), sourceTable: 'activity_logs' }) },
  { table: 'audit_trails', entityType: 'activity', data: (row) => ({ eventId: String(pick(row, 'id', 'uuid')), userId: uuid(pick(row, 'userId', 'user_id')), eventType: pick(row, 'eventType', 'event_type', 'action', 'type') || 'legacy_audit', occurredAt: pick(row, 'occurredAt', 'occurred_at', 'createdAt', 'created_at'), severity: pick(row, 'severity'), sourceTable: 'audit_trails' }) },
];

const main = async () => {
  const writeEnabled = env.backfillWriteEnabled;
  const summary = { dryRun: !writeEnabled, tables: {}, candidates: 0, eligible: 0, skippedNoTenant: 0, written: 0 };
  if (writeEnabled) {
    await sequelize.authenticate();
    console.warn('BACKFILL_WRITE_ENABLED=true: execução somente-aditiva habilitada; nenhuma tabela legada será alterada.');
  } else {
    console.log('Dry-run padrão: nenhuma escrita será realizada. Defina BACKFILL_WRITE_ENABLED=true somente após aprovação operacional.');
  }

  for (const reader of tableReaders) {
    if (!(await hasTable(reader.table))) {
      summary.tables[reader.table] = { available: false, candidates: 0, eligible: 0 };
      continue;
    }
    const rows = await legacy.query(`SELECT * FROM "${reader.table}"`, { type: QueryTypes.SELECT });
    let eligible = 0;
    for (const row of rows) {
      summary.candidates += 1;
      const tenantId = tenantOf(row);
      if (!tenantId) { summary.skippedNoTenant += 1; continue; }
      eligible += 1;
      summary.eligible += 1;
      if (!writeEnabled) continue;
      const sourceId = sourceIdOf(row);
      if (!sourceId || sourceId === 'undefined') continue;
      const organizationId = organizationOf(row);
      const event = { entityType: reader.entityType, operation: 'upsert', sourceSystem: 'legacy-api', sourceId, sourceVersion: pick(row, 'updatedAt', 'updated_at', 'version') ? String(pick(row, 'updatedAt', 'updated_at', 'version')) : null, sourceUpdatedAt: pick(row, 'updatedAt', 'updated_at'), occurredAt: pick(row, 'createdAt', 'created_at', 'occurredAt', 'occurred_at'), tenantId, organizationId, data: { ...reader.data(row), legacyTable: reader.table } };
      const result = await reportingService.ingestBatch({ batchId: `legacy-${reader.table}-${sourceId}`, sourceSystem: 'legacy-api', tenantId, organizationId, events: [event] }, { tenantId, organizationIds: organizationId ? [organizationId] : [], isService: true, permissions: ['*:*'] });
      if (!result.replayed) summary.written += 1;
    }
    summary.tables[reader.table] = { available: true, candidates: rows.length, eligible };
  }

  console.log(JSON.stringify(summary, null, 2));
  await legacy.close();
  if (writeEnabled) await sequelize.close();
};

main().catch(async (error) => {
  console.error(error);
  await legacy.close().catch(() => {});
  await sequelize.close().catch(() => {});
  process.exit(1);
});
