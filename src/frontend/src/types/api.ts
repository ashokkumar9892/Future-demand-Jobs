// Mirrors the DTO contracts in FutureTech.Application/Contracts.

export type ProgressStatus = 'NotStarted' | 'InProgress' | 'Completed';
export type PlanStatus = 'NotStarted' | 'Scheduled' | 'InProgress' | 'Completed' | 'Late';
export type TrackMode = 'FastTrack' | 'Balanced' | 'Deep';
export type EvidenceKind = 'ProfessionalExperience' | 'PersonalProject' | 'Training' | 'Certification';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: 'Learner' | 'Admin';
  themePreference: string;
  yearsExperience: number;
  onboardingCompleted: boolean;
  targetCareerPathId?: string;
  targetCareerTitle?: string;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: UserProfile;
}

// ---------- careers ----------

export interface CareerSummary {
  id: string;
  rank: number;
  title: string;
  slug: string;
  summary: string;
  salaryMinUsd: number;
  salaryMaxUsd: number;
  seniorSalaryMinUsd: number;
  seniorSalaryMaxUsd: number;
  twoHundredKPotential: string;
  demandOutlook: string;
  demandNotes: string;
  aiReplacementRisk: string;
  aiRiskNotes: string;
  difficulty: string;
  estimatedHours: number;
  estimatedWeeksAt12Hours: number;
  isPrimaryRecommended: boolean;
  skillsYouHave: number;
  skillsToLearn: number;
  salaryAsOf: string;
  salarySource: string;
}

export interface SkillGapEntry {
  skillId: string;
  name: string;
  slug: string;
  category: string;
  importance: string;
  currentLevel: number;
  targetLevel: number;
  gap: number;
}

export interface LadderStage {
  stageOrder: number;
  title: string;
  roleTitle: string;
  description: string;
  salaryMinUsd: number;
  salaryMaxUsd: number;
  durationMonths: number;
  milestones: string[];
  isCurrentPosition: boolean;
}

export interface TrainingEstimate {
  totalHours: number;
  weeklyHours: number;
  weeks: number;
  months: number;
  estimatedCompletionDate: string;
  estimatedCompletionMonth: string;
  dailyHoursRequired: number;
  trackMode: string;
  disclaimer: string;
}

export interface CareerCertification {
  id: string;
  code: string;
  name: string;
  vendor: string;
  level: string;
  estimatedPrepHours: number;
  examCostUsd: number;
  officialUrl: string;
  priority: number;
}

export interface CareerProject {
  id: string;
  title: string;
  slug: string;
  summary: string;
  techStack: string;
  estimatedHours: number;
}

export interface CareerCourse {
  id: string;
  phaseNumber: number;
  title: string;
  slug: string;
  summary: string;
  estimatedHours: number;
  level: string;
  lessonCount: number;
  completedLessons: number;
}

export interface CareerDetail {
  summary: CareerSummary;
  resumeKeywords: string[];
  responsibilities: string[];
  interviewFocus: string[];
  skillsYouHave: SkillGapEntry[];
  skillsToLearn: SkillGapEntry[];
  ladder: LadderStage[];
  certifications: CareerCertification[];
  projects: CareerProject[];
  courses: CareerCourse[];
  totalTrainingHours: number;
  estimate: TrainingEstimate;
}

export interface RoadmapPhase {
  phaseNumber: number;
  title: string;
  slug: string;
  summary: string;
  estimatedHours: number;
  lessonCount: number;
  completedLessons: number;
  progressPercent: number;
  status: ProgressStatus;
  estimatedStartMonth: string;
  estimatedEndMonth: string;
}

export interface Roadmap {
  currentRole: string;
  targetCareerTitle: string;
  targetCareerSlug: string;
  targetSalaryRange: string;
  ladder: LadderStage[];
  phases: RoadmapPhase[];
  estimate: TrainingEstimate;
  overallProgressPercent: number;
  disclaimer: string;
}

