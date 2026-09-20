import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe2 } from 'lucide-react';
import { api, DEMO_MODE } from '@/lib/api';
import { Select } from '@/components/ui';
import type { Country, LearnerPreferences } from '@/types/api';

/**
 * The market the signed-in learner sees figures for.
 *
 * The API resolves this server-side from the saved preference, so screens do
 * not have to pass a country on every request. This hook exists so the header
 * can show which market is active and let the learner change it.
 */
export function useMarket() {
  const countries = useQuery({
    queryKey: ['countries'],
    queryFn: () => api.get<Country[]>('/countries'),
    enabled: !DEMO_MODE,
    staleTime: 60 * 60 * 1000,
  });

  const preferences = useQuery({
    queryKey: ['preferences'],
    queryFn: () => api.get<LearnerPreferences>('/preferences'),
    enabled: !DEMO_MODE,
  });

  return {
    countries: countries.data ?? [],
    preferences: preferences.data,
    countryCode: preferences.data?.countryCode,
    countryName: preferences.data?.countryName,
    isLoading: countries.isLoading || preferences.isLoading,
  };
}

/**
 * Changing the market changes salary figures, course prices and which courses
 * are offered, so every cached panel is dropped rather than left stale.
 */
export function useSetCountry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (countryCode: string) =>
      api.put<LearnerPreferences>('/preferences', { countryCode }),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function CountrySwitcher({ className }: { className?: string }) {
  const { countries, countryCode } = useMarket();
  const setCountry = useSetCountry();

  if (DEMO_MODE || countries.length === 0 || !countryCode) return null;

  return (
    <label className={className} title="Salary figures and course prices are shown for this market">
      <span className="sr-only">Market</span>
      <span className="relative inline-flex items-center">
        <Globe2 size={13} className="pointer-events-none absolute left-2.5 text-ink-faint" />
        <Select
          value={countryCode}
          disabled={setCountry.isPending}
          onChange={(e) => setCountry.mutate(e.target.value)}
          className="h-8 w-[8.5rem] pl-7 text-xs"
        >
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </Select>
      </span>
    </label>
  );
}

/**
 * A career's pay in the active market, or a plain statement that nothing has
 * been published for it. Never shows a converted or invented figure.
 */
export function SalaryFigure({
  salary,
  className,
  showSource = false,
}: {
  salary: import('@/types/api').SalaryBand | undefined;
  className?: string;
  showSource?: boolean;
}) {
  if (!salary) return null;

  if (!salary.hasData) {
    return (
      <p className={className ?? 'text-xs text-ink-faint'}>
        {salary.message ?? `No figures published for ${salary.countryName}.`}
      </p>
    );
  }

  return (
    <span className={className}>
      {salary.range}
      {showSource && salary.source && (
        <span className="ml-2 text-[11px] font-normal text-ink-faint">
          {salary.countryName}
          {salary.asOf ? ` · ${salary.asOf}` : ''} · {salary.source}
        </span>
      )}
    </span>
  );
}
