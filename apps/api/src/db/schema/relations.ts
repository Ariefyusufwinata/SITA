import { relations } from "drizzle-orm";
import { users, students, lecturers, roles, userRoles } from "./identity";
import { programs, academicTerms, thesisProjects, supervisorAssignments, academicPolicies, researchTopics } from "./academic";
import { logbooks, logbookVersions, supervisorEvaluations } from "./logbook";
import { activityTypes, activityPeriods, documentRequirements, applications } from "./activity";
import { documents, documentVersions, applicationDocuments, documentReviews, approvalSteps } from "./documents";
import { schedules, examinerAssignments, sessionResults, revisionItems, revisionSubmissions } from "./scheduling";
import { notifications, auditEvents } from "./system";
import { seminars, seminarEvaluations } from "./seminars";

export const usersRelations = relations(users, ({ one, many }) => ({
  student: one(students, { fields: [users.id], references: [students.userId] }),
  lecturer: one(lecturers, { fields: [users.id], references: [lecturers.userId] }),
  userRoles: many(userRoles),
  notifications: many(notifications),
  auditEvents: many(auditEvents),
}));
export const studentsRelations = relations(students, ({ one, many }) => ({
  user: one(users, { fields: [students.userId], references: [users.id] }),
  program: one(programs, { fields: [students.programId], references: [programs.id] }),
  theses: many(thesisProjects),
}));
export const lecturersRelations = relations(lecturers, ({ one, many }) => ({
  user: one(users, { fields: [lecturers.userId], references: [users.id] }),
  program: one(programs, { fields: [lecturers.programId], references: [programs.id] }),
  assignments: many(supervisorAssignments),
  logbooks: many(logbooks),
  examinerAssignments: many(examinerAssignments),
  topics: many(researchTopics),
}));

export const researchTopicsRelations = relations(researchTopics, ({ one }) => ({
  program: one(programs, { fields: [researchTopics.programId], references: [programs.id] }),
  term: one(academicTerms, { fields: [researchTopics.termId], references: [academicTerms.id] }),
  lecturer: one(lecturers, { fields: [researchTopics.lecturerId], references: [lecturers.id] }),
}));
export const rolesRelations = relations(roles, ({ many }) => ({ userRoles: many(userRoles) }));
export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
  scope: one(programs, { fields: [userRoles.scopeId], references: [programs.id] }),
}));

export const programsRelations = relations(programs, ({ many }) => ({
  students: many(students), lecturers: many(lecturers), theses: many(thesisProjects), policies: many(academicPolicies),
}));
export const academicTermsRelations = relations(academicTerms, ({ many }) => ({
  theses: many(thesisProjects), logbooks: many(logbooks), policies: many(academicPolicies), periods: many(activityPeriods),
}));
export const thesisProjectsRelations = relations(thesisProjects, ({ one, many }) => ({
  student: one(students, { fields: [thesisProjects.studentId], references: [students.id] }),
  program: one(programs, { fields: [thesisProjects.programId], references: [programs.id] }),
  term: one(academicTerms, { fields: [thesisProjects.termId], references: [academicTerms.id] }),
  supervisors: many(supervisorAssignments),
  logbooks: many(logbooks),
  applications: many(applications),
  documents: many(documents),
  seminars: many(seminars),
}));
export const supervisorAssignmentsRelations = relations(supervisorAssignments, ({ one }) => ({
  thesis: one(thesisProjects, { fields: [supervisorAssignments.thesisId], references: [thesisProjects.id] }),
  lecturer: one(lecturers, { fields: [supervisorAssignments.lecturerId], references: [lecturers.id] }),
}));
export const academicPoliciesRelations = relations(academicPolicies, ({ one }) => ({
  program: one(programs, { fields: [academicPolicies.programId], references: [programs.id] }),
  term: one(academicTerms, { fields: [academicPolicies.termId], references: [academicTerms.id] }),
}));

export const logbooksRelations = relations(logbooks, ({ one, many }) => ({
  thesis: one(thesisProjects, { fields: [logbooks.thesisId], references: [thesisProjects.id] }),
  lecturer: one(lecturers, { fields: [logbooks.lecturerId], references: [lecturers.id] }),
  term: one(academicTerms, { fields: [logbooks.termId], references: [academicTerms.id] }),
  versions: many(logbookVersions),
}));
export const logbookVersionsRelations = relations(logbookVersions, ({ one, many }) => ({
  logbook: one(logbooks, { fields: [logbookVersions.logbookId], references: [logbooks.id] }),
  evaluations: many(supervisorEvaluations),
}));
export const supervisorEvaluationsRelations = relations(supervisorEvaluations, ({ one }) => ({
  logbookVersion: one(logbookVersions, { fields: [supervisorEvaluations.logbookVersionId], references: [logbookVersions.id] }),
  lecturer: one(lecturers, { fields: [supervisorEvaluations.lecturerId], references: [lecturers.id] }),
}));

