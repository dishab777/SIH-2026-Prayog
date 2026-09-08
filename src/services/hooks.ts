import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { api, query, type Fetched } from './api';
import type {
  Application,
  AuditEvent,
  CatalogueSolution,
  Challenge,
  ChangeRequest,
  ClarificationThread,
  Contract,
  Department,
  Evaluation,
  EvaluationPanel,
  Evidence,
  GateRecord,
  Incident,
  IntegrationHealth,
  Kpi,
  Milestone,
  Notification,
  PaymentClaim,
  Pilot,
  ProcurementCase,
  Risk,
  ScaleUpCase,
  Startup,
  StartupDocument,
  User,
  ValidationReport,
  WaitingItem,
} from '@/types/models';
import type { GateDefinition, GateId, PreconditionResult } from '@/config/gates';
import type { Role, Action, Resource, RoleDefinition } from '@/config/rbac';
import type { ConfigParameter, PolicyCitation } from '@/config/types';
import type { EligibilityRuleDefinition, RuleField, RuleOperator } from '@/config/rules';
import type { RubricDefinition } from '@/config/rubrics';
import type { ClauseDefinition, DataTierDefinition, PathwayDefinition, TemplateDefinition } from '@/config/templates';

/* ------------------------------------------------------------------ session */

export interface SessionPayload {
  user: User | null;
  role: Role;
  department?: Department | null;
  startup?: Startup | null;
}

export function useSession(): UseQueryResult<Fetched<SessionPayload>> {
  return useQuery({ queryKey: ['session'], queryFn: () => api.get<SessionPayload>('/api/auth/me') });
}

export function useAccounts(): UseQueryResult<Fetched<User[]>> {
  return useQuery({ queryKey: ['accounts'], queryFn: () => api.get<User[]>('/api/auth/accounts') });
}

export function useSignIn(): UseMutationResult<
  Fetched<{ user: User | null }>,
  Error,
  { userId?: string; role?: Role; email?: string; password?: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<{ user: User | null }>('/api/auth/login', input),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export interface RegistrationReceipt {
  registered: boolean;
  kind: 'startup' | 'expert';
  email: string;
  reference: string;
}

/**
 * Register a startup or an expert.
 *
 * The whole form goes to the API, which re-validates it against the same Zod
 * schema the form used. What comes back is a receipt — never an echo of what
 * was typed, and never the password.
 */
export function useRegister(): UseMutationResult<
  Fetched<RegistrationReceipt>,
  Error,
  { kind: 'startup' | 'expert' } & Record<string, unknown>
> {
  return useMutation({ mutationFn: (input) => api.post<RegistrationReceipt>('/api/auth/register', input) });
}

/* --------------------------------------------------------------- challenges */

export type ChallengeFilters = Record<string, string | number | boolean | string[] | undefined | null>;

export function useChallenges(filters: ChallengeFilters = {}): UseQueryResult<Fetched<Challenge[]>> {
  return useQuery({
    queryKey: ['challenges', filters],
    queryFn: () => api.get<Challenge[]>(`/api/challenges${query(filters)}`),
  });
}

export interface ChallengeDetail {
  challenge: Challenge;
  department?: Department;
  owner?: User;
  clarifications: ClarificationThread[];
  gates: GateRecord[];
  pilot: Pilot | null;
}

/**
 * The challenge, as one of two documents.
 *
 * 'notice' is what the programme published: the problem, the outcome, the
 * rubric, the closing date — readable by any account, from any department.
 * 'case-file' is the department's own working record behind it, and the API
 * refuses that to anyone outside the department that owns it. The workspace
 * asks for the file; the public challenge page asks for the notice.
 */
export function useChallenge(
  id: string | undefined,
  view: 'notice' | 'case-file' = 'notice',
): UseQueryResult<Fetched<ChallengeDetail>> {
  return useQuery({
    queryKey: ['challenge', id, view],
    queryFn: () => api.get<ChallengeDetail>(`/api/challenges/${id}${view === 'case-file' ? '?view=case-file' : ''}`),
    enabled: Boolean(id),
  });
}

export function useCreateChallenge(): UseMutationResult<Fetched<Challenge>, Error, Partial<Challenge>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<Challenge>('/api/challenges', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['challenges'] }),
  });
}

export function useUpdateChallenge(
  id: string | undefined,
): UseMutationResult<Fetched<Challenge>, Error, Partial<Challenge>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.patch<Challenge>(`/api/challenges/${id}`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['challenge', id] });
      void qc.invalidateQueries({ queryKey: ['challenges'] });
    },
  });
}

export function usePublishChallenge(): UseMutationResult<Fetched<Challenge>, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post<Challenge>(`/api/challenges/${id}/publish`),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useAnswerClarification(): UseMutationResult<
  Fetched<ClarificationThread>,
  Error,
  { challengeId: string; clarificationId: string; answer: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ challengeId, clarificationId, answer }) =>
      api.post<ClarificationThread>(`/api/challenges/${challengeId}/clarifications/${clarificationId}/answer`, { answer }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['challenge'] }),
  });
}

