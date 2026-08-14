const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const { sequelize, ReportingPatient, ReportingAssessment, ReportingQuestionnaire, ReportingTherapySession, ReportingTherapist, ReportingActivityFact, ReportingIngestionBatch } = require('../src/models');

const tenantId = '11111111-1111-4111-8111-111111111111';
const otherTenantId = '22222222-2222-4222-8222-222222222222';
const organizationId = '33333333-3333-4333-8333-333333333333';
const patientId = '44444444-4444-4444-8444-444444444444';
const therapistId = '55555555-5555-4555-8555-555555555555';

const token = (overrides = {}) => jwt.sign({
  sub: '66666666-6666-4666-8666-666666666666',
  tokenType: 'access',
  iss: 'operaon-identity',
  aud: ['operaon-api', 'operaon-reporting'],
  tenantId,
  organizationIds: [organizationId],
  permissions: ['reporting:read', 'reporting:write', 'reporting:export'],
  ...overrides,
}, env.jwt.secret, { algorithm: 'HS256', expiresIn: '10m' });

const headers = (jwtToken = token()) => ({ 'X-Service-Key': env.serviceApiKey, Authorization: `Bearer ${jwtToken}`, 'X-Tenant-Id': tenantId });

const ingest = (batchId, events, tenant = tenantId) => request(app)
  .post('/api/reporting/internal/ingestion/batch')
  .set(headers())
  .send({ batchId, sourceSystem: 'test-source', tenantId: tenant, organizationId, events });

describe('Reporting & Analytics contract', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    await Promise.all([ReportingActivityFact, ReportingTherapySession, ReportingQuestionnaire, ReportingAssessment, ReportingPatient, ReportingTherapist, ReportingIngestionBatch].map((Model) => Model.destroy({ where: {}, force: true })));
  });

  afterAll(async () => sequelize.close());

  test('exige X-Service-Key e JWT simultaneamente', async () => {
    const response = await request(app).get('/api/reporting/analytics/overview');
    expect(response.status).toBe(401);

    const missingJwt = await request(app).get('/api/reporting/analytics/overview').set('X-Service-Key', env.serviceApiKey);
    expect(missingJwt.status).toBe(401);
  });

  test('ingere lote, redige segredo e é idempotente', async () => {
    const event = {
      entityType: 'patient',
      operation: 'upsert',
      sourceSystem: 'test-source',
      sourceId: patientId,
      sourceUpdatedAt: new Date().toISOString(),
      tenantId,
      organizationId,
      data: { patientId, fullName: 'Paciente Teste', secret: 'must-not-leak', isActive: true },
    };
    const first = await ingest('batch-patient-1', [event]);
    expect(first.status).toBe(201);
    expect(first.body.data.batch.appliedCount).toBe(1);

    const second = await ingest('batch-patient-1', [event]);
    expect(second.status).toBe(201);
    expect(second.body.data.replayed).toBe(true);

    const list = await request(app).get('/api/reporting/reports/patients').set(headers());
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain('must-not-leak');
  });

  test('ingere fatos clínicos e responde overview, progresso, aderência e tendências', async () => {
    const events = [
      { entityType: 'therapist', sourceSystem: 'test-source', sourceId: therapistId, tenantId, organizationId, data: { therapistId, displayName: 'Terapeuta Teste', isActive: true } },
      { entityType: 'assessment', sourceSystem: 'test-source', sourceId: '77777777-7777-4777-8777-777777777777', tenantId, organizationId, data: { assessmentId: '77777777-7777-4777-8777-777777777777', patientId, weight: 70, height: 170, assessmentDate: '2026-08-01T00:00:00.000Z' } },
      { entityType: 'questionnaire', sourceSystem: 'test-source', sourceId: '88888888-8888-4888-8888-888888888888', tenantId, organizationId, data: { questionnaireId: '88888888-8888-4888-8888-888888888888', patientId, totalScore: 30, classification: 'moderate', applicationDate: '2026-08-01T00:00:00.000Z' } },
      { entityType: 'therapy_session', sourceSystem: 'test-source', sourceId: '99999999-9999-4999-8999-999999999999', tenantId, organizationId, data: { sessionId: '99999999-9999-4999-8999-999999999999', patientId, therapistId, status: 'completed', durationMinutes: 45, sessionDate: '2026-08-01T00:00:00.000Z' } },
      { entityType: 'activity', sourceSystem: 'test-source', sourceId: 'activity-1', tenantId, organizationId, data: { eventId: 'activity-1', userId: '66666666-6666-4666-8666-666666666666', eventType: 'login', occurredAt: '2026-08-01T00:00:00.000Z' } },
    ];
    const response = await ingest('batch-clinical-1', events);
    expect(response.status).toBe(201);
    expect(response.body.data.batch.appliedCount).toBe(5);

    const overview = await request(app).get('/api/reporting/analytics/overview').set(headers());
    expect(overview.status).toBe(200);
    expect(overview.body.data.metrics).toMatchObject({ totalPatients: 1, totalAssessments: 1, totalQuestionnaires: 1, totalSessions: 1, totalTherapists: 1 });

    const progress = await request(app).get(`/api/reporting/reports/patient/${patientId}/progress`).set(headers());
    expect(progress.status).toBe(200);
    expect(progress.body.data.summary.sessionCount).toBe(1);

    const adherence = await request(app).get(`/api/reporting/analytics/patient/${patientId}/adherence`).set(headers());
    expect(adherence.status).toBe(200);
    expect(adherence.body.data.adherenceRate).toBe(100);

    const trends = await request(app).get('/api/reporting/analytics/monthly-trends').set(headers());
    expect(trends.status).toBe(200);
    expect(trends.body.data.months.length).toBeGreaterThan(0);
  });

  test('impede consulta e ingestão fora do escopo do tenant', async () => {
    const list = await request(app).get(`/api/reporting/reports/patients?tenantId=${otherTenantId}`).set(headers());
    expect(list.status).toBe(403);

    const crossTenant = await ingest('batch-cross-tenant', [{ entityType: 'patient', sourceSystem: 'test-source', sourceId: otherTenantId, tenantId: otherTenantId, data: { patientId: otherTenantId } }]);
    expect(crossTenant.status).toBe(403);
  });

  test('nega operação sem permissão dinâmica', async () => {
    const response = await request(app).get('/api/reporting/analytics/overview').set(headers(token({ permissions: [] })));
    expect(response.status).toBe(403);
  });
});
