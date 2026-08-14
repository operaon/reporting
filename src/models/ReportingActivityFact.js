const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class ReportingActivityFact extends Model {}

ReportingActivityFact.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  sourceSystem: { type: DataTypes.STRING(120), allowNull: false },
  sourceId: { type: DataTypes.STRING(180), allowNull: false },
  sourceVersion: DataTypes.STRING(180),
  sourceUpdatedAt: DataTypes.DATE,
  tenantId: { type: DataTypes.UUID, allowNull: false },
  organizationId: DataTypes.UUID,
  isTombstone: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  eventId: DataTypes.STRING(180),
  userId: DataTypes.UUID,
  eventType: { type: DataTypes.STRING(120), allowNull: false },
  occurredAt: { type: DataTypes.DATE, allowNull: false },
  severity: DataTypes.STRING(24),
  data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, { sequelize, modelName: 'ReportingActivityFact', tableName: 'reporting_activity_facts', timestamps: true });

module.exports = ReportingActivityFact;