// ---------- learning ----------

export interface CourseListItem {
  id: string;
  phaseNumber: number;
  order: number;
  title: string;
  slug: string;
  summary: string;
  estimatedHours: number;
  level: string;
  minimumTrack: TrackMode;
  careerTitle: string;
  moduleCount: number;
  lessonCount: number;
  completedLessons: number;
  progressPercent: number;
}

export interface LessonListItem {
  id: string;
  order: number;
  title: string;
  slug: string;
  type: string;
  estimatedMinutes: number;
  status: ProgressStatus;
  videoWatched: boolean;
  quizScorePercent?: number;
  hasVideo: boolean;
  hasQuiz: boolean;
  minimumTrack: TrackMode;
}

export interface CourseModule {
  id: string;
  order: number;
  title: string;
  summary: string;
  estimatedHours: number;
  lessons: LessonListItem[];
  progressPercent: number;
}

export interface CourseDetail {
  course: CourseListItem;
  outcomes: string[];
  modules: CourseModule[];
}

export interface VideoDto {
  id: string;
  title: string;
  youTubeUrl?: string | null;
  instructor?: string | null;
  durationMinutes: number;
  skillLevel: string;
  isVerified: boolean;
  lessonId: string;
  lessonTitle?: string;
  lessonSlug?: string;
}

export interface QuizOption {
  id: string;
  order: number;
  text: string;
}

export interface QuizQuestion {
  id: string;
  order: number;
  prompt: string;
  allowsMultiple: boolean;
  options: QuizOption[];
}

export interface Quiz {
  id: string;
  title: string;
  passMarkPercent: number;
  questions: QuizQuestion[];
}

export interface LessonNavItem {
  id: string;
  title: string;
  slug: string;
  status: ProgressStatus;
  order: number;
  moduleTitle: string;
}

export interface LessonResource {
  id: string;
  title: string;
  url: string;
  kind: string;
}

export interface LessonDetail {
  id: string;
  title: string;
  slug: string;
  type: string;
  estimatedMinutes: number;
  contentMarkdown: string;
  codeExample?: string | null;
  codeLanguage: string;
  diagramMermaid?: string | null;
  keyTakeaways: string[];
  resources: LessonResource[];
  videos: VideoDto[];
  quiz?: Quiz | null;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  moduleTitle: string;
  status: ProgressStatus;
  videoWatched: boolean;
  minutesSpent: number;
  quizScorePercent?: number;
  isBookmarked: boolean;
  courseNavigation: LessonNavItem[];
  previous?: LessonNavItem | null;
  next?: LessonNavItem | null;
  relatedPractice: PracticeListItem[];
}

export interface QuizResult {
  scorePercent: number;
  passed: boolean;
  xpAwarded: number;
  results: { questionId: string; correct: boolean; correctOptionIds: string[]; explanation: string }[];
}

// ---------- study planning ----------

export interface StudyProfileDto {
  weekdayHours: number;
  saturdayHours: number;
  sundayHours: number;
  studyDays: string[];
  targetCompletionDate?: string;
  targetCareerPathId?: string;
  targetCareerTitle?: string;
  desiredSalaryUsd: number;
  currentSkillLevel: number;
  trackMode: TrackMode;
  weeklyHours: number;
  onboardingCompleted: boolean;
}

export interface TrackBreakdown {
  area: string;
  hours: number;
  completedHours: number;
}

export interface PaceScenario {
  weeklyHours: number;
  weeks: number;
  months: number;
  label: string;
}

export interface StudyCalculation {
  careerTitle: string;
  trackMode: string;
  totalCourseHours: number;
  hoursCompleted: number;
  hoursRemaining: number;
  weeklyHours: number;
  dailyHoursRequired: number;
  weeksRemaining: number;
  daysRemaining: number;
  monthsRemaining: number;
  estimatedCompletionDate: string;
  estimatedCompletionMonth: string;
  breakdown: TrackBreakdown[];
  paceScenarios: PaceScenario[];
  disclaimer: string;
}

