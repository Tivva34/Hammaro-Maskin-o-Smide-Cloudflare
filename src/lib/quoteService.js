import { supabase } from './supabase';

/**
 * Creates a new quote request/lead.
 * This can be done by a public (unauthenticated) user.
 */
export async function createQuoteRequest(fields) {
  const { data, error } = await supabase
    .from('quote_requests')
    .insert([{
      name: fields.name.trim(),
      company: fields.company?.trim() || null,
      email: fields.email.trim(),
      phone: fields.phone?.trim() || null,
      message: fields.message?.trim() || null,
      request_type: fields.request_type,
      machine_id: fields.machine_id || null,
      inventory_item_id: fields.inventory_item_id || null,
      status: 'new'
    }]);

  console.log('QUOTE SERVICE RESULT:', { data, error });
  return { data, error };
}

/**
 * Gets all quote requests for the admin dashboard.
 * Requires authenticated user.
 */
export async function getQuoteRequests() {
  const { data, error } = await supabase
    .from('quote_requests')
    .select(`
      *,
      machine:machines(id, name, category),
      inventory_item:inventory_items(id, name),
      messages:quote_messages(*)
    `)
    .order('created_at', { ascending: false });

  return { data, error };
}

/**
 * Updates the status of a quote request.
 * Requires authenticated user.
 */
export async function updateQuoteStatus(id, status) {
  const { data, error } = await supabase
    .from('quote_requests')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

/**
 * Deletes a quote request.
 * Requires authenticated user.
 */
export async function deleteQuoteRequest(id) {
  const { data, error } = await supabase
    .from('quote_requests')
    .delete()
    .eq('id', id);

  return { data, error };
}

/**
 * Marks unread customer messages as read for a given quote request.
 * Requires authenticated user.
 */
export async function markCustomerMessagesAsRead(quoteRequestId) {
  const { data, error } = await supabase
    .from('quote_messages')
    .update({ is_read: true })
    .eq('quote_request_id', quoteRequestId)
    .eq('sender_type', 'customer')
    .eq('is_read', false)
    .select();

  if (error) {
    console.error('Failed to mark messages as read in DB:', error);
  } else {
    console.log('Successfully marked as read in DB:', data);
  }

  return { data, error };
}

/**
 * Sends a reply to a quote request via Edge Function.
 * Requires authenticated user.
 * NOTE: Enhanced error logging enabled for debugging (temporary).
 */
export async function sendQuoteReply(quoteRequestId, message, attachments = []) {
  // --- DIAGNOSTIC START ---
  const { data: { session } } = await supabase.auth.getSession();
  console.log("[send-quote-reply] frontend session diagnostic:", {
    hasSession: !!session,
    hasAccessToken: !!session?.access_token,
    userId: session?.user?.id ?? null,
    expiresAt: session?.expires_at ?? null
  });
  // --- DIAGNOSTIC END ---

  const { data, error } = await supabase.functions.invoke('send-quote-reply', {
    body: { quote_request_id: quoteRequestId, message, attachments },
    headers: {
      Authorization: `Bearer ${session?.access_token}`
    }
  });

  if (error) {
    // Log the raw error object
    console.error('[send-quote-reply] invoke error:', error);
    console.error('[send-quote-reply] error.name:', error?.name);
    console.error('[send-quote-reply] error.message:', error?.message);
    console.error('[send-quote-reply] error.status:', error?.status);

    // Try to extract the actual response body from FunctionsHttpError
    if (error?.context) {
      try {
        // Clone to avoid consuming the stream
        const cloned = error.context.clone?.() ?? error.context;
        const body = await cloned.json().catch(() => null);
        const text = body === null ? await error.context.text?.() : null;
        console.error('[send-quote-reply] response body (json):', body);
        console.error('[send-quote-reply] response body (text):', text);
        console.error('[send-quote-reply] response status:', error.context.status);

        // Return a detailed error message for the UI
        const detail = body?.error ?? text ?? error.message;
        return { error: new Error(`[HTTP ${error.context.status}] ${detail}`) };
      } catch (parseErr) {
        console.error('[send-quote-reply] could not parse error context:', parseErr);
      }
    }

    return { error };
  }

  if (data?.error) {
    console.error('[send-quote-reply] data.error:', data.error);
    return { error: new Error(data.error) };
  }

  return { data };
}


// ─────────────────────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────────────────────

export const QUOTE_STATUS_OPTIONS = [
  { value: 'new',       label: 'Ny',         color: '#3b82f6' }, // Blue
  { value: 'contacted', label: 'Kontaktad',  color: '#f59e0b' }, // Amber
  { value: 'completed', label: 'Klar',       color: '#22c55e' }, // Green
  { value: 'archived',  label: 'Arkiverad',  color: '#6b7277' }, // Gray
];

export function getQuoteStatusLabel(status) {
  return QUOTE_STATUS_OPTIONS.find(s => s.value === status)?.label ?? status;
}

export function getQuoteStatusColor(status) {
  return QUOTE_STATUS_OPTIONS.find(s => s.value === status)?.color ?? '#6b7277';
}
