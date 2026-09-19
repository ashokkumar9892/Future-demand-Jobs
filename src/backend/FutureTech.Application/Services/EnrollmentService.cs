using System.Security.Cryptography;
using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface IEnrollmentService
{
    Task<IReadOnlyList<EnrollmentDto>> MineAsync(CancellationToken ct = default);
    Task<EnrollmentDto> EnrollAsync(Guid courseId, EnrollRequest request, CancellationToken ct = default);
    Task<EnrollmentDto> UpdateAsync(Guid courseId, EnrollRequest request, CancellationToken ct = default);
    Task<EnrollmentDto> WithdrawAsync(Guid courseId, CancellationToken ct = default);

    /// <summary>
    /// Creates the enrolment implied by studying a course, if there is none.
    /// Called from the progress path so opening a lesson never leaves a learner
    /// with progress but no enrolment — which would block their certificate.
    /// </summary>
    Task EnsureEnrolledAsync(Guid courseId, CancellationToken ct = default);
}

public interface ICertificateService
{
    /// <summary>Named apart from the enrolment list so one class can serve both interfaces.</summary>
    Task<IReadOnlyList<CertificateDto>> ListMineAsync(CancellationToken ct = default);
    Task<CertificateDto> IssueAsync(Guid courseId, CancellationToken ct = default);
    Task<CertificateVerificationDto> VerifyAsync(string certificateNumber, CancellationToken ct = default);
}

public interface IPreferencesService
{
    Task<LearnerPreferencesDto> GetAsync(CancellationToken ct = default);
    Task<LearnerPreferencesDto> UpdateAsync(LearnerPreferencesUpdateRequest request, CancellationToken ct = default);
}

