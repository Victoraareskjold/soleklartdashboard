import { supabase } from "@/lib/supabase";
import type { EmailAccount } from "@/lib/types";

// Type definition for what the Microsoft token endpoint returns
interface MicrosoftTokenResponse {
  token_type: "Bearer";
  scope: string;
  expires_in: number;
  ext_expires_in: number;
  access_token: string;
  refresh_token: string;
}

/**
 * Retrieves a user's email account for a specific installer group,
 * transparently refreshing the access token if it has expired.
 *
 * @param userId The ID of the user.
 * @param installerGroupId The ID of the installer group.
 * @returns A valid EmailAccount object or null if not found or refresh fails.
 */
export async function getRefreshedEmailAccount(
  userId: string,
  installerGroupId: string
): Promise<EmailAccount | null> {
  // 1. Get the stored account from the database
  const { data: account, error: accountError } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("installer_group_id", installerGroupId)
    .eq("provider", "outlook")
    .single();

  if (accountError) {
    console.error(
      "Error fetching email account from DB:",
      accountError.message
    );
    return null;
  }

  if (!account) {
    console.warn("No Outlook connection found for user in this group.", {
      userId,
      installerGroupId,
    });
    return null;
  }

  // 2. Check if the token is expired or close to expiring (5-minute buffer)
  const fiveMinutesInSeconds = 5 * 60;
  const expiresAt = new Date(account.expires_at).getTime() / 1000;
  const now = Date.now() / 1000;

  // If token is still valid, return it directly
  if (expiresAt > now + fiveMinutesInSeconds) {
    return account as EmailAccount;
  }

  // 3. If token is expired, refresh it using the refresh_token
  console.log("Outlook access token expired. Refreshing...");

  const tokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_OUTLOOK_CLIENT_ID!,
    client_secret: process.env.NEXT_PUBLIC_OUTLOOK_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: account.refresh_token,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const newTokens = (await response.json()) as MicrosoftTokenResponse;

  if (!response.ok) {
    console.error("Failed to refresh Outlook token.", {
      status: response.status,
      error: newTokens,
    });
    // If refresh fails (e.g., refresh token is revoked), we should indicate a problem.
    // Depending on the error, we might want to delete the account from our DB.
    // For now, we'll just return null.
    return null;
  }

  // 4. Update the database with the new tokens and expiry time
  const newExpiresAt = new Date(
    Date.now() + newTokens.expires_in * 1000
  ).toISOString();

  const { data: updatedAccount, error: updateError } = await supabase
    .from("email_accounts")
    .update({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token, // Microsoft often issues a new refresh token
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id)
    .select()
    .single();

  if (updateError) {
    console.error(
      "Error updating refreshed token in database:",
      updateError.message
    );
    // We have a new token, but failed to save it.
    // It's safer to return null to avoid inconsistent state.
    return null;
  }

  console.log("Successfully refreshed and updated Outlook token.");
  return updatedAccount as EmailAccount;
}
