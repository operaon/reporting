const { z } = require('zod');

const uuid = z.string().uuid();
const nullableUuid = uuid.nullable().optional();
const sourceId = z.string().trim().min(1).max(180);
const sourceSystem = z.string().trim().min(1).max(120);
const date = z.coerce.date();
const entityType = z.enum(['patient', 'assessment', 'questionnaire', 'therapy_session', 'therapist', 'activity']);

const eventSchema = z.object({
  eventId: z.string().trim().min(1).max(180).optional(),
  entityType,
  operation: z.enum(['upsert', 'tombstone']).default('upsert'),
  sourceSystem,
  sourceId,
  sourceVersion: z.string().trim().max(180).nullable().optional(),
  sourceUpdatedAt: date.nullable().optional(),
  tenantId: uuid,
  organizationId: nullableUuid,
  occurredAt: date.nullable().optional(),
  data: z.record(z.any()).default({}),
}).strict();

const batchSchema = z.object({
  batchId: z.string().trim().min(1).max(180),
  sourceSystem,
  tenantId: uuid,
  organizationId: nullableUuid,
  events: z.array(eventSchema).min(1).max(500),
}).strict();

const queryShape = z.object({
  tenantId: uuid.optional(),
  organizationId: uuid.optional(),
  patientId: uuid.optional(),
  therapistId: uuid.optional(),
  userId: uuid.optional(),
  startDate: date.optional(),
  endDate: date.optional(),
  search: z.string().trim().max(160).optional(),
  status: z.string().trim().max(60).optional(),
  classification: z.string().trim().max(120).optional(),
  eventType: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
}).strict();

const withDateRange = (schema) => schema.refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
  message: 'startDate deve ser anterior ou igual a endDate',
  path: ['startDate'],
});

const querySchema = withDateRange(queryShape);

const metricsQuerySchema = z.object({
  tenantId: uuid.optional(),
  organizationId: uuid.optional(),
  startDate: date.optional(),
  endDate: date.optional(),
  months: z.coerce.number().int().min(1).max(24).default(12),
}).strict();

const exportSchema = withDateRange(queryShape.extend({ format: z.enum(['pdf', 'xlsx']).default('pdf') }));

module.exports = { uuid, eventSchema, batchSchema, querySchema, metricsQuerySchema, exportSchema, entityType };