export interface StudyPlanItem {
  id: string;
  order: number;
  activityType: string;
  title: string;
  minutes: number;
  refType: string;
  refId?: string;
  deepLink?: string;
  status: PlanStatus;
}

export interface StudyPlanDay {
  id: string;
  onDate: string;
  dayOfWeek: string;
  status: PlanStatus;
  targetMinutes: number;
  completedMinutes: number;
  items: StudyPlanItem[];
}

export interface StartTodayResponse {
  nextItem?: StudyPlanItem;
  deepLink?: string;
  today?: StudyPlanDay;
  message: string;
}

export interface CalendarDay {
  onDate: string;
  status: PlanStatus;
  targetMinutes: number;
  completedMinutes: number;
  itemCount: number;
  titles: string[];
}

export interface CalendarWeek {
  weekNumber: number;
  label: string;
  startDate: string;
  endDate: string;
  theme: string;
  days: CalendarDay[];
}

export interface CalendarMonth {
  year: number;
  month: number;
  monthName: string;
  weeks: CalendarWeek[];
  totalPlannedMinutes: number;
  totalCompletedMinutes: number;
}

// ---------- dashboard ----------

export interface ProgressRing {
  label: string;
  percent: number;
  detail?: string;
}
export interface SkillRadarPoint {
  skill: string;
  current: number;
  target: number;
}
export interface WeeklyHoursPoint {
  weekLabel: string;
  plannedHours: number;
  actualHours: number;
}
export interface DashboardTodayItem {
  title: string;
  activityType: string;
  minutes: number;
  deepLink?: string;
  status: PlanStatus;
}
export interface NextUp {
  nextLessonTitle?: string;
  nextLessonSlug?: string;
  nextPracticeTitle?: string;
  nextPracticeId?: string;
  nextProjectTitle?: string;
  nextProjectSlug?: string;
}
export interface CurrentProject {
  id: string;
  title: string;
  slug: string;
  percentComplete: number;
  milestonesDone: number;
  milestonesTotal: number;
}
export interface UpcomingCertification {
  id: string;
  code: string;
  name: string;
  status: string;
  targetDate?: string;
  estimatedPrepHours: number;
}
export interface BadgeDto {
  id: string;
  code: string;
  name: string;
  description: string;
  tier: string;
  criteria: string;
  earned: boolean;
  earnedAt?: string;
}
export interface Gamification {
  totalXp: number;
  level: number;
  levelTitle: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
  studyStreakDays: number;
  longestStreakDays: number;
  badgesEarned: number;
  badgesTotal: number;
  badges: BadgeDto[];
}

export interface Dashboard {
  greeting: string;
  displayName: string;
  targetCareerTitle?: string;
  targetCareerSlug?: string;
  targetSalaryRange: string;
  estimatedCompletion: string;
  progressPercent: number;
  studyStreakDays: number;
  hoursCompleted: number;
  totalHours: number;
  coursesCompleted: number;
  totalCourses: number;
  projectsCompleted: number;
  totalProjects: number;
  practiceQuestionsAnswered: number;
  readinessRings: ProgressRing[];
  skillRadar: SkillRadarPoint[];
  weeklyHours: WeeklyHoursPoint[];
  today: DashboardTodayItem[];
  nextUp: NextUp;
  currentProject?: CurrentProject;
  upcomingCertification?: UpcomingCertification;
  gamification: Gamification;
}

// ---------- practice / labs / interview ----------

export interface PracticeListItem {
  id: string;
  category: string;
  mode: string;
  prompt: string;
  tags: string;
  estimatedMinutes: number;
  bestScore?: number;
  attemptCount: number;
}

export interface RubricDimension {
  dimension: string;
  weight: number;
  guidance: string;
}

