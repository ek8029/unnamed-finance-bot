import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { checkPasswordStrength, logAuthEvent } from '@/lib/auth-security';
import { rateLimit } from '@/lib/rate-limit';

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed } = rateLimit(`password-change:${user.id}`, 5, 900);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 });
    }

    // Validate password strength (require score >= 3)
    const strength = checkPasswordStrength(newPassword);
    if (strength.score < 3) {
      const unmet = strength.requirements.filter(r => !r.met).map(r => r.label);
      return NextResponse.json(
        {
          error: `Password is too weak. Missing: ${unmet.join(', ')}`,
          strength,
        },
        { status: 400 },
      );
    }

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });

    if (signInError) {
      await logAuthEvent({
        userId: user.id,
        email: user.email,
        eventType: 'password_change',
        metadata: { success: false, reason: 'incorrect_current_password' },
      });
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    // Update the password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error('Password update error:', updateError);
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }

    // Log successful password change
    await logAuthEvent({
      userId: user.id,
      email: user.email,
      eventType: 'password_change',
      metadata: { success: true },
    });

    return NextResponse.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error in password change:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
