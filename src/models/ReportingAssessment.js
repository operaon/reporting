const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class ReportingAssessment extends Model {}

ReportingAssessment.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  sourceSystem: { type: DataTypes.STRING(120), allowNull: false },
  sourceId: { type: DataTypes.STRING(180), allowNull: false },
  sourceVersion: DataTypes.STRING(180),
  sourceUpdatedAt: DataTypes.DATE,
  tenantId: { type: DataTypes.UUID, allowNull: false },
  organizationId: DataTypes.UUID,
  isTombstone: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  assessmentId: DataTypes.UUID,
  patientId: { type: DataTypes.UUID, allowNull: false },
  assessmentDate: DataTypes.DATE,
  weight: DataTypes.DECIMAL(10, 2),
  height: DataTypes.DECIMAL(10, 2),
  data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, { sequelize, modelName: 'ReportingAssessment', tableName: 'reporting_assessments', timestamps: true });

module.exports = ReportingAssessment;
