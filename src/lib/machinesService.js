import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────
// Slug helpers
// ─────────────────────────────────────────────────────────────

/**
 * Convert a machine name to a URL-friendly slug.
 * Handles Swedish characters: å→a, ä→a, ö→o
 */
export function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é|è|ê/g, 'e')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Ensure a slug is unique in the database.
 * If 'massey-ferguson-390t' exists, returns 'massey-ferguson-390t-2', etc.
 * Pass excludeId to ignore the current machine's own slug (for edits).
 */
export async function ensureUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug;
  let counter = 2;

  while (true) {
    let query = supabase
      .from('machines')
      .select('id')
      .eq('slug', slug);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      // No collision – slug is available
      return slug;
    }

    // Collision – try next suffix
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// ─────────────────────────────────────────────────────────────
// Machines CRUD
// ─────────────────────────────────────────────────────────────

/**
 * Get all machines for admin (all statuses).
 * Returns ordered by created_at descending.
 */
export async function getMachines() {
  const { data, error } = await supabase
    .from('machines')
    .select('id, slug, category, name, name_en, type, year, price, status, features, features_en, specs, specs_en, created_at, updated_at, machine_images(*)')
    .order('created_at', { ascending: false });

  if (data) {
    data.forEach(m => {
      if (m.machine_images) {
        m.machine_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      }
    });
  }

  return { data, error };
}

/**
 * Get all published machines for the public frontend.
 * Ordered by created_at descending.
 */
export async function getPublicMachines() {
  const { data, error } = await supabase
    .from('machines')
    .select('id, slug, category, name, name_en, type, year, price, features, features_en, specs, specs_en, machine_images(*)')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (data) {
    data.forEach(m => {
      if (m.machine_images) {
        m.machine_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      }
    });
  }

  return { data, error };
}

/**
 * Get a single machine by ID (for the edit form).
 */
