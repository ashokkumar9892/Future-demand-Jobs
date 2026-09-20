using FutureTech.Domain.Common;

namespace FutureTech.Domain.Entities;

/// <summary>
/// How much of the platform a visitor may use before being asked to create an
/// account, and before being asked to pay.
/// <para>
/// One row, edited in Admin. It lives in the database rather than in
/// configuration because these are product decisions an operator tunes while
/// watching conversion, not deployment settings: changing them should not
/// require a rebuild, a file edit on the server, or a restart.
/// </para>
/// <para>
/// The thresholds are advisory to the browser, which is where the free time is
/// measured — an anonymous visitor has no server-side identity to attribute
/// minutes to. Someone who clears local storage gets a fresh allowance. That is
/// accepted deliberately: the gate exists to prompt a willing visitor at a
/// sensible moment, not to defend paid content. Anything that must not be read
/// without paying is enforced server-side by enrollment, not by this policy.
/// </para>
/// </summary>
public class AccessPolicy : Entity
{
    /// <summary>
    /// Master switch. False restores the original behaviour, where every page
    /// requires an account and nothing is readable anonymously.
    /// </summary>
    public bool AllowAnonymousBrowsing { get; set; } = true;

    /// <summary>
    /// Minutes of active use before an anonymous visitor is required to create
    /// an account. Default 180 — three hours.
    /// </summary>
    public int FreeMinutesBeforeSignup { get; set; } = 180;

    /// <summary>
    /// How far into the signup allowance the dismissible nudge appears, as a
    /// percentage. 80 shows it at 2h24m of a 3h allowance. 100 disables the
    /// nudge and goes straight to the wall.
    /// </summary>
    public int SignupNudgeAtPercent { get; set; } = 80;

    /// <summary>
    /// Minutes a signed-in learner may study before being asked to pay. Zero
    /// disables the time-based trigger and leaves only the course count.
    /// </summary>
    public int FreeMinutesBeforePayment { get; set; } = 600;

    /// <summary>
    /// How many courses a signed-in learner may open before being asked to pay.
    /// Zero disables the count-based trigger and leaves only the time.
    /// </summary>
    public int FreeCoursesBeforePayment { get; set; } = 2;

    /// <summary>
    /// Whether the payment prompt blocks. False makes it a dismissible notice,
    /// which is the right setting while no payment method is configured for a
    /// market — otherwise learners meet a wall they cannot pass.
    /// </summary>
    public bool PaymentPromptBlocks { get; set; }

    /// <summary>Shown above the signup wall. Operator's own words.</summary>
    public string SignupPromptTitle { get; set; } = "Your free preview has ended";

    public string SignupPromptBody { get; set; } =
        "Create a free account to keep reading, save your progress and pick up where you left off.";

    public string PaymentPromptTitle { get; set; } = "Continue with full access";

    public string PaymentPromptBody { get; set; } =
        "You have used the free allowance. Enrol to keep going and earn a certificate.";
}