export function useResolveLanguageFlag(
  challengeId: string | undefined,
): UseMutationResult<
  Fetched<Challenge['languageFlags']>,
  Error,
  { flagId: string; status: 'accepted' | 'edited' | 'dismissed'; replacementText?: string; dismissReason?: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ flagId, ...rest }) =>
      api.post<Challenge['languageFlags']>(`/api/challenges/${challengeId}/language-check/${flagId}`, rest),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['challenge', challengeId] }),
  });
}

/* -------------------------------------------------------------- applications */

export interface ApplicationRow {
  application: Application;
  challenge: Challenge;
  startup: Startup;
}

export function useApplications(challengeId?: string): UseQueryResult<Fetched<ApplicationRow[]>> {
  return useQuery({
    queryKey: ['applications', challengeId ?? 'mine'],
    queryFn: () => api.get<ApplicationRow[]>(`/api/applications${query({ challengeId })}`),
  });
}

export interface ScreeningPayload {
  challenge: Challenge;
  items: { application: Application; startup: Startup }[];
}

export function useScreening(challengeId: string | undefined): UseQueryResult<Fetched<ScreeningPayload>> {
  return useQuery({
    queryKey: ['screening', challengeId],
    queryFn: () => api.get<ScreeningPayload>(`/api/challenges/${challengeId}/applications`),
    enabled: Boolean(challengeId),
  });
}

export interface ApplicationDetail {
  application: Application;
  challenge: Challenge;
  startup: Startup;
  evaluations: Evaluation[];
  coi: { evaluatorId: string; declared: boolean; hasConflict: boolean }[];
}

export function useApplication(id: string | undefined): UseQueryResult<Fetched<ApplicationDetail>> {
  return useQuery({
    queryKey: ['application', id],
    queryFn: () => api.get<ApplicationDetail>(`/api/applications/${id}`),
    enabled: Boolean(id),
  });
}

export function useStartApplication(): UseMutationResult<Fetched<Application>, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (challengeId) => api.post<Application>(`/api/challenges/${challengeId}/applications`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['applications'] }),
  });
}

