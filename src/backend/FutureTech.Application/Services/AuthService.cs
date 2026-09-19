using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default);
    Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct = default);
    Task<UserProfileDto> MeAsync(CancellationToken ct = default);
    Task<UserProfileDto> UpdateThemeAsync(string theme, CancellationToken ct = default);
}

public class AuthService(
    IAppDbContext db,
    IPasswordHasher hasher,
    IJwtTokenService tokens,
    ICurrentUser currentUser,
    IDateTimeProvider clock) : IAuthService
{
    public async Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (email.Length == 0 || !email.Contains('@')) throw new AppException("A valid email is required.");
        if (request.Password.Length < 8) throw new AppException("Password must be at least 8 characters.");
        if (await db.Users.AnyAsync(u => u.Email == email, ct))
            throw AppException.Conflict("An account with that email already exists.");

        var user = new AppUser
        {
            Email = email,
            PasswordHash = hasher.Hash(request.Password),
            DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? email.Split('@')[0] : request.DisplayName.Trim(),
            Role = UserRole.Learner,
            YearsExperience = request.YearsExperience
        };
        db.Users.Add(user);

        // A new learner starts with the platform's persona baseline so the skill
        // matrix is immediately meaningful; they can edit every Current value.
        var skills = await db.Skills.AsNoTracking().ToListAsync(ct);
        foreach (var skill in skills)
            db.UserSkills.Add(new UserSkill { UserId = user.Id, SkillId = skill.Id, CurrentLevel = skill.BaselineLevel });

        var primary = await db.CareerPaths.AsNoTracking()
            .OrderBy(c => c.Rank)
            .FirstOrDefaultAsync(c => c.IsPrimaryRecommended, ct);

        db.StudyProfiles.Add(new StudyProfile
        {
            UserId = user.Id,
            TargetCareerPathId = primary?.Id,
            WeekdayHours = 1.5,
            SaturdayHours = 3,
            SundayHours = 3
        });

        await db.SaveChangesAsync(ct);
        return await IssueAsync(user, ct);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct)
                   ?? throw AppException.Unauthorized("Email or password is incorrect.");

        if (!hasher.Verify(request.Password, user.PasswordHash))
            throw AppException.Unauthorized("Email or password is incorrect.");

        user.LastLoginAt = clock.Now;
        await db.SaveChangesAsync(ct);
        return await IssueAsync(user, ct);
    }

    public async Task<UserProfileDto> MeAsync(CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
                   ?? throw AppException.NotFound("User");
        return await ToProfileAsync(user, ct);
    }

    public async Task<UserProfileDto> UpdateThemeAsync(string theme, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
                   ?? throw AppException.NotFound("User");
        user.ThemePreference = theme == "light" ? "light" : "dark";
        user.UpdatedAt = clock.Now;
        await db.SaveChangesAsync(ct);
        return await ToProfileAsync(user, ct);
    }

    private async Task<AuthResponse> IssueAsync(AppUser user, CancellationToken ct)
    {
        var (token, expires) = tokens.Issue(user.Id, user.Email, user.Role);
        return new AuthResponse(token, expires, await ToProfileAsync(user, ct));
    }

    private async Task<UserProfileDto> ToProfileAsync(AppUser user, CancellationToken ct)
    {
        var profile = await db.StudyProfiles.AsNoTracking()
            .Include(p => p.TargetCareerPath)
            .FirstOrDefaultAsync(p => p.UserId == user.Id, ct);

        return new UserProfileDto(
            user.Id, user.Email, user.DisplayName, user.Role.ToString(), user.ThemePreference,
            user.YearsExperience, profile?.OnboardingCompletedAt is not null,
            profile?.TargetCareerPathId, profile?.TargetCareerPath?.Title);
    }
}
