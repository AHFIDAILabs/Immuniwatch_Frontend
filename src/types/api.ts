// ── Enums (mirror backend) ────────────────────────────────────────────────────

export type UserRole = 'analyst' | 'senior_analyst' | 'supervisor' | 'super_admin';
export type PostPlatform = 'twitter' | 'facebook' | 'youtube' | 'submission';
export type PostLanguage = 'en' | 'pcm' | 'ha' | 'yo' | 'ig';
export type ClassificationLabel = 'misinformation' | 'disinformation' | 'factual' | 'irrelevant' | 'pending';
export type HITLPriority = 'high' | 'standard';
export type HITLStatus = 'pending' | 'approved' | 'rejected' | 'overridden';
export type AlertSeverity = 'high' | 'medium' | 'low' | 'info';
export type AlertTriggerType = 'surge' | 'psi_drift' | 'model_update' | 'connector_error' | 'override_rate';

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  user: AuthUser;
}

// ── Posts ─────────────────────────────────────────────────────────────────────

export interface Classification {
  _id: string;
  postId: string;
  label: ClassificationLabel;
  confidence: number;
  fallback: boolean;
  modelVersion: string;
  createdAt: string;
}

export interface Post {
  _id: string;
  externalId?: string;
  platform: PostPlatform;
  content: string;
  language: PostLanguage;
  authorHandle?: string;
  ingestedAt: string;
  createdAt: string;
  classification?: Classification | null;
}

// ── HITL ──────────────────────────────────────────────────────────────────────

export interface HITLReview {
  _id: string;
  postId: Post | string;
  classificationId: Classification | string;
  priority: HITLPriority;
  status: HITLStatus;
  notes?: string;
  reviewerNote?: string;
  overriddenLabel?: ClassificationLabel;
  proposedResponse?: string;
  approvedResponse?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export interface Alert {
  _id: string;
  severity: AlertSeverity;
  triggerType: AlertTriggerType;
  title: string;
  message: string;
  affectedLanguage?: PostLanguage;
  isResolved: boolean;
  resolvedAt?: string;
  createdAt: string;
}

// ── Model Health ──────────────────────────────────────────────────────────────

export interface LanguageMetrics {
  macroF1: number;
  psi: number;
  sampleCount: number;
}

export interface ModelMetrics {
  _id: string;
  modelVersion: string;
  macroF1: number;
  recall: number;
  precision: number;
  inferenceP95ms: number;
  perLanguage: Partial<Record<PostLanguage, LanguageMetrics>>;
  feedbackQueue: number;
  lastRetrain: string;
  createdAt: string;
  stale?: boolean;
}

export interface RetrainingHistory {
  _id: string;
  runId: string;
  modelVersionBefore: string;
  modelVersionAfter?: string;
  f1Before: number;
  f1After?: number;
  status: 'promoted' | 'rejected' | 'archived' | 'in_progress';
  triggeredBy: string;
  startedAt: string;
  completedAt?: string;
}

// ── Knowledge Base ────────────────────────────────────────────────────────────

export interface KBDocument {
  _id: string;
  title: string;
  source: string;
  language: PostLanguage;
  cloudinaryUrl?: string;
  embedded: boolean;
  status?: 'ready' | 'processing' | 'failed';
  chunkCount?: number;
  tags: string[];
  createdAt: string;
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastActive?: string;
  createdAt: string;
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

export interface AuditEntry {
  _id: string;
  actor: string | { _id: string; name: string; role: UserRole };
  actorName?: string;
  actorRole?: UserRole;
  action: string;
  resourceType: string;
  resourceId?: string;
  newValue?: unknown;
  oldValue?: unknown;
  createdAt: string;
}

// ── Paginated response ────────────────────────────────────────────────────────

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Trends ───────────────────────────────────────────────────────────────────

export interface ClassificationBreakdownItem {
  label: ClassificationLabel;
  count: number;
}

export interface NarrativeItem {
  narrative: string;
  count: number;
  label: ClassificationLabel;
  trend: number[];
}

export interface PlatformIngestionItem {
  _id: string;
  count: number;
}

export interface LanguageDistributionItem {
  _id: PostLanguage;
  count: number;
}

export interface DailyMisinformationItem {
  date: string;
  count: number;
}

export interface DailyBreakdownItem {
  date: string;
  day: string;
  misinformation: number;
  disinformation: number;
  factual: number;
  irrelevant: number;
}

export interface FeedbackItem {
  _id: string;
  postId: string;
  originalLabel: ClassificationLabel;
  correctedLabel: ClassificationLabel;
  createdAt: string;
}

// ── HITL stats ────────────────────────────────────────────────────────────────

export interface HITLMyStats {
  reviewedToday: number;
  reviewedThisWeek: number;
  overrideRate: number;
  pendingTotal: number;
}

export interface HITLTeamStats {
  reviewedToday: number;
  reviewedThisWeek: number;
  overrideRate: number;
  pendingHigh: number;
  pendingStandard: number;
  topReviewers: Array<{ name: string; count: number }>;
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export interface PipelineStatus {
  status: 'healthy' | 'degraded' | 'fallback' | 'retraining';
  retrainingStartedAt?: string;
  mlService: {
    url: string;
    circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    healthy: boolean;
    modelVersion: string;
    lastHealthError: string | null;
    lastChecked: string;
  };
}