export interface PracticeDetail {
  id: string;
  category: string;
  mode: string;
  prompt: string;
  scenario: string;
  tags: string;
  estimatedMinutes: number;
  rubric: RubricDimension[];
  bestScore?: number;
  lastAnswer?: string;
  isBookmarked: boolean;
}

export interface DimensionScore {
  dimension: string;
  score: number;
  weight: number;
  comment: string;
}

export interface PracticeResult {
  score: number;
  dimensions: DimensionScore[];
  strengths: string[];
  weaknesses: string[];
  modelAnswer: string;
  evaluationMethod: string;
  xpAwarded: number;
}

export interface ArchitectureChallengeListItem {
  id: string;
  title: string;
  slug: string;
  scenario: string;
  difficulty: string;
  estimatedMinutes: number;
  bestScore?: number;
}

export interface ArchitectureChoiceGroup {
  key: string;
  label: string;
  options: string[];
}

export interface ArchitectureChallengeDetail {
  id: string;
  title: string;
  slug: string;
  scenario: string;
  difficulty: string;
  estimatedMinutes: number;
  requirements: string[];
  choiceGroups: ArchitectureChoiceGroup[];
  diagramMermaid?: string | null;
  bestScore?: number;
}

export interface ArchitectureGroupResult {
  key: string;
  label: string;
  yourChoice: string;
  suggestedChoice: string;
  matched: boolean;
  acceptable: boolean;
  rationale: string;
}

export interface ArchitectureResult {
  score: number;
  groups: ArchitectureGroupResult[];
  rationale: string;
  diagramMermaid?: string | null;
  xpAwarded: number;
}

export interface CodingExerciseListItem {
  id: string;
  category: string;
  title: string;
  slug: string;
  difficulty: string;
  language: string;
  estimatedMinutes: number;
  passed: boolean;
  bestScore?: number;
}

export interface CodingExerciseDetail {
  id: string;
  category: string;
  title: string;
  slug: string;
  difficulty: string;
  problemMarkdown: string;
  language: string;
  starterCode: string;
  testNames: string[];
  estimatedMinutes: number;
  lastSubmission?: string;
  passed: boolean;
  isBookmarked: boolean;
}

export interface CodingResult {
  passed: boolean;
  score: number;
  tests: { name: string; passed: boolean; hint: string }[];
  solutionCode?: string;
  explanation?: string;
  xpAwarded: number;
  evaluationMethod: string;
}

export interface InterviewQuestionListItem {
  id: string;
  category: string;
  difficulty: string;
  question: string;
  timeLimitSeconds: number;
  bestScore?: number;
  attemptCount: number;
}

export interface InterviewQuestionDetail {
  id: string;
  category: string;
  difficulty: string;
  question: string;
  tips: string;
  timeLimitSeconds: number;
  followUps: string[];
  bestScore?: number;
  isBookmarked: boolean;
}

export interface InterviewResult {
  score: number;
  dimensions: DimensionScore[];
  strengths: string[];
  weaknesses: string[];
  suggestedAnswer: string;
  evaluationMethod: string;
  xpAwarded: number;
}

export interface MockInterviewTurn {
  id: string;
  order: number;
  question: string;
  isFollowUp: boolean;
  answerText?: string;
  turnScore?: number;
  feedback?: string;
}

export interface MockInterviewState {
  sessionId: string;
  careerTitle: string;
  turnsAnswered: number;
  totalPlanned: number;
  currentTurn?: MockInterviewTurn;
  isComplete: boolean;
  history: MockInterviewTurn[];
}

export interface MockInterviewScorecard {
  sessionId: string;
  communication: number;
  technicalKnowledge: number;
  architecture: number;
  problemSolving: number;
  securityAwareness: number;
  overallScore: number;
  recommendations: string[];
  turns: MockInterviewTurn[];
  evaluationMethod: string;
}