/// <summary>
/// Enrolment, per-learner preferences and course certificates. They share one
/// service because all three read the same lesson-completion roll-up, and a
/// certificate is issued off the back of an enrolment.
/// </summary>
public class EnrollmentService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IDateTimeProvider clock,
    ILocationService locations) : IEnrollmentService, ICertificateService, IPreferencesService
{
    /// <summary>A course's lesson ids plus this learner's completions and minutes against it.</summary>
    private sealed record CourseProgress(int TotalLessons, int CompletedLessons, int MinutesStudied)
    {
        public int Percent => TotalLessons == 0 ? 0 : (int)Math.Round(CompletedLessons * 100.0 / TotalLessons);
    }

    // ----- enrolment ------------------------------------------------------

    public async Task<IReadOnlyList<EnrollmentDto>> MineAsync(CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();

        var enrollments = await db.CourseEnrollments.AsNoTracking()
            .Include(e => e.Course).ThenInclude(c => c!.CareerPath)
            .Where(e => e.UserId == userId)
            .ToListAsync(ct);

        if (enrollments.Count == 0) return [];

        var progress = await ProgressForAsync(userId, enrollments.Select(e => e.CourseId).ToList(), ct);
        var certificates = await db.CourseCertificates.AsNoTracking()
            .Where(c => c.UserId == userId)
            .Select(c => new { c.Id, c.CourseId, c.CertificateNumber })
            .ToListAsync(ct);

        return enrollments
            .OrderByDescending(e => e.IsPriority)
            .ThenByDescending(e => e.LastAccessedAt ?? e.EnrolledAt)
            .Select(e =>
            {
                var certificate = certificates.FirstOrDefault(c => c.CourseId == e.CourseId);
                return Map(e, progress.GetValueOrDefault(e.CourseId, new CourseProgress(0, 0, 0)),
                    certificate?.Id, certificate?.CertificateNumber);
            })
            .ToList();
    }

    public async Task<EnrollmentDto> EnrollAsync(Guid courseId, EnrollRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var course = await LoadCourseAsync(courseId, ct);

        var enrollment = await db.CourseEnrollments
            .FirstOrDefaultAsync(e => e.UserId == userId && e.CourseId == courseId, ct);

        if (enrollment is null)
        {
            enrollment = new CourseEnrollment { UserId = userId, CourseId = courseId, EnrolledAt = clock.Now };
            db.CourseEnrollments.Add(enrollment);
        }
        else if (enrollment.Status == EnrollmentStatus.Withdrawn)
        {
            // Re-enrolling resumes the same row so progress and history survive.
            enrollment.Status = EnrollmentStatus.Active;
            enrollment.EnrolledAt = clock.Now;
            enrollment.UpdatedAt = clock.Now;
        }
        else
        {
            throw AppException.Conflict("You are already enrolled in this course.");
        }

        ApplyPreferences(enrollment, request);
        await db.SaveChangesAsync(ct);
        return await BuildAsync(enrollment, course, ct);
    }

    public async Task<EnrollmentDto> UpdateAsync(Guid courseId, EnrollRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var course = await LoadCourseAsync(courseId, ct);

        var enrollment = await db.CourseEnrollments
                             .FirstOrDefaultAsync(e => e.UserId == userId && e.CourseId == courseId, ct)
                         ?? throw AppException.NotFound("Enrolment");

        ApplyPreferences(enrollment, request);
        enrollment.UpdatedAt = clock.Now;
        await db.SaveChangesAsync(ct);
        return await BuildAsync(enrollment, course, ct);
    }

    public async Task<EnrollmentDto> WithdrawAsync(Guid courseId, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var course = await LoadCourseAsync(courseId, ct);

        var enrollment = await db.CourseEnrollments
                             .FirstOrDefaultAsync(e => e.UserId == userId && e.CourseId == courseId, ct)
                         ?? throw AppException.NotFound("Enrolment");

        // Withdrawing hides the course from the focus list. Lesson progress is
        // left alone: it is a record of work done, not a consequence of enrolling.
        enrollment.Status = EnrollmentStatus.Withdrawn;
        enrollment.IsPriority = false;
        enrollment.UpdatedAt = clock.Now;
        await db.SaveChangesAsync(ct);
        return await BuildAsync(enrollment, course, ct);
    }

    public async Task EnsureEnrolledAsync(Guid courseId, CancellationToken ct = default)
    {
        var userId = currentUser.UserId;
        if (userId is null) return;

        var existing = await db.CourseEnrollments
            .FirstOrDefaultAsync(e => e.UserId == userId && e.CourseId == courseId, ct);

        if (existing is null)
        {
            db.CourseEnrollments.Add(new CourseEnrollment
            {
                UserId = userId.Value,
                CourseId = courseId,
                EnrolledAt = clock.Now,
                LastAccessedAt = clock.Now
            });
        }
        else
        {
            existing.LastAccessedAt = clock.Now;
            // Studying a withdrawn course is a decision to resume it.
            if (existing.Status == EnrollmentStatus.Withdrawn) existing.Status = EnrollmentStatus.Active;
        }

        await db.SaveChangesAsync(ct);
    }

    // ----- certificates ---------------------------------------------------

    public async Task<IReadOnlyList<CertificateDto>> ListMineAsync(CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var rows = await db.CourseCertificates.AsNoTracking()
            .Include(c => c.Course)
            .Where(c => c.UserId == userId)
            .OrderByDescending(c => c.IssuedAt)
            .ToListAsync(ct);

        return rows.Select(ToDto).ToList();
    }

    public async Task<CertificateDto> IssueAsync(Guid courseId, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var course = await LoadCourseAsync(courseId, ct);

        var existing = await db.CourseCertificates.AsNoTracking()
            .Include(c => c.Course)
            .FirstOrDefaultAsync(c => c.UserId == userId && c.CourseId == courseId, ct);

        // Issuing twice returns the certificate already held rather than failing:
        // the learner is asking for their certificate, and they have one.
        if (existing is not null) return ToDto(existing);

        // Enrolment is the gate, but studying the course is enrolment enough.
        await EnsureEnrolledAsync(courseId, ct);

        var progress = (await ProgressForAsync(userId, [courseId], ct))
            .GetValueOrDefault(courseId, new CourseProgress(0, 0, 0));

        if (progress.TotalLessons == 0)
            throw new AppException("This course has no lessons yet, so it cannot be certified.");

        if (progress.Percent < Common.Certificates.MinimumPercent)
        {
            var needed = (int)Math.Ceiling(progress.TotalLessons * Common.Certificates.MinimumPercent / 100.0)
                         - progress.CompletedLessons;
            throw new AppException(
                $"A certificate needs {Common.Certificates.MinimumPercent}% of the course complete. " +
                $"You are at {progress.Percent}% — {Math.Max(1, needed)} more lesson(s) to go.");
        }

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
                   ?? throw AppException.NotFound("User");
        var preferences = await db.LearnerPreferences.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId, ct);

        var certificate = new CourseCertificate
        {
            UserId = userId,
            CourseId = courseId,
            CertificateNumber = await NextNumberAsync(ct),
            LearnerName = NameFor(preferences?.CertificateName, user.DisplayName),
            CourseTitle = course.Title,
            CareerTitle = course.CareerPath?.Title ?? string.Empty,
            PercentComplete = progress.Percent,
            LessonsCompleted = progress.CompletedLessons,
            TotalLessons = progress.TotalLessons,
            MinutesStudied = progress.MinutesStudied,
            IssuedAt = clock.Now
        };
        db.CourseCertificates.Add(certificate);

        // Reaching the threshold closes the enrolment out.
        var enrollment = await db.CourseEnrollments
            .FirstOrDefaultAsync(e => e.UserId == userId && e.CourseId == courseId, ct);
        if (enrollment is not null)
        {
            enrollment.Status = EnrollmentStatus.Completed;
            enrollment.CompletedAt ??= clock.Now;
            enrollment.UpdatedAt = clock.Now;
        }

        await db.SaveChangesAsync(ct);
        certificate.Course = course;
        return ToDto(certificate);
    }

    public async Task<CertificateVerificationDto> VerifyAsync(string certificateNumber, CancellationToken ct = default)
    {
        var number = (certificateNumber ?? string.Empty).Trim().ToUpperInvariant();

        var certificate = number.Length == 0
            ? null
            : await db.CourseCertificates.AsNoTracking()
                .FirstOrDefaultAsync(c => c.CertificateNumber == number, ct);

        if (certificate is null)
            return new CertificateVerificationDto(false, null, null, null, 0, null,
                "No certificate was issued with that number.");

        return new CertificateVerificationDto(
            true, certificate.CertificateNumber, certificate.LearnerName, certificate.CourseTitle,
            certificate.PercentComplete, certificate.IssuedAt, Common.Certificates.Statement);
    }

    // ----- preferences ----------------------------------------------------

    public async Task<LearnerPreferencesDto> GetAsync(CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
                   ?? throw AppException.NotFound("User");

        var preferences = await db.LearnerPreferences.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId, ct);
        return ToDto(preferences, user, await locations.ResolveAsync(preferences?.CountryCode, ct));
    }

    public async Task<LearnerPreferencesDto> UpdateAsync(
        LearnerPreferencesUpdateRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
                   ?? throw AppException.NotFound("User");

        var preferences = await db.LearnerPreferences.FirstOrDefaultAsync(p => p.UserId == userId, ct);
        if (preferences is null)
        {
            preferences = new LearnerPreferences { UserId = userId, Theme = user.ThemePreference };
            db.LearnerPreferences.Add(preferences);
        }

        if (request.Theme is not null)
        {
            preferences.Theme = request.Theme == "light" ? "light" : "dark";
            // The token carries no preferences, so sign-in reads the theme off the
            // user row. Keep both in step rather than having two answers.
            user.ThemePreference = preferences.Theme;
            user.UpdatedAt = clock.Now;
        }

        if (request.CertificateName is not null)
        {
            var name = request.CertificateName.Trim();
            if (name.Length > 128) throw new AppException("Keep the certificate name under 128 characters.");
            preferences.CertificateName = name.Length == 0 ? null : name;
        }

        if (request.AutoplayVideos is { } autoplay) preferences.AutoplayVideos = autoplay;
        if (request.ShowKeyTakeaways is { } takeaways) preferences.ShowKeyTakeaways = takeaways;

        if (request.PreferredSessionMinutes is { } minutes)
        {
            if (minutes is < 5 or > 480) throw new AppException("A session length must be between 5 and 480 minutes.");
            preferences.PreferredSessionMinutes = minutes;
        }

        if (request.CountryCode is not null)
        {
            // Resolve before storing so an unknown code cannot be saved and then
            // silently fall back on every later read.
            var chosen = await locations.ResolveAsync(request.CountryCode, ct);
            if (!chosen.Code.Equals(request.CountryCode.Trim(), StringComparison.OrdinalIgnoreCase))
                throw new AppException($"'{request.CountryCode}' is not a country this platform publishes figures for.");
            preferences.CountryCode = chosen.Code;
        }

        preferences.UpdatedAt = clock.Now;
        await db.SaveChangesAsync(ct);
        return ToDto(preferences, user, await locations.ResolveAsync(preferences.CountryCode, ct));
    }

    // ----- shared ---------------------------------------------------------

    private async Task<Course> LoadCourseAsync(Guid courseId, CancellationToken ct) =>
        await db.Courses.AsNoTracking().Include(c => c.CareerPath).FirstOrDefaultAsync(c => c.Id == courseId, ct)
        ?? throw AppException.NotFound("Course");

    private static void ApplyPreferences(CourseEnrollment enrollment, EnrollRequest request)
    {
        var goal = request.Goal?.Trim();
        enrollment.Goal = string.IsNullOrEmpty(goal) ? null : goal.Length > 500 ? goal[..500] : goal;
        enrollment.WeeklyHoursTarget = Math.Clamp(request.WeeklyHoursTarget, 0, 60);
        enrollment.IsPriority = request.IsPriority;
    }

    private async Task<EnrollmentDto> BuildAsync(CourseEnrollment enrollment, Course course, CancellationToken ct)
    {
        var progress = (await ProgressForAsync(enrollment.UserId, [enrollment.CourseId], ct))
            .GetValueOrDefault(enrollment.CourseId, new CourseProgress(0, 0, 0));

        var certificate = await db.CourseCertificates.AsNoTracking()
            .Where(c => c.UserId == enrollment.UserId && c.CourseId == enrollment.CourseId)
            .Select(c => new { c.Id, c.CertificateNumber })
            .FirstOrDefaultAsync(ct);

        enrollment.Course = course;
        return Map(enrollment, progress, certificate?.Id, certificate?.CertificateNumber);
    }

    /// <summary>Lesson totals, completions and minutes for the given courses, in one round trip each.</summary>
    private async Task<Dictionary<Guid, CourseProgress>> ProgressForAsync(
        Guid userId, IReadOnlyList<Guid> courseIds, CancellationToken ct)
    {
        var lessons = await db.Lessons.AsNoTracking()
            .Join(db.Modules.AsNoTracking(), l => l.ModuleId, m => m.Id, (l, m) => new { l.Id, m.CourseId })
            .Where(x => courseIds.Contains(x.CourseId))
            .ToListAsync(ct);

        if (lessons.Count == 0) return [];

        var lessonIds = lessons.Select(l => l.Id).ToList();
        var progress = await db.LessonProgress.AsNoTracking()
            .Where(p => p.UserId == userId && lessonIds.Contains(p.LessonId))
            .Select(p => new { p.LessonId, p.Status, p.MinutesSpent })
            .ToListAsync(ct);

        var byLesson = progress.ToDictionary(p => p.LessonId);

        return lessons
            .GroupBy(l => l.CourseId)
            .ToDictionary(g => g.Key, g => new CourseProgress(
                g.Count(),
                g.Count(l => byLesson.TryGetValue(l.Id, out var p) && p.Status == ProgressStatus.Completed),
                g.Sum(l => byLesson.TryGetValue(l.Id, out var p) ? p.MinutesSpent : 0)));
    }

    /// <summary>
    /// "FTA-2026-7K4QX2" — a year for readability plus random characters. Random
    /// rather than sequential so one number does not reveal how many exist, and
    /// the unique index catches the rare collision.
    /// </summary>
    private async Task<string> NextNumberAsync(CancellationToken ct)
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        for (var attempt = 0; attempt < 8; attempt++)
        {
            var suffix = string.Concat(Enumerable.Range(0, 6)
                .Select(_ => alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)]));
            var candidate = $"FTA-{clock.Now.Year}-{suffix}";

            if (!await db.CourseCertificates.AsNoTracking().AnyAsync(c => c.CertificateNumber == candidate, ct))
                return candidate;
        }

        throw new AppException("Could not allocate a certificate number. Please try again.");
    }

    private static string NameFor(string? preferred, string displayName) =>
        string.IsNullOrWhiteSpace(preferred) ? displayName : preferred.Trim();

    private static LearnerPreferencesDto ToDto(LearnerPreferences? preferences, AppUser user, Country market)
    {
        var p = preferences ?? new LearnerPreferences { UserId = user.Id, Theme = user.ThemePreference };
        return new LearnerPreferencesDto(
            p.Theme, p.CertificateName, p.AutoplayVideos, p.ShowKeyTakeaways, p.PreferredSessionMinutes,
            NameFor(p.CertificateName, user.DisplayName),
            market.Code, market.Name, market.CurrencyCode);
    }

    private static CertificateDto ToDto(CourseCertificate c) => new(
        c.Id, c.CourseId, c.CertificateNumber, c.LearnerName, c.CourseTitle, c.CareerTitle,
        c.Course?.Slug ?? string.Empty, c.PercentComplete, c.LessonsCompleted, c.TotalLessons,
        c.MinutesStudied, c.IssuedAt);

    private static EnrollmentDto Map(
        CourseEnrollment e, CourseProgress progress, Guid? certificateId, string? certificateNumber) => new(
        e.Id, e.CourseId,
        e.Course?.Title ?? string.Empty,
        e.Course?.Slug ?? string.Empty,
        e.Course?.PhaseNumber ?? 0,
        e.Course?.CareerPath?.Title ?? string.Empty,
        e.Status.ToString(), e.EnrolledAt, e.LastAccessedAt, e.CompletedAt,
        e.Goal, e.WeeklyHoursTarget, e.IsPriority,
        progress.TotalLessons, progress.CompletedLessons, progress.Percent, progress.MinutesStudied,
        e.Course?.EstimatedHours ?? 0,
        progress.Percent >= Common.Certificates.MinimumPercent,
        Common.Certificates.MinimumPercent,
        certificateId, certificateNumber);
}
