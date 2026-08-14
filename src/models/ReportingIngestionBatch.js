const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class ReportingIngestionBatch extends Model {}

ReportingIngestionBatch.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  batchId: { type: DataTypes.STRING(180), allowNull: false, unique: true },
  sourceSystem: { type: DataTypes.STRING(120), allowNull: false },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  organizationId: DataTypes.UUID,
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'processing' },
  receivedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  appliedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  ignoredCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  failedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  errorSummary: DataTypes.JSONB,
  startedAt: { type: DataTypes.DATE, allowNull: false },
  completedAt: DataTypes.DATE,
}, { sequelize, modelName: 'ReportingIngestionBatch', tableName: 'reporting_ingestion_batches', timestamps: true });

module.exports = ReportingIngestionBatch;