export async function getMachineById(id) {
  const { data, error } = await supabase
    .from('machines')
    .select('*, machine_images(*)')
    .eq('id', id)
    .single();

  if (data && data.machine_images) {
    data.machine_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  return { data, error };
}

/**
 * Get a single public machine by slug.
 */
export async function getMachineBySlug(slug) {
  const { data, error } = await supabase
    .from('machines')
    .select('*, machine_images(*)')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (data && data.machine_images) {
    data.machine_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  return { data, error };
}

/**
 * Get similar machines (same type, published, excluding current).
 */
export async function getSimilarMachines(currentMachineId, type, limitCount = 3) {
  let query = supabase
    .from('machines')
    .select('id, slug, category, name, name_en, type, year, price, machine_images(*)')
    .eq('status', 'published')
    .neq('id', currentMachineId)
    .order('created_at', { ascending: false });
    
  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query.limit(limitCount);

  if (data) {
    data.forEach(m => {
      if (m.machine_images) {
        m.machine_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      }
    });
  }

  return { data, error };
}

/**
 * Create a new machine.
 * Generates and deduplicates slug automatically.
 */
export async function createMachine(fields) {
  const baseSlug = generateSlug(fields.name);
  const slug = await ensureUniqueSlug(baseSlug);

  const { data, error } = await supabase
    .from('machines')
    .insert([{
      slug,
      name:        fields.name.trim(),
      name_en:     fields.name_en?.trim()     || null,
      category:    fields.category?.trim()    || 'other',
      type:        fields.type?.trim()        || null,
      year:        fields.year?.trim()        || null,
      price:       fields.price !== '' ? parseInt(fields.price, 10) : null,
      description: fields.description?.trim() || null,
      description_en: fields.description_en?.trim() || null,
      status:      fields.status             || 'draft',
      features:    fields.features           || [],
      features_en: fields.features_en        || null,
      specs:       fields.specs              || {},
      specs_en:    fields.specs_en           || null,
    }])
    .select()
    .single();

  return { data, error };
}

/**
 * Update an existing machine.
 * Slug is NOT auto-regenerated – only updated if explicitly changed.
 */
export async function updateMachine(id, fields) {
  const { data, error } = await supabase
    .from('machines')
    .update({
      name:        fields.name.trim(),
      name_en:     fields.name_en?.trim()     || null,
      category:    fields.category?.trim()    || 'other',
      type:        fields.type?.trim()        || null,
      year:        fields.year?.trim()        || null,
      price:       fields.price !== '' && fields.price !== null ? parseInt(fields.price, 10) : null,
      description: fields.description?.trim() || null,
      description_en: fields.description_en?.trim() || null,
      status:      fields.status,
      features:    fields.features            || [],
      features_en: fields.features_en         || null,
      specs:       fields.specs               || {},
      specs_en:    fields.specs_en            || null,
      // updated_at is handled by the database trigger
    })
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

/**
 * Delete a machine by ID.
 * machine_images rows are cascaded by the database (ON DELETE CASCADE).
 * Storage files must be cleaned up separately (Phase 6).
 */
export async function deleteMachine(id) {
  const { error } = await supabase
    .from('machines')
    .delete()
    .eq('id', id);

  return { error };
}

// ─────────────────────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────────────────────

export const STATUS_OPTIONS = [
  { value: 'draft',     label: 'Utkast',     color: '#6b7277' },
  { value: 'published', label: 'Publicerad', color: '#22c55e' },
  { value: 'reserved',  label: 'Reserverad', color: '#f59e0b' },
  { value: 'sold',      label: 'Såld',       color: '#ef4444' },
];

export function getStatusLabel(status) {
  return STATUS_OPTIONS.find(s => s.value === status)?.label ?? status;
}

export function getStatusColor(status) {
  return STATUS_OPTIONS.find(s => s.value === status)?.color ?? '#6b7277';
}

// ─────────────────────────────────────────────────────────────
// Image Management
// ─────────────────────────────────────────────────────────────

const MAX_IMAGE_SIZE_MB = 10;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function uploadMachineImage(machineId, file) {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { error: new Error('Ogiltigt filformat. Endast JPEG, PNG, WEBP och GIF är tillåtna.') };
  }
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    return { error: new Error(`Filen är för stor. Max ${MAX_IMAGE_SIZE_MB} MB.`) };
  }

  const fileExt = file.name.split('.').pop();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const storagePath = `${machineId}/${timestamp}_${randomStr}_${safeName}`;

  // Upload to Storage
  const { error: storageError } = await supabase.storage
    .from('machine-images')
    .upload(storagePath, file, { cacheControl: '3600', upsert: false });

  if (storageError) {
    return { error: storageError };
  }

  const { data: publicUrlData } = supabase.storage
    .from('machine-images')
    .getPublicUrl(storagePath);

  const imageUrl = publicUrlData.publicUrl;

  // Find current images to determine sort_order and is_primary
  const { data: currentImages } = await supabase
    .from('machine_images')
    .select('sort_order, is_primary')
    .eq('machine_id', machineId);

  const isFirstImage = !currentImages || currentImages.length === 0;
  const nextSortOrder = isFirstImage ? 0 : Math.max(...currentImages.map(i => i.sort_order || 0)) + 1;

  // Insert to DB
  const { data: insertedImage, error: dbError } = await supabase
    .from('machine_images')
    .insert([{
      machine_id: machineId,
      image_url: imageUrl,
      storage_path: storagePath,
      sort_order: nextSortOrder,
      is_primary: isFirstImage,
      alt_text: file.name
    }])
    .select()
    .single();

  // Rollback storage file if DB insert fails
  if (dbError) {
    await supabase.storage.from('machine-images').remove([storagePath]);
    return { error: new Error('Databas-fel vid sparning av bild: ' + dbError.message) };
  }

  return { data: insertedImage, error: null };
}

export async function deleteMachineImage(imageId, storagePath) {
  // 1. Delete from DB first
  const { error: dbError } = await supabase
    .from('machine_images')
    .delete()
    .eq('id', imageId);

  if (dbError) {
    return { error: dbError };
  }

  // 2. Delete from Storage
  const { error: storageError } = await supabase.storage
    .from('machine-images')
    .remove([storagePath]);

  if (storageError) {
    // If storage deletion fails, we return error but DB row is already gone.
    // In a perfect system we'd use a background job, but this is acceptable for admin tools.
    console.warn('Failed to delete storage file, but DB row was deleted:', storageError);
  }

  return { error: null };
}

export async function setPrimaryMachineImage(machineId, imageId) {
  // The database trigger 'enforce_single_primary_image' will handle unsetting other images
  const { data, error } = await supabase
    .from('machine_images')
    .update({ is_primary: true })
    .eq('id', imageId)
    .eq('machine_id', machineId) // safety check
    .select()
    .single();

  return { data, error };
}

export async function updateImageSortOrder(updates) {
  // updates is an array of objects: { id: 'uuid', sort_order: number }
  // We can update them sequentially or via a batch rpc if available.
  // Sequential updates are fine for < 10 items.
  const promises = updates.map(update => 
    supabase
      .from('machine_images')
      .update({ sort_order: update.sort_order })
      .eq('id', update.id)
  );

  const results = await Promise.all(promises);
  const error = results.find(r => r.error)?.error;
  return { error: error || null };
}
