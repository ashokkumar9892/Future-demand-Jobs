import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, SlidersHorizontal } from 'lucide-react';
import { api, DEMO_MODE } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorPanel,
  Field,
  Input,
  LoadingPanel,
  Select,
} from '@/components/ui';
import type { Country, LearnerPreferences } from '@/types/api';

/**
 * Preferences that follow the account rather than the browser.
 *
 * Study capacity and target role live on the study profile above this card;
 * these are the settings that change how the platform behaves for this person
 * everywhere — market, certificate name, and lesson playback.
 */
export function PreferencesCard() {
  const queryClient = useQueryClient();

  const preferences = useQuery({
    queryKey: ['preferences'],
    queryFn: () => api.get<LearnerPreferences>('/preferences'),
    enabled: !DEMO_MODE,
  });

  const countries = useQuery({
    queryKey: ['countries'],
    queryFn: () => api.get<Country[]>('/countries'),
    enabled: !DEMO_MODE,
  });

  const [country, setCountry] = useState('');
  const [certificateName, setCertificateName] = useState('');
  const [autoplay, setAutoplay] = useState(false);
  const [takeaways, setTakeaways] = useState(true);
  const [sessionMinutes, setSessionMinutes] = useState(45);

  // Seed the form once the saved values arrive.
  useEffect(() => {
    const p = preferences.data;
    if (!p) return;
    setCountry(p.countryCode);
    setCertificateName(p.certificateName ?? '');
    setAutoplay(p.autoplayVideos);
    setTakeaways(p.showKeyTakeaways);
    setSessionMinutes(p.preferredSessionMinutes);
  }, [preferences.data]);

  const save = useMutation({
    mutationFn: () =>
      api.put<LearnerPreferences>('/preferences', {
        countryCode: country,
        certificateName,
        autoplayVideos: autoplay,
        showKeyTakeaways: takeaways,
        preferredSessionMinutes: sessionMinutes,
      }),
    // Market changes salary figures and prices everywhere, so drop all caches.
    onSuccess: () => queryClient.invalidateQueries(),
  });

  if (DEMO_MODE) return null;
  if (preferences.isLoading) return <LoadingPanel label="Loading preferences" />;
  if (preferences.error) return <ErrorPanel message={(preferences.error as Error).message} />;

  return (
    <Card className="mt-5">
      <CardHeader
        title="Preferences"
        subtitle="Saved to your account, so they follow you to any browser"
        icon={<SlidersHorizontal size={15} />}
        action={
          save.isSuccess && (
            <Badge tone="success">
              <Check size={10} />
              Saved
            </Badge>
          )
        }
      />

      <div className="card-pad space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Field
            label="Market"
            hint="Salary figures, course prices and which courses are offered follow this."
          >
            <Select value={country} onChange={(e) => setCountry(e.target.value)}>
              {(countries.data ?? []).map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name} ({option.currencyCode})
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Name on certificates"
            hint={`Leave blank to use your account name${
              preferences.data ? ` — currently "${preferences.data.effectiveCertificateName}"` : ''
            }.`}
          >
            <Input
              value={certificateName}
              onChange={(e) => setCertificateName(e.target.value)}
              placeholder="Your full name as it should be printed"
              maxLength={128}
            />
          </Field>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Default study session" hint="Pre-fills the minutes you log against a lesson.">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={5}
                max={480}
                step={5}
                value={sessionMinutes}
                onChange={(e) => setSessionMinutes(Number(e.target.value))}
                className="w-28"
              />
              <span className="text-xs text-ink-faint">minutes</span>
            </div>
          </Field>

          <div className="space-y-2 pt-6">
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={autoplay}
                onChange={(e) => setAutoplay(e.target.checked)}
                className="accent-brand-500"
              />
              Start a lesson&rsquo;s video automatically
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={takeaways}
                onChange={(e) => setTakeaways(e.target.checked)}
                className="accent-brand-500"
              />
              Open lessons with key takeaways expanded
            </label>
          </div>
        </div>

        {save.isError && <ErrorPanel message={(save.error as Error).message} />}

        <div className="flex justify-end">
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
            Save preferences
          </Button>
        </div>
      </div>
    </Card>
  );
}
