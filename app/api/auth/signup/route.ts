import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { email, password, full_name } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: full_name || null,
        },
      },
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // Create user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: data.user.id,
        email: data.user.email,
        full_name: full_name || null,
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Non-fatal - user can still use the app
    }

    // Create default preferences
    const { error: prefsError } = await supabase
      .from('user_preferences')
      .insert({
        user_id: data.user.id,
        theme: 'dark',
        currency: 'USD',
      });

    if (prefsError) {
      console.error('Error creating preferences:', prefsError);
      // Non-fatal
    }

    return NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      message: data.session
        ? 'Account created successfully'
        : 'Check your email to confirm your account',
    });
  } catch (error) {
    console.error('Error in signup route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
