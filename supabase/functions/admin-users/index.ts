import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new HttpError("Unauthorized", 401);
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      throw new HttpError("Unauthorized", 401);
    }

    // 1. Get calling user explicitly using token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      console.error("Auth verification failed:", userError?.message);
      throw new HttpError("Unauthorized", 401);
    }

    console.log("Verified user id:", user?.id);
    console.log("Verified user email:", user?.email);

    // 2. Initialize Service Role Client for Admin Operations
    // We do this AFTER verifying the JWT to safely bypass RLS for profile lookup
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log("SUPABASE_URL present:", !!supabaseUrl);
    console.log("SERVICE_ROLE_KEY present:", !!serviceRoleKey);

    if (supabaseUrl) {
      try {
        const url = new URL(supabaseUrl);
        console.log("Supabase project host:", url.hostname);
      } catch (e) {
        console.log("Supabase project host: invalid url format");
      }
    }

    if (!supabaseUrl || !serviceRoleKey) {
      throw new HttpError("Server configuration error", 500);
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 3. Get caller's profile securely using admin client
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("id, email, role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    console.log("Caller profile lookup:", {
      found: !!callerProfile,
      error: profileError?.message ?? null,
      code: profileError?.code ?? null,
    });

    if (profileError) {
      console.error("Caller profile lookup failed:", {
        message: profileError.message,
        code: profileError.code,
      });
      throw new HttpError("Caller profile lookup failed", 500);
    }

    if (!callerProfile) {
      console.error("Caller profile does not exist for verified user:", user.id);
      throw new HttpError("Caller profile not found", 404);
    }

    if (!callerProfile.is_active) {
      throw new HttpError("Caller account is inactive", 403);
    }

    const callerRole = callerProfile.role;
    if (callerRole !== "superadmin" && callerRole !== "admin") {
      throw new HttpError("Forbidden: Requires admin privileges", 403);
    }

    // 4. Redirect URL for invite/recovery emails.
    // APP_URL must be set as a Supabase Edge Function secret (e.g. https://hammaro-maskin-o-smide-cloudflare.pages.dev).
    // We never derive this from the caller's Origin header because that would produce localhost links
    // when the admin is running the dev server locally.
    const appUrl = (Deno.env.get("APP_URL") ?? "https://hammaro-maskin-o-smide-cloudflare.pages.dev").replace(/\/$/, "");
    const redirectTo = `${appUrl}/admin/update-password`;

    const { action, payload } = await req.json();

    // Helper to check if removing the target would leave 0 superadmins
    const checkLastSuperadmin = async (targetId: string) => {
      const { count, error } = await supabaseAdmin
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "superadmin")
        .eq("is_active", true)
        .neq("id", targetId);

      if (error) throw new HttpError(error.message, 500);
      if (count === 0) {
        throw new HttpError("Säkerhetsspärr: Kan inte radera, inaktivera eller degradera den sista aktiva Superadmin-användaren.", 403);
      }
    };

    // -- GET USERS --
    if (action === "getUsers") {
      // Fetch user profiles and their notification preferences
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .select("*, user_notification_preferences(*)")
        .order("created_at", { ascending: false });

      if (profileError) throw new HttpError(profileError.message, 500);
      let currentProfiles = profiles || [];

      // Fetch auth users to determine pending status and missing profiles
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      if (authError) throw new HttpError(authError.message, 500);

      const authUsers = authData?.users || [];

      // Auto-repair missing profiles
      const missingProfiles = authUsers.filter(u => !currentProfiles.find(p => p.id === u.id));
      for (const missingUser of missingProfiles) {
        const { data: newProfile, error: createError } = await supabaseAdmin.from("user_profiles")
          .upsert({
            id: missingUser.id,
            email: missingUser.email,
            name: missingUser.user_metadata?.name || null,
            role: 'employee',
            job_role: 'Övrigt',
            is_active: true,
            permissions: []
          })
          .select()
          .single();

        if (!createError && newProfile) {
          currentProfiles.push(newProfile);
        } else if (createError) {
          console.error("Auto-repair failed for user:", missingUser.id, createError.message);
        }
      }

      // Re-sort profiles to keep them ordered by created_at descending if new ones were added
      currentProfiles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const enrichedUsers = currentProfiles.map(profile => {
        const authUser = authUsers.find(u => u.id === profile.id);
        const lastSignIn = authUser?.last_sign_in_at;
        // If they have never signed in and don't have a confirmed email, they are pending
        const is_pending = authUser ? (!lastSignIn && !authUser.email_confirmed_at) : false;

        return {
          ...profile,
          last_sign_in_at: lastSignIn || null,
          is_pending
        };
      });

      return new Response(JSON.stringify({ success: true, users: enrichedUsers }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -- INVITE --
    if (action === "invite") {
      const { email, name, role, job_role, permissions, notification_preferences } = payload;

      if (callerRole === "admin" && role !== "intern" && role !== "employee") {
        throw new HttpError("Admins can only invite employees and interns", 403);
      }

      // 1. Check if user already exists in Auth
      const { data: authData, error: authSearchError } = await supabaseAdmin.auth.admin.listUsers();
      if (authSearchError) throw new HttpError(authSearchError.message, 500);

      const existingUser = authData?.users.find(u => u.email === email);

      if (existingUser) {
        // User exists in auth. Let's see if they are pending
        const is_pending = !existingUser.last_sign_in_at && !existingUser.email_confirmed_at;

        if (is_pending) {
          throw new HttpError(JSON.stringify({
            message: "Användaren väntar redan på inbjudan.",
            already_invited: true,
            userId: existingUser.id
          }), 409);
        } else {
          throw new HttpError(JSON.stringify({
            message: "Den här e-postadressen har redan ett aktivt konto.",
            already_invited: false
          }), 409);
        }
      }

      // User does not exist, send invite
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { name, role },
        redirectTo
      });
      if (inviteError) throw new HttpError(inviteError.message, 500);

      const userId = inviteData.user.id;

      // Backend protection: interns can never get write or delete permissions
      let finalPermissions = permissions || [];
      if (role === "intern") {
        finalPermissions = finalPermissions.filter((p: string) => !p.endsWith(":write") && !p.endsWith(":delete"));
      }

      // Upsert profile
      const { error: upsertError } = await supabaseAdmin.from("user_profiles")
        .upsert({
          id: userId,
          email: email,
          name: name,
          role: role,
          job_role: job_role || 'Övrigt',
          permissions: finalPermissions,
          is_active: true
        });

      if (upsertError) throw new HttpError(upsertError.message, 500);

      // Upsert notification preferences if provided
      if (notification_preferences) {
        const { error: prefError } = await supabaseAdmin.from("user_notification_preferences")
          .upsert({
            user_id: userId,
            ...notification_preferences
          });
        if (prefError) console.error("Could not save notification preferences:", prefError.message);
      }

      return new Response(JSON.stringify({ success: true, user: inviteData.user }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -- RESEND INVITE --
    if (action === "resendInvite") {
      const { email, role } = payload;

      if (callerRole === "admin" && role !== "intern" && role !== "employee") {
        throw new HttpError("Admins can only invite employees and interns", 403);
      }

      const { data: authData, error: authSearchError } = await supabaseAdmin.auth.admin.listUsers();
      if (authSearchError) throw new HttpError(authSearchError.message, 500);

      const existingUser = authData?.users.find(u => u.email === email);
      if (!existingUser) {
        throw new HttpError("Användaren hittades inte i systemet.", 404);
      }

      const is_pending = !existingUser.last_sign_in_at && !existingUser.email_confirmed_at;
      if (!is_pending) {
        throw new HttpError(JSON.stringify({
          message: "Den här e-postadressen har redan ett aktivt konto.",
          already_invited: false
        }), 409);
      }

      // Send the resend invite
      const { error: resendError } = await supabaseAdmin.auth.resend({
        type: 'invite',
        email: email,
        options: {
          redirectTo
        }
      });

      if (resendError) throw new HttpError(resendError.message, 500);

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -- UPDATE PROFILE (Name, Job Role, Notifications) --
    if (action === "updateProfile") {
      const { userId, name, job_role, notification_preferences } = payload;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (job_role !== undefined) updateData.job_role = job_role;

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabaseAdmin.from("user_profiles")
          .update(updateData)
          .eq("id", userId);
        if (error) throw new HttpError(error.message, 500);
      }

      // Update notification preferences
      if (notification_preferences) {
        const { error: prefError } = await supabaseAdmin.from("user_notification_preferences")
          .upsert({
            user_id: userId,
            ...notification_preferences
          }, { onConflict: 'user_id' });
        if (prefError) throw new HttpError(prefError.message, 500);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -- UPDATE ROLE --
    if (action === "updateRole") {
      const { userId, role } = payload;

      if (!role) {
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Allow admins to update job roles and preferences for their subordinates, 
      // but only superadmin can change the system 'role'
      if (callerRole !== "superadmin") {
        throw new HttpError("Only superadmins can change system roles", 403);
      }

      if (role && userId === user.id && role !== "superadmin") {
        throw new HttpError("En Superadmin kan inte ändra sin egen behörighetsroll.", 403);
      }

      const { data: targetProfile, error: targetError } = await supabaseAdmin.from("user_profiles").select("role, is_active").eq("id", userId).single();
      if (targetError) throw new HttpError(targetError.message, 404);

      if (role && targetProfile.role === "superadmin" && targetProfile.is_active && role !== "superadmin") {
        await checkLastSuperadmin(userId);
      }

      const updateData: any = { role };

      const { error } = await supabaseAdmin.from("user_profiles")
        .update(updateData)
        .eq("id", userId);
      if (error) throw new HttpError(error.message, 500);

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -- UPDATE PERMISSIONS --
    if (action === "updatePermissions") {
      const { userId, permissions } = payload;

      const { data: targetProfile, error: targetError } = await supabaseAdmin.from("user_profiles").select("role").eq("id", userId).single();
      if (targetError) throw new HttpError(targetError.message, 404);

      if (callerRole === "admin" && targetProfile.role !== "intern" && targetProfile.role !== "employee") {
        throw new HttpError("Admins can only update permissions for employees and interns", 403);
      }

      // Backend protection: interns can never get write or delete permissions
      let finalPermissions = permissions || [];
      if (targetProfile.role === "intern") {
        finalPermissions = finalPermissions.filter((p: string) => !p.endsWith(":write") && !p.endsWith(":delete"));
      }

      const { data, error } = await supabaseAdmin.from("user_profiles")
        .update({ permissions: finalPermissions })
        .eq("id", userId)
        .select()
        .single();
      if (error) throw new HttpError(error.message, 500);
      return new Response(JSON.stringify({ success: true, profile: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -- TOGGLE STATUS --
    if (action === "toggleStatus") {
      const { userId, is_active } = payload;

      if (userId === user.id && !is_active) {
        throw new HttpError("Du kan inte inaktivera ditt eget konto", 403);
      }

      const { data: targetProfile, error: targetError } = await supabaseAdmin.from("user_profiles").select("role, is_active").eq("id", userId).single();
      if (targetError) throw new HttpError(targetError.message, 404);

      if (callerRole === "admin" && targetProfile.role !== "intern" && targetProfile.role !== "employee") {
        throw new HttpError("Admins can only toggle status for employees and interns", 403);
      }

      if (targetProfile.role === "superadmin" && targetProfile.is_active && is_active === false) {
        await checkLastSuperadmin(userId);
      }

      const { data, error } = await supabaseAdmin.from("user_profiles")
        .update({ is_active })
        .eq("id", userId)
        .select()
        .single();
      if (error) throw new HttpError(error.message, 500);
      return new Response(JSON.stringify({ success: true, profile: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -- DELETE USER --
    if (action === "deleteUser") {
      const { userId } = payload;

      if (callerRole !== "superadmin") {
        throw new HttpError("Endast Superadmin kan radera användare", 403);
      }

      const { data: targetProfile, error: targetError } = await supabaseAdmin.from("user_profiles").select("role").eq("id", userId).single();
      if (targetError) throw new HttpError(targetError.message, 404);

      if (targetProfile.role === "superadmin") {
        throw new HttpError("En Superadmin kan inte raderas via detta gränssnitt.", 403);
      }

      // Delete the user from auth.users (user_profiles will cascade if ON DELETE CASCADE is set, otherwise we delete it manually)
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteAuthError) throw new HttpError(deleteAuthError.message, 500);

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new HttpError(`Unknown action: ${action}`, 400);

  } catch (err: any) {
    console.error("Error in admin-users function:", err.message);
    const status = err instanceof HttpError ? err.status : 500;

    let errorMsg = err.message;
    // Try to parse JSON errors (from 409)
    try {
      const parsed = JSON.parse(err.message);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: status,
      });
    } catch (e) {
      // not json, return normal error
      return new Response(JSON.stringify({ error: err.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: status,
      });
    }
  }
});
