import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AccessProvider } from '@/app/access-provider';
import { useAuth } from '@/app/providers';
import { AccessGate } from '@/components/access-gate';
import { AppShell } from '@/components/layout/AppShell';
import { LoadingPanel } from '@/components/ui';

const Login = lazy(() => import('@/pages/Login'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Careers = lazy(() => import('@/pages/Careers'));
const CareerDetail = lazy(() => import('@/pages/CareerDetail'));
const RoadmapPage = lazy(() => import('@/pages/Roadmap'));
const Courses = lazy(() => import('@/pages/Courses'));
const CourseDetail = lazy(() => import('@/pages/CourseDetail'));
const Lesson = lazy(() => import('@/pages/Lesson'));
const Videos = lazy(() => import('@/pages/Videos'));
const Practice = lazy(() => import('@/pages/Practice'));
const PracticeDetail = lazy(() => import('@/pages/PracticeDetail'));
const CodingLabs = lazy(() => import('@/pages/CodingLabs'));
const CodingLabDetail = lazy(() => import('@/pages/CodingLabDetail'));
const ArchitectureLab = lazy(() => import('@/pages/ArchitectureLab'));
const ArchitectureLabDetail = lazy(() => import('@/pages/ArchitectureLabDetail'));
const Projects = lazy(() => import('@/pages/Projects'));
const ProjectDetail = lazy(() => import('@/pages/ProjectDetail'));
const Certifications = lazy(() => import('@/pages/Certifications'));
const InterviewPrep = lazy(() => import('@/pages/InterviewPrep'));
const MockInterview = lazy(() => import('@/pages/MockInterview'));
const JobReadiness = lazy(() => import('@/pages/JobReadiness'));
const ResumeBuilder = lazy(() => import('@/pages/ResumeBuilder'));
const CalendarPage = lazy(() => import('@/pages/Calendar'));
const Bookmarks = lazy(() => import('@/pages/Bookmarks'));
const Notes = lazy(() => import('@/pages/Notes'));
const Skills = lazy(() => import('@/pages/Skills'));
const SettingsPage = lazy(() => import('@/pages/Settings'));
const Admin = lazy(() => import('@/pages/admin/Admin'));
const AdminInsights = lazy(() => import('@/pages/admin/Insights'));
const FeedbackPage = lazy(() => import('@/pages/Feedback'));
const MyLearning = lazy(() => import('@/pages/MyLearning'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const VerifyCertificate = lazy(() => import('@/pages/VerifyCertificate'));
const NotFound = lazy(() => import('@/pages/NotFound'));

/**
 * Readable without an account, subject to the free-access policy.
 *
 * The API already serves this content anonymously — every catalogue and lesson
 * GET is AllowAnonymous — so the only thing that kept it behind sign-in was
 * this router. A visitor gets the same shell and the same pages; the meter in
 * AccessProvider decides when they are asked to create an account.
 *
 * A signed-in learner who has not finished onboarding is sent to the wizard, as
 * on a protected route: their personal panels have nothing to render without it.
 */
function Public({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <FullPageLoader />;

  if (user && user.role !== 'Admin' && !user.onboardingCompleted && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <AppShell>{children}</AppShell>;
}

function Protected({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  // A learner who has not finished the wizard has no study profile to plan
  // against, so every screen would be empty. Send them there first. Admins are
  // here to manage content, not to study, so the wizard does not apply to them.
  if (user.role !== 'Admin' && !user.onboardingCompleted && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <AppShell>{children}</AppShell>;
}

function Home() {
  const { user, ready } = useAuth();
  if (!ready) return <FullPageLoader />;
  if (!user) return <Navigate to="/careers" replace />;
  return (
    <Protected>
      <Dashboard />
    </Protected>
  );
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user && user.role !== 'Admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function FullPageLoader() {
  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-surface-base">
      <LoadingPanel label="Loading FutureTech Academy" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AccessProvider>
      <Suspense fallback={<FullPageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Public: someone shown a certificate can check it without an account. */}
          <Route path="/verify" element={<VerifyCertificate />} />
          <Route path="/verify/:number" element={<VerifyCertificate />} />
          <Route path="/register" element={<Login mode="register" />} />

          <Route
            path="/onboarding"
            element={
              <OnboardingGate>
                <Onboarding />
              </OnboardingGate>
            }
          />

          {/* The dashboard is entirely personal, so a visitor with no account
              lands on the catalogue instead of being bounced to sign-in. */}
          <Route path="/" element={<Home />} />
          <Route path="/careers" element={<Public><Careers /></Public>} />
          <Route path="/careers/:slug" element={<Public><CareerDetail /></Public>} />
          <Route path="/roadmap" element={<Protected><RoadmapPage /></Protected>} />
          <Route path="/courses" element={<Public><Courses /></Public>} />
          <Route path="/courses/:slug" element={<Public><CourseDetail /></Public>} />
          <Route path="/courses/:slug/buy" element={<Protected><Checkout /></Protected>} />
          <Route path="/learn/:slug" element={<Public><Lesson /></Public>} />
          <Route path="/videos" element={<Public><Videos /></Public>} />
          <Route path="/practice" element={<Public><Practice /></Public>} />
          <Route path="/practice/:id" element={<Public><PracticeDetail /></Public>} />
          <Route path="/coding-labs" element={<Public><CodingLabs /></Public>} />
          <Route path="/coding-labs/:slug" element={<Public><CodingLabDetail /></Public>} />
          <Route path="/architecture-lab" element={<Public><ArchitectureLab /></Public>} />
          <Route path="/architecture-lab/:id" element={<Public><ArchitectureLabDetail /></Public>} />
          <Route path="/projects" element={<Public><Projects /></Public>} />
          <Route path="/projects/:slug" element={<Public><ProjectDetail /></Public>} />
          <Route path="/certifications" element={<Public><Certifications /></Public>} />
          <Route path="/interview-prep" element={<Public><InterviewPrep /></Public>} />
          <Route path="/mock-interview" element={<Protected><MockInterview /></Protected>} />
          <Route path="/job-readiness" element={<Protected><JobReadiness /></Protected>} />
          <Route path="/resume" element={<Protected><ResumeBuilder /></Protected>} />
          <Route path="/calendar" element={<Protected><CalendarPage /></Protected>} />
          <Route path="/bookmarks" element={<Protected><Bookmarks /></Protected>} />
          <Route path="/notes" element={<Protected><Notes /></Protected>} />
          <Route path="/skills" element={<Protected><Skills /></Protected>} />
          <Route path="/my-learning" element={<Protected><MyLearning /></Protected>} />
          <Route path="/feedback" element={<Protected><FeedbackPage /></Protected>} />
          <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
          <Route
            path="/admin"
            element={
              <Protected>
                <AdminOnly>
                  <Admin />
                </AdminOnly>
              </Protected>
            }
          />
          <Route
            path="/admin/learners"
            element={
              <Protected>
                <AdminOnly>
                  <AdminInsights />
                </AdminOnly>
              </Protected>
            }
          />

          <Route path="*" element={<Public><NotFound /></Public>} />
        </Routes>
        <AccessGate />
      </Suspense>
      </AccessProvider>
    </BrowserRouter>
  );
}

/** The wizard needs authentication but must not itself be gated on completion. */
function OnboardingGate({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