export function useSaveApplication(
  id: string | undefined,
): UseMutationResult<Fetched<Application>, Error, Partial<Application>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.patch<Application>(`/api/applications/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['application', id] }),
  });
}

export function useSubmitApplication(): UseMutationResult<
  Fetched<{ application: Application; receipt: { reference: string; at: string; hash: string } }>,
  Error,
  string
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      api.post<{ application: Application; receipt: { reference: string; at: string; hash: string } }>(
        `/api/applications/${id}/submit`,
      ),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useOverrideEligibility(): UseMutationResult<
  Fetched<Application>,
  Error,
  { applicationId: string; ruleId: string; result: 'pass' | 'fail' | 'review'; justification: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, ruleId, ...rest }) =>
      api.post<Application>(`/api/applications/${applicationId}/eligibility/${ruleId}/override`, rest),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useApplicationDecision(): UseMutationResult<
  Fetched<Application>,
  Error,
  { id: string; status: Application['status']; note?: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...rest }) => api.post<Application>(`/api/applications/${id}/decision`, rest),
    onSuccess: () => qc.invalidateQueries(),
  });
}

/* --------------------------------------------------------------- evaluation */

export interface EvaluatorQueueItem {
  panelId: string;
  challengeCaseId: string;
  challengeTitle: string;
  challengeId: string;
  applicationId: string;
  applicationCaseId: string;
  applicantLabel: string;
  coiDeclared: boolean;
  coiConflict: boolean;
  deadline?: string;
  rubricId: string;
  criteriaTotal: number;
  criteriaScored: number;
  status: Evaluation['status'];
}

export function useEvaluatorQueue(): UseQueryResult<Fetched<EvaluatorQueueItem[]>> {
  return useQuery({ queryKey: ['evaluator-queue'], queryFn: () => api.get<EvaluatorQueueItem[]>('/api/evaluator/queue') });
}

export interface CoiPayload {
  applicationId: string;
  applicationCaseId: string;
  applicant: {
    legalName: string;
    tradeName: string;
    state: string;
    directors: string[];
    investors: string[];
    relationships: string[];
  };
  declaration: { declared: boolean; hasConflict: boolean; declaredAt?: string } | null;
}

export function useCoi(applicationId: string | undefined): UseQueryResult<Fetched<CoiPayload>> {
  return useQuery({
    queryKey: ['coi', applicationId],
    queryFn: () => api.get<CoiPayload>(`/api/coi/${applicationId}`),
    enabled: Boolean(applicationId),
  });
}

export function useDeclareCoi(
  applicationId: string | undefined,
): UseMutationResult<Fetched<unknown>, Error, { hasConflict: boolean; natureOfConflict?: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post(`/api/coi/${applicationId}`, input),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export interface ScoringPayload {
  application: Application;
  challenge: Challenge;
  rubric: RubricDefinition;
  own: Evaluation | null;
  others: Evaluation[];
  othersHiddenCount: number;
  rationaleMinChars: number;
}

export function useScoringWorkspace(applicationId: string | undefined): UseQueryResult<Fetched<ScoringPayload>> {
  return useQuery({
    queryKey: ['scoring', applicationId],
    queryFn: () => api.get<ScoringPayload>(`/api/applications/${applicationId}/evaluation`),
    enabled: Boolean(applicationId),
    retry: false,
  });
}

export function useStartEvaluation(): UseMutationResult<Fetched<Evaluation>, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (applicationId) => api.post<Evaluation>('/api/evaluations', { applicationId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scoring'] }),
  });
}

export function useSaveScore(
  evaluationId: string | undefined,
): UseMutationResult<
  Fetched<Evaluation>,
  Error,
  { criterionId: string; score: number; rationale: string; evidenceReference: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (score) => api.patch<Evaluation>(`/api/evaluations/${evaluationId}`, { score }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scoring'] }),
  });
}

export function useSubmitEvaluation(): UseMutationResult<Fetched<Evaluation>, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post<Evaluation>(`/api/evaluations/${id}/submit`),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export interface PanelPayload {
  challenge: Challenge;
  panel: EvaluationPanel | null;
  evaluators: {
    user: User;
    declaredCount: number;
    conflictCount: number;
    totalAssigned: number;
    submitted: number;
  }[];
  results: {
    application: Application;
    startup: Startup;
    evaluations: (Evaluation & { evaluatorName: string; deviation: number; isOutlier: boolean })[];
    mean: number;
    complete: boolean;
  }[];
  outlierThreshold: number;
  minEvaluators: number;
}

export function useEvaluationPanel(challengeId: string | undefined): UseQueryResult<Fetched<PanelPayload>> {
  return useQuery({
    queryKey: ['panel', challengeId],
    queryFn: () => api.get<PanelPayload>(`/api/challenges/${challengeId}/evaluation`),
    enabled: Boolean(challengeId),
  });
}

export function useReleaseResults(): UseMutationResult<Fetched<EvaluationPanel>, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (panelId) => api.post<EvaluationPanel>(`/api/panels/${panelId}/release`),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useRecordMinutes(): UseMutationResult<Fetched<EvaluationPanel>, Error, { panelId: string; minutes: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ panelId, minutes }) => api.post<EvaluationPanel>(`/api/panels/${panelId}/minutes`, { minutes }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useRecordConsensus(): UseMutationResult<
  Fetched<EvaluationPanel>,
  Error,
  { panelId: string; applicationId: string; score: number; varianceNote: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ panelId, ...rest }) => api.post<EvaluationPanel>(`/api/panels/${panelId}/consensus`, rest),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useRequestRationale(): UseMutationResult<Fetched<Evaluation>, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (evaluationId) => api.post<Evaluation>(`/api/evaluations/${evaluationId}/rationale-request`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['panel'] }),
  });
}

/* -------------------------------------------------------------------- gates */

export interface GatePayload {
  record: GateRecord;
  definition: GateDefinition;
  preconditions: { key: string; result: PreconditionResult; note: string; evidenceIds: string[] }[];
  owner: User;
  canDecide: boolean;
  decisionRoleRequired: string;
  reasonMinChars: number;
  waiverAuthority: string;
  entity: {
    id: string;
    type: 'challenge' | 'pilot';
    caseId: string;
    title: string;
    departmentId: string;
    departmentName: string;
    budgetPaise: number;
  };
  ladder: GateRecord[];
  audit: AuditEvent[];
}

export function useGate(id: string | undefined): UseQueryResult<Fetched<GatePayload>> {
  return useQuery({
    queryKey: ['gate', id],
    queryFn: () => api.get<GatePayload>(`/api/gates/${id}`),
    enabled: Boolean(id),
  });
}

export function useGateDecision(
  id: string | undefined,
): UseMutationResult<
  Fetched<{ record: GateRecord; consequences: string[]; notified: string[] }>,
  Error,
  { decision: 'clear' | 'return' | 'reject' | 'defer'; reason: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      api.post<{ record: GateRecord; consequences: string[]; notified: string[] }>(`/api/gates/${id}/decision`, input),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useRequestWaiver(id: string | undefined): UseMutationResult<Fetched<GateRecord>, Error, { reason: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<GateRecord>(`/api/gates/${id}/waiver`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gate', id] }),
  });
}

/* ------------------------------------------------------------------- pilots */

export interface PilotRow {
  pilot: Pilot;
  startup: Startup;
  department: Department;
  milestones: Milestone[];
  kpis: Kpi[];
}

export function usePilots(scope?: string): UseQueryResult<Fetched<PilotRow[]>> {
  return useQuery({ queryKey: ['pilots', scope], queryFn: () => api.get<PilotRow[]>(`/api/pilots${query({ scope })}`) });
}

export interface PilotDetail {
  pilot: Pilot;
  challenge: Challenge;
  startup: Startup;
  department: Department;
  contract: Contract | null;
  milestones: Milestone[];
  kpis: Kpi[];
  evidence: Evidence[];
  risks: Risk[];
  incidents: Incident[];
  changeRequests: ChangeRequest[];
  claims: PaymentClaim[];
  gates: GateRecord[];
  validation: ValidationReport | null;
  procurement: ProcurementCase | null;
  scaleUp: ScaleUpCase | null;
}

export function usePilot(id: string | undefined): UseQueryResult<Fetched<PilotDetail>> {
  return useQuery({
    queryKey: ['pilot', id],
    queryFn: () => api.get<PilotDetail>(`/api/pilots/${id}`),
    enabled: Boolean(id),
  });
}

export function useSubmitMilestone(): UseMutationResult<
  Fetched<Milestone>,
  Error,
  { milestoneId: string; evidence: { fileName: string; type: string; sizeBytes: number }[] }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ milestoneId, evidence }) => api.post<Milestone>(`/api/milestones/${milestoneId}/submit`, { evidence }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useApproveMilestone(): UseMutationResult<
  Fetched<{ milestone: Milestone; claim: PaymentClaim }>,
  Error,
  { milestoneId: string; finding: 'met' | 'partially_met'; note: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ milestoneId, ...rest }) =>
      api.post<{ milestone: Milestone; claim: PaymentClaim }>(`/api/milestones/${milestoneId}/approve`, rest),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useRejectMilestone(): UseMutationResult<
  Fetched<Milestone>,
  Error,
  { milestoneId: string; note: string; revisionRequired?: boolean }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ milestoneId, ...rest }) => api.post<Milestone>(`/api/milestones/${milestoneId}/reject`, rest),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export interface MeasurementPayload {
  pilot: Pilot;
  kpis: Kpi[];
  dataQuality: {
    kpiId: string;
    expectedReadings: number;
    actualReadings: number;
    missing: number;
    outliers: number;
    gaps: number;
    note: string;
  }[];
  confounders: string[];
  attribution: string | null;
}

export function useMeasurement(pilotId: string | undefined): UseQueryResult<Fetched<MeasurementPayload>> {
  return useQuery({
    queryKey: ['measurement', pilotId],
    queryFn: () => api.get<MeasurementPayload>(`/api/pilots/${pilotId}/measurement`),
    enabled: Boolean(pilotId),
  });
}

export function useRecordAttribution(
  pilotId: string | undefined,
): UseMutationResult<Fetched<{ recorded: boolean }>, Error, { explanation: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<{ recorded: boolean }>(`/api/pilots/${pilotId}/attribution`, input),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDecideChange(): UseMutationResult<
  Fetched<ChangeRequest>,
  Error,
  { id: string; status: 'approved' | 'refused'; note: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...rest }) => api.post<ChangeRequest>(`/api/change-requests/${id}/decide`, rest),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useUpdateIncident(): UseMutationResult<
  Fetched<Incident>,
  Error,
  { id: string; status: 'open' | 'contained' | 'resolved'; resolution?: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...rest }) => api.patch<Incident>(`/api/incidents/${id}`, rest),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useAddRisk(
  pilotId: string | undefined,
): UseMutationResult<
  Fetched<Risk>,
  Error,
  { title: string; category: string; probability: number; impact: number; mitigation: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<Risk>(`/api/pilots/${pilotId}/risks`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pilot', pilotId] }),
  });
}

/* ----------------------------------------------------------------- payments */

export interface PaymentRow {
  claim: PaymentClaim;
  milestone: Milestone;
  pilot: Pilot;
  startup: Startup;
  department: Department;
  daysElapsed: number;
  daysRemaining: number;
  limitDays: number;
}

export interface PaymentsPayload {
  items: PaymentRow[];
  limitDays: number;
  deductionReasons: { code: string; label: string; citation: string }[];
  maxDeductionPercent: number;
  bulkMax: number;
  totals: { outstandingPaise: number; overdueCount: number; oldestDays: number };
}

export function usePayments(status?: string[]): UseQueryResult<Fetched<PaymentsPayload>> {
  return useQuery({
    queryKey: ['payments', status],
    queryFn: () => api.get<PaymentsPayload>(`/api/payments${query({ status })}`),
  });
}

export function useApprovePayment(): UseMutationResult<
  Fetched<PaymentClaim>,
  Error,
  { id: string; deductionPaise?: number; deductionReasonCode?: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...rest }) => api.post<PaymentClaim>(`/api/payments/${id}/approve`, rest),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function usePayClaim(): UseMutationResult<Fetched<PaymentClaim>, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post<PaymentClaim>(`/api/payments/${id}/pay`),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useBulkApprove(): UseMutationResult<Fetched<{ approved: number }>, Error, string[]> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids) => api.post<{ approved: number }>('/api/payments/bulk-approve', { ids }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

/* --------------------------------------------------------------- validation */

export interface ValidationPayload {
  pilot: Pilot;
  report: ValidationReport | null;
  challenge: Challenge;
  startup: Startup;
  kpis: Kpi[];
  milestones: Milestone[];
  evidence: Evidence[];
  incidents: Incident[];
  rawRecords: {
    kpiId: string;
    name: string;
    unit: string;
    baseline: number;
    rows: { at: string; value: number; sampleSize: number }[];
    derived: { mean: number; totalSample: number; changePercent: number };
  }[];
}

export function useValidation(pilotId: string | undefined): UseQueryResult<Fetched<ValidationPayload>> {
  return useQuery({
    queryKey: ['validation', pilotId],
    queryFn: () => api.get<ValidationPayload>(`/api/pilots/${pilotId}/validation`),
    enabled: Boolean(pilotId),
  });
}

export function useSaveValidation(
  pilotId: string | undefined,
): UseMutationResult<Fetched<ValidationReport>, Error, Partial<ValidationReport>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<ValidationReport>(`/api/pilots/${pilotId}/validation`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['validation', pilotId] }),
  });
}

export function useSignValidation(): UseMutationResult<
  Fetched<ValidationReport>,
  Error,
  { id: string; outcome: 'validated' | 'validated_with_qualifications' | 'not_validated'; qualifications?: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...rest }) => api.post<ValidationReport>(`/api/validation/${id}/sign`, rest),
    onSuccess: () => qc.invalidateQueries(),
  });
}

/* -------------------------------------------------------------- procurement */

export interface ProcurementPayload {
  procurement: ProcurementCase;
  pilot: Pilot;
  validation: ValidationReport | null;
  challenge: Challenge;
  startup: Startup;
  scaleUp: ScaleUpCase | null;
  advice: { pathway: PathwayDefinition; fit: number }[];
  recommended: PathwayDefinition | null;
  threshold: number;
  vfmMinSaving: number;
}

export function useProcurement(pilotId: string | undefined): UseQueryResult<Fetched<ProcurementPayload>> {
  return useQuery({
    queryKey: ['procurement', pilotId],
    queryFn: () => api.get<ProcurementPayload>(`/api/procurement/${pilotId}`),
    enabled: Boolean(pilotId),
  });
}

export function useSelectPathway(
  pilotId: string | undefined,
): UseMutationResult<Fetched<ProcurementCase>, Error, { pathwayId: string; justification: string; reasonsAgainst: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<ProcurementCase>(`/api/procurement/${pilotId}/pathway`, input),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useGeneratePackage(
  pilotId: string | undefined,
): UseMutationResult<Fetched<ScaleUpCase>, Error, void> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ScaleUpCase>(`/api/procurement/${pilotId}/generate-package`),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function usePlanScaleUp(
  pilotId: string | undefined,
): UseMutationResult<Fetched<ScaleUpCase>, Error, { districts: string[]; projectedValuePaise: number }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<ScaleUpCase>(`/api/scale/${pilotId}`, input),
    onSuccess: () => qc.invalidateQueries(),
  });
}

/* ---------------------------------------------------------------- dashboards */

export interface DepartmentDashboard {
  department: Department;
  waiting: WaitingItem[];
  gateDwell: { gate: GateId; openCases: number; blockedCases: number; medianDwellDays: number; slaDays: number }[];
  portfolio: {
    openChallenges: number;
    livePilots: number;
    committedPaise: number;
    releasedPaise: number;
    gateDistribution: { gate: string; count: number }[];
  };
  paymentRisk: { claim: PaymentClaim; startup: Startup; daysElapsed: number; daysRemaining: number }[];
  limitDays: number;
}

export function useDepartmentDashboard(): UseQueryResult<Fetched<DepartmentDashboard>> {
  return useQuery({ queryKey: ['dashboard', 'department'], queryFn: () => api.get<DepartmentDashboard>('/api/dashboard/department') });
}

export interface MatchReason {
  key: string;
  label: string;
  weightPercent: number;
  matched: boolean;
  detail: string;
}

export interface StartupDashboard {
  startup: Startup;
  waitingOnYou: WaitingItem[];
  waitingOnThem: { id: string; caseId: string; title: string; status: string; detail: string; href: string }[];
  recommendations: { challenge: Challenge; score: number; reasons: MatchReason[]; department: Department }[];
  money: { outstandingPaise: number; claimCount: number; oldestDays: number; limitDays: number; overdueCount: number };
  profileCompleteness: number;
  profileGaps: string[];
}

export function useStartupDashboard(): UseQueryResult<Fetched<StartupDashboard>> {
  return useQuery({ queryKey: ['dashboard', 'startup'], queryFn: () => api.get<StartupDashboard>('/api/dashboard/startup') });
}

export interface MatchesPayload {
  weights: { key: string; label: string; weightPercent: number }[];
  fits: { challenge: Challenge; department: Department; score: number; reasons: MatchReason[] }[];
  nearMisses: { challenge: Challenge; department: Department; score: number; reasons: MatchReason[] }[];
}

export function useMatches(): UseQueryResult<Fetched<MatchesPayload>> {
  return useQuery({ queryKey: ['matches'], queryFn: () => api.get<MatchesPayload>('/api/matches') });
}

export function useChallengeMatches(challengeId: string | undefined): UseQueryResult<
  Fetched<{ weights: { key: string; label: string; weightPercent: number }[]; items: { startup: Startup; score: number; reasons: MatchReason[] }[] }>
> {
  return useQuery({
    queryKey: ['challenge-matches', challengeId],
    queryFn: () =>
      api.get<{ weights: { key: string; label: string; weightPercent: number }[]; items: { startup: Startup; score: number; reasons: MatchReason[] }[] }>(
        `/api/challenges/${challengeId}/matches`,
      ),
    enabled: Boolean(challengeId),
  });
}

/* ------------------------------------------------------------------- public */

export interface TransparencyPayload {
  headline: {
    departments: number;
    openProblems: number;
    committedPaise: number;
    activePilots: number;
    startups: number;
    districts: number;
    applications: number;
  };
  medians: {
    publicationToAwardDays: number;
    acceptanceToPaymentDays: number;
    paymentTimelinessPercent: number;
    limitDays: number;
  };
  gateDwell: { gate: string; medianDwellDays: number; slaDays: number; clearedCount: number }[];
  funnel: { stage: string; count: number }[];
  pilotOutcomes: { outcome: string; count: number }[];
  pilotsByDepartment: { department: string; pilots: number; committedPaise: number }[];
  scaleUpRate: { validated: number; scaled: number };
  servedFor: string;
}

export function useTransparency(): UseQueryResult<Fetched<TransparencyPayload>> {
  return useQuery({ queryKey: ['transparency'], queryFn: () => api.get<TransparencyPayload>('/api/transparency') });
}

/**
 * A published result.
 *
 * Everything except `id` and `outcome` is optional, because the server sends
 * two different projections: signed out you get the outcome and nothing that
 * identifies anybody, signed in you get the whole record. The type says so, so
 * a component cannot read a company name it was never sent and quietly render
 * `undefined` on a public page.
 */
export interface ResultRow {
  id: string;
  outcome: ValidationReport['outcome'] | null;
  pilot?: Pilot;
  challenge?: Challenge;
  department?: Department;
  startup?: Startup;
  claimed?: string;
  validated?: string;
  validator?: string | null;
  finalDecision?: string | null;
  pathway?: string | null;
  reason?: string | null;
}

/** A result with its parties attached — what a signed-in reader is sent. */
export type IdentifiedResultRow = ResultRow &
  Required<Pick<ResultRow, 'pilot' | 'challenge' | 'department' | 'startup' | 'claimed' | 'validated'>>;

/**
 * Narrow a payload to the rows that actually carry their parties.
 *
 * Signed out the server sends the outcome alone, so a page that renders a
 * company name asks this first rather than assuming. It is a guard, not a cast:
 * if the projection ever changes, the page renders nothing rather than
 * `undefined`.
 */
export function isIdentified(row: ResultRow): row is IdentifiedResultRow {
  return Boolean(row.pilot && row.challenge && row.department && row.startup);
}

export function useResults(): UseQueryResult<Fetched<ResultRow[]>> {
  return useQuery({ queryKey: ['results'], queryFn: () => api.get<ResultRow[]>('/api/results') });
}

export function useCatalogue(): UseQueryResult<
  Fetched<{ solution: CatalogueSolution; startup: Startup; department: Department }[]>
> {
  return useQuery({
    queryKey: ['catalogue'],
    queryFn: () => api.get<{ solution: CatalogueSolution; startup: Startup; department: Department }[]>('/api/catalogue'),
  });
}

export interface CatalogueDetail {
  solution: CatalogueSolution;
  startup: Startup;
  department: Department;
  pilot: Pilot;
  validation: ValidationReport | null;
  replicationPackage: ScaleUpCase | null;
  challenge: Challenge | null;
}

export function useCatalogueSolution(id: string | undefined): UseQueryResult<Fetched<CatalogueDetail>> {
  return useQuery({
    queryKey: ['catalogue', id],
    queryFn: () => api.get<CatalogueDetail>(`/api/catalogue/${id}`),
    enabled: Boolean(id),
  });
}

export interface StartupProfilePayload {
  startup: Startup;
  documents: StartupDocument[];
  publicRecord: { pilot: Pilot; department: Department; validation: ValidationReport | null }[];
}

export function useStartupProfile(id: string | undefined): UseQueryResult<Fetched<StartupProfilePayload>> {
  return useQuery({
    queryKey: ['startup', id],
    queryFn: () => api.get<StartupProfilePayload>(`/api/startups/${id}`),
    enabled: Boolean(id),
  });
}

export function useSaveStartup(id: string | undefined): UseMutationResult<Fetched<Startup>, Error, Partial<Startup>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.patch<Startup>(`/api/startups/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['startup', id] }),
  });
}

