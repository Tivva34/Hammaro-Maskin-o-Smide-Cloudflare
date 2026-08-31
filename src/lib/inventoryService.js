import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────
// Inventory CRUD
// ─────────────────────────────────────────────────────────────

/**
 * Get all inventory items for admin (all statuses).
 * Returns ordered by created_at descending.
 */
export async function getInventoryItems() {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, slug, category, name, name_en, description, description_en, price, status, created_at, updated_at, inventory_images(*)')
    .order('created_at', { ascending: false });

  if (data) {
    data.forEach(item => {
      if (item.inventory_images) {
        item.inventory_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      }
    });
  }

  return { data, error };
}

/**
 * Get all published inventory items for the public frontend.
 * Ordered by created_at descending.
 */
export async function getPublicInventoryItems() {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, slug, category, name, name_en, description, description_en, price, status, inventory_images(*)')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (data) {
    data.forEach(item => {
      if (item.inventory_images) {
        item.inventory_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      }
    });
  }

  return { data, error };
}

/**
 * Get a single inventory item by ID (for the edit form or public details if needed).
 */
export async function getInventoryItemById(id) {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*, inventory_images(*)')
    .eq('id', id)
    .single();

  if (data && data.inventory_images) {
    data.inventory_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  return { data, error };
}

/**
 * Get a single public inventory item by slug OR id for backward compatibility.
 */
export async function getInventoryItemBySlugOrId(identifier) {
  // If identifier is a valid UUID, try fetching by ID first
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
  
  let data, error;
  
  if (isUuid) {
    ({ data, error } = await supabase
      .from('inventory_items')
      .select('id, slug, category, name, name_en, description, description_en, price, status, inventory_images(*)')
      .eq('id', identifier)
      .eq('status', 'published')
      .single());
  }
  
  // If not a UUID or if UUID lookup failed (maybe it's a slug that looks like a UUID? unlikely, but possible), try slug
  if (!data && !error) {
    ({ data, error } = await supabase
      .from('inventory_items')
      .select('id, slug, category, name, name_en, description, description_en, price, status, inventory_images(*)')
      .eq('slug', identifier)
      .eq('status', 'published')
      .single());
  }

  if (data && data.inventory_images) {
    data.inventory_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  return { data, error };
}

/**
 * Get similar published inventory items by category.
 */
export async function getSimilarInventoryItems(excludeId, category, limit = 3) {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, slug, category, name, name_en, price, status, inventory_images(*)')
    .eq('status', 'published')
    .eq('category', category)
    .neq('id', excludeId)
    .limit(limit);

  if (data) {
    data.forEach(item => {
      if (item.inventory_images) {
        item.inventory_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      }
    });
  }

  return { data, error };
}

/**
 * Convert a name to a URL-friendly slug.
 */
export function generateSlug(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Ensure a slug is unique in the database.
 * Pass excludeId to ignore the current item's own slug (for edits).
 */
export async function ensureUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug;
  let isUnique = false;
  let counter = 1;

  while (!isUnique) {
    let query = supabase
      .from('inventory_items')
      .select('id')
      .eq('slug', slug);
      
    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;
    
    if (error || !data || data.length === 0) {
      isUnique = true;
      return slug;
    }
    
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
}

/**
 * Create a new inventory item.
 */
export async function createInventoryItem(fields) {
  const { data, error } = await supabase
    .from('inventory_items')
    .insert([{
      name:        fields.name.trim(),
      slug:        fields.slug, // Make sure to pass slug
      category:    fields.category || 'other',
      name_en:     fields.name_en?.trim() || null,
      description: fields.description?.trim() || null,
      description_en: fields.description_en?.trim() || null,
      price:       fields.price !== '' && fields.price != null ? parseInt(fields.price, 10) : null,
      status:      fields.status || 'draft',
    }])
    .select()
    .single();

  return { data, error };
}

/**
 * Update an existing inventory item.
 */
export async function updateInventoryItem(id, fields) {
  const { data, error } = await supabase
    .from('inventory_items')
    .update({
      name:        fields.name.trim(),
      slug:        fields.slug,
      category:    fields.category || 'other',
      name_en:     fields.name_en?.trim() || null,
      description: fields.description?.trim() || null,
      description_en: fields.description_en?.trim() || null,
      price:       fields.price !== '' && fields.price != null ? parseInt(fields.price, 10) : null,
      status:      fields.status,
    })
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

/**
 * Delete an inventory item by ID.
 * inventory_images rows are cascaded by the database (ON DELETE CASCADE).
 * Storage files must be cleaned up separately.
 */
export async function deleteInventoryItem(id) {
  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', id);

  return { error };
}

// ─────────────────────────────────────────────────────────────
// Status & Category helpers
// ─────────────────────────────────────────────────────────────

export const INVENTORY_CATEGORIES = [
  { value: 'agriculture',  labelKey: 'inventory.categories.agriculture' },
  { value: 'construction', labelKey: 'inventory.categories.construction' },
  { value: 'workshop',     labelKey: 'inventory.categories.workshop' },
  { value: 'tires',        labelKey: 'inventory.categories.tires' },
  { value: 'parts',        labelKey: 'inventory.categories.parts' },
  { value: 'other',        labelKey: 'inventory.categories.other' },
];

export const INVENTORY_STATUS_OPTIONS = [
  { value: 'draft',     label: 'Utkast',     color: '#6b7277' },
  { value: 'published', label: 'Publicerad', color: '#22c55e' },
  { value: 'reserved',  label: 'Reserverad', color: '#f59e0b' },
  { value: 'sold',      label: 'Såld',       color: '#ef4444' },
];

export function getInventoryStatusLabel(status) {
  return INVENTORY_STATUS_OPTIONS.find(s => s.value === status)?.label ?? status;
}

export function getInventoryStatusColor(status) {
  return INVENTORY_STATUS_OPTIONS.find(s => s.value === status)?.color ?? '#6b7277';
}

// ─────────────────────────────────────────────────────────────
// Image Management
// ─────────────────────────────────────────────────────────────

const MAX_IMAGE_SIZE_MB = 10;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function uploadInventoryImage(itemId, file) {
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
  const storagePath = `${itemId}/${timestamp}_${randomStr}_${safeName}`;

  // Upload to Storage
  const { error: storageError } = await supabase.storage
    .from('inventory-images')
    .upload(storagePath, file, { cacheControl: '3600', upsert: false });

  if (storageError) {
    return { error: storageError };
  }

  const { data: publicUrlData } = supabase.storage
    .from('inventory-images')
    .getPublicUrl(storagePath);

  const imageUrl = publicUrlData.publicUrl;

  // Find current images to determine sort_order and is_primary
  const { data: currentImages } = await supabase
    .from('inventory_images')
    .select('sort_order, is_primary')
    .eq('item_id', itemId);

  const isFirstImage = !currentImages || currentImages.length === 0;
  const nextSortOrder = isFirstImage ? 0 : Math.max(...currentImages.map(i => i.sort_order || 0)) + 1;

  // Insert to DB
  const { data: insertedImage, error: dbError } = await supabase
    .from('inventory_images')
    .insert([{
      item_id: itemId,
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
    await supabase.storage.from('inventory-images').remove([storagePath]);
    return { error: new Error('Databas-fel vid sparning av bild: ' + dbError.message) };
  }

  return { data: insertedImage, error: null };
}

export async function deleteInventoryImage(imageId, storagePath) {
  // 1. Delete from DB first
  const { error: dbError } = await supabase
    .from('inventory_images')
    .delete()
    .eq('id', imageId);

  if (dbError) {
    return { error: dbError };
  }

  // 2. Delete from Storage
  const { error: storageError } = await supabase.storage
    .from('inventory-images')
    .remove([storagePath]);

  if (storageError) {
    console.warn('Failed to delete storage file, but DB row was deleted:', storageError);
  }

  return { error: null };
}

export async function setPrimaryInventoryImage(itemId, imageId) {
  // First, unset all other primary images for this item
  const { error: unsetError } = await supabase
    .from('inventory_images')
    .update({ is_primary: false })
    .eq('item_id', itemId);

  if (unsetError) return { error: unsetError };

  // Then, set the target image as primary
  const { data, error } = await supabase
    .from('inventory_images')
    .update({ is_primary: true })
    .eq('id', imageId)
    .select()
    .single();

  return { data, error };
}

export async function updateInventoryImageSortOrder(updates) {
  const promises = updates.map(update => 
    supabase
      .from('inventory_images')
      .update({ sort_order: update.sort_order })
      .eq('id', update.id)
  );

  const results = await Promise.all(promises);
  const error = results.find(r => r.error)?.error;
  return { error: error || null };
}
