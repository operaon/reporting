'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    await queryInterface.createTable('reporting_ingestion_batches', {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
      batchId: { type: DataTypes.STRING(180), allowNull: false },
      sourceSystem: { type: DataTypes.STRING(120), allowNull: false },
      tenantId: { type: DataTypes.UUID, allowNull: false },
      organizationId: { type: DataTypes.UUID, allowNull: true },
      status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'processing' },
      receivedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      appliedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ignoredCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      failedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      errorSummary: { type: DataTypes.JSONB, allowNull: true },
      startedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('reporting_ingestion_batches', ['batchId'], { name: 'reporting_ingestion_batches_batch_id_unique', unique: true });
    await queryInterface.addIndex('reporting_ingestion_batches', ['tenantId', 'createdAt'], { name: 'reporting_ingestion_batches_tenant_created_at' });

    const common = {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
      sourceSystem: { type: DataTypes.STRING(120), allowNull: false },
      sourceId: { type: DataTypes.STRING(180), allowNull: false },
      sourceVersion: { type: DataTypes.STRING(180), allowNull: true },
      sourceUpdatedAt: { type: DataTypes.DATE, allowNull: true },
      tenantId: { type: DataTypes.UUID, allowNull: false },
      organizationId: { type: DataTypes.UUID, allowNull: true },
      isTombstone: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    };

    await queryInterface.createTable('reporting_patients', {
      ...common,
      patientId: { type: DataTypes.UUID, allowNull: true },
      fullName: { type: DataTypes.STRING(240), allowNull: true },
      initials: { type: DataTypes.STRING(24), allowNull: true },
      userId: { type: DataTypes.UUID, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdOn: { type: DataTypes.DATE, allowNull: true },
    });
    await queryInterface.createTable('reporting_assessments', {
      ...common,
      assessmentId: { type: DataTypes.UUID, allowNull: true },
      patientId: { type: DataTypes.UUID, allowNull: false },
      assessmentDate: { type: DataTypes.DATE, allowNull: true },
      weight: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      height: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    });
    await queryInterface.createTable('reporting_questionnaires', {
      ...common,
      questionnaireId: { type: DataTypes.UUID, allowNull: true },
      patientId: { type: DataTypes.UUID, allowNull: false },
      assessmentId: { type: DataTypes.UUID, allowNull: true },
      applicationDate: { type: DataTypes.DATE, allowNull: true },
      version: { type: DataTypes.STRING(80), allowNull: true },
      totalScore: { type: DataTypes.DECIMAL(12, 4), allowNull: true },
      classification: { type: DataTypes.STRING(120), allowNull: true },
    });
    await queryInterface.createTable('reporting_therapy_sessions', {
      ...common,
      sessionId: { type: DataTypes.UUID, allowNull: true },
      patientId: { type: DataTypes.UUID, allowNull: false },
      therapistId: { type: DataTypes.UUID, allowNull: true },
      sessionDate: { type: DataTypes.DATE, allowNull: true },
      status: { type: DataTypes.STRING(60), allowNull: true },
      durationMinutes: { type: DataTypes.INTEGER, allowNull: true },
    });
    await queryInterface.createTable('reporting_therapists', {
      ...common,
      therapistId: { type: DataTypes.UUID, allowNull: true },
      displayName: { type: DataTypes.STRING(240), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    });
    await queryInterface.createTable('reporting_activity_facts', {
      ...common,
      eventId: { type: DataTypes.STRING(180), allowNull: true },
      userId: { type: DataTypes.UUID, allowNull: true },
      eventType: { type: DataTypes.STRING(120), allowNull: false },
      occurredAt: { type: DataTypes.DATE, allowNull: false },
      severity: { type: DataTypes.STRING(24), allowNull: true },
    });

    const tables = [
      ['reporting_patients', ['sourceSystem', 'sourceId'], 'reporting_patients_source_identity_unique'],
      ['reporting_assessments', ['sourceSystem', 'sourceId'], 'reporting_assessments_source_identity_unique'],
      ['reporting_questionnaires', ['sourceSystem', 'sourceId'], 'reporting_questionnaires_source_identity_unique'],
      ['reporting_therapy_sessions', ['sourceSystem', 'sourceId'], 'reporting_sessions_source_identity_unique'],
      ['reporting_therapists', ['sourceSystem', 'sourceId'], 'reporting_therapists_source_identity_unique'],
      ['reporting_activity_facts', ['sourceSystem', 'sourceId'], 'reporting_activity_source_identity_unique'],
    ];
    for (const [table, fields, name] of tables) {
      await queryInterface.addIndex(table, fields, { name, unique: true });
      await queryInterface.addIndex(table, ['tenantId', 'isTombstone', 'updatedAt'], { name: `${table}_tenant_tombstone_updated` });
    }

    await queryInterface.addIndex('reporting_assessments', ['tenantId', 'patientId', 'assessmentDate'], { name: 'reporting_assessments_patient_date' });
    await queryInterface.addIndex('reporting_questionnaires', ['tenantId', 'patientId', 'applicationDate'], { name: 'reporting_questionnaires_patient_date' });
    await queryInterface.addIndex('reporting_therapy_sessions', ['tenantId', 'patientId', 'sessionDate'], { name: 'reporting_sessions_patient_date' });
    await queryInterface.addIndex('reporting_therapy_sessions', ['tenantId', 'therapistId', 'sessionDate'], { name: 'reporting_sessions_therapist_date' });
    await queryInterface.addIndex('reporting_activity_facts', ['tenantId', 'occurredAt'], { name: 'reporting_activity_tenant_occurred' });
    await queryInterface.addIndex('reporting_activity_facts', ['tenantId', 'userId', 'occurredAt'], { name: 'reporting_activity_user_occurred' });
  },

  async down(queryInterface) {
    for (const table of [
      'reporting_activity_facts',
      'reporting_therapists',
      'reporting_therapy_sessions',
      'reporting_questionnaires',
      'reporting_assessments',
      'reporting_patients',
      'reporting_ingestion_batches',
    ]) {
      await queryInterface.dropTable(table);
    }
  },
};
