import { supabase } from './supabase';

/**
 * Registrerar en ny försäljning.
 */
export async function createSaleRecord(data) {
  const { item_id, item_type, item_name, item_category, sold_at, sold_price } = data;
  
  return await supabase
    .from('sales_records')
    .insert([
      {
        item_id,
        item_type,
        item_name,
        item_category,
        sold_at,
        sold_price,
        status: 'active'
      }
    ])
    .select()
    .single();
}

/**
 * Återtar (revertar) alla aktiva försäljningar för ett visst objekt.
 * Används när ett objekt ändras från 'sold' till någon annan status.
 */
export async function revertSaleRecord(item_id) {
  return await supabase
    .from('sales_records')
    .update({ status: 'reverted' })
    .eq('item_id', item_id)
    .eq('status', 'active');
}

/**
 * Hämtar alla aktiva försäljningsposter (för statistik).
 */
export async function getActiveSales() {
  return await supabase
    .from('sales_records')
    .select('*')
    .eq('status', 'active')
    .order('sold_at', { ascending: false });
}