export function useRecheckDpiit(id: string | undefined): UseMutationResult<Fetched<Startup>, Error, void> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Startup>(`/api/startups/${id}/recheck-dpiit`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['startup', id] }),
  });
}

/* ------------------------------------------------------------- contracts */

export interface ContractPayload {
  contract: Contract;
  pilot: Pilot;
  milestones: Milestone[];
  startup: Startup;
  department: Department;
}

export function useContract(id: string | undefined): UseQueryResult<Fetched<ContractPayload>> {
  return useQuery({
    queryKey: ['contract', id],
    queryFn: () => api.get<ContractPayload>(`/api/contracts/${id}`),
    enabled: Boolean(id),
  });
}

export function useSignContract(
  id: string | undefined,
): UseMutationResult<Fetched<Contract>, Error, { name: string; designation: string; confirmed: boolean }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<Contract>(`/api/contracts/${id}/sign`, input),
    onSuccess: () => qc.invalidateQueries(),
  });
}

/* ------------------------------------------------------ notifications, search */

export function useNotifications(): UseQueryResult<Fetched<Notification[]>> {
  return useQuery({ queryKey: ['notifications'], queryFn: () => api.get<Notification[]>('/api/notifications') });
}

export function useMarkRead(): UseMutationResult<Fetched<{ updated: boolean }>, Error, { ids?: string[]; all?: boolean }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<{ updated: boolean }>('/api/notifications/read', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export interface SearchHit {
  id: string;
  caseId?: string;
  slug?: string;
  title: string;
  subtitle: string;
  gate?: string;
}

export interface SearchPayload {
  challenges: SearchHit[];
  startups: SearchHit[];
  pilots: SearchHit[];
  applications: SearchHit[];
}

export function useSearch(q: string): UseQueryResult<Fetched<SearchPayload>> {
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => api.get<SearchPayload>(`/api/search${query({ q })}`),
    enabled: q.trim().length > 1,
  });
}