// ---------- projects / certifications / readiness / resume ----------

export interface ProjectListItem {
  id: string;
  order: number;
  title: string;
  slug: string;
  summary: string;
  techStack: string;
  difficulty: string;
  estimatedHours: number;
  status: ProgressStatus;
  percentComplete: number;
}

export interface ProjectMilestone {
  id: string;
  order: number;
  title: string;
  description: string;
  estimatedHours: number;
  completed: boolean;
}

export interface ProjectDetail {
  project: ProjectListItem;
  briefMarkdown: string;
  architectureMermaid?: string | null;
  acceptanceCriteria: string[];
  resumeBullets: string[];
  skills: string[];
  milestones: ProjectMilestone[];
  repoUrl?: string;
  demoUrl?: string;
  notes: string;
  isBookmarked: boolean;
}

export interface CertificationDto {
  id: string;
  code: string;
  name: string;
  vendor: string;
  level: string;
  estimatedPrepHours: number;
  topics: string[];
  examCostUsd: number;
  officialUrl: string;
  status: string;
  targetDate?: string;
  completedDate?: string;
  scorePercent?: number;
  prepHoursLogged: number;
  recommendedForTarget: boolean;
}

export interface ReadinessDimension {
  name: string;
  score: number;
  weight: number;
}

export interface CareerReadiness {
  careerPathId: string;
  careerTitle: string;
  careerSlug: string;
  rank: number;
  overall: number;
  verdict: 'Ready' | 'AlmostReady' | 'NeedsTraining';
  verdictLabel: string;
  dimensions: ReadinessDimension[];
  disclaimer: string;
}

export interface SkillMatrixRow {
  skillId: string;
  name: string;
  slug: string;
  category: string;
  current: number;
  target: number;
  gap: number;
  importance: string;
}

export interface SkillMatrix {
  careerTitle?: string;
  rows: SkillMatrixRow[];
  averageCurrent: number;
  averageTarget: number;
}

export interface ResumeItem {
  id: string;
  section: string;
  text: string;
  evidenceKind: EvidenceKind;
  skillSlug?: string;
  order: number;
}

export interface Resume {
  headline: string;
  beforeHeadline: string;
  summary: string;
  generatedAt: string;
  items: ResumeItem[];
  suggestedKeywords: string[];
  readinessPercent: number;
  evidencePolicy: string;
}

// ---------- personal ----------

export interface Note {
  id: string;
  scope: string;
  refId?: string;
  refTitle: string;
  title: string;
  body: string;
  isImportant: boolean;
  isQuestion: boolean;
  codeSnippet?: string;
  links: string;
  tags: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Bookmark {
  id: string;
  itemType: string;
  refId: string;
  title: string;
  subtitle: string;
  deepLink?: string;
  createdAt: string;
}

export interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  deepLink?: string;
  matched: string;
}

export interface SearchResponse {
  query: string;
  total: number;
  results: SearchResult[];
}

// ---------- admin ----------

export interface AdminField {
  name: string;
  type: string;
  required: boolean;
  options?: string[];
}

export interface AdminResource {
  key: string;
  label: string;
  entityName: string;
  count: number;
  fields: AdminField[];
}

export interface AdminPage {
  resource: string;
  total: number;
  page: number;
  pageSize: number;
  items: Record<string, unknown>[];
}

export interface AdminStats {
  careers: number;
  courses: number;
  modules: number;
  lessons: number;
  videos: number;
  videosWithUrl: number;
  practiceQuestions: number;
  interviewQuestions: number;
  projects: number;
  certifications: number;
  codingExercises: number;
  architectureChallenges: number;
  skills: number;
  badges: number;
  learners: number;
}

// ---------- feedback & engagement ----------
// Optional fields are optional rather than nullable: the API omits nulls
// (JsonIgnoreCondition.WhenWritingNull), so the key is absent, not null.