export const activityTypesRelations = relations(activityTypes, ({ many }) => ({
  periods: many(activityPeriods), requirements: many(documentRequirements), applications: many(applications),
}));
export const activityPeriodsRelations = relations(activityPeriods, ({ one, many }) => ({
  activityType: one(activityTypes, { fields: [activityPeriods.activityTypeId], references: [activityTypes.id] }),
  term: one(academicTerms, { fields: [activityPeriods.termId], references: [academicTerms.id] }),
  applications: many(applications),
}));
export const documentRequirementsRelations = relations(documentRequirements, ({ one }) => ({
  activityType: one(activityTypes, { fields: [documentRequirements.activityTypeId], references: [activityTypes.id] }),
}));
export const applicationsRelations = relations(applications, ({ one, many }) => ({
  thesis: one(thesisProjects, { fields: [applications.thesisId], references: [thesisProjects.id] }),
  activityType: one(activityTypes, { fields: [applications.activityTypeId], references: [activityTypes.id] }),
  period: one(activityPeriods, { fields: [applications.periodId], references: [activityPeriods.id] }),
  documents: many(applicationDocuments), reviews: many(documentReviews), approvals: many(approvalSteps), schedules: many(schedules),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  owner: one(users, { fields: [documents.ownerUserId], references: [users.id] }),
  thesis: one(thesisProjects, { fields: [documents.thesisId], references: [thesisProjects.id] }),
  versions: many(documentVersions),
}));
export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  document: one(documents, { fields: [documentVersions.documentId], references: [documents.id] }),
  uploader: one(users, { fields: [documentVersions.uploadedBy], references: [users.id] }),
}));
export const applicationDocumentsRelations = relations(applicationDocuments, ({ one }) => ({
  application: one(applications, { fields: [applicationDocuments.applicationId], references: [applications.id] }),
  documentVersion: one(documentVersions, { fields: [applicationDocuments.documentVersionId], references: [documentVersions.id] }),
  requirement: one(documentRequirements, { fields: [applicationDocuments.requirementId], references: [documentRequirements.id] }),
}));
export const documentReviewsRelations = relations(documentReviews, ({ one }) => ({
  application: one(applications, { fields: [documentReviews.applicationId], references: [applications.id] }),
  documentVersion: one(documentVersions, { fields: [documentReviews.documentVersionId], references: [documentVersions.id] }),
  reviewer: one(users, { fields: [documentReviews.reviewerUserId], references: [users.id] }),
}));
export const approvalStepsRelations = relations(approvalSteps, ({ one }) => ({
  application: one(applications, { fields: [approvalSteps.applicationId], references: [applications.id] }),
  approver: one(users, { fields: [approvalSteps.approverUserId], references: [users.id] }),
}));

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  application: one(applications, { fields: [schedules.applicationId], references: [applications.id] }),
  examiners: many(examinerAssignments), results: many(sessionResults),
}));
export const examinerAssignmentsRelations = relations(examinerAssignments, ({ one }) => ({
  schedule: one(schedules, { fields: [examinerAssignments.scheduleId], references: [schedules.id] }),
  lecturer: one(lecturers, { fields: [examinerAssignments.lecturerId], references: [lecturers.id] }),
}));
export const sessionResultsRelations = relations(sessionResults, ({ one, many }) => ({
  schedule: one(schedules, { fields: [sessionResults.scheduleId], references: [schedules.id] }),
  finalizer: one(users, { fields: [sessionResults.finalizedBy], references: [users.id] }),
  revisions: many(revisionItems),
}));
export const revisionItemsRelations = relations(revisionItems, ({ one, many }) => ({
  result: one(sessionResults, { fields: [revisionItems.resultId], references: [sessionResults.id] }),
  lecturer: one(lecturers, { fields: [revisionItems.lecturerId], references: [lecturers.id] }),
  submissions: many(revisionSubmissions),
}));
export const revisionSubmissionsRelations = relations(revisionSubmissions, ({ one }) => ({
  revision: one(revisionItems, { fields: [revisionSubmissions.revisionId], references: [revisionItems.id] }),
  documentVersion: one(documentVersions, { fields: [revisionSubmissions.documentVersionId], references: [documentVersions.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(users, { fields: [notifications.recipientUserId], references: [users.id] }),
}));
export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  actor: one(users, { fields: [auditEvents.actorUserId], references: [users.id] }),
}));

export const seminarsRelations = relations(seminars, ({ one, many }) => ({
  thesis: one(thesisProjects, { fields: [seminars.thesisId], references: [thesisProjects.id] }),
  evaluations: many(seminarEvaluations),
}));

export const seminarEvaluationsRelations = relations(seminarEvaluations, ({ one }) => ({
  seminar: one(seminars, { fields: [seminarEvaluations.seminarId], references: [seminars.id] }),
  lecturer: one(lecturers, { fields: [seminarEvaluations.lecturerId], references: [lecturers.id] }),
}));
