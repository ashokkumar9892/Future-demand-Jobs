import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CornerDownRight, MessagesSquare, Play, Send, Square } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Disclaimer,
  EmptyState,
  ErrorPanel,
  Field,
  LoadingPanel,
  Progress,
  Select,
  Textarea,
} from '@/components/ui';
import { ProgressRing, ReadinessBars } from '@/components/charts';
import { cn, scoreTone } from '@/lib/format';
import type { CareerSummary, MockInterviewScorecard, MockInterviewState } from '@/types/api';

export default function MockInterview() {
  const queryClient = useQueryClient();

  const [session, setSession] = useState<MockInterviewState | null>(null);
  const [scorecard, setScorecard] = useState<MockInterviewScorecard | null>(null);
  const [answer, setAnswer] = useState('');
  const [careerId, setCareerId] = useState('');
  const [questionCount, setQuestionCount] = useState(5);

  const careers = useQuery({
    queryKey: ['careers'],
    queryFn: () => api.get<CareerSummary[]>('/careers'),
  });

  const latest = useQuery({
    queryKey: ['mock-interview-latest'],
    // The endpoint answers 204 when there is no completed session; React Query
    // requires a defined value, so normalise that to null.
    queryFn: async () =>
      (await api.get<MockInterviewScorecard | null>('/mock-interview/latest')) ?? null,
  });

  useEffect(() => {
    if (!scorecard && latest.data) setScorecard(latest.data);
  }, [latest.data, scorecard]);

  const start = useMutation({
    mutationFn: () =>
      api.post<MockInterviewState>('/mock-interview/start', {
        careerPathId: careerId || null,
        questionCount,
      }),
    onSuccess: (state) => {
      setSession(state);
      setScorecard(null);
      setAnswer('');
    },
  });

  const reply = useMutation({
    mutationFn: () =>
      api.post<MockInterviewState>(`/mock-interview/${session!.sessionId}/answer`, {
        answerText: answer,
      }),
    onSuccess: (state) => {
      setSession(state);
      setAnswer('');
    },
  });

  const finish = useMutation({
    mutationFn: () => api.post<MockInterviewScorecard>(`/mock-interview/${session!.sessionId}/finish`),
    onSuccess: (payload) => {
      setScorecard(payload);
      setSession(null);
      queryClient.invalidateQueries({ queryKey: ['mock-interview-latest'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return (
    <>
      <PageHeader
        title="Mock interview"
        description="One question per category so the scorecard has signal on every dimension. A weak answer earns a follow-up, the way a real panel would probe."
      />

      {!session && (
        <Card className="mb-5">
          <CardHeader title="Start a session" icon={<MessagesSquare size={15} />} />
          <div className="card-pad">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Target role">
                <Select value={careerId} onChange={(e) => setCareerId(e.target.value)}>
                  <option value="">Use my target career</option>
                  {(careers.data ?? []).map((career) => (
                    <option key={career.id} value={career.id}>
                      {career.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Questions">
                <Select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                >
                  {[3, 4, 5, 6, 8, 10].map((n) => (
                    <option key={n} value={n}>
                      {n} questions
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-end">
                <Button
                  variant="primary"
                  className="w-full"
                  loading={start.isPending}
                  onClick={() => start.mutate()}
                  icon={<Play size={15} />}
                >
                  Start interview
                </Button>
              </div>
            </div>
            {start.isError && (
              <div className="mt-3">
                <ErrorPanel message={(start.error as Error).message} />
              </div>
            )}
          </div>
        </Card>
      )}

      {session && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <Card>
              <CardHeader
                title={`Question ${session.turnsAnswered + 1}`}
                subtitle={`${session.careerTitle} · ${session.turnsAnswered} of ${session.totalPlanned} answered`}
                action={
                  session.currentTurn?.isFollowUp && (
                    <Badge tone="warning">
                      <CornerDownRight size={10} />
                      Follow-up
                    </Badge>
                  )
                }
              />
              <div className="card-pad">
                <Progress
                  value={(session.turnsAnswered / Math.max(1, session.totalPlanned)) * 100}
                  className="mb-4"
                />

                {session.currentTurn ? (
                  <>
                    <p className="text-[15px] leading-relaxed text-ink">{session.currentTurn.question}</p>
                    <Textarea
                      rows={10}
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Answer as you would out loud. Clarify assumptions, structure the response, and name the trade-offs."
                      className="mt-4 text-[13px] leading-relaxed"
                    />
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <Button
                        variant="ghost"
                        onClick={() => finish.mutate()}
                        loading={finish.isPending}
                        icon={<Square size={14} />}
                      >
                        End and score
                      </Button>
                      <Button
                        variant="primary"
                        loading={reply.isPending}
                        disabled={answer.trim().length < 10}
                        onClick={() => reply.mutate()}
                        icon={<Send size={14} />}
                      >
                        Submit answer
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <CheckCircle2 size={28} className="mx-auto text-emerald-400" />
                    <p className="mt-2 text-sm text-ink">All questions answered</p>
                    <Button
                      variant="primary"
                      className="mt-4"
                      loading={finish.isPending}
                      onClick={() => finish.mutate()}
                    >
                      See my scorecard
                    </Button>
                  </div>
                )}

                {reply.isError && (
                  <div className="mt-3">
                    <ErrorPanel message={(reply.error as Error).message} />
                  </div>
                )}
              </div>
            </Card>

            {session.history.filter((t) => t.answerText).length > 0 && (
              <Card>
                <CardHeader title="Answered so far" />
                <div className="divide-y divide-line">
                  {session.history
                    .filter((turn) => turn.answerText)
                    .map((turn) => (
                      <div key={turn.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[13px] text-ink">{turn.question}</p>
                          {turn.turnScore !== undefined && turn.turnScore !== null && (
                            <span
                              className={cn(
                                'shrink-0 text-sm font-semibold tabular-nums',
                                scoreTone(turn.turnScore),
                              )}
                            >
                              {turn.turnScore}%
                            </span>
                          )}
                        </div>
                        {turn.feedback && (
                          <p className="mt-2 border-l-2 border-line pl-3 text-[12px] leading-relaxed text-ink-faint">
                            {turn.feedback}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              </Card>
            )}
          </div>

          <Card className="h-fit">
            <CardHeader title="How to use this" />
            <ul className="space-y-2.5 card-pad text-[12px] leading-relaxed text-ink-muted">
              <li>Say the answer out loud first, then type what you actually said.</li>
              <li>Clarify before designing. Ask the questions you would ask a panel.</li>
              <li>Volunteer failure modes — that is the strongest differentiator at this level.</li>
              <li>Quantify. Requests per second, tokens per minute, cost per month.</li>
              <li>A weak answer triggers a follow-up. That is the point.</li>
            </ul>
          </Card>
        </div>
      )}

      {!session && scorecard && <Scorecard scorecard={scorecard} />}

      {!session && !scorecard && !latest.isLoading && (
        <EmptyState
          icon={<MessagesSquare size={26} />}
          title="No completed sessions yet"
          description="Run a mock interview and the five-dimension scorecard will appear here, so you can compare sessions over time."
        />
      )}

      {latest.isLoading && <LoadingPanel label="Loading previous session" />}
    </>
  );
}

function Scorecard({ scorecard }: { scorecard: MockInterviewScorecard }) {
  const dimensions = [
    { name: 'Communication', score: scorecard.communication },
    { name: 'Technical knowledge', score: scorecard.technicalKnowledge },
    { name: 'Architecture', score: scorecard.architecture },
    { name: 'Problem solving', score: scorecard.problemSolving },
    { name: 'Security awareness', score: scorecard.securityAwareness },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Card className="xl:col-span-1">
        <CardHeader title="Scorecard" subtitle="Most recent completed session" />
        <div className="card-pad">
          <div className="flex justify-center">
            <ProgressRing value={scorecard.overallScore} size={128} stroke={10} label="Overall" />
          </div>
          <div className="mt-6">
            <ReadinessBars data={dimensions} showWeight={false} />
          </div>
          <Disclaimer className="mt-4">{scorecard.evaluationMethod}</Disclaimer>
        </div>
      </Card>

      <div className="space-y-5 xl:col-span-2">
        <Card>
          <CardHeader title="Recommendations" />
          <ul className="space-y-2.5 card-pad">
            {scorecard.recommendations.map((item) => (
              <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-ink-muted">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                {item}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Transcript" subtitle={`${scorecard.turns.length} turns`} />
          <div className="divide-y divide-line">
            {scorecard.turns.map((turn) => (
              <div key={turn.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink">
                      {turn.isFollowUp && (
                        <CornerDownRight size={12} className="mr-1.5 inline text-amber-400" />
                      )}
                      {turn.question}
                    </p>
                    {turn.answerText && (
                      <p className="mt-2 line-clamp-4 text-[12px] leading-relaxed text-ink-faint">
                        {turn.answerText}
                      </p>
                    )}
                  </div>
                  {turn.turnScore !== undefined && turn.turnScore !== null && (
                    <span
                      className={cn('shrink-0 text-sm font-semibold tabular-nums', scoreTone(turn.turnScore))}
                    >
                      {turn.turnScore}%
                    </span>
                  )}
                </div>
                {turn.feedback && (
                  <p className="mt-2 border-l-2 border-brand-500/40 pl-3 text-[12px] leading-relaxed text-ink-muted">
                    {turn.feedback}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