export type FeedbackStatus =
  | 'New'
  | 'UnderReview'
  | 'Planned'
  | 'InProgress'
  | 'Implemented'
  | 'Declined';

export type FeedbackCategory =
  | 'General'
  | 'Course'
  | 'Lesson'
  | 'Video'
  | 'Practice'
  | 'Project'
  | 'Bug'
  | 'FeatureRequest'
  | 'Content';

export interface Feedback {
  id: string;
  userId: string;
  learnerName: string;
  learnerEmail: string;
  category: FeedbackCategory;
  subject: string;
  message: string;
  rating: number;
  area?: string;
  refType?: string;
  refId?: string;
  status: FeedbackStatus;
  adminResponse?: string;
  implementationNote?: string;
  handledByName?: string;
  submittedAt: string;
  respondedAt?: string;
  implementedAt?: string;
}

/** The admin list adds the internal triage note, which learner endpoints never return. */
export interface AdminFeedback {
  item: Feedback;
  adminNote?: string;
}

export interface FeedbackSummary {
  total: number;
  open: number;
  new: number;
  underReview: number;
  planned: number;
  inProgress: number;
  implemented: number;
  declined: number;
  averageRating: number;
  ratedCount: number;
  byCategory: { category: string; count: number; averageRating: number }[];
}

export interface LoginEvent {
  id: string;
  userId?: string;
  email: string;
  displayName: string;
  outcome: 'Success' | 'WrongPassword' | 'UnknownAccount';
  at: string;
  ipAddress: string;
  location: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  timeZone?: string;
  isp?: string;
  latitude?: number;
  longitude?: number;
  browser: string;
  operatingSystem: string;
  deviceKind: string;
  geoState: 'Pending' | 'Resolved' | 'Private' | 'Unavailable';
}

export interface LocationRollup {
  location: string;
  countryCode?: string;
  loginCount: number;
  learners: number;
  lastSeenAt: string;
}

export interface LearnerRow {
  id: string;
  email: string;
  displayName: string;
  role: 'Learner' | 'Admin';
  yearsExperience: number;
  joinedAt: string;
  onboardingCompleted: boolean;
  targetCareer?: string;
  lastLoginAt?: string;
  lastLocation?: string;
  lastDevice?: string;
  lastIpAddress?: string;
  loginCount: number;
  failedLoginCount: number;
  currentCourse?: string;
  currentCourseId?: string;
  currentCoursePercent: number;
  coursesStarted: number;
  coursesCompleted: number;
  lessonsCompleted: number;
  lessonsInProgress: number;
  minutesStudied: number;
  xp: number;
  feedbackCount: number;
  lastActivityAt?: string;
}

export interface LearnerCourseProgress {
  courseId: string;
  title: string;
  slug: string;
  phaseNumber: number;
  level: string;
  totalLessons: number;
  completedLessons: number;
  inProgressLessons: number;
  percentComplete: number;
  minutesSpent: number;
  status: string;
  startedAt?: string;
  lastActivityAt?: string;
}

export interface LearnerDetail {
  learner: LearnerRow;
  courses: LearnerCourseProgress[];
  logins: LoginEvent[];
  locations: LocationRollup[];
  feedback: Feedback[];
}

export interface CourseEngagement {
  courseId: string;
  title: string;
  slug: string;
  phaseNumber: number;
  totalLessons: number;
  learners: number;
  activeLast7Days: number;
  completedLearners: number;
  averagePercent: number;
  minutesStudied: number;
  lastActivityAt?: string;
}

export interface EngagementOverview {
  totalLearners: number;
  newLast30Days: number;
  activeLast7Days: number;
  activeLast30Days: number;
  loginsLast7Days: number;
  failedLoginsLast7Days: number;
  openFeedback: number;
  implementedFeedback: number;
  averageRating: number;
  topLocations: LocationRollup[];
  topCourses: CourseEngagement[];
}

export interface Paged<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}