/* -------------------------------------------------------------------- admin */

export function useConfig(): UseQueryResult<Fetched<{ parameters: ConfigParameter[]; citations: PolicyCitation[] }>> {
  return useQuery({
    queryKey: ['admin', 'config'],
    queryFn: () => api.get<{ parameters: ConfigParameter[]; citations: PolicyCitation[] }>('/api/admin/config'),
  });
}

export function useUpdateConfig(): UseMutationResult<
  Fetched<ConfigParameter>,
  Error,
  { key: string; value: string | number | boolean; effectiveFrom: string; changeNote: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, ...rest }) => api.patch<ConfigParameter>(`/api/admin/config/${key}`, rest),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'config'] }),
  });
}

export interface AdminRulesPayload {
  rules: { rule: EligibilityRuleDefinition; usedByChallenges: string[] }[];
  fields: { value: RuleField; label: string; type: string }[];
  operators: { value: RuleOperator; label: string }[];
}

export function useAdminRules(): UseQueryResult<Fetched<AdminRulesPayload>> {
  return useQuery({ queryKey: ['admin', 'rules'], queryFn: () => api.get<AdminRulesPayload>('/api/admin/rules') });
}

export interface RuleTestPayload {
  results: { startupId: string; name: string; dpiit: string; result: string; failedConditions: string[] }[];
  summary: { pass: number; fail: number; review: number };
}

