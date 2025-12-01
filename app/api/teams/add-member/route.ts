import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { AddTeamMemberPayload } from "@/lib/api";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const {
      name,
      email,
      role,
      team_id,
      installer_group_id,
    }: AddTeamMemberPayload = await req.json();

    if (!name || !email || !role || !team_id || !installer_group_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if user exists
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (userError && userError.code !== "PGRST116") {
      // PGRST116: 'No rows found'
      console.error("Error fetching user:", userError);
      return NextResponse.json(
        { error: "Error fetching user" },
        { status: 500 }
      );
    }

    let userId: string;

    if (!user) {
      // User does not exist, invite them
      const { data: newUser, error: inviteError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(email);

      if (inviteError) {
        console.error("Error inviting user:", inviteError);
        return NextResponse.json(
          { error: "Error inviting user" },
          { status: 500 }
        );
      }

      if (!newUser || !newUser.user) {
        console.error("Invite did not return a user.");
        return NextResponse.json(
          { error: "Could not invite user" },
          { status: 500 }
        );
      }

      userId = newUser.user.id;

      // Now, create the user profile in the public.users table
      const { error: insertError } = await supabaseAdmin
        .from("users")
        .insert({ id: userId, name, email });

      if (insertError) {
        console.error("Failed to create user profile:", insertError);
        // If creating the user profile fails, we should probably delete the auth user
        // to avoid having an orphaned auth user.
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json(
          { error: "Failed to create user profile" },
          { status: 500 }
        );
      }
    } else {
      userId = user.id;
    }

    // Check if user is already a member of the team
    const { data: existingMember, error: memberError } = await supabaseAdmin
      .from("team_members")
      .select("id")
      .eq("user_id", userId)
      .eq("team_id", team_id)
      .single();

    if (memberError && memberError.code !== "PGRST116") {
      console.error("Error checking for existing team member:", memberError);
      return NextResponse.json(
        { error: "Error checking team membership" },
        { status: 500 }
      );
    }

    if (existingMember) {
      // If the user is already in the team, but not in the installer group,
      // we can update their installer_group_id.
      // For now, we'll just return a conflict error.
      return NextResponse.json(
        { error: "User is already a member of this team" },
        { status: 409 }
      );
    }

    // Add user to team_members
    const { error: insertError } = await supabaseAdmin
      .from("team_members")
      .insert({
        team_id,
        user_id: userId,
        role,
        installer_group_id,
      });

    if (insertError) {
      console.error("Error adding user to team:", insertError);
      return NextResponse.json(
        { error: "Failed to add user to team" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("An unexpected error occurred:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
