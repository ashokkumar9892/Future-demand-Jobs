import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/providers';
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
const NotFound = lazy(() => import('@/pages/NotFound'));

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
      <Suspense fallback={<FullPageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Login mode="register" />} />

          <Route
            path="/onboarding"
            element={
              <OnboardingGate>
                <Onboarding />
              </OnboardingGate>
            }
          />

          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/careers" element={<Protected><Careers /></Protected>} />
          <Route path="/careers/:slug" element={<Protected><CareerDetail /></Protected>} />
          <Route path="/roadmap" element={<Protected><RoadmapPage /></Protected>} />
          <Route path="/courses" element={<Protected><Courses /></Protected>} />
          <Route path="/courses/:slug" element={<Protected><CourseDetail /></Protected>} />
          <Route path="/learn/:slug" element={<Protected><Lesson /></Protected>} />
          <Route path="/videos" element={<Protected><Videos /></Protected>} />
          <Route path="/practice" element={<Protected><Practice /></Protected>} />
          <Route path="/practice/:id" element={<Protected><PracticeDetail /></Protected>} />
          <Route path="/coding-labs" element={<Protected><CodingLabs /></Protected>} />
          <Route path="/coding-labs/:slug" element={<Protected><CodingLabDetail /></Protected>} />
          <Route path="/architecture-lab" element={<Protected><ArchitectureLab /></Protected>} />
          <Route path="/architecture-lab/:id" element={<Protected><ArchitectureLabDetail /></Protected>} />
          <Route path="/projects" element={<Protected><Projects /></Protected>} />
          <Route path="/projects/:slug" element={<Protected><ProjectDetail /></Protected>} />
          <Route path="/certifications" element={<Protected><Certifications /></Protected>} />
          <Route path="/interview-prep" element={<Protected><InterviewPrep /></Protected>} />
          <Route path="/mock-interview" element={<Protected><MockInterview /></Protected>} />
          <Route path="/job-readiness" element={<Protected><JobReadiness /></Protected>} />
          <Route path="/resume" element={<Protected><ResumeBuilder /></Protected>} />
          <Route path="/calendar" element={<Protected><CalendarPage /></Protected>} />
          <Route path="/bookmarks" element={<Protected><Bookmarks /></Protected>} />
          <Route path="/notes" element={<Protected><Notes /></Protected>} />
          <Route path="/skills" element={<Protected><Skills /></Protected>} />
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

          <Route path="*" element={<Protected><NotFound /></Protected>} />
        </Routes>
      </Suspense>
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
