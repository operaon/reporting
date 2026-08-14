const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class ReportingPatient extends Model {}

ReportingPatient.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  sourceSystem: { type: DataTypes.STRING(120), allowNull: false },
  sourceId: { type: DataTypes.STRING(180), allowNull: false },
  sourceVersion: DataTypes.STRING(180),
  sourceUpdatedAt: DataTypes.DATE,
  tenantId: { type: DataTypes.UUID, allowNull: false },
  organizationId: DataTypes.UUID,
  isTombstone: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  patientId: DataTypes.UUID,
  fullName: DataTypes.STRING(240),
  initials: DataTypes.STRING(24),
  userId: DataTypes.UUID,
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  createdOn: DataTypes.DATE,
  data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, { sequelize, modelName: 'ReportingPatient', tableName: 'reporting_patients', timestamps: true });

module.exports = ReportingPatient;
