const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class ReportingQuestionnaire extends Model {}

ReportingQuestionnaire.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  sourceSystem: { type: DataTypes.STRING(120), allowNull: false },
  sourceId: { type: DataTypes.STRING(180), allowNull: false },
  sourceVersion: DataTypes.STRING(180),
  sourceUpdatedAt: DataTypes.DATE,
  tenantId: { type: DataTypes.UUID, allowNull: false },
  organizationId: DataTypes.UUID,
  isTombstone: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  questionnaireId: DataTypes.UUID,
  patientId: { type: DataTypes.UUID, allowNull: false },
  assessmentId: DataTypes.UUID,
  applicationDate: DataTypes.DATE,
  version: DataTypes.STRING(80),
  totalScore: DataTypes.DECIMAL(12, 4),
  classification: DataTypes.STRING(120),
  data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, { sequelize, modelName: 'ReportingQuestionnaire', tableName: 'reporting_questionnaires', timestamps: true });

module.exports = ReportingQuestionnaire;
