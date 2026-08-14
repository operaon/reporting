const express = require('express');
const controller = require('../controllers/reportingController');
const { authenticate, requirePermission } = require('../middlewares/auth');

const router = express.Router();
router.use(authenticate);

router.post('/internal/ingestion/batch', requirePermission('reporting', 'write'), controller.ingestBatch);
router.get('/internal/ingestion/status/:batchId', requirePermission('reporting', 'read'), controller.getBatch);

router.get('/reports/patients', requirePermission('reporting', 'read'), controller.listPatients);
router.get('/reports/patient/:patientId/progress', requirePermission('reporting', 'read'), controller.getProgressReport);
router.get('/reports/patient/:patientId/assessments', requirePermission('reporting', 'read'), controller.listAssessments);
router.get('/reports/patient/:patientId/questionnaires', requirePermission('reporting', 'read'), controller.listQuestionnaires);
router.get('/reports/assessment/:assessmentId/export/pdf', requirePermission('reporting', 'export'), controller.exportProgressPdf);
router.get('/reports/patient/:patientId/export/questionnaires/excel', requirePermission('reporting', 'export'), controller.exportQuestionnairesXlsx);
router.get('/reports/patient/:patientId/export/complete/pdf', requirePermission('reporting', 'export'), controller.exportCompletePdf);

router.get('/analytics/overview', requirePermission('reporting', 'read'), controller.getOverview);
router.get('/analytics/patient/:patientId/progress', requirePermission('reporting', 'read'), controller.getPatientProgress);
router.get('/analytics/patient/:patientId/adherence', requirePermission('reporting', 'read'), controller.getAdherence);
router.get('/analytics/therapist/:therapistId/performance', requirePermission('reporting', 'read'), controller.getTherapistPerformance);
router.get('/analytics/classification-distribution', requirePermission('reporting', 'read'), controller.getClassificationDistribution);
router.get('/analytics/monthly-trends', requirePermission('reporting', 'read'), controller.getMonthlyTrends);
router.get('/activity/users/:userId', requirePermission('reporting', 'read'), controller.getActivity);

module.exports = router;
