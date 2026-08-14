const sequelize = require('../config/database');
const ReportingPatient = require('./ReportingPatient');
const ReportingAssessment = require('./ReportingAssessment');
const ReportingQuestionnaire = require('./ReportingQuestionnaire');
const ReportingTherapySession = require('./ReportingTherapySession');
const ReportingTherapist = require('./ReportingTherapist');
const ReportingActivityFact = require('./ReportingActivityFact');
const ReportingIngestionBatch = require('./ReportingIngestionBatch');

module.exports = {
  sequelize,
  ReportingPatient,
  ReportingAssessment,
  ReportingQuestionnaire,
  ReportingTherapySession,
  ReportingTherapist,
  ReportingActivityFact,
  ReportingIngestionBatch,
};