export function useTestRule(): UseMutationResult<
  Fetched<RuleTestPayload>,
  Error,
  { id: string; conditions?: EligibilityRuleDefinition['conditions']; logic?: 'all' | 'any' }
> {
  return useMutation({
    mutationFn: ({ id, ...rest }) => api.post<RuleTestPayload>(`/api/admin/rules/${id}/test`, rest),
  });
}

export function useSaveRule(): UseMutationResult<
  Fetched<{ rule: EligibilityRuleDefinition; impact: string[] }>,
  Error,
  { id: string; changeNote: string; effectiveFrom: string; conditions?: EligibilityRuleDefinition['conditions']; logic?: 'all' | 'any' }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...rest }) =>
      api.patch<{ rule: EligibilityRuleDefinition; impact: string[] }>(`/api/admin/rules/${id}`, rest),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'rules'] }),
  });
}

export function useDeleteRule(): UseMutationResult<Fetched<EligibilityRuleDefinition>, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.del<EligibilityRuleDefinition>(`/api/admin/rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'rules'] }),
  });
}

export function useAdminRubrics(): UseQueryResult<
  Fetched<{ rubric: RubricDefinition; weightTotal: number; usedByChallenges: string[] }[]>
> {
  return useQuery({
    queryKey: ['admin', 'rubrics'],
    queryFn: () => api.get<{ rubric: RubricDefinition; weightTotal: number; usedByChallenges: string[] }[]>('/api/admin/rubrics'),
  });
}

export function useSaveRubric(): UseMutationResult<
  Fetched<{ rubric: RubricDefinition; weightTotal: number }>,
  Error,
  { id: string; criteria: RubricDefinition['criteria'] }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, criteria }) =>
      api.patch<{ rubric: RubricDefinition; weightTotal: number }>(`/api/admin/rubrics/${id}`, { criteria }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'rubrics'] }),
  });
}

export function useAdminTemplates(): UseQueryResult<
  Fetched<{ templates: TemplateDefinition[]; clauses: ClauseDefinition[] }>
> {
  return useQuery({
    queryKey: ['admin', 'templates'],
    queryFn: () => api.get<{ templates: TemplateDefinition[]; clauses: ClauseDefinition[] }>('/api/admin/templates'),
  });
}

export interface AdminUsersPayload {
  users: { user: User; department: string | null; startup: string | null }[];
  roles: RoleDefinition[];
  actions: Action[];
  resources: Resource[];
  matrix: Record<string, Partial<Record<string, string[]>>>;
}

export function useAdminUsers(): UseQueryResult<Fetched<AdminUsersPayload>> {
  return useQuery({ queryKey: ['admin', 'users'], queryFn: () => api.get<AdminUsersPayload>('/api/admin/users') });
}

export function useSaveUser(): UseMutationResult<Fetched<User>, Error, { id: string; active?: boolean; role?: Role }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...rest }) => api.patch<User>(`/api/admin/users/${id}`, rest),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useIntegrations(): UseQueryResult<Fetched<IntegrationHealth[]>> {
  return useQuery({
    queryKey: ['admin', 'integrations'],
    queryFn: () => api.get<IntegrationHealth[]>('/api/admin/integrations'),
  });
}

export function useSyncIntegration(): UseMutationResult<Fetched<IntegrationHealth>, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post<IntegrationHealth>(`/api/admin/integrations/${id}/sync`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'integrations'] }),
  });
}

export interface TaxonomyPayload {
  sectors: { name: string; challenges: number }[];
  capabilities: { name: string; challenges: number; startups: number }[];
  states: { name: string; districts: string[] }[];
  dataTiers: DataTierDefinition[];
  pathways: PathwayDefinition[];
  gates: GateDefinition[];
  stages: { id: string; title: string; actor: string }[];
}

export function useTaxonomy(): UseQueryResult<Fetched<TaxonomyPayload>> {
  return useQuery({ queryKey: ['admin', 'taxonomy'], queryFn: () => api.get<TaxonomyPayload>('/api/admin/taxonomy') });
}

export interface AuditPayload {
  items: AuditEvent[];
  actors: string[];
  actions: string[];
}

export function useAudit(filters: Record<string, string | undefined> = {}): UseQueryResult<Fetched<AuditPayload>> {
  return useQuery({
    queryKey: ['audit', filters],
    queryFn: () => api.get<AuditPayload>(`/api/audit${query(filters)}`),
  });
}

export interface AuditPackPayload {
  caseId: string;
  challenge: Challenge | null;
  pilot: Pilot | null;
  gates: GateRecord[];
  evaluations: (Evaluation & { evaluatorName: string })[];
  overrides: { applicationCaseId: string; ruleId: string; override?: { justification: string; by: string; at: string } }[];
  milestones: Milestone[];
  claims: PaymentClaim[];
  evidence: Evidence[];
  validation: ValidationReport | null;
  procurement: ProcurementCase | null;
  timeline: AuditEvent[];
}

export function useAuditPack(caseId: string | undefined): UseQueryResult<Fetched<AuditPackPayload>> {
  return useQuery({
    queryKey: ['audit-pack', caseId],
    queryFn: () => api.get<AuditPackPayload>(`/api/reports/audit-pack/${caseId}`),
    enabled: Boolean(caseId),
  });
}

export interface ReportPayload {
  kind: string;
  columns: string[];
  rows: (string | number)[][];
}

export function useReport(kind: string): UseQueryResult<Fetched<ReportPayload>> {
  return useQuery({ queryKey: ['report', kind], queryFn: () => api.get<ReportPayload>(`/api/reports${query({ kind })}`) });
}
