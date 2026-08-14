const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class ReportingTherapist extends Model {}

ReportingTherapist.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  sourceSystem: { type: DataTypes.STRING(120), allowNull: false },
  sourceId: { type: DataTypes.STRING(180), allowNull: false },
  sourceVersion: DataTypes.STRING(180),
  sourceUpdatedAt: DataTypes.DATE,
  tenantId: { type: DataTypes.UUID, allowNull: false },
  organizationId: DataTypes.UUID,
  isTombstone: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  therapistId: DataTypes.UUID,
  displayName: DataTypes.STRING(240),
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, { sequelize, modelName: 'ReportingTherapist', tableName: 'reporting_therapists', timestamps: true });

module.exports = ReportingTherapist;
