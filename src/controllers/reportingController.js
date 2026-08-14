const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const reportingService = require('../services/reportingService');
const { batchSchema, querySchema, metricsQuerySchema, exportSchema } = require('../validators');
const { ValidationError } = require('../utils/errors');

const parse = (schema, value) => {
  const result = schema.safeParse(value);
  if (!result.success) throw new ValidationError('Parâmetros inválidos', 'VALIDATION_ERROR', result.error.flatten());
  return result.data;
};

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

const ingestBatch = async (req, res, next) => {
  try { const payload = parse(batchSchema, req.body); return ok(res, await reportingService.ingestBatch(payload, req.context), 201); } catch (error) { return next(error); }
};

const getBatch = async (req, res, next) => {
  try { return ok(res, await reportingService.getBatch(req.params.batchId, req.context)); } catch (error) { return next(error); }
};

const listPatients = async (req, res, next) => {
  try { const result = await reportingService.listPatients(req.context, parse(querySchema, req.query)); return res.json({ success: true, data: result.items, pagination: result.pagination }); } catch (error) { return next(error); }
};

const listAssessments = async (req, res, next) => {
  try { const result = await reportingService.listAssessments(req.context, req.params.patientId, parse(querySchema, req.query)); return res.json({ success: true, data: result.items, pagination: result.pagination }); } catch (error) { return next(error); }
};

const listQuestionnaires = async (req, res, next) => {
  try { const result = await reportingService.listQuestionnaires(req.context, req.params.patientId, parse(querySchema, req.query)); return res.json({ success: true, data: result.items, pagination: result.pagination }); } catch (error) { return next(error); }
};

const getProgressReport = async (req, res, next) => {
  try { return ok(res, await reportingService.getProgressReport(req.context, req.params.patientId, parse(querySchema, req.query))); } catch (error) { return next(error); }
};

const getOverview = async (req, res, next) => {
  try { return ok(res, await reportingService.getOverview(req.context, parse(metricsQuerySchema, req.query))); } catch (error) { return next(error); }
};

const getPatientProgress = async (req, res, next) => {
  try { return ok(res, await reportingService.getPatientProgressRate(req.context, req.params.patientId, parse(metricsQuerySchema, req.query))); } catch (error) { return next(error); }
};

const getAdherence = async (req, res, next) => {
  try { return ok(res, await reportingService.getAdherenceStats(req.context, req.params.patientId, parse(metricsQuerySchema, req.query))); } catch (error) { return next(error); }
};

const getTherapistPerformance = async (req, res, next) => {
  try { return ok(res, await reportingService.getTherapistPerformance(req.context, req.params.therapistId, parse(metricsQuerySchema, req.query))); } catch (error) { return next(error); }
};

const getClassificationDistribution = async (req, res, next) => {
  try { return ok(res, await reportingService.getClassificationDistribution(req.context, parse(querySchema, req.query))); } catch (error) { return next(error); }
};

const getMonthlyTrends = async (req, res, next) => {
  try { return ok(res, await reportingService.getMonthlyTrends(req.context, parse(metricsQuerySchema, req.query))); } catch (error) { return next(error); }
};

const getActivity = async (req, res, next) => {
  try { const result = await reportingService.getActivity(req.context, req.params.userId, parse(querySchema, req.query)); return res.json({ success: true, data: result.items, pagination: result.pagination }); } catch (error) { return next(error); }
};

const streamPdf = (res, title, lines) => {
  res.status(200);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="reporting-report.pdf"');
  const doc = new PDFDocument({ margin: 48 });
  doc.pipe(res);
  doc.fontSize(18).text(title);
  doc.moveDown();
  lines.forEach((line) => doc.fontSize(10).text(String(line)));
  doc.end();
};

const exportProgressPdf = async (req, res, next) => {
  try {
    const report = await reportingService.getProgressReport(req.context, req.params.patientId, parse(exportSchema, { ...req.query, format: 'pdf' }));
    return streamPdf(res, 'Relatório de progresso', [
      `Paciente: ${report.patientId}`,
      `Avaliações: ${report.summary.assessmentCount}`,
      `Questionários: ${report.summary.questionnaireCount}`,
      `Sessões: ${report.summary.sessionCount}`,
      ...report.questionnaires.map((item) => `${item.applicationDate || 'sem data'} - ${item.classification || 'sem classificação'} - score ${item.totalScore ?? 'n/a'}`),
    ]);
  } catch (error) { return next(error); }
};

const exportCompletePdf = async (req, res, next) => {
  try {
    const report = await reportingService.getProgressReport(req.context, req.params.patientId, parse(exportSchema, { ...req.query, format: 'pdf' }));
    return streamPdf(res, 'Relatório clínico completo', [JSON.stringify(report)]);
  } catch (error) { return next(error); }
};

const exportQuestionnairesXlsx = async (req, res, next) => {
  try {
    const result = await reportingService.listQuestionnaires(req.context, req.params.patientId, parse(exportSchema, { ...req.query, format: 'xlsx' }));
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Questionários');
    sheet.columns = [
      { header: 'Data', key: 'applicationDate', width: 24 },
      { header: 'Versão', key: 'version', width: 18 },
      { header: 'Score', key: 'totalScore', width: 16 },
      { header: 'Classificação', key: 'classification', width: 24 },
    ];
    result.items.forEach((item) => sheet.addRow({ applicationDate: item.applicationDate, version: item.version, totalScore: item.totalScore, classification: item.classification }));
    res.status(200);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="questionnaires.xlsx"');
    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) { return next(error); }
};

module.exports = {
  ingestBatch,
  getBatch,
  listPatients,
  listAssessments,
  listQuestionnaires,
  getProgressReport,
  getOverview,
  getPatientProgress,
  getAdherence,
  getTherapistPerformance,
  getClassificationDistribution,
  getMonthlyTrends,
  getActivity,
  exportProgressPdf,
  exportQuestionnairesXlsx,
  exportCompletePdf,
};
